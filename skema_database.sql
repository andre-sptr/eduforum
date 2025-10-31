


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."create_comment_like_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    recipient_user_id UUID;
    actor_user_id UUID;
BEGIN
    SELECT user_id INTO recipient_user_id
    FROM public.comments
    WHERE id = NEW.comment_id;

    actor_user_id := NEW.user_id;

    IF recipient_user_id IS NOT NULL AND recipient_user_id != actor_user_id THEN
        INSERT INTO public.notifications (user_id, actor_id, type)
        VALUES (recipient_user_id, actor_user_id, 'comment_like');
    END IF;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."create_comment_like_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_or_get_chat_room"("recipient_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  current_user_id uuid := auth.uid(); 
  existing_room_id uuid;
  new_room_id uuid;
BEGIN
  -- 1. Cek chat dengan diri sendiri
  IF current_user_id = recipient_id THEN
    RAISE EXCEPTION 'Tidak bisa chat dengan diri sendiri';
  END IF;

  -- 2. Cari room yang sudah ada
  SELECT cp1.room_id INTO existing_room_id -- <<< PERBAIKAN: Sebutkan cp1.room_id
  FROM public.chat_participants cp1
  JOIN public.chat_participants cp2 ON cp1.room_id = cp2.room_id
  WHERE cp1.user_id = current_user_id AND cp2.user_id = recipient_id
  LIMIT 1;

  -- 3. Jika room sudah ada, kembalikan ID-nya
  IF existing_room_id IS NOT NULL THEN
    RETURN existing_room_id;
  END IF;

  -- 4. Jika belum ada, buat room baru
  INSERT INTO public.chat_rooms DEFAULT VALUES
  RETURNING id INTO new_room_id;

  -- 5. Tambahkan kedua partisipan ke room baru
  INSERT INTO public.chat_participants (room_id, user_id)
  VALUES (new_room_id, current_user_id), (new_room_id, recipient_id);

  -- 6. Kembalikan ID room baru
  RETURN new_room_id;

END;
$$;


ALTER FUNCTION "public"."create_or_get_chat_room"("recipient_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_repost_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    recipient_user_id UUID;
    actor_user_id UUID;
BEGIN
    recipient_user_id := NEW.original_author_id;
    actor_user_id := NEW.user_id;

    IF recipient_user_id IS NOT NULL AND recipient_user_id != actor_user_id THEN
        INSERT INTO public.notifications (user_id, actor_id, type)
        VALUES (recipient_user_id, actor_user_id, 'repost');
    END IF;

    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."create_repost_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_follower_leaderboard"() RETURNS TABLE("user_id" "uuid", "name" "text", "avatar_text" "text", "role" "text", "follower_count" bigint)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
    SELECT
        p.id AS user_id,
        p.name,
        p.avatar_text,
        p.role,
        count(f.follower_id) AS follower_count
    FROM
        public.profiles p
    LEFT JOIN
        public.user_followers f ON p.id = f.following_id
    GROUP BY
        p.id, p.name, p.avatar_text, p.role
    ORDER BY
        follower_count DESC, p.created_at ASC
    LIMIT 5; -- Batasi 5 teratas
$$;


ALTER FUNCTION "public"."get_follower_leaderboard"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_followers_profiles"("p_user_id" "uuid", "p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0, "p_search" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "name" "text", "avatar_text" "text", "role" "text", "created_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select p.id, p.name, p.avatar_text, p.role, uf.created_at
  from public.user_followers uf
  join public.profiles p on p.id = uf.follower_id
  where uf.following_id = p_user_id
    and (p_search is null or p.name ilike '%' || p_search || '%')
  order by uf.created_at desc
  limit p_limit offset p_offset
$$;


ALTER FUNCTION "public"."get_followers_profiles"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer, "p_search" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_following_profiles"("p_user_id" "uuid", "p_limit" integer DEFAULT 20, "p_offset" integer DEFAULT 0, "p_search" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "name" "text", "avatar_text" "text", "role" "text", "created_at" timestamp with time zone)
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select p.id, p.name, p.avatar_text, p.role, uf.created_at
  from public.user_followers uf
  join public.profiles p on p.id = uf.following_id
  where uf.follower_id = p_user_id
    and (p_search is null or p.name ilike '%' || p_search || '%')
  order by uf.created_at desc
  limit p_limit offset p_offset
$$;


ALTER FUNCTION "public"."get_following_profiles"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer, "p_search" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_chat_message_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  recipient_id uuid;
BEGIN
  -- Cari partisipan LAIN di room yang sama dengan pengirim pesan
  SELECT user_id INTO recipient_id
  FROM public.chat_participants
  WHERE room_id = NEW.room_id -- Room tempat pesan baru dikirim
  AND user_id != NEW.sender_id -- Yang BUKAN pengirim pesan
  LIMIT 1; -- Asumsi hanya ada 1 penerima lain (untuk chat 1-on-1)

  -- Jika ditemukan penerima lain
  IF recipient_id IS NOT NULL THEN
    -- Buat notifikasi untuk penerima tersebut
    INSERT INTO public.notifications (user_id, actor_id, type, room_id)
    VALUES (
      recipient_id,   -- Penerima notifikasi
      NEW.sender_id,  -- Pelaku (pengirim pesan)
      'chat_message', -- Tipe notifikasi baru
      NEW.room_id     -- Simpan ID room
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_chat_message_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_comment_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  post_owner_id uuid;
BEGIN
  -- 1. Ambil ID pemilik postingan dari tabel 'posts'
  SELECT user_id INTO post_owner_id
  FROM public.posts
  WHERE id = NEW.post_id;

  -- 2. HANYA buat notifikasi jika ID komentator
  --    TIDAK SAMA DENGAN ID pemilik postingan
  --    (Agar tidak dapat notif saat komen di post sendiri)
  IF NEW.user_id != post_owner_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, post_id)
    VALUES (
      post_owner_id,  -- (Penerima Notif) Siapa pemilik postingan
      NEW.user_id,    -- (Aktor) Siapa yang berkomentar
      'comment',      -- Tipe notifikasinya
      NEW.post_id     -- Postingan yang mana
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_comment_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_follower_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- Cek apakah follower_id berbeda dengan following_id (agar tidak notif diri sendiri)
  IF NEW.follower_id != NEW.following_id THEN
    -- Buat notifikasi untuk pengguna yang DI-FOLLOW
    INSERT INTO public.notifications (user_id, actor_id, type)
    VALUES (
      NEW.following_id,  -- Penerima: Pengguna yang diikuti
      NEW.follower_id,   -- Pelaku: Pengguna yang mem-follow
      'follow'           -- Tipe notifikasi baru
    );
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_follower_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_like_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  post_owner_id uuid;
BEGIN
  -- 1. Ambil ID pemilik postingan dari tabel 'posts'
  SELECT user_id INTO post_owner_id
  FROM public.posts
  WHERE id = NEW.post_id;

  -- 2. HANYA buat notifikasi jika ID 'liker'
  --    TIDAK SAMA DENGAN ID pemilik postingan
  IF NEW.user_id != post_owner_id THEN
    INSERT INTO public.notifications (user_id, actor_id, type, post_id)
    VALUES (
      post_owner_id,  -- (Penerima Notif) Siapa pemilik postingan
      NEW.user_id,    -- (Aktor) Siapa yang me-like
      'like',         -- Tipe notifikasinya
      NEW.post_id     -- Postingan yang mana
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_like_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_text, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    COALESCE(SUBSTRING(NEW.raw_user_meta_data->>'name', 1, 2), 'U'),
    COALESCE(NEW.raw_user_meta_data->>'role', 'Siswa')
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_post_mentions_notification"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  tagged_user_id uuid;
BEGIN
  -- Cek apakah array TIDAK NULL dan memiliki setidaknya satu elemen
  IF NEW.tagged_user_ids IS NOT NULL AND cardinality(NEW.tagged_user_ids) > 0 THEN
    -- Iterasi melalui setiap ID yang di-tag
    FOREACH tagged_user_id IN ARRAY NEW.tagged_user_ids
    LOOP
      -- Cek agar tidak notif diri sendiri
      IF tagged_user_id != NEW.user_id THEN
        -- Masukkan notifikasi ke tabel
        INSERT INTO public.notifications (user_id, actor_id, type, post_id)
        VALUES (
          tagged_user_id,  -- Penerima: User yang di-mention
          NEW.user_id,     -- Pelaku: Pembuat postingan
          'mention',       -- Tipe notifikasi baru
          NEW.id           -- Postingan terkait
        );
      END IF;
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_post_mentions_notification"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_username_available"("p_username" "text") RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  with norm as (
    select public.slugify_username(p_username, '') as u
  )
  select not exists (
    select 1 from public.profiles p
    join norm on true
    where lower(p.username) = lower(norm.u)
  );
$$;


ALTER FUNCTION "public"."is_username_available"("p_username" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_username_available"("desired" "text", "exclude_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS boolean
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'pg_catalog', 'public'
    AS $_$
DECLARE
  candidate text;
  exists_cnt int;
BEGIN
  candidate := slugify_username(desired);

  -- validasi ringan sesuai CHECK di tabel (regex kamu: ^[a-z0-9]+(?:-[a-z0-9]+)*$)
  IF candidate !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' THEN
    RETURN FALSE;
  END IF;

  SELECT count(*) INTO exists_cnt
  FROM public.profiles p
  WHERE p.username = candidate
    AND (exclude_user_id IS NULL OR p.id <> exclude_user_id);

  RETURN exists_cnt = 0;
END;
$_$;


ALTER FUNCTION "public"."is_username_available"("desired" "text", "exclude_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_username"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
declare
  v text;
begin
  v := public.slugify_username(new.username, 'user-' || substr(new.id::text, 1, 8));
  if v = '' then
    v := 'user-' || substr(new.id::text, 1, 8);
  end if;
  new.username := v;
  return new;
end;
$$;


ALTER FUNCTION "public"."normalize_username"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_username"("inp" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  SELECT trim(lower(inp));
$$;


ALTER FUNCTION "public"."normalize_username"("inp" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."repost_post"("post_id_to_repost" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
DECLARE
    original_post_record posts;
BEGIN
    -- 1. Ambil data postingan asli
    SELECT *
    INTO original_post_record
    FROM public.posts
    WHERE id = post_id_to_repost;

    -- 2. Buat entri postingan baru (repost)
    INSERT INTO public.posts (
        user_id,  -- (Sudah kita perbaiki sebelumnya)
        content,
        image_url,
        
        original_post_id,
        original_author_id
    )
    VALUES (
        auth.uid(), 
        original_post_record.content,
        original_post_record.image_url,
        
        original_post_record.id,
        original_post_record.user_id -- (Sudah kita perbaiki sebelumnya)
    );
END;
$$;


ALTER FUNCTION "public"."repost_post"("post_id_to_repost" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slugify_username"("inp" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  -- keep a-z0-9 dan '-' sesuai CHECK constraint pada profiles.username
  SELECT regexp_replace(
           normalize_username(inp),
           '[^a-z0-9-]+',  -- selain a-z 0-9 dash
           '-', 'g'
         );
$$;


ALTER FUNCTION "public"."slugify_username"("inp" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."slugify_username"("p" "text", "fallback" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO 'pg_catalog', 'public'
    AS $$
  select case
    when p is null or btrim(p) = '' then fallback
    else
      trim(both '-' from regexp_replace(lower(p), '[^a-z0-9]+', '-', 'g'))
  end
$$;


ALTER FUNCTION "public"."slugify_username"("p" "text", "fallback" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_comment_like_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.comments
        SET likes_count = likes_count + 1
        WHERE id = NEW.comment_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.comments
        SET likes_count = likes_count - 1
        WHERE id = OLD.comment_id;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_comment_like_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_likes_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.posts
    SET likes_count = likes_count + 1
    WHERE id = NEW.post_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.posts
    SET likes_count = likes_count - 1
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_likes_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_post_counts"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.posts
    SET comments_count = comments_count + 1
    WHERE id = NEW.post_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.posts
    SET comments_count = comments_count - 1
    WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_post_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_post_like_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE public.posts
        SET likes_count = likes_count + 1
        WHERE id = NEW.post_id;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE public.posts
        SET likes_count = likes_count - 1
        WHERE id = OLD.post_id;
    END IF;
    RETURN NULL;
END;
$$;


ALTER FUNCTION "public"."update_post_like_count"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_room_last_message_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.chat_rooms
  SET last_message_at = NOW()
  WHERE id = NEW.room_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_room_last_message_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_room_last_message_at"("room_id" "uuid", "last_message_at" timestamp with time zone) RETURNS "void"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.rooms
  SET last_message_at = last_message_at
  WHERE id = room_id;
END;
$$;


ALTER FUNCTION "public"."update_room_last_message_at"("room_id" "uuid", "last_message_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."chat_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chat_messages_content_check" CHECK (("char_length"("content") > 0))
);


ALTER TABLE "public"."chat_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_participants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "room_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."chat_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."chat_rooms" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_message_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."chat_rooms" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comment_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "comment_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."comment_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "image_url" "text",
    "likes_count" integer DEFAULT 0 NOT NULL,
    "tagged_user_ids" "uuid"[],
    "parent_comment_id" "uuid"
);


ALTER TABLE "public"."comments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "actor_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "post_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "room_id" "uuid"
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."post_likes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "post_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."post_likes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."posts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text",
    "image_url" "text",
    "likes_count" integer DEFAULT 0,
    "comments_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "original_post_id" "uuid",
    "original_author_id" "uuid",
    "tagged_user_ids" "uuid"[]
);


ALTER TABLE "public"."posts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "bio" "text",
    "avatar_text" "text" NOT NULL,
    "role" "text" DEFAULT 'Siswa'::"text" NOT NULL,
    "total_posts" integer DEFAULT 0,
    "total_likes" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "username" "text",
    CONSTRAINT "profiles_role_check" CHECK (("role" = ANY (ARRAY['Siswa'::"text", 'Guru'::"text", 'Alumni'::"text"]))),
    CONSTRAINT "profiles_username_slug_valid" CHECK (("username" ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::"text"))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_followers" (
    "follower_id" "uuid" NOT NULL,
    "following_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_followers" OWNER TO "postgres";


ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_room_id_user_id_key" UNIQUE ("room_id", "user_id");



ALTER TABLE ONLY "public"."chat_rooms"
    ADD CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_user_comment_key" UNIQUE ("user_id", "comment_id");



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_post_id_user_id_key" UNIQUE ("post_id", "user_id");



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "unique_post_mention" UNIQUE ("user_id", "actor_id", "type", "post_id");



ALTER TABLE ONLY "public"."user_followers"
    ADD CONSTRAINT "user_followers_pkey" PRIMARY KEY ("follower_id", "following_id");



CREATE UNIQUE INDEX "uq_profiles_username_ci" ON "public"."profiles" USING "btree" ("lower"("username"));



CREATE OR REPLACE TRIGGER "on_comment_like_delete" AFTER DELETE ON "public"."comment_likes" FOR EACH ROW EXECUTE FUNCTION "public"."update_comment_like_count"();



CREATE OR REPLACE TRIGGER "on_comment_like_insert" AFTER INSERT ON "public"."comment_likes" FOR EACH ROW EXECUTE FUNCTION "public"."update_comment_like_count"();



CREATE OR REPLACE TRIGGER "on_comment_like_notification" AFTER INSERT ON "public"."comment_likes" FOR EACH ROW EXECUTE FUNCTION "public"."create_comment_like_notification"();



CREATE OR REPLACE TRIGGER "on_post_like_delete" AFTER DELETE ON "public"."post_likes" FOR EACH ROW EXECUTE FUNCTION "public"."update_post_like_count"();



CREATE OR REPLACE TRIGGER "on_post_like_insert" AFTER INSERT ON "public"."post_likes" FOR EACH ROW EXECUTE FUNCTION "public"."update_post_like_count"();



CREATE OR REPLACE TRIGGER "on_repost_notification" AFTER INSERT ON "public"."posts" FOR EACH ROW WHEN (("new"."original_post_id" IS NOT NULL)) EXECUTE FUNCTION "public"."create_repost_notification"();



CREATE OR REPLACE TRIGGER "trg_profiles_normalize_username" BEFORE INSERT OR UPDATE OF "username" ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."normalize_username"();



CREATE OR REPLACE TRIGGER "trigger_comment_notification" AFTER INSERT ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_comment_notification"();



CREATE OR REPLACE TRIGGER "trigger_like_notification" AFTER INSERT ON "public"."post_likes" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_like_notification"();



CREATE OR REPLACE TRIGGER "trigger_new_chat_message_notification" AFTER INSERT ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_chat_message_notification"();



CREATE OR REPLACE TRIGGER "trigger_new_follower" AFTER INSERT ON "public"."user_followers" FOR EACH ROW EXECUTE FUNCTION "public"."handle_new_follower_notification"();



CREATE OR REPLACE TRIGGER "trigger_new_mentions" AFTER INSERT ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."handle_post_mentions_notification"();



CREATE OR REPLACE TRIGGER "update_chat_room_last_message_at" AFTER INSERT ON "public"."chat_messages" FOR EACH ROW EXECUTE FUNCTION "public"."update_room_last_message_at"();



CREATE OR REPLACE TRIGGER "update_comments_count" AFTER INSERT OR DELETE ON "public"."comments" FOR EACH ROW EXECUTE FUNCTION "public"."update_post_counts"();



CREATE OR REPLACE TRIGGER "update_posts_updated_at" BEFORE UPDATE ON "public"."posts" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "update_profiles_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_messages"
    ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "public"."comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comment_likes"
    ADD CONSTRAINT "comment_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."comments"
    ADD CONSTRAINT "fk_parent_comment" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."comments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "public"."chat_rooms"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "public"."posts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."post_likes"
    ADD CONSTRAINT "post_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_original_author_id_fkey" FOREIGN KEY ("original_author_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_original_post_id_fkey" FOREIGN KEY ("original_post_id") REFERENCES "public"."posts"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."posts"
    ADD CONSTRAINT "posts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_followers"
    ADD CONSTRAINT "user_followers_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_followers"
    ADD CONSTRAINT "user_followers_following_id_fkey" FOREIGN KEY ("following_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Allow authenticated message read access (TEMPORARY)" ON "public"."chat_messages" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated read access (TEMPORARY)" ON "public"."chat_participants" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated user to create notifications" ON "public"."notifications" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "actor_id"));



CREATE POLICY "Allow authenticated user to follow others" ON "public"."user_followers" FOR INSERT WITH CHECK (("auth"."uid"() = "follower_id"));



CREATE POLICY "Allow authenticated user to unfollow" ON "public"."user_followers" FOR DELETE USING (("auth"."uid"() = "follower_id"));



CREATE POLICY "Allow insert access for message participants" ON "public"."chat_messages" FOR INSERT WITH CHECK ((("sender_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."chat_participants"
  WHERE (("chat_participants"."room_id" = "chat_messages"."room_id") AND ("chat_participants"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Allow logged-in user to insert room" ON "public"."chat_rooms" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Allow public read of follow relationships" ON "public"."user_followers" FOR SELECT USING (true);



CREATE POLICY "Allow read access to participants" ON "public"."chat_rooms" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."chat_participants"
  WHERE (("chat_participants"."room_id" = "chat_participants"."id") AND ("chat_participants"."user_id" = "auth"."uid"())))));



CREATE POLICY "Allow user to join room" ON "public"."chat_participants" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Anyone can view comments" ON "public"."comments" FOR SELECT USING (true);



CREATE POLICY "Anyone can view likes" ON "public"."post_likes" FOR SELECT USING (true);



CREATE POLICY "Anyone can view posts" ON "public"."posts" FOR SELECT USING (true);



CREATE POLICY "Anyone can view profiles" ON "public"."profiles" FOR SELECT USING (true);



CREATE POLICY "Authenticated users can create comments" ON "public"."comments" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can create posts" ON "public"."posts" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Authenticated users can like posts" ON "public"."post_likes" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own comments" ON "public"."comments" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete own posts" ON "public"."posts" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can insert own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can manage their own comment likes" ON "public"."comment_likes" USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can mark their own notifications as read." ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can see their own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can unlike posts" ON "public"."post_likes" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own posts" ON "public"."posts" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."chat_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chat_rooms" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comment_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."comments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "notif_insert" ON "public"."notifications" FOR INSERT WITH CHECK (("auth"."uid"() = "actor_id"));



CREATE POLICY "notif_select" ON "public"."notifications" FOR SELECT USING ((("auth"."uid"() = "user_id") OR ("auth"."uid"() = "actor_id")));



CREATE POLICY "notif_update" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."post_likes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."posts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_followers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "user_followers_delete_self" ON "public"."user_followers" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "follower_id"));



CREATE POLICY "user_followers_insert_self" ON "public"."user_followers" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "follower_id"));



CREATE POLICY "user_followers_select_all" ON "public"."user_followers" FOR SELECT TO "authenticated" USING (true);





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."chat_messages";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."create_comment_like_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_comment_like_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_comment_like_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_or_get_chat_room"("recipient_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_or_get_chat_room"("recipient_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_or_get_chat_room"("recipient_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_repost_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_repost_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_repost_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_follower_leaderboard"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_follower_leaderboard"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_follower_leaderboard"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_followers_profiles"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer, "p_search" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_followers_profiles"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer, "p_search" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_followers_profiles"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer, "p_search" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_followers_profiles"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer, "p_search" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_following_profiles"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer, "p_search" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_following_profiles"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer, "p_search" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_following_profiles"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer, "p_search" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_following_profiles"("p_user_id" "uuid", "p_limit" integer, "p_offset" integer, "p_search" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_chat_message_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_chat_message_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_chat_message_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_comment_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_comment_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_comment_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_follower_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_follower_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_follower_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_like_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_like_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_like_notification"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_post_mentions_notification"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_post_mentions_notification"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_post_mentions_notification"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_username_available"("p_username" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_username_available"("p_username" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_username_available"("p_username" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_username_available"("p_username" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_username_available"("desired" "text", "exclude_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_username_available"("desired" "text", "exclude_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_username_available"("desired" "text", "exclude_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_username"() TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_username"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_username"() TO "service_role";



GRANT ALL ON FUNCTION "public"."normalize_username"("inp" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."normalize_username"("inp" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."normalize_username"("inp" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."repost_post"("post_id_to_repost" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."repost_post"("post_id_to_repost" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."repost_post"("post_id_to_repost" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."slugify_username"("inp" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."slugify_username"("inp" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."slugify_username"("inp" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."slugify_username"("p" "text", "fallback" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."slugify_username"("p" "text", "fallback" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."slugify_username"("p" "text", "fallback" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_comment_like_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_comment_like_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_comment_like_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_likes_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_likes_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_likes_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_post_counts"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_post_counts"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_post_counts"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_post_like_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_post_like_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_post_like_count"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_room_last_message_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_room_last_message_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_room_last_message_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_room_last_message_at"("room_id" "uuid", "last_message_at" timestamp with time zone) TO "anon";
GRANT ALL ON FUNCTION "public"."update_room_last_message_at"("room_id" "uuid", "last_message_at" timestamp with time zone) TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_room_last_message_at"("room_id" "uuid", "last_message_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."chat_messages" TO "anon";
GRANT ALL ON TABLE "public"."chat_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_messages" TO "service_role";



GRANT ALL ON TABLE "public"."chat_participants" TO "anon";
GRANT ALL ON TABLE "public"."chat_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_participants" TO "service_role";



GRANT ALL ON TABLE "public"."chat_rooms" TO "anon";
GRANT ALL ON TABLE "public"."chat_rooms" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_rooms" TO "service_role";



GRANT ALL ON TABLE "public"."comment_likes" TO "anon";
GRANT ALL ON TABLE "public"."comment_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."comment_likes" TO "service_role";



GRANT ALL ON TABLE "public"."comments" TO "anon";
GRANT ALL ON TABLE "public"."comments" TO "authenticated";
GRANT ALL ON TABLE "public"."comments" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."post_likes" TO "anon";
GRANT ALL ON TABLE "public"."post_likes" TO "authenticated";
GRANT ALL ON TABLE "public"."post_likes" TO "service_role";



GRANT ALL ON TABLE "public"."posts" TO "anon";
GRANT ALL ON TABLE "public"."posts" TO "authenticated";
GRANT ALL ON TABLE "public"."posts" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_followers" TO "anon";
GRANT ALL ON TABLE "public"."user_followers" TO "authenticated";
GRANT ALL ON TABLE "public"."user_followers" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































