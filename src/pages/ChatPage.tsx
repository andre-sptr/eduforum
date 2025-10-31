import React, { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Send } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { profilePath } from "@/utils/profilePath";
import { formatTime } from "@/lib/time";
import { useChat } from "@/hooks/useChat";

type ChatPartner = { id: string; name: string; avatar_text: string };

export default function ChatPage(): JSX.Element {
  const { roomId } = useParams<{ roomId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [newMessage, setNewMessage] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const { data: chatPartner, isLoading: isLoadingPartner } = useQuery<ChatPartner | null>({
    queryKey: ["chatPartner", roomId, user?.id],
    enabled: !!user && !!roomId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_participants")
        .select("profiles(id, name, avatar_text)")
        .eq("room_id", roomId!)
        .neq("user_id", user!.id)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data?.profiles as any) ?? null;
    },
  });

  const { messages, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage, sendMessage } = useChat(roomId || "", user?.id, 50);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const viewport = scrollAreaRef.current?.querySelector<HTMLDivElement>('[data-radix-scroll-area-viewport]');
    if (viewport) viewport.scrollTo({ top: viewport.scrollHeight, behavior });
  };

  useEffect(() => {
    if (messages.length > 0) scrollToBottom("auto");
  }, [messages.length]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const content = newMessage.trim();
    if (!content) return;
    sendMessage.mutate(content, {
      onSuccess: () => setNewMessage(""),
      onError: (err: any) => toast.error(`Gagal mengirim pesan: ${err.message}`),
    });
  };

  if (authLoading || isLoadingPartner) {
    return (
      <div className="flex flex-col h-screen">
        <div className="flex items-center p-4 border-b">
          <Skeleton className="h-10 w-10 rounded-full mr-3" />
          <Skeleton className="h-6 w-32" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-10 w-1/2 ml-auto" />
          <Skeleton className="h-10 w-2/3" />
        </div>
        <div className="p-4 border-t">
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    );
  }

  if (!roomId || !chatPartner) {
    return <div className="p-6 text-center text-red-500">Gagal memuat info chat atau room tidak valid.</div>;
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <div className="flex flex-col h-[calc(100vh-2rem)] max-h-[850px] w-full max-w-[500px] overflow-hidden rounded-xl bg-background shadow-2xl border">
        <header className="flex items-center p-3 border-b border-border/60 bg-card shadow-sm z-10 flex-shrink-0">
          <Button variant="ghost" size="icon" className="mr-2" asChild>
            <Link to="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <Link to={profilePath(undefined, chatPartner.name)} className="flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary text-primary-foreground">{chatPartner.avatar_text || "?"}</AvatarFallback>
            </Avatar>
            <h2 className="font-semibold text-base">{chatPartner.name}</h2>
          </Link>
        </header>

        <div className="px-3 pt-2">
          {hasNextPage && (
            <Button variant="outline" size="sm" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
              {isFetchingNextPage ? "Memuat..." : "Muat pesan lama"}
            </Button>
          )}
        </div>

        <ScrollArea className="flex-1 bg-muted/20" ref={scrollAreaRef}>
          <div className="p-4 space-y-2">
            {isLoading ? (
              <p className="text-sm text-center text-muted-foreground pt-10">Memuat pesan...</p>
            ) : (
              messages.map((msg, index) => {
                const isSender = msg.sender_id === user?.id;
                const prev = messages[index - 1];
                const samePrev = prev?.sender_id === msg.sender_id;
                const isOptimistic = msg.id.startsWith("optimistic-");
                return (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-2 ${isSender ? "justify-end" : "justify-start"} ${!samePrev ? "mt-3" : "mt-1"} ${isOptimistic ? "opacity-70" : ""}`}
                  >
                    {!isSender && (
                      <Avatar className={`h-6 w-6 flex-shrink-0 ${samePrev ? "invisible" : "visible"}`}>
                        <AvatarFallback className="text-xs bg-primary text-primary-foreground">{chatPartner.avatar_text || "?"}</AvatarFallback>
                      </Avatar>
                    )}
                    <div
                      className={`max-w-[75%] rounded-xl px-3 pt-1.5 pb-1 text-sm shadow relative ${
                        isSender ? "bg-primary text-primary-foreground rounded-br-none" : "bg-card text-card-foreground border rounded-bl-none"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-all">{msg.content}</p>
                      <p className={`text-[0.65rem] mt-1 opacity-60 ${isSender ? "text-right" : "text-left"}`}>{formatTime(msg.created_at)}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <ScrollBar orientation="vertical" />
        </ScrollArea>

        <footer className="p-3 border-t border-border/60 bg-card/80 backdrop-blur-sm flex-shrink-0">
          <form onSubmit={handleSendMessage} className="flex gap-3 items-center">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Ketik pesan..."
              className="flex-1 rounded-full px-4 py-2 border-border/80 focus-visible:ring-1 focus-visible:ring-primary/40"
              autoComplete="off"
            />
            <Button
              type="submit"
              size="icon"
              disabled={sendMessage.isPending || newMessage.trim().length === 0}
              className="rounded-full bg-primary hover:bg-primary/90 flex-shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </footer>
      </div>
    </div>
  );
}