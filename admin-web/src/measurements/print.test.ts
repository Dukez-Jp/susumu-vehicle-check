import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import source from "../../../docs/source/tenken-20260910/catalogo_pdf_100_itens.json";
import { estimatedTextWidth, preparePrint } from "../demo/pdf-preview/print";
import { emptyPreview } from "../demo/pdf-preview/state";
import {
  createReading,
  createSession,
  positionsFor,
  type MeasurementSession,
} from "./model";
import MeasurementReport from "./MeasurementReport";
import {
  buildMeasurementSummaryJa,
  capturedTimeJa,
  formatMm,
  getMeasurementReportIssues,
  getMetricPdfItemId,
  measurementSummaryBox,
  prepareMeasurementSummary,
} from "./print";

const now = "2026-09-10T03:00:00.000Z";
const position = { axle: 1, side: "left", wheel: "single" } as const;

function session(): MeasurementSession {
  return createSession(
    {
      registration: "見本100あ1234",
      operator: "整備員・見本",
      inspectionDate: "2026-09-10",
      odometerKm: 123456,
      axleCount: 3,
      readings: [
        createReading("tireTread", position, "8.2", "manual", "", now),
        createReading("brakePad", position, "9.1", "manual", "", now),
      ],
    },
    now,
  );
}

describe("Japanese measurement output", () => {
  it("links metrics to the correct unchanged source rows", () => {
    expect(source.items).toHaveLength(100);
    expect(
      source.items.find((item) => item.id === getMetricPdfItemId("tireTread"))
        ?.itemJa,
    ).toBe("タイヤの状態(※1)");
    expect(
      source.items.find((item) => item.id === getMetricPdfItemId("brakePad"))
        ?.itemJa,
    ).toBe("パッドの摩耗(※1)");
    // A drum-braked truck has no pad. Its wear is recorded on its own row.
    expect(
      source.items.find((item) => item.id === getMetricPdfItemId("brakeLining"))
        ?.itemJa,
    ).toBe("シューの摺動部分及びライニングの摩耗(※1)");
    expect(getMetricPdfItemId("brakeLining")).not.toBe(
      getMetricPdfItemId("brakePad"),
    );
  });

  it("names drums as linings and never prints them as pads", () => {
    const candidate = session();
    candidate.readings = [
      createReading("tireTread", position, "8.2", "manual", "", now),
      createReading("brakeLining", position, "6.4", "manual", "", now),
    ];
    const summary = buildMeasurementSummaryJa(candidate);
    expect(summary).toContain("ライニング6.4/1点");
    expect(summary).not.toContain("パッド");
    expect(summary).not.toContain("制動部未測定");
    const html = renderToStaticMarkup(
      createElement(MeasurementReport, { session: candidate }),
    );
    expect(html).toContain("ブレーキライニング厚さ");
    expect(html).not.toContain("ブレーキパッド厚さ");
  });

  it("summarizes only the latest readings and flags simulated values", () => {
    const candidate = session();
    const original = candidate.readings[0];
    candidate.readings.push({
      ...createReading(
        "tireTread",
        position,
        "9.2",
        "simulator",
        "Instrumento de demonstração",
        "2026-09-10T03:01:00.000Z",
      ),
      supersedesId: original.id,
      correctionReason: "remeasurement",
    });
    const summary = buildMeasurementSummaryJa(candidate);
    expect(summary).toContain("見本・模擬");
    expect(summary).toContain("溝9.2/1点");
    expect(summary).toContain("パッド9.1/1点");
    expect(summary).not.toContain("8.2mm");
    expect(candidate.readings[0].valueMm).toBe(8.2);
  });

  it("does not invent zeros for unmeasured metrics and preserves real zero readings", () => {
    const candidate = session();
    candidate.readings = [
      createReading("tireTread", position, "0", "manual", "", now),
    ];
    expect(buildMeasurementSummaryJa(candidate)).toContain(
      "溝0/1点 制動部未測定 mm",
    );
    expect(formatMm(100)).toBe("100");
    expect(formatMm(10.5)).toBe("10.5");
    expect(formatMm(0)).toBe("0");
  });

  it("fits the maximum position counts in the original empty strip without clipping its label", () => {
    const candidate = session();
    candidate.axleCount = 4;
    candidate.wheelLayout = ["single", "dual", "dual", "dual"];
    candidate.readings = ["tireTread", "brakePad"].flatMap((metric) =>
      positionsFor(
        metric as "tireTread" | "brakePad",
        4,
        candidate.wheelLayout,
      ).map((entry) =>
        createReading(
          metric as "tireTread" | "brakePad",
          entry,
          "99.99",
          "simulator",
          "模擬計測器",
          now,
        ),
      ),
    );
    const prepared = prepareMeasurementSummary(candidate);
    expect(prepared.issue).toBe(false);
    expect(prepared.fontSize).toBeGreaterThanOrEqual(6);
    expect(prepared.lines).toEqual([prepared.text]);
    expect(
      estimatedTextWidth(prepared.text, prepared.fontSize),
    ).toBeLessThanOrEqual(measurementSummaryBox.width);
    expect(measurementSummaryBox.x).toBeGreaterThan(384.89);
    expect(measurementSummaryBox.x + measurementSummaryBox.width).toBeLessThan(
      620.38,
    );
    expect(measurementSummaryBox.y).toBeGreaterThan(488.5);
    expect(measurementSummaryBox.y + measurementSummaryBox.height).toBeLessThan(
      501.576,
    );
    // External valid identifiers can be wider than generated UUIDs. Never clip.
    candidate.id = "WWWWWWWW";
    const oversized = prepareMeasurementSummary(candidate);
    expect(oversized.issue).toBe(true);
    expect(oversized.lines).toEqual([]);
    expect(oversized.text).toContain("#WWWWWWWW");
    expect(oversized.text).toContain("溝99.99/14点");
  });

  it("keeps user remarks and inspection answers untouched when preparing a summary", () => {
    const preview = emptyPreview();
    preview.notesPt = "Verificar ruído";
    preview.notesJa = "異音を確認する。";
    const before = JSON.stringify(preview);
    prepareMeasurementSummary(session());
    expect(JSON.stringify(preview)).toBe(before);
    expect(preparePrint(preview).issues).toContain("notes");
  });

  it("prints all originals and corrections with Japanese provenance and fixed reasons", () => {
    const candidate = session();
    candidate.readings[0] = {
      ...candidate.readings[0],
      source: "bluetooth",
      deviceName: "計測器01",
    };
    candidate.readings.push({
      ...createReading(
        "tireTread",
        position,
        "7.4",
        "manual",
        "",
        "2026-09-10T03:01:00.000Z",
      ),
      supersedesId: candidate.readings[0].id,
      correctionReason: "inputCorrection",
    });
    const html = renderToStaticMarkup(
      createElement(MeasurementReport, { session: candidate }),
    );
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(doc.querySelector("article")?.lang).toBe("ja");
    expect(doc.querySelectorAll("[data-reading-id]")).toHaveLength(2);
    expect(doc.querySelectorAll("[data-history-reading-id]")).toHaveLength(3);
    expect(html).toContain("8.2 mm");
    expect(html).toContain("7.4 mm");
    expect(html).toContain("入力訂正（記録1を訂正）");
    expect(html).toContain("訂正済");
    expect(
      doc.querySelector(
        `[data-history-reading-id="${candidate.readings[0].id}"]`,
      )?.textContent,
    ).toContain("無線計測器計測器01");
    expect(html).not.toContain("inputCorrection");
    expect(getMeasurementReportIssues(candidate)).toEqual([]);
    expect(capturedTimeJa(now)).toBe("2026/09/10 12:00:00");
  });

  it("blocks unknown free-text reasons instead of printing Portuguese or dropping the problem", () => {
    const candidate = session();
    candidate.readings.push({
      ...createReading(
        "tireTread",
        position,
        "7.4",
        "manual",
        "",
        "2026-09-10T03:01:00.000Z",
      ),
      supersedesId: candidate.readings[0].id,
      correctionReason: "Conferência do mecânico",
    });
    expect(getMeasurementReportIssues(candidate)).toEqual([
      `correctionReason:${candidate.readings[2].id}`,
    ]);
    const html = renderToStaticMarkup(
      createElement(MeasurementReport, { session: candidate }),
    );
    expect(html).toContain("日本語理由確認待ち");
    expect(html).not.toContain("Conferência do mecânico");
    expect(candidate.readings[2].correctionReason).toBe(
      "Conferência do mecânico",
    );
  });
});
