import { describe, expect, it } from "vitest";
import {
  createTemplateDraft,
  templatePayload,
  validateTemplate,
  validateVehicle,
  photoSummary,
} from "../domain";

describe("template publication validation", () => {
  function measurementDraft(minValue: string, maxValue = "") {
    const draft = createTemplateDraft();
    draft.name = "Inspeção";
    draft.vehicleType = "Truck";
    draft.sections[0].title = "Medições";
    Object.assign(draft.sections[0].items[0], {
      label: "Espessura",
      responseType: "measurement",
      minValue,
      maxValue,
      unit: "mm",
    });
    return draft;
  }

  it("accepts four decimal places and rejects finer bounds without rounding", () => {
    for (const value of ["0.0001", "-12.3456", "0.00010", "1e-4", "0.000000"]) {
      expect(validateTemplate(measurementDraft(value)), value).toEqual([]);
    }
    for (const value of ["0.00001", "-12.34567", "1e-5"]) {
      for (const draft of [
        measurementDraft(value),
        measurementDraft("", value),
      ]) {
        expect(validateTemplate(draft).join(" "), value).toMatch(
          /4 casas decimais/i,
        );
        expect(
          draft.sections[0].items[0].minValue ||
            draft.sections[0].items[0].maxValue,
        ).toBe(value);
      }
    }
  });

  it("enforces the API numeric range for both bounds including scientific notation", () => {
    expect(
      validateTemplate(
        measurementDraft("-99999999999999", "9.9999999999999e13"),
      ),
    ).toEqual([]);
    for (const value of [
      "100000000000000",
      "-100000000000000",
      "1e14",
      "99999999999999.0001",
    ]) {
      expect(validateTemplate(measurementDraft(value)), value).not.toEqual([]);
      expect(validateTemplate(measurementDraft("", value)), value).not.toEqual(
        [],
      );
    }
  });

  it("rejects bounds that JSON numbers would silently round before reaching the API", () => {
    const draft = measurementDraft("99999999999998.9999");
    expect(Number(draft.sections[0].items[0].minValue)).toBe(99999999999999);
    expect(validateTemplate(draft).join(" ")).toMatch(/sem alterar seu valor/i);
    expect(draft.sections[0].items[0].minValue).toBe("99999999999998.9999");
    const exact = measurementDraft("12.3456");
    expect(validateTemplate(exact)).toEqual([]);
    expect(
      JSON.parse(JSON.stringify(templatePayload(exact))).sections[0].items[0]
        .minValue,
    ).toBe(12.3456);
  });

  it("blocks empty checklists instead of producing publishable versions", () => {
    expect(validateTemplate(createTemplateDraft()).length).toBeGreaterThan(0);
  });

  it("rejects inverted bounds, nonnumeric measurements and missing units", () => {
    const draft = createTemplateDraft();
    draft.name = "Inspeção de pneus";
    draft.vehicleType = "Truck";
    draft.sections[0].title = "Pneus";
    Object.assign(draft.sections[0].items[0], {
      label: "Sulco",
      responseType: "measurement",
      minValue: "8",
      maxValue: "2",
      unit: "mm",
    });
    expect(validateTemplate(draft).join(" ")).toMatch(/mínimo.*máximo/i);
    draft.sections[0].items[0].minValue = "abc";
    expect(validateTemplate(draft).join(" ")).toMatch(/número/i);
    Object.assign(draft.sections[0].items[0], {
      minValue: "0",
      maxValue: "20",
      unit: "",
    });
    expect(validateTemplate(draft).join(" ")).toMatch(/unidade/i);
  });

  it("serializes zero bounds and discards irrelevant bounds for status items", () => {
    const draft = createTemplateDraft();
    draft.name = "Freios";
    draft.vehicleType = "Truck";
    draft.sections[0].title = "Eixos";
    Object.assign(draft.sections[0].items[0], {
      label: "Espessura",
      responseType: "measurement",
      minValue: "0",
      maxValue: "20",
      unit: "mm",
    });
    expect(validateTemplate(draft)).toEqual([]);
    expect(templatePayload(draft).sections[0].items[0].minValue).toBe(0);
    draft.sections[0].items[0].responseType = "status";
    expect(templatePayload(draft).sections[0].items[0].minValue).toBeNull();
    expect(templatePayload(draft).sections[0].items[0]).not.toHaveProperty(
      "key",
    );
  });
});

describe("vehicle and report integrity", () => {
  it("preserves unknown odometer and plate instead of inventing zero or a plate", () => {
    expect(
      validateVehicle({
        internalNumber: "714",
        plate: "",
        type: "Truck",
        currentOdometerKm: null,
        active: true,
      }),
    ).toEqual([]);
    expect(
      validateVehicle(
        {
          internalNumber: "714",
          plate: "",
          type: "Truck",
          currentOdometerKm: null,
          active: true,
        },
        100,
      ),
    ).not.toEqual([]);
  });
  it("rejects odometer regressions, negative and nonfinite values", () => {
    const base = {
      internalNumber: "714",
      plate: "TEST",
      type: "Truck",
      currentOdometerKm: 50,
      active: true,
    };
    expect(validateVehicle(base, 100).join(" ")).toMatch(/reduzida/i);
    expect(validateVehicle({ ...base, currentOdometerKm: -1 })).not.toEqual([]);
    expect(
      validateVehicle({ ...base, currentOdometerKm: Number.NaN }),
    ).not.toEqual([]);
    expect(validateVehicle({ ...base, currentOdometerKm: 20.5 })).not.toEqual(
      [],
    );
    expect(
      validateVehicle({ ...base, currentOdometerKm: 2_147_483_648 }),
    ).not.toEqual([]);
  });

  it("never calls a report complete while declared photo bytes are missing", () => {
    expect(
      photoSummary({
        photoUploadState: "Complete",
        items: [],
        signaturePhotoId: "signature-missing",
        photos: [],
      }),
    ).toMatchObject({ complete: false, declared: 1, uploaded: 0 });
    expect(
      photoSummary({
        photoUploadState: "Pending",
        items: [{ photoIds: ["a"] }],
        photos: [],
      }).complete,
    ).toBe(false);
    expect(
      photoSummary({
        photoUploadState: "Complete",
        items: [{ photoIds: ["a", "b"] }],
        photos: [{ id: "a", uploaded: true }],
      }).complete,
    ).toBe(false);
    expect(
      photoSummary({
        photoUploadState: "Complete",
        items: [{ photoIds: ["a"] }],
        photos: [{ id: "a", uploaded: true }],
      }),
    ).toMatchObject({ complete: true, declared: 1, uploaded: 1 });
  });
});
