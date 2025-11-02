-- Drop the old constraint
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notification_type_check;

-- Add updated constraint with 'dm' type included
ALTER TABLE public.notifications 
ADD CONSTRAINT notification_type_check 
CHECK (type = ANY (ARRAY['like'::text, 'comment'::text, 'follow'::text, 'mention'::text, 'game'::text, 'system'::text, 'dm'::text]));