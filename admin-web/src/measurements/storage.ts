import {
  isSimulatedSession,
  MAX_SESSIONS,
  MeasurementError,
  validateReading,
  validateSession,
  validateStore,
  type MeasurementSession,
  type MeasurementStore,
  type Reading,
} from "./model";

export { MeasurementError } from "./model";

/**
 * Real measurements and rehearsal measurements live in separate stores, under
 * separate keys. A value invented by the simulator must never reach the history
 * a mechanic consults for a real truck, and a minimum printed on the form must
 * never be computed from one. Routing happens in `saveSession`, from the content
 * of the session itself, so it cannot be forgotten at a call site.
 */
export type StoreKind = "real" | "demo";
export const STORAGE_KEY = "susumu.tenken.measurements.v1";
export const DEMO_STORAGE_KEY = "susumu.tenken.measurements.demo.v1";
/** UTF-16 bytes; actual browser quota may be lower. */
export const MAX_STORAGE_BYTES = 20 * 1024 * 1024;
type Reader = Pick<Storage, "getItem">;
type Writer = Pick<Storage, "getItem" | "setItem">;

export function storageKeyFor(kind: StoreKind): string {
  return kind === "demo" ? DEMO_STORAGE_KEY : STORAGE_KEY;
}

/** Where a session belongs, decided by its readings and never by the caller. */
export function storeKindFor(session: MeasurementSession): StoreKind {
  return isSimulatedSession(session) ? "demo" : "real";
}

function readRaw(storage: Reader, kind: StoreKind): string | null {
  try {
    return storage.getItem(storageKeyFor(kind));
  } catch {
    throw new MeasurementError("STORAGE_READ_FAILED");
  }
}
function decode(raw: string | null): MeasurementStore {
  if (raw === null) return { version: 1, sessions: [] };
  if (raw.length * 2 > MAX_STORAGE_BYTES)
    throw new MeasurementError("STORAGE_TOO_LARGE");
  try {
    const parsed: unknown = JSON.parse(raw);
    validateStore(parsed);
    return parsed;
  } catch {
    throw new MeasurementError("CORRUPT_STORAGE");
  }
}
export function loadMeasurements(
  storage: Reader,
  kind: StoreKind = "real",
): MeasurementStore {
  return decode(readRaw(storage, kind));
}
function write(
  storage: Writer,
  kind: StoreKind,
  expected: string | null,
  next: MeasurementStore,
): MeasurementStore {
  validateStore(next);
  const encoded = JSON.stringify(next);
  if (encoded.length * 2 > MAX_STORAGE_BYTES)
    throw new MeasurementError("STORAGE_TOO_LARGE");
  // Best-effort stale-write detection; localStorage offers no cross-tab atomic CAS.
  if (readRaw(storage, kind) !== expected)
    throw new MeasurementError("STORAGE_CONFLICT");
  try {
    storage.setItem(storageKeyFor(kind), encoded);
  } catch (error) {
    throw new MeasurementError(
      error instanceof DOMException &&
        (error.name === "QuotaExceededError" ||
          error.name === "NS_ERROR_DOM_QUOTA_REACHED")
        ? "STORAGE_QUOTA_EXCEEDED"
        : "STORAGE_WRITE_FAILED",
    );
  }
  return next;
}
/**
 * New sessions only. Persisted history can be changed only by appending a
 * correction. A session that carries a simulated reading must be simulated
 * throughout, and is stored apart from real work.
 */
export function saveSession(
  storage: Writer,
  session: MeasurementSession,
): MeasurementStore {
  validateSession(session);
  if (session.readings.some((reading) => reading.supersedesId))
    throw new MeasurementError("INVALID_SESSION");
  const kind = storeKindFor(session);
  if (
    kind === "demo" &&
    session.readings.some((reading) => reading.source !== "simulator")
  )
    throw new MeasurementError("MIXED_SOURCES");
  const raw = readRaw(storage, kind);
  const current = decode(raw);
  if (current.sessions.some((saved) => saved.id === session.id))
    throw new MeasurementError("DUPLICATE_ID");
  if (current.sessions.length >= MAX_SESSIONS)
    throw new MeasurementError("SESSION_LIMIT");
  return write(storage, kind, raw, {
    version: 1,
    sessions: [...current.sessions, session],
  });
}
/** Appends a new reading; the target and its reason trail remain immutable. */
export function appendCorrection(
  storage: Writer,
  sessionId: string,
  reading: Reading,
  kind: StoreKind = "real",
): MeasurementStore {
  validateReading(reading);
  if (!reading.supersedesId || !reading.correctionReason?.trim())
    throw new MeasurementError("INVALID_CORRECTION");
  // A rehearsal value cannot be introduced into real history by way of a correction.
  if (kind === "real" && reading.source === "simulator")
    throw new MeasurementError("MIXED_SOURCES");
  const raw = readRaw(storage, kind);
  const current = decode(raw);
  const session = current.sessions.find((saved) => saved.id === sessionId);
  if (!session) throw new MeasurementError("SESSION_NOT_FOUND");
  const nextSession = { ...session, readings: [...session.readings, reading] };
  validateSession(nextSession);
  return write(storage, kind, raw, {
    version: 1,
    sessions: current.sessions.map((saved) =>
      saved.id === sessionId ? nextSession : saved,
    ),
  });
}
