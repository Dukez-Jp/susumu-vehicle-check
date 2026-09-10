import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PdfPreview from "./PdfPreview";
import { LANGUAGE_STORAGE_KEY } from "../language";
import {
  emptyPreview,
  loadPreview,
  savePreview,
  STORAGE_KEY,
  updatePreviewAnswer,
} from "./state";

class ControllableImage {
  static created: ControllableImage[] = [];
  onload: ((event: Event) => unknown) | null = null;
  src = "";

  constructor() {
    ControllableImage.created.push(this);
  }
}

function loadOriginalImage() {
  act(() => {
    ControllableImage.created.forEach((image) =>
      image.onload?.(new Event("load")),
    );
  });
}

function firstResultGroup(language: "pt" | "ja" = "pt") {
  return within(
    screen.getByRole("group", {
      name: language === "ja" ? "項目 001" : "Item 001",
    }),
  );
}

function firstArticle() {
  return screen.getByRole("article", { name: "Condições de operação" });
}

function openServices() {
  const article = within(firstArticle());
  fireEvent.click(article.getByText("Serviços realizados"));
  return article;
}

describe("100-row PDF preview interaction", () => {
  // These suites read the Portuguese interface. The application itself opens
  // in Japanese; that default has its own test.
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "pt-BR");
    ControllableImage.created = [];
    vi.stubGlobal("Image", ControllableImage);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("changes the interface language without duplicating or changing the inspection answers", () => {
    render(<PdfPreview active onBack={vi.fn()} />);
    fireEvent.click(
      firstResultGroup().getByRole("button", { name: "Verificado" }),
    );
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(
      screen.getByRole("heading", { name: "Inspeção periódica" }),
    ).toBeInTheDocument();
    // The language control is a pair of flag buttons, not a dropdown.
    fireEvent.click(screen.getByRole("button", { name: /日本語/ }));
    expect(
      screen.getByRole("heading", { name: "定期点検" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Inspeção periódica" }),
    ).not.toBeInTheDocument();
    expect(
      firstResultGroup("ja").getByRole("button", { name: "点検済み" }),
    ).toHaveAttribute("aria-pressed", "true");
    const japaneseList = within(
      screen.getByRole("region", { name: "点検項目一覧" }),
    );
    expect(
      japaneseList.queryByText("Condições de operação"),
    ).not.toBeInTheDocument();
    expect(
      japaneseList.queryByRole("button", { name: "Verificado" }),
    ).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
    fireEvent.click(screen.getByRole("button", { name: /Português/ }));
    expect(
      firstResultGroup().getByRole("button", { name: "Verificado" }),
    ).toHaveAttribute("aria-pressed", "true");
    const portugueseList = within(
      screen.getByRole("region", { name: "Lista de inspeção" }),
    );
    expect(portugueseList.queryByText("操作具合")).not.toBeInTheDocument();
    expect(
      portugueseList.queryByRole("button", { name: "点検済み" }),
    ).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(raw);
  });

  it("keeps service work separate from results and clears it when the user selects not applicable", () => {
    render(<PdfPreview active onBack={vi.fn()} />);
    const article = openServices();
    fireEvent.click(article.getByRole("checkbox", { name: /Reparo/ }));
    expect(loadPreview(localStorage).state.answers["pdf-001"]).toEqual({
      result: "",
      actions: ["repair"],
    });
    expect(
      firstResultGroup().getByRole("button", { name: "Verificado" }),
    ).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(
      firstResultGroup().getByRole("button", { name: "Conferir" }),
    );
    fireEvent.click(article.getByRole("checkbox", { name: /Limpeza/ }));
    expect(loadPreview(localStorage).state.answers["pdf-001"]).toEqual({
      result: "attention",
      actions: ["repair", "clean"],
    });
    fireEvent.click(
      firstResultGroup().getByRole("button", { name: "Não se aplica" }),
    );
    expect(article.getByRole("checkbox", { name: /Reparo/ })).not.toBeChecked();
    expect(article.getByRole("checkbox", { name: /Reparo/ })).toBeDisabled();
    expect(loadPreview(localStorage).state.answers["pdf-001"]).toEqual({
      result: "notApplicable",
      actions: [],
    });
    fireEvent.click(
      firstResultGroup().getByRole("button", { name: "Conferir" }),
    );
    expect(article.getByRole("checkbox", { name: /Reparo/ })).toBeEnabled();
    expect(article.getByRole("checkbox", { name: /Reparo/ })).not.toBeChecked();
  });

  it("filters all 100 PDF rows without clearing hidden answers or inferring exemptions", () => {
    render(<PdfPreview active onBack={vi.fn()} />);
    const checklist = within(
      screen.getByRole("region", { name: "Lista de inspeção" }),
    );
    const period = checklist.getByRole("combobox", {
      name: "Mostrar periodicidade",
    });
    const search = checklist.getByRole("searchbox", {
      name: "Buscar item ou componente",
    });
    fireEvent.click(
      firstResultGroup().getByRole("button", { name: "Conferir" }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Todos os itens/ }));
    expect(checklist.getAllByRole("article")).toHaveLength(100);
    fireEvent.change(period, { target: { value: "3" } });
    expect(checklist.getAllByRole("article")).toHaveLength(51);
    expect(
      checklist.queryByRole("group", { name: "Item 001" }),
    ).not.toBeInTheDocument();
    fireEvent.change(period, { target: { value: "all" } });
    fireEvent.change(search, { target: { value: "001" } });
    expect(checklist.getAllByRole("article")).toHaveLength(1);
    expect(
      firstResultGroup().getByRole("button", { name: "Conferir" }),
    ).toHaveAttribute("aria-pressed", "true");
    const state = loadPreview(localStorage).state;
    expect(
      Object.values(state.answers).filter((answer) => answer.result !== ""),
    ).toHaveLength(1);
    expect(state.header.inspectionMonths).toBe("");
  }, 15_000);

  it("restores the preview on remount while leaving the legacy record bytes untouched", () => {
    localStorage.setItem("susumu.tenken.demo.v1", "legacy bytes preserved");
    const view = render(<PdfPreview active onBack={vi.fn()} />);
    fireEvent.click(
      firstResultGroup().getByRole("button", { name: "Conferir" }),
    );
    fireEvent.change(screen.getByLabelText("Observações em português"), {
      target: { value: "Conferir o volante." },
    });
    view.unmount();
    render(<PdfPreview active onBack={vi.fn()} />);
    expect(
      firstResultGroup().getByRole("button", { name: "Conferir" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Observações em português")).toHaveValue(
      "Conferir o volante.",
    );
    expect(localStorage.getItem("susumu.tenken.demo.v1")).toBe(
      "legacy bytes preserved",
    );
  });

  it("retains unsaved edits on quota failure and saves the same draft when retry succeeds", () => {
    render(<PdfPreview active onBack={vi.fn()} />);
    fireEvent.click(
      firstResultGroup().getByRole("button", { name: "Conferir" }),
    );
    const previous = localStorage.getItem(STORAGE_KEY);
    const quota = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Full", "QuotaExceededError");
      });
    fireEvent.change(screen.getByLabelText("Observações em português"), {
      target: { value: "Rascunho ainda em memória." },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Não salvo");
    expect(screen.getByLabelText("Observações em português")).toHaveValue(
      "Rascunho ainda em memória.",
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBe(previous);
    quota.mockRestore();
    fireEvent.click(
      screen.getByRole("button", { name: "Tentar salvar novamente" }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(loadPreview(localStorage).state.notesPt).toBe(
      "Rascunho ainda em memória.",
    );
    expect(loadPreview(localStorage).state.answers["pdf-001"].result).toBe(
      "attention",
    );
  });

  it("keeps edits in the screen and protects the other tab when a storage conflict occurs", () => {
    render(<PdfPreview active onBack={vi.fn()} />);
    const other = updatePreviewAnswer(emptyPreview(), "pdf-100", {
      result: "notApplicable",
    });
    const otherRaw = savePreview(localStorage, null, other);
    fireEvent.click(
      firstResultGroup().getByRole("button", { name: "Conferir" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("outra aba");
    expect(
      firstResultGroup().getByRole("button", { name: "Conferir" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.queryByRole("button", { name: "Tentar salvar novamente" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Baixar cópia do rascunho" }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(otherRaw);
  });

  it("does not replace or allow editing an unsupported stored preview", () => {
    localStorage.setItem(STORAGE_KEY, "{broken");
    render(<PdfPreview active onBack={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("preservados");
    expect(
      screen.queryByRole("group", { name: "Item 001" }),
    ).not.toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe("{broken");
  });

  it("waits for the original image and reviewed Japanese notes before printing the Japanese sample", () => {
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    render(<PdfPreview active onBack={vi.fn()} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Ver formulário em japonês" }),
    );
    expect(
      screen.getByRole("button", { name: "Imprimir modelo em japonês" }),
    ).toBeDisabled();
    loadOriginalImage();
    expect(
      screen.getByRole("button", { name: "Imprimir modelo em japonês" }),
    ).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Observações em português"), {
      target: { value: "Conferir o volante." },
    });
    expect(
      screen.getByRole("button", { name: "Imprimir modelo em japonês" }),
    ).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Texto japonês para impressão",
    );
    fireEvent.change(screen.getByLabelText("Texto japonês para impressão"), {
      target: { value: "ハンドルを確認。" },
    });
    expect(
      screen.getByRole("button", { name: "Imprimir modelo em japonês" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Conferi o texto japonês para impressão",
      }),
    );
    const printable = screen.getByRole("button", {
      name: "Imprimir modelo em japonês",
    });
    expect(printable).toBeEnabled();
    const form = screen.getByRole("region", {
      name: "Ver formulário em japonês",
    });
    expect(form).toHaveTextContent("ハンドルを確認。");
    expect(form).not.toHaveTextContent("Conferir o volante.");
    expect(form).toHaveTextContent("見本・未確定");
    fireEvent.click(printable);
    expect(print).toHaveBeenCalledOnce();
    fireEvent.change(screen.getByLabelText("Observações em português"), {
      target: { value: "Conferir também a caixa de direção." },
    });
    expect(
      screen.getByRole("checkbox", {
        name: "Conferi o texto japonês para impressão",
      }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: "Imprimir modelo em japonês" }),
    ).toBeDisabled();
    expect(loadPreview(localStorage).state.notesJa).toBe("ハンドルを確認。");
  });
});
