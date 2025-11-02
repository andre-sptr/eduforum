-- Drop policies first before dropping functions
DROP POLICY IF EXISTS "Group creator can update member roles" ON public.group_members;
DROP POLICY IF EXISTS "Admins can update member roles" ON public.group_members;
DROP POLICY IF EXISTS "Group members selectable per visibility" ON public.group_members;
DROP POLICY IF EXISTS "Group members are viewable by group members" ON public.group_members;
DROP POLICY IF EXISTS "View participants: global/creator/self" ON public.conversation_participants;
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON public.conversation_participants;

-- Now drop functions
DROP FUNCTION IF EXISTS public.is_group_admin(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_group_member(uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS public.is_conversation_participant(uuid, uuid) CASCADE;

-- Create new policies for group_members without recursion
CREATE POLICY "Group creator updates members"
ON public.group_members
FOR UPDATE
USING (
  group_id IN (SELECT id FROM public.groups WHERE created_by = auth.uid())
);

CREATE POLICY "View group members by visibility"
ON public.group_members
FOR SELECT
USING (
  group_id IN (SELECT id FROM public.groups WHERE is_private = false)
  OR group_id IN (SELECT id FROM public.groups WHERE created_by = auth.uid())
  OR user_id = auth.uid()
);

-- Create new policy for conversation_participants without recursion
CREATE POLICY "View conversation participants"
ON public.conversation_participants
FOR SELECT
USING (
  (conversation_id IN (SELECT id FROM public.conversations WHERE type = 'global'))
  OR (EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_participants.conversation_id
      AND c.created_by = auth.uid()
  ))
  OR (user_id = auth.uid())
);