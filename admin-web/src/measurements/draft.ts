import {
  MAX_OPERATOR_LENGTH,
  MAX_REGISTRATION_LENGTH,
  MeasurementError,
  positionsFor,
  slotKey,
  validCalendarDate,
  validWheelLayout,
  validateReading,
  type Reading,
  type WheelLayout,
} from "./model";

export interface Draft {
  version: 1;
  id: string;
  /** Set when the truck was picked from the fleet register; absent when typed. */
  vehicleId?: string;
  registration: string;
  operator: string;
  inspectionDate: string;
  odometerInput: string;
  axleCount: number;
  wheelLayout: WheelLayout;
  readings: Reading[];
}
export const DRAFT_STORAGE_KEY = "susumu.tenken.measurement-draft.v1";
const MAX_DRAFT_BYTES = 128 * 1024;
type Reader = Pick<Storage, "getItem">;
type Writer = Pick<Storage, "getItem" | "setItem">;

export function emptyDraft(): Draft {
  if (!globalThis.crypto?.randomUUID)
    throw new MeasurementError("UUID_UNAVAILABLE");
  const now = new Date();
  return {
    version: 1,
    id: globalThis.crypto.randomUUID(),
    registration: "",
    operator: "",
    inspectionDate: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`,
    odometerInput: "",
    axleCount: 3,
    wheelLayout: ["single", "dual", "dual"],
    readings: [],
  };
}
function shortText(value: unknown, max: number): value is string {
  return (
    typeof value === "string" &&
    value.length <= max &&
    [...value].every(
      (character) =>
        character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
    )
  );
}
export function validateDraft(value: unknown): asserts value is Draft {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  )
    throw new MeasurementError("INVALID_DRAFT");
  const draft = value as Record<string, unknown>;
  const keys = [
    "version",
    "id",
    "registration",
    "operator",
    "inspectionDate",
    "odometerInput",
    "axleCount",
    "wheelLayout",
    "readings",
  ];
  // vehicleId is optional so a draft written before the fleet link existed still
  // opens instead of being reported as corrupt.
  const optional = ["vehicleId"];
  if (
    keys.some((key) => !Object.hasOwn(draft, key)) ||
    Object.keys(draft).some(
      (key) => !keys.includes(key) && !optional.includes(key),
    ) ||
    (Object.hasOwn(draft, "vehicleId") &&
      (typeof draft.vehicleId !== "string" ||
        !/^[a-zA-Z0-9._:-]{1,100}$/.test(draft.vehicleId))) ||
    draft.version !== 1 ||
    typeof draft.id !== "string" ||
    !/^[a-zA-Z0-9._:-]{1,100}$/.test(draft.id) ||
    !shortText(draft.registration, MAX_REGISTRATION_LENGTH) ||
    !shortText(draft.operator, MAX_OPERATOR_LENGTH) ||
    (draft.inspectionDate !== "" && !validCalendarDate(draft.inspectionDate)) ||
    !shortText(draft.odometerInput, 10) ||
    !Number.isInteger(draft.axleCount) ||
    (draft.axleCount as number) < 2 ||
    (draft.axleCount as number) > 4 ||
    !validWheelLayout(draft.wheelLayout, draft.axleCount as number) ||
    !Array.isArray(draft.readings) ||
    draft.readings.length > 24
  )
    throw new MeasurementError("INVALID_DRAFT");
  const seenIds = new Set<string>([draft.id]);
  const seenSlots = new Set<string>();
  for (const reading of draft.readings) {
    validateReading(reading);
    const slot = slotKey(reading.metric, reading.position);
    if (
      reading.supersedesId ||
      seenIds.has(reading.id) ||
      seenSlots.has(slot) ||
      !positionsFor(
        reading.metric,
        draft.axleCount as number,
        draft.wheelLayout,
      ).some((position) => slotKey(reading.metric, position) === slot)
    )
      throw new MeasurementError("INVALID_DRAFT");
    seenIds.add(reading.id);
    seenSlots.add(slot);
  }
}
function readRaw(storage: Reader): string | null {
  try {
    return storage.getItem(DRAFT_STORAGE_KEY);
  } catch {
    throw new MeasurementError("STORAGE_READ_FAILED");
  }
}
function decode(raw: string): Draft {
  if (raw.length * 2 > MAX_DRAFT_BYTES)
    throw new MeasurementError("STORAGE_TOO_LARGE");
  try {
    const draft: unknown = JSON.parse(raw);
    validateDraft(draft);
    return draft;
  } catch {
    throw new MeasurementError("CORRUPT_STORAGE");
  }
}
export function loadDraft(storage: Reader): {
  draft: Draft;
  raw: string | null;
} {
  const raw = readRaw(storage);
  return { draft: raw === null ? emptyDraft() : decode(raw), raw };
}
export function saveDraft(
  storage: Writer,
  expectedRaw: string | null,
  draft: Draft,
): string {
  validateDraft(draft);
  const currentRaw = readRaw(storage);
  if (currentRaw !== expectedRaw)
    throw new MeasurementError("STORAGE_CONFLICT");
  if (currentRaw !== null) decode(currentRaw);
  const encoded = JSON.stringify(draft);
  if (encoded.length * 2 > MAX_DRAFT_BYTES)
    throw new MeasurementError("STORAGE_TOO_LARGE");
  if (readRaw(storage) !== expectedRaw)
    throw new MeasurementError("STORAGE_CONFLICT");
  try {
    storage.setItem(DRAFT_STORAGE_KEY, encoded);
  } catch (error) {
    throw new MeasurementError(
      error instanceof DOMException &&
        (error.name === "QuotaExceededError" ||
          error.name === "NS_ERROR_DOM_QUOTA_REACHED")
        ? "STORAGE_QUOTA_EXCEEDED"
        : "STORAGE_WRITE_FAILED",
    );
  }
  return encoded;
}
