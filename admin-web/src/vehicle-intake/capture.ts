export interface VehicleCaptureFields {
  plate: string;
  chassis: string;
  manufacturer: string;
  model: string;
  engineModel: string;
  firstRegistration: string;
  validUntil: string;
  grossWeightKg: string;
  internalNumber: string;
  odometerKm: string;
}

export interface CaptureDraft {
  fields: VehicleCaptureFields;
  source: "manual" | "mlit-json";
  sourceVersion?: string;
  originalFields?: Record<string, string>;
  warnings: string[];
}

/** Only vehicle data needed by the capture form may survive an import. */
export const MLIT_ORIGINAL_FIELD_KEYS = [
  "EntryNoCarNo",
  "CarNo",
  "CarName",
  "Model",
  "EngineModel",
  "CarTotalWgt",
  "FirstregistdateE",
  "FirstregistdateY",
  "FirstregistdateM",
  "FirstexamdateE",
  "FirstexamdateY",
  "FirstexamdateM",
  "ValidPeriodExpirdateE",
  "ValidPeriodExpirdateY",
  "ValidPeriodExpirdateM",
  "ValidPeriodExpirdateD",
  "RegistCarLightCar",
] as const;

const MAX_FILE_BYTES = 1024 * 1024;
const MAX_FIELD_LENGTH = 500;

