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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
        <p className="mt-4 text-muted-foreground">Memuat grup...</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="rounded-xl"><ArrowLeft className="h-5 w-5" /></Button>
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
                    <Users className="w-6 h-6 text-primary-foreground" />
                </div>
                <div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Grup Diskusi</h1>
                    <p className="text-xs text-muted-foreground">Temukan komunitas belajar Anda</p>
                </div>
            </div>
          </div>
          
          <Dialog open={showCreate} onOpenChange={setShowCreate}>
            <DialogTrigger asChild>
                <Button className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-md">
                    <Plus className="h-4 w-4 mr-2"/> Buat Grup
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border sm:max-w-md">
              <DialogHeader>
                  <DialogTitle>Buat Grup Baru</DialogTitle>
                  <DialogDescription>Buat ruang diskusi untuk topik spesifik atau kelas Anda.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                    <Label htmlFor="gn">Nama Grup</Label>
                    <Input id="gn" placeholder="Contoh: Matematika Kelas 12" value={newName} onChange={e => setNewName(e.target.value)} className="bg-muted/50 border-border"/>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="gd">Deskripsi</Label>
                    <Textarea id="gd" placeholder="Jelaskan tujuan grup ini..." value={newDesc} onChange={e => setNewDesc(e.target.value)} className="bg-muted/50 border-border resize-none min-h-[100px]"/>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                    <div className="space-y-0.5">
                        <Label htmlFor="priv" className="text-base">Grup Privat</Label>
                        <p className="text-xs text-muted-foreground">Hanya anggota yang disetujui yang bisa bergabung dan melihat konten.</p>
                    </div>
                    <Switch id="priv" checked={priv} onCheckedChange={setPriv}/>
                </div>
                <Button onClick={handleCreate} disabled={creating} className="w-full rounded-xl bg-primary text-primary-foreground hover:bg-primary/90">
                    {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {creating ? "Membuat..." : "Buat Grup"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
      </div>

      <div className="space-y-6">
        <Tabs defaultValue="all" className="w-full">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
                <TabsList className="grid grid-cols-2 w-full sm:w-[300px] h-auto p-1 bg-muted/60 rounded-xl">
                    <TabsTrigger value="all" className="gap-2 rounded-lg py-2">Discover</TabsTrigger>
                    <TabsTrigger value="my" className="gap-2 rounded-lg py-2">My Groups</TabsTrigger>
                </TabsList>
                
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Cari grup..." 
                        value={q} 
                        onChange={e => setQ(e.target.value)} 
                        className="pl-9 rounded-xl bg-card/50 border-border focus:ring-primary/20"
                    />
                </div>
            </div>

            <TabsContent value="all" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
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
                    <div className="text-center py-16 bg-card/30 rounded-3xl border border-dashed border-border">
                        <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                        <p className="text-muted-foreground font-medium">Tidak ada grup yang ditemukan</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">Coba kata kunci lain atau buat grup baru.</p>
                    </div>
                )}
            </TabsContent>

            <TabsContent value="my" className="space-y-6 animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
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
                    <div className="text-center py-16 bg-card/30 rounded-3xl border border-dashed border-border">
                         <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                        <p className="text-muted-foreground font-medium">Anda belum bergabung dengan grup apapun</p>
                        <Button variant="link" onClick={() => document.querySelector('[data-state="inactive"][value="all"]')?.dispatchEvent(new MouseEvent('click', {bubbles: true}))} className="text-primary mt-2">
                            Jelajahi Grup
                        </Button>
                    </div>
                )}
            </TabsContent>
        </Tabs>
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
