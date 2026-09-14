import source from "../../../../docs/source/tenken-20260910/catalogo_pdf_100_itens.json";

export type Result = "" | "checked" | "attention" | "notApplicable";
export type Action =
  | "specific"
  | "adjust"
  | "tighten"
  | "replace"
  | "repair"
  | "clean"
  | "lubricate";

export interface PreviewAnswer {
  result: Result;
  actions: Action[];
}

export interface HeaderFields {
  customer: string;
  address: string;
  registration: string;
  makeModel: string;
  engineModel: string;
  firstRegistration: string;
  odometer: string;
  inspectionDate: string;
  inspectionMonths: string;
  completionDate: string;
  workshopName: string;
  workshopAddress: string;
  accreditation: string;
  inspector: string;
  co: string;
  hc: string;
}

/** Local review model only: no legal finalization, signatures or inferred schedule. */
export interface PreviewState {
  version: 1;
  templateId: string;
  header: HeaderFields;
  answers: Record<string, PreviewAnswer>;
  notesPt: string;
  notesJa: string;
  notesJaReviewed: boolean;
}

export const TEMPLATE_ID = "tenken-pdf-20260910-v1";
export const STORAGE_KEY = "susumu.tenken.pdf-preview.v1";
export const MAX_HEADER_LENGTH = 120;
export const MAX_NOTES_LENGTH = 2000;

export type PreviewStorageErrorCode =
  | "INVALID_PREVIEW"
  | "CORRUPT_STORAGE"
  | "STORAGE_CONFLICT"
  | "STORAGE_READ_FAILED"
  | "STORAGE_WRITE_FAILED"
  | "STORAGE_QUOTA_EXCEEDED";

export class PreviewStorageError extends Error {
  constructor(public readonly code: PreviewStorageErrorCode) {
    super(code);
    this.name = "PreviewStorageError";
  }
}

const ITEM_IDS = source.items.map((item) => item.id);
const ITEM_ID_SET = new Set(ITEM_IDS);
const RESULTS: readonly Result[] = [
  "",
  "checked",
  "attention",
  "notApplicable",
];
const ACTION_SYMBOLS: Record<Action, string> = {
  specific: "○",
  adjust: "A",
  tighten: "T",
  replace: "×",
  repair: "△",
  clean: "C",
  lubricate: "L",
};
const ACTIONS = Object.keys(ACTION_SYMBOLS);
const HEADER_KEYS: readonly (keyof HeaderFields)[] = [
  "customer",
  "address",
  "registration",
  "makeModel",
  "engineModel",
  "firstRegistration",
  "odometer",
  "inspectionDate",
  "inspectionMonths",
  "completionDate",
  "workshopName",
  "workshopAddress",
  "accreditation",
  "inspector",
  "co",
  "hc",
];
const STATE_KEYS = [
  "version",
  "templateId",
  "header",
  "answers",
  "notesPt",
  "notesJa",
  "notesJaReviewed",
];

type ObjectValue = Record<string, unknown>;

function object(value: unknown): value is ObjectValue {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value: ObjectValue, keys: readonly string[]): boolean {
  const own = Object.keys(value);
  return own.length === keys.length && own.every((key) => keys.includes(key));
}

function fail(code: PreviewStorageErrorCode): never {
  throw new PreviewStorageError(code);
}

function validAnswer(value: unknown): value is PreviewAnswer {
  return (
    object(value) &&
    exactKeys(value, ["result", "actions"]) &&
    RESULTS.includes(value.result as Result) &&
    Array.isArray(value.actions) &&
    value.actions.length <= ACTIONS.length &&
    Array.from(value.actions).every(
      (action) => typeof action === "string" && ACTIONS.includes(action),
    ) &&
    new Set(value.actions).size === value.actions.length &&
    (value.result !== "notApplicable" || value.actions.length === 0)
  );
}

