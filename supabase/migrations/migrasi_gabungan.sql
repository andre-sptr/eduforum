-- Create enum for user roles
CREATE TYPE app_role AS ENUM ('siswa', 'guru', 'alumni');

-- Create profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create posts table
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_urls TEXT[], -- Array of media URLs
  media_types TEXT[], -- Array of media types (image, video, audio)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create follows table
CREATE TABLE follows (
  follower_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (follower_id, following_id),
  CHECK (follower_id != following_id)
);

-- Create likes table
CREATE TABLE likes (
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, post_id)
);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Profiles are viewable by everyone" 
  ON profiles FOR SELECT 
  USING (true);

CREATE POLICY "Users can update their own profile" 
  ON profiles FOR UPDATE 
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
  ON profiles FOR INSERT 
  WITH CHECK (auth.uid() = id);

-- RLS Policies for posts
CREATE POLICY "Posts are viewable by everyone" 
  ON posts FOR SELECT 
  USING (true);

CREATE POLICY "Users can create their own posts" 
  ON posts FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts" 
  ON posts FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts" 
  ON posts FOR DELETE 
  USING (auth.uid() = user_id);

-- RLS Policies for follows
CREATE POLICY "Follows are viewable by everyone" 
  ON follows FOR SELECT 
  USING (true);

CREATE POLICY "Users can follow others" 
  ON follows FOR INSERT 
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow" 
  ON follows FOR DELETE 
  USING (auth.uid() = follower_id);

-- RLS Policies for likes
CREATE POLICY "Likes are viewable by everyone" 
  ON likes FOR SELECT 
  USING (true);

CREATE POLICY "Users can like posts" 
  ON likes FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike posts" 
  ON likes FOR DELETE 
  USING (auth.uid() = user_id);

-- Create function to handle new user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    (new.raw_user_meta_data->>'role')::app_role
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Create storage bucket for media
INSERT INTO storage.buckets (id, name, public)
VALUES ('media', 'media', true);

-- Storage policies
CREATE POLICY "Media is publicly accessible" 
  ON storage.objects FOR SELECT 
  USING (bucket_id = 'media');

CREATE POLICY "Users can upload media" 
  ON storage.objects FOR INSERT 
  WITH CHECK (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update their own media" 
  ON storage.objects FOR UPDATE 
  USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own media" 
  ON storage.objects FOR DELETE 
  USING (bucket_id = 'media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Drop the unused trigger and function since we handle profile creation client-side
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Create comments table with threaded replies support
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for comments
CREATE POLICY "Comments are viewable by everyone" 
  ON comments FOR SELECT 
  USING (true);

CREATE POLICY "Users can create comments" 
  ON comments FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" 
  ON comments FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" 
  ON comments FOR DELETE 
  USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_comments_post_id ON comments(post_id);
CREATE INDEX idx_comments_parent_id ON comments(parent_id);

-- Create reposts table
CREATE TABLE reposts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, post_id)
);

-- Enable RLS
ALTER TABLE reposts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reposts
CREATE POLICY "Reposts are viewable by everyone" 
  ON reposts FOR SELECT 
  USING (true);

CREATE POLICY "Users can create reposts" 
  ON reposts FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their reposts" 
  ON reposts FOR DELETE 
  USING (auth.uid() = user_id);

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE comments;

-- Create groups table
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  cover_image TEXT,
  is_private BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create group members table
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Create group posts table
CREATE TABLE group_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_urls TEXT[],
  media_types TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for groups
