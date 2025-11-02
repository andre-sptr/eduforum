-- Fix the create_direct_conversation function to properly find existing conversations
create or replace function public.create_direct_conversation(target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conv_id uuid;
  uid uuid;
  participant_count int;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Find existing direct conversation between these two users
  -- A conversation should have exactly 2 participants: uid and target_user_id
  select c.id into conv_id
  from public.conversations c
  where c.type = 'direct'
    and exists (
      select 1 from public.conversation_participants cp1 
      where cp1.conversation_id = c.id and cp1.user_id = uid
    )
    and exists (
      select 1 from public.conversation_participants cp2 
      where cp2.conversation_id = c.id and cp2.user_id = target_user_id
    )
    and (
      select count(*) from public.conversation_participants cp 
      where cp.conversation_id = c.id
    ) = 2
  limit 1;

  if conv_id is not null then
    return conv_id;
  end if;

  -- Create new conversation as the current user
  insert into public.conversations (type, created_by)
  values ('direct', uid)
  returning id into conv_id;

  -- Add both users as participants
  insert into public.conversation_participants (conversation_id, user_id)
  values (conv_id, uid),
         (conv_id, target_user_id);

  return conv_id;
end;
$$;