import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiClient, ApiError } from "./api";
import type { LoginSession } from "./types";

interface SessionContextValue {
  api: ApiClient;
  session: LoginSession | null;
  expired: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}
const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({
  children,
  client,
}: {
  children: ReactNode;
  client?: ApiClient;
}) {
  const [api] = useState(() => client ?? new ApiClient());
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            networkMode: "always",
            staleTime: 30_000,
            retry: (count, error) =>
              !(
                error instanceof ApiError &&
                [401, 403, 404].includes(error.status)
              ) && count < 1,
            refetchOnWindowFocus: true,
          },
          // Web forms must never queue work to run under a later session.
          mutations: { retry: false, networkMode: "always" },
        },
      }),
  );
  const [session, setSession] = useState<LoginSession | null>(null);
  const [expired, setExpired] = useState(false);
  const logout = useCallback(() => {
    api.setToken(null);
    void queryClient.cancelQueries();
    queryClient.clear();
    setSession(null);
    setExpired(false);
  }, [api, queryClient]);
  useEffect(() => {
    api.onUnauthorized = () => {
      logout();
      setExpired(true);
    };
    return () => {
      api.onUnauthorized = undefined;
    };
  }, [api, logout]);
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(
      () => {
        logout();
        setExpired(true);
      },
      Math.max(
        0,
        Math.min(Date.parse(session.expiresAt) - Date.now(), 2_147_483_647),
      ),
    );
    return () => clearTimeout(timer);
  }, [session, logout]);
  const login = async (username: string, password: string) => {
    const data = await api.send<LoginSession>(
      "/auth/login",
      "POST",
      {
        username: username.trim(),
        password,
        deviceId: `web-${crypto.randomUUID()}`,
      },
      true,
    );
    if (
      !data.accessToken ||
      !data.user?.active ||
      !Number.isFinite(Date.parse(data.expiresAt)) ||
      Date.parse(data.expiresAt) <= Date.now()
    )
      throw new ApiError(
        "O servidor não confirmou uma sessão válida. Entre em contato com o administrador.",
        401,
      );
    queryClient.clear();
    api.setToken(data.accessToken);
    setExpired(false);
    setSession(data);
  };
  return (
    <SessionContext.Provider value={{ api, session, expired, login, logout }}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SessionContext.Provider>
  );
}
export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error("SessionProvider missing");
  return value;
}
export function useUser() {
  const { session } = useSession();
  if (!session) throw new Error("Authenticated route required");
  return session.user;
}
