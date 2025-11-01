import {
  Moon, Sun, LogOut, Search, Bell, User, Heart,
  MessageCircle, MessageSquare, Repeat, AtSign
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { UserAvatar } from "./UserAvatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type NotifType = "like" | "comment_like" | "repost" | "comment" | "follow" | "chat_message" | "mention" | "mention_post" | "mention_comment";
type Notification = {
  id: string; type: NotifType | string; is_read: boolean; created_at: string; room_id: string | null;
  post_id?: string | null; actor: { name: string; avatar_text: string; username: string };
};
type NavbarProps = { userName?: string; userInitials?: string };
type UserProfileData = { id: string; name: string; avatar_text: string; username: string };

const isMention = (t: Notification["type"]) => t === "mention" || t === "mention_post" || t === "mention_comment";
const fmtTime = (t?: string | null) => {
  if (!t) return "beberapa saat lalu";
  const mins = Math.floor((Date.now() - new Date(t).getTime()) / 60000);
  if (mins < 1) return "Baru saja";
  if (mins < 60) return `${mins} menit lalu`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  return `${Math.floor(hours / 24)} hari lalu`;
};

export const Navbar = ({ userName, userInitials }: NavbarProps) => {
  const [isDark, setIsDark] = useState(() => localStorage.getItem("theme")?.toString() === "dark" || window.matchMedia("(prefers-color-scheme: dark)").matches);
  useEffect(() => { document.documentElement.classList.toggle("dark", isDark); localStorage.setItem("theme", isDark ? "dark" : "light"); }, [isDark]);

  const { signOut, user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [hasNewActivity, setHasNewActivity] = useState(false);
  const [hasNewChat, setHasNewChat] = useState(false);

  const selectCols = "id, type, is_read, created_at, room_id, post_id, actor:profiles!actor_id (name, avatar_text, username)";

  const getNotifs = async (isChat: boolean) => {
    if (!user) return [] as Notification[];
    const base = supabase
      .from("notifications")
      .select(selectCols)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    const query = isChat ? base.eq("type", "chat_message") : base.neq("type", "chat_message");
    const { data } = await query;   
    return data ?? [];
  };

  const { data: activity = [], isLoading: loadingActivity } = useQuery<Notification[]>({
    queryKey: ["activity_notifications", user?.id],
    queryFn: () => getNotifs(false),
    enabled: !!user,
  });
  const { data: chats = [], isLoading: loadingChats } = useQuery<Notification[]>({
    queryKey: ["chat_notifications", user?.id],
    queryFn: () => getNotifs(true),
    enabled: !!user,
  });

  useEffect(() => setHasNewActivity(activity.some(n => !n.is_read)), [activity]);
  useEffect(() => setHasNewChat(chats.some(n => !n.is_read)), [chats]);

  const markRead = async (isChat: boolean) => {
    if (!user) return;
    const qb = supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    return isChat ? await qb.eq("type", "chat_message") : await qb.neq("type", "chat_message");
  };

  const mReadActivity = useMutation({
    mutationFn: () => markRead(false),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["activity_notifications", user?.id] }),
  });

  const mReadChat = useMutation({
    mutationFn: () => markRead(true),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chat_notifications", user?.id] }),
  });

  const onOpenActivity = (open: boolean) => open && hasNewActivity && (setHasNewActivity(false), mReadActivity.mutate());
  const onOpenChat = (open: boolean) => open && hasNewChat && (setHasNewChat(false), mReadChat.mutate());

  const renderNotifText = (n: Notification) => {
    const actor = <span className="font-semibold">{n.actor.name}</span>;
    switch (n.type) {
      case "like": return <>{actor} menyukai postingan Anda.</>;
      case "comment_like": return <>{actor} menyukai komentar Anda.</>;
      case "repost": return <>{actor} me-repost postingan Anda.</>;
      case "comment": return <>{actor} mengomentari postingan Anda.</>;
      case "chat_message": return <>{actor} mengirimi Anda pesan.</>;
      case "follow": return <>{actor} mulai mengikuti Anda.</>;
      case "mention":
      case "mention_post": return <>{actor} menyebut Anda dalam postingan.</>;
      case "mention_comment": return <>{actor} menyebut Anda dalam komentar.</>;
      default: return <>{actor} mengirim notifikasi baru.</>;
    }
  };

  const isClickable = (n: Notification) => (n.type === "chat_message" && n.room_id) || n.post_id || (n.type === "follow" && n.actor);
  const onClickNotif = (n: Notification) => {
    if (n.type === "chat_message" && n.room_id) navigate(`/chat/${n.room_id}`);
    else if (n.post_id) navigate(`/post/${n.post_id}`);
    else if (n.type === "follow" && n.actor) navigate(`/profile/u/${encodeURIComponent(n.actor.username)}`);
  };

  const { data: me } = useQuery<UserProfileData | null>({
    queryKey: ["currentUserProfileSidebar", user?.id],
    enabled: !!user,
    staleTime: Infinity,
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("id,name,avatar_text,username")
        .eq("id", user.id)
        .maybeSingle();
      return data ?? null;
    },
  });

  const BadgePing = () => (
    <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
    </span>
  );

  const List = ({ items, loading, isChat = false }: { items: Notification[]; loading: boolean; isChat?: boolean }) => (
    <PopoverContent align="end" className="w-80 p-0">
      <div className="p-4 border-b"><h4 className="font-medium leading-none">{isChat ? "Pesan" : "Notifikasi"}</h4></div>
      <div className="max-h-[400px] overflow-y-auto">
        {loading ? (
          <p className="p-4 text-sm text-center text-muted-foreground">Memuat{isChat ? " pesan" : ""}...</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-center text-muted-foreground">{isChat ? "Tidak ada pesan baru." : "Tidak ada aktivitas baru."}</p>
        ) : items.map((n, i) => {
          const clickable = isClickable(n);
          return (
            <div
              key={n.id}
              className={`flex items-start gap-3 p-4 transition-colors ${i ? "border-t" : ""} ${clickable ? "hover:bg-muted cursor-pointer" : "cursor-default"}`}
              onClick={() => clickable && onClickNotif(n)}
            >
              <div className="mt-1 flex-shrink-0 w-4">
                {isChat ? <MessageSquare className="h-4 w-4 text-green-500" /> :
                  n.type === "like" || n.type === "comment_like" ? <Heart className="h-4 w-4 text-red-500" /> :
                  n.type === "repost" ? <Repeat className="h-4 w-4 text-green-500" /> :
                  n.type === "comment" ? <MessageCircle className="h-4 w-4 text-blue-500" /> :
                  n.type === "follow" ? <User className="h-4 w-4 text-blue-500" /> :
                  isMention(n.type) ? <AtSign className="h-4 w-4 text-indigo-500" /> : null}
              </div>
              <UserAvatar name={n.actor.name} initials={n.actor.avatar_text} size="sm" />
              <div className="flex-1">
                <p className={`text-sm ${!n.is_read ? "text-foreground" : "text-muted-foreground"}`}>{renderNotifText(n)}</p>
                <p className="text-xs text-muted-foreground">{fmtTime(n.created_at)}</p>
              </div>
              {!n.is_read && <span className="flex h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
            </div>
          );
        })}
      </div>
    </PopoverContent>
  );

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between gap-6 px-4">
        <div className="flex items-center gap-2">
          <img src="/favicon.png" alt="EduForum Logo" className="h-8 w-8" decoding="async" />
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">EduForum</span>
        </div>

        <div className="flex-1 max-w-sm hidden md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search" placeholder="Cari postingan, topik, atau pengguna..." className="pl-9"
              value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && q.trim()) { navigate(`/search?q=${encodeURIComponent(q.trim())}`); setQ(""); } }}
            />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Popover onOpenChange={onOpenChat}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full relative">
                <MessageSquare className="h-5 w-5" />
                {hasNewChat && <BadgePing />}
              </Button>
            </PopoverTrigger>
            <List items={chats} loading={loadingChats} isChat />
          </Popover>

          <Popover onOpenChange={onOpenActivity}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full relative">
                <Bell className="h-5 w-5" />
                {hasNewActivity && <BadgePing />}
              </Button>
            </PopoverTrigger>
            <List items={activity} loading={loadingActivity} />
          </Popover>

          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setIsDark(d => !d)}>
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          {userName && userInitials && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="rounded-full p-1 h-9 w-9">
                  <UserAvatar name={userName} initials={userInitials} size="sm" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild className="gap-2 cursor-pointer">
                  <Link to={me?.name ? `/profile/u/${encodeURIComponent(me.username)}` : "/settings/profile"}>
                    <User className="h-4 w-4" /><span>Profil Saya</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="gap-2 cursor-pointer text-red-500 focus:text-red-500">
                  <LogOut className="h-4 w-4" /><span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </nav>
  );
};
