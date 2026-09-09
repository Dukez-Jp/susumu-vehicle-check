import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { InspectionReport } from "../pages/Inspections";
import type { Inspection } from "../types";

const inspection: Inspection = {
  id: "inspection-1",
  vehicleId: "vehicle-1",
  templateId: "snapshot-id",
  templateVersion: 7,
  deviceId: "device-1",
  odometerKm: 300,
  state: "Finalized",
  startedAt: "2026-09-09T10:00:00Z",
  finalizedAt: "2026-09-09T11:00:00Z",
  items: [
    {
      itemId: "item-1",
      status: "Critical",
      value: 0,
      notes: "Fissura na lateral",
      photoIds: ["missing-photo"],
    },
  ],
  notes: "Verificar antes de liberar",
  supersedesInspectionId: null,
  correctionReason: null,
  signaturePhotoId: null,
  version: 2,
  createdBy: "user-1",
  createdByName: "Inspetor de teste",
  receivedAt: "2026-09-09T11:03:00Z",
  photoUploadState: "Pending",
  photos: [],
};
describe("inspection report", () => {
  it("displays the stored status without remapping it to the configured answer options", () => {
    render(
      <MemoryRouter>
        <InspectionReport
          inspection={inspection}
          template={{
            id: "snapshot-id",
            name: "Freios",
            vehicleType: "Truck",
            version: 7,
            active: false,
            published: true,
            requiresSignature: false,
            sections: [
              {
                id: "section",
                title: "Eixos",
                items: [
                  {
                    id: "item-1",
                    label: "Disco",
                    responseType: "status",
                    required: true,
                    unit: null,
                    minValue: null,
                    maxValue: null,
                    allowedStatuses: ["OK"],
                  },
                ],
              },
            ],
          }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText("Crítico")).toBeInTheDocument();
    expect(screen.queryByText("OK")).not.toBeInTheDocument();
  });
  it("keeps a declared signature visible as pending even before its metadata arrives", () => {
    render(
      <MemoryRouter>
        <InspectionReport
          inspection={{
            ...inspection,
            items: [],
            signaturePhotoId: "signature-1",
            photoUploadState: "Pending",
          }}
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByText("Assinatura aguardando envio do tablet"),
    ).toBeInTheDocument();
    expect(screen.getByText("0 de 1 fotos")).toBeInTheDocument();
    expect(screen.getByText("Declarada pelo tablet")).toBeInTheDocument();
  });
  it("prints pending-photo status even for a finalized inspection and preserves exact template ID/version", () => {
    render(
      <MemoryRouter>
        <InspectionReport inspection={inspection} />
      </MemoryRouter>,
    );
    expect(screen.getByText("Finalizada")).toBeInTheDocument();
    expect(
      screen.getByText("Fotos pendentes de sincronização"),
    ).toBeInTheDocument();
    expect(screen.getByText("Aguardando envio do tablet")).toBeInTheDocument();
    expect(screen.getByText("snapshot-id")).toBeInTheDocument();
    expect(screen.getByText(/Versão 7/)).toBeInTheDocument();
    expect(screen.getByText("Crítico")).toBeInTheDocument();
    expect(screen.getByText("Fissura na lateral")).toBeInTheDocument();
    expect(
      screen.queryByText("Todas as fotos declaradas foram recebidas."),
    ).not.toBeInTheDocument();
  });
  it("never substitutes the current template name for an unavailable historical snapshot", () => {
    render(
      <MemoryRouter>
        <InspectionReport
          inspection={{
            ...inspection,
            supersedesInspectionId: "original-1",
            correctionReason: "Revisão visual",
          }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/versão exata do checklist/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Registro original/ }),
    ).toHaveAttribute("href", "/inspections/original-1");
  });
});
