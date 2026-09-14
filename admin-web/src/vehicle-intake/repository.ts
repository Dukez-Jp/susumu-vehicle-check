import {
  MLIT_ORIGINAL_FIELD_KEYS,
  validateCapture,
  type CaptureDraft,
} from "./capture";

/** IDs identify reviewed local captures, never vehicles or inspections. */
export interface CaptureRecord extends CaptureDraft {
  id: string;
  capturedAt: string;
}

export interface CaptureStore {
  version: 1;
  records: CaptureRecord[];
}

export const STORAGE_KEY = "susumu.vehicle-capture.demo.v1";
export const MAX_CAPTURE_RECORDS = 1000;
/** UTF-16 code units × 2. Browser quota can be lower and is handled separately. */
export const MAX_STORAGE_BYTES = 10 * 1024 * 1024;

export type CaptureStorageErrorCode =
  | "INVALID_CAPTURE"
  | "CORRUPT_STORAGE"
  | "STORAGE_CONFLICT"
  | "STORAGE_READ_FAILED"
  | "STORAGE_WRITE_FAILED"
  | "STORAGE_QUOTA_EXCEEDED"
  | "CAPTURE_LIMIT"
  | "STORAGE_TOO_LARGE"
  | "UUID_UNAVAILABLE";

export class CaptureStorageError extends Error {
  constructor(public readonly code: CaptureStorageErrorCode) {
    super(code);
    this.name = "CaptureStorageError";
  }
}

const FIELD_KEYS = [
  "plate",
  "chassis",
  "manufacturer",
  "model",
  "engineModel",
  "firstRegistration",
  "validUntil",
  "grossWeightKg",
  "internalNumber",
  "odometerKm",
] as const;
const RECORD_KEYS = [
  "fields",
  "source",
  "sourceVersion",
  "originalFields",
  "warnings",
  "id",
  "capturedAt",
];
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ObjectValue = Record<string, unknown>;

function isObject(value: unknown): value is ObjectValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: ObjectValue, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function fail(code: CaptureStorageErrorCode): never {
  throw new CaptureStorageError(code);
}

function ensureSize(raw: string): void {
  if (raw.length * 2 > MAX_STORAGE_BYTES) fail("STORAGE_TOO_LARGE");
}

function readRaw(storage: Pick<Storage, "getItem">): string | null {
  try {
    return storage.getItem(STORAGE_KEY);
  } catch {
    return fail("STORAGE_READ_FAILED");
  }
}

/** Copy only documented fields; raw exports, credentials and owner data never enter the store. */
function cleanDraft(value: unknown, persisted: boolean): CaptureDraft {
  const error = persisted ? "CORRUPT_STORAGE" : "INVALID_CAPTURE";
  if (
    !isObject(value) ||
    !isObject(value.fields) ||
    (value.source !== "manual" && value.source !== "mlit-json") ||
    !Array.isArray(value.warnings) ||
    value.warnings.length > 20 ||
    value.warnings.some(
      (warning) => typeof warning !== "string" || warning.length > 500,
    )
  ) {
    return fail(error);
  }
  if (
    persisted &&
    (!hasOnlyKeys(value, RECORD_KEYS) || !hasOnlyKeys(value.fields, FIELD_KEYS))
  ) {
    return fail(error);
  }
  const fields = {} as CaptureDraft["fields"];
  for (const key of FIELD_KEYS) {
    const field = value.fields[key];
    if (typeof field !== "string") return fail(error);
    fields[key] = field;
  }
  if (Object.keys(validateCapture(fields)).length !== 0) return fail(error);
  const result: CaptureDraft = {
    fields,
    source: value.source,
    warnings: [...value.warnings] as string[],
  };
  if (value.sourceVersion !== undefined) {
    if (
      typeof value.sourceVersion !== "string" ||
      value.sourceVersion.length > 80
    ) {
      return fail(error);
    }
    result.sourceVersion = value.sourceVersion;
  }
  if (value.originalFields !== undefined) {
    if (
      !isObject(value.originalFields) ||
      (persisted &&
        !hasOnlyKeys(value.originalFields, MLIT_ORIGINAL_FIELD_KEYS))
    ) {
      return fail(error);
    }
    const originals: Record<string, string> = {};
    // Fixed ordering also makes duplicate detection independent of input key order.
    for (const key of MLIT_ORIGINAL_FIELD_KEYS) {
      const original = value.originalFields[key];
      if (original === undefined) continue;
      if (typeof original !== "string" || original.length > 1024)
        return fail(error);
      originals[key] = original;
    }
    if (Object.keys(originals).length > 0) result.originalFields = originals;
  }
  return result;
}

