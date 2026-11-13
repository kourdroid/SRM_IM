import { QueryClient } from "@tanstack/react-query"

/** App-wide TanStack Query client: 60 s freshness, one retry, refetch on window focus. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})