function validate(
  value: unknown,
  code: PreviewStorageErrorCode,
): asserts value is PreviewState {
  if (
    !object(value) ||
    !exactKeys(value, STATE_KEYS) ||
    value.version !== 1 ||
    value.templateId !== TEMPLATE_ID ||
    !object(value.header) ||
    !exactKeys(value.header, HEADER_KEYS) ||
    !HEADER_KEYS.every((key) => {
      const field = (value.header as ObjectValue)[key];
      return typeof field === "string" && field.length <= MAX_HEADER_LENGTH;
    }) ||
    !["", "3", "12"].includes(value.header.inspectionMonths as string) ||
    !object(value.answers) ||
    !exactKeys(value.answers, ITEM_IDS) ||
    !Object.values(value.answers).every(validAnswer) ||
    typeof value.notesPt !== "string" ||
    value.notesPt.length > MAX_NOTES_LENGTH ||
    typeof value.notesJa !== "string" ||
    value.notesJa.length > MAX_NOTES_LENGTH ||
    typeof value.notesJaReviewed !== "boolean"
  )
    fail(code);
}

export function emptyPreview(): PreviewState {
  return {
    version: 1,
    templateId: TEMPLATE_ID,
    header: Object.fromEntries(
      HEADER_KEYS.map((key) => [key, ""]),
    ) as unknown as HeaderFields,
    answers: Object.fromEntries(
      ITEM_IDS.map((id) => [id, { result: "", actions: [] }]),
    ) as Record<string, PreviewAnswer>,
    notesPt: "",
    notesJa: "",
    notesJaReviewed: false,
  };
}

function readRaw(storage: Pick<Storage, "getItem">): string | null {
  try {
    return storage.getItem(STORAGE_KEY);
  } catch {
    return fail("STORAGE_READ_FAILED");
  }
}

function parse(raw: string | null): PreviewState {
  if (raw === null) return emptyPreview();
  // The complete bounded schema fits comfortably below this input guard.
  if (raw.length > 100_000) return fail("CORRUPT_STORAGE");
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return fail("CORRUPT_STORAGE");
  }
  validate(value, "CORRUPT_STORAGE");
  return value;
}

export function loadPreview(storage: Pick<Storage, "getItem">): {
  state: PreviewState;
  raw: string | null;
} {
  const raw = readRaw(storage);
  return { state: parse(raw), raw };
}

export function savePreview(
  storage: Pick<Storage, "getItem" | "setItem">,
  expectedRaw: string | null,
  next: PreviewState,
): string {
  const previousRaw = readRaw(storage);
  if (previousRaw !== expectedRaw) return fail("STORAGE_CONFLICT");
  // Never overwrite an unsupported or damaged draft, even if the caller read its bytes.
  parse(previousRaw);
  validate(next, "INVALID_PREVIEW");
  const raw = JSON.stringify(next);
  // Stale-tab guard only: localStorage has no atomic compare-and-swap operation.
  if (readRaw(storage) !== previousRaw) return fail("STORAGE_CONFLICT");
  try {
    storage.setItem(STORAGE_KEY, raw);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "name" in error &&
      error.name === "QuotaExceededError"
    ) {
      return fail("STORAGE_QUOTA_EXCEEDED");
    }
    return fail("STORAGE_WRITE_FAILED");
  }
  return raw;
}

export function updatePreviewAnswer(
  state: PreviewState,
  id: string,
  change: Partial<PreviewAnswer>,
): PreviewState {
  if (
    !ITEM_ID_SET.has(id) ||
    !validAnswer(state.answers[id]) ||
    !object(change) ||
    Object.keys(change).some((key) => key !== "result" && key !== "actions")
  ) {
    return fail("INVALID_PREVIEW");
  }
  const previous = state.answers[id];
  const result = change.result === undefined ? previous.result : change.result;
  const actions =
    change.actions === undefined ? previous.actions : change.actions;
  // Validate requested maintenance before discarding it for a not-applicable row.
  if (
    !validAnswer({ result: result === "notApplicable" ? "" : result, actions })
  ) {
    return fail("INVALID_PREVIEW");
  }
  return {
    ...state,
    answers: {
      ...state.answers,
      [id]: { result, actions: result === "notApplicable" ? [] : [...actions] },
    },
  };
}

/** An action does not certify completion; unresolved or unanswered rows print blank. */
export function printSymbols(answer: PreviewAnswer): string {
  if (answer.result === "notApplicable") return "／";
  if (answer.result !== "checked") return "";
  return answer.actions.length
    ? answer.actions.map((action) => ACTION_SYMBOLS[action]).join(" ")
    : "V";
}
