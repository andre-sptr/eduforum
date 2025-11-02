-- Add cascade delete for nested comments (parent-child relationship)
-- Drop existing foreign key if exists and recreate with CASCADE
ALTER TABLE comments
DROP CONSTRAINT IF EXISTS comments_parent_id_fkey;

ALTER TABLE comments
ADD CONSTRAINT comments_parent_id_fkey 
FOREIGN KEY (parent_id) 
REFERENCES comments(id) 
ON DELETE CASCADE;

-- Enable realtime for posts table
ALTER TABLE posts REPLICA IDENTITY FULL;

-- Add posts table to realtime publication (skip comments as it's already added)
ALTER PUBLICATION supabase_realtime ADD TABLE posts;

-- Enable realtime for likes table
ALTER TABLE likes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE likes;