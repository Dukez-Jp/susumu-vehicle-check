import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MeasurementStudio from "./MeasurementStudio";
import { LANGUAGE_STORAGE_KEY } from "../demo/language";
import { DRAFT_STORAGE_KEY, loadDraft, saveDraft } from "./draft";
import { activeReadings, createSession } from "./model";
import {
  DEMO_STORAGE_KEY,
  loadMeasurements,
  saveSession,
  STORAGE_KEY,
} from "./storage";
import { STORAGE_KEY as LEGACY_DEMO_KEY } from "../demo/model";
import { STORAGE_KEY as PREVIEW_KEY } from "../demo/pdf-preview/state";

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

function enterManual(value = "8,40") {
  fireEvent.change(screen.getByLabelText(/Valor medido \(mm\)/), {
    target: { value },
  });
  fireEvent.click(screen.getByRole("button", { name: "Registrar leitura" }));
}

/**
 * The workbench no longer pre-fills a sample plate, so a real measurement can
 * never be saved under a demonstration truck by accident. Every test that saves
 * identifies the vehicle first, exactly as a mechanic does.
 */
function identify(plate = "TEST-408") {
  fireEvent.change(screen.getByRole("textbox", { name: "Placa ou chassi" }), {
    target: { value: plate },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Responsável" }), {
    target: { value: "整備員・見本" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: /Quilometragem/ }), {
    target: { value: "182450" },
  });
}

function saveMeasurements() {
  fireEvent.click(screen.getByRole("button", { name: "Salvar medições" }));
}

function openHistory() {
  fireEvent.click(screen.getByRole("button", { name: /^Histórico\s*\d*$/ }));
}

