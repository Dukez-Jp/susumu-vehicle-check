import { describe, expect, it } from "vitest";
import { createReading, createSession, type MeasurementSession } from "./model";
import {
  appendCorrection,
  DEMO_STORAGE_KEY,
  loadMeasurements,
  saveSession,
  storeKindFor,
  STORAGE_KEY,
} from "./storage";

const now = "2026-09-10T03:00:00.000Z";
const position = { axle: 1, side: "left", wheel: "single" } as const;
function session(registration = "見本100あ1234") {
  return createSession(
    {
      registration,
      operator: "見本",
      inspectionDate: "2026-09-10",
      odometerKm: 100,
      axleCount: 2,
      readings: [
        createReading("tireTread", position, "8.2", "manual", "", now),
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
function correction(
  target: MeasurementSession,
  supersedesId = target.readings[0].id,
) {
  return {
    ...createReading(
      "tireTread",
      position,
      "7.8",
      "manual",
      "",
      "2026-09-10T04:00:00.000Z",
    ),
    supersedesId,
    correctionReason: "Repetição com instrumento conferido",
  };
}

describe("append-only measurement storage", () => {
  it("starts empty only when its own key is absent and leaves unrelated records unchanged", () => {
    const storage = memory();
    storage.setItem("legacy-demo", "preserved");
    expect(loadMeasurements(storage)).toEqual({ version: 1, sessions: [] });
    saveSession(storage, session());
    expect(storage.getItem("legacy-demo")).toBe("preserved");
  });

  it("reloads existing sessions and never updates an existing session by saving its ID", () => {
    const storage = memory();
    const first = session();
    saveSession(storage, first);
    const second = session("見本100あ5678");
    expect(
      saveSession(storage, second).sessions.map((entry) => entry.id),
    ).toEqual([first.id, second.id]);
    const raw = storage.getItem(STORAGE_KEY);
    expect(() => saveSession(storage, { ...first, odometerKm: 999 })).toThrow();
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it("preserves corrupt and unknown-version storage instead of resetting", () => {
    for (const value of [
      "",
      "oops",
      "null",
      '{"version":2,"sessions":[]}',
      '{"version":1,"sessions":[],"other":true}',
    ]) {
      const storage = memory();
      storage.setItem(STORAGE_KEY, value);
      expect(() => loadMeasurements(storage)).toThrow();
      expect(() => saveSession(storage, session())).toThrow();
      expect(storage.getItem(STORAGE_KEY)).toBe(value);
    }
  });

  it("rejects altered vehicle identity, impossible positions and duplicate slots", () => {
    const candidate = session();
    const storage = memory();
    expect(() =>
      saveSession(storage, { ...candidate, vehicleKey: "OTHER" }),
    ).toThrow();
    expect(() =>
      saveSession(storage, {
        ...candidate,
        readings: [
          {
            ...candidate.readings[0],
            position: { axle: 3, side: "left", wheel: "inner" },
          },
        ],
      }),
    ).toThrow();
    expect(() =>
      saveSession(storage, {
        ...candidate,
        readings: [
          ...candidate.readings,
          createReading("tireTread", position, "8", "manual", "", now),
        ],
      }),
    ).toThrow();
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("appends corrections while retaining the untouched original and other vehicles", () => {
    const storage = memory();
    const first = session();
    const other = session("見本100あ5678");
    saveSession(storage, first);
    saveSession(storage, other);
    const next = correction(first);
    const result = appendCorrection(storage, first.id, next);
    expect(result.sessions[0].readings).toEqual([first.readings[0], next]);
    expect(result.sessions[1]).toEqual(other);
    expect(first.readings).toHaveLength(1);
  });

  it("keeps rehearsal measurements out of the history of a real truck", () => {
    const storage = memory();
    const real = session();
    const rehearsal = createSession(
      {
        registration: real.registration,
        operator: "見本",
        inspectionDate: "2026-09-10",
        odometerKm: 100,
        axleCount: 2,
        readings: [
          createReading(
            "tireTread",
            position,
            "1.5",
            "simulator",
            "模擬計測器",
            now,
          ),
        ],
      },
      now,
    );
    saveSession(storage, real);
    saveSession(storage, rehearsal);
    expect(storeKindFor(rehearsal)).toBe("demo");
    // Same plate, two stores. A mechanic reading the truck's history sees 8.2,
    // never the 1.5 typed into the simulator.
    expect(loadMeasurements(storage).sessions).toEqual([real]);
    expect(loadMeasurements(storage, "demo").sessions).toEqual([rehearsal]);
    expect(storage.getItem(STORAGE_KEY)).not.toContain("simulator");
    expect(storage.getItem(DEMO_STORAGE_KEY)).toContain("simulator");
  });

  it("refuses a session that mixes a simulated reading with real work", () => {
    const storage = memory();
    const mixed = createSession(
      {
        registration: "見本100あ1234",
        operator: "見本",
        inspectionDate: "2026-09-10",
        odometerKm: 100,
        axleCount: 2,
        readings: [
          createReading("tireTread", position, "8.2", "manual", "", now),
          createReading(
            "brakePad",
            position,
            "1.0",
            "simulator",
            "模擬計測器",
            now,
          ),
        ],
      },
      now,
    );
    expect(() => saveSession(storage, mixed)).toThrow("MIXED_SOURCES");
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
    expect(storage.getItem(DEMO_STORAGE_KEY)).toBeNull();
  });

  it("refuses to introduce a simulated value into real history through a correction", () => {
    const storage = memory();
    const first = session();
    saveSession(storage, first);
    const raw = storage.getItem(STORAGE_KEY);
    expect(() =>
      appendCorrection(storage, first.id, {
        ...correction(first),
        source: "simulator",
        deviceName: "模擬計測器",
      }),
    ).toThrow("MIXED_SOURCES");
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it("accepts a correction recorded while the tablet clock was behind the original", () => {
    const storage = memory();
    const first = session();
    saveSession(storage, first);
    // A tablet kept offline can have its clock put back by a later time sync.
    // The correction that follows is still the newer record: order comes from
    // the append-only chain, not from the timestamp.
    const backdated = {
      ...correction(first),
      capturedAt: "2026-09-09T00:00:00.000Z",
    };
    const result = appendCorrection(storage, first.id, backdated);
    expect(result.sessions[0].readings).toEqual([first.readings[0], backdated]);
    expect(result.sessions[0].readings[0].valueMm).toBe(8.2);
  });

  it("rejects forks, missing reasons and corrections across vehicles/positions", () => {
    const storage = memory();
    const first = session();
    const other = session("見本100あ5678");
    saveSession(storage, first);
    saveSession(storage, other);
    expect(() =>
      appendCorrection(storage, first.id, {
        ...correction(first),
        correctionReason: " ",
      }),
    ).toThrow();
    expect(() =>
      appendCorrection(storage, first.id, correction(other)),
    ).toThrow();
    expect(() =>
      appendCorrection(storage, first.id, {
        ...correction(first),
        position: { ...position, side: "right" },
      }),
    ).toThrow();
    appendCorrection(storage, first.id, correction(first));
    const raw = storage.getItem(STORAGE_KEY);
    expect(() =>
      appendCorrection(storage, first.id, correction(first)),
    ).toThrow();
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it("detects a different tab writing between reload and write", () => {
    const storage = memory();
    const concurrent = JSON.stringify({ version: 1, sessions: [session()] });
    let reads = 0;
    const racing = {
      getItem: (key: string) => {
        reads += 1;
        if (reads === 2) storage.setItem(key, concurrent);
        return storage.getItem(key);
      },
      setItem: storage.setItem,
    };
    expect(() => saveSession(racing, session())).toThrow();
    expect(storage.getItem(STORAGE_KEY)).toBe(concurrent);
  });

  it("reports read/write/quota failures without reporting successful persistence", () => {
    expect(() =>
      loadMeasurements({
        getItem: () => {
          throw new Error("blocked");
        },
      }),
    ).toThrow();
    const storage = memory();
    expect(() =>
      saveSession(
        {
          ...storage,
          setItem: () => {
            throw new DOMException("full", "QuotaExceededError");
          },
        },
        session(),
      ),
    ).toThrow();
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("enforces the 500 session limit while preserving the complete existing history", () => {
    const storage = memory();
    const sessions = Array.from({ length: 500 }, () => session());
    const raw = JSON.stringify({ version: 1, sessions });
    storage.setItem(STORAGE_KEY, raw);
    expect(loadMeasurements(storage).sessions).toHaveLength(500);
    expect(() => saveSession(storage, session())).toThrow();
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it("detects damaged histories without silently dropping an invalid reading", () => {
    const storage = memory();
    const saved = session();
    const invalid = { ...correction(saved), supersedesId: "missing-reading" };
    const raw = JSON.stringify({
      version: 1,
      sessions: [{ ...saved, readings: [...saved.readings, invalid] }],
    });
    storage.setItem(STORAGE_KEY, raw);
    expect(() => loadMeasurements(storage)).toThrowError("CORRUPT_STORAGE");
    expect(() =>
      appendCorrection(storage, saved.id, correction(saved)),
    ).toThrowError("CORRUPT_STORAGE");
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it("rejects a reading ID reused in a separate vehicle session", () => {
    const storage = memory();
    const first = session();
    saveSession(storage, first);
    const raw = storage.getItem(STORAGE_KEY);
    const other = session("見本100あ5678");
    expect(() =>
      saveSession(storage, {
        ...other,
        readings: [{ ...other.readings[0], id: first.readings[0].id }],
      }),
    ).toThrowError("DUPLICATE_ID");
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it("keeps all 250 original and corrected readings when the correction limit is reached", () => {
    const storage = memory();
    const saved = session();
    for (let index = 1; index < 250; index += 1) {
      saved.readings.push({
        ...createReading(
          "tireTread",
          position,
          "8",
          "manual",
          "",
          new Date(Date.parse(now) + index * 1000).toISOString(),
        ),
        supersedesId: saved.readings[index - 1].id,
        correctionReason: "remeasurement",
      });
    }
    const raw = JSON.stringify({ version: 1, sessions: [saved] });
    storage.setItem(STORAGE_KEY, raw);
    expect(loadMeasurements(storage).sessions[0].readings).toHaveLength(250);
    expect(() =>
      appendCorrection(
        storage,
        saved.id,
        correction(saved, saved.readings[249].id),
      ),
    ).toThrowError("READING_LIMIT");
    expect(storage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it("retains the saved wheel layout when appending a correction", () => {
    const storage = memory();
    const reading = createReading(
      "tireTread",
      { axle: 2, side: "left", wheel: "single" },
      "8",
      "manual",
      "",
      now,
    );
    const original = createSession(
      {
        registration: "見本100あ1234",
        operator: "見本",
        inspectionDate: "2026-09-10",
        odometerKm: 100,
        axleCount: 4,
        wheelLayout: ["single", "single", "dual", "dual"],
        readings: [reading],
      },
      now,
    );
    saveSession(storage, original);
    const next = {
      ...createReading(
        "tireTread",
        reading.position,
        "7.9",
        "manual",
        "",
        "2026-09-10T04:00:00.000Z",
      ),
      supersedesId: reading.id,
      correctionReason: "remeasurement",
    };
    expect(
      appendCorrection(storage, original.id, next).sessions[0].wheelLayout,
    ).toEqual(original.wheelLayout);
  });
});
