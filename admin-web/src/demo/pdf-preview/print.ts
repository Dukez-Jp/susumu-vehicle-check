import {
  headerBoxes,
  type PrintBox,
  type PrintHeaderField,
} from "./print-layout";
import type { HeaderFields, PreviewState } from "./state";

export interface PreparedPrintField {
  key: string;
  box: PrintBox;
  text: string;
  lines: string[];
  fontSize: number;
}

const segmenter = new Intl.Segmenter("ja", { granularity: "grapheme" });
const LINE_HEIGHT = 1.22;
const MIN_FONT_SIZE = 6;

// Conservative advance estimates for Meiryo/Yu Gothic. SVG field lines may
// shrink horizontally to their measured box, but their nominal font stays >=6pt.
export function estimatedTextWidth(text: string, fontSize: number): number {
  let units = 0;
  for (const { segment } of segmenter.segment(text)) {
    if (/^[0-9]$/.test(segment)) units += 0.7;
    else if (/^[\s.,:;!'"|]$/.test(segment)) units += 0.4;
    else if (/^[mwMW]$/.test(segment)) units += 1.1;
    else if (/^[\x20-\x7e]$/.test(segment)) units += 0.75;
    else units += 1.1;
  }
  return units * fontSize;
}

function wrap(text: string, width: number, fontSize: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r\n?|\n/)) {
    let line = "";
    for (const { segment } of segmenter.segment(paragraph)) {
      if (estimatedTextWidth(line + segment, fontSize) > width && line) {
        lines.push(line);
        line = "";
      }
      line += segment;
    }
    lines.push(line);
  }
  return lines;
}

function fit(key: string, box: PrintBox, text: string): PreparedPrintField {
  for (
    let fontSize = box.fontSize;
    fontSize >= MIN_FONT_SIZE;
    fontSize -= 0.25
  ) {
    const lines = wrap(text, box.width, fontSize);
    if (
      lines.length * fontSize * LINE_HEIGHT <= box.height &&
      lines.every((line) => estimatedTextWidth(line, fontSize) <= box.width)
    ) {
      return { key, box, text, lines, fontSize };
    }
  }
  // Preserve the full text in this result and in state. The caller blocks print
  // and presents the issue rather than truncating or scaling below 6pt.
  return { key, box, text, lines: [], fontSize: MIN_FONT_SIZE };
}

function parseDate(value: string, monthOnly: boolean): string[] | null {
  const pattern = monthOnly ? /^(\d{4})-(\d{2})$/ : /^(\d{4})-(\d{2})-(\d{2})$/;
  const match = pattern.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 1 || month < 1 || month > 12) return null;
  const parts = [String(year), String(month)];
  if (!monthOnly) {
    const day = Number(match[3]);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (day < 1 || day > days[month - 1]) return null;
    parts.push(String(day));
  }
  return parts;
}

export function preparePrint(state: PreviewState): {
  fields: PreparedPrintField[];
  issues: string[];
} {
  const fields: PreparedPrintField[] = [];
  const issues = new Set<string>();
  function add(
    key: keyof HeaderFields | "notes",
    boxKey: PrintHeaderField,
    text: string,
  ) {
    if (!text) return;
    const field = fit(key, headerBoxes[boxKey], text);
    fields.push(field);
    if (!field.lines.length) issues.add(key);
  }

  const directFields: [keyof HeaderFields, PrintHeaderField][] = [
    ["inspectionMonths", "inspectionMonths"],
    ["customer", "ownerName"],
    ["address", "ownerAddress"],
    ["registration", "plateOrChassis"],
    ["makeModel", "vehicleNameAndModel"],
    ["engineModel", "engineModel"],
    ["workshopName", "workshopName"],
    ["workshopAddress", "workshopAddress"],
    ["accreditation", "workshopCertificationNumber"],
    ["inspector", "maintenanceSupervisor"],
  ];
  for (const [key, boxKey] of directFields) {
    const value = state.header[key].trim();
    if (key === "inspectionMonths" && value && !["3", "12"].includes(value)) {
      issues.add(key);
    } else {
      add(key, boxKey, value);
    }
  }

  const dateFields: [keyof HeaderFields, PrintHeaderField[]][] = [
    ["firstRegistration", ["firstRegistrationYear", "firstRegistrationMonth"]],
    ["inspectionDate", ["inspectionYear", "inspectionMonth", "inspectionDay"]],
    ["completionDate", ["completionYear", "completionMonth", "completionDay"]],
  ];
  for (const [key, boxes] of dateFields) {
    const value = state.header[key].trim();
    if (!value) continue;
    const parts = parseDate(value, key === "firstRegistration");
    if (!parts) issues.add(key);
    else parts.forEach((part, index) => add(key, boxes[index], part));
  }

  const numberFields: ["odometer" | "co" | "hc", PrintHeaderField][] = [
    ["odometer", "odometerKm"],
    ["co", "coPercent"],
    ["hc", "hcPpm"],
  ];
  for (const [key, boxKey] of numberFields) {
    const value = state.header[key].trim().replace(",", ".");
    if (!value) continue;
    const pattern = key === "co" ? /^\d+(?:\.\d+)?$/ : /^\d+$/;
    const number = Number(value);
    if (
      !pattern.test(value) ||
      !Number.isFinite(number) ||
      (key === "co" ? number > 100 : !Number.isSafeInteger(number))
    ) {
      issues.add(key);
    } else {
      add(key, boxKey, value);
    }
  }

  if (
    state.notesPt.trim() &&
    (!state.notesJa.trim() || !state.notesJaReviewed)
  ) {
    issues.add("notes");
    add("notes", "remarks", "備考確認待ち");
  } else {
    add("notes", "remarks", state.notesJa.trim());
  }
  return { fields, issues: [...issues] };
}