describe("measurement workbench integration", () => {
  // These suites read the Portuguese interface. The application itself opens
  // in Japanese; that default has its own test.
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "pt-BR");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-10T04:00:00.000Z"));
    ControllableImage.created = [];
    vi.stubGlobal("Image", ControllableImage);
    vi.stubGlobal("isSecureContext", true);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("saves a manual reading with its vehicle and restores it in history after reload", () => {
    const first = render(<MeasurementStudio active onBack={vi.fn()} />);
    identify("TEST-408");
    enterManual();
    expect(
      screen.getByRole("textbox", { name: "Placa ou chassi" }),
    ).toBeDisabled();
    expect(loadDraft(localStorage).draft.readings[0]).toMatchObject({
      source: "manual",
      valueMm: 8.4,
      position: { axle: 1, side: "left", wheel: "single" },
    });
    saveMeasurements();
    const saved = loadMeasurements(localStorage);
    expect(saved.sessions).toHaveLength(1);
    expect(saved.sessions[0]).toMatchObject({
      registration: "TEST-408",
      vehicleKey: "TEST-408",
    });
    expect(saved.sessions[0].readings[0]).toMatchObject({
      source: "manual",
      valueMm: 8.4,
    });
    expect(loadDraft(localStorage).draft.readings).toHaveLength(0);
    first.unmount();
    render(<MeasurementStudio active onBack={vi.fn()} />);
    openHistory();
    fireEvent.click(
      within(
        screen.getByRole("region", { name: "Inspeções com medições" }),
      ).getByRole("button", { name: /TEST-408/ }),
    );
    expect(
      screen.getByRole("heading", { name: "TEST-408" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "8,40 mm" })).toBeInTheDocument();
    expect(loadMeasurements(localStorage)).toEqual(saved);
  });

  it("labels simulated readings as simulator and keeps unconfigured Bluetooth disabled", () => {
    const requestDevice = vi.fn();
    vi.stubGlobal("navigator", {
      bluetooth: { requestDevice },
      userActivation: { isActive: true },
    });
    render(<MeasurementStudio active onBack={vi.fn()} />);
    identify();
    fireEvent.click(screen.getByRole("button", { name: "Bluetooth" }));
    expect(
      screen.getByRole("button", { name: "Conectar instrumento" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Entrada manual" }),
    ).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Simulador" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Receber leitura de exemplo" }),
    );
    expect(screen.getByLabelText(/Valor medido \(mm\)/)).toHaveAttribute(
      "readonly",
    );
    expect(loadMeasurements(localStorage).sessions).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "Registrar leitura" }));
    saveMeasurements();
    // A rehearsal never enters the history of the truck whose plate was typed.
    expect(loadMeasurements(localStorage).sessions).toHaveLength(0);
    const reading = loadMeasurements(localStorage, "demo").sessions[0]
      .readings[0];
    expect(reading).toMatchObject({
      source: "simulator",
      deviceName: "Susumu Simulator",
    });
    expect(reading.source).not.toBe("bluetooth");
    expect(screen.getByRole("cell", { name: "Simulador" })).toBeInTheDocument();
    expect(requestDevice).not.toHaveBeenCalled();
  });

  it("discards a received sample when the operator selects another wheel", () => {
    render(<MeasurementStudio active onBack={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Simulador" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Receber leitura de exemplo" }),
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Eixo 1 · Direita · Simples",
      }),
    );
    expect(screen.getByLabelText(/Valor medido \(mm\)/)).toHaveValue("");
    expect(
      screen.getByRole("button", { name: "Registrar leitura" }),
    ).toBeDisabled();
    expect(loadDraft(localStorage).draft.readings).toHaveLength(0);
  });

  it("appends a correction while keeping the original reading and its provenance", () => {
    render(<MeasurementStudio active onBack={vi.fn()} />);
    identify();
    enterManual("8,40");
    saveMeasurements();
    const original = loadMeasurements(localStorage).sessions[0].readings[0];
    vi.setSystemTime(new Date("2026-09-10T04:01:00.000Z"));
    fireEvent.click(
      screen.getByRole("button", { name: /^Retificar Sulco do pneu/ }),
    );
    fireEvent.change(screen.getByLabelText(/Valor medido \(mm\)/), {
      target: { value: "8,10" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: "Motivo" }), {
      target: { value: "inputCorrection" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar retificação" }));
    const session = loadMeasurements(localStorage).sessions[0];
    expect(session.readings).toHaveLength(2);
    expect(session.readings[0]).toEqual(original);
    expect(session.readings[1]).toMatchObject({
      valueMm: 8.1,
      source: "manual",
      supersedesId: original.id,
      correctionReason: "inputCorrection",
    });
    expect(activeReadings(session)).toEqual([session.readings[1]]);
    expect(screen.getByRole("cell", { name: "8,10 mm" })).toBeInTheDocument();
    expect(screen.getByText("Histórico de retificações")).toBeInTheDocument();
  });

  it("switches Japanese and Portuguese without changing or duplicating the draft", () => {
    render(<MeasurementStudio active onBack={vi.fn()} />);
    identify();
    enterManual();
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    // The language control is a pair of flag buttons, not a dropdown.
    fireEvent.click(screen.getByRole("button", { name: /日本語/ }));
    expect(
      screen.getByRole("heading", { name: "一輪ずつ、測定を記録。" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Cada roda, uma medida." }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "手入力" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBe(raw);
    fireEvent.click(screen.getByRole("button", { name: /Português/ }));
    expect(
      screen.getByRole("heading", { name: "Cada roda, uma medida." }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBe(raw);
  });

  it("keeps an unsaved draft in memory after quota failure and retries without losing its reading", () => {
    render(<MeasurementStudio active onBack={vi.fn()} />);
    identify();
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("Full", "QuotaExceededError");
      });
    enterManual("7,25");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "As leituras continuam nesta tela",
    );
    expect(
      screen.getByRole("button", {
        name: /Sulco do pneu.*7,25 mm.*Entrada manual/,
      }),
    ).toBeInTheDocument();
    // The identity was stored before the quota failure; the reading was not.
    // It exists only on screen until the retry below succeeds.
    expect(loadDraft(localStorage).draft.readings).toHaveLength(0);
    setItem.mockRestore();
    fireEvent.click(
      within(screen.getByRole("alert")).getByRole("button", {
        name: "Salvar medições",
      }),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(loadDraft(localStorage).draft.readings[0]).toMatchObject({
      valueMm: 7.25,
      source: "manual",
    });
    saveMeasurements();
    expect(loadMeasurements(localStorage).sessions[0].readings[0].valueMm).toBe(
      7.25,
    );
  });

  it("preserves corrupt draft bytes and blocks capture instead of overwriting them", () => {
    const corrupt = "{corrupt-draft";
    localStorage.setItem(DRAFT_STORAGE_KEY, corrupt);
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    render(<MeasurementStudio active onBack={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "dados existentes foram preservados",
    );
    fireEvent.change(screen.getByLabelText(/Valor medido \(mm\)/), {
      target: { value: "3,00" },
    });
    expect(
      screen.getByRole("button", { name: "Registrar leitura" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Salvar medições" }),
    ).toBeDisabled();
    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBe(corrupt);
    expect(setItem).not.toHaveBeenCalled();
  });

  it("keeps corrupt historical records intact while allowing a recoverable draft", () => {
    const corrupt = "{corrupt-history";
    localStorage.setItem(STORAGE_KEY, corrupt);
    render(<MeasurementStudio active onBack={vi.fn()} />);
    identify();
    enterManual("5,90");
    expect(loadDraft(localStorage).draft.readings[0].valueMm).toBe(5.9);
    expect(
      screen.getByRole("button", { name: "Salvar medições" }),
    ).toBeDisabled();
    fireEvent.click(
      screen.getByRole("button", { name: "Atualizar histórico" }),
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBe(corrupt);
  });

  it("preserves another tab's draft and offers export instead of an impossible conflict retry", () => {
    render(<MeasurementStudio active onBack={vi.fn()} />);
    identify();
    enterManual("8,40");
    const loaded = loadDraft(localStorage);
    const otherTabRaw = saveDraft(localStorage, loaded.raw, {
      ...loaded.draft,
      operator: "別の担当者",
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Responsável" }), {
      target: { value: "担当者変更" },
    });
    const alert = within(screen.getByRole("alert"));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "O rascunho mudou em outra aba",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("antes de recarregar");
    expect(alert.getByRole("button", { name: "Baixar cópia" })).toBeEnabled();
    expect(
      alert.queryByRole("button", { name: "Salvar medições" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar medições" }),
    ).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Responsável" })).toHaveValue(
      "担当者変更",
    );
    expect(
      screen.getByRole("button", {
        name: /Sulco do pneu.*8,40 mm.*Entrada manual/,
      }),
    ).toBeInTheDocument();
    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBe(otherTabRaw);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("identifies a session already saved in another tab without duplicating or replacing it", () => {
    render(<MeasurementStudio active onBack={vi.fn()} />);
    identify();
    enterManual("8,40");
    const { draft, raw } = loadDraft(localStorage);
    const session = {
      ...createSession({
        registration: draft.registration,
        operator: draft.operator,
        inspectionDate: draft.inspectionDate,
        odometerKm: Number(draft.odometerInput),
        axleCount: draft.axleCount,
        wheelLayout: draft.wheelLayout,
        readings: draft.readings,
      }),
      id: draft.id,
    };
    saveSession(localStorage, session);
    const otherTabHistory = localStorage.getItem(STORAGE_KEY);
    saveMeasurements();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Esta inspeção já foi salva em outra aba",
    );
    expect(screen.getByRole("alert")).not.toHaveTextContent(
      "Confira placa ou chassi",
    );
    expect(
      within(screen.getByRole("alert")).getByRole("button", {
        name: "Baixar cópia",
      }),
    ).toBeEnabled();
    expect(localStorage.getItem(STORAGE_KEY)).toBe(otherTabHistory);
    expect(loadMeasurements(localStorage).sessions).toEqual([session]);
    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBe(raw);
  });

  it("keeps a pending session available when saving the history fails", () => {
    render(<MeasurementStudio active onBack={vi.fn()} />);
    identify();
    enterManual("6,35");
    const draftRaw = localStorage.getItem(DRAFT_STORAGE_KEY);
    const originalSetItem = Storage.prototype.setItem;
    const failure = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(function (this: Storage, key, value) {
        if (key === STORAGE_KEY)
          throw new DOMException("Full", "QuotaExceededError");
        originalSetItem.call(this, key, value);
      });
    saveMeasurements();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "As leituras continuam nesta tela",
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBe(draftRaw);
    failure.mockRestore();
    saveMeasurements();
    const sessions = loadMeasurements(localStorage).sessions;
    expect(sessions).toHaveLength(1);
    expect(sessions[0].readings[0].valueMm).toBe(6.35);
  });

  it("prints a Japanese measurement report that explicitly identifies simulation", () => {
    const { container } = render(<MeasurementStudio active onBack={vi.fn()} />);
    identify();
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole("button", { name: "Simulador" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Receber leitura de exemplo" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Registrar leitura" }));
    saveMeasurements();
    const raw = localStorage.getItem(DEMO_STORAGE_KEY);
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    fireEvent.click(
      screen.getByRole("button", { name: "Ver relatório japonês" }),
    );
    const report = container.querySelector(".measure-report-view article");
    expect(report).toHaveAttribute("lang", "ja");
    expect(report).toHaveTextContent("タイヤ・ブレーキ測定票");
    expect(report).toHaveTextContent("模擬測定を含む");
    expect(report).toHaveTextContent("模擬計測");
    expect(report).not.toHaveTextContent("Simulador");
    expect(report).not.toHaveTextContent("Entrada manual");
    expect(report).not.toHaveTextContent("Susumu Simulator");
    fireEvent.click(
      screen.getByRole("button", { name: "Imprimir relatório em japonês" }),
    );
    expect(print).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(DEMO_STORAGE_KEY)).toBe(raw);
  });

  it("opens a separate linked 100-item inspection without changing legacy records or auto-checking items", () => {
    const legacy = "legacy-demo-preserved";
    const preview = "standalone-preview-preserved";
    localStorage.setItem(LEGACY_DEMO_KEY, legacy);
    localStorage.setItem(PREVIEW_KEY, preview);
    render(<MeasurementStudio active onBack={vi.fn()} />);
    identify();
    enterManual("8,40");
    saveMeasurements();
    const measurementRaw = localStorage.getItem(STORAGE_KEY);
    fireEvent.click(
      screen.getByRole("button", { name: "Abrir Tenken de 100 itens" }),
    );
    loadOriginalImage();
    expect(
      screen.getByRole("heading", { name: "Inspeção periódica" }),
    ).toBeInTheDocument();
    const result = within(screen.getByRole("group", { name: "Item 001" }));
    expect(result.getByRole("button", { name: "Verificado" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    fireEvent.click(result.getByRole("button", { name: "Verificado" }));
    expect(result.getByRole("button", { name: "Verificado" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(localStorage.getItem(LEGACY_DEMO_KEY)).toBe(legacy);
    expect(localStorage.getItem(PREVIEW_KEY)).toBe(preview);
    expect(localStorage.getItem(STORAGE_KEY)).toBe(measurementRaw);
  });

  it("keeps the checklist answers independent for two inspections of the same truck", () => {
    render(<MeasurementStudio active onBack={vi.fn()} />);
    identify();
    enterManual("8,40");
    saveMeasurements();
    fireEvent.click(
      screen.getByRole("button", { name: "Abrir Tenken de 100 itens" }),
    );
    fireEvent.click(
      within(screen.getByRole("group", { name: "Item 001" })).getByRole(
        "button",
        { name: "Verificado" },
      ),
    );
    fireEvent.click(screen.getByRole("button", { name: /^Voltar / }));
    fireEvent.click(screen.getByRole("button", { name: "Medir" }));
    vi.setSystemTime(new Date("2026-09-11T04:00:00.000Z"));
    fireEvent.change(
      within(
        screen.getByRole("region", { name: "Identificação da medição" }),
      ).getByLabelText("Data da inspeção"),
      {
        target: { value: "2026-09-11" },
      },
    );
    enterManual("7,90");
    saveMeasurements();
    expect(loadMeasurements(localStorage).sessions).toHaveLength(2);
    fireEvent.click(
      screen.getByRole("button", { name: "Abrir Tenken de 100 itens" }),
    );
    expect(
      within(screen.getByRole("group", { name: "Item 001" })).getByRole(
        "button",
        { name: "Verificado" },
      ),
    ).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(screen.getByRole("button", { name: /^Voltar / }));
    fireEvent.click(
      within(
        screen.getByRole("region", { name: "Inspeções com medições" }),
      ).getByRole("button", { name: /2026-09-10/ }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Abrir Tenken de 100 itens" }),
    );
    expect(
      within(screen.getByRole("group", { name: "Item 001" })).getByRole(
        "button",
        { name: "Verificado" },
      ),
    ).toHaveAttribute("aria-pressed", "true");
  }, 15000);

  it("records four axles with two single and two dual-wheel axles without inventing extra tires", () => {
    const { container } = render(<MeasurementStudio active onBack={vi.fn()} />);
    identify();
    fireEvent.change(
      screen.getByRole("combobox", { name: "Número de eixos" }),
      { target: { value: "4" } },
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "Rodas do eixo 2" }),
      { target: { value: "single" } },
    );
    expect(container.querySelectorAll(".measure-wheel")).toHaveLength(12);
    expect(
      screen.getByRole("button", {
        name: "Eixo 2 · Esquerda · Simples",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: "Eixo 2 · Esquerda · Interno",
      }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", {
        name: "Eixo 4 · Direita · Externo",
      }),
    );
    enterManual("9,25");
    expect(
      screen.getByRole("combobox", { name: "Rodas do eixo 2" }),
    ).toBeDisabled();
    saveMeasurements();
    const session = loadMeasurements(localStorage).sessions[0];
    expect(session.wheelLayout).toEqual(["single", "single", "dual", "dual"]);
    expect(session.readings[0].position).toEqual({
      axle: 4,
      side: "right",
      wheel: "outer",
    });
  });

  it("selects a real tire position when switching back from brakes on a dual front axle", () => {
    render(<MeasurementStudio active onBack={vi.fn()} />);
    identify();
    fireEvent.change(
      screen.getByRole("combobox", { name: "Rodas do eixo 1" }),
      { target: { value: "dual" } },
    );
    fireEvent.click(
      screen.getByRole("button", {
        name: "Espessura da pastilha",
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Sulco do pneu" }));
    expect(
      screen.getByRole("button", {
        name: "Eixo 1 · Esquerda · Interno",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    enterManual("8,60");
    expect(loadDraft(localStorage).draft.readings[0].position).toEqual({
      axle: 1,
      side: "left",
      wheel: "inner",
    });
  });
});
