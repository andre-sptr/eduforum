import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Search, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useLeaderboardData } from "@/hooks/useLeaderboardData";
import { GroupCard } from "@/components/GroupCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import GroupSkeleton from "@/components/GroupSkeleton";

const Groups = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<any[]>([]);
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<any>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState(""); 
  const [newDesc, setNewDesc] = useState(""); 
  const [priv, setPriv] = useState(false); 
  const [creating, setCreating] = useState(false);
  const [confirmLeaveId, setConfirmLeaveId] = useState<string | null>(null);
  const { topFollowers, topLiked } = useLeaderboardData();

  const initials = (n: string) => { const a = n.split(" "); return a.length >= 2 ? (a[0][0] + a[1][0]).toUpperCase() : n.slice(0, 2).toUpperCase(); };

  const followerRankMap = useMemo(() =>
    new Map(topFollowers.slice(0, 3).map((u, i) => [u.id, i + 1]))
  , [topFollowers]);

  const likerRankMap = useMemo(() =>
    new Map(topLiked.slice(0, 3).map((u, i) => [u.id, i + 1]))
  , [topLiked]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { navigate("/auth"); return; }
        setMe(user); 
        await loadGroups(user.id);
      } catch (e) {
         
      } finally {
         if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const loadGroups = async (uid: string) => {
    try {
      const { data: allGroups, error: gErr } = await supabase.from("groups")
        .select(`*,group_members(count),profiles!groups_created_by_fkey(id, full_name, avatar_url)`)
        .order("created_at", { ascending: false });
      if (gErr) throw gErr;
      
      const { data: uGroups, error: ugErr } = await supabase.from("group_members")
        .select(`*,groups(*,group_members(count),profiles!groups_created_by_fkey(id, full_name, avatar_url))`)
        .eq("user_id", uid);
      if (ugErr) throw ugErr;
      
      setGroups(allGroups || []);
      setMyGroups((uGroups || []).map(g => g.groups));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error("Nama grup tidak boleh kosong"); return; }
    setCreating(true);
    try {
      const { error } = await supabase.from("groups").insert({ 
        name: newName.trim(), 
        description: newDesc.trim(), 
        is_private: priv, 
        created_by: me.id 
      });
      if (error) throw error;
      toast.success("Grup berhasil dibuat!"); 
      setShowCreate(false); 
      setNewName(""); setNewDesc(""); setPriv(false); 
      await loadGroups(me.id);
    } catch (e: any) { 
      toast.error(e.message); 
    } finally { 
      setCreating(false); 
    }
  };

  const join = async (id: string) => { 
    try { 
      const { error } = await supabase.from("group_members").insert({ group_id: id, user_id: me.id, role: "member" }); 
      if (error) throw error; 
      toast.success("Berhasil bergabung"); 
      await loadGroups(me.id);
    } catch (e: any) { 
      toast.error(e.message);
    } 
  };

  const leave = async (id: string) => { 
    try { 
      const { error } = await supabase.from("group_members").delete().eq("group_id", id).eq("user_id", me.id); 
      if (error) throw error; 
      toast.success("Berhasil keluar"); 
      await loadGroups(me.id);
    } catch (e: any) { 
      toast.error(e.message);
    } finally { 
      setConfirmLeaveId(null);
    } 
  };

  const isMember = (id: string) => myGroups.some(g => g.id === id);

  const filteredAll = groups.filter(g => g.name.toLowerCase().includes(q.toLowerCase()) || g.description?.toLowerCase().includes(q.toLowerCase()));
  const filteredMy = myGroups.filter(g => g.name.toLowerCase().includes(q.toLowerCase()) || g.description?.toLowerCase().includes(q.toLowerCase()));

  if (loading) return <GroupSkeleton />;

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl bg-card shadow-xl border border-border p-4">
        <div className="flex flex-col md:flex-row gap-4 items-center">
             <div className="flex items-center gap-4 w-full md:w-auto">
                <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-full h-10 w-10 shrink-0 hover:bg-muted">
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                {me && (
                    <div className="flex items-center gap-3">
                         <Avatar className="h-10 w-10 ring-2 ring-border/50">
                            <AvatarImage src={me?.user_metadata?.avatar_url} />
                            <AvatarFallback>{initials(me?.user_metadata?.full_name || me?.email || "User")}</AvatarFallback>
                        </Avatar>
                    </div>
                )}
             </div>

             <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="Cari grup diskusi..." 
                    value={q} 
                    onChange={e => setQ(e.target.value)} 
                    className="pl-10 h-11 rounded-xl bg-muted/50 border-muted focus:bg-background transition-all"
                />
             </div>

             <Dialog open={showCreate} onOpenChange={setShowCreate}>
                <DialogTrigger asChild>
                    <Button className="rounded-xl h-11 px-6 shadow-md shrink-0 bg-primary hover:bg-primary/90">
                        <Plus className="h-5 w-5 mr-2"/> <span className="whitespace-nowrap">Buat Grup</span>
                    </Button>
                </DialogTrigger>
                <DialogContent className="bg-card/95 backdrop-blur-xl border-white/10 sm:max-w-md shadow-2xl">
                  <DialogHeader>
                      <DialogTitle className="text-xl">Buat Grup Baru</DialogTitle>
                      <DialogDescription>Buat ruang diskusi untuk topik spesifik atau kelas Anda.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-5 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="gn" className="text-sm font-medium">Nama Grup</Label>
                        <Input id="gn" placeholder="Contoh: Matematika Kelas 12" value={newName} onChange={e => setNewName(e.target.value)} className="bg-muted/50 border-white/10 focus:bg-background transition-colors h-10 rounded-lg"/>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="gd" className="text-sm font-medium">Deskripsi</Label>
                        <Textarea id="gd" placeholder="Jelaskan tujuan grup ini..." value={newDesc} onChange={e => setNewDesc(e.target.value)} className="bg-muted/50 border-white/10 focus:bg-background transition-colors resize-none min-h-[100px] rounded-lg"/>
                    </div>
                    <div className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-muted/30">
                        <div className="space-y-0.5">
                            <Label htmlFor="priv" className="text-base font-medium">Grup Privat</Label>
                            <p className="text-xs text-muted-foreground">Hanya anggota yang disetujui yang bisa bergabung.</p>
                        </div>
                        <Switch id="priv" checked={priv} onCheckedChange={setPriv}/>
                    </div>
                    <Button onClick={handleCreate} disabled={creating} className="w-full h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-medium text-base shadow-md transition-all hover:shadow-lg">
                        {creating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                        {creating ? "Membuat..." : "Buat Grup"}
                    </Button>
                  </div>
                </DialogContent>
             </Dialog>
        </div>
      </Card>

      <div className="rounded-2xl bg-card shadow-xl border border-border">
         <div className="p-3 sm:p-4 space-y-4">
            <Tabs defaultValue="all" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50 p-1 h-auto rounded-xl">
                    <TabsTrigger value="all" className="gap-2 rounded-lg py-2.5 text-sm font-medium transition-all">Discover</TabsTrigger>
                    <TabsTrigger value="my" className="gap-2 rounded-lg py-2.5 text-sm font-medium transition-all">My Groups</TabsTrigger>
                </TabsList>
                
                <TabsContent value="all" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-4 duration-700">
                    {filteredAll.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredAll.map(g => (
                                <GroupCard 
                                    key={g.id} 
                                    group={g} 
                                    isMember={isMember(g.id)}
                                    onJoin={join}
                                    onLeave={(id) => setConfirmLeaveId(id)}
                                    followerRankMap={followerRankMap}
                                    likerRankMap={likerRankMap}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground bg-card/20 backdrop-blur-sm rounded-3xl border border-dashed border-white/10">
                            <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                                <Users className="h-8 w-8 opacity-50" />
                            </div>
                            <p className="text-lg font-medium">Tidak ada grup yang ditemukan</p>
                            <p className="text-sm opacity-70 mt-1">Coba kata kunci lain atau buat grup baru.</p>
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="my" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-4 duration-700">
                    {filteredMy.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredMy.map(g => (
                                <GroupCard 
                                    key={g.id} 
                                    group={g} 
                                    isMember={true}
                                    onJoin={join}
                                    onLeave={(id) => setConfirmLeaveId(id)}
                                    followerRankMap={followerRankMap}
                                    likerRankMap={likerRankMap}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground bg-card/20 backdrop-blur-sm rounded-3xl border border-dashed border-white/10">
                             <div className="w-16 h-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                                <Users className="h-8 w-8 opacity-50" />
                            </div>
                            <p className="text-lg font-medium">Anda belum bergabung dengan grup apapun</p>
                            <Button variant="link" onClick={() => document.querySelector('[data-state="inactive"][value="all"]')?.dispatchEvent(new MouseEvent('click', {bubbles: true}))} className="text-primary mt-2 font-medium">
                                Jelajahi Grup
                            </Button>
                        </div>
                    )}
                </TabsContent>
            </Tabs>
         </div>
      </div>

      <AlertDialog open={!!confirmLeaveId} onOpenChange={v => !v && setConfirmLeaveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Keluar dari grup?</AlertDialogTitle>
            <AlertDialogDescription>
                Anda akan menghapus keanggotaan dari grup ini. Anda mungkin perlu meminta izin untuk bergabung kembali jika grup ini bersifat privat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => confirmLeaveId && leave(confirmLeaveId)}>
                Keluar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Groups;
