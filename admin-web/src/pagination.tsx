import { useMemo } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useSession } from "./auth";
import { ErrorPanel } from "./components";

export const PAGE_SIZE = 100;
export function nextOffset(pageLength: number, offset: number) {
  return pageLength === PAGE_SIZE ? offset + pageLength : undefined;
}
export function uniqueRows<T extends { id: string }>(pages: T[][]): T[] {
  return [...new Map(pages.flat().map((row) => [row.id, row])).values()];
}
export function usePaged<T extends { id: string }>(
  resource: string,
  path: string,
  enabled = true,
) {
  const { api } = useSession();
  const query = useInfiniteQuery({
    queryKey: ["paged", resource, path],
    enabled,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) =>
      api.get<T[]>(
        `${path}${path.includes("?") ? "&" : "?"}limit=${PAGE_SIZE}&offset=${pageParam}`,
        signal,
      ),
    getNextPageParam: (page, _pages, offset) => nextOffset(page.length, offset),
  });
  // Só refaz a deduplicação quando chega página nova, não a cada render.
  const rows = useMemo(
    () => (query.data ? uniqueRows(query.data.pages) : undefined),
    [query.data],
  );
  return { ...query, rows };
}
export function LoadMore({
  query,
}: {
  query: {
    hasNextPage: boolean;
    isFetching: boolean;
    isFetchNextPageError: boolean;
    error: Error | null;
    fetchNextPage: () => Promise<unknown>;
  };
}) {
  return (
    <div className="load-more no-print">
      {query.isFetchNextPageError && (
        <ErrorPanel
          error={query.error}
          retry={() => void query.fetchNextPage()}
        />
      )}
      {query.hasNextPage ? (
        <button
          className="button secondary"
          disabled={query.isFetching}
          onClick={() => void query.fetchNextPage()}
        >
          {query.isFetching
            ? "Carregando registros…"
            : "Carregar mais registros"}
        </button>
      ) : (
        <span>Todos os registros desta consulta foram carregados.</span>
      )}
    </div>
  );
}
