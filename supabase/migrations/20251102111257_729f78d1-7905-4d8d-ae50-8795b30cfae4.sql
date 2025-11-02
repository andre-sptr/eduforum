-- Fix create_group_conversation function - add search_path for security
CREATE OR REPLACE FUNCTION public.create_group_conversation(p_group_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_conversation_id UUID;
  v_group_name TEXT;
  v_member_record RECORD;
BEGIN
  -- Check if user is a member of the group
  IF NOT EXISTS (
    SELECT 1 FROM group_members
    WHERE group_id = p_group_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'User is not a member of this group';
  END IF;

  -- Get group name
  SELECT name INTO v_group_name FROM groups WHERE id = p_group_id;

  -- Check if conversation already exists for this group
  SELECT id INTO v_conversation_id
  FROM conversations
  WHERE group_id = p_group_id AND type = 'group';

  -- If not exists, create new conversation
  IF v_conversation_id IS NULL THEN
    INSERT INTO conversations (name, type, group_id, created_by)
    VALUES (v_group_name, 'group', p_group_id, auth.uid())
    RETURNING id INTO v_conversation_id;

    -- Add all group members as participants
    FOR v_member_record IN
      SELECT user_id FROM group_members WHERE group_id = p_group_id
    LOOP
      INSERT INTO conversation_participants (conversation_id, user_id)
      VALUES (v_conversation_id, v_member_record.user_id)
      ON CONFLICT DO NOTHING;
    END LOOP;
  ELSE
    -- Ensure current user is a participant
    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES (v_conversation_id, auth.uid())
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_conversation_id;
END;
$function$;

-- Create function to auto-create profile when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, bio, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    COALESCE(NEW.raw_user_meta_data->>'bio', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'siswa'::app_role)
  );
  RETURN NEW;
END;
$$;

-- Create trigger to automatically create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();