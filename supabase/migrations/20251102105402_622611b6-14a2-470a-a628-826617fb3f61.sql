-- Add reference columns to notifications table for cascade delete
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS reference_id uuid,
ADD COLUMN IF NOT EXISTS reference_type text;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_reference 
ON notifications(reference_id, reference_type);

-- Update existing notification triggers to include reference_id

-- Update notify_post_like to store reference
CREATE OR REPLACE FUNCTION public.notify_post_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_owner_id uuid;
  liker_name text;
BEGIN
  SELECT p.user_id, pr.full_name INTO post_owner_id, liker_name
  FROM posts p
  JOIN profiles pr ON pr.id = NEW.user_id
  WHERE p.id = NEW.post_id;
  
  IF post_owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, title, message, link, reference_id, reference_type)
    VALUES (
      post_owner_id,
      'like',
      'Postingan Disukai',
      liker_name || ' menyukai postingan Anda',
      '/post/' || NEW.post_id,
      NEW.post_id,
      'post'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update notify_post_comment to store reference
CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_owner_id uuid;
  commenter_name text;
BEGIN
  SELECT p.user_id, pr.full_name INTO post_owner_id, commenter_name
  FROM posts p
  JOIN profiles pr ON pr.id = NEW.user_id
  WHERE p.id = NEW.post_id;
  
  IF post_owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, title, message, link, reference_id, reference_type)
    VALUES (
      post_owner_id,
      'comment',
      'Komentar Baru',
      commenter_name || ' mengomentari postingan Anda',
      '/post/' || NEW.post_id,
      NEW.comment_id,
      'comment'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update notify_post_mention to store reference
CREATE OR REPLACE FUNCTION public.notify_post_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mention_pattern text := '@\[([^\]]+)\]\(([a-f0-9\-]+)\)';
  mentioned_user_id uuid;
  author_name text;
BEGIN
  SELECT full_name INTO author_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  FOR mentioned_user_id IN
    SELECT DISTINCT (regexp_matches(NEW.content, mention_pattern, 'g'))[2]::uuid
  LOOP
    IF mentioned_user_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, type, title, message, link, reference_id, reference_type)
      VALUES (
        mentioned_user_id,
        'mention',
        'Anda Dimention',
        author_name || ' menyebut Anda dalam postingan',
        '/post/' || NEW.id,
        NEW.id,
        'post'
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Update notify_comment_mention to store reference
CREATE OR REPLACE FUNCTION public.notify_comment_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mention_pattern text := '@\[([^\]]+)\]\(([a-f0-9\-]+)\)';
  mentioned_user_id uuid;
  commenter_name text;
BEGIN
  SELECT full_name INTO commenter_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  FOR mentioned_user_id IN
    SELECT DISTINCT (regexp_matches(NEW.content, mention_pattern, 'g'))[2]::uuid
  LOOP
    IF mentioned_user_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, type, title, message, link, reference_id, reference_type)
      VALUES (
        mentioned_user_id,
        'mention',
        'Anda Dimention',
        commenter_name || ' menyebut Anda dalam komentar',
        '/post/' || NEW.post_id,
        NEW.id,
        'comment'
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger functions for cascade delete

-- Delete notifications when post is deleted
CREATE OR REPLACE FUNCTION delete_post_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM notifications 
  WHERE reference_id = OLD.id AND reference_type = 'post';
  
  RETURN OLD;
END;
$$;

-- Delete notifications when comment is deleted
CREATE OR REPLACE FUNCTION delete_comment_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM notifications 
  WHERE reference_id = OLD.id AND reference_type = 'comment';
  
  RETURN OLD;
END;
$$;

-- Delete notifications when like is deleted
CREATE OR REPLACE FUNCTION delete_like_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM notifications 
  WHERE reference_id = OLD.post_id 
  AND reference_type = 'post' 
  AND type = 'like'
  AND user_id = (SELECT user_id FROM posts WHERE id = OLD.post_id);
  
  RETURN OLD;
END;
$$;

-- Create triggers for cascade delete
DROP TRIGGER IF EXISTS trigger_delete_post_notifications ON posts;
CREATE TRIGGER trigger_delete_post_notifications
BEFORE DELETE ON posts
FOR EACH ROW
EXECUTE FUNCTION delete_post_notifications();

DROP TRIGGER IF EXISTS trigger_delete_comment_notifications ON comments;
CREATE TRIGGER trigger_delete_comment_notifications
BEFORE DELETE ON comments
FOR EACH ROW
EXECUTE FUNCTION delete_comment_notifications();

DROP TRIGGER IF EXISTS trigger_delete_like_notifications ON likes;
CREATE TRIGGER trigger_delete_like_notifications
BEFORE DELETE ON likes
FOR EACH ROW
EXECUTE FUNCTION delete_like_notifications();