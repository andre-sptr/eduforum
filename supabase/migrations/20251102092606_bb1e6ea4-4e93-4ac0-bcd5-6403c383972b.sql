-- Create helper function for groups to avoid recursion
CREATE OR REPLACE FUNCTION public.user_can_view_group(_group_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.groups g
    WHERE g.id = _group_id 
      AND (g.is_private = false OR g.created_by = _user_id)
  )
  OR EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = _group_id AND gm.user_id = _user_id
  );
$$;

-- Update groups SELECT policy
DROP POLICY IF EXISTS "Public groups are viewable by everyone" ON public.groups;
CREATE POLICY "Public groups are viewable by everyone"
ON public.groups
FOR SELECT
USING (public.user_can_view_group(id, auth.uid()));