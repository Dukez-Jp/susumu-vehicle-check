import { describe, expect, it } from "vitest";
import {
  activeReadings,
  createReading,
  createSession,
  normalizeVehicleKey,
  parseMm,
  positionsFor,
  slotKey,
} from "./model";

const now = "2026-09-10T03:00:00.000Z";
const position = { axle: 1, side: "left", wheel: "single" } as const;
const sessionInput = () => ({
  registration: "見本１００ あ １２３４",
  operator: "整備員・見本",
  inspectionDate: "2026-09-10",
  odometerKm: 123456,
  axleCount: 3,
  readings: [createReading("tireTread", position, "8,20", "manual", "", now)],
});

describe("measurement domain", () => {
  it("normalizes equivalent registration typography while preserving hyphens", () => {
    expect(normalizeVehicleKey("　見本１００ あ １２-３４　")).toBe(
      "見本100あ12-34",
    );
    expect(normalizeVehicleKey("abc １２")).toBe("ABC12");
  });

  it("accepts only explicit decimal millimetres in the input range", () => {
    for (const [input, expected] of [
      ["0", 0],
      ["8,20", 8.2],
      ["4.55", 4.55],
      ["100.00", 100],
    ] as const)
      expect(parseMm(input)).toBe(expected);
    for (const input of [
      "",
      "-1",
      "+4",
      "1e1",
      "NaN",
      "Infinity",
      " 4",
      "4 ",
      "1 000",
      "1,000",
      "3.123",
      "100.01",
      "1.2.3",
      ".2",
    ])
      expect(parseMm(input), input).toBeNull();
  });

  it("generates distinct physical tyre and brake positions for two to four axles", () => {
    expect(positionsFor("tireTread", 2)).toHaveLength(6);
    expect(positionsFor("tireTread", 4)).toHaveLength(14);
    expect(positionsFor("brakePad", 4)).toHaveLength(8);
    expect(
      positionsFor("brakePad", 3).every((entry) => entry.wheel === "single"),
    ).toBe(true);
    expect(
      new Set(
        positionsFor("tireTread", 4).map((entry) =>
          slotKey("tireTread", entry),
        ),
      ).size,
    ).toBe(14);
    expect(() => positionsFor("tireTread", 1)).toThrow();
  });

  it("treats drum linings as their own metric, one per side, never on a dual wheel", () => {
    expect(positionsFor("brakeLining", 4)).toHaveLength(8);
    expect(
      positionsFor("brakeLining", 3, ["single", "dual", "dual"]).every(
        (entry) => entry.wheel === "single",
      ),
    ).toBe(true);
    // Pad and lining are separate slots, so a truck with discs on the steering
    // axle and drums behind records both without one overwriting the other.
    expect(slotKey("brakeLining", position)).not.toBe(
      slotKey("brakePad", position),
    );
    const mixedBrakes = createSession(
      {
        ...sessionInput(),
        readings: [
          createReading("brakePad", position, "9.1", "manual", "", now),
          createReading(
            "brakeLining",
            { axle: 2, side: "left", wheel: "single" },
            "6.4",
            "manual",
            "",
            now,
          ),
        ],
      },
      now,
    );
    expect(mixedBrakes.readings).toHaveLength(2);
    expect(() =>
      createReading(
        "brakeLining",
        { axle: 2, side: "left", wheel: "inner" },
        "6.4",
        "manual",
        "",
        now,
      ),
    ).toThrow();
  });

  it("uses the configured wheel arrangement for each axle", () => {
    const layout = ["single", "single", "dual", "dual"] as const;
    const tyres = positionsFor("tireTread", 4, [...layout]);
    expect(tyres).toHaveLength(12);
    expect(
      tyres.filter((entry) => entry.axle === 2).map((entry) => entry.wheel),
    ).toEqual(["single", "single"]);
    expect(positionsFor("brakePad", 4, [...layout])).toHaveLength(8);
    expect(() => positionsFor("tireTread", 4, ["single", "dual"])).toThrow();
    const secondAxle = createReading(
      "tireTread",
      { axle: 2, side: "left", wheel: "single" },
      "8",
      "manual",
      "",
      now,
    );
    expect(
      createSession(
        {
          ...sessionInput(),
          axleCount: 4,
          wheelLayout: [...layout],
          readings: [secondAxle],
        },
        now,
      ).wheelLayout,
    ).toEqual(layout);
    expect(() =>
      createSession(
        {
          ...sessionInput(),
          axleCount: 4,
          wheelLayout: ["single", "dual", "dual", "dual"],
          readings: [secondAxle],
        },
        now,
      ),
    ).toThrow();
  });

  it("validates calendar dates and registration at creation", () => {
    expect(createSession(sessionInput(), now).vehicleKey).toBe("見本100あ1234");
    expect(() =>
      createSession({ ...sessionInput(), inspectionDate: "2026-02-29" }, now),
    ).toThrow();
    expect(() =>
      createSession({ ...sessionInput(), inspectionDate: "2024-02-29" }, now),
    ).not.toThrow();
    expect(() =>
      createSession({ ...sessionInput(), registration: " " }, now),
    ).toThrow();
    expect(() =>
      createSession({ ...sessionInput(), odometerKm: -1 }, now),
    ).toThrow();
    expect(() =>
      createSession({ ...sessionInput(), readings: [] }, now),
    ).toThrow();
  });

  it("requires the physical device identity for Bluetooth and preserves simulation provenance", () => {
    expect(() =>
      createReading("tireTread", position, "8.2", "bluetooth", "", now),
    ).toThrow();
    expect(
      createReading(
        "tireTread",
        position,
        "8.2",
        "simulator",
        "Instrumento de demonstração",
        now,
      ).source,
    ).toBe("simulator");
    expect(
      createReading(
        "tireTread",
        position,
        "8.2",
        "bluetooth",
        "Instrumento 1",
        now,
      ).deviceName,
    ).toBe("Instrumento 1");
  });

  it("reduces a correction chain without changing the original readings", () => {
    const session = createSession(sessionInput(), now);
    const original = session.readings[0];
    const first = {
      ...createReading(
        "tireTread",
        position,
        "7.8",
        "manual",
        "",
        "2026-09-10T03:01:00.000Z",
      ),
      supersedesId: original.id,
      correctionReason: "Nova medição",
    };
    const second = {
      ...createReading(
        "tireTread",
        position,
        "7.9",
        "manual",
        "",
        "2026-09-10T03:02:00.000Z",
      ),
      supersedesId: first.id,
      correctionReason: "Conferência",
    };
    session.readings.push(first, second);
    expect(activeReadings(session).map((entry) => entry.id)).toEqual([
      second.id,
    ]);
    expect(session.readings[0].valueMm).toBe(8.2);
    expect(session.readings).toHaveLength(3);
  });
});
