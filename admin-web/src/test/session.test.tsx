import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "../api";
import { SessionProvider, useSession } from "../auth";
import Login from "../pages/Login";

function Probe() {
  const { session, logout } = useSession();
  return session ? (
    <>
      <span data-testid="identity">{session.user.name}</span>
      <button onClick={logout}>Encerrar sessão</button>
    </>
  ) : (
    <span data-testid="identity">Sem sessão</span>
  );
}
function submit() {
  fireEvent.change(screen.getByLabelText("Usuário"), {
    target: { value: "office" },
  });
  fireEvent.change(screen.getByLabelText("Senha"), {
    target: { value: "test-only-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Entrar" }));
}
const user = {
  id: "u1",
  name: "Equipe de teste",
  username: "office",
  role: "Office",
  companyId: "c1",
  locationId: "l1",
  active: true,
};
describe("login session UI", () => {
  it("displays credential rejection and clears password without entering", async () => {
    const api = new ApiClient(
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ detail: "Credenciais inválidas" }), {
          status: 401,
        }),
      ),
    );
    render(
      <SessionProvider client={api}>
        <Login />
        <Probe />
      </SessionProvider>,
    );
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Credenciais inválidas",
    );
    expect(screen.getByTestId("identity")).toHaveTextContent("Sem sessão");
    expect(screen.getByLabelText("Senha")).toHaveValue("");
  });
  it("establishes a session only after server confirmation and clears it on logout", async () => {
    const api = new ApiClient(
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            accessToken: "test-token",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            offlineUntil: "",
            user,
          }),
          { status: 200 },
        ),
      ),
    );
    render(
      <SessionProvider client={api}>
        <Login />
        <Probe />
      </SessionProvider>,
    );
    submit();
    await waitFor(() =>
      expect(screen.getByTestId("identity")).toHaveTextContent(
        "Equipe de teste",
      ),
    );
    expect(api.hasToken()).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Encerrar sessão" }));
    expect(screen.getByTestId("identity")).toHaveTextContent("Sem sessão");
    expect(api.hasToken()).toBe(false);
  });
  it("rejects an inactive account even if a malformed server response contains a token", async () => {
    const api = new ApiClient(
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            accessToken: "test-token",
            expiresAt: new Date(Date.now() + 60_000).toISOString(),
            user: { ...user, active: false },
          }),
          { status: 200 },
        ),
      ),
    );
    render(
      <SessionProvider client={api}>
        <Login />
        <Probe />
      </SessionProvider>,
    );
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent("sessão válida");
    expect(api.hasToken()).toBe(false);
  });
});
