-- Create RPC to create/find a direct conversation between two users
create or replace function public.create_direct_conversation(target_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conv_id uuid;
  uid uuid;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'not authenticated';
  end if;

  -- Find existing direct conversation with exactly these two participants
  select c.id into conv_id
  from public.conversations c
  join public.conversation_participants p1 on p1.conversation_id = c.id and p1.user_id = uid
  join public.conversation_participants p2 on p2.conversation_id = c.id and p2.user_id = target_user_id
  where c.type = 'direct'
  group by c.id
  having count(*) = 2
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
