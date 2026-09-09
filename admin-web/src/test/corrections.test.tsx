import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "../api";
import { SessionProvider, useSession } from "../auth";
import { InspectionDetail } from "../pages/Inspections";
import Login from "../pages/Login";
import { LoadMore, usePaged } from "../pagination";
import type { Inspection } from "../types";

const original: Inspection = {
  id: "original-inspection",
  vehicleId: "vehicle-1",
  templateId: "template-1",
  templateVersion: 1,
  deviceId: "tablet-1",
  odometerKm: 120000,
  state: "Finalized",
  startedAt: "2026-01-01T09:00:00Z",
  finalizedAt: "2026-01-01T10:00:00Z",
  items: [
    { itemId: "item-1", status: "OK", value: null, notes: "", photoIds: [] },
  ],
  notes: "",
  supersedesInspectionId: null,
  correctionReason: null,
  signaturePhotoId: null,
  version: 1,
  createdBy: "inspector-1",
  createdByName: "Inspetor",
  receivedAt: "2026-01-01T10:00:00Z",
  photoUploadState: "Complete",
  photos: [],
};
const correction: Inspection = {
  ...original,
  id: "old-correction",
  supersedesInspectionId: original.id,
  correctionReason: "Revisão visual",
  startedAt: "2026-01-02T09:00:00Z",
};
function AuthenticatedReport() {
  const { session } = useSession();
  return session ? <InspectionDetail /> : <Login />;
}
function setupReport(correctionsStatus = 200, correctionCount = 1) {
  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), "http://localhost");
    let data: unknown;
    if (url.pathname.endsWith("/auth/login"))
      data = {
        accessToken: "test-token",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        offlineUntil: "",
        user: {
          id: "office-1",
          name: "Escritório",
          username: "office",
          role: "Office",
          companyId: "company-1",
          locationId: "location-1",
          active: true,
        },
      };
    else if (url.pathname.endsWith(`/inspections/${original.id}`))
      data = original;
    else if (url.pathname.endsWith("/vehicles/vehicle-1"))
      data = {
        id: "vehicle-1",
        internalNumber: "714",
        plate: "TEST",
        type: "Truck",
        companyId: "company-1",
        locationId: "location-1",
        currentOdometerKm: 120000,
        active: true,
      };
    else if (url.pathname.endsWith("/templates"))
      data = [
        {
          id: "template-1",
          name: "Checklist",
          vehicleType: "Truck",
          version: 1,
          published: true,
          active: true,
          requiresSignature: false,
          sections: [
            {
              id: "section-1",
              title: "Estrutura",
              items: [
                {
                  id: "item-1",
                  label: "Chassi",
                  responseType: "status",
                  required: true,
                  unit: null,
                  minValue: null,
                  maxValue: null,
                },
              ],
            },
          ],
        },
      ];
    else if (
      url.pathname.endsWith("/inspections") &&
      url.searchParams.get("supersedesInspectionId") === original.id
    ) {
      if (correctionsStatus !== 200)
        return new Response(JSON.stringify({ detail: "Falha de consulta" }), {
          status: correctionsStatus,
        });
      const offset = Number(url.searchParams.get("offset") || "0");
      data = Array.from({ length: correctionCount }, (_, index) => ({
        ...correction,
        id: index === 0 ? correction.id : `correction-${index}`,
      })).slice(offset, offset + 100);
    } else if (url.pathname.endsWith("/inspections")) {
      // More recent vehicle history deliberately excludes the old correction.
      data = Array.from({ length: 100 }, (_, index) => ({
        ...original,
        id: `newer-${index}`,
        startedAt: "2026-09-01T09:00:00Z",
      }));
    } else return new Response("{}", { status: 404 });
    return new Response(JSON.stringify(data), { status: 200 });
  });
  render(
    <SessionProvider client={new ApiClient(fetcher as typeof fetch)}>
      <MemoryRouter initialEntries={[`/inspections/${original.id}`]}>
        <Routes>
          <Route path="/inspections/:id" element={<AuthenticatedReport />} />
        </Routes>
      </MemoryRouter>
    </SessionProvider>,
  );
  fireEvent.change(screen.getByLabelText("Usuário"), {
    target: { value: "office" },
  });
  fireEvent.change(screen.getByLabelText("Senha"), {
    target: { value: "test-only-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  return fetcher;
}
describe("correction discovery", () => {
  it("warns an Office reader about a correction outside the newest hundred vehicle records", async () => {
    const fetcher = setupReport();
    expect(
      await screen.findByText(/Esta inspeção possui correções registradas/),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link")
        .some(
          (link) => link.getAttribute("href") === "/inspections/old-correction",
        ),
    ).toBe(true);
    expect(
      fetcher.mock.calls.some(([url]) =>
        String(url).includes("supersedesInspectionId=original-inspection"),
      ),
    ).toBe(true);
    expect(
      fetcher.mock.calls.some(([url]) =>
        String(url).includes("vehicleId=vehicle-1"),
      ),
    ).toBe(false);
  });
  it("makes an unavailable correction check visible instead of implying the report has no revisions", async () => {
    setupReport(403);
    expect(
      await screen.findByText(
        /Não foi possível verificar correções desta inspeção/,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Relatório de inspeção" }),
    ).toBeInTheDocument();
  });
  it("does not present a full correction count before the final page has been checked", async () => {
    setupReport(200, 100);
    expect(
      await screen.findByText(/Pode haver outras revisões/),
    ).toBeInTheDocument();
    expect(screen.queryByText(/possui 100 corre/)).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Carregar mais registros" }),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("button", { name: "Carregar mais registros" }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByText(/Pode haver outras revisões/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Esta inspeção possui correções registradas/),
    ).toBeInTheDocument();
  });
});

function PagedHistory() {
  const query = usePaged<{ id: string }>("test-history", "/inspections");
  return (
    <>
      <span data-testid="row-count">{query.rows?.length ?? 0}</span>
      {query.data && <LoadMore query={query} />}
    </>
  );
}
describe("loaded history pages", () => {
  it("loads a short second page and then removes the load-more action", async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const offset = Number(
        new URL(String(input), "http://localhost").searchParams.get("offset"),
      );
      const rows = Array.from(
        { length: offset === 0 ? 100 : 1 },
        (_, index) => ({ id: `row-${offset + index}` }),
      );
      return new Response(JSON.stringify(rows), { status: 200 });
    });
    render(
      <SessionProvider client={new ApiClient(fetcher as typeof fetch)}>
        <PagedHistory />
      </SessionProvider>,
    );
    await waitFor(() =>
      expect(screen.getByTestId("row-count")).toHaveTextContent("100"),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Carregar mais registros" }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("row-count")).toHaveTextContent("101"),
    );
    expect(
      screen.queryByRole("button", { name: "Carregar mais registros" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Todos os registros desta consulta foram carregados."),
    ).toBeInTheDocument();
    expect(
      fetcher.mock.calls.some(([url]) => String(url).includes("offset=100")),
    ).toBe(true);
  });
});
