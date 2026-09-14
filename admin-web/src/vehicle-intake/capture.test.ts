import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  emptyCapture,
  parseMlitJson,
  validateCapture,
  type VehicleCaptureFields,
} from "./capture";

function fixture(name = "sample02.json") {
  return readFileSync(
    resolve(process.cwd(), "src/vehicle-intake/fixtures", name),
    "utf8",
  );
}

function documentWith(values: Record<string, unknown> = {}) {
  return JSON.stringify({
    CertInfoImportFileVersion: "1.0",
    CertInfo: {
      EntryNoCarNo: "品川　１５０　お　１００７",
      CarNo: "ＥＴＨＵＲＡＮ０００１",
      RegistCarLightCar: "01",
      ...values,
    },
  });
}

function fields(
  patch: Partial<VehicleCaptureFields> = {},
): VehicleCaptureFields {
  return {
    ...emptyCapture().fields,
    plate: "品川 150 お 1007",
    chassis: "TRUCK-1",
    ...patch,
  };
}

describe("optional vehicle capture", () => {
  it("creates independent manual drafts with no inferred vehicle or inspection result", () => {
    const first = emptyCapture();
    first.fields.plate = "changed";
    first.warnings.push("changed");
    expect(emptyCapture()).toEqual({
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
    });
  });

  it.each([
    "sample01.json",
    "sample02.json",
    "sample03.json",
    "sample04.json",
    "K_sample01.json",
    "K_sample02.json",
    "K_sample03.json",
  ])("imports complete public MLIT fixture %s", (name) => {
    const draft = parseMlitJson(fixture(name));
    expect(draft.source).toBe("mlit-json");
    expect(draft.sourceVersion).toBe("1.0");
    expect(draft.fields.plate).not.toBe("");
    expect(draft.fields.chassis).not.toBe("");
    expect(draft.fields.internalNumber).toBe("");
    expect(draft.fields.odometerKm).toBe("");
    expect(validateCapture(draft.fields)).toEqual({});
  });

  it("preserves Japanese original values while normalizing the working vehicle fields", () => {
    const draft = parseMlitJson(fixture());
    expect(draft.fields).toMatchObject({
      plate: "品川 150 お 1007",
      chassis: "ETHURAN0001",
      manufacturer: "ニッサンディーゼル",
      model: "BKG-BPR85AR",
      engineModel: "4JJ1",
      firstRegistration: "2023-01",
      validUntil: "2025-01-04",
      grossWeightKg: "5920",
    });
    expect(draft.originalFields).toMatchObject({
      EntryNoCarNo: "品川　１５０　お　１００７",
      CarNo: "ＥＴＨＵＲＡＮ０００１",
    });
  });

  it("uses kei first examination date and never invents a registration day", () => {
    const draft = parseMlitJson(fixture("K_sample01.json"));
    expect(draft.fields.firstRegistration).toBe("2023-07");
    expect(draft.fields.validUntil).toBe("2026-07-25");
  });

  it("does not retain private fields, notes, credentials or the original document", () => {
    const draft = parseMlitJson(
      documentWith({
        OwnernameHighLevelChar: "PRIVATE_OWNER",
        UserAddressChar: "PRIVATE_ADDRESS",
        NoteInfo: "PRIVATE_NOTES",
        SecurityCode: "1234",
        AccessKey: "PRIVATE_KEY",
        UnknownFutureField: "PRIVATE_UNKNOWN",
      }),
    );
    const serialized = JSON.stringify(draft);
    for (const secret of [
      "PRIVATE_OWNER",
      "PRIVATE_ADDRESS",
      "PRIVATE_NOTES",
      "1234",
      "PRIVATE_KEY",
      "PRIVATE_UNKNOWN",
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(Object.keys(draft)).toEqual([
      "fields",
      "source",
      "sourceVersion",
      "originalFields",
      "warnings",
    ]);
  });

  it("does not mutate input and returns detached draft objects", () => {
    const source = fixture();
    const first = parseMlitJson(source);
    first.fields.plate = "changed";
    if (first.originalFields) first.originalFields.CarNo = "changed";
    expect(parseMlitJson(source).fields.plate).toBe("品川 150 お 1007");
    expect(source).toBe(fixture());
  });

  it.each([
    "null",
    "[]",
    '"text"',
    "1",
    "{}",
    '{"CertInfoImportFileVersion":"1.0","CertInfo":[]}',
  ])("rejects an invalid root/schema: %s", (input) => {
    expect(() => parseMlitJson(input)).toThrow("invalid_shape");
  });

  it("rejects broken JSON and accepts a UTF-8 BOM from file tools", () => {
    expect(() => parseMlitJson("{broken")).toThrow("invalid_json");
    expect(parseMlitJson(`\uFEFF${documentWith()}`).fields.chassis).toBe(
      "ETHURAN0001",
    );
  });

  it.each([undefined, "2.0", 1.0])(
    "rejects unrecognized/missing file version %s",
    (version) => {
      expect(() =>
        parseMlitJson(
          JSON.stringify({ CertInfoImportFileVersion: version, CertInfo: {} }),
        ),
      ).toThrow("unsupported_version");
    },
  );

  it.each([1234, null, true, ["value"], { nested: "value" }])(
    "rejects nonstring vehicle data %j",
    (value) => {
      expect(() => parseMlitJson(documentWith({ CarNo: value }))).toThrow(
        "invalid_field_type",
      );
    },
  );

  it("rejects unsupported vehicle categories without guessing", () => {
    expect(() =>
      parseMlitJson(documentWith({ RegistCarLightCar: "99" })),
    ).toThrow("unsupported_vehicle_type");
  });

  it("limits actual UTF-8 bytes to 1 MiB, not only JavaScript character count", () => {
    const base = documentWith();
    const size = new TextEncoder().encode(base).length;
    expect(() =>
      parseMlitJson(base + " ".repeat(1024 * 1024 - size)),
    ).not.toThrow();
    expect(() =>
      parseMlitJson(base + " ".repeat(1024 * 1024 - size + 1)),
    ).toThrow("file_too_large");
    expect(() =>
      parseMlitJson(documentWith({ NoteInfo: "漢".repeat(350000) })),
    ).toThrow("file_too_large");
  });

  it.each([
    ["令和", " 6", " 2", "29", "2024-02-29"],
    ["平成", "31", "4", "30", "2019-04-30"],
    ["令和", "元", "5", "1", "2019-05-01"],
    ["昭和", "64", "1", "7", "1989-01-07"],
  ])(
    "converts a valid era date %s %s/%s/%s",
    (era, year, month, day, expected) => {
      const draft = parseMlitJson(
        documentWith({
          ValidPeriodExpirdateE: era,
          ValidPeriodExpirdateY: year,
          ValidPeriodExpirdateM: month,
          ValidPeriodExpirdateD: day,
        }),
      );
      expect(draft.fields.validUntil).toBe(expected);
      expect(draft.warnings).toEqual([]);
    },
  );

  it.each([
    ["令和", "5", "2", "29"],
    ["令和", "1", "4", "30"],
    ["平成", "31", "5", "1"],
    ["昭和", "64", "1", "8"],
    ["不明", "1", "1", "1"],
    ["令和", "0", "1", "1"],
    ["令和", "6", "13", "1"],
    ["令和", "6", "1", ""],
  ])(
    "retains invalid or incomplete source date %s %s/%s/%s for review",
    (era, year, month, day) => {
      const draft = parseMlitJson(
        documentWith({
          ValidPeriodExpirdateE: era,
          ValidPeriodExpirdateY: year,
          ValidPeriodExpirdateM: month,
          ValidPeriodExpirdateD: day,
        }),
      );
      expect(draft.fields.validUntil).toBe("");
      expect(draft.warnings).toEqual(["invalid_valid_until"]);
      expect(draft.originalFields?.ValidPeriodExpirdateE).toBe(era);
    },
  );

  it("warns on partial first registration, but not a wholly empty optional date", () => {
    const draft = parseMlitJson(
      documentWith({
        FirstregistdateE: "令和",
        FirstregistdateY: "6",
        FirstregistdateM: "",
      }),
    );
    expect(draft.fields.firstRegistration).toBe("");
    expect(draft.warnings).toContain("invalid_first_registration");
    expect(parseMlitJson(documentWith()).warnings).toEqual([]);
  });

  it("keeps a complex gross weight as text and signals that it needs review", () => {
    const draft = parseMlitJson(
      documentWith({ CarTotalWgt: "２０，０００（１８，０００）" }),
    );
    expect(draft.fields.grossWeightKg).toBe("20,000(18,000)");
    expect(draft.originalFields?.CarTotalWgt).toBe(
      "２０，０００（１８，０００）",
    );
    expect(draft.warnings).toContain("complex_gross_weight");
    expect(validateCapture(draft.fields)).toEqual({});
  });

  it("requires plate and chassis but leaves fleet number and all technical fields optional", () => {
    expect(validateCapture(emptyCapture().fields)).toEqual({
      plate: "required",
      chassis: "required",
    });
    expect(validateCapture(fields())).toEqual({});
  });

  it.each([
    "2025-02-29",
    "2024-13-01",
    "2024-02",
    "2024-00-01",
    "2024-04-31",
    "24-01-01",
  ])("rejects invalid manual expiry date %s", (value) => {
    expect(validateCapture(fields({ validUntil: value }))).toEqual({
      validUntil: "invalid_date",
    });
  });

  it("accepts leap day and month-only registration without altering either field", () => {
    const original = fields({
      validUntil: "2024-02-29",
      firstRegistration: "2024-02",
    });
    const snapshot = structuredClone(original);
    expect(validateCapture(original)).toEqual({});
    expect(original).toEqual(snapshot);
    expect(
      validateCapture(fields({ firstRegistration: "2024-02-01" })),
    ).toEqual({ firstRegistration: "invalid_date" });
  });

  it.each([
    "-1",
    "NaN",
    "Infinity",
    "1e5",
    "12 km",
    "12.5",
    "99999999999999999999",
  ])("rejects malformed/unsafe odometer %s", (value) => {
    expect(validateCapture(fields({ odometerKm: value }))).toEqual({
      odometerKm: "invalid_number",
    });
  });

  it("validates simple weights and allows complex official values without coercion", () => {
    expect(
      validateCapture(fields({ odometerKm: "0", grossWeightKg: "5920" })),
    ).toEqual({});
    expect(validateCapture(fields({ grossWeightKg: "-1" }))).toEqual({
      grossWeightKg: "invalid_number",
    });
    expect(validateCapture(fields({ grossWeightKg: "NaN" }))).toEqual({
      grossWeightKg: "invalid_number",
    });
    expect(validateCapture(fields({ grossWeightKg: "20000(18000)" }))).toEqual(
      {},
    );
  });

  it("rejects oversized edited fields without changing the supplied draft", () => {
    const value = fields({ plate: "A".repeat(501) });
    expect(validateCapture(value)).toEqual({ plate: "too_long" });
    expect(value.plate.length).toBe(501);
  });
});
