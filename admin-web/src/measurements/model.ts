/** Measurement capture is independent of mechanical inspection approval. */
/**
 * A truck can carry disc brakes on one axle and drums on another, and the source
 * PDF keeps separate lines for each: pdf-029 パッドの摩耗 for pads, pdf-025
 * シューの摺動部分及びライニングの摩耗 for drum linings. They are distinct metrics
 * so a drum vehicle is never recorded, printed or linked as if it had pads.
 */
export type Metric = "tireTread" | "brakePad" | "brakeLining";
export type Source = "manual" | "simulator" | "bluetooth";
/** Pads and linings are one per side per axle; only tyres can sit on dual wheels. */
export function isBrakeMetric(value: Metric): boolean {
  return value === "brakePad" || value === "brakeLining";
}
export type WheelLayout = ("single" | "dual")[];
export interface Position {
  axle: number;
  side: "left" | "right";
  wheel: "single" | "inner" | "outer";
}
export interface Reading {
  id: string;
  metric: Metric;
  position: Position;
  valueMm: number;
  source: Source;
  capturedAt: string;
  deviceName: string;
  supersedesId?: string;
  correctionReason?: string;
}
export interface MeasurementSession {
  id: string;
  /**
   * Fleet vehicle identity, when the truck was chosen from the register. It is
   * the durable link: a plate can be re-issued or typed differently on another
   * tablet. `registration` below stays as the snapshot printed at the time.
   */
  vehicleId?: string;
  vehicleKey: string;
  registration: string;
  operator: string;
  inspectionDate: string;
  odometerKm: number;
  axleCount: number;
  wheelLayout: WheelLayout;
  createdAt: string;
  readings: Reading[];
}
export interface MeasurementStore {
  version: 1;
  sessions: MeasurementSession[];
}
export type MeasurementErrorCode =
  | "INVALID_READING"
  | "INVALID_DRAFT"
  | "INVALID_SESSION"
  | "INVALID_CORRECTION"
  | "MIXED_SOURCES"
  | "DUPLICATE_ID"
  | "SESSION_NOT_FOUND"
  | "CORRUPT_STORAGE"
  | "STORAGE_CONFLICT"
  | "STORAGE_READ_FAILED"
  | "STORAGE_WRITE_FAILED"
  | "STORAGE_QUOTA_EXCEEDED"
  | "STORAGE_TOO_LARGE"
  | "SESSION_LIMIT"
  | "READING_LIMIT"
  | "UUID_UNAVAILABLE";
export class MeasurementError extends Error {
  constructor(public readonly code: MeasurementErrorCode) {
    super(code);
    this.name = "MeasurementError";
  }
}
export const MAX_SESSIONS = 500;
export const MAX_READINGS_PER_SESSION = 250;
export const MAX_REGISTRATION_LENGTH = 80;
export const MAX_OPERATOR_LENGTH = 80;
export const MAX_DEVICE_LENGTH = 120;
export const MAX_CORRECTION_REASON_LENGTH = 300;

type DataObject = Record<string, unknown>;
function object(value: unknown): value is DataObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}
function exactKeys(
  value: DataObject,
  required: string[],
  optional: string[] = [],
) {
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    Object.keys(value).every(
      (key) => required.includes(key) || optional.includes(key),
    )
  );
}
function text(value: unknown, max: number, required = true): value is string {
  return (
    typeof value === "string" &&
    value.length <= max &&
    (!required || value.trim().length > 0) &&
    [...value].every(
      (character) =>
        character.charCodeAt(0) >= 32 && character.charCodeAt(0) !== 127,
    )
  );
}
function id(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9._:-]{1,100}$/.test(value);
}
function metric(value: unknown): value is Metric {
  return (
    value === "tireTread" || value === "brakePad" || value === "brakeLining"
  );
}
function validMm(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100 &&
    Math.abs(value * 100 - Math.round(value * 100)) < 1e-8
  );
}
export function validCalendarDate(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value.startsWith("0000")
  )
    return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
function timestamp(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
    !validCalendarDate(value.slice(0, 10))
  )
    return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}
function position(value: unknown): value is Position {
  return (
    object(value) &&
    exactKeys(value, ["axle", "side", "wheel"]) &&
    Number.isInteger(value.axle) &&
    (value.axle as number) >= 1 &&
    (value.axle as number) <= 4 &&
    (value.side === "left" || value.side === "right") &&
    (value.wheel === "single" ||
      value.wheel === "inner" ||
      value.wheel === "outer")
  );
}

