-- Drop the unused trigger and function since we handle profile creation client-side
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;