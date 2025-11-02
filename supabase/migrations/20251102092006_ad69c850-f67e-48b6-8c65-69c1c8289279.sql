-- Helper functions to avoid policy recursion
CREATE OR REPLACE FUNCTION public.conversation_is_global(_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conversation_id AND c.type = 'global'
  );
$$;

CREATE OR REPLACE FUNCTION public.conversation_is_created_by_user(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conversation_id AND c.created_by = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_conversation(_conversation_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conversation_id 
      AND (c.type = 'global' OR c.created_by = _user_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.conversation_participants p
    WHERE p.conversation_id = _conversation_id AND p.user_id = _user_id
  );
$$;

-- Update conversations SELECT policy to use helper function
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;
CREATE POLICY "Users can view their conversations"
ON public.conversations
FOR SELECT
USING (public.can_view_conversation(id, auth.uid()));

-- Update conversation_participants SELECT to avoid recursion using helpers
DROP POLICY IF EXISTS "Users can view participants in their conversations" ON public.conversation_participants;
CREATE POLICY "Users can view participants in their conversations"
ON public.conversation_participants
FOR SELECT
USING (
  public.conversation_is_global(conversation_id)
  OR public.conversation_is_created_by_user(conversation_id, auth.uid())
  OR user_id = auth.uid()
);

-- Update group_members policies to avoid self-reference
DROP POLICY IF EXISTS "Group members are viewable by group members" ON public.group_members;
CREATE POLICY "Group members are viewable by group members"
ON public.group_members
FOR SELECT
USING (
  group_id IN (SELECT id FROM public.groups WHERE is_private = false)
  OR group_id IN (SELECT id FROM public.groups WHERE created_by = auth.uid())
  OR user_id = auth.uid()
);

DROP POLICY IF EXISTS "Admins can update member roles" ON public.group_members;
CREATE POLICY "Group creator can update member roles"
ON public.group_members
FOR UPDATE
USING (
  group_id IN (SELECT id FROM public.groups WHERE created_by = auth.uid())
);