/** Registration matching does not infer identities from chassis or remove hyphens. */
export function normalizeVehicleKey(registration: string): string {
  return registration.normalize("NFKC").replace(/\s/g, "").toUpperCase();
}

/** 0–100 mm is the accepted input range, never a legal pass/fail threshold. */
export function parseMm(input: string): number | null {
  if (!/^\d{1,3}(?:[.,]\d{1,2})?$/.test(input)) return null;
  const value = Number(input.replace(",", "."));
  return validMm(value) ? value : null;
}
export function positionsFor(
  metricValue: Metric,
  axleCount: number,
  wheelLayout: WheelLayout = defaultWheelLayout(axleCount),
): Position[] {
  if (
    !metric(metricValue) ||
    !Number.isInteger(axleCount) ||
    axleCount < 2 ||
    axleCount > 4 ||
    !validWheelLayout(wheelLayout, axleCount)
  )
    throw new MeasurementError("INVALID_SESSION");
  const positions: Position[] = [];
  for (let axle = 1; axle <= axleCount; axle += 1) {
    const wheels: Position["wheel"][] =
      isBrakeMetric(metricValue) || wheelLayout[axle - 1] === "single"
        ? ["single"]
        : ["inner", "outer"];
    for (const side of ["left", "right"] as const)
      for (const wheel of wheels) positions.push({ axle, side, wheel });
  }
  return positions;
}
export function defaultWheelLayout(axleCount: number): WheelLayout {
  if (!Number.isInteger(axleCount) || axleCount < 2 || axleCount > 4)
    throw new MeasurementError("INVALID_SESSION");
  return Array.from({ length: axleCount }, (_, index) =>
    index === 0 ? "single" : "dual",
  );
}
export function validWheelLayout(
  value: unknown,
  axleCount: number,
): value is WheelLayout {
  return (
    Array.isArray(value) &&
    value.length === axleCount &&
    Array.from(value).every((wheel) => wheel === "single" || wheel === "dual")
  );
}
export function slotKey(metricValue: Metric, positionValue: Position): string {
  return `${metricValue}:${positionValue.axle}:${positionValue.side}:${positionValue.wheel}`;
}
export function validateReading(value: unknown): asserts value is Reading {
  if (
    !object(value) ||
    !exactKeys(
      value,
      [
        "id",
        "metric",
        "position",
        "valueMm",
        "source",
        "capturedAt",
        "deviceName",
      ],
      ["supersedesId", "correctionReason"],
    ) ||
    !id(value.id) ||
    !metric(value.metric) ||
    !position(value.position) ||
    !validMm(value.valueMm) ||
    !["manual", "simulator", "bluetooth"].includes(value.source as string) ||
    !timestamp(value.capturedAt) ||
    !text(value.deviceName, MAX_DEVICE_LENGTH, value.source === "bluetooth")
  )
    throw new MeasurementError("INVALID_READING");
  if (isBrakeMetric(value.metric) && value.position.wheel !== "single")
    throw new MeasurementError("INVALID_READING");
  const hasCorrection =
    Object.hasOwn(value, "supersedesId") ||
    Object.hasOwn(value, "correctionReason");
  if (
    hasCorrection &&
    (!id(value.supersedesId) ||
      value.supersedesId === value.id ||
      !text(value.correctionReason, MAX_CORRECTION_REASON_LENGTH))
  )
    throw new MeasurementError("INVALID_CORRECTION");
}

