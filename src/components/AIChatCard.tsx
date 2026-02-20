import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardFooter, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Bot,
  Send,
  User,
  Trash2,
  Copy,
  Settings,
  StopCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Download,
  Sparkles,
  Check,
  Code2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

const STORAGE_KEY = "eduforum-ai-chat-history";
const MAX_CHARS = 1000;

const SYSTEM_PROMPTS = [
  { value: "default", label: "Teman Santai", prompt: "Kamu adalah teman ngobrol yang asik, ceria, dan ekspresif! Kamu ngobrol dalam bahasa Indonesia yang santai dan gaul. Kamu suka bercanda, kasih semangat, dan bikin suasana jadi rame. Pakai emoji sesuka hati! �🔥✨ Kalau ada yang minta bantuan serius, kamu tetap bantu dengan cara yang fun dan nggak kaku." },
  { value: "tutor", label: "Coding Tutor", prompt: "You are an expert coding tutor. Explain concepts clearly, provide examples, and break down complex topics." },
  { value: "creative", label: "Creative Writer", prompt: "You are a creative writer. Use vivid language, imaginative concepts, and engaging storytelling." },
  { value: "concise", label: "Concise Helper", prompt: "You are a concise assistant. Provide short, direct answers without unnecessary fluff." },
  { value: "custom", label: "Custom Prompt", prompt: "" },
];


function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Animated dots component
function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-2 h-2 rounded-full bg-primary/70"
          animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

// Copy button with check feedback
function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied!");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="icon" className={cn("h-7 w-7 transition-all", className)} onClick={handleCopy}>
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </Button>
  );
}

