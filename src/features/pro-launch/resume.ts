import {
  proLaunchSources,
  type ProLaunchSource,
} from "@/domain/pro-launch/contracts";
import { safeReturnPath } from "@/features/auth/return-state";

const storageKey = "munigan.pro-launch.resume";
const lifetime = 5 * 60_000;
const maxStoredLength = 4096;

type ResumeRecord = {
  version: 1;
  expiresAt: number;
  userId: string;
  returnPath: string;
  source: ProLaunchSource;
};

function validSource(value: unknown): value is ProLaunchSource {
  return proLaunchSources.includes(value as ProLaunchSource);
}

function validRecord(value: unknown, now: number): value is ResumeRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as ResumeRecord;
  return (
    Object.keys(record).length === 5 &&
    record.version === 1 &&
    Number.isFinite(record.expiresAt) &&
    record.expiresAt > now &&
    record.expiresAt <= now + lifetime &&
    typeof record.userId === "string" &&
    record.userId.length > 0 &&
    record.userId.length <= 128 &&
    typeof record.returnPath === "string" &&
    record.returnPath.length <= 2048 &&
    safeReturnPath(record.returnPath, window.location.origin) ===
      record.returnPath &&
    validSource(record.source)
  );
}

function removeResume(): boolean {
  try {
    sessionStorage.removeItem(storageKey);
    return true;
  } catch {
    return false;
  }
}

function loadResume(): ResumeRecord | null {
  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return null;
    if (raw.length > maxStoredLength) {
      removeResume();
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!validRecord(parsed, Date.now())) {
      removeResume();
      return null;
    }
    return parsed;
  } catch {
    removeResume();
    return null;
  }
}

export function storeProLaunchResume(input: {
  userId: string;
  returnPath: string;
  source: ProLaunchSource;
}): void {
  const record: ResumeRecord = {
    version: 1,
    expiresAt: Date.now() + lifetime,
    userId: input.userId,
    returnPath: input.returnPath,
    source: input.source,
  };
  if (!validRecord(record, Date.now()))
    throw new Error("Invalid PRO launch resume");
  const raw = JSON.stringify(record);
  if (raw.length > maxStoredLength)
    throw new Error("Invalid PRO launch resume");
  sessionStorage.setItem(storageKey, raw);
}

export function hasProLaunchResume(returnPath: string): boolean {
  const record = loadResume();
  if (!record) return false;
  const expectedPath = safeReturnPath(returnPath, window.location.origin);
  if (record.returnPath !== expectedPath) {
    removeResume();
    return false;
  }
  return true;
}

export function consumeProLaunchResume(
  userId: string,
  returnPath: string,
): { source: ProLaunchSource } | null {
  const record = loadResume();
  if (!record) return null;
  const expectedPath = safeReturnPath(returnPath, window.location.origin);
  if (record.userId !== userId || record.returnPath !== expectedPath) {
    removeResume();
    return null;
  }
  if (!removeResume()) return null;
  return { source: record.source };
}