function validateChain(
  readings: Reading[],
  axleCount: number,
  wheelLayout: WheelLayout,
) {
  const seen = new Map<string, Reading>();
  const activeSlots = new Map<string, Reading>();
  for (const reading of readings) {
    validateReading(reading);
    if (seen.has(reading.id)) throw new MeasurementError("DUPLICATE_ID");
    if (reading.position.axle > axleCount)
      throw new MeasurementError("INVALID_SESSION");
    const key = slotKey(reading.metric, reading.position);
    if (
      !positionsFor(reading.metric, axleCount, wheelLayout).some(
        (candidate) => slotKey(reading.metric, candidate) === key,
      )
    )
      throw new MeasurementError("INVALID_SESSION");
    const prior = activeSlots.get(key);
    if (reading.supersedesId) {
      // Order comes from this append-only array, never from the tablet clock: a
      // tablet that has been offline can have its clock corrected backwards, and
      // a correction made after that must still be accepted. capturedAt stays as
      // recorded information and is printed as such.
      if (!prior || prior.id !== reading.supersedesId)
        throw new MeasurementError("INVALID_CORRECTION");
    } else if (prior) throw new MeasurementError("INVALID_SESSION");
    activeSlots.set(key, reading);
    seen.set(reading.id, reading);
  }
}
export function validateSession(
  value: unknown,
): asserts value is MeasurementSession {
  if (
    !object(value) ||
    !exactKeys(
      value,
      [
        "id",
        "vehicleKey",
        "registration",
        "operator",
        "inspectionDate",
        "odometerKm",
        "axleCount",
        "wheelLayout",
        "createdAt",
        "readings",
      ],
      ["vehicleId"],
    ) ||
    !id(value.id) ||
    (Object.hasOwn(value, "vehicleId") && !id(value.vehicleId)) ||
    !text(value.registration, MAX_REGISTRATION_LENGTH) ||
    value.vehicleKey !== normalizeVehicleKey(value.registration) ||
    !text(value.operator, MAX_OPERATOR_LENGTH) ||
    !validCalendarDate(value.inspectionDate) ||
    !Number.isInteger(value.odometerKm) ||
    (value.odometerKm as number) < 0 ||
    (value.odometerKm as number) > 9999999 ||
    !Number.isInteger(value.axleCount) ||
    (value.axleCount as number) < 2 ||
    (value.axleCount as number) > 4 ||
    !validWheelLayout(value.wheelLayout, value.axleCount as number) ||
    !timestamp(value.createdAt) ||
    !Array.isArray(value.readings) ||
    value.readings.length === 0
  )
    throw new MeasurementError("INVALID_SESSION");
  if (value.readings.length > MAX_READINGS_PER_SESSION)
    throw new MeasurementError("READING_LIMIT");
  validateChain(value.readings, value.axleCount as number, value.wheelLayout);
}
export function validateStore(
  value: unknown,
): asserts value is MeasurementStore {
  if (
    !object(value) ||
    !exactKeys(value, ["version", "sessions"]) ||
    value.version !== 1 ||
    !Array.isArray(value.sessions)
  )
    throw new MeasurementError("CORRUPT_STORAGE");
  if (value.sessions.length > MAX_SESSIONS)
    throw new MeasurementError("SESSION_LIMIT");
  const ids = new Set<string>();
  for (const session of value.sessions) {
    validateSession(session);
    for (const recordId of [
      session.id,
      ...session.readings.map((reading) => reading.id),
    ]) {
      if (ids.has(recordId)) throw new MeasurementError("DUPLICATE_ID");
      ids.add(recordId);
    }
  }
}
export function activeReadings(session: MeasurementSession): Reading[] {
  validateSession(session);
  const replaced = new Set(
    session.readings.flatMap((reading) =>
      reading.supersedesId ? [reading.supersedesId] : [],
    ),
  );
  return session.readings.filter((reading) => !replaced.has(reading.id));
}
function newId(): string {
  if (!globalThis.crypto?.randomUUID)
    throw new MeasurementError("UUID_UNAVAILABLE");
  return globalThis.crypto.randomUUID();
}
export function createReading(
  metricValue: Metric,
  positionValue: Position,
  valueInput: string,
  source: Source,
  deviceName = "",
  now = new Date().toISOString(),
): Reading {
  const valueMm = parseMm(valueInput);
  if (valueMm === null) throw new MeasurementError("INVALID_READING");
  const reading = {
    id: newId(),
    metric: metricValue,
    position: { ...positionValue },
    valueMm,
    source,
    capturedAt: now,
    deviceName,
  };
  validateReading(reading);
  return reading;
}
export function createSession(
  input: Pick<
    MeasurementSession,
    | "registration"
    | "operator"
    | "inspectionDate"
    | "odometerKm"
    | "axleCount"
    | "readings"
  > & { wheelLayout?: WheelLayout; vehicleId?: string },
  now = new Date().toISOString(),
): MeasurementSession {
  const { vehicleId, wheelLayout, ...rest } = input;
  const session = {
    ...rest,
    // An absent fleet link stays absent; it is never stored as an empty value.
    ...(vehicleId ? { vehicleId } : {}),
    wheelLayout:
      wheelLayout === undefined
        ? defaultWheelLayout(input.axleCount)
        : [...wheelLayout],
    id: newId(),
    vehicleKey: normalizeVehicleKey(input.registration),
    createdAt: now,
    readings: input.readings.map((reading) => ({
      ...reading,
      position: { ...reading.position },
    })),
  };
  validateSession(session);
  return session;
}

/**
 * True when every reading came from the simulator. Sessions are saved whole, so
 * a stored session is either entirely simulated or holds no simulated reading;
 * see `saveSession`, which keeps the two apart in different stores.
 */
export function isSimulatedSession(session: MeasurementSession): boolean {
  return session.readings.some((reading) => reading.source === "simulator");
}
