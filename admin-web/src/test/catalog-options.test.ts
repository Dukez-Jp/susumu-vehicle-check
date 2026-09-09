import { describe, expect, it } from "vitest";
import {
  createTemplateDraft,
  templatePayload,
  validateTemplate,
  validateVehicleType,
  validateVehicleTypeAssignment,
} from "../domain";
import type { ChecklistTemplate, ItemStatus, VehicleType } from "../types";

const catalog: VehicleType[] = [
  { id: "truck", code: "Truck", name: "Caminhão", active: true },
  { id: "old", code: "Old", name: "Tipo antigo", active: false },
];
function draft() {
  const value = createTemplateDraft();
  value.name = "Freios";
  value.vehicleType = "Truck";
  value.sections[0].title = "Eixos";
  value.sections[0].items[0].label = "Disco";
  return value;
}

describe("vehicle type catalog", () => {
  it("validates exact code/name bounds, controls and case-insensitive duplicates", () => {
    expect(
      validateVehicleType({ code: "A".repeat(80), name: "N".repeat(120) }),
    ).toEqual([]);
    expect(
      validateVehicleType({ code: "A".repeat(81), name: "N".repeat(121) }),
    ).toHaveLength(2);
    expect(
      validateVehicleType({ code: "A\tB", name: "Nome\u0085" }),
    ).toHaveLength(2);
    expect(
      validateVehicleType({ code: " truck ", name: "Caminhão" }, catalog),
    ).not.toEqual([]);
    expect(
      validateVehicleType(
        { code: "Truck", name: "Nome atualizado" },
        catalog,
        "truck",
      ),
    ).toEqual([]);
  });

  it("requires active codes for new assignments but preserves an unchanged retired vehicle code", () => {
    expect(validateVehicleTypeAssignment("Truck", catalog)).toEqual([]);
    expect(validateVehicleTypeAssignment("Old", catalog)).not.toEqual([]);
    expect(validateVehicleTypeAssignment("Unknown", catalog)).not.toEqual([]);
    expect(validateVehicleTypeAssignment("Old", catalog, "Old")).toEqual([]);
    expect(validateVehicleTypeAssignment("Old", catalog, "Truck")).not.toEqual(
      [],
    );
    expect(validateVehicleTypeAssignment("", catalog)).not.toEqual([]);
  });
});

describe("versioned standard answer options", () => {
  it("keeps null as all statuses and copies explicit options without mutating the published version", () => {
    const value = draft();
    expect(
      templatePayload(value).sections[0].items[0].allowedStatuses,
    ).toBeNull();
    const source: ChecklistTemplate = {
      id: "template",
      name: "Freios",
      vehicleType: "Truck",
      version: 3,
      published: true,
      active: true,
      requiresSignature: false,
      sections: [
        {
          id: "section",
          title: "Eixos",
          items: [
            {
              id: "item",
              label: "Disco",
              responseType: "measurement",
              required: true,
              unit: "mm",
              minValue: null,
              maxValue: null,
              allowedStatuses: ["Critical", "Repair"],
            },
          ],
        },
      ],
    };
    const copy = createTemplateDraft(source);
    expect(templatePayload(copy).sections[0].items[0].allowedStatuses).toEqual([
      "Critical",
      "Repair",
    ]);
    copy.sections[0].items[0].allowedStatuses!.push("OK");
    expect(source.sections[0].items[0].allowedStatuses).toEqual([
      "Critical",
      "Repair",
    ]);
    delete source.sections[0].items[0].allowedStatuses;
    expect(
      templatePayload(createTemplateDraft(source)).sections[0].items[0]
        .allowedStatuses,
    ).toBeNull();
  });

  it("rejects empty, duplicate, unknown and only-N/A required options for status and measurement items", () => {
    for (const responseType of ["status", "measurement"] as const) {
      const value = draft();
      const item = value.sections[0].items[0];
      Object.assign(item, { responseType, unit: "mm" });
      for (const options of [[], ["OK", "OK"], ["Custom"], ["NotApplicable"]]) {
        item.allowedStatuses = options as ItemStatus[];
        expect(
          validateTemplate(value),
          `${responseType}: ${options.join()}`,
        ).not.toEqual([]);
      }
      item.required = false;
      item.allowedStatuses = ["NotApplicable"];
      expect(validateTemplate(value)).toEqual([]);
      item.required = true;
      item.allowedStatuses = ["NotApplicable", "Critical"];
      expect(validateTemplate(value)).toEqual([]);
    }
  });
});
