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
        <Button variant="ghost" size="icon" className="relative rounded-xl ring-1 ring-border hover:ring-accent/50">
          <MessageCircle className="h-5 w-5" />
          {unreadCount>0&&(
            <span className="absolute -top-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-accent text-[11px] font-medium text-accent-foreground shadow">
              {unreadCount>9?"9+":unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 overflow-hidden rounded-2xl p-0">
        <div className="flex items-center justify-between border-b border-border bg-card/80 px-4 py-2">
          <h3 className="text-sm font-semibold">Pesan</h3>
          {unreadCount>0&&(
            <Button
              variant="ghost" size="sm" onClick={markAllAsRead} disabled={markingAll}
              className="h-7 rounded-full px-2 text-xs text-accent hover:text-accent/80"
            >
              {markingAll?"Memproses...":"Tandai semua dibaca"}
            </Button>
          )}
        </div>

        <ScrollArea className="h-[420px]">
          {notifications.length===0?(
            <div className="grid place-items-center gap-1 py-10 text-center">
              <div className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-border">
                <MessageCircle className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">Tidak ada pesan</p>
            </div>
          ):(
            <div className="divide-y divide-border/80">
              {notifications.map(n=>(
                <DropdownMenuItem
                  key={n.id}
                  className={`group cursor-pointer rounded-none px-4 py-3 focus:bg-accent/10 data-[highlighted]:bg-accent/10 ${!n.read?"bg-accent/5":""}`}
                  onClick={()=>handleNotificationClick(n)}
                >
                  <div className="flex w-full items-start gap-3">
                    <span className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${n.read?"bg-transparent ring-1 ring-border":"bg-accent"}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`truncate text-sm font-medium ${!n.read?"text-foreground":"text-muted-foreground"}`}>{n.title}</p>
                        <Button
                          variant="ghost" size="icon"
                          className="h-6 w-6 -mr-1 text-muted-foreground hover:text-foreground"
                          onClick={(e)=>deleteNotification(n.id,e)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground/80">
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