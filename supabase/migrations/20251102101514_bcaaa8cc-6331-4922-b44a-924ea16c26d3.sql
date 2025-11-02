-- Create function to notify users when they receive a DM
CREATE OR REPLACE FUNCTION public.notify_direct_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recipient_id uuid;
  sender_name text;
  conv_type text;
BEGIN
  -- Get conversation type
  SELECT type INTO conv_type
  FROM conversations
  WHERE id = NEW.conversation_id;
  
  -- Only notify for direct messages, not global or group chats
  IF conv_type = 'direct' THEN
    -- Get sender name
    SELECT full_name INTO sender_name
    FROM profiles
    WHERE id = NEW.user_id;
    
    -- Find the other participant (recipient) in the conversation
    FOR recipient_id IN
      SELECT user_id 
      FROM conversation_participants
      WHERE conversation_id = NEW.conversation_id 
        AND user_id != NEW.user_id
    LOOP
      -- Create notification for recipient
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        recipient_id,
        'dm',
        'Pesan Baru',
        sender_name || ' mengirim pesan kepada Anda',
        '/messages'
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for direct message notifications
DROP TRIGGER IF EXISTS on_direct_message_sent ON messages;
CREATE TRIGGER on_direct_message_sent
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_direct_message();