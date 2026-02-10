import { renderHook, act, waitFor } from '@testing-library/react';
import { useSearch } from '../useSearch';
import { supabase } from '@/integrations/supabase/client';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const createMockQueryBuilder = (data: any[] = [], error: any = null) => {
  const builder: any = {};
  builder.select = vi.fn().mockReturnValue(builder);
  builder.order = vi.fn().mockReturnValue(builder);
  builder.range = vi.fn().mockReturnValue(builder);
  builder.ilike = vi.fn().mockReturnValue(builder);
  builder.or = vi.fn().mockReturnValue(builder);
  builder.limit = vi.fn().mockReturnValue(builder);
  builder.then = vi.fn((resolve) => resolve({ data, error }));
  return builder;
};

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('useSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useSearch());
    expect(result.current.query).toBe('');
    expect(result.current.posts).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.history).toEqual([]);
  });

  it('should handle history operations', () => {
    const { result } = renderHook(() => useSearch());
    
    act(() => {
      result.current.saveToHistory('test 1');
    });
    expect(result.current.history).toContain('test 1');
    expect(JSON.parse(localStorage.getItem('search_history') || '[]')).toContain('test 1');

    act(() => {
      result.current.saveToHistory('test 2');
    });
    expect(result.current.history).toHaveLength(2);
    expect(result.current.history[0]).toBe('test 2'); 

    act(() => {
      result.current.removeFromHistory('test 1');
    });
    expect(result.current.history).not.toContain('test 1');

    act(() => {
      result.current.clearHistory();
    });
    expect(result.current.history).toEqual([]);
  });

  it('should execute search when query changes (debounced)', async () => {
    const mockPosts = [{ id: 1, content: 'test post' }];
    const postBuilder = createMockQueryBuilder(mockPosts);
    const userBuilder = createMockQueryBuilder([]);

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'posts') return postBuilder;
      if (table === 'profiles') return userBuilder;
      return createMockQueryBuilder();
    });

    const { result } = renderHook(() => useSearch({ debounceDelay: 10 }));

    act(() => {
      result.current.setQuery('test');
    });

    await waitFor(() => {
      expect(supabase.from).toHaveBeenCalledWith('posts');
    });
    
    await waitFor(() => expect(result.current.posts).toEqual(mockPosts));
  });

  it('should handle search errors', async () => {
    const error = { message: 'Network error' };
    const postBuilder = createMockQueryBuilder([], error);
    
    (supabase.from as any).mockReturnValue(postBuilder);

    const { result } = renderHook(() => useSearch({ debounceDelay: 10 }));

    act(() => {
      result.current.setQuery('error');
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

  });
});
