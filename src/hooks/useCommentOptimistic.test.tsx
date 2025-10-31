import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useCommentOptimistic } from "./useCommentOptimistic";

declare module "@/integrations/supabase/client" {
  export const __setLikeFail: (flag: boolean) => void;
}

let likeShouldFail = false;

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === "comment_likes") {
          return {
            delete: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(async () => {
                  if (likeShouldFail) return { error: { message: "fail" } };
                  return { error: null };
                }),
              })),
            })),
            insert: vi.fn(async () => {
              if (likeShouldFail) return { error: { message: "fail" } };
              return { error: null };
            }),
          } as any;
        }
        if (table === "comments") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn(async () => ({ data: { image_url: null }, error: null })),
            delete: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
          } as any;
        }
        return {} as any;
      }),
      storage: {
        from: vi.fn(() => ({
          remove: vi.fn(async () => ({})),
        })),
      },
    },
    __setLikeFail: (flag: boolean) => {
      likeShouldFail = flag;
    },
  };
});

import { __setLikeFail } from "@/integrations/supabase/client";

function createWrapper(seed?: { comments?: any; post?: any; postsList?: any }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (seed?.comments) qc.setQueryData(["comments", "p1"], seed.comments);
  if (seed?.post) qc.setQueryData(["post", "p1"], seed.post);
  if (seed?.postsList) qc.setQueryData(["posts"], seed.postsList);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { wrapper, qc };
}

describe("useCommentOptimistic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __setLikeFail(false);
  });

  it("toggles like optimistically and persists on success", async () => {
    const seed = {
      comments: {
        pages: [
          {
            rows: [
              { id: "c1", likes_count: 0, user_like: [], profiles: { name: "A", avatar_text: "A" } },
              { id: "c2", likes_count: 5, user_like: [{ id: "x", user_id: "u1" }], profiles: { name: "B", avatar_text: "B" } },
            ],
          },
        ],
      },
    };
    const { wrapper, qc } = createWrapper(seed);
    const { result } = renderHook(() => useCommentOptimistic("p1", "u1"), { wrapper });
    await act(async () => {
      await result.current.toggleLike.mutateAsync({ id: "c1", user_like: [] });
    });
    const comments = qc.getQueryData(["comments", "p1"]) as any;
    const c1 = comments.pages[0].rows.find((r: any) => r.id === "c1");
    expect(c1.likes_count).toBe(1);
    expect(c1.user_like.length).toBe(1);
  });

  it("rolls back like on failure", async () => {
    const seed = {
      comments: {
        pages: [
          {
            rows: [{ id: "c1", likes_count: 0, user_like: [], profiles: { name: "A", avatar_text: "A" } }],
          },
        ],
      },
    };
    const { wrapper, qc } = createWrapper(seed);
    const { result } = renderHook(() => useCommentOptimistic("p1", "u1"), { wrapper });
    __setLikeFail(true);
    await act(async () => {
      try {
        await result.current.toggleLike.mutateAsync({ id: "c1", user_like: [] });
      } catch {}
    });
    await waitFor(() => {
      const comments = qc.getQueryData(["comments", "p1"]) as any;
      const c1 = comments.pages[0].rows.find((r: any) => r.id === "c1");
      expect(c1.likes_count).toBe(0);
      expect(c1.user_like.length).toBe(0);
    });
  });
});