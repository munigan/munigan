import { randomUUID } from "node:crypto";
import type pg from "pg";
import type {
  LibraryItem,
  LibraryPage,
  LibraryQuery,
} from "@/domain/accounts/contracts";
import type { TopGearReport } from "@/domain/top-gear/model";
import { AccountError } from "@/server/auth/errors";
import { pool } from "@/server/db/client";
import { decrypt } from "@/server/jobs/capabilities";
import { summarizeReport } from "./report-summary";

const pageSize = 20;
const maximumCursorLength = 1024;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function invalidRequest(): AccountError {
  return new AccountError("INVALID_REQUEST", 400);
}

type Cursor = { savedAt: string; id: string };

// Validate canonical UTC timestamps without rounding PostgreSQL microseconds.
function validCursorTimestamp(value: string): boolean {
  const parts =
    /^(\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])T([01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3,6}Z$/.exec(
      value,
    );
  if (!parts) return false;
  const year = Number(parts[1]),
    month = Number(parts[2]),
    day = Number(parts[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return (
    year > 0 &&
    day <=
      [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]
  );
}

function parseCursor(value: string | undefined): Cursor | null {
  if (!value) return null;
  if (value.length > maximumCursorLength) throw invalidRequest();
  try {
    const parsed = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    if (
      typeof parsed.savedAt !== "string" ||
      !validCursorTimestamp(parsed.savedAt) ||
      typeof parsed.id !== "string" ||
      !uuidPattern.test(parsed.id)
    )
      throw invalidRequest();
    return { savedAt: parsed.savedAt, id: parsed.id };
  } catch (error) {
    if (error instanceof AccountError) throw error;
    throw invalidRequest();
  }
}

function encodeCursor(savedAt: string, id: string): string {
  return Buffer.from(JSON.stringify({ savedAt, id })).toString("base64url");
}

function escapeSearch(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export async function publishReport(
  client: pg.PoolClient,
  input: { jobId: string; userId: string; report: TopGearReport },
): Promise<string | null> {
  if (
    !["complete", "partial", "canceled"].includes(input.report.status) ||
    input.report.rows.length === 0
  )
    throw new AccountError("REPORT_NOT_READY", 409);
  const summary = summarizeReport(input.report);
  const id = randomUUID();
  const inserted = await client.query(
    `INSERT INTO library_items(id,user_id,job_id,tool,kind,title,character_name,summary,created_at)
     SELECT $1,$2,j.id,'top-gear','report',$3,$4,$5,j.created_at
       FROM tg_jobs j
      WHERE j.id=$6 AND j.account_id=$2 AND j.deleted_at IS NULL
     ON CONFLICT(job_id) DO NOTHING
     RETURNING id`,
    [
      id,
      input.userId,
      summary.characterName,
      summary.characterName,
      summary,
      input.jobId,
    ],
  );
  let itemId = inserted.rows[0]?.id as string | undefined;
  if (!itemId) {
    const existing = await client.query(
      "SELECT id,user_id,deleted_at FROM library_items WHERE job_id=$1",
      [input.jobId],
    );
    const row = existing.rows[0] as
      { id: string; user_id: string; deleted_at: Date | null } | undefined;
    if (!row || row.user_id !== input.userId || row.deleted_at)
      throw new AccountError("NOT_FOUND", 404);
    itemId = row.id;
  }
  const published = await client.query(
    "UPDATE tg_jobs SET published_at=coalesce(published_at,now()) WHERE id=$1 AND account_id=$2 AND deleted_at IS NULL RETURNING id",
    [input.jobId, input.userId],
  );
  if (!published.rowCount) throw new AccountError("NOT_FOUND", 404);
  return itemId;
}

export async function listLibrary(
  userId: string,
  query: LibraryQuery,
): Promise<LibraryPage> {
  if (query.tool !== undefined && query.tool !== "top-gear")
    throw invalidRequest();
  if (query.sort !== undefined && !["newest", "oldest"].includes(query.sort))
    throw invalidRequest();
  for (const [value, limit] of [
    [query.character, 80],
    [query.classKey, 80],
    [query.spec, 120],
  ] as const) {
    if (value !== undefined && (!value.length || value.length > limit))
      throw invalidRequest();
  }
  const direction = query.sort === "oldest" ? "ASC" : "DESC";
  const comparison = query.sort === "oldest" ? ">" : "<";
  const cursor = parseCursor(query.cursor);
  const search = query.search?.trim().slice(0, 101) ?? "";
  if (search.length > 100) throw invalidRequest();
  const values: unknown[] = [userId];
  const conditions = ["user_id=$1", "deleted_at IS NULL"];
  if (query.tool) {
    values.push(query.tool);
    conditions.push(`tool=$${values.length}`);
  }
  const facetValues = [...values];
  const facetWhere = conditions.join(" AND ");
  for (const [field, value] of [
    ["character_name", query.character],
    ["summary->>'classKey'", query.classKey],
    ["summary->>'specKey'", query.spec],
  ] as const) {
    if (value) {
      values.push(value);
      conditions.push(`${field}=$${values.length}`);
    }
  }
  if (search) {
    values.push(`%${escapeSearch(search)}%`);
    conditions.push(
      `(title ILIKE $${values.length} ESCAPE '\\' OR character_name ILIKE $${values.length} ESCAPE '\\')`,
    );
  }
  const countValues = [...values];
  const countWhere = conditions.join(" AND ");
  if (cursor) {
    values.push(cursor.savedAt, cursor.id);
    conditions.push(
      `(saved_at,id)${comparison}($${values.length - 1}::timestamptz,$${values.length}::uuid)`,
    );
  }
  values.push(pageSize + 1);
  const [facets, count, result] = await Promise.all([
    pool.query(
      `SELECT character_name, summary->>'classKey' AS class_key,
      count(*)::int AS count, array_agg(DISTINCT summary->>'specKey') AS spec_keys,
      max(saved_at) AS last_saved_at FROM library_items WHERE ${facetWhere}
      GROUP BY character_name, summary->>'classKey' ORDER BY max(saved_at) DESC,character_name`,
      facetValues,
    ),
    pool.query(
      `SELECT count(*)::int AS count FROM library_items WHERE ${countWhere}`,
      countValues,
    ),
    pool.query(
      `WITH page AS (SELECT id,job_id,tool,kind,title,summary,created_at,saved_at,
              to_char(saved_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_saved_at
       FROM library_items
      WHERE ${conditions.join(" AND ")}
      ORDER BY saved_at ${direction},id ${direction}
      LIMIT $${values.length})
      SELECT page.*, (
        SELECT jsonb_build_object(
          'itemVersion',coalesce(j.report #> '{snapshot,itemVersion}','"classic"'::jsonb),
          'combinations',j.report #> '{coverage,succeeded}',
          'duration',j.report #> '{snapshot,settings,encounter,duration}',
          'targetCount',jsonb_array_length(j.report #> '{snapshot,settings,encounter,targets}')
        ) FROM tg_jobs j WHERE j.id=page.job_id AND j.account_id=$1 AND j.deleted_at IS NULL
      ) AS context FROM page ORDER BY saved_at ${direction},id ${direction}`,
      values,
    ),
  ]);
  const pageRows = result.rows.slice(0, pageSize) as Array<{
    id: string;
    tool: "top-gear";
    kind: "report";
    title: string;
    summary: LibraryItem["summary"];
    context: LibraryItem["context"];
    created_at: Date;
    saved_at: Date;
    cursor_saved_at: string;
  }>;
  return {
    total: facets.rows.reduce((total, row) => total + row.count, 0),
    filteredTotal: count.rows[0].count,
    pageSize,
    characters: facets.rows.map((row) => ({
      name: row.character_name,
      classKey: row.class_key,
      count: row.count,
      specKeys: row.spec_keys,
      lastSavedAt: row.last_saved_at.toISOString(),
    })),
    items: pageRows.map((row) => ({
      id: row.id,
      tool: row.tool,
      kind: row.kind,
      title: row.title,
      summary: row.summary,
      context: row.context,
      createdAt: row.created_at.toISOString(),
      savedAt: row.saved_at.toISOString(),
    })),
    nextCursor:
      result.rows.length > pageSize && pageRows.length
        ? encodeCursor(pageRows.at(-1)!.cursor_saved_at, pageRows.at(-1)!.id)
        : null,
    tools: ["top-gear"],
  };
}

export async function libraryReportPath(
  userId: string,
  itemId: string,
): Promise<string> {
  if (!uuidPattern.test(itemId)) throw new AccountError("NOT_FOUND", 404);
  const result = await pool.query(
    `SELECT j.token_cipher
       FROM library_items li
       JOIN tg_jobs j ON j.id=li.job_id
       JOIN account_lifecycle a ON a.user_id=li.user_id
      WHERE li.id=$1 AND li.user_id=$2 AND li.deleted_at IS NULL
        AND j.account_id=$2 AND j.deleted_at IS NULL AND j.token_cipher IS NOT NULL
        AND a.status='active'`,
    [itemId, userId],
  );
  if (!result.rowCount) throw new AccountError("NOT_FOUND", 404);
  return `/reports/${decrypt(result.rows[0].token_cipher as string)}`;
}
