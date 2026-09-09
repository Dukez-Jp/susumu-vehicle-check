import { describe, expect, it, vi } from "vitest";
import { ApiClient, ApiError } from "../api";

describe("authenticated API client", () => {
  it("treats a dropped write response as unconfirmed and does not retry it", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const api = new ApiClient(fetcher);
    await expect(
      api.send("/templates", "POST", { name: "Teste" }),
    ).rejects.toMatchObject({
      message: expect.stringMatching(/confirmar.*atualize/i),
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });
  it("sends bearer credentials without persisting tokens or sending cookies", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify([]), { status: 200 }));
    const storage = vi.spyOn(Storage.prototype, "setItem");
    const api = new ApiClient(fetcher);
    api.setToken("session-token");
    await api.get("/vehicles");
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe("/api/v1/vehicles");
    expect(options.headers.get("Authorization")).toBe("Bearer session-token");
    expect(options.credentials).toBe("omit");
    expect(storage).not.toHaveBeenCalled();
  });

  it("expires the current session on a protected 401", async () => {
    const api = new ApiClient(
      vi
        .fn()
        .mockResolvedValue(
          new Response('{"title":"Expired"}', { status: 401 }),
        ),
    );
    const expired = vi.fn();
    api.onUnauthorized = expired;
    api.setToken("expired");
    await expect(api.get("/vehicles")).rejects.toMatchObject({ status: 401 });
    expect(expired).toHaveBeenCalledOnce();
    expect(api.hasToken()).toBe(false);
  });

  it("does not expire a replacement login when an old request returns 401", async () => {
    let resolve!: (response: Response) => void;
    const api = new ApiClient(
      vi.fn().mockReturnValue(
        new Promise<Response>((done) => {
          resolve = done;
        }),
      ),
    );
    const expired = vi.fn();
    api.onUnauthorized = expired;
    api.setToken("old");
    const pending = api.get("/vehicles");
    api.setToken("new");
    resolve(new Response("{}", { status: 401 }));
    await expect(pending).rejects.toBeInstanceOf(ApiError);
    expect(api.hasToken()).toBe(true);
    expect(expired).not.toHaveBeenCalled();
  });

  it("preserves server field errors and does not log out on forbidden requests", async () => {
    const api = new ApiClient(
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            title: "Forbidden",
            detail: "Sem permissão",
            errors: { role: ["Negado"] },
          }),
          { status: 403 },
        ),
      ),
    );
    const expired = vi.fn();
    api.onUnauthorized = expired;
    api.setToken("valid");
    await expect(api.get("/users")).rejects.toMatchObject({
      status: 403,
      message: "Sem permissão",
      fields: { role: ["Negado"] },
    });
    expect(expired).not.toHaveBeenCalled();
  });

  it("reports network errors without inventing a successful response", async () => {
    const api = new ApiClient(
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    await expect(api.get("/dashboard")).rejects.toMatchObject({ status: 0 });
  });
});
