import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";

declare module "@/integrations/supabase/client" {
  export const __resetSupabaseMock: () => void;
}

vi.mock("@/integrations/supabase/client", () => {
  let callIndex = 0;
  const pages = [
    {
      data: [
        {
          id: "p1",
          content: "A",
          image_url: null,
          created_at: new Date().toISOString(),
          user_id: "u1",
          profiles: { name: "U1", username: "u1", avatar_text: "U1", role: "Siswa" },
          post_likes: [{ count: 2 }],
          comments: [{ count: 1 }],
          original_post_id: null,
          original_author_id: null,
          original_author: null,
        },
        {
          id: "p2",
          content: "B",
          image_url: null,
          created_at: new Date().toISOString(),
          user_id: "u2",
          profiles: { name: "U2", username: "u2", avatar_text: "U2", role: "Siswa" },
          post_likes: [{ count: 0 }],
          comments: [{ count: 0 }],
          original_post_id: null,
          original_author_id: null,
          original_author: null,
        },
      ],
      error: null,
    },
    { data: [], error: null },
  ];
  return {
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn(async () => {
          const res = callIndex < pages.length ? pages[callIndex] : pages[pages.length - 1];
          callIndex += 1;
          return res;
        }),
      })),
    },
    __resetSupabaseMock: () => {
      callIndex = 0;
    },
  };
});

import { __resetSupabaseMock } from "@/integrations/supabase/client";
import { useInfinitePosts } from "./useInfinitePosts";

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return Wrapper;
}

describe("useInfinitePosts", () => {
  beforeEach(() => {
    __resetSupabaseMock();
  });

  it("loads first page and flattens posts", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useInfinitePosts({ pageSize: 2 }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.posts.length).toBe(2);
    expect(result.current.posts[0].id).toBe("p1");
    expect(result.current.posts[0].likes_count).toBe(2);
    expect(result.current.posts[1].id).toBe("p2");
  });

  it("loads next page and stops when empty", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useInfinitePosts({ pageSize: 2 }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => {
      await result.current.loadMore();
    });
    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.posts.length).toBe(2);
  });
});