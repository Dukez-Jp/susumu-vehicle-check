import { describe, expect, it } from "vitest";
import {
  loadPreview,
  savePreview,
  STORAGE_KEY as PDF_KEY,
} from "../demo/pdf-preview/state";
import { createReading, createSession } from "./model";
import { STORAGE_KEY as MEASUREMENTS_KEY } from "./storage";
import {
  measurementBindingValid,
  measurementPreviewStorage,
  seedMeasurementPreview,
} from "./inspection";

const now = "2026-09-10T03:00:00.000Z";
function session(registration = "見本１００ あ１２３４") {
  return createSession(
    {
      registration,
      operator: "整備員・見本",
      inspectionDate: "2026-09-10",
      odometerKm: 123456,
      axleCount: 3,
      readings: [
        createReading(
          "tireTread",
          { axle: 1, side: "left", wheel: "single" },
          "8.2",
          "manual",
          "",
          now,
        ),
      ],
    },
    now,
  );
}

function memory() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
  };
}

describe("measurement-linked inspection drafts", () => {
  it("seeds only identity and keeps all 100 answers and both note languages empty", () => {
    const measurement = session();
    const state = seedMeasurementPreview(measurement);
    expect(
      Object.entries(state.header).filter(([, value]) => value !== ""),
    ).toEqual([
      ["registration", measurement.registration],
      ["odometer", "123456"],
      ["inspectionDate", "2026-09-10"],
      ["inspector", measurement.operator],
    ]);
    expect(Object.values(state.answers)).toHaveLength(100);
    expect(
      Object.values(state.answers).every(
        (answer) => answer.result === "" && answer.actions.length === 0,
      ),
    ).toBe(true);
    expect(state.notesPt).toBe("");
    expect(state.notesJa).toBe("");
    expect(state.notesJaReviewed).toBe(false);
    expect(measurementBindingValid(state, measurement)).toBe(true);
  });

  it("persists per session without touching legacy PDF, measurement history, or unrelated data", () => {
    const storage = memory();
    storage.setItem(PDF_KEY, "original standalone preview bytes");
    storage.setItem(MEASUREMENTS_KEY, "measurement history bytes");
    storage.setItem("vehicle-intake", "certificate history bytes");
    const measurement = session();
    const adapter = measurementPreviewStorage(storage, measurement);
    expect(loadPreview(adapter).raw).toBeNull();
    const state = seedMeasurementPreview(measurement);
    state.answers["pdf-036"].result = "attention";
    const raw = savePreview(adapter, null, state);
    expect(storage.getItem(`${PDF_KEY}:measurement:${measurement.id}`)).toBe(
      raw,
    );
    expect(loadPreview(adapter)).toEqual({ state, raw });
    expect(storage.getItem(PDF_KEY)).toBe("original standalone preview bytes");
    expect(storage.getItem(MEASUREMENTS_KEY)).toBe("measurement history bytes");
    expect(storage.getItem("vehicle-intake")).toBe("certificate history bytes");
    expect(adapter.getItem("vehicle-intake")).toBe("certificate history bytes");
  });

  it("isolates two trucks and separate measurement sessions for the same truck", () => {
    const storage = memory();
    const first = session();
    const second = session("見本100あ5678");
    const later = session();
    const firstDraft = seedMeasurementPreview(first);
    firstDraft.notesJa = "異音を確認する。";
    firstDraft.answers["pdf-029"] = { result: "checked", actions: ["replace"] };
    const adapter = measurementPreviewStorage(storage, first);
    savePreview(adapter, null, firstDraft);
    expect(
      loadPreview(measurementPreviewStorage(storage, second)).raw,
    ).toBeNull();
    expect(
      loadPreview(measurementPreviewStorage(storage, later)).raw,
    ).toBeNull();
    savePreview(
      measurementPreviewStorage(storage, second),
      null,
      seedMeasurementPreview(second),
    );
    savePreview(
      measurementPreviewStorage(storage, later),
      null,
      seedMeasurementPreview(later),
    );
    expect(loadPreview(adapter).state).toEqual(firstDraft);
    expect(storage.data.size).toBe(3);
  });

  it("accepts only registration typography equivalence and rejects changed bound metadata", () => {
    const measurement = session();
    const state = seedMeasurementPreview(measurement);
    state.header.registration = " 見本100 あ 1234 ";
    expect(measurementBindingValid(state, measurement)).toBe(true);
    for (const [key, value] of [
      ["registration", "見本100あ5678"],
      ["inspectionDate", "2026-09-11"],
      ["odometer", "123457"],
      ["inspector", "別担当者"],
    ] as const) {
      expect(
        measurementBindingValid(
          { ...state, header: { ...state.header, [key]: value } },
          measurement,
        ),
        key,
      ).toBe(false);
    }
  });

  it("does not repair corrupt scoped data or swallow storage errors", () => {
    const storage = memory();
    const measurement = session();
    const key = `${PDF_KEY}:measurement:${measurement.id}`;
    storage.setItem(key, "corrupt saved draft");
    const adapter = measurementPreviewStorage(storage, measurement);
    expect(() => loadPreview(adapter)).toThrow();
    expect(storage.getItem(key)).toBe("corrupt saved draft");
    const inaccessible = measurementPreviewStorage(
      {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      },
      measurement,
    );
    expect(() => inaccessible.getItem(PDF_KEY)).toThrow("blocked");
    expect(() => inaccessible.setItem(PDF_KEY, "data")).toThrow("blocked");
  });
});