export function emptyCapture(): CaptureDraft {
  return {
    fields: {
      plate: "",
      chassis: "",
      manufacturer: "",
      model: "",
      engineModel: "",
      firstRegistration: "",
      validUntil: "",
      grossWeightKg: "",
      internalNumber: "",
      odometerKm: "",
    },
    source: "manual",
    warnings: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalized(value: string): string {
  return value.normalize("NFKC").trim();
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function validCalendarDate(year: number, month: number, day = 1): boolean {
  return (
    Number.isInteger(year) &&
    year >= 1 &&
    year <= 9999 &&
    Number.isInteger(month) &&
    month >= 1 &&
    month <= 12 &&
    Number.isInteger(day) &&
    day >= 1 &&
    day <= daysInMonth(year, month)
  );
}

const ERAS: Record<string, { year: number; start: number; end: number }> = {
  明治: { year: 1868, start: 18681023, end: 19120729 },
  大正: { year: 1912, start: 19120730, end: 19261224 },
  昭和: { year: 1926, start: 19261225, end: 19890107 },
  平成: { year: 1989, start: 19890108, end: 20190430 },
  令和: { year: 2019, start: 20190501, end: 99991231 },
};

/** Return month precision for first registration; never manufacture a day. */
function eraDate(
  info: Record<string, string>,
  prefix: string,
  includeDay: boolean,
): { value: string; invalid: boolean } {
  const suffixes = includeDay ? ["E", "Y", "M", "D"] : ["E", "Y", "M"];
  const components = suffixes.map((suffix) =>
    normalized(info[`${prefix}${suffix}`] ?? ""),
  );
  if (components.every((part) => part === ""))
    return { value: "", invalid: false };
  const [eraName, yearPart, monthPart, dayPart] = components;
  const era = ERAS[eraName];
  const numericYear = yearPart === "元" ? "1" : yearPart;
  const invalid = { value: "", invalid: true };
  if (!era || !/^\d{1,4}$/.test(numericYear) || !/^\d{1,2}$/.test(monthPart))
    return invalid;
  if (includeDay && !/^\d{1,2}$/.test(dayPart)) return invalid;
  const eraYear = Number(numericYear);
  const year = era.year + eraYear - 1;
  const month = Number(monthPart);
  const day = includeDay ? Number(dayPart) : 1;
  if (eraYear < 1 || !validCalendarDate(year, month, day)) return invalid;
  const periodStart = year * 10000 + month * 100 + day;
  const periodEnd = includeDay
    ? periodStart
    : year * 10000 + month * 100 + daysInMonth(year, month);
  // A month-only value is valid if any day in that month belongs to the era.
  if (periodEnd < era.start || periodStart > era.end) return invalid;
  const value = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
  return {
    value: includeDay ? `${value}-${String(day).padStart(2, "0")}` : value,
    invalid: false,
  };
}

function simpleWeight(value: string): number | undefined {
  if (/^[+-]?\d+(?:\.\d+)?$/.test(value)) return Number(value);
  if (/^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(value))
    return Number(value.replaceAll(",", ""));
  return undefined;
}

/**
 * Parse the public MLIT app export, not an NFC tag or an authenticated API response.
 * Error messages and warning values are language-independent UI translation keys.
 */
export function parseMlitJson(text: string): CaptureDraft {
  // Check code units first to avoid allocating an encoder result for obviously huge files.
  if (
    text.length > MAX_FILE_BYTES ||
    new TextEncoder().encode(text).byteLength > MAX_FILE_BYTES
  ) {
    throw new Error("file_too_large");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch {
    throw new Error("invalid_json");
  }
  if (!isRecord(parsed) || !isRecord(parsed.CertInfo))
    throw new Error("invalid_shape");
  if (parsed.CertInfoImportFileVersion !== "1.0")
    throw new Error("unsupported_version");
  if (
    Object.values(parsed.CertInfo).some((value) => typeof value !== "string")
  ) {
    throw new Error("invalid_field_type");
  }
  const info = parsed.CertInfo as Record<string, string>;
  const vehicleType = normalized(info.RegistCarLightCar ?? "");
  if (vehicleType && vehicleType !== "01" && vehicleType !== "02")
    throw new Error("unsupported_vehicle_type");
  const firstPrefix =
    vehicleType === "02" ? "Firstexamdate" : "Firstregistdate";
  const firstDate = eraDate(info, firstPrefix, false);
  const expiry = eraDate(info, "ValidPeriodExpirdate", true);
  const grossWeight = normalized(info.CarTotalWgt ?? "");
  const warnings: string[] = [];
  if (firstDate.invalid) warnings.push("invalid_first_registration");
  if (expiry.invalid) warnings.push("invalid_valid_until");
  if (grossWeight && simpleWeight(grossWeight) === undefined)
    warnings.push("complex_gross_weight");
  const originalFields = Object.fromEntries(
    MLIT_ORIGINAL_FIELD_KEYS.filter((key) => Object.hasOwn(info, key)).map(
      (key) => [key, info[key]],
    ),
  );
  return {
    fields: {
      ...emptyCapture().fields,
      plate: normalized(info.EntryNoCarNo ?? ""),
      chassis: normalized(info.CarNo ?? ""),
      manufacturer: normalized(info.CarName ?? ""),
      model: normalized(info.Model ?? ""),
      engineModel: normalized(info.EngineModel ?? ""),
      firstRegistration: firstDate.value,
      validUntil: expiry.value,
      grossWeightKg: grossWeight,
    },
    source: "mlit-json",
    sourceVersion: "1.0",
    originalFields,
    warnings,
  };
}

function validIsoDate(value: string, includeDay: boolean): boolean {
  if (!(includeDay ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}$/).test(value))
    return false;
  const [year, month, day = 1] = value.split("-").map(Number);
  return validCalendarDate(year, month, day);
}

/** Validate a reviewed capture without mutating any source or edited values. */
export function validateCapture(
  fields: VehicleCaptureFields,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const key of Object.keys(
    emptyCapture().fields,
  ) as (keyof VehicleCaptureFields)[]) {
    const value = fields[key];
    if (typeof value !== "string" || value.length > MAX_FIELD_LENGTH)
      errors[key] = "too_long";
  }
  for (const key of ["plate", "chassis"] as const) {
    if (!errors[key] && !normalized(fields[key])) errors[key] = "required";
  }
  for (const key of ["firstRegistration", "validUntil"] as const) {
    if (
      !errors[key] &&
      fields[key].trim() &&
      !validIsoDate(fields[key].trim(), key === "validUntil")
    ) {
      errors[key] = "invalid_date";
    }
  }
  if (!errors.odometerKm && normalized(fields.odometerKm)) {
    const value = normalized(fields.odometerKm);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))
      errors.odometerKm = "invalid_number";
  }
  if (!errors.grossWeightKg && normalized(fields.grossWeightKg)) {
    const value = normalized(fields.grossWeightKg);
    const numeric = simpleWeight(value);
    if (
      (numeric !== undefined &&
        (!Number.isFinite(numeric) ||
          numeric <= 0 ||
          numeric > Number.MAX_SAFE_INTEGER)) ||
      /^(?:[+-]?(?:NaN|Infinity)|[+-]?\d+(?:\.\d+)?e[+-]?\d+)$/i.test(value)
    ) {
      errors.grossWeightKg = "invalid_number";
    }
    // Official weights can include several bracketed values; preserve these as text.
  }
  return errors;
}
