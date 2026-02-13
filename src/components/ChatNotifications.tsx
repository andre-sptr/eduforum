import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { MessageCircle, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";

interface Notification { id:string; type:string; title:string; message:string; link?:string; read:boolean; created_at:string }

export function ChatNotifications({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [notifications,setNotifications]=useState<Notification[]>([]);
  const [unreadCount,setUnreadCount]=useState(0);
  const [markingAll,setMarkingAll]=useState(false);

  useEffect(()=>{ loadNotifications();
    const channel=supabase.channel(`chat-notifications-${userId}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"notifications",filter:`user_id=eq.${userId}`},()=>loadNotifications())
      .subscribe();
    return()=>{ supabase.removeChannel(channel); };
  },[userId]);

  const loadNotifications=async()=> {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id",userId)
      .eq("type","dm")
      .order("created_at",{ascending:false})
      .limit(50);
    if(!error && data){
      setNotifications(data);
      setUnreadCount(data.filter(n=>!n.read).length);
    }
  };

  const markAsReadLocal=(id:string)=> {
    setNotifications(prev=>prev.map(n=>n.id===id?{...n,read:true}:n));
    setUnreadCount(prev=>{
      const target=notifications.find(n=>n.id===id);
      return target && !target.read ? Math.max(0, prev-1) : prev;
    });
  };

  const markAsRead=async(id:string)=> {
    markAsReadLocal(id);
    const { error } = await supabase.from("notifications").update({read:true}).eq("id",id);
    if(error) loadNotifications();
  };

  const handleNotificationClick=async(n:Notification)=> {
    if(!n.read) await markAsRead(n.id);
    if(n.link) navigate(n.link);
  };

  const deleteNotification=async(id:string,e:React.MouseEvent)=> {
    e.stopPropagation();
    const toRemove=notifications.find(n=>n.id===id);
    setNotifications(prev=>prev.filter(n=>n.id!==id));
    if(toRemove && !toRemove.read) setUnreadCount(c=>Math.max(0,c-1));
    const { error } = await supabase.from("notifications").delete().eq("id",id);
    if(error) loadNotifications();
  };

  const markAllAsRead=async()=> {
    try{
      setMarkingAll(true);
      setNotifications(prev=>prev.map(n=>n.type==="dm"?{...n,read:true}:n));
      setUnreadCount(0);
      const { error } = await supabase
        .from("notifications")
        .update({read:true})
        .eq("user_id",userId)
        .eq("type","dm")
        .eq("read",false);
      if(error) await loadNotifications();
      else await loadNotifications();
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-11 w-11 rounded-2xl ring-1 ring-white/10 hover:ring-white/20 bg-white/5 hover:bg-white/10 transition-all">
          <MessageCircle className="h-5 w-5" />
          {unreadCount>0&&(
            <span className="absolute -top-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-[11px] font-medium text-primary-foreground shadow-sm ring-2 ring-background">
              {unreadCount>9?"9+":unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 overflow-hidden rounded-2xl p-0 bg-card/90 backdrop-blur-xl border-white/10 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 bg-white/5 px-4 py-3">
          <h3 className="text-sm font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">Pesan</h3>
          {unreadCount>0&&(
            <Button
              variant="ghost" size="sm" onClick={markAllAsRead} disabled={markingAll}
              className="h-6 rounded-full px-2 text-[10px] text-muted-foreground hover:text-primary hover:bg-primary/10"
            >
              {markingAll?"Memproses...":"Tandai dibaca"}
            </Button>
          )}
        </div>

        <ScrollArea className="h-[420px]">
          {notifications.length===0?(
            <div className="grid place-items-center gap-2 py-12 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/5 ring-1 ring-white/10">
                <MessageCircle className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Tidak ada pesan baru</p>
            </div>
          ):(
            <div className="divide-y divide-white/5">
              {notifications.map(n=>(
                <DropdownMenuItem
                  key={n.id}
                  className={`group cursor-pointer rounded-none px-4 py-3.5 focus:bg-white/5 data-[highlighted]:bg-white/5 transition-colors ${!n.read?"bg-primary/5":""}`}
                  onClick={()=>handleNotificationClick(n)}
                >
                  <div className="flex w-full items-start gap-3.5">
                    <span className={`mt-2 h-2 w-2 flex-shrink-0 rounded-full shadow-sm ${n.read?"bg-transparent ring-1 ring-white/20":"bg-primary"}`} />
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`truncate text-sm font-semibold ${!n.read?"text-foreground":"text-muted-foreground"}`}>{n.title}</p>
                        <Button
                          variant="ghost" size="icon"
                          className="h-5 w-5 -mr-1.5 text-muted-foreground/50 hover:text-red-400 hover:bg-red-400/10 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                          onClick={(e)=>deleteNotification(n.id,e)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="line-clamp-2 text-xs text-muted-foreground leading-relaxed">{n.message}</p>
                      <p className="text-[10px] font-medium text-muted-foreground/60">
                        {formatDistanceToNow(new Date(n.created_at),{addSuffix:true,locale:id})}
                      </p>
                    </div>
                  </div>
                </DropdownMenuItem>
              ))}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}