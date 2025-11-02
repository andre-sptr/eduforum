import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Send, MessageCircle, Users, MoreVertical, Pencil, Trash2 } from "lucide-react";
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

const messageSchema = z.object({
  content: z.string().trim().min(1, "Message cannot be empty").max(2000, "Message is too long"),
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

const Messages = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [globalConversation, setGlobalConversation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [followedUsers, setFollowedUsers] = useState<any[]>([]);
  const [userGroups, setUserGroups] = useState<any[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const checkUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setCurrentUser(user);
    await Promise.all([loadGlobalChat(user.id), loadFollowedUsers(user.id), loadUserGroups(user.id)]);
    setLoading(false);
  };

  const loadGlobalChat = async (userId: string) => {
    try {
      // Get or create global conversation
      let { data: globalConv, error: fetchError } = await supabase
        .from("conversations")
        .select("*")
        .eq("type", "global")
        .maybeSingle();

      if (fetchError) {
        console.error("Error fetching global conversation:", fetchError);
      }

      if (!globalConv) {
        // Create global conversation
        const { data: newGlobal, error: createError } = await supabase
          .from("conversations")
          .insert({
            name: "Global Chat",
            type: "global",
            created_by: userId,
          })
          .select()
          .single();

        if (createError) {
          console.error("Error creating global conversation:", createError);
          toast.error("Gagal membuat global chat: " + createError.message);
          return;
        }
        globalConv = newGlobal;
      }

      if (globalConv) {
        setGlobalConversation(globalConv);

        // Auto-join global chat
        const { data: existingParticipant, error: checkError } = await supabase
          .from("conversation_participants")
          .select("*")
          .eq("conversation_id", globalConv.id)
          .eq("user_id", userId)
          .maybeSingle();

        if (checkError) {
          console.error("Error checking participant:", checkError);
        }

        if (!existingParticipant) {
          const { error: joinError } = await supabase.from("conversation_participants").insert({
            conversation_id: globalConv.id,
            user_id: userId,
          });

          if (joinError) {
            console.error("Error joining global chat:", joinError);
          }
        }

        await loadMessages(globalConv.id);
        setupRealtimeSubscription(globalConv.id);
      }
    } catch (error) {
      console.error("Error in loadGlobalChat:", error);
      toast.error("Gagal memuat global chat");
    }
  };

  const loadFollowedUsers = async (userId: string) => {
    const { data } = await supabase
      .from("follows")
      .select("following_id, profiles!follows_following_id_fkey(id, full_name, avatar_url, role)")
      .eq("follower_id", userId);

    if (data) {
      setFollowedUsers(data.map((f) => f.profiles).filter(Boolean) as any[]);
    }
  };

  const loadUserGroups = async (userId: string) => {
    const { data } = await supabase
      .from("group_members")
      .select("group_id, groups(id, name, cover_image)")
      .eq("user_id", userId);

    if (data) {
      setUserGroups(data.map((g) => g.groups).filter(Boolean) as any[]);
    }
  };

  const loadMessages = async (conversationId: string) => {
    const { data: messagesData, error: messagesError } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(100);

    if (messagesError) {
      toast.error(messagesError.message);
      return;
    }

    if (!messagesData || messagesData.length === 0) {
      setMessages([]);
      return;
    }

    const userIds = [...new Set(messagesData.map((m) => m.user_id))];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, role")
      .in("id", userIds);

    const profilesMap = new Map((profilesData || []).map((p) => [p.id, p]));

    const messagesWithProfiles = messagesData.map((msg) => ({
      ...msg,
      profiles: profilesMap.get(msg.user_id) || {
        full_name: "Unknown User",
        avatar_url: null,
        role: "siswa",
      },
    }));

    setMessages(messagesWithProfiles);
  };

  const setupRealtimeSubscription = (conversationId: string) => {
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        async (payload) => {
          const { data: messageData } = await supabase.from("messages").select("*").eq("id", payload.new.id).single();

          if (!messageData) return;

          const { data: profileData } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url, role")
            .eq("id", messageData.user_id)
            .single();

          const messageWithProfile = {
            ...messageData,
            profiles: profileData || {
              full_name: "Unknown User",
              avatar_url: null,
              role: "siswa",
            },
          };

          setMessages((prev) => [...prev, messageWithProfile]);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === payload.new.id
                ? { ...msg, content: payload.new.content, edited_at: payload.new.edited_at, is_deleted: payload.new.is_deleted }
                : msg
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newMessage.trim()) {
      return;
    }

    try {
      messageSchema.parse({ content: newMessage });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    if (!globalConversation) {
      toast.error("Global chat belum tersedia");
      return;
    }

    setSending(true);

    try {
      const { error } = await supabase.from("messages").insert({
        conversation_id: globalConversation.id,
        user_id: currentUser.id,
        content: newMessage.trim(),
      });

      if (error) {
        console.error("Error sending message:", error);
        throw error;
      }

      setNewMessage("");
    } catch (error: any) {
      console.error("Send message error:", error);
      toast.error("Gagal mengirim pesan: " + error.message);
    } finally {
      setSending(false);
    }
  };

  const createDirectChat = async (userId: string) => {
    try {
      // Use RPC function to create/find direct conversation
      const { data: conversationId, error } = await supabase.rpc("create_direct_conversation", {
        target_user_id: userId,
      });

      if (error) {
        console.error("Error creating direct chat:", error);
        throw error;
      }

      if (conversationId) {
        navigate(`/chat/${conversationId}`);
      }
    } catch (error: any) {
      console.error("Error creating direct chat:", error);
      toast.error("Gagal membuat chat: " + error.message);
    }
  };

  const createGroupChat = async (groupId: string) => {
    try {
      // Use RPC function to create/find group conversation
      const { data: conversationId, error } = await supabase.rpc("create_group_conversation", {
        p_group_id: groupId,
      });

      if (error) {
        console.error("Error creating group chat:", error);
        throw error;
      }

      if (conversationId) {
        navigate(`/chat/${conversationId}`);
      }
    } catch (error: any) {
      console.error("Error creating group chat:", error);
      toast.error("Gagal membuat chat grup: " + error.message);
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
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
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
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Global Chat
          </h1>
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-6 flex gap-6 max-w-7xl">
        {/* Main Chat Area */}
        <Card className="flex-1 bg-card border-border flex flex-col overflow-hidden">
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Belum ada pesan. Mulai percakapan!</p>
                </div>
              ) : (
                messages.map((message) => {
                  const isOwnMessage = message.user_id === currentUser?.id;
                  const isEditing = editingMessageId === message.id;

                  return (
                    <div key={message.id} className={`flex gap-3 ${isOwnMessage ? "flex-row-reverse" : "flex-row"}`}>
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={message.profiles?.avatar_url || undefined} />
                        <AvatarFallback className="bg-accent text-accent-foreground">
                          {getInitials(message.profiles?.full_name || "User")}
                        </AvatarFallback>
                      </Avatar>

                      <div className={`flex flex-col max-w-[70%] ${isOwnMessage ? "items-end" : "items-start"}`}>
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-sm font-medium text-foreground">{message.profiles?.full_name}</span>
                          <span className="text-xs text-muted-foreground">{message.profiles?.role}</span>
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
                                isOwnMessage ? "bg-accent text-accent-foreground" : "bg-muted text-foreground"
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

                        <span className="text-xs text-muted-foreground mt-1">{formatTime(message.created_at)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          <form onSubmit={handleSendMessage} className="border-t border-border p-4">
            <div className="flex gap-2">
              <MentionInput
                value={newMessage}
                onChange={setNewMessage}
                placeholder="Ketik pesan... (gunakan @ untuk mention)"
                className="flex-1 bg-input border-border"
                disabled={sending}
                currentUserId={currentUser?.id}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e as any);
                  }
                }}
              />
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

        {/* Sidebar */}
        <div className="w-80 space-y-4 hidden lg:block">
          {/* Followed Users */}
          <Card className="p-4 bg-card border-border">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              User yang Diikuti
            </h3>
            <ScrollArea className="max-h-64">
              <div className="space-y-2">
                {followedUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Belum mengikuti siapa pun</p>
                ) : (
                  followedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/10 cursor-pointer transition-colors"
                      onClick={() => createDirectChat(user.id)}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback className="bg-accent text-accent-foreground">
                          {getInitials(user.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{user.full_name}</p>
                        <p className="text-xs text-muted-foreground">{user.role}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </Card>

          {/* Group Chats */}
          <Card className="p-4 bg-card border-border">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Grup Chat
            </h3>
            <ScrollArea className="max-h-64">
              <div className="space-y-2">
                {userGroups.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Belum bergabung grup</p>
                ) : (
                  userGroups.map((group) => (
                    <div
                      key={group.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/10 cursor-pointer transition-colors"
                      onClick={() => createGroupChat(group.id)}
                    >
                      <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center flex-shrink-0">
                        {group.cover_image ? (
                          <img
                            src={group.cover_image}
                            alt={group.name}
                            className="h-full w-full rounded-full object-cover"
                          />
                        ) : (
                          <Users className="h-4 w-4 text-accent-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{group.name}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Messages;
