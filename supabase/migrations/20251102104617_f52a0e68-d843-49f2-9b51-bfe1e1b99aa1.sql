-- Update notification triggers to link to specific posts

-- Update notify_post_like function to link to post page
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
  -- Get post owner and liker name
  SELECT p.user_id, pr.full_name INTO post_owner_id, liker_name
  FROM posts p
  JOIN profiles pr ON pr.id = NEW.user_id
  WHERE p.id = NEW.post_id;
  
  -- Don't notify if user likes their own post
  IF post_owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      post_owner_id,
      'like',
      'Postingan Disukai',
      liker_name || ' menyukai postingan Anda',
      '/post/' || NEW.post_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update notify_post_comment function to link to post page
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
  -- Get post owner and commenter name
  SELECT p.user_id, pr.full_name INTO post_owner_id, commenter_name
  FROM posts p
  JOIN profiles pr ON pr.id = NEW.user_id
  WHERE p.id = NEW.post_id;
  
  -- Don't notify if user comments on their own post
  IF post_owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      post_owner_id,
      'comment',
      'Komentar Baru',
      commenter_name || ' mengomentari postingan Anda',
      '/post/' || NEW.post_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update notify_post_mention function to link to post page
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
  -- Get author name
  SELECT full_name INTO author_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Find all mentioned users in the post content
  FOR mentioned_user_id IN
    SELECT DISTINCT (regexp_matches(NEW.content, mention_pattern, 'g'))[2]::uuid
  LOOP
    -- Don't notify if user mentions themselves
    IF mentioned_user_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        mentioned_user_id,
        'mention',
        'Anda Dimention',
        author_name || ' menyebut Anda dalam postingan',
        '/post/' || NEW.id
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Update notify_comment_mention function to link to post page
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
  -- Get commenter name
  SELECT full_name INTO commenter_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Find all mentioned users in the comment content
  FOR mentioned_user_id IN
    SELECT DISTINCT (regexp_matches(NEW.content, mention_pattern, 'g'))[2]::uuid
  LOOP
    -- Don't notify if user mentions themselves
    IF mentioned_user_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        mentioned_user_id,
        'mention',
        'Anda Dimention',
        commenter_name || ' menyebut Anda dalam komentar',
        '/post/' || NEW.post_id
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;