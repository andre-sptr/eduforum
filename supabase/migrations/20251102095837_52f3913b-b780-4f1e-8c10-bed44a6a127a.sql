-- Add group_id column to conversations table to link group conversations
ALTER TABLE public.conversations
ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE;

-- Create index for better performance when querying group conversations
CREATE INDEX idx_conversations_group_id ON public.conversations(group_id);

-- Create function to get or create group conversation
CREATE OR REPLACE FUNCTION create_group_conversation(p_group_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;