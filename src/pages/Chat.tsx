import { useEffect, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Send, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { z } from "zod";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MentionInput } from "@/components/MentionInput";

// Input validation schema
const messageSchema = z.object({
  content: z.string().trim().min(1, "Message cannot be empty").max(2000, "Message is too long (max 2000 characters)"),
});

interface Message {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  edited_at?: string | null;
  is_deleted?: boolean;
  profiles?: {
    full_name: string;
    avatar_url: string | null;
    role: string;
  };
}

const Chat = () => {
  const navigate = useNavigate();
  const { conversationId } = useParams();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [conversation, setConversation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [groupMembers, setGroupMembers] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkUser();
  }, [conversationId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }
    setCurrentUser(user);
    
    // Load conversation
    const { data: convData } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .single();
    
    if (!convData) {
      toast.error("Percakapan tidak ditemukan");
      navigate('/messages');
      return;
    }
    
    setConversation(convData);
    
    // Load group members if it's a group conversation
    if (convData.type === 'group' && convData.group_id) {
      const { data: members } = await supabase
        .from('group_members')
        .select('user_id')
        .eq('group_id', convData.group_id);
      
      if (members) {
        setGroupMembers(members.map(m => m.user_id));
      }
    }
    
    // Auto-join if global conversation
    if (convData.type === 'global') {
      const { data: existingParticipant } = await supabase
        .from('conversation_participants')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id)
        .single();
      
      if (!existingParticipant) {
        await supabase
          .from('conversation_participants')
          .insert({
            conversation_id: conversationId,
            user_id: user.id,
          });
      }
    }
    
    await loadMessages();
    setupRealtimeSubscription();
    setLoading(false);
  };

  const loadMessages = async () => {
    const { data: messagesData, error: messagesError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(100);

    if (messagesError) {
      toast.error(messagesError.message);
      return;
    }

    if (!messagesData || messagesData.length === 0) {
      setMessages([]);
      return;
    }

    // Get unique user IDs
    const userIds = [...new Set(messagesData.map(m => m.user_id))];

    // Fetch profiles for these users
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role')
      .in('id', userIds);

    // Map profiles to messages
    const profilesMap = new Map(
      (profilesData || []).map(p => [p.id, p])
    );

    const messagesWithProfiles = messagesData.map(msg => ({
      ...msg,
      profiles: profilesMap.get(msg.user_id) || {
        full_name: 'Unknown User',
        avatar_url: null,
        role: 'siswa'
      }
    }));

    setMessages(messagesWithProfiles);
  };

  const setupRealtimeSubscription = () => {
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        async (payload) => {
          const { data: messageData } = await supabase
            .from('messages')
            .select('*')
            .eq('id', payload.new.id)
            .single();

          if (!messageData) return;

          const { data: profileData } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, role')
            .eq('id', messageData.user_id)
            .single();

          const messageWithProfile = {
            ...messageData,
            profiles: profileData || {
              full_name: 'Unknown User',
              avatar_url: null,
              role: 'siswa'
            }
          };

          setMessages(prev => [...prev, messageWithProfile]);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          setMessages(prev =>
            prev.map(msg =>
              msg.id === payload.new.id
                ? { ...msg, content: payload.new.content, edited_at: payload.new.edited_at, is_deleted: payload.new.is_deleted }
                : msg
            )
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          setMessages(prev => prev.filter(msg => msg.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate input
    try {
      messageSchema.parse({ content: newMessage });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    setSending(true);

    try {
      const { error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          user_id: currentUser.id,
          content: newMessage.trim(),
        });

      if (error) throw error;

      setNewMessage("");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSending(false);
    }
  };

  const getInitials = (name: string) => {
    const names = name.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleEditMessage = async (messageId: string) => {
    if (!editContent.trim()) {
      toast.error("Pesan tidak boleh kosong");
      return;
    }

    try {
      messageSchema.parse({ content: editContent });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    try {
      const { error } = await supabase
        .from("messages")
        .update({ content: editContent.trim(), edited_at: new Date().toISOString() })
        .eq("id", messageId);

      if (error) throw error;

      setEditingMessageId(null);
      setEditContent("");
      toast.success("Pesan berhasil diubah");
    } catch (error: any) {
      toast.error("Gagal mengubah pesan: " + error.message);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    try {
      const { error } = await supabase.from("messages").delete().eq("id", messageId);

      if (error) throw error;

      toast.success("Pesan berhasil dihapus");
    } catch (error: any) {
      toast.error("Gagal menghapus pesan: " + error.message);
    }
  };

  const startEdit = (message: Message) => {
    setEditingMessageId(message.id);
    setEditContent(message.content);
  };

  const cancelEdit = () => {
    setEditingMessageId(null);
    setEditContent("");
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('id-ID', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Memuat chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-card border-b border-border shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/messages')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">
              {conversation?.name || 'Chat'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {conversation?.type === 'global' && 'Chat Global'}
              {conversation?.type === 'group' && 'Grup Chat'}
              {conversation?.type === 'direct' && 'Chat Pribadi'}
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-6 max-w-4xl flex flex-col">
        <Card className="flex-1 bg-card border-border flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">
                    Belum ada pesan. Mulai percakapan!
                  </p>
                </div>
              ) : (
                messages.map((message) => {
                  const isOwnMessage = message.user_id === currentUser?.id;
                  const isEditing = editingMessageId === message.id;
                  
                  return (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={message.profiles?.avatar_url || undefined} />
                        <AvatarFallback className="bg-accent text-accent-foreground">
                          {getInitials(message.profiles?.full_name || "User")}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className={`flex flex-col max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'}`}>
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-sm font-medium text-foreground">
                            {message.profiles?.full_name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {message.profiles?.role}
                          </span>
                        </div>
                        
                        {isEditing ? (
                          <div className="flex gap-2 items-center w-full">
                            <Input
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              className="flex-1"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                  e.preventDefault();
                                  handleEditMessage(message.id);
                                } else if (e.key === "Escape") {
                                  cancelEdit();
                                }
                              }}
                            />
                            <Button size="sm" onClick={() => handleEditMessage(message.id)}>
                              Simpan
                            </Button>
                            <Button size="sm" variant="ghost" onClick={cancelEdit}>
                              Batal
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2">
                            <div
                              className={`rounded-2xl px-4 py-2 ${
                                isOwnMessage
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted text-foreground'
                              }`}
                            >
                              <p 
                                className="text-sm whitespace-pre-wrap break-words"
                                dangerouslySetInnerHTML={{
                                  __html: message.content.replace(
                                    /@\[([^\]]+)\]\([a-f0-9\-]+\)/g,
                                    '<span class="text-primary font-semibold">@$1</span>'
                                  )
                                }}
                              />
                              {message.edited_at && (
                                <span className="text-xs opacity-70 italic">diedit</span>
                              )}
                            </div>
                            {isOwnMessage && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-6 w-6">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => startEdit(message)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDeleteMessage(message.id)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Hapus
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        )}
                        
                        <span className="text-xs text-muted-foreground mt-1">
                          {formatTime(message.created_at)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <form onSubmit={handleSendMessage} className="border-t border-border p-4">
            <div className="flex gap-2">
              {conversation?.type === 'direct' ? (
                <Input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Ketik pesan..."
                  className="flex-1 bg-input border-border"
                  disabled={sending}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e as any);
                    }
                  }}
                />
              ) : (
                <MentionInput
                  value={newMessage}
                  onChange={setNewMessage}
                  placeholder="Ketik pesan... (gunakan @ untuk mention)"
                  className="flex-1 bg-input border-border"
                  disabled={sending}
                  currentUserId={currentUser?.id}
                  allowedUserIds={conversation?.type === 'group' ? groupMembers : undefined}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e as any);
                    }
                  }}
                />
              )}
              <Button
                type="submit"
                size="icon"
                disabled={sending || !newMessage.trim()}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Chat;
