import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import source from "../../../../docs/source/tenken-20260910/catalogo_pdf_100_itens.json";
import OriginalForm from "./OriginalForm";
import { preparePrint } from "./print";
import { emptyPreview, type HeaderFields } from "./state";

describe("original Japanese form preview", () => {
  it("keeps all 100 source response cells and the immutable original background", () => {
    const state = emptyPreview();
    for (const answer of Object.values(state.answers))
      answer.result = "checked";
    const html = renderToStaticMarkup(createElement(OriginalForm, { state }));
    const doc = new DOMParser().parseFromString(html, "text/html");
    expect(
      Array.from(doc.querySelectorAll("[data-response-id]")).map((node) =>
        node.getAttribute("data-response-id"),
      ),
    ).toEqual(source.items.map((item) => item.id));
    expect(doc.querySelectorAll("[data-response-id] text")).toHaveLength(100);
    expect(html).toContain("/tenken/original.png");
    expect(html).toContain("見本・未確定");
    const original = readFileSync("public/tenken/original.pdf");
    expect(createHash("sha256").update(original).digest("hex")).toBe(
      source.source.sha256,
    );
  });

  it("prints valid dates as numeric parts in the original Japanese unit fields", () => {
    const state = emptyPreview();
    state.header.firstRegistration = "2020-02";
    state.header.inspectionDate = "2024-02-29";
    state.header.completionDate = "2026-09-10";
    const result = preparePrint(state);
    expect(result.issues).toEqual([]);
    expect(result.fields.map(({ text }) => text)).toEqual([
      "2020",
      "2",
      "2024",
      "2",
      "29",
      "2026",
      "9",
      "10",
    ]);
    expect(
      result.fields.every(
        (field) => field.fontSize >= 6 && field.lines.length === 1,
      ),
    ).toBe(true);
  });

  it.each<[keyof HeaderFields, string]>([
    ["firstRegistration", "2026-13"],
    ["firstRegistration", "0000-01"],
    ["inspectionDate", "2023-02-29"],
    ["inspectionDate", "2026-04-31"],
    ["completionDate", "2026-09-10T08:00:00Z"],
    ["odometer", "-1"],
    ["odometer", "100.5"],
    ["odometer", "1e6"],
    ["co", "101"],
    ["hc", "Infinity"],
  ])(
    "blocks invalid %s without printing an invented replacement",
    (key, value) => {
      const state = emptyPreview();
      state.header[key] = value;
      const result = preparePrint(state);
      expect(result.issues).toContain(key);
      expect(result.fields).toEqual([]);
    },
  );

  it("normalizes a decimal comma for the Japanese CO reading and keeps zero", () => {
    const state = emptyPreview();
    state.header.co = "0,25";
    state.header.hc = "0";
    state.header.odometer = "187450";
    const result = preparePrint(state);
    expect(result.issues).toEqual([]);
    expect(result.fields.map(({ text }) => text)).toEqual([
      "187450",
      "0.25",
      "0",
    ]);
  });

  it("blocks Portuguese notes until a Japanese version is present and reviewed", () => {
    const state = emptyPreview();
    state.notesPt = "Trocar filtro e verificar vazamento.";
    state.notesJa = "フィルターを交換し、漏れを確認する。";
    expect(preparePrint(state).issues).toContain("notes");
    const html = renderToStaticMarkup(createElement(OriginalForm, { state }));
    expect(html).not.toContain(state.notesPt);
    expect(html).not.toContain(state.notesJa);
    expect(html).toContain("備考確認待ち");
    state.notesJaReviewed = true;
    const accepted = preparePrint(state);
    expect(accepted.issues).toEqual([]);
    expect(
      accepted.fields.find((field) => field.key === "notes")?.lines.join(""),
    ).toBe(state.notesJa);
    state.notesJa = "";
    expect(preparePrint(state).issues).toContain("notes");
  });

  it("wraps Japanese notes without discarding characters and rejects oversized content", () => {
    const state = emptyPreview();
    state.notesJa =
      "フィルター交換済み。再点検して油漏れがないことを確認した。";
    const result = preparePrint(state);
    const notes = result.fields.find((field) => field.key === "notes")!;
    expect(result.issues).toEqual([]);
    expect(notes.lines.length).toBeGreaterThan(1);
    expect(notes.lines.join("")).toBe(state.notesJa);
    expect(notes.fontSize).toBeGreaterThanOrEqual(6);
    state.notesJa = "点検内容の確認が必要。".repeat(70);
    expect(preparePrint(state).issues).toContain("notes");
    state.header.engineModel = "大型特殊原動機の識別情報".repeat(8);
    expect(preparePrint(state).issues).toContain("engineModel");
  });

  it("preserves a surrogate pair and combining kana as whole graphemes", () => {
    const state = emptyPreview();
    state.notesJa = "確認𠮷田か\u3099対応済み。".repeat(4);
    const result = preparePrint(state);
    expect(result.issues).toEqual([]);
    const notes = result.fields.find((field) => field.key === "notes")!;
    expect(notes.lines.join("")).toBe(state.notesJa);
    expect(notes.lines.every((line) => !line.startsWith("\u3099"))).toBe(true);
    expect(notes.lines.every((line) => !/[\uD800-\uDBFF]$/.test(line))).toBe(
      true,
    );
  });

  it("fits every action symbol on at most two lines without printing attention as inspected", () => {
    const state = emptyPreview();
    state.answers["pdf-001"] = {
      result: "checked",
      actions: [
        "specific",
        "adjust",
        "tighten",
        "replace",
        "repair",
        "clean",
        "lubricate",
      ],
    };
    state.answers["pdf-002"] = { result: "attention", actions: ["repair"] };
    state.answers["pdf-003"] = { result: "notApplicable", actions: [] };
    const html = renderToStaticMarkup(createElement(OriginalForm, { state }));
    const doc = new DOMParser().parseFromString(html, "text/html");
    const first = doc.querySelector('[data-response-id="pdf-001"]')!;
    expect(first.textContent).toBe("○AT×△CL");
    expect(first.querySelectorAll("tspan")).toHaveLength(2);
    expect(
      Array.from(first.querySelectorAll("tspan")).every(
        (line) => Array.from(line.textContent ?? "").length <= 4,
      ),
    ).toBe(true);
    expect(doc.querySelector('[data-response-id="pdf-002"]')?.textContent).toBe(
      "",
    );
    expect(doc.querySelector('[data-response-id="pdf-003"]')?.textContent).toBe(
      "／",
    );
    expect(html).toContain("要確認 1");
    expect(html).toContain("未記入 97");
  });
});