function parseStore(raw: string | null): CaptureStore {
  if (raw === null) return { version: 1, records: [] };
  ensureSize(raw);
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return fail("CORRUPT_STORAGE");
  }
  if (
    !isObject(value) ||
    !hasOnlyKeys(value, ["version", "records"]) ||
    value.version !== 1 ||
    !Array.isArray(value.records)
  ) {
    return fail("CORRUPT_STORAGE");
  }
  if (value.records.length > MAX_CAPTURE_RECORDS) return fail("CAPTURE_LIMIT");
  const ids = new Set<string>();
  const records = value.records.map((entry): CaptureRecord => {
    const draft = cleanDraft(entry, true);
    if (
      !isObject(entry) ||
      typeof entry.id !== "string" ||
      !UUID.test(entry.id) ||
      ids.has(entry.id.toLowerCase()) ||
      typeof entry.capturedAt !== "string"
    ) {
      return fail("CORRUPT_STORAGE");
    }
    const date = new Date(entry.capturedAt);
    if (
      !Number.isFinite(date.getTime()) ||
      date.toISOString() !== entry.capturedAt
    ) {
      return fail("CORRUPT_STORAGE");
    }
    ids.add(entry.id.toLowerCase());
    return { ...draft, id: entry.id, capturedAt: entry.capturedAt };
  });
  return { version: 1, records };
}

export function loadCaptures(storage: Pick<Storage, "getItem">): {
  store: CaptureStore;
  raw: string | null;
} {
  const raw = readRaw(storage);
  return { store: parseStore(raw), raw };
}

function identity(draft: CaptureDraft): string {
  return JSON.stringify({
    fields: draft.fields,
    source: draft.source,
    sourceVersion: draft.sourceVersion,
    originalFields: draft.originalFields,
  });
}

export function saveCapture(
  storage: Pick<Storage, "getItem" | "setItem">,
  expectedRaw: string | null,
  draft: CaptureDraft,
): {
  store: CaptureStore;
  raw: string;
  record: CaptureRecord;
  duplicate: boolean;
} {
  const previousRaw = readRaw(storage);
  if (previousRaw !== expectedRaw) return fail("STORAGE_CONFLICT");
  const store = parseStore(previousRaw);
  const cleaned = cleanDraft(draft, false);
  const key = identity(cleaned);
  const existing = store.records.find((record) => identity(record) === key);
  if (existing) {
    if (readRaw(storage) !== previousRaw) return fail("STORAGE_CONFLICT");
    // A duplicate must preserve even the original JSON bytes; no history rewrite.
    return { store, raw: previousRaw!, record: existing, duplicate: true };
  }
  if (store.records.length >= MAX_CAPTURE_RECORDS) return fail("CAPTURE_LIMIT");
  let id: string;
  try {
    id = globalThis.crypto.randomUUID();
  } catch {
    return fail("UUID_UNAVAILABLE");
  }
  if (
    !UUID.test(id) ||
    store.records.some((record) => record.id.toLowerCase() === id.toLowerCase())
  ) {
    return fail("UUID_UNAVAILABLE");
  }
  const record: CaptureRecord = {
    ...cleaned,
    id,
    capturedAt: new Date().toISOString(),
  };
  const next: CaptureStore = {
    version: 1,
    records: [...store.records, record],
  };
  const raw = JSON.stringify(next);
  ensureSize(raw);
  // No asynchronous gap. This detects stale tabs, but localStorage has no atomic CAS.
  if (readRaw(storage) !== previousRaw) return fail("STORAGE_CONFLICT");
  try {
    storage.setItem(STORAGE_KEY, raw);
  } catch (error) {
    // DOMException can belong to another realm and fail an instanceof Error check.
    if (isObject(error) && error.name === "QuotaExceededError") {
      return fail("STORAGE_QUOTA_EXCEEDED");
    }
    return fail("STORAGE_WRITE_FAILED");
  }
  return { store: next, raw, record, duplicate: false };
}
