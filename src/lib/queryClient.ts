import { QueryClient } from "@tanstack/react-query";

let client: QueryClient | null = null;

export const getQueryClient = () => {
  if (!client) {
    client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          gcTime: 300_000,
          refetchOnWindowFocus: false,
          retry: 1,
        },
        mutations: {
          retry: 1,
        },
      },
    });
  }

  return client;
};
