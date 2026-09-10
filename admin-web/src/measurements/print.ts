import { estimatedTextWidth } from "../demo/pdf-preview/print";
import type { PrintBox } from "../demo/pdf-preview/print-layout";
import {
  activeReadings,
  isBrakeMetric,
  type MeasurementSession,
  type Metric,
  type Position,
  type Reading,
} from "./model";

/** Empty part of その他点検・整備項目、記事, measured in the source PDF. */
export const measurementSummaryBox: PrintBox = {
  x: 389,
  y: 490,
  width: 229,
  height: 10,
  fontSize: 7,
};

export const metricLabelsJa: Record<Metric, string> = {
  tireTread: "タイヤ溝深さ",
  brakePad: "ブレーキパッド厚さ",
  brakeLining: "ブレーキライニング厚さ",
};

/** Short forms for the one summary line that fits inside the printed form. */
const metricShortJa: Record<Metric, string> = {
  tireTread: "溝",
  brakePad: "パッド",
  brakeLining: "ライニング",
};

/**
 * Each metric points at the line of the source PDF that describes it:
 * pdf-036 タイヤの状態, pdf-029 パッドの摩耗 (disc), pdf-025 シューの摺動部分及び
 * ライニングの摩耗 (drum). A drum vehicle is never linked to the pad line.
 */
const metricPdfItemId: Record<Metric, string> = {
  tireTread: "pdf-036",
  brakePad: "pdf-029",
  brakeLining: "pdf-025",
};

export function getMetricPdfItemId(metric: Metric): string {
  return metricPdfItemId[metric];
}

/** Wording of the source row, as printed on the form, with its row number. */
const metricSourceItemJa: Record<Metric, string> = {
  tireTread: "タイヤの状態",
  brakePad: "パッドの摩耗",
  brakeLining: "シューの摺動部分及びライニングの摩耗",
};

export function metricSourceRowJa(metric: Metric): string {
  return `${metricSourceItemJa[metric]}（${getMetricPdfItemId(metric).slice(4)}）`;
}

export function formatMm(value: number): string {
  return value.toFixed(2).replace(/\.?0+$/, "");
}

/** Display reference only. Storage and links continue to use the full ID. */
export function measurementReference(session: MeasurementSession): string {
  return session.id.slice(-8).toUpperCase();
}

export function buildMeasurementSummaryJa(session: MeasurementSession): string {
  const readings = activeReadings(session);
  const simulation = readings.some((reading) => reading.source === "simulator");
  const parts: string[] = [];
  for (const metric of ["tireTread", "brakePad", "brakeLining"] as const) {
    const values = readings.filter((reading) => reading.metric === metric);
    // A metric with no reading is left out rather than shown as a value; the
    // absent groups are named below so the printed line never implies a check
    // that did not happen.
    if (values.length)
      parts.push(
        `${metricShortJa[metric]}${formatMm(Math.min(...values.map((reading) => reading.valueMm)))}/${values.length}点`,
      );
  }
  if (!readings.some((reading) => reading.metric === "tireTread"))
    parts.push("溝未測定");
  if (!readings.some((reading) => isBrakeMetric(reading.metric)))
    parts.push("制動部未測定");
  return `見本${simulation ? "・模擬" : ""} #${measurementReference(session)} 測定最小 ${parts.join(" ")} mm`;
}

export function prepareMeasurementSummary(session: MeasurementSession): {
  text: string;
  box: PrintBox;
  lines: string[];
  fontSize: number;
  issue: boolean;
} {
  const text = buildMeasurementSummaryJa(session);
  for (
    let fontSize = measurementSummaryBox.fontSize;
    fontSize >= 6;
    fontSize -= 0.25
  ) {
    if (
      estimatedTextWidth(text, fontSize) <= measurementSummaryBox.width &&
      fontSize * 1.22 <= measurementSummaryBox.height
    ) {
      return {
        text,
        box: measurementSummaryBox,
        lines: [text],
        fontSize,
        issue: false,
      };
    }
  }
  // Keep the exact source text; the caller must block print on an issue.
  return {
    text,
    box: measurementSummaryBox,
    lines: [],
    fontSize: 6,
    issue: true,
  };
}

export function positionLabelJa(position: Position, metric: Metric): string {
  const side = position.side === "left" ? "左" : "右";
  const wheel =
    isBrakeMetric(metric) || position.wheel === "single"
      ? ""
      : position.wheel === "inner"
        ? "・内輪"
        : "・外輪";
  return `第${position.axle}軸・${side}${wheel}`;
}

export function sourceLabelJa(reading: Reading): string {
  return reading.source === "bluetooth"
    ? "無線計測器"
    : reading.source === "simulator"
      ? "模擬計測"
      : "手入力";
}

export function correctionReasonJa(reading: Reading): string {
  if (!reading.supersedesId) return "初回記録";
  if (reading.correctionReason === "remeasurement") return "再測定";
  if (reading.correctionReason === "inputCorrection") return "入力訂正";
  return "日本語理由確認待ち";
}

export function getMeasurementReportIssues(
  session: MeasurementSession,
): string[] {
  return session.readings
    .filter(
      (reading) =>
        reading.supersedesId &&
        !["remeasurement", "inputCorrection"].includes(
          reading.correctionReason ?? "",
        ),
    )
    .map((reading) => `correctionReason:${reading.id}`);
}

const japaneseTime = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZone: "Asia/Tokyo",
});

export function capturedTimeJa(iso: string): string {
  return japaneseTime.format(new Date(iso));
}
