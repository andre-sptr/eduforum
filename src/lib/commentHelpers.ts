export interface RawComment {
  id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  likes_count: number;
  profiles: { name: string; avatar_text: string };
  parent_comment_id: string | null;
  user_like: Array<{ id: string; user_id?: string }>;
}

export interface Comment extends RawComment {
  replies: Comment[];
}

export const nestComments = (commentList: RawComment[]): Comment[] => {
  const map: Record<string, Comment> = {};
  for (const c of commentList) {
    map[c.id] = { ...c, replies: [] };
  }
  const roots: Comment[] = [];
  for (const c of Object.values(map)) {
    if (c.parent_comment_id && map[c.parent_comment_id]) {
      map[c.parent_comment_id].replies.push(c);
    } else {
      roots.push(c);
    }
  }
  const sortByTime = (a: Comment, b: Comment) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  const sortTree = (nodes: Comment[]) => {
    nodes.sort(sortByTime);
    for (const n of nodes) sortTree(n.replies);
  };
  sortTree(roots);
  return roots;
};