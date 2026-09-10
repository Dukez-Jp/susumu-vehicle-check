import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VehicleCapture from "./VehicleCapture";
import { STORAGE_KEY } from "./repository";
import { LANGUAGE_STORAGE_KEY } from "../demo/language";
import sample from "./fixtures/sample02.json";

function fillManual() {
  fireEvent.change(screen.getByLabelText("Placa *"), {
    target: { value: "TESTE-123" },
  });
  fireEvent.change(screen.getByLabelText("Chassi *"), {
    target: { value: "TEST-CHASSIS-123" },
  });
}
function reviewAndSave() {
  fireEvent.click(screen.getByRole("checkbox"));
  fireEvent.click(
    screen.getByRole("button", { name: "Salvar coleta conferida" }),
  );
}
function fileWithText(text: string) {
  const file = new File([text], "certificado.json", {
    type: "application/json",
  });
  Object.defineProperty(file, "text", {
    value: vi.fn().mockResolvedValue(text),
  });
  return file;
}
function upload(file: File) {
  fireEvent.click(screen.getByRole("button", { name: "Importar arquivo" }));
  fireEvent.change(screen.getByLabelText("Selecionar JSON do certificado"), {
    target: { files: [file] },
  });
}

describe("optional local vehicle capture", () => {
  // These suites read the Portuguese interface. The application itself opens
  // in Japanese; that default has its own test.
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "pt-BR");
  });
  afterEach(() => vi.restoreAllMocks());

  it("requires human review, saves manual data and preserves inspection storage", () => {
    localStorage.setItem("susumu.tenken.demo.v1", "existing-inspection-bytes");
    render(<VehicleCapture active onBack={() => {}} />);
    fillManual();
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar coleta conferida" }),
    );
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(
      "marque a confirmação",
    );
    reviewAndSave();
    expect(screen.getByRole("status")).toHaveTextContent("Coleta salva");
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEY)!).records[0].source,
    ).toBe("manual");
    expect(localStorage.getItem("susumu.tenken.demo.v1")).toBe(
      "existing-inspection-bytes",
    );
  });

  it("shows one language at a time without changing data or review", () => {
    render(<VehicleCapture active onBack={() => {}} />);
    fillManual();
    fireEvent.click(screen.getByRole("checkbox"));
    // The language control is a pair of flag buttons, not a dropdown.
    fireEvent.click(screen.getByRole("button", { name: /日本語/ }));
    expect(
      screen.getByRole("heading", { name: /車両情報の収集/ }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Dados do caminhão")).not.toBeInTheDocument();
    expect(screen.getByLabelText("車台番号 *")).toHaveValue("TEST-CHASSIS-123");
    expect(screen.getByRole("checkbox")).toBeChecked();
    fireEvent.click(
      screen.getByRole("button", { name: "確認済みデータを保存" }),
    );
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).records).toHaveLength(
      1,
    );
  });

  it("imports the official truck sample for review without inventing current mileage", async () => {
    render(<VehicleCapture active onBack={() => {}} />);
    upload(fileWithText(JSON.stringify(sample)));
    await waitFor(() =>
      expect(screen.getByLabelText("Chassi *")).not.toHaveValue(""),
    );
    expect(screen.getByLabelText("Quilometragem atual (km)")).toHaveValue("");
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    reviewAndSave();
    const record = JSON.parse(localStorage.getItem(STORAGE_KEY)!).records[0];
    expect(record.source).toBe("mlit-json");
    expect(record.originalFields.CarNo).toBe(sample.CertInfo.CarNo);
    expect(record.originalFields).not.toHaveProperty("OwnerAddress");
  });

  it("preserves manual edits while a replacement file awaits explicit selection", async () => {
    render(<VehicleCapture active onBack={() => {}} />);
    fillManual();
    upload(fileWithText(JSON.stringify(sample)));
    await screen.findByRole("region", {
      name: "Arquivo pronto para conferência",
    });
    expect(screen.getByLabelText("Placa *")).toHaveValue("TESTE-123");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByLabelText("Chassi *")).toHaveValue("TEST-CHASSIS-123");
  });

  it("keeps the available original year and month visible when the era is missing", async () => {
    render(<VehicleCapture active onBack={() => {}} />);
    upload(
      fileWithText(
        JSON.stringify({
          ...sample,
          CertInfo: { ...sample.CertInfo, FirstregistdateE: "" },
        }),
      ),
    );
    await screen.findByText(/Primeiro registro: confira o valor original/);
    expect(screen.getByLabelText("Primeiro registro")).toHaveValue("");
    fireEvent.click(screen.getByText("Valores originais do arquivo"));
    expect(screen.getByText("5 1")).toBeVisible();
  });

  it("rejects malformed and oversized files without replacing the draft", async () => {
    render(<VehicleCapture active onBack={() => {}} />);
    fillManual();
    upload(fileWithText("{broken"));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("Placa *")).toHaveValue("TESTE-123");
    const large = fileWithText("unused");
    Object.defineProperty(large, "size", { value: 1024 * 1024 + 1 });
    upload(large);
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("até 1 MB"),
    );
    expect(large.text).not.toHaveBeenCalled();
  });

  it("retains entered data after quota failure and saves on retry", () => {
    render(<VehicleCapture active onBack={() => {}} />);
    fillManual();
    const failure = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("full", "QuotaExceededError");
      });
    reviewAndSave();
    expect(screen.getByRole("alert")).toHaveTextContent("sem espaço");
    expect(screen.getByLabelText("Chassi *")).toHaveValue("TEST-CHASSIS-123");
    expect(
      screen.queryByText("Coleta salva neste navegador."),
    ).not.toBeInTheDocument();
    failure.mockRestore();
    fireEvent.click(
      screen.getByRole("button", { name: "Salvar coleta conferida" }),
    );
    expect(screen.getByRole("status")).toHaveTextContent("Coleta salva");
  });

  it("restores saved captures and refuses to overwrite corrupt local data", () => {
    const view = render(<VehicleCapture active onBack={() => {}} />);
    fillManual();
    reviewAndSave();
    view.unmount();
    const next = render(<VehicleCapture active onBack={() => {}} />);
    expect(screen.getByRole("cell", { name: "TESTE-123" })).toBeInTheDocument();
    next.unmount();
    localStorage.setItem(STORAGE_KEY, "{broken");
    render(<VehicleCapture active onBack={() => {}} />);
    expect(screen.getByRole("alert")).toHaveTextContent("preservados");
    expect(localStorage.getItem(STORAGE_KEY)).toBe("{broken");
  });

  it("keeps manual capture available alongside honest NFC status", () => {
    render(<VehicleCapture active onBack={() => {}} />);
    fireEvent.click(
      screen.getByRole("button", { name: "NFC pelo aplicativo" }),
    );
    expect(
      screen.getByText("Leitura pelo aplicativo Android"),
    ).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Digitar manualmente" }),
    );
    fillManual();
    reviewAndSave();
    expect(screen.getByRole("status")).toHaveTextContent("Coleta salva");
  });

  it("requires a new review after editing and keeps unsaved fields across navigation", () => {
    const view = render(<VehicleCapture active onBack={() => {}} />);
    fillManual();
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.change(screen.getByLabelText("Modelo"), {
      target: { value: "TEST-MODEL" },
    });
    expect(screen.getByRole("checkbox")).not.toBeChecked();
    view.rerender(<VehicleCapture active={false} onBack={() => {}} />);
    view.rerender(<VehicleCapture active onBack={() => {}} />);
    expect(screen.getByLabelText("Modelo")).toHaveValue("TEST-MODEL");
  });
});
