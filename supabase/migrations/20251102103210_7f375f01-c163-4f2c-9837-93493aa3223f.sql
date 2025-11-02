-- Update notify_direct_message to only trigger for DM and handle mentions
CREATE OR REPLACE FUNCTION public.notify_direct_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id uuid;
  sender_name text;
  conv_type text;
  conv_id uuid;
  mentioned_user_id uuid;
  mention_pattern text := '@\[([^\]]+)\]\(([a-f0-9\-]+)\)';
BEGIN
  conv_id := NEW.conversation_id;
  
  -- Get conversation type
  SELECT type INTO conv_type
  FROM conversations
  WHERE id = conv_id;
  
  -- Get sender name
  SELECT full_name INTO sender_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Handle mentions in any chat type
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
        sender_name || ' menyebut Anda dalam chat',
        '/chat/' || conv_id
      );
    END IF;
  END LOOP;
  
  -- Only notify for direct messages (not global or group)
  IF conv_type = 'direct' THEN
    -- Find the other participant (recipient) in the conversation
    FOR recipient_id IN
      SELECT user_id 
      FROM conversation_participants
      WHERE conversation_id = conv_id 
        AND user_id != NEW.user_id
    LOOP
      -- Create notification for recipient
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        recipient_id,
        'dm',
        'Pesan Baru',
        sender_name || ' mengirim pesan kepada Anda',
        '/chat/' || conv_id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add trigger for post mentions
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
        '/'
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Add trigger for comment mentions
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
        '/'
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS on_post_mention ON public.posts;
CREATE TRIGGER on_post_mention
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_post_mention();

DROP TRIGGER IF EXISTS on_comment_mention ON public.comments;
CREATE TRIGGER on_comment_mention
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_comment_mention();