export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields: Record<string, string[]> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export class ApiClient {
  private token: string | null = null;
  private generation = 0;
  onUnauthorized?: () => void;
  constructor(private fetcher: typeof fetch = (...args) => fetch(...args)) {}
  setToken(token: string | null) {
    this.token = token;
    this.generation += 1;
  }
  hasToken() {
    return this.token !== null;
  }

  private async request(
    path: string,
    options: RequestInit = {},
    publicRequest = false,
  ): Promise<Response> {
    if (!path.startsWith("/") || path.startsWith("//"))
      throw new ApiError("Endereço da solicitação inválido.", 0);
    const generation = this.generation;
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");
    if (options.body) headers.set("Content-Type", "application/json");
    if (!publicRequest && this.token)
      headers.set("Authorization", `Bearer ${this.token}`);
    const timeout = AbortSignal.timeout(30_000);
    const signal = options.signal
      ? AbortSignal.any([options.signal, timeout])
      : timeout;
    let response: Response;
    try {
      response = await this.fetcher(`/api/v1${path}`, {
        ...options,
        headers,
        signal,
        credentials: "omit",
        cache: "no-store",
      });
    } catch (error) {
      if (options.signal?.aborted) throw error;
      throw new ApiError(
        options.method && options.method !== "GET" && !publicRequest
          ? "Não foi possível confirmar o resultado da alteração. Atualize a lista antes de repetir a operação."
          : timeout.aborted
            ? "O servidor demorou para responder. Tente novamente."
            : "Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.",
        0,
      );
    }
    if (!response.ok) {
      let problem: {
        detail?: string;
        title?: string;
        errors?: Record<string, string[]>;
      } = {};
      try {
        const parsed = await response.json();
        problem = parsed && typeof parsed === "object" ? parsed : {};
      } catch {
        /* A proxy may return non-JSON errors. */
      }
      if (
        response.status === 401 &&
        !publicRequest &&
        generation === this.generation &&
        this.token
      ) {
        this.setToken(null);
        this.onUnauthorized?.();
      }
      const fallback =
        response.status === 401
          ? "Acesso inválido ou expirado. Entre novamente."
          : response.status === 403
            ? "Seu perfil não permite realizar esta operação."
            : response.status === 429
              ? "Muitas tentativas. Aguarde um momento antes de tentar novamente."
              : `Não foi possível concluir a solicitação (${response.status}).`;
      throw new ApiError(
        problem.detail || problem.title || fallback,
        response.status,
        problem.errors || {},
      );
    }
    return response;
  }
  async get<T>(path: string, signal?: AbortSignal): Promise<T> {
    const response = await this.request(path, { signal });
    try {
      return await response.json();
    } catch {
      throw new ApiError(
        "O servidor retornou uma resposta inválida. Tente novamente.",
        response.status,
      );
    }
  }
  async send<T>(
    path: string,
    method: "POST" | "PUT",
    data?: unknown,
    publicRequest = false,
  ): Promise<T> {
    const response = await this.request(
      path,
      { method, body: data === undefined ? undefined : JSON.stringify(data) },
      publicRequest,
    );
    if (response.status === 204) return undefined as T;
    try {
      return await response.json();
    } catch {
      throw new ApiError(
        "O servidor não confirmou os dados salvos. Atualize a lista antes de tentar novamente.",
        response.status,
      );
    }
  }
  async blob(path: string, signal?: AbortSignal): Promise<Blob> {
    return (await this.request(path, { signal })).blob();
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir esta operação. Tente novamente.";
}
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
