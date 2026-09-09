import { fireEvent, render, screen } from "@testing-library/react";
import { onlineManager, useMutation } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { ApiClient } from "../api";
import { SessionProvider, useSession } from "../auth";

function Writer() {
  const { api } = useSession();
  const write = useMutation({
    mutationFn: () =>
      api.send("/vehicles", "POST", { internalNumber: "test-only" }),
  });
  return (
    <>
      <button onClick={() => write.mutate()}>Salvar teste</button>
      {write.isError && <p role="alert">Alteração não confirmada</p>}
    </>
  );
}
describe("web writes while offline", () => {
  it("fails immediately instead of silently queuing an old user's administrative write", async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError("Offline"));
    onlineManager.setOnline(false);
    try {
      render(
        <SessionProvider client={new ApiClient(fetcher)}>
          <Writer />
        </SessionProvider>,
      );
      fireEvent.click(screen.getByRole("button", { name: "Salvar teste" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(
        "Alteração não confirmada",
      );
      expect(fetcher).toHaveBeenCalledOnce();
    } finally {
      onlineManager.setOnline(true);
    }
  });
});
