import { useEffect, useState, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Search, User, FileText, History, X, Clock, Loader2, Filter } from "lucide-react";
import PostCard from "@/components/PostCard";
import PostSkeleton from "@/components/PostSkeleton";
import { RankBadge } from "@/components/RankBadge";
import { useLeaderboardData } from "@/hooks/useLeaderboardData";
import { useSearch } from "@/hooks/useSearch";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SearchPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  
  const { 
    query, setQuery, 
    mode, setMode, 
    posts, users, 
    loading, 
    history, saveToHistory, clearHistory, removeFromHistory, 
    loadMore, hasMore 
  } = useSearch({ initialQuery });

  const [currentUser, setCurrentUser] = useState<any>(null);
  const { topFollowers, topLiked } = useLeaderboardData();
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const followerRankMap = useMemo(() =>
    new Map(topFollowers.slice(0, 3).map((u, i) => [u.id, i + 1]))
  , [topFollowers]);

  const likerRankMap = useMemo(() =>
    new Map(topLiked.slice(0, 3).map((u, i) => [u.id, i + 1]))
  , [topLiked]);

  const getInitials = (n: string) => { const a = n.trim().split(" "); return (a[0][0] + (a[1]?.[0] || a[0][1] || "")).toUpperCase(); };

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
      if (query.trim()) {
          setSearchParams({ q: query });
      } else {
          setSearchParams({});
      }
  }, [query, setSearchParams]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/auth"); return; }
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
    setCurrentUser(profile);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowHistory(false);
    saveToHistory(query);
    
  };

  const handleHistoryClick = (term: string) => {
    setQuery(term);
    setShowHistory(false);
    saveToHistory(term);
  };

  const observerTarget = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 1.0 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasMore, loading, loadMore]);

  return (
    <div className="container max-w-5xl mx-auto py-8 space-y-8 min-h-[80vh]">
      <div className="flex flex-col gap-2 mb-4">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">Pencarian</h1>
        <p className="text-muted-foreground">Temukan teman baru, diskusi menarik, dan topik yang Anda sukai.</p>
      </div>

      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl py-4 -mx-4 px-4 border-b border-border/40 md:static md:bg-transparent md:border-none md:p-0 md:m-0">
          <form onSubmit={handleSubmit} className="relative max-w-3xl mx-auto w-full">
            <div className="relative group">
              <div className={`absolute inset-0 bg-primary/5 rounded-2xl blur-xl transition-opacity duration-500 ${loading || query ? "opacity-100" : "opacity-0"}`} />
              <Search className={`absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 transition-colors ${loading ? "text-primary" : "text-muted-foreground"}`} />
              
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setShowHistory(true)}
                placeholder="Cari pengguna, postingan, atau topik..."
                className="pl-14 pr-24 py-7 rounded-2xl bg-card/50 backdrop-blur-sm border-muted/40 shadow-sm focus-visible:ring-primary/20 text-lg transition-all hover:bg-card/80 hover:border-primary/20"
              />

              {loading && (
                  <div className="absolute right-12 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
              )}
              
              {query && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-12 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-transparent text-muted-foreground hover:text-foreground"
                    onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                >
                    <X className="h-4 w-4" />
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button 
                        type="button"
                        variant="ghost" 
                        size="sm" 
                        className="absolute right-3 top-1/2 -translate-y-1/2 h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                    >
                        <Filter className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setMode('OR')}>
                        <span className={mode === 'OR' ? "font-bold text-primary" : ""}>Match Any (OR)</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setMode('AND')}>
                        <span className={mode === 'AND' ? "font-bold text-primary" : ""}>Match All (AND)</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            { }
            {showHistory && history.length > 0 && !query && (
                <div className="absolute top-full left-0 right-0 z-50 mt-3 bg-card/90 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between px-5 py-3 bg-muted/30 border-b border-border/50">
                        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 uppercase tracking-wider">
                            <Clock className="h-3.5 w-3.5" /> Terakhir Dicari
                        </span>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-auto p-0 text-xs text-destructive/80 hover:bg-transparent hover:text-destructive transition-colors" 
                            onClick={clearHistory}
                        >
                            Hapus Semua
                        </Button>
                    </div>
                    <div className="py-2">
                        {history.map((term, i) => (
                            <div 
                                key={i} 
                                className="flex items-center justify-between px-5 py-3 hover:bg-primary/5 cursor-pointer group transition-all"
                                onClick={() => handleHistoryClick(term)}
                            >
                                <div className="flex items-center gap-3.5">
                                    <div className="p-1.5 rounded-full bg-muted/50 group-hover:bg-primary/10 transition-colors">
                                        <History className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                    </div>
                                    <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors">{term}</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-destructive/10 hover:text-destructive"
                                    onClick={(e) => { e.stopPropagation(); removeFromHistory(term); }}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            { }
            {showHistory && (
                <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setShowHistory(false)} />
            )}
          </form>
      </div>

      <div className="space-y-8">
        { }
        {users.length > 0 && (
            <section className="animate-in slide-in-from-bottom-4 duration-500 delay-100">
            <div className="flex items-center gap-2 mb-4 px-1">
                <User className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-bold tracking-wide uppercase text-muted-foreground">Pengguna</h2>
                <Badge variant="secondary" className="ml-auto text-xs">{users.length} ditemukan</Badge>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {users.map(u => (
                <Card 
                    key={u.id} 
                    onClick={() => navigate(`/profile/${u.id}`)} 
                    className="cursor-pointer rounded-2xl border-white/5 bg-card/40 backdrop-blur-sm hover:bg-card/60 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group overflow-hidden"
                >
                    <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12 ring-2 ring-border/50 group-hover:ring-primary/50 transition-all shadow-sm">
                        <AvatarImage src={u.avatar_url || undefined} className="object-cover" />
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5 text-primary font-bold">
                            {getInitials(u.full_name)}
                        </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <p className="font-semibold truncate group-hover:text-primary transition-colors">{u.full_name}</p>
                            <RankBadge rank={followerRankMap.get(u.id)} type="follower" />
                            <RankBadge rank={likerRankMap.get(u.id)} type="like" />
                        </div>
                        {u.bio && <p className="text-sm text-muted-foreground truncate">{u.bio}</p>}
                        </div>
                    </div>
                    </CardContent>
                </Card>
                ))}
            </div>
            </section>
        )}

        { }
        <section className="animate-in slide-in-from-bottom-4 duration-500 delay-200">
          <div className="flex items-center gap-2 mb-4 px-1">
            <FileText className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold tracking-wide uppercase text-muted-foreground">Postingan</h2>
            <Badge variant="secondary" className="ml-auto text-xs">{posts.length}+ hasil</Badge>
          </div>

          {loading && posts.length === 0 ? (
            <div className="space-y-4">
                <PostSkeleton />
                <PostSkeleton />
            </div>
          ) : posts.length > 0 ? (
            <div className="space-y-6">
              {posts.map(p => (
                <PostCard 
                    key={`${p.id}-${p.created_at}`} 
                    post={p} 
                    currentUserId={currentUser?.id}
                    onPostUpdated={() => {}} 
                    onPostDeleted={() => {}} 
                    postType="global" 
                    topFollowers={topFollowers} 
                    topLiked={topLiked}
                />
              ))}
              
              { }
              <div ref={observerTarget} className="h-10 flex items-center justify-center">
                  {loading && hasMore && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}
                  {!hasMore && posts.length > 0 && <p className="text-xs text-muted-foreground">Semua hasil ditampilkan</p>}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center rounded-3xl bg-gradient-to-br from-muted/20 to-muted/5 border border-dashed border-border/50">
                <div className="bg-background/50 p-4 rounded-full shadow-sm mb-4 backdrop-blur-sm">
                    <Search className="h-8 w-8 text-muted-foreground/50" />
                </div>
                {query ? (
                    <div className="space-y-2 max-w-md">
                        <h3 className="text-lg font-semibold text-foreground">Tidak ada hasil ditemukan</h3>
                        <p className="text-muted-foreground">Kami tidak dapat menemukan apa pun untuk "{query}". Coba kata kunci lain atau periksa ejaan Anda.</p>
                    </div>
                ) : (
                    <div className="space-y-2 max-w-md">
                        <h3 className="text-lg font-semibold text-foreground">Mulai pencarian Anda</h3>
                        <p className="text-muted-foreground">Ketik nama pengguna, topik, atau isi postingan untuk mulai menjelajah.</p>
                    </div>
                )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default SearchPage;
