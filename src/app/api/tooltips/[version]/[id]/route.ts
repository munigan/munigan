import { getCatalog } from "@/domain/equipment/catalog";
import { TooltipVersionSchema } from "@/domain/tooltips/contracts";
import { fetchItemTooltip, TooltipRelayError } from "@/server/tooltips/relay";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ version: string; id: string }> },
) {
  const input = await params;
  const version = TooltipVersionSchema.safeParse(input.version);
  if (
    !version.success ||
    !/^[1-9]\d{0,6}$/.test(input.id) ||
    Number(input.id) > 1_000_000
  )
    return Response.json(
      { code: "invalidInput" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  const id = Number(input.id),
    catalog = getCatalog(version.data);
  // Bound the public endpoint to our finite item catalog. The private Worker
  // accepts item IDs, never a caller-supplied upstream URL or HTML.
  if (
    !catalog.items.has(id) &&
    !catalog.gems.has(id) &&
    !catalog.icons?.has(id)
  )
    return Response.json(
      { code: "tooltipNotFound" },
      { status: 404, headers: { "Cache-Control": "no-store" } },
    );
  try {
    const result = await fetchItemTooltip(version.data, id);
    return Response.json(result, {
      headers: {
        "Cache-Control":
          result.meta.cache === "stale"
            ? "public, max-age=60, s-maxage=60, stale-while-revalidate=300"
            : "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400, stale-if-error=604800",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const status = error instanceof TooltipRelayError ? error.status : 503;
    return Response.json(
      { code: status === 404 ? "tooltipNotFound" : "tooltipUnavailable" },
      {
        status,
        headers: { "Cache-Control": "no-store", "Retry-After": "300" },
      },
    );
  }
}
