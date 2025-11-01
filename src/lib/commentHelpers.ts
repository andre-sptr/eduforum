export interface RawComment {
  id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  likes_count: number;
  profiles: {
    name: string;
    avatar_text: string;
  };
  parent_comment_id: string | null;
  user_like: Array<{ id: string }>;
}

export interface Comment extends RawComment {
  replies: Comment[];
}

export const nestComments = (commentList: RawComment[]): Comment[] => {
  const commentMap: Record<string, Comment> = {};
  commentList.forEach(comment => {
    commentMap[comment.id] = { ...comment, replies: [] };
  });
  const nestedComments: Comment[] = [];
  Object.values(commentMap).forEach(comment => {
    if (comment.parent_comment_id) {
      const parent = commentMap[comment.parent_comment_id];
      if (parent) {
        parent.replies.push(comment);
      }
    } else {
      nestedComments.push(comment);
    }
  });
  return nestedComments;
};