CREATE POLICY "Public groups are viewable by everyone"
  ON groups FOR SELECT
  USING (is_private = false OR id IN (
    SELECT group_id FROM group_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create groups"
  ON groups FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group admins can update groups"
  ON groups FOR UPDATE
  USING (
    id IN (
      SELECT group_id FROM group_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Group admins can delete groups"
  ON groups FOR DELETE
  USING (
    id IN (
      SELECT group_id FROM group_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for group_members
CREATE POLICY "Group members are viewable by group members"
  ON group_members FOR SELECT
  USING (
    group_id IN (
      SELECT id FROM groups WHERE is_private = false
    ) OR group_id IN (
      SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join groups"
  ON group_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave groups"
  ON group_members FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can update member roles"
  ON group_members FOR UPDATE
  USING (
    group_id IN (
      SELECT group_id FROM group_members 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies for group_posts
CREATE POLICY "Group posts are viewable by members"
  ON group_posts FOR SELECT
  USING (
    group_id IN (
      SELECT id FROM groups WHERE is_private = false
    ) OR group_id IN (
      SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can create posts"
  ON group_posts FOR INSERT
  WITH CHECK (
    auth.uid() = user_id AND
    group_id IN (
      SELECT group_id FROM group_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own group posts"
  ON group_posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own group posts"
  ON group_posts FOR DELETE
  USING (auth.uid() = user_id);

-- Function to automatically add creator as admin
CREATE OR REPLACE FUNCTION add_group_creator_as_admin()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_group_created
  AFTER INSERT ON groups
  FOR EACH ROW
  EXECUTE FUNCTION add_group_creator_as_admin();

-- Indexes for better performance
CREATE INDEX idx_group_members_group_id ON group_members(group_id);
CREATE INDEX idx_group_members_user_id ON group_members(user_id);
CREATE INDEX idx_group_posts_group_id ON group_posts(group_id);

-- Create messages table for real-time chat
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT fk_messages_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Messages are viewable by everyone" 
ON public.messages 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create messages" 
ON public.messages 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own messages" 
ON public.messages 
FOR DELETE 
USING (auth.uid() = user_id);

-- Enable realtime for messages table
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Drop existing messages table and recreate with proper structure
DROP TABLE IF EXISTS public.messages CASCADE;

-- Create conversations table for different chat types
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('direct', 'group', 'global')),
  name TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create conversation_participants table
CREATE TABLE public.conversation_participants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Recreate messages table with conversation_id
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Conversations policies
CREATE POLICY "Users can view their conversations"
ON public.conversations
FOR SELECT
USING (
  type = 'global' OR 
  id IN (
    SELECT conversation_id 
    FROM conversation_participants 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can create conversations"
ON public.conversations
FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Conversation creators can update their conversations"
ON public.conversations
FOR UPDATE
USING (auth.uid() = created_by);

CREATE POLICY "Conversation creators can delete their conversations"
ON public.conversations
FOR DELETE
USING (auth.uid() = created_by);

-- Conversation participants policies
CREATE POLICY "Users can view participants in their conversations"
ON public.conversation_participants
FOR SELECT
USING (
  conversation_id IN (
    SELECT id FROM conversations WHERE type = 'global'
  ) OR
  conversation_id IN (
    SELECT conversation_id 
    FROM conversation_participants 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can join conversations"
ON public.conversation_participants
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND (
    conversation_id IN (SELECT id FROM conversations WHERE type = 'global') OR
    conversation_id IN (SELECT id FROM conversations WHERE created_by = auth.uid())
  )
);

CREATE POLICY "Users can leave conversations"
ON public.conversation_participants
FOR DELETE
USING (auth.uid() = user_id);

-- Messages policies
CREATE POLICY "Users can view messages in their conversations"
ON public.messages
FOR SELECT
USING (
  conversation_id IN (
    SELECT id FROM conversations WHERE type = 'global'
  ) OR
  conversation_id IN (
    SELECT conversation_id 
    FROM conversation_participants 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can send messages to their conversations"
ON public.messages
FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  conversation_id IN (
    SELECT conversation_id 
    FROM conversation_participants 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can delete their own messages"
ON public.messages
FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Fix 1: Create separate user_roles table with security definer function
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Allow users to view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Only admins or system can insert/update roles (initially allow users to set during signup)
CREATE POLICY "Users can insert their initial role"
ON public.user_roles
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Fix 2: Update add_group_creator_as_admin function to set search_path
CREATE OR REPLACE FUNCTION public.add_group_creator_as_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO group_members (group_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin');
  RETURN NEW;
END;
$function$;

-- Fix 3: Update group_posts DELETE policy to allow group admins to moderate
DROP POLICY IF EXISTS "Users can delete their own group posts" ON public.group_posts;

CREATE POLICY "Users and group admins can delete group posts"
ON public.group_posts
FOR DELETE
USING (
  auth.uid() = user_id  -- Post author can delete
  OR 
  group_id IN (  -- Group admins can delete
    SELECT group_id FROM group_members
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Migrate existing roles from profiles to user_roles
INSERT INTO public.user_roles (user_id, role)
SELECT id, role FROM public.profiles
WHERE role IS NOT NULL
ON CONFLICT (user_id, role) DO NOTHING;

-- Note: Keep role column in profiles for backward compatibility during transition
-- It can be removed in a future migration after all code is updated

-- Create table for game scores
CREATE TABLE IF NOT EXISTS public.game_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  game_type text NOT NULL,
  score integer NOT NULL,
  completed_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.game_scores ENABLE ROW LEVEL SECURITY;

-- Policies for game_scores
CREATE POLICY "Game scores are viewable by everyone"
ON public.game_scores
FOR SELECT
USING (true);

CREATE POLICY "Users can insert their own scores"
ON public.game_scores
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scores"
ON public.game_scores
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for better performance on leaderboard queries
CREATE INDEX idx_game_scores_game_type_score ON public.game_scores(game_type, score DESC);
CREATE INDEX idx_game_scores_user_id ON public.game_scores(user_id);

-- Add database constraint for input validation
ALTER TABLE public.game_scores 
ADD CONSTRAINT game_type_length CHECK (char_length(game_type) <= 50);

ALTER TABLE public.game_scores 
ADD CONSTRAINT score_positive CHECK (score >= 0);

-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  link text,
  read boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policies for notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);

-- Allow system to insert notifications (will be done via triggers or edge functions)
CREATE POLICY "System can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(user_id, read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at DESC);

-- Add constraint for notification type
ALTER TABLE public.notifications 
ADD CONSTRAINT notification_type_check CHECK (type IN ('like', 'comment', 'follow', 'mention', 'game', 'system'));

-- Add constraint for input validation
ALTER TABLE public.notifications 
ADD CONSTRAINT title_length CHECK (char_length(title) <= 100);

ALTER TABLE public.notifications 
ADD CONSTRAINT message_length CHECK (char_length(message) <= 500);

-- Function to create notification for new like
CREATE OR REPLACE FUNCTION public.notify_post_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  post_owner_id uuid;
  liker_name text;
BEGIN
  -- Get post owner and liker name
  SELECT p.user_id, pr.full_name INTO post_owner_id, liker_name
  FROM posts p
  JOIN profiles pr ON pr.id = NEW.user_id
  WHERE p.id = NEW.post_id;
  
  -- Don't notify if user likes their own post
  IF post_owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      post_owner_id,
      'like',
      'Postingan Disukai',
      liker_name || ' menyukai postingan Anda',
      '/'
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Function to create notification for new comment
CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  post_owner_id uuid;
  commenter_name text;
BEGIN
  -- Get post owner and commenter name
  SELECT p.user_id, pr.full_name INTO post_owner_id, commenter_name
  FROM posts p
  JOIN profiles pr ON pr.id = NEW.user_id
  WHERE p.id = NEW.post_id;
  
  -- Don't notify if user comments on their own post
  IF post_owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      post_owner_id,
      'comment',
      'Komentar Baru',
      commenter_name || ' mengomentari postingan Anda',
      '/'
    );
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Function to create notification for new follower
CREATE OR REPLACE FUNCTION public.notify_new_follower()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  follower_name text;
BEGIN
  -- Get follower name
  SELECT full_name INTO follower_name
  FROM profiles
  WHERE id = NEW.follower_id;
  
  INSERT INTO notifications (user_id, type, title, message, link)
  VALUES (
    NEW.following_id,
    'follow',
    'Pengikut Baru',
    follower_name || ' mulai mengikuti Anda',
    '/profile/' || NEW.follower_id
  );
  
  RETURN NEW;
END;
$function$;

-- Create triggers
DROP TRIGGER IF EXISTS on_post_like ON public.likes;
CREATE TRIGGER on_post_like
  AFTER INSERT ON public.likes
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_post_like();

DROP TRIGGER IF EXISTS on_post_comment ON public.comments;
CREATE TRIGGER on_post_comment
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_post_comment();

DROP TRIGGER IF EXISTS on_new_follow ON public.follows;
CREATE TRIGGER on_new_follow
  AFTER INSERT ON public.follows
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_follower();

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

-- Create function to notify users when they receive a DM
CREATE OR REPLACE FUNCTION public.notify_direct_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  recipient_id uuid;
  sender_name text;
  conv_type text;
BEGIN
  -- Get conversation type
  SELECT type INTO conv_type
  FROM conversations
  WHERE id = NEW.conversation_id;
  
  -- Only notify for direct messages, not global or group chats
  IF conv_type = 'direct' THEN
    -- Get sender name
    SELECT full_name INTO sender_name
    FROM profiles
    WHERE id = NEW.user_id;
    
    -- Find the other participant (recipient) in the conversation
    FOR recipient_id IN
      SELECT user_id 
      FROM conversation_participants
      WHERE conversation_id = NEW.conversation_id 
        AND user_id != NEW.user_id
    LOOP
      -- Create notification for recipient
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        recipient_id,
        'dm',
        'Pesan Baru',
        sender_name || ' mengirim pesan kepada Anda',
        '/messages'
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger for direct message notifications
DROP TRIGGER IF EXISTS on_direct_message_sent ON messages;
CREATE TRIGGER on_direct_message_sent
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_direct_message();

  -- Add columns for message editing and deletion
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false;

-- Update RLS policy to allow users to update their own messages
CREATE POLICY "Users can update their own messages"
ON public.messages
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Drop the old constraint
ALTER TABLE public.notifications 
DROP CONSTRAINT IF EXISTS notification_type_check;

-- Add updated constraint with 'dm' type included
ALTER TABLE public.notifications 
ADD CONSTRAINT notification_type_check 
CHECK (type = ANY (ARRAY['like'::text, 'comment'::text, 'follow'::text, 'mention'::text, 'game'::text, 'system'::text, 'dm'::text]));

-- Update notify_direct_message to only trigger for DM and handle mentions
CREATE OR REPLACE FUNCTION public.notify_direct_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id uuid;
  sender_name text;
  conv_type text;
  conv_id uuid;
  mentioned_user_id uuid;
  mention_pattern text := '@\[([^\]]+)\]\(([a-f0-9\-]+)\)';
BEGIN
  conv_id := NEW.conversation_id;
  
  -- Get conversation type
  SELECT type INTO conv_type
  FROM conversations
  WHERE id = conv_id;
  
  -- Get sender name
  SELECT full_name INTO sender_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Handle mentions in any chat type
  FOR mentioned_user_id IN
    SELECT DISTINCT (regexp_matches(NEW.content, mention_pattern, 'g'))[2]::uuid
  LOOP
    -- Don't notify if user mentions themselves
    IF mentioned_user_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        mentioned_user_id,
        'mention',
        'Anda Dimention',
        sender_name || ' menyebut Anda dalam chat',
        '/chat/' || conv_id
      );
    END IF;
  END LOOP;
  
  -- Only notify for direct messages (not global or group)
  IF conv_type = 'direct' THEN
    -- Find the other participant (recipient) in the conversation
    FOR recipient_id IN
      SELECT user_id 
      FROM conversation_participants
      WHERE conversation_id = conv_id 
        AND user_id != NEW.user_id
    LOOP
      -- Create notification for recipient
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        recipient_id,
        'dm',
        'Pesan Baru',
        sender_name || ' mengirim pesan kepada Anda',
        '/chat/' || conv_id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add trigger for post mentions
CREATE OR REPLACE FUNCTION public.notify_post_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mention_pattern text := '@\[([^\]]+)\]\(([a-f0-9\-]+)\)';
  mentioned_user_id uuid;
  author_name text;
BEGIN
  -- Get author name
  SELECT full_name INTO author_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Find all mentioned users in the post content
  FOR mentioned_user_id IN
    SELECT DISTINCT (regexp_matches(NEW.content, mention_pattern, 'g'))[2]::uuid
  LOOP
    -- Don't notify if user mentions themselves
    IF mentioned_user_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        mentioned_user_id,
        'mention',
        'Anda Dimention',
        author_name || ' menyebut Anda dalam postingan',
        '/'
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Add trigger for comment mentions
CREATE OR REPLACE FUNCTION public.notify_comment_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mention_pattern text := '@\[([^\]]+)\]\(([a-f0-9\-]+)\)';
  mentioned_user_id uuid;
  commenter_name text;
BEGIN
  -- Get commenter name
  SELECT full_name INTO commenter_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Find all mentioned users in the comment content
  FOR mentioned_user_id IN
    SELECT DISTINCT (regexp_matches(NEW.content, mention_pattern, 'g'))[2]::uuid
  LOOP
    -- Don't notify if user mentions themselves
    IF mentioned_user_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        mentioned_user_id,
        'mention',
        'Anda Dimention',
        commenter_name || ' menyebut Anda dalam komentar',
        '/'
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create triggers
DROP TRIGGER IF EXISTS on_post_mention ON public.posts;
CREATE TRIGGER on_post_mention
  AFTER INSERT ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.notify_post_mention();

DROP TRIGGER IF EXISTS on_comment_mention ON public.comments;
CREATE TRIGGER on_comment_mention
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_comment_mention();

  -- Update notify_direct_message to prevent mentions in private chat
CREATE OR REPLACE FUNCTION public.notify_direct_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id uuid;
  sender_name text;
  conv_type text;
  conv_id uuid;
  mentioned_user_id uuid;
  mention_pattern text := '@\[([^\]]+)\]\(([a-f0-9\-]+)\)';
BEGIN
  conv_id := NEW.conversation_id;
  
  -- Get conversation type
  SELECT type INTO conv_type
  FROM conversations
  WHERE id = conv_id;
  
  -- Get sender name
  SELECT full_name INTO sender_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Handle mentions ONLY in global and group chats (not in direct/private)
  IF conv_type != 'direct' THEN
    FOR mentioned_user_id IN
      SELECT DISTINCT (regexp_matches(NEW.content, mention_pattern, 'g'))[2]::uuid
    LOOP
      -- Don't notify if user mentions themselves
      IF mentioned_user_id != NEW.user_id THEN
        INSERT INTO notifications (user_id, type, title, message, link)
        VALUES (
          mentioned_user_id,
          'mention',
          'Anda Dimention',
          sender_name || ' menyebut Anda dalam chat',
          '/chat/' || conv_id
        );
      END IF;
    END LOOP;
  END IF;
  
  -- Only notify for direct messages (not global or group)
  IF conv_type = 'direct' THEN
    -- Find the other participant (recipient) in the conversation
    FOR recipient_id IN
      SELECT user_id 
      FROM conversation_participants
      WHERE conversation_id = conv_id 
        AND user_id != NEW.user_id
    LOOP
      -- Create notification for recipient
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        recipient_id,
        'dm',
        'Pesan Baru',
        sender_name || ' mengirim pesan kepada Anda',
        '/chat/' || conv_id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update notify_direct_message to prevent mentions in private chat
CREATE OR REPLACE FUNCTION public.notify_direct_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recipient_id uuid;
  sender_name text;
  conv_type text;
  conv_id uuid;
  mentioned_user_id uuid;
  mention_pattern text := '@\[([^\]]+)\]\(([a-f0-9\-]+)\)';
BEGIN
  conv_id := NEW.conversation_id;
  
  -- Get conversation type
  SELECT type INTO conv_type
  FROM conversations
  WHERE id = conv_id;
  
  -- Get sender name
  SELECT full_name INTO sender_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Handle mentions ONLY in global and group chats (not in direct/private)
  IF conv_type != 'direct' THEN
    FOR mentioned_user_id IN
      SELECT DISTINCT (regexp_matches(NEW.content, mention_pattern, 'g'))[2]::uuid
    LOOP
      -- Don't notify if user mentions themselves
      IF mentioned_user_id != NEW.user_id THEN
        INSERT INTO notifications (user_id, type, title, message, link)
        VALUES (
          mentioned_user_id,
          'mention',
          'Anda Dimention',
          sender_name || ' menyebut Anda dalam chat',
          '/chat/' || conv_id
        );
      END IF;
    END LOOP;
  END IF;
  
  -- Only notify for direct messages (not global or group)
  IF conv_type = 'direct' THEN
    -- Find the other participant (recipient) in the conversation
    FOR recipient_id IN
      SELECT user_id 
      FROM conversation_participants
      WHERE conversation_id = conv_id 
        AND user_id != NEW.user_id
    LOOP
      -- Create notification for recipient
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        recipient_id,
        'dm',
        'Pesan Baru',
        sender_name || ' mengirim pesan kepada Anda',
        '/chat/' || conv_id
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update notification triggers to link to specific posts

-- Update notify_post_like function to link to post page
CREATE OR REPLACE FUNCTION public.notify_post_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_owner_id uuid;
  liker_name text;
BEGIN
  -- Get post owner and liker name
  SELECT p.user_id, pr.full_name INTO post_owner_id, liker_name
  FROM posts p
  JOIN profiles pr ON pr.id = NEW.user_id
  WHERE p.id = NEW.post_id;
  
  -- Don't notify if user likes their own post
  IF post_owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      post_owner_id,
      'like',
      'Postingan Disukai',
      liker_name || ' menyukai postingan Anda',
      '/post/' || NEW.post_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update notify_post_comment function to link to post page
CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_owner_id uuid;
  commenter_name text;
BEGIN
  -- Get post owner and commenter name
  SELECT p.user_id, pr.full_name INTO post_owner_id, commenter_name
  FROM posts p
  JOIN profiles pr ON pr.id = NEW.user_id
  WHERE p.id = NEW.post_id;
  
  -- Don't notify if user comments on their own post
  IF post_owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      post_owner_id,
      'comment',
      'Komentar Baru',
      commenter_name || ' mengomentari postingan Anda',
      '/post/' || NEW.post_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update notify_post_mention function to link to post page
CREATE OR REPLACE FUNCTION public.notify_post_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mention_pattern text := '@\[([^\]]+)\]\(([a-f0-9\-]+)\)';
  mentioned_user_id uuid;
  author_name text;
BEGIN
  -- Get author name
  SELECT full_name INTO author_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Find all mentioned users in the post content
  FOR mentioned_user_id IN
    SELECT DISTINCT (regexp_matches(NEW.content, mention_pattern, 'g'))[2]::uuid
  LOOP
    -- Don't notify if user mentions themselves
    IF mentioned_user_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        mentioned_user_id,
        'mention',
        'Anda Dimention',
        author_name || ' menyebut Anda dalam postingan',
        '/post/' || NEW.id
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Update notify_comment_mention function to link to post page
CREATE OR REPLACE FUNCTION public.notify_comment_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mention_pattern text := '@\[([^\]]+)\]\(([a-f0-9\-]+)\)';
  mentioned_user_id uuid;
  commenter_name text;
BEGIN
  -- Get commenter name
  SELECT full_name INTO commenter_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Find all mentioned users in the comment content
  FOR mentioned_user_id IN
    SELECT DISTINCT (regexp_matches(NEW.content, mention_pattern, 'g'))[2]::uuid
  LOOP
    -- Don't notify if user mentions themselves
    IF mentioned_user_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        mentioned_user_id,
        'mention',
        'Anda Dimention',
        commenter_name || ' menyebut Anda dalam komentar',
        '/post/' || NEW.post_id
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Update notification triggers to link to specific posts

-- Update notify_post_like function to link to post page
CREATE OR REPLACE FUNCTION public.notify_post_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_owner_id uuid;
  liker_name text;
BEGIN
  -- Get post owner and liker name
  SELECT p.user_id, pr.full_name INTO post_owner_id, liker_name
  FROM posts p
  JOIN profiles pr ON pr.id = NEW.user_id
  WHERE p.id = NEW.post_id;
  
  -- Don't notify if user likes their own post
  IF post_owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      post_owner_id,
      'like',
      'Postingan Disukai',
      liker_name || ' menyukai postingan Anda',
      '/post/' || NEW.post_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update notify_post_comment function to link to post page
CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_owner_id uuid;
  commenter_name text;
BEGIN
  -- Get post owner and commenter name
  SELECT p.user_id, pr.full_name INTO post_owner_id, commenter_name
  FROM posts p
  JOIN profiles pr ON pr.id = NEW.user_id
  WHERE p.id = NEW.post_id;
  
  -- Don't notify if user comments on their own post
  IF post_owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      post_owner_id,
      'comment',
      'Komentar Baru',
      commenter_name || ' mengomentari postingan Anda',
      '/post/' || NEW.post_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update notify_post_mention function to link to post page
CREATE OR REPLACE FUNCTION public.notify_post_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mention_pattern text := '@\[([^\]]+)\]\(([a-f0-9\-]+)\)';
  mentioned_user_id uuid;
  author_name text;
BEGIN
  -- Get author name
  SELECT full_name INTO author_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Find all mentioned users in the post content
  FOR mentioned_user_id IN
    SELECT DISTINCT (regexp_matches(NEW.content, mention_pattern, 'g'))[2]::uuid
  LOOP
    -- Don't notify if user mentions themselves
    IF mentioned_user_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        mentioned_user_id,
        'mention',
        'Anda Dimention',
        author_name || ' menyebut Anda dalam postingan',
        '/post/' || NEW.id
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Update notify_comment_mention function to link to post page
CREATE OR REPLACE FUNCTION public.notify_comment_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mention_pattern text := '@\[([^\]]+)\]\(([a-f0-9\-]+)\)';
  mentioned_user_id uuid;
  commenter_name text;
BEGIN
  -- Get commenter name
  SELECT full_name INTO commenter_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  -- Find all mentioned users in the comment content
  FOR mentioned_user_id IN
    SELECT DISTINCT (regexp_matches(NEW.content, mention_pattern, 'g'))[2]::uuid
  LOOP
    -- Don't notify if user mentions themselves
    IF mentioned_user_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES (
        mentioned_user_id,
        'mention',
        'Anda Dimention',
        commenter_name || ' menyebut Anda dalam komentar',
        '/post/' || NEW.post_id
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Add reference columns to notifications table for cascade delete
ALTER TABLE notifications 
ADD COLUMN IF NOT EXISTS reference_id uuid,
ADD COLUMN IF NOT EXISTS reference_type text;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_notifications_reference 
ON notifications(reference_id, reference_type);

-- Update existing notification triggers to include reference_id

-- Update notify_post_like to store reference
CREATE OR REPLACE FUNCTION public.notify_post_like()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_owner_id uuid;
  liker_name text;
BEGIN
  SELECT p.user_id, pr.full_name INTO post_owner_id, liker_name
  FROM posts p
  JOIN profiles pr ON pr.id = NEW.user_id
  WHERE p.id = NEW.post_id;
  
  IF post_owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, title, message, link, reference_id, reference_type)
    VALUES (
      post_owner_id,
      'like',
      'Postingan Disukai',
      liker_name || ' menyukai postingan Anda',
      '/post/' || NEW.post_id,
      NEW.post_id,
      'post'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update notify_post_comment to store reference
CREATE OR REPLACE FUNCTION public.notify_post_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_owner_id uuid;
  commenter_name text;
BEGIN
  SELECT p.user_id, pr.full_name INTO post_owner_id, commenter_name
  FROM posts p
  JOIN profiles pr ON pr.id = NEW.user_id
  WHERE p.id = NEW.post_id;
  
  IF post_owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, title, message, link, reference_id, reference_type)
    VALUES (
      post_owner_id,
      'comment',
      'Komentar Baru',
      commenter_name || ' mengomentari postingan Anda',
      '/post/' || NEW.post_id,
      NEW.comment_id,
      'comment'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update notify_post_mention to store reference
CREATE OR REPLACE FUNCTION public.notify_post_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mention_pattern text := '@\[([^\]]+)\]\(([a-f0-9\-]+)\)';
  mentioned_user_id uuid;
  author_name text;
BEGIN
  SELECT full_name INTO author_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  FOR mentioned_user_id IN
    SELECT DISTINCT (regexp_matches(NEW.content, mention_pattern, 'g'))[2]::uuid
  LOOP
    IF mentioned_user_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, type, title, message, link, reference_id, reference_type)
      VALUES (
        mentioned_user_id,
        'mention',
        'Anda Dimention',
        author_name || ' menyebut Anda dalam postingan',
        '/post/' || NEW.id,
        NEW.id,
        'post'
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Update notify_comment_mention to store reference
CREATE OR REPLACE FUNCTION public.notify_comment_mention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mention_pattern text := '@\[([^\]]+)\]\(([a-f0-9\-]+)\)';
  mentioned_user_id uuid;
  commenter_name text;
BEGIN
  SELECT full_name INTO commenter_name
  FROM profiles
  WHERE id = NEW.user_id;
  
  FOR mentioned_user_id IN
    SELECT DISTINCT (regexp_matches(NEW.content, mention_pattern, 'g'))[2]::uuid
  LOOP
    IF mentioned_user_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, type, title, message, link, reference_id, reference_type)
      VALUES (
        mentioned_user_id,
        'mention',
        'Anda Dimention',
        commenter_name || ' menyebut Anda dalam komentar',
        '/post/' || NEW.post_id,
        NEW.id,
        'comment'
      );
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger functions for cascade delete

-- Delete notifications when post is deleted
CREATE OR REPLACE FUNCTION delete_post_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM notifications 
  WHERE reference_id = OLD.id AND reference_type = 'post';
  
  RETURN OLD;
END;
$$;

-- Delete notifications when comment is deleted
CREATE OR REPLACE FUNCTION delete_comment_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM notifications 
  WHERE reference_id = OLD.id AND reference_type = 'comment';
  
  RETURN OLD;
END;
$$;

-- Delete notifications when like is deleted
CREATE OR REPLACE FUNCTION delete_like_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM notifications 
  WHERE reference_id = OLD.post_id 
  AND reference_type = 'post' 
  AND type = 'like'
  AND user_id = (SELECT user_id FROM posts WHERE id = OLD.post_id);
  
  RETURN OLD;
END;
$$;

-- Create triggers for cascade delete
DROP TRIGGER IF EXISTS trigger_delete_post_notifications ON posts;
CREATE TRIGGER trigger_delete_post_notifications
BEFORE DELETE ON posts
FOR EACH ROW
EXECUTE FUNCTION delete_post_notifications();

DROP TRIGGER IF EXISTS trigger_delete_comment_notifications ON comments;
CREATE TRIGGER trigger_delete_comment_notifications
BEFORE DELETE ON comments
FOR EACH ROW
EXECUTE FUNCTION delete_comment_notifications();

DROP TRIGGER IF EXISTS trigger_delete_like_notifications ON likes;
CREATE TRIGGER trigger_delete_like_notifications
BEFORE DELETE ON likes
FOR EACH ROW
EXECUTE FUNCTION delete_like_notifications();

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

  -- Add cascade delete for nested comments (parent-child relationship)
-- Drop existing foreign key if exists and recreate with CASCADE
ALTER TABLE comments
DROP CONSTRAINT IF EXISTS comments_parent_id_fkey;

ALTER TABLE comments
ADD CONSTRAINT comments_parent_id_fkey 
FOREIGN KEY (parent_id) 
REFERENCES comments(id) 
ON DELETE CASCADE;

-- Enable realtime for posts table
ALTER TABLE posts REPLICA IDENTITY FULL;

-- Add posts table to realtime publication (skip comments as it's already added)
ALTER PUBLICATION supabase_realtime ADD TABLE posts;

-- Enable realtime for likes table
ALTER TABLE likes REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE likes;

-- Update handle_new_user function to include full_name and role from metadata
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