export function AIChatCard() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [systemPromptType, setSystemPromptType] = useState("default");
  const [customSystemPrompt, setCustomSystemPrompt] = useState("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const apiKey = import.meta.env.VITE_SUMOPOD_API_KEY || "";
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load chat from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      }
    } catch { /* ignore parse errors */ }
  }, []);

  // Save chat to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    }
  }, [messages]);

  // Auto-scroll to bottom — only inside the card container, not the page
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const getSystemPrompt = () => {
    if (systemPromptType === "custom") return customSystemPrompt;
    return SYSTEM_PROMPTS.find(p => p.value === systemPromptType)?.prompt || SYSTEM_PROMPTS[0].prompt;
  };

  const handleSend = async (retryContent?: string) => {
    const contentToSend = retryContent || input;
    if (!contentToSend.trim() || !apiKey) {
      if (!apiKey) toast.error("API Key missing");
      return;
    }

    const now = Date.now();
    const newMessages = retryContent
      ? [...messages]
      : [...messages, { role: "user" as const, content: contentToSend, timestamp: now }];

    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    abortControllerRef.current = new AbortController();

    try {
      const systemMessage = { role: "system", content: getSystemPrompt() };
      const apiMessages = [systemMessage, ...newMessages].map(m => ({ role: m.role, content: m.content }));

      const response = await fetch("https://ai.sumopod.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-5-mini",
          messages: apiMessages,
          temperature: 0.9,
          stream: true,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) throw new Error(`Error: ${response.statusText}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No reader available");

      let assistantMessage = "";
      const assistantTimestamp = Date.now();
      setMessages(prev => [...prev, { role: "assistant", content: "", timestamp: assistantTimestamp }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ") && line !== "data: [DONE]") {
            try {
              const data = JSON.parse(line.slice(6));
              const content = data.choices[0]?.delta?.content || "";
              assistantMessage += content;

              setMessages(prev => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1] = {
                  role: "assistant",
                  content: assistantMessage,
                  timestamp: assistantTimestamp,
                };
                return newMsgs;
              });
            } catch (e) {
              console.error("Error parsing stream chunk", e);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        toast.info("Generation stopped");
      } else {
        console.error("Failed to fetch AI response:", error);
        toast.error("Failed to get response");
        setMessages(prev => [
          ...prev,
          {
            role: "assistant",
            content: "Sorry, I encountered an error. Please check your API key and try again.",
            timestamp: Date.now(),
          },
        ]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
    toast.success("Chat history cleared");
  };

  const handleRetry = () => {
    const lastUserMessageIndex = messages.findLastIndex(m => m.role === "user");
    if (lastUserMessageIndex !== -1) {
      const lastMessage = messages[lastUserMessageIndex];
      setMessages(prev => prev.slice(0, lastUserMessageIndex));
      handleSend(lastMessage.content);
    }
  };

  const handleExportChat = useCallback(() => {
    if (messages.length === 0) {
      toast.error("No messages to export");
      return;
    }
    const text = messages
      .filter(m => m.role !== "system")
      .map(m => `[${formatTime(m.timestamp)}] ${m.role === "user" ? "You" : "AI"}: ${m.content}`)
      .join("\n\n---\n\n");
    const blob = new Blob([`EduForum AI Chat Export\n${"=".repeat(30)}\n\n${text}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-chat-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Chat exported!");
  }, [messages]);


  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const charCount = input.length;
  const charPercent = (charCount / MAX_CHARS) * 100;
  const charColor = charPercent > 90 ? "text-destructive" : charPercent > 70 ? "text-amber-500" : "text-muted-foreground";
  const messageCount = messages.filter(m => m.role !== "system").length;

  // ---------- COLLAPSED STATE ----------
  if (!isExpanded) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card
          className="group w-full rounded-2xl shadow-lg border-border overflow-hidden cursor-pointer
            bg-gradient-to-r from-primary/5 via-card/80 to-accent/5 hover:shadow-xl
            transition-all duration-300 hover:border-primary/30"
          onClick={() => setIsExpanded(true)}
        >
          <div className="flex items-center justify-between px-4 py-3 sm:px-5 sm:py-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="p-2 sm:p-2.5 bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl shadow-sm">
                  <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                </div>
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-card animate-pulse" />
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-sm sm:text-base text-foreground">AI Assistant</span>
                <span className="text-xs text-muted-foreground">
                  {messageCount > 0 ? `${messageCount} messages • Tap to continue` : "Tap to start a conversation"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {messageCount > 0 && (
                <Badge variant="secondary" className="text-xs font-medium rounded-full px-2 py-0.5">
                  {messageCount}
                </Badge>
              )}
              <ChevronDown className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </div>

        </Card>
      </motion.div>
    );
  }

  // ---------- EXPANDED STATE ----------
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <Card className="w-full rounded-2xl shadow-xl border-border flex flex-col h-[520px] sm:h-[480px] overflow-hidden bg-card/50 backdrop-blur-sm">
        {/* ---- HEADER ---- */}
        <CardHeader className="pb-2 pt-3 px-3 sm:px-4 border-b bg-gradient-to-r from-background/80 via-background/50 to-background/80 backdrop-blur-md sticky top-0 z-10">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="p-2 bg-gradient-to-br from-primary/15 to-primary/5 rounded-xl border border-primary/10">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-card" />
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm sm:text-base font-semibold">AI Assistant</span>
                  {messageCount > 0 && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-full font-normal">
                      {messageCount} msg
                    </Badge>
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground font-normal">Powered by OpenAI</span>
              </div>
            </div>

            <div className="flex items-center gap-0.5">
              {/* Export */}
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={handleExportChat}
                      disabled={messages.length === 0}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom"><p className="text-xs">Export chat</p></TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {/* Settings */}
              <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                    <Settings className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>AI Settings</DialogTitle>
                    <DialogDescription>Configure the AI assistant's behavior.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>System Persona</Label>
                      <Select value={systemPromptType} onValueChange={setSystemPromptType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SYSTEM_PROMPTS.map(p => (
                            <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {systemPromptType === "custom" && (
                      <div className="space-y-2">
                        <Label>Custom Prompt</Label>
                        <Textarea
                          value={customSystemPrompt}
                          onChange={(e) => setCustomSystemPrompt(e.target.value)}
                          placeholder="Enter your custom system prompt here..."
                          className="h-24 resize-none"
                        />
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button onClick={() => setIsSettingsOpen(false)}>Save Changes</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              {/* Clear Chat */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear Chat History?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all messages in the current session.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleClearChat} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Clear Chat
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              {/* Collapse */}
              <Button
                variant="ghost" size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                onClick={() => setIsExpanded(false)}
              >
                <ChevronUp className="w-4 h-4" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>

        {/* ---- MESSAGES ---- */}
        <CardContent className="flex-1 p-0 overflow-hidden relative">
          <div ref={scrollContainerRef} className="h-full overflow-y-auto px-3 sm:px-4 custom-scrollbar">
            <div className="flex flex-col gap-5 py-4 sm:py-6">
              <AnimatePresence initial={false} mode="popLayout">
                {/* Empty State */}
                {messages.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex flex-col items-center justify-center text-center text-muted-foreground py-6 sm:py-10 px-4"
                  >
                    {/* Animated sparkle icon */}
                    <motion.div
                      className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-primary/10 via-accent/10 to-primary/5 
                        rounded-2xl flex items-center justify-center mb-5 border border-primary/10 shadow-lg shadow-primary/5"
                      animate={{ rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <Sparkles className="w-8 h-8 sm:w-10 sm:h-10 text-primary/60" />
                    </motion.div>
                    <h3 className="text-base sm:text-lg font-semibold mb-1 text-foreground">Halo! Mau ngobrol apa nih? 👋</h3>
                    <p className="max-w-xs text-xs sm:text-sm">
                      Curhat, nanya, atau sekadar bosan? Yuk ngobrol santai bareng aku! 😄
                    </p>
                  </motion.div>
                )}

                {/* Message Bubbles */}
                {messages.map((message, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "flex gap-2.5 max-w-[92%] sm:max-w-[88%] group/msg",
                      message.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                    )}
                  >
                    {/* Avatar */}
                    <div
                      className={cn(
                        "w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm mt-0.5",
                        message.role === "user"
                          ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground"
                          : "bg-background border border-border text-foreground"
                      )}
                    >
                      {message.role === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                    </div>

                    <div className="flex flex-col gap-1 min-w-0">
                      {/* Bubble */}
                      <div
                        className={cn(
                          "rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 text-sm shadow-sm relative",
                          message.role === "user"
                            ? "bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-tr-sm"
                            : "bg-muted/40 border border-border/40 text-foreground rounded-tl-sm"
                        )}
                      >
                        {message.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none break-words leading-relaxed">
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: ({ node, ...props }) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
                                ul: ({ node, ...props }) => <ul className="list-disc list-outside ml-4 mb-3 space-y-1" {...props} />,
                                ol: ({ node, ...props }) => <ol className="list-decimal list-outside ml-4 mb-3 space-y-1" {...props} />,
                                li: ({ node, ...props }) => <li className="mb-0.5 pl-1" {...props} />,
                                h1: ({ node, ...props }) => <h1 className="text-lg font-bold mt-3 mb-2 pb-1 border-b" {...props} />,
                                h2: ({ node, ...props }) => <h2 className="text-base font-semibold mt-3 mb-1.5" {...props} />,
                                h3: ({ node, ...props }) => <h3 className="text-sm font-semibold mt-2 mb-1" {...props} />,
                                blockquote: ({ node, ...props }) => (
                                  <blockquote className="border-l-3 border-primary/30 pl-3 italic my-3 bg-primary/5 py-2 pr-2 rounded-r-lg" {...props} />
                                ),
                                a: ({ node, ...props }) => (
                                  <a className="text-primary hover:underline font-medium cursor-pointer" target="_blank" rel="noopener noreferrer" {...props} />
                                ),
                                table: ({ node, ...props }) => (
                                  <div className="my-3 w-full overflow-y-auto rounded-lg border border-border">
                                    <table className="w-full text-sm border-collapse" {...props} />
                                  </div>
                                ),
                                thead: ({ node, ...props }) => <thead className="bg-muted/50" {...props} />,
                                th: ({ node, ...props }) => <th className="border-b border-border p-2 text-left font-semibold text-xs" {...props} />,
                                td: ({ node, ...props }) => <td className="border-b border-border/50 p-2 align-top text-xs" {...props} />,
                                code: ({ node, className, children, ...props }) => {
                                  const match = /language-(\w+)/.exec(className || '');
                                  const isInline = !match && String(children).indexOf('\n') === -1;
                                  const textContent = String(children).replace(/\n$/, '');

                                  return isInline ? (
                                    <code className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-md text-[13px] font-mono font-medium" {...props}>
                                      {children}
                                    </code>
                                  ) : (
                                    <div className="relative my-3 rounded-xl overflow-hidden border border-border bg-background/80">
                                      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/60 border-b border-border">
                                        <div className="flex items-center gap-2">
                                          <Code2 className="w-3 h-3 text-primary/60" />
                                          <span className="text-[11px] text-muted-foreground font-mono font-medium uppercase tracking-wide">
                                            {match?.[1] || 'text'}
                                          </span>
                                        </div>
                                        <CopyButton text={textContent} className="text-muted-foreground hover:text-foreground" />
                                      </div>
                                      <div className="p-3 overflow-x-auto">
                                        <code className={cn("block font-mono text-[13px] leading-relaxed", className)} {...props}>
                                          {children}
                                        </code>
                                      </div>
                                    </div>
                                  );
                                }
                              }}
                            >
                              {message.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap text-sm">{message.content}</div>
                        )}
                      </div>

                      {/* Timestamp + Action Bar */}
                      <div className={cn(
                        "flex items-center gap-2 px-1",
                        message.role === "user" ? "flex-row-reverse" : "flex-row"
                      )}>
                        <span className="text-[10px] text-muted-foreground/60">
                          {formatTime(message.timestamp)}
                        </span>

                        {/* Action bar — visible on hover */}
                        <div className="flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-200">
                          <CopyButton text={message.content} className="h-6 w-6 text-muted-foreground/60 hover:text-foreground" />
                          {index === messages.length - 1 && message.role === "assistant" && !isLoading && (
                            <TooltipProvider delayDuration={300}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost" size="icon"
                                    className="h-6 w-6 text-muted-foreground/60 hover:text-foreground"
                                    onClick={handleRetry}
                                  >
                                    <RotateCcw className="w-3 h-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom"><p className="text-xs">Regenerate</p></TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}

                {/* Typing indicator */}
                {isLoading && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-2.5 mr-auto"
                  >
                    <motion.div
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-background border border-border flex items-center justify-center shrink-0"
                      animate={{ boxShadow: ["0 0 0 0 hsl(var(--primary) / 0)", "0 0 0 6px hsl(var(--primary) / 0.15)", "0 0 0 0 hsl(var(--primary) / 0)"] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <Bot className="w-3.5 h-3.5 text-primary" />
                    </motion.div>
                    <div className="bg-muted/40 border border-border/40 text-foreground rounded-2xl rounded-tl-sm shadow-sm">
                      <TypingDots />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </CardContent>

        {/* ---- FOOTER / INPUT ---- */}
        <CardFooter className="p-2.5 sm:p-3 pt-0 border-t bg-background/50 backdrop-blur-sm mt-auto z-10">
          <div className="flex flex-col w-full gap-1.5 mt-2">
            <div className="flex w-full items-end gap-2 bg-background border border-input rounded-2xl px-3 py-2 shadow-sm 
              focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40 transition-all duration-200">
              <Input
                placeholder="Type your message..."
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
                className="flex-1 border-0 shadow-none focus-visible:ring-0 px-0 min-h-[24px] py-1 h-auto max-h-32 resize-none text-sm"
                autoComplete="off"
              />
              {isLoading ? (
                <Button
                  onClick={handleStop}
                  variant="destructive"
                  size="icon"
                  className="h-8 w-8 rounded-full shrink-0"
                >
                  <StopCircle className="w-4 h-4" />
                </Button>
              ) : (
                <Button
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                  size="icon"
                  className="h-8 w-8 rounded-full shrink-0 transition-all duration-200 shadow-sm
                    disabled:opacity-30"
                >
                  <Send className="w-4 h-4" />
                </Button>
              )}
            </div>
            {/* Character counter + hint */}
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] text-muted-foreground/50">
                <kbd className="px-1 py-0.5 bg-muted/50 rounded text-[9px] font-mono">Enter</kbd> to send
              </span>
              <span className={cn("text-[10px] transition-colors", charColor)}>
                {charCount > 0 && `${charCount}/${MAX_CHARS}`}
              </span>
            </div>
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  );
}
