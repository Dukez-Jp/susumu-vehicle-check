import { describe, expect, it } from "vitest";
import { createReading } from "./model";
import { DRAFT_STORAGE_KEY, emptyDraft, loadDraft, saveDraft } from "./draft";

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
const reading = () =>
  createReading(
    "tireTread",
    { axle: 1, side: "left", wheel: "single" },
    "8.2",
    "manual",
  );

describe("durable measurement draft", () => {
  it("starts with its own stable ID and keeps partial vehicle data through reload", () => {
    const storage = memory();
    const initial = loadDraft(storage);
    expect(initial.raw).toBeNull();
    expect(initial.draft.readings).toEqual([]);
    const draft = {
      ...initial.draft,
      registration: "見本100",
      operator: "",
      inspectionDate: "",
      odometerInput: "abc",
      readings: [reading()],
    };
    const raw = saveDraft(storage, null, draft);
    expect(loadDraft(storage)).toEqual({ draft, raw });
    expect(emptyDraft().id).not.toBe(draft.id);
  });

  it("preserves corrupt persisted data even if a caller passes its exact raw value", () => {
    const storage = memory();
    storage.setItem(DRAFT_STORAGE_KEY, "broken");
    expect(() => loadDraft(storage)).toThrow();
    expect(() => saveDraft(storage, "broken", emptyDraft())).toThrow();
    expect(storage.getItem(DRAFT_STORAGE_KEY)).toBe("broken");
  });

  it("rejects stale saves and preserves another tab's latest draft", () => {
    const storage = memory();
    const draft = emptyDraft();
    const first = saveDraft(storage, null, draft);
    const second = saveDraft(storage, first, { ...draft, operator: "Other" });
    expect(() =>
      saveDraft(storage, first, { ...draft, operator: "Stale" }),
    ).toThrow();
    expect(storage.getItem(DRAFT_STORAGE_KEY)).toBe(second);
  });

  it("rejects duplicate positions, readings on removed axles and correction records", () => {
    const storage = memory();
    const first = reading();
    expect(() =>
      saveDraft(storage, null, {
        ...emptyDraft(),
        readings: [first, reading()],
      }),
    ).toThrow();
    const rear = createReading(
      "tireTread",
      { axle: 4, side: "left", wheel: "inner" },
      "8.2",
      "manual",
    );
    expect(() =>
      saveDraft(storage, null, { ...emptyDraft(), readings: [rear] }),
    ).toThrow();
    expect(() =>
      saveDraft(storage, null, {
        ...emptyDraft(),
        readings: [
          {
            ...first,
            supersedesId: "older",
            correctionReason: "remeasurement",
          },
        ],
      }),
    ).toThrow();
    expect(storage.getItem(DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("reports write failure while preserving the previous saved draft", () => {
    const storage = memory();
    const draft = emptyDraft();
    const raw = saveDraft(storage, null, draft);
    const blocked = {
      ...storage,
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
    };
    expect(() =>
      saveDraft(blocked, raw, { ...draft, operator: "Current" }),
    ).toThrow();
    expect(storage.getItem(DRAFT_STORAGE_KEY)).toBe(raw);
  });

  it("persists the wheel layout and refuses a layout change that would orphan a captured tyre", () => {
    const storage = memory();
    const front = createReading(
      "tireTread",
      { axle: 2, side: "left", wheel: "single" },
      "8",
      "manual",
    );
    const draft = {
      ...emptyDraft(),
      axleCount: 4,
      wheelLayout: ["single", "single", "dual", "dual"] as (
        "single" | "dual"
      )[],
      readings: [front],
    };
    const raw = saveDraft(storage, null, draft);
    expect(loadDraft(storage).draft.wheelLayout).toEqual(draft.wheelLayout);
    expect(() =>
      saveDraft(storage, raw, {
        ...draft,
        wheelLayout: ["single", "dual", "dual", "dual"],
      }),
    ).toThrow();
    expect(storage.getItem(DRAFT_STORAGE_KEY)).toBe(raw);
  });
});
