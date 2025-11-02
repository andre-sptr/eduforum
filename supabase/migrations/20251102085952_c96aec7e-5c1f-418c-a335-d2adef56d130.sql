-- Create security definer function to check if user is group admin
CREATE OR REPLACE FUNCTION public.is_group_admin(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE user_id = _user_id
      AND group_id = _group_id
      AND role = 'admin'
  )
$$;

-- Create security definer function to check if user is group member
CREATE OR REPLACE FUNCTION public.is_group_member(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_members
    WHERE user_id = _user_id
      AND group_id = _group_id
  )
$$;

-- Create security definer function to check if user is in conversation
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE user_id = _user_id
      AND conversation_id = _conversation_id
  )
$$;

-- Drop and recreate group_members policies
DROP POLICY IF EXISTS "Admins can update member roles" ON public.group_members;
CREATE POLICY "Admins can update member roles"
ON public.group_members
FOR UPDATE
USING (public.is_group_admin(auth.uid(), group_id));

DROP POLICY IF EXISTS "Group members are viewable by group members" ON public.group_members;
CREATE POLICY "Group members are viewable by group members"
ON public.group_members
FOR SELECT
USING (
  (group_id IN (SELECT id FROM groups WHERE is_private = false))
  OR public.is_group_member(auth.uid(), group_id)
);

-- Drop and recreate conversation_participants policies
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON public.conversation_participants;
CREATE POLICY "Users can view participants in their conversations"
ON public.conversation_participants
FOR SELECT
USING (
  (conversation_id IN (SELECT id FROM conversations WHERE type = 'global'))
  OR public.is_conversation_participant(auth.uid(), conversation_id)
);

DROP POLICY IF EXISTS "Users can join conversations" ON public.conversation_participants;
CREATE POLICY "Users can join conversations"
ON public.conversation_participants
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    (conversation_id IN (SELECT id FROM conversations WHERE type = 'global'))
    OR (conversation_id IN (SELECT id FROM conversations WHERE created_by = auth.uid()))
  )
);