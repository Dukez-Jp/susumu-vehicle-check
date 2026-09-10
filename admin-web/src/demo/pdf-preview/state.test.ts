import { describe, expect, it, vi } from "vitest";
import source from "../../../../docs/source/tenken-20260910/catalogo_pdf_100_itens.json";
import {
  MAX_HEADER_LENGTH,
  MAX_NOTES_LENGTH,
  PreviewStorageError,
  STORAGE_KEY,
  TEMPLATE_ID,
  emptyPreview,
  loadPreview,
  printSymbols,
  savePreview,
  updatePreviewAnswer,
  type Action,
  type PreviewState,
} from "./state";

function storage(initial: string | null = null) {
  const values = new Map<string, string>();
  if (initial !== null) values.set(STORAGE_KEY, initial);
  return {
    values,
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
  };
}

function expectCode(action: () => unknown, code: string) {
  try {
    action();
    throw new Error("Expected preview operation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(PreviewStorageError);
    expect((error as PreviewStorageError).code).toBe(code);
  }
}

describe("PDF preview answer model", () => {
  it("starts all 100 source rows unanswered with an independent, versioned state", () => {
    const first = emptyPreview();
    const second = emptyPreview();
    expect(first.version).toBe(1);
    expect(first.templateId).toBe(TEMPLATE_ID);
    expect(Object.keys(first.answers)).toEqual(
      source.items.map((item) => item.id),
    );
    expect(Object.keys(first.answers)).toHaveLength(100);
    expect(
      Object.values(first.answers).every(
        (answer) => answer.result === "" && answer.actions.length === 0,
      ),
    ).toBe(true);
    expect(Object.values(first.header).every((value) => value === "")).toBe(
      true,
    );
    first.answers["pdf-001"].actions.push("repair");
    expect(first.answers["pdf-002"].actions).toEqual([]);
    expect(second.answers["pdf-001"].actions).toEqual([]);
    expect(first.notesPt).toBe("");
    expect(first.notesJa).toBe("");
    expect(first.notesJaReviewed).toBe(false);
    expect(first).not.toHaveProperty("language");
    expect(first).not.toHaveProperty("finalizedAt");
  });

  it("records maintenance without approving an unanswered or unresolved inspection", () => {
    const initial = emptyPreview();
    const actions: Action[] = ["repair"];
    const changed = updatePreviewAnswer(initial, "pdf-001", { actions });
    actions.push("clean");
    expect(changed.answers["pdf-001"]).toEqual({
      result: "",
      actions: ["repair"],
    });
    expect(initial.answers["pdf-001"]).toEqual({ result: "", actions: [] });
    expect(changed.answers["pdf-002"]).toBe(initial.answers["pdf-002"]);
    const pending = updatePreviewAnswer(changed, "pdf-001", {
      result: "attention",
    });
    const maintained = updatePreviewAnswer(pending, "pdf-001", {
      actions: ["replace"],
    });
    expect(maintained.answers["pdf-001"]).toEqual({
      result: "attention",
      actions: ["replace"],
    });
    expect(printSymbols(maintained.answers["pdf-001"])).toBe("");
  });

  it("clears incompatible actions on a manual not-applicable selection and never restores them", () => {
    const done = updatePreviewAnswer(emptyPreview(), "pdf-100", {
      result: "checked",
      actions: ["lubricate"],
    });
    const excluded = updatePreviewAnswer(done, "pdf-100", {
      result: "notApplicable",
    });
    expect(excluded.answers["pdf-100"]).toEqual({
      result: "notApplicable",
      actions: [],
    });
    const ignoredAction = updatePreviewAnswer(excluded, "pdf-100", {
      actions: ["repair"],
    });
    expect(ignoredAction.answers["pdf-100"].actions).toEqual([]);
    const reconsidered = updatePreviewAnswer(excluded, "pdf-100", {
      result: "attention",
    });
    expect(reconsidered.answers["pdf-100"]).toEqual({
      result: "attention",
      actions: [],
    });
    expect(done.answers["pdf-100"].actions).toEqual(["lubricate"]);
  });

  it("prints only explicitly completed results using the original PDF legend", () => {
    expect(printSymbols({ result: "checked", actions: [] })).toBe("V");
    expect(printSymbols({ result: "notApplicable", actions: [] })).toBe("／");
    const map: Record<Action, string> = {
      specific: "○",
      adjust: "A",
      tighten: "T",
      replace: "×",
      repair: "△",
      clean: "C",
      lubricate: "L",
    };
    for (const [action, symbol] of Object.entries(map)) {
      expect(
        printSymbols({ result: "checked", actions: [action as Action] }),
      ).toBe(symbol);
      expect(
        printSymbols({ result: "attention", actions: [action as Action] }),
      ).toBe("");
      expect(printSymbols({ result: "", actions: [action as Action] })).toBe(
        "",
      );
    }
    expect(
      printSymbols({
        result: "checked",
        actions: Object.keys(map) as Action[],
      }),
    ).toBe("○ A T × △ C L");
  });

  it("rejects unknown rows and unsupported or duplicated action changes", () => {
    const state = emptyPreview();
    expectCode(
      () => updatePreviewAnswer(state, "old-item-001", { result: "checked" }),
      "INVALID_PREVIEW",
    );
    expectCode(
      () => updatePreviewAnswer(state, "__proto__", { result: "checked" }),
      "INVALID_PREVIEW",
    );
    expectCode(
      () =>
        updatePreviewAnswer(state, "pdf-001", {
          actions: ["repair", "repair"],
        }),
      "INVALID_PREVIEW",
    );
    expectCode(
      () =>
        updatePreviewAnswer(state, "pdf-001", { result: "approved" as never }),
      "INVALID_PREVIEW",
    );
    expectCode(
      () =>
        updatePreviewAnswer(state, "pdf-001", { actions: ["wash" as never] }),
      "INVALID_PREVIEW",
    );
    expectCode(
      () =>
        updatePreviewAnswer(state, "pdf-001", {
          actions: new Array<Action>(1),
        }),
      "INVALID_PREVIEW",
    );
  });
});

describe("PDF preview storage", () => {
  it("uses only its own key and round-trips both note originals without persisting interface language", () => {
    const memory = storage();
    memory.values.set("susumu.tenken.demo.v1", "legacy inspection history");
    expect(loadPreview(memory)).toEqual({ state: emptyPreview(), raw: null });
    const next = updatePreviewAnswer(emptyPreview(), "pdf-042", {
      result: "checked",
      actions: ["adjust"],
    });
    next.header.registration = "DEMO-714";
    next.notesPt = "Exemplo para conferência.";
    next.notesJa = "確認用の記入例です。";
    next.notesJaReviewed = true;
    const raw = savePreview(memory, null, next);
    expect(loadPreview(memory)).toEqual({ state: next, raw });
    expect(memory.values.get("susumu.tenken.demo.v1")).toBe(
      "legacy inspection history",
    );
    expect(
      memory.getItem.mock.calls.every(([key]) => key === STORAGE_KEY),
    ).toBe(true);
    expect(memory.setItem).toHaveBeenCalledExactlyOnceWith(STORAGE_KEY, raw);
    expect(JSON.parse(raw)).not.toHaveProperty("language");
  });

  it("rejects stale tabs without replacing the newer saved draft", () => {
    const memory = storage();
    const first = savePreview(memory, null, emptyPreview());
    const next = updatePreviewAnswer(emptyPreview(), "pdf-001", {
      result: "attention",
    });
    const second = savePreview(memory, first, next);
    memory.setItem.mockClear();
    expectCode(
      () => savePreview(memory, first, emptyPreview()),
      "STORAGE_CONFLICT",
    );
    expect(memory.values.get(STORAGE_KEY)).toBe(second);
    expect(memory.setItem).not.toHaveBeenCalled();
  });

  it("detects a change immediately before writing", () => {
    const initial = JSON.stringify(emptyPreview());
    const other = JSON.stringify(
      updatePreviewAnswer(emptyPreview(), "pdf-001", { result: "attention" }),
    );
    const memory = storage(initial);
    memory.getItem.mockReturnValueOnce(initial).mockReturnValueOnce(other);
    expectCode(
      () => savePreview(memory, initial, emptyPreview()),
      "STORAGE_CONFLICT",
    );
    expect(memory.setItem).not.toHaveBeenCalled();
  });

  it("retains malformed, unsupported, or incomplete data instead of silently starting over", () => {
    const altered = (change: (value: Record<string, unknown>) => void) => {
      const value = JSON.parse(JSON.stringify(emptyPreview()));
      change(value);
      return JSON.stringify(value);
    };
    const invalids = [
      "",
      "{broken",
      "null",
      "[]",
      altered((value) => {
        value.version = 2;
      }),
      altered((value) => {
        value.templateId = "legacy-12-items";
      }),
      altered((value) => {
        value.language = "pt-BR";
      }),
      altered((value) => {
        delete (value.answers as Record<string, unknown>)["pdf-100"];
      }),
      altered((value) => {
        (value.answers as Record<string, unknown>)["pdf-101"] = {
          result: "",
          actions: [],
        };
      }),
      altered((value) => {
        (value.answers as Record<string, unknown>)["pdf-001"] = {
          result: "approved",
          actions: [],
        };
      }),
      altered((value) => {
        (value.answers as Record<string, unknown>)["pdf-001"] = {
          result: "notApplicable",
          actions: ["repair"],
        };
      }),
      altered((value) => {
        (value.answers as Record<string, unknown>)["pdf-001"] = {
          result: "checked",
          actions: ["repair", "repair"],
        };
      }),
      altered((value) => {
        (value.header as Record<string, unknown>).customer = 123;
      }),
      altered((value) => {
        (value.header as Record<string, unknown>).inspectionMonths = "6";
      }),
      altered((value) => {
        delete (value.header as Record<string, unknown>).co;
      }),
      altered((value) => {
        value.notesJaReviewed = "yes";
      }),
    ];
    for (const raw of invalids) {
      const memory = storage(raw);
      expectCode(() => loadPreview(memory), "CORRUPT_STORAGE");
      expectCode(
        () => savePreview(memory, raw, emptyPreview()),
        "CORRUPT_STORAGE",
      );
      expect(memory.values.get(STORAGE_KEY)).toBe(raw);
      expect(memory.setItem).not.toHaveBeenCalled();
    }
  });

  it("stores an explicitly selected form period without answering or exempting any row", () => {
    const memory = storage();
    let raw: string | null = null;
    for (const inspectionMonths of ["", "3", "12"]) {
      const next = emptyPreview();
      next.header.inspectionMonths = inspectionMonths;
      raw = savePreview(memory, raw, next);
      expect(loadPreview(memory).state.header.inspectionMonths).toBe(
        inspectionMonths,
      );
      expect(
        Object.values(loadPreview(memory).state.answers).every(
          (answer) => answer.result === "" && answer.actions.length === 0,
        ),
      ).toBe(true);
    }
    const invalid = emptyPreview();
    invalid.header.inspectionMonths = "6";
    expectCode(() => savePreview(memory, raw, invalid), "INVALID_PREVIEW");
  });

  it("enforces field and note bounds without trimming or silently losing text", () => {
    const memory = storage();
    const next = emptyPreview();
    next.header.customer = "名".repeat(MAX_HEADER_LENGTH);
    next.notesPt = "a".repeat(MAX_NOTES_LENGTH);
    next.notesJa = "記".repeat(MAX_NOTES_LENGTH);
    const raw = savePreview(memory, null, next);
    expect(loadPreview(memory).state).toEqual(next);
    for (const invalid of [
      {
        ...next,
        header: { ...next.header, customer: `${next.header.customer}名` },
      },
      { ...next, notesPt: `${next.notesPt}a` },
      { ...next, notesJa: `${next.notesJa}記` },
      { ...next, extra: "unknown" },
    ]) {
      expectCode(
        () => savePreview(memory, raw, invalid as PreviewState),
        "INVALID_PREVIEW",
      );
      expect(memory.values.get(STORAGE_KEY)).toBe(raw);
    }
  });

  it("reports read, quota and generic write failures while preserving the previous draft", () => {
    const memory = storage();
    const raw = savePreview(memory, null, emptyPreview());
    const denied = {
      getItem() {
        throw new DOMException("Denied", "SecurityError");
      },
    };
    expectCode(() => loadPreview(denied), "STORAGE_READ_FAILED");
    for (const [error, code] of [
      [
        new DOMException("Full", "QuotaExceededError"),
        "STORAGE_QUOTA_EXCEEDED",
      ],
      [new DOMException("Denied", "SecurityError"), "STORAGE_WRITE_FAILED"],
    ] as const) {
      const broken = {
        getItem: memory.getItem,
        setItem() {
          throw error;
        },
      };
      expectCode(() => savePreview(broken, raw, emptyPreview()), code);
      expect(memory.values.get(STORAGE_KEY)).toBe(raw);
    }
  });
});
