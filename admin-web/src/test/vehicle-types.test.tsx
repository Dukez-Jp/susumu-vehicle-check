import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "../App";
import { ApiClient } from "../api";
import { SessionProvider } from "../auth";
import type { ChecklistTemplate, Role, Vehicle, VehicleType } from "../types";

const source: ChecklistTemplate = {
  id: "template-1",
  name: "Inspeção antiga",
  vehicleType: "Old",
  version: 3,
  active: true,
  published: true,
  requiresSignature: false,
  sections: [
    {
      id: "section",
      title: "Freios",
      items: [
        {
          id: "item",
          label: "Disco",
          responseType: "status",
          required: true,
          unit: null,
          minValue: null,
          maxValue: null,
          allowedStatuses: ["Critical", "Repair"],
        },
      ],
    },
  ],
};

function setup(
  path: string,
  role: Role = "Administrator",
  rejectCreate = false,
) {
  window.history.replaceState({}, "", path);
  let catalog: VehicleType[] = [
    { id: "truck", code: "Truck", name: "Caminhão", active: true },
    { id: "old", code: "Old", name: "Tipo antigo", active: false },
  ];
  let vehicle: Vehicle = {
    id: "vehicle-1",
    internalNumber: "714",
    plate: null,
    type: "Old",
    companyId: "company",
    locationId: "location",
    currentOdometerKm: null,
    active: true,
  };
  const fetcher = vi.fn(
    async (input: RequestInfo | URL, options?: RequestInit) => {
      const url = new URL(String(input), "http://localhost");
      const body = options?.body ? JSON.parse(String(options.body)) : undefined;
      let data: unknown = [];
      if (url.pathname.endsWith("/auth/login"))
        data = {
          accessToken: "test-token",
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          offlineUntil: "",
          user: {
            id: "user",
            name: "Equipe",
            username: "test",
            role,
            companyId: "company",
            locationId: "location",
            active: true,
          },
        };
      else if (
        url.pathname.endsWith("/vehicle-types") &&
        options?.method === "POST"
      ) {
        if (rejectCreate)
          return new Response(
            JSON.stringify({
              detail: "Código cadastrado por outro administrador",
            }),
            { status: 409 },
          );
        data = { id: "created", ...body, active: true };
        catalog = [...catalog, data as VehicleType];
      } else if (
        url.pathname.endsWith("/vehicle-types/created") &&
        options?.method === "PUT"
      ) {
        catalog = catalog.map((type) =>
          type.id === "created" ? { ...type, ...body } : type,
        );
        data = catalog.find((type) => type.id === "created");
      } else if (url.pathname.endsWith("/vehicle-types")) data = catalog;
      else if (url.pathname.endsWith("/locations"))
        data = [
          {
            id: "location",
            companyId: "company",
            name: "Oficina",
            active: true,
          },
        ];
      else if (url.pathname.endsWith("/vehicles/vehicle-1")) {
        if (options?.method === "PUT") vehicle = { ...vehicle, ...body };
        data = vehicle;
      } else if (url.pathname.endsWith("/templates"))
        data =
          options?.method === "POST"
            ? { id: "new-template", ...body }
            : [source];
      return new Response(JSON.stringify(data), {
        status:
          options?.method === "POST" && !url.pathname.endsWith("/auth/login")
            ? 201
            : 200,
      });
    },
  );
  render(
    <SessionProvider client={new ApiClient(fetcher as typeof fetch)}>
      <App />
    </SessionProvider>,
  );
  fireEvent.change(screen.getByLabelText("Usuário"), {
    target: { value: "test" },
  });
  fireEvent.change(screen.getByLabelText("Senha"), {
    target: { value: "test-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
  return fetcher;
}

describe("vehicle type administration and assignments", () => {
  it.each(["Supervisor", "Office"] as Role[])(
    "blocks catalog maintenance for %s without issuing its query",
    async (role) => {
      const fetcher = setup("/vehicle-types", role);
      expect(
        await screen.findByRole("heading", { name: "Acesso restrito" }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "Tipos de veículo" }),
      ).not.toBeInTheDocument();
      expect(
        fetcher.mock.calls.some(([url]) =>
          String(url).endsWith("/vehicle-types"),
        ),
      ).toBe(false);
    },
  );

  it("creates a catalog code, then updates its name and availability without sending a replacement code", async () => {
    const fetcher = setup("/vehicle-types");
    await screen.findByText("Caminhão");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar tipo" }));
    fireEvent.change(screen.getByRole("textbox", { name: /^Código/ }), {
      target: { value: " Bus " },
    });
    fireEvent.change(screen.getByLabelText("Nome de exibição"), {
      target: { value: " Ônibus " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar tipo" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Editar tipo Bus" }),
    );
    expect(screen.getByRole("textbox", { name: /^Código/ })).toHaveAttribute(
      "readonly",
    );
    fireEvent.change(screen.getByLabelText("Nome de exibição"), {
      target: { value: "Ônibus rodoviário" },
    });
    fireEvent.click(screen.getByLabelText("Tipo ativo para novos vínculos"));
    fireEvent.click(screen.getByRole("button", { name: "Salvar tipo" }));
    expect(await screen.findByText("Ônibus rodoviário")).toBeInTheDocument();
    const create = fetcher.mock.calls.find(
      ([, options]) =>
        options?.method === "POST" && String(options.body).includes('"code"'),
    )!;
    const update = fetcher.mock.calls.find(
      ([, options]) => options?.method === "PUT",
    )!;
    expect(JSON.parse(String(create[1]?.body))).toEqual({
      code: "Bus",
      name: "Ônibus",
    });
    expect(JSON.parse(String(update[1]?.body))).toEqual({
      name: "Ônibus rodoviário",
      active: false,
    });
  });

  it("preserves unsaved catalog fields when a concurrent create conflicts", async () => {
    setup("/vehicle-types", "Administrator", true);
    await screen.findByText("Caminhão");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar tipo" }));
    fireEvent.change(screen.getByRole("textbox", { name: /^Código/ }), {
      target: { value: "Bus" },
    });
    fireEvent.change(screen.getByLabelText("Nome de exibição"), {
      target: { value: "Ônibus" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar tipo" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Código cadastrado por outro administrador",
    );
    expect(screen.getByRole("textbox", { name: /^Código/ })).toHaveValue("Bus");
    expect(screen.getByLabelText("Nome de exibição")).toHaveValue("Ônibus");
    expect(
      screen.queryByText("Tipo de veículo salvo."),
    ).not.toBeInTheDocument();
  });

  it("keeps an unchanged retired code when editing a vehicle", async () => {
    const fetcher = setup("/vehicles/vehicle-1");
    fireEvent.click(
      await screen.findByRole("button", { name: "Editar cadastro" }),
    );
    await screen.findByRole("option", { name: "Caminhão · Truck" });
    expect(screen.getByLabelText("Tipo de veículo")).toHaveValue("Old");
    expect(
      screen.getByRole("option", { name: "Tipo antigo · Old (desativado)" }),
    ).not.toBeDisabled();
    fireEvent.change(screen.getByLabelText("Número interno"), {
      target: { value: "715" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar alterações" }));
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(([, options]) => options?.method === "PUT"),
      ).toBe(true),
    );
    const update = fetcher.mock.calls.find(
      ([, options]) => options?.method === "PUT",
    )!;
    expect(JSON.parse(String(update[1]?.body))).toMatchObject({
      type: "Old",
      internalNumber: "715",
    });
  });

  it("lets a supervisor copy pinned options but requires an active type for the new template version", async () => {
    const fetcher = setup("/templates/new?from=template-1", "Supervisor");
    await screen.findByRole("option", { name: "Caminhão · Truck" });
    expect(screen.getByLabelText("Tipo de veículo")).toHaveValue("Old");
    expect(screen.getByLabelText("Crítico")).toBeChecked();
    expect(screen.getByLabelText("Reparar")).toBeChecked();
    expect(screen.getByLabelText("OK")).not.toBeChecked();
    fireEvent.click(screen.getByRole("button", { name: "Salvar nova versão" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Selecione um tipo de veículo ativo",
    );
    expect(
      fetcher.mock.calls.some(
        ([url, options]) =>
          String(url).endsWith("/templates") && options?.method === "POST",
      ),
    ).toBe(false);
    fireEvent.change(screen.getByLabelText("Tipo de veículo"), {
      target: { value: "Truck" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Salvar nova versão" }));
    await waitFor(() =>
      expect(
        fetcher.mock.calls.some(
          ([url, options]) =>
            String(url).endsWith("/templates") && options?.method === "POST",
        ),
      ).toBe(true),
    );
    const write = fetcher.mock.calls.find(
      ([url, options]) =>
        String(url).endsWith("/templates") && options?.method === "POST",
    )!;
    expect(
      JSON.parse(String(write[1]?.body)).sections[0].items[0].allowedStatuses,
    ).toEqual(["Critical", "Repair"]);
  });
});
