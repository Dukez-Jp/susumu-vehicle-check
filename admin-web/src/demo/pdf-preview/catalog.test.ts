import { describe, expect, it } from "vitest";
import source from "../../../../docs/source/tenken-20260910/catalogo_pdf_100_itens.json";
import { footnotes, itemTranslations, sections } from "./translations";

describe("PDF preview catalogue coverage", () => {
  it("covers each of the 100 original response rows once, in source order", () => {
    const expectedIds = Array.from(
      { length: 100 },
      (_, index) => `pdf-${String(index + 1).padStart(3, "0")}`,
    );
    expect(source.itemCount).toBe(100);
    expect(source.items.map((item) => item.id)).toEqual(expectedIds);
    expect(Object.keys(itemTranslations)).toEqual(expectedIds);
    expect(
      new Set(source.items.map((item) => item.responseBoxPt.join(","))).size,
    ).toBe(100);
    expect(
      [1, 2, 3, 4].map(
        (column) =>
          source.items.filter((item) => item.column === column).length,
      ),
    ).toEqual([25, 25, 23, 27]);
  });

  it("assigns every row to a populated navigation group without reordering the PDF", () => {
    const sectionIds = sections.map((section) => section.id);
    expect(new Set(sectionIds).size).toBe(sections.length);
    for (const section of sections) {
      expect(section.ja.trim()).not.toBe("");
      expect(section.pt.trim()).not.toBe("");
      expect(
        Object.values(itemTranslations).some(
          (item) => item.sectionId === section.id,
        ),
      ).toBe(true);
    }
    const sourceSectionOrder = source.items.map((item) => {
      const sectionIndex = sectionIds.indexOf(
        itemTranslations[item.id].sectionId,
      );
      expect(sectionIndex).toBeGreaterThanOrEqual(0);
      return sectionIndex;
    });
    expect(sourceSectionOrder).toEqual(
      [...sourceSectionOrder].sort((left, right) => left - right),
    );
  });

  it("preserves the printed 51 shaded and 49 white cells and their periods", () => {
    const shaded = source.items.filter(
      (item) => item.responseCellStyle === "gray",
    );
    const white = source.items.filter(
      (item) => item.responseCellStyle === "white",
    );
    expect(shaded).toHaveLength(51);
    expect(white).toHaveLength(49);
    for (const item of shaded) {
      expect(item.periodsMonthsFromPrintedLegend).toEqual([3, 12]);
    }
    for (const item of white) {
      expect(item.periodsMonthsFromPrintedLegend).toEqual([12]);
    }
  });

  it("retains all application note references from Japanese source text", () => {
    expect(Object.keys(footnotes).sort()).toEqual(["※1", "※2", "※3"]);
    const referencedNotes = new Set<string>();
    for (const item of source.items) {
      const textReferences = [...new Set(item.itemJa.match(/※\d+/g) ?? [])];
      expect(item.footnoteRefs).toEqual(textReferences);
      for (const noteRef of item.footnoteRefs) {
        referencedNotes.add(noteRef);
        expect(footnotes[noteRef].ja.trim()).not.toBe("");
        expect(footnotes[noteRef].pt.trim()).not.toBe("");
      }
    }
    expect([...referencedNotes].sort()).toEqual(Object.keys(footnotes).sort());
  });

  it("provides Portuguese text for every row, group and note without Japanese text", () => {
    const japaneseText =
      /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u;
    const portugueseTexts = [
      ...Object.values(itemTranslations).flatMap((item) => [
        item.component,
        item.label,
      ]),
      ...sections.map((section) => section.pt),
      ...Object.values(footnotes).map((note) => note.pt),
    ];
    for (const text of portugueseTexts) {
      expect(text.trim()).not.toBe("");
      expect(text).not.toMatch(japaneseText);
    }
    for (const item of Object.values(itemTranslations)) {
      expect(item.label).not.toMatch(/※\d/);
    }
  });
});
