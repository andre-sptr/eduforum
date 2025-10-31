// ================================================
// Ganti seluruh isi: src/hooks/useComments.test.tsx
// ================================================
import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useComments } from "./useComments";

declare module "@/integrations/supabase/client" {
  export const __setInsertFail: (flag: boolean) => void;
}

const mockUpload = vi.fn();
const mockGetPublicUrl = vi.fn();
const mockRemove = vi.fn();
let callIndex = 0;
let insertShouldFail = false;

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === "comments") {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            range: vi.fn(async () => {
              const pages = [
                {
                  data: [
                    {
                      id: "c1",
                      post_id: "p1",
                      user_id: "u1",
                      content: "Hi",
                      image_url: null,
                      created_at: new Date().toISOString(),
                      parent_comment_id: null,
                      profiles: { name: "U1", avatar_text: "U1" },
                      user_like: [],
                      likes_count: 0,
                    },
                    {
                      id: "c2",
                      post_id: "p1",
                      user_id: "u2",
                      content: "Yo",
                      image_url: null,
                      created_at: new Date().toISOString(),
                      parent_comment_id: null,
                      profiles: { name: "U2", avatar_text: "U2" },
                      user_like: [],
                      likes_count: 0,
                    },
                  ],
                  error: null,
                },
                { data: [], error: null },
              ];
              const res = callIndex < pages.length ? pages[callIndex] : pages[pages.length - 1];
              callIndex += 1;
              return res;
            }),
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(async () => {
                  if (insertShouldFail) return { data: null, error: { message: "fail" } };
                  return { data: { id: "c-new", created_at: new Date().toISOString() }, error: null };
                }),
              })),
            })),
          };
        }
        if (table === "profiles") {
          return { select: vi.fn(async () => ({ data: [], error: null })) } as any;
        }
        return {} as any;
      }),
      storage: {
        from: vi.fn(() => ({
          upload: mockUpload,
          getPublicUrl: mockGetPublicUrl,
          remove: mockRemove,
        })),
      },
    },
    __setInsertFail: (flag: boolean) => {
      insertShouldFail = flag;
    },
  };
});

import { __setInsertFail } from "@/integrations/supabase/client";

function createWrapper(seed?: { post?: any; postsList?: any }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  if (seed?.post) qc.setQueryData(["post", seed.post.id], seed.post);
  if (seed?.postsList) qc.setQueryData(["posts"], seed.postsList);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  return { wrapper, qc };
}

describe("useComments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callIndex = 0;
    __setInsertFail(false);
  });

  it("paginates comments and stops when empty", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useComments("p1", "u1", 2), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.comments.length).toBe(2);
    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.isFetchingNextPage).toBe(false));
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.comments.length).toBe(2);
  });

  it("optimistically increments counts on add and keeps cache consistent on success", async () => {
    const seed = {
      post: { id: "p1", comments_count: 0 },
      postsList: { pages: [{ rows: [{ id: "p1", comments_count: 0 }, { id: "p2", comments_count: 5 }] }] },
    };
    const { wrapper, qc } = createWrapper(seed);
    const { result } = renderHook(() => useComments("p1", "u1", 2), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => {
      await result.current.addComment.mutateAsync({ text: "New", file: null, parentId: null });
    });
    const post = qc.getQueryData(["post", "p1"]) as any;
    const lists = qc.getQueryData(["posts"]) as any;
    expect(post.comments_count).toBeGreaterThanOrEqual(1);
    const p1 = lists.pages[0].rows.find((r: any) => r.id === "p1");
    expect(p1.comments_count).toBeGreaterThanOrEqual(1);
  });

  it("rolls back counts on failure", async () => {
    const seed = {
      post: { id: "p1", comments_count: 0 },
      postsList: { pages: [{ rows: [{ id: "p1", comments_count: 0 }, { id: "p2", comments_count: 5 }] }] },
    };
    const { wrapper, qc } = createWrapper(seed);
    __setInsertFail(true);
    const { result } = renderHook(() => useComments("p1", "u1", 2), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => {
      try {
        await result.current.addComment.mutateAsync({ text: "New", file: null, parentId: null });
      } catch {}
    });
    const post = qc.getQueryData(["post", "p1"]) as any;
    const lists = qc.getQueryData(["posts"]) as any;
    expect(post.comments_count).toBe(0);
    const p1 = lists.pages[0].rows.find((r: any) => r.id === "p1");
    expect(p1.comments_count).toBe(0);
  });
});