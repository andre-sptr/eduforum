import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Send } from 'lucide-react';

interface ChatMessage {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: {
    name: string;
    avatar_text: string;
  }
}

interface ChatPartner {
    id: string;
    name: string;
    avatar_text: string;
}

const formatTime = (t: string | null | undefined): string => {
  if (!t) {
    return ''; 
  }

  try {
    const date = new Date(t);
    if (isNaN(date.getTime())) {
      return 'Error';
    }

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const timeString = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    const isToday = date.getDate() === now.getDate() &&
                    date.getMonth() === now.getMonth() &&
                    date.getFullYear() === now.getFullYear();
    if (isToday) {
      return timeString;
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.getDate() === yesterday.getDate() &&
                        date.getMonth() === yesterday.getMonth() &&
                        date.getFullYear() === yesterday.getFullYear();
    if (isYesterday) {
      return `Kemarin, ${timeString}`;
    }

    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
    
  } catch (error) {
    console.error("Error formatting chat time:", error, "Input was:", t);
    return 'Error';
  }
};

const ChatPage = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [newMessage, setNewMessage] = useState('');
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const { data: chatPartner, isLoading: isLoadingPartner } = useQuery<ChatPartner | null>({
      queryKey: ['chatPartner', roomId, user?.id],
      queryFn: async () => {
          if (!user || !roomId) return null;
          const { data, error } = await supabase
              .from('chat_participants')
              .select('profiles(id, name, avatar_text)')
              .eq('room_id', roomId)
              .neq('user_id', user.id)
              .limit(1)
              .maybeSingle();
          if (error) throw error;
          return data?.profiles ?? null;
      },
      enabled: !!user && !!roomId,
  });

  const { data: messages = [], isLoading: isLoadingMessages } = useQuery<ChatMessage[]>({
    queryKey: ['chatMessages', roomId],
    queryFn: async () => {
      if (!roomId) return [];
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!roomId,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
        if (!user || !roomId) throw new Error("User atau Room ID tidak valid");
        const { error } = await supabase
          .from('chat_messages')
          .insert({ room_id: roomId, sender_id: user.id, content: content });
        if (error) throw error;
    },
    onSuccess: () => { setNewMessage(''); },
    onError: (error) => { toast.error(`Gagal mengirim pesan: ${error.message}`); },
 });

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    setTimeout(() => { 
      const scrollAreaElement = scrollAreaRef.current;
      const viewportElement = scrollAreaElement?.querySelector<HTMLDivElement>('[data-radix-scroll-area-viewport]'); 

      if (viewportElement) {
        viewportElement.scrollTo({ top: viewportElement.scrollHeight, behavior });
      } else if (scrollAreaElement) { 
          scrollAreaElement.scrollTo({ top: scrollAreaElement.scrollHeight, behavior });
      }
    }, 100);
  };

  useEffect(() => {
    if (!roomId) return;

    if (messages.length > 0) {
        scrollToBottom('instant'); 
    }

    const channel = supabase
      .channel(`chat_room_${roomId}`)
      .on<ChatMessage>(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          queryClient.setQueryData<ChatMessage[]>(['chatMessages', roomId], (oldData = []) => [
            ...oldData,
            payload.new as ChatMessage,
          ]);
           scrollToBottom('smooth'); 
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId, queryClient]);

  useEffect(() => {
    if (messages.length > 0) {
      scrollToBottom('instant');
    }
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
      e.preventDefault();
      const content = newMessage.trim();
      if (content) {
        sendMessageMutation.mutate(content);
      }
  };

   if (authLoading || isLoadingPartner) {
        return (
            <div className="flex flex-col h-screen">
                <div className="flex items-center p-4 border-b"><Skeleton className="h-10 w-10 rounded-full mr-3" /><Skeleton className="h-6 w-32" /></div>
                <div className="flex-1 p-4 space-y-4"><Skeleton className="h-10 w-3/4" /><Skeleton className="h-10 w-1/2 ml-auto" /><Skeleton className="h-10 w-2/3" /></div>
                <div className="p-4 border-t"><Skeleton className="h-10 w-full" /></div>
            </div>
        );
   }

   if (!chatPartner) {
       return <div>Error: Gagal memuat info chat partner atau room tidak valid.</div>;
   }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <div className="flex flex-col h-[calc(100vh-2rem)] max-h-[850px] w-full max-w-[500px] overflow-hidden rounded-xl bg-background shadow-2xl border">
        <header className="flex items-center p-3 border-b border-border/60 bg-card shadow-sm z-10 flex-shrink-0">
          <Button variant="ghost" size="icon" className="mr-2" asChild>
              <Link to="/"><ArrowLeft className="h-5 w-5"/></Link>
          </Button>
          <Link 
            to={`/profile/name/${encodeURIComponent(chatPartner.name)}`}
            className="flex items-center gap-3"
          >
            <Avatar className="h-9 w-9">
              <AvatarFallback className="bg-primary text-primary-foreground"> 
                {chatPartner.avatar_text || '?'}
              </AvatarFallback>
            </Avatar>
            <h2 className="font-semibold text-base">{chatPartner.name}</h2>
          </Link>
        </header>

        <ScrollArea
          className="flex-1 bg-muted/20"
          ref={scrollAreaRef}
        >
          <div className="p-4 space-y-2">
            {isLoadingMessages ? (
               <p className="text-sm text-center text-muted-foreground pt-10">Memuat pesan...</p>
            ) : messages.map((msg, index) => {
               const isSender = msg.sender_id === user?.id;
               const prevMessage = messages[index - 1];
               const isSameSenderAsPrev = prevMessage?.sender_id === msg.sender_id;

               return (
                <div 
                    key={msg.id} 
                    className={`flex items-start gap-2 ${isSender ? 'justify-end' : 'justify-start'} ${!isSameSenderAsPrev ? 'mt-3' : 'mt-1'}`}
                >
                    {!isSender && chatPartner && (
                    <Avatar className={`h-6 w-6 flex-shrink-0 ${
                        isSameSenderAsPrev ? 'invisible' : 'visible' 
                    }`}> 
                        <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                            {chatPartner.avatar_text || '?'}
                        </AvatarFallback>
                    </Avatar>
                    )}

                    <div className={`max-w-[75%] rounded-xl px-3 pt-1.5 pb-1 text-sm shadow relative ${
                      isSender 
                      ? 'bg-primary text-primary-foreground rounded-br-none' 
                      : 'bg-card text-card-foreground border rounded-bl-none'
                    }`}>
                     <p className="whitespace-pre-wrap break-all">{msg.content}</p> 
                     <p className={`text-[0.65rem] mt-1 opacity-60 ${ isSender ? 'text-right' : 'text-left' }`}> 
                         {formatTime(msg.created_at)} 
                     </p>
                   </div>               
                </div>
                );
            })}
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
              disabled={sendMessageMutation.isPending || newMessage.trim().length === 0}
              className="rounded-full bg-primary hover:bg-primary/90 flex-shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </footer>
      </div>
    </div>
  );
};

export default ChatPage;