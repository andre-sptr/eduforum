import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Check, Trash2, Heart, MessageCircle, Repeat2, UserPlus, AtSign, Gamepad2, Info, Users, ArrowLeft } from "lucide-react";
import { formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  created_at: string;
}

const typeIcon = {
  like: Heart,
  comment: MessageCircle,
  repost: Repeat2,
  follow: UserPlus,
  mention: AtSign,
  game: Gamepad2,
  group_invite: Users,
  system: Info
} as const;

const typeStyle = {
  like: "bg-rose-500/10 text-rose-500",
  comment: "bg-sky-500/10 text-sky-500",
  repost: "bg-emerald-500/10 text-emerald-500",
  follow: "bg-violet-500/10 text-violet-500",
  mention: "bg-amber-500/10 text-amber-500",
  game: "bg-indigo-500/10 text-indigo-500",
  group_invite: "bg-cyan-500/10 text-cyan-500",
  system: "bg-zinc-500/10 text-zinc-500",
  default: "bg-muted text-muted-foreground"
};

export default function Notifications() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    checkUserAndLoad();
  }, []);

  const checkUserAndLoad = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    await loadNotifications(user.id);
    
    const ch = supabase.channel(`notifications-page-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` }, () => loadNotifications(user.id))
      .subscribe();
      
    return () => { supabase.removeChannel(ch); };
  };

  const loadNotifications = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .neq("type", "dm") 
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;
      setNotifications(data || []);
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    toast.success("Semua notifikasi ditandai sudah dibaca");
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications(prev => prev.filter(n => n.id !== id));
    await supabase.from("notifications").delete().eq("id", id);
    toast.success("Notifikasi dihapus");
  };

  const handleClick = async (n: Notification) => {
    if (!n.read) {
      setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item));
      await supabase.from("notifications").update({ read: true }).eq("id", n.id);
    }
    if (n.link) navigate(n.link);
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.read;
    if (filter === "mentions") return n.type === "mention" || n.type === "reply" || n.type === "comment";
    return true;
  });

  const groupedNotifications = filteredNotifications.reduce((acc, n) => {
    const date = new Date(n.created_at);
    let key = "Earlier";
    if (isToday(date)) key = "Hari Ini";
    else if (isYesterday(date)) key = "Kemarin";
    
    if (!acc[key]) acc[key] = [];
    acc[key].push(n);
    return acc;
  }, {} as Record<string, Notification[]>);

  const groupOrder = ["Hari Ini", "Kemarin", "Earlier"];

  if (loading) return (
    <div className="container max-w-2xl py-8 space-y-4">
      <div className="flex items-center justify-between mb-6">
         <Skeleton className="h-8 w-48" />
         <Skeleton className="h-9 w-24" />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 p-4 rounded-xl border border-border/50">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2 flex-1">
             <Skeleton className="h-4 w-3/4" />
             <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="container max-w-3xl py-8 min-h-screen space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="md:hidden">
                <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                Notifikasi
                {notifications.filter(n => !n.read).length > 0 && (
                    <Badge variant="destructive" className="rounded-full px-2 text-xs">
                    {notifications.filter(n => !n.read).length}
                    </Badge>
                )}
                </h1>
                <p className="text-muted-foreground text-sm">Update terbaru aktivitas akun Anda</p>
            </div>
        </div>
        
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleMarkAllRead} disabled={!notifications.some(n => !n.read)}>
                <Check className="h-4 w-4 mr-2" />
                Tandai semua dibaca
            </Button>
        </div>
      </div>

      <Tabs defaultValue="all" value={filter} onValueChange={setFilter} className="w-full">
        <TabsList className="grid grid-cols-3 w-full sm:w-[400px] mb-6">
          <TabsTrigger value="all">Semua</TabsTrigger>
          <TabsTrigger value="unread">Belum Dibaca</TabsTrigger>
          <TabsTrigger value="mentions">Mentions</TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="mt-0 space-y-8 animate-in fade-in-50 duration-500">
          {filteredNotifications.length === 0 ? (
            <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border">
              <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                 <Bell className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium text-foreground">Tidak ada notifikasi</h3>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto mt-1">
                {filter === "all" ? "Anda belum memiliki notifikasi apapun saat ini." : "Tidak ada notifikasi yang sesuai dengan filter ini."}
              </p>
            </div>
          ) : (
            groupOrder.map(groupKey => {
               const groupItems = groupedNotifications[groupKey];
               if (!groupItems?.length) return null;
               
               return (
                   <div key={groupKey} className="space-y-4">
                       <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider pl-1">{groupKey}</h3>
                       <div className="space-y-2">
                           {groupItems.map(n => {
                               const Icon = (typeIcon as any)[n.type] ?? Info;
                               const iconStyle = (typeStyle as any)[n.type] ?? typeStyle.default;
                               
                               return (
                                   <div 
                                      key={n.id} 
                                      className={`group relative flex gap-4 p-4 rounded-2xl border transition-all duration-200 cursor-pointer hover:shadow-md ${n.read ? "bg-card border-border/40" : "bg-card border-primary/20 shadow-sm ring-1 ring-primary/5"}`}
                                      onClick={() => handleClick(n)}
                                   >
                                      <div className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${iconStyle}`}>
                                          <Icon className="h-5 w-5" />
                                      </div>
                                      
                                      <div className="flex-1 min-w-0 space-y-1">
                                          <div className="flex items-start justify-between gap-2">
                                              <p className={`text-sm font-semibold ${!n.read ? "text-foreground" : "text-muted-foreground"}`}>
                                                  {n.title}
                                              </p>
                                              <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                                                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: idLocale })}
                                              </span>
                                          </div>
                                          <p className={`text-sm ${!n.read ? "text-foreground/90" : "text-muted-foreground"} line-clamp-2`}>
                                              {n.message}
                                          </p>
                                      </div>
                                      
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                        onClick={(e) => handleDelete(n.id, e)}
                                      >
                                          <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                      
                                      {!n.read && (
                                          <div className="absolute top-1/2 -translate-y-1/2 right-4 h-2 w-2 rounded-full bg-primary md:static md:hidden" />
                                      )}
                                   </div>
                               );
                           })}
                       </div>
                   </div>
               );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
