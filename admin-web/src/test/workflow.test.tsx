import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { ApiClient } from "../api";
import { SessionProvider } from "../auth";
import type { Role } from "../types";

beforeEach(() => window.history.replaceState({}, "", "/"));
function login() {
  fireEvent.change(screen.getByLabelText("Usuário"), {
    target: { value: "test" },
  });
  fireEvent.change(screen.getByLabelText("Senha"), {
    target: { value: "test-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
}
function mockApi(role: Role, createStatus = 201) {
  const fetcher = vi.fn(
    async (url: RequestInfo | URL, options?: RequestInit) => {
      const path = String(url);
      if (path.endsWith("/auth/login"))
        return new Response(
          JSON.stringify({
            accessToken: "test-token",
            expiresAt: new Date(Date.now() + 3600_000).toISOString(),
            offlineUntil: "",
            user: {
              id: "user-1",
              name: "Equipe teste",
              username: "test",
              role,
              companyId: "company-1",
              locationId: "location-1",
              active: true,
            },
          }),
          { status: 200 },
        );
      if (path.endsWith("/templates") && options?.method === "POST")
        return new Response(
          JSON.stringify(
            createStatus === 201
              ? { id: "template-created", version: 1 }
              : { detail: "A versão não foi salva" },
          ),
          { status: createStatus },
        );
      if (path.endsWith("/vehicle-types"))
        return new Response(
          JSON.stringify([
            { id: "truck", code: "Truck", name: "Caminhão", active: true },
          ]),
          { status: 200 },
        );
      return new Response("[]", { status: 200 });
    },
  );
  return { client: new ApiClient(fetcher as typeof fetch), fetcher };
}
async function fillTemplate() {
  fireEvent.change(await screen.findByLabelText("Nome do checklist"), {
    target: { value: "Inspeção de freios" },
  });
  fireEvent.change(screen.getByLabelText("Tipo de veículo"), {
    target: { value: "Truck" },
  });
  fireEvent.change(screen.getByLabelText("Título da seção 1"), {
    target: { value: "Freios" },
  });
  fireEvent.change(screen.getByLabelText("Descrição do item"), {
    target: { value: "Espessura" },
  });
  fireEvent.change(screen.getByLabelText("Resposta"), {
    target: { value: "measurement" },
  });
  fireEvent.change(screen.getByLabelText("Unidade"), {
    target: { value: "mm" },
  });
  fireEvent.change(screen.getByLabelText("Limite de entrada mínimo"), {
    target: { value: "0" },
  });
  fireEvent.change(screen.getByLabelText("Limite de entrada máximo"), {
    target: { value: "20" },
  });
  fireEvent.click(
    screen.getByLabelText("Exigir assinatura ao finalizar a inspeção"),
  );
  fireEvent.click(screen.getByLabelText("Não aplicável"));
}
describe("administrative workflows", () => {
  it("blocks a direct administrative route for an Office account without requesting users", async () => {
    window.history.replaceState({}, "", "/users");
    const { client, fetcher } = mockApi("Office");
    render(
      <SessionProvider client={client}>
        <App />
      </SessionProvider>,
    );
    login();
    expect(
      await screen.findByRole("heading", { name: "Acesso restrito" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Pessoas e acesso" }),
    ).not.toBeInTheDocument();
    expect(
      fetcher.mock.calls.some(([url]) => String(url).endsWith("/users")),
    ).toBe(false);
  });
  it("sends signature policy and zero measurement bounds only after saving a complete version", async () => {
    window.history.replaceState({}, "", "/templates/new");
    const { client, fetcher } = mockApi("Administrator");
    render(
      <SessionProvider client={client}>
        <App />
      </SessionProvider>,
    );
    login();
    await fillTemplate();
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
    const payload = JSON.parse(String(write[1]?.body));
    expect(payload.requiresSignature).toBe(true);
    expect(payload.sections[0].items[0]).toMatchObject({
      responseType: "measurement",
      minValue: 0,
      maxValue: 20,
      unit: "mm",
      required: true,
      allowedStatuses: ["OK", "Attention", "Repair", "Critical"],
    });
    expect(payload.sections[0].items[0]).not.toHaveProperty("id");
    expect(payload.sections[0].items[0]).not.toHaveProperty("key");
    expect(
      await screen.findByRole("heading", { name: "Checklists" }),
    ).toBeInTheDocument();
  });
  it("keeps the user's editor values when the server rejects the save", async () => {
    window.history.replaceState({}, "", "/templates/new");
    const { client } = mockApi("Supervisor", 400);
    render(
      <SessionProvider client={client}>
        <App />
      </SessionProvider>,
    );
    login();
    await fillTemplate();
    fireEvent.click(screen.getByRole("button", { name: "Salvar nova versão" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "A versão não foi salva",
    );
    expect(screen.getByLabelText("Nome do checklist")).toHaveValue(
      "Inspeção de freios",
    );
    expect(screen.getByLabelText("Limite de entrada mínimo")).toHaveValue(0);
    expect(
      screen.getByLabelText("Exigir assinatura ao finalizar a inspeção"),
    ).toBeChecked();
  });
});
