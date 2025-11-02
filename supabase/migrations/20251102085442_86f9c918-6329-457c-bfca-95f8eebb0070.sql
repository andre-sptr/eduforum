-- Function to create notification for new like
CREATE OR REPLACE FUNCTION public.notify_post_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
      '/'
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Function to create notification for new comment
CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
      '/'
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Function to create notification for new follower
CREATE OR REPLACE FUNCTION public.notify_new_follower()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  follower_name text;
BEGIN
  -- Get follower name
  SELECT full_name INTO follower_name
  FROM profiles
  WHERE id = NEW.follower_id;
  
  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (
    NEW.following_id,
    'follow',
    'Pengikut Baru',
    follower_name || ' mulai mengikuti Anda',
    '/profile/' || NEW.follower_id
  );
  
  RETURN NEW;
END;
$function$;

-- Create triggers
DROP TRIGGER IF EXISTS on_post_like ON public.likes;
CREATE TRIGGER on_post_like
  AFTER INSERT ON public.likes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_post_like();

DROP TRIGGER IF EXISTS on_post_comment ON public.comments;
CREATE TRIGGER on_post_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_post_comment();

DROP TRIGGER IF EXISTS on_new_follow ON public.follows;
CREATE TRIGGER on_new_follow
  AFTER INSERT ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_follower();