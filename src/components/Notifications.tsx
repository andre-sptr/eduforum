import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, X, Heart, MessageCircle, Repeat2, UserPlus, AtSign, Gamepad2, Info } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";

interface Notification { id:string; type:string; title:string; message:string; link?:string; read:boolean; created_at:string }

const typeIcon = {
  like: Heart,
  comment: MessageCircle,
  repost: Repeat2,
  follow: UserPlus,
  mention: AtSign,
  game: Gamepad2,
  system: Info
} as const;

const typeStyle = {
  like: "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20",
  comment: "bg-sky-500/10 text-sky-400 ring-1 ring-sky-500/20",
  repost: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
  follow: "bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/20",
  mention: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
  game: "bg-indigo-500/10 text-indigo-400 ring-1 ring-indigo-500/20",
  system: "bg-zinc-500/10 text-zinc-400 ring-1 ring-zinc-500/20",
  default: "bg-muted text-muted-foreground ring-1 ring-border/60"
};

export function Notifications({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [notifications,setNotifications]=useState<Notification[]>([]);
  const [unreadCount,setUnreadCount]=useState(0);
  const [markingAll,setMarkingAll]=useState(false);

  useEffect(()=>{ load();
    const ch=supabase.channel(`notifications-${userId}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"notifications",filter:`user_id=eq.${userId}`},load)
      .subscribe();
    return()=>{ supabase.removeChannel(ch); };
  },[userId]);

  const load=async()=> {
    const { data } = await supabase.from("notifications").select("*").eq("user_id",userId).neq("type","dm").order("created_at",{ascending:false}).limit(50);
    if(data){ setNotifications(data); setUnreadCount(data.filter(n=>!n.read).length); }
  };

  const markAsReadLocal=(id:string)=> {
    setNotifications(p=>p.map(n=>n.id===id?{...n,read:true}:n));
    const t=notifications.find(n=>n.id===id); if(t && !t.read) setUnreadCount(c=>Math.max(0,c-1));
  };

  const markAsRead=async(id:string)=>{ markAsReadLocal(id); const { error }=await supabase.from("notifications").update({read:true}).eq("id",id); if(error) load(); };

  const handleClick=async(n:Notification)=>{ if(!n.read) await markAsRead(n.id); if(n.link) navigate(n.link); };

  const remove=async(id:string,e:React.MouseEvent)=>{ e.stopPropagation(); const t=notifications.find(n=>n.id===id); setNotifications(p=>p.filter(n=>n.id!==id)); if(t && !t.read) setUnreadCount(c=>Math.max(0,c-1)); const { error }=await supabase.from("notifications").delete().eq("id",id); if(error) load(); };

  const markAll=async()=>{ setMarkingAll(true); setNotifications(p=>p.map(n=>n.type!=="dm"?{...n,read:true}:n)); setUnreadCount(0); await supabase.from("notifications").update({read:true}).eq("user_id",userId).neq("type","dm").eq("read",false); setMarkingAll(false); };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative rounded-2xl ring-1 ring-border hover:ring-accent/50">
          <Bell className="h-5 w-5" />
          {unreadCount>0&&(
            <Badge className="absolute -top-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-accent p-0 text-[11px] font-medium text-accent-foreground shadow">
              {unreadCount>9?"9+":unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 overflow-hidden rounded-2xl p-0">
        <div className="flex items-center justify-between border-b border-border bg-card/80 px-4 py-2">
          <h3 className="text-sm font-semibold">Notifikasi</h3>
          {unreadCount>0&&(
            <Button variant="ghost" size="sm" onClick={markAll} disabled={markingAll} className="h-7 rounded-full px-2 text-xs text-accent hover:text-accent/80">
              {markingAll?"Memproses...":"Tandai semua dibaca"}
            </Button>
          )}
        </div>

        <ScrollArea className="h-[420px]">
          {notifications.length===0?(
            <div className="grid place-items-center gap-1 py-10 text-center">
              <div className="grid h-10 w-10 place-items-center rounded-xl ring-1 ring-border">
                <Bell className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Tidak ada notifikasi</p>
            </div>
          ):(
            <div className="divide-y divide-border/80">
              {notifications.map(n=>{
                const Icon=(typeIcon as any)[n.type]??Info;
                const chip=(typeStyle as any)[n.type]??typeStyle.default;
                return (
                  <DropdownMenuItem
                    key={n.id}
                    className={`cursor-pointer rounded-none px-4 py-3 data-[highlighted]:bg-accent/10 ${!n.read?"bg-accent/5":""}`}
                    onClick={()=>handleClick(n)}
                  >
                    <div className="flex w-full items-start gap-3">
                      <div className={`mt-0.5 grid h-9 w-9 place-items-center rounded-xl ${chip}`}>
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`truncate text-sm font-medium ${!n.read?"text-foreground":"text-muted-foreground"}`}>{n.title}</p>
                          <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1 text-muted-foreground hover:text-foreground" onClick={(e)=>remove(n.id,e)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                        <p className="mt-1 text-[11px] text-muted-foreground/80">{formatDistanceToNow(new Date(n.created_at),{addSuffix:true,locale:id})}</p>
                      </div>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}