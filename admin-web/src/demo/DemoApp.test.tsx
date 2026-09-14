import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DemoApp from "./DemoApp";
import { STORAGE_KEY, items, newInspection, saveState } from "./model";
import { LANGUAGE_STORAGE_KEY } from "./language";

describe("Tenken browser demonstration", () => {
  // These suites read the Portuguese interface. The application itself opens
  // in Japanese; that default has its own test.
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "pt-BR");
  });
  afterEach(() => vi.restoreAllMocks());
  it("rejects a file above 1 MB before reading or changing the draft", () => {
    render(<DemoApp />);
    fireEvent.click(screen.getByRole("button", { name: /Inspecionar 714/ }));
    fireEvent.click(screen.getByRole("button", { name: "Iniciar Tenken" }));
    const saved = localStorage.getItem(STORAGE_KEY);
    fireEvent.change(screen.getByLabelText("Adicionar foto"), {
      target: {
        files: [
          new File([new Uint8Array(1024 * 1024 + 1)], "large.png", {
            type: "image/png",
          }),
        ],
      },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("até 1 MB");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
  });
  it("preserves corrupt stored data without silently resetting", () => {
    localStorage.setItem(STORAGE_KEY, "{broken");
    render(<DemoApp />);
    expect(screen.getByRole("alert")).toHaveTextContent("preservados");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("{broken");
  });
  it("shows a recovery message for an unknown stored vehicle", () => {
    const i = newInspection("v-714", 182450, "Teste");
    i.vehicleId = "unknown";
    saveState(localStorage, { version: 1, inspections: [i] });
    render(<DemoApp />);
    expect(screen.getByRole("alert")).toHaveTextContent("preservados");
  });
  it("retains the existing draft when a photo exceeds the demo capacity", () => {
    render(<DemoApp />);
    fireEvent.click(screen.getByRole("button", { name: /Inspecionar 714/ }));
    fireEvent.click(screen.getByRole("button", { name: "Iniciar Tenken" }));
    const failure = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });
    fireEvent.click(
      screen.getByRole("button", { name: "Usar imagem de teste" }),
    );
    expect(screen.queryByText("Original preservado")).not.toBeInTheDocument();
    failure.mockRestore();
  });
  it("keeps edits visible when storage fails and can save them on retry", () => {
    render(<DemoApp />);
    fireEvent.click(screen.getByRole("button", { name: /Inspecionar 714/ }));
    fireEvent.click(screen.getByRole("button", { name: "Iniciar Tenken" }));
    const failure = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });
    fireEvent.change(screen.getByLabelText("Observação do item"), {
      target: { value: "Trabalho ainda em memória" },
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Não salvo");
    expect(screen.getByLabelText("Observação do item")).toHaveValue(
      "Trabalho ainda em memória",
    );
    failure.mockRestore();
    fireEvent.click(
      screen.getByRole("button", { name: "Tentar salvar novamente" }),
    );
    expect(localStorage.getItem(STORAGE_KEY)).toContain(
      "Trabalho ainda em memória",
    );
  });
  it("does not finalize in memory if the final save fails", () => {
    const i = newInspection("v-714", 182450, "Teste");
    items.forEach((it) => {
      i.answers[it.id] = {
        status: "OK",
        value: it.unit ? "5" : "",
        notes: "",
        photos: [],
      };
    });
    i.signature = "data:image/png;base64,QUJDRA==";
    saveState(localStorage, { version: 1, inspections: [i] });
    render(<DemoApp />);
    fireEvent.click(screen.getByRole("button", { name: /Continuar 714/ }));
    fireEvent.click(screen.getByRole("button", { name: "Revisar inspeção" }));
    const failure = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });
    fireEvent.click(screen.getByRole("button", { name: "Finalizar registro" }));
    failure.mockRestore();
    fireEvent.click(
      screen.getByRole("button", { name: "Tentar salvar novamente" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Finalizar registro" }));
    expect(screen.getByText("Registro finalizado")).toBeInTheDocument();
  });
  it("does not overwrite a save made in another tab", () => {
    render(<DemoApp />);
    fireEvent.click(screen.getByRole("button", { name: /Inspecionar 714/ }));
    fireEvent.click(screen.getByRole("button", { name: "Iniciar Tenken" }));
    const other = newInspection("v-208", 96310, "Outra aba");
    saveState(localStorage, { version: 1, inspections: [other] });
    const saved = localStorage.getItem(STORAGE_KEY);
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.getByRole("alert")).toHaveTextContent("outra aba");
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
  });
  it("opens a synthetic vehicle and does not prefill OK answers", () => {
    render(<DemoApp />);
    fireEvent.click(screen.getByRole("button", { name: /Inspecionar 714/ }));
    fireEvent.click(screen.getByRole("button", { name: "Iniciar Tenken" }));
    expect(screen.getByText("0 de 12 respondidos")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "OK" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    fireEvent.click(screen.getByRole("button", { name: "Crítico" }));
    expect(screen.getByText("1 de 12 respondidos")).toBeInTheDocument();
    expect(
      screen.getByText(/Comunique a ocorrência ao responsável/),
    ).toBeInTheDocument();
  });
  it("runs the same inspection from Oficina 2 without the transition API", () => {
    // A segunda oficina existe so para experimentar as transicoes. Ela precisa
    // abrir exatamente a mesma inspecao — e o navegador de teste nao tem
    // startViewTransition, que e justamente o caminho de quem nao tem a API.
    expect(
      (document as Document & { startViewTransition?: unknown })
        .startViewTransition,
    ).toBeUndefined();
    render(<DemoApp />);
    fireEvent.click(screen.getByRole("button", { name: /Minha oficina 2/ }));
    expect(screen.getByText("Oficina 2 · transições")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Inspecionar 714/ }));
    fireEvent.click(screen.getByRole("button", { name: "Iniciar Tenken" }));
    expect(screen.getByText("0 de 12 respondidos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(screen.getByText("1 de 12 respondidos")).toBeInTheDocument();
    // A volta reconhece de onde a inspecao saiu.
    fireEvent.click(screen.getByRole("button", { name: /Voltar à oficina/ }));
    expect(screen.getByText("Oficina 2 · transições")).toBeInTheDocument();
  });
  it("restores the draft after a page remount", () => {
    const view = render(<DemoApp />);
    fireEvent.click(screen.getByRole("button", { name: /Inspecionar 714/ }));
    fireEvent.click(screen.getByRole("button", { name: "Iniciar Tenken" }));
    fireEvent.click(screen.getByRole("button", { name: "Atenção" }));
    fireEvent.change(screen.getByLabelText("Observação do item"), {
      target: { value: "Risco no para-choque" },
    });
    view.unmount();
    render(<DemoApp />);
    fireEvent.click(screen.getByRole("button", { name: /Continuar 714/ }));
    expect(screen.getByLabelText("Observação do item")).toHaveValue(
      "Risco no para-choque",
    );
    expect(screen.getByRole("button", { name: "Atenção" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
  it("blocks finalization with unanswered items and missing signature", () => {
    render(<DemoApp />);
    fireEvent.click(screen.getByRole("button", { name: /Inspecionar 714/ }));
    fireEvent.click(screen.getByRole("button", { name: "Iniciar Tenken" }));
    fireEvent.click(screen.getByRole("button", { name: "Revisar inspeção" }));
    expect(
      screen.getByRole("button", { name: "Finalizar registro" }),
    ).toBeDisabled();
    expect(
      screen.getByText(/Finalizar não libera o veículo/),
    ).toBeInTheDocument();
  });
  it("opens in Japanese and lets a mechanic switch to Portuguese by flag", () => {
    // The workshop is in Japan, so no stored choice means Japanese.
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);
    const first = render(<DemoApp />);
    expect(
      screen.getByRole("heading", { name: "点検を始めましょう" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Vamos começar o Tenken?" }),
    ).not.toBeInTheDocument();
    expect(document.documentElement.lang).toBe("ja");
    // Each flag names its own language, so it reads right to whoever looks.
    expect(
      screen.getByRole("button", { name: "日本語" }),
    ).toHaveAttribute("aria-pressed", "true");
    // The narrow layout hides the written name next to the flag, so the name
    // has to survive on the button itself or the control becomes unlabelled.
    for (const name of ["日本語", "Português"]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute(
        "aria-label",
        name,
      );
    }

    fireEvent.click(screen.getByRole("button", { name: "Português" }));
    expect(
      screen.getByRole("heading", { name: "Vamos começar o Tenken?" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "点検を始めましょう" }),
    ).not.toBeInTheDocument();
    expect(document.documentElement.lang).toBe("pt-BR");

    // The choice survives a reload; the mechanic sets it once.
    first.unmount();
    render(<DemoApp />);
    expect(
      screen.getByRole("heading", { name: "Vamos começar o Tenken?" }),
    ).toBeInTheDocument();
  });

  it("shows the Japanese checklist and its validation without any Portuguese", () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "ja");
    render(<DemoApp />);
    fireEvent.click(screen.getByRole("button", { name: /点検する車両 714/ }));
    fireEvent.click(screen.getByRole("button", { name: "点検を開始" }));
    expect(
      screen.getByRole("heading", { name: "前照灯・車幅灯・方向指示器" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "要整備" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "点検内容を確認" }));
    const pending = screen.getByRole("list");
    expect(pending).toHaveTextContent("外回り › 前照灯・車幅灯・方向指示器");
    expect(pending).toHaveTextContent("この見本では署名が必須です");
    expect(pending).not.toHaveTextContent("Exterior");
    expect(
      screen.getByRole("button", { name: "記録を確定" }),
    ).toBeDisabled();
  });

  it("keeps a record readable in the language chosen when it is opened", () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "pt-BR");
    render(<DemoApp />);
    fireEvent.click(screen.getByRole("button", { name: /Inspecionar 714/ }));
    fireEvent.click(screen.getByRole("button", { name: "Iniciar Tenken" }));
    const saved = localStorage.getItem(STORAGE_KEY);
    fireEvent.click(screen.getByRole("button", { name: "日本語" }));
    // The same draft, now read in Japanese. Switching language stores nothing.
    expect(
      screen.getByRole("heading", { name: "前照灯・車幅灯・方向指示器" }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(saved);
  });
});
