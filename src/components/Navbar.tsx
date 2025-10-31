import { Moon, Sun, LogOut, Search, Bell, User, Heart, MessageCircle, MessageSquare, Repeat, AtSign } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { UserAvatar } from "./UserAvatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type NotifType =
  | "like"
  | "comment_like"
  | "repost"
  | "comment"
  | "follow"
  | "chat_message"
  | "mention"
  | "mention_post"
  | "mention_comment";

interface Notification {
  id: string;
  type: NotifType | string;
  is_read: boolean;
  created_at: string;
  room_id: string | null;
  post_id?: string | null;
  actor: { name: string; avatar_text: string };
}

interface NavbarProps {
  userName?: string;
  userInitials?: string;
}

interface UserProfileData {
  id: string;
  name: string;
  avatar_text: string;
}

const isMentionType = (t: Notification["type"]) => t === "mention" || t === "mention_post" || t === "mention_comment";

const formatTime = (t: string | null | undefined) => {
  if (!t) return "beberapa saat lalu";
  try {
    const diff = Date.now() - new Date(t).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Baru saja";
    if (mins < 60) return `${mins} menit lalu`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} jam lalu`;
    const days = Math.floor(hours / 24);
    return `${days} hari lalu`;
  } catch {
    return "Waktu tidak valid";
  }
};

export const Navbar = ({ userName, userInitials }: NavbarProps): JSX.Element => {
  const initialDark = useMemo(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    if (saved) return saved === "dark";
    return typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)").matches : false;
  }, []);
  const [isDark, setIsDark] = useState(initialDark);

  useEffect(() => {
    const theme = isDark ? "dark" : "light";
    if (isDark) document.documentElement.classList.add("dark");
    else document.documentElement.classList.remove("dark");
    localStorage.setItem("theme", theme);
  }, [isDark]);

  const { signOut, user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [hasNewActivityNotif, setHasNewActivityNotif] = useState(false);
  const [hasNewChatNotif, setHasNewChatNotif] = useState(false);

  const { data: activityNotifications = [], isLoading: isLoadingActivityNotifs } = useQuery<Notification[]>({
    queryKey: ["activity_notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select(`id, type, is_read, created_at, room_id, post_id, actor:profiles!actor_id (name, avatar_text)`)
        .eq("user_id", user!.id)
        .neq("type", "chat_message")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw new Error(error.message);
      return data || [];
    },
  });

  const { data: chatNotifications = [], isLoading: isLoadingChatNotifs } = useQuery<Notification[]>({
    queryKey: ["chat_notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select(`id, type, is_read, created_at, room_id, post_id, actor:profiles!actor_id (name, avatar_text)`)
        .eq("user_id", user!.id)
        .eq("type", "chat_message")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw new Error(error.message);
      return data || [];
    },
  });

  useEffect(() => {
    if (activityNotifications.length > 0) setHasNewActivityNotif(activityNotifications.some((n) => !n.is_read));
  }, [activityNotifications]);

  useEffect(() => {
    if (chatNotifications.length > 0) setHasNewChatNotif(chatNotifications.some((n) => !n.is_read));
  }, [chatNotifications]);

  const markActivityAsReadMutation = useMutation({
    mutationFn: async () =>
      await supabase.from("notifications").update({ is_read: true }).eq("user_id", user!.id).eq("is_read", false).neq("type", "chat_message"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity_notifications", user?.id] });
    },
  });

  const markChatAsReadMutation = useMutation({
    mutationFn: async () =>
      await supabase.from("notifications").update({ is_read: true }).eq("user_id", user!.id).eq("is_read", false).eq("type", "chat_message"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chat_notifications", user?.id] });
    },
  });

  const handleOpenActivityNotifs = useCallback(
    (isOpen: boolean) => {
      if (isOpen && hasNewActivityNotif) {
        setHasNewActivityNotif(false);
        markActivityAsReadMutation.mutate();
      }
    },
    [hasNewActivityNotif, markActivityAsReadMutation]
  );

  const handleOpenChatNotifs = useCallback(
    (isOpen: boolean) => {
      if (isOpen && hasNewChatNotif) {
        setHasNewChatNotif(false);
        markChatAsReadMutation.mutate();
      }
    },
    [hasNewChatNotif, markChatAsReadMutation]
  );

  const renderNotificationText = useCallback((notif: Notification) => {
    const actorName = <span className="font-semibold">{notif.actor.name}</span>;
    switch (notif.type) {
      case "like":
        return <>{actorName} menyukai postingan Anda.</>;
      case "comment_like":
        return <>{actorName} menyukai komentar Anda.</>;
      case "repost":
        return <>{actorName} me-repost postingan Anda.</>;
      case "comment":
        return <>{actorName} mengomentari postingan Anda.</>;
      case "chat_message":
        return <>{actorName} mengirimi Anda pesan.</>;
      case "follow":
        return <>{actorName} mulai mengikuti Anda.</>;
      case "mention":
      case "mention_post":
        return <>{actorName} menyebut Anda dalam postingan.</>;
      case "mention_comment":
        return <>{actorName} menyebut Anda dalam komentar.</>;
      default:
        return <>{actorName} mengirim notifikasi baru.</>;
    }
  }, []);

  const toggleTheme = useCallback(() => setIsDark((v) => !v), []);
  const handleSearchSubmit = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Enter" && searchQuery.trim()) {
        navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
        setSearchQuery("");
      }
    },
    [navigate, searchQuery]
  );

  const handleNotificationClick = useCallback(
    (notif: Notification) => {
      if (notif.type === "chat_message" && notif.room_id) navigate(`/chat/${notif.room_id}`);
      else if (notif.post_id) navigate(`/post/${notif.post_id}`);
      else if (notif.type === "follow" && notif.actor) navigate(`/profile/name/${encodeURIComponent(notif.actor.name)}`);
    },
    [navigate]
  );

  const isNotificationClickable = (notif: Notification) => {
    if (notif.type === "chat_message" && notif.room_id) return true;
    if (notif.post_id) return true;
    if (notif.type === "follow" && notif.actor) return true;
    return false;
  };

  const { data: currentUserProfile } = useQuery<UserProfileData | null>({
    queryKey: ["currentUserProfileSidebar", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, name, avatar_text").eq("id", user!.id).maybeSingle();
      return data;
    },
    staleTime: Infinity,
  });

  const myProfileLink = currentUserProfile?.name ? `/profile/name/${encodeURIComponent(currentUserProfile.name)}` : `/settings/profile`;

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center justify-between gap-6 px-4">
        <div className="flex items-center gap-2">
          <img src="/favicon.png" alt="EduForum Logo" className="h-8 w-8" />
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">EduForum</span>
        </div>

        <div className="flex-1 max-w-sm hidden md:block">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Cari postingan, topik, atau pengguna..."
              className="pl-9"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchSubmit}
            />
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Popover onOpenChange={handleOpenChatNotifs}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full relative" aria-label="Pesan">
                <MessageSquare className="h-5 w-5" />
                {hasNewChatNotif && (
                  <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="p-4 border-b">
                <h4 className="font-medium leading-none">Pesan</h4>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {isLoadingChatNotifs ? (
                  <p className="p-4 text-sm text-center text-muted-foreground">Memuat pesan...</p>
                ) : chatNotifications.length === 0 ? (
                  <p className="p-4 text-sm text-center text-muted-foreground">Tidak ada pesan baru.</p>
                ) : (
                  chatNotifications.map((notif, index) => {
                    const clickable = isNotificationClickable(notif);
                    return (
                      <div
                        key={notif.id}
                        className={`flex items-start gap-3 p-4 transition-colors ${index > 0 ? "border-t" : ""} ${
                          clickable ? "hover:bg-muted cursor-pointer" : "cursor-default"
                        }`}
                        onClick={() => {
                          if (clickable) handleNotificationClick(notif);
                        }}
                      >
                        <div className="mt-1 flex-shrink-0 w-4">
                          <MessageSquare className="h-4 w-4 text-green-500" />
                        </div>
                        <UserAvatar name={notif.actor.name} initials={notif.actor.avatar_text} size="sm" />
                        <div className="flex-1">
                          <p className={`text-sm ${!notif.is_read ? "text-foreground" : "text-muted-foreground"}`}>{renderNotificationText(notif)}</p>
                          <p className="text-xs text-muted-foreground">{formatTime(notif.created_at)}</p>
                        </div>
                        {!notif.is_read && <span className="flex h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
                      </div>
                    );
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>

          <Popover onOpenChange={handleOpenActivityNotifs}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full relative" aria-label="Notifikasi">
                <Bell className="h-5 w-5" />
                {hasNewActivityNotif && (
                  <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
              <div className="p-4 border-b">
                <h4 className="font-medium leading-none">Notifikasi</h4>
              </div>
              <div className="max-h-[400px] overflow-y-auto">
                {isLoadingActivityNotifs ? (
                  <p className="p-4 text-sm text-center text-muted-foreground">Memuat...</p>
                ) : activityNotifications.length === 0 ? (
                  <p className="p-4 text-sm text-center text-muted-foreground">Tidak ada aktivitas baru.</p>
                ) : (
                  activityNotifications.map((notif, index) => {
                    const clickable = isNotificationClickable(notif);
                    return (
                      <div
                        key={notif.id}
                        className={`flex items-start gap-3 p-4 transition-colors ${index > 0 ? "border-t" : ""} ${
                          clickable ? "hover:bg-muted cursor-pointer" : "cursor-default"
                        }`}
                        onClick={() => {
                          if (clickable) handleNotificationClick(notif);
                        }}
                      >
                        <div className="mt-1 flex-shrink-0 w-4">
                          {notif.type === "like" && <Heart className="h-4 w-4 text-red-500" />}
                          {notif.type === "comment_like" && <Heart className="h-4 w-4 text-red-500" />}
                          {notif.type === "repost" && <Repeat className="h-4 w-4 text-green-500" />}
                          {notif.type === "comment" && <MessageCircle className="h-4 w-4 text-blue-500" />}
                          {notif.type === "follow" && <User className="h-4 w-4 text-blue-500" />}
                          {isMentionType(notif.type) && <AtSign className="h-4 w-4 text-indigo-500" />}
                        </div>
                        <UserAvatar name={notif.actor.name} initials={notif.actor.avatar_text} size="sm" />
                        <div className="flex-1">
                          <p className={`text-sm ${!notif.is_read ? "text-foreground" : "text-muted-foreground"}`}>{renderNotificationText(notif)}</p>
                          <p className="text-xs text-muted-foreground">{formatTime(notif.created_at)}</p>
                        </div>
                        {!notif.is_read && <span className="flex h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1.5" />}
                      </div>
                    );
                  })
                )}
              </div>
            </PopoverContent>
          </Popover>

          <Button variant="ghost" size="icon" className="rounded-full" onClick={toggleTheme} aria-label="Toggle theme">
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
                  <Link to={currentUserProfile?.name ? `/profile/name/${encodeURIComponent(currentUserProfile.name)}` : "/settings/profile"}>
                    <User className="h-4 w-4" />
                    <span>Profil Saya</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="gap-2 cursor-pointer text-red-500 focus:text-red-500">
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </nav>
  );
};