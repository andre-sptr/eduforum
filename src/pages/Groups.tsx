// src/pages/Groups.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Users, Lock, Globe, Search } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

const Groups=()=> {
  const navigate=useNavigate();
  const [groups,setGroups]=useState<any[]>([]);
  const [myGroups,setMyGroups]=useState<any[]>([]);
  const [q,setQ]=useState("");
  const [loading,setLoading]=useState(true);
  const [me,setMe]=useState<any>(null);
  const [showCreate,setShowCreate]=useState(false);
  const [newName,setNewName]=useState(""); 
  const [newDesc,setNewDesc]=useState(""); 
  const [priv,setPriv]=useState(false); 
  const [creating,setCreating]=useState(false);
  const [confirmLeaveId,setConfirmLeaveId]=useState<string|null>(null);

  useEffect(()=>{(async()=>{
    const { data:{ user } }=await supabase.auth.getUser(); if(!user){ navigate("/auth"); return; }
    setMe(user); await loadGroups(user.id);
  })()},[]);

  const loadGroups=async(uid:string)=>{
    try{
      const { data:allGroups,error:gErr }=await supabase.from("groups").select(`*,group_members(count),profiles!groups_created_by_fkey(full_name,avatar_url)`).order("created_at",{ascending:false}); if(gErr) throw gErr;
      const { data:uGroups,error:ugErr }=await supabase.from("group_members").select(`*,groups(*,group_members(count),profiles!groups_created_by_fkey(full_name,avatar_url))`).eq("user_id",uid); if(ugErr) throw ugErr;
      setGroups(allGroups||[]); setMyGroups((uGroups||[]).map(g=>g.groups));
    }catch(e:any){ toast.error(e.message); }finally{ setLoading(false); }
  };

  const handleCreate=async()=>{
    if(!newName.trim()){ toast.error("Nama grup tidak boleh kosong"); return; }
    setCreating(true);
    try{
      const { error }=await supabase.from("groups").insert({ name:newName.trim(), description:newDesc.trim(), is_private:priv, created_by:me.id }); if(error) throw error;
      toast.success("Grup berhasil dibuat!"); setShowCreate(false); setNewName(""); setNewDesc(""); setPriv(false); await loadGroups(me.id);
    }catch(e:any){ toast.error(e.message); }finally{ setCreating(false); }
  };

  const join=async(id:string)=>{ try{ const { error }=await supabase.from("group_members").insert({ group_id:id, user_id:me.id, role:"member" }); if(error) throw error; toast.success("Berhasil bergabung"); await loadGroups(me.id);}catch(e:any){ toast.error(e.message);} };
  const leave=async(id:string)=>{ try{ const { error }=await supabase.from("group_members").delete().eq("group_id",id).eq("user_id",me.id); if(error) throw error; toast.success("Berhasil keluar"); await loadGroups(me.id);}catch(e:any){ toast.error(e.message);}finally{ setConfirmLeaveId(null);} };

  const filtered=groups.filter(g=>g.name.toLowerCase().includes(q.toLowerCase()));
  const inGroup=(id:string)=>myGroups.some(g=>g.id===id);
  const initials=(s:string)=>s?.split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase()||"U";

  if(loading) return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-b from-background to-background/60">
      <div className="text-center"><div className="h-12 w-12 mx-auto animate-spin rounded-full border-2 border-border border-t-accent"/><p className="mt-4 text-muted-foreground">Memuat...</p></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-border bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={()=>navigate("/")} className="rounded-xl"><ArrowLeft className="h-5 w-5"/></Button>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">Grup Diskusi</h1>
          <div className="ml-auto">
            <Dialog open={showCreate} onOpenChange={setShowCreate}>
              <DialogTrigger asChild><Button className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90"><Plus className="h-4 w-4 mr-2"/>Buat Grup</Button></DialogTrigger>
              <DialogContent className="bg-card border-border sm:max-w-md">
                <DialogHeader><DialogTitle>Buat Grup Baru</DialogTitle><DialogDescription>Buat ruang diskusi komunitas Anda</DialogDescription></DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2"><Label htmlFor="gn">Nama Grup</Label><Input id="gn" placeholder="Matematika Kelas 12" value={newName} onChange={e=>setNewName(e.target.value)} className="bg-input/60 border-border"/></div>
                  <div className="space-y-2"><Label htmlFor="gd">Deskripsi</Label><Textarea id="gd" placeholder="Jelaskan tentang grup ini..." value={newDesc} onChange={e=>setNewDesc(e.target.value)} className="bg-input/60 border-border resize-none"/></div>
                  <div className="flex items-center justify-between"><div className="space-y-0.5"><Label htmlFor="priv">Grup Privat</Label><p className="text-xs text-muted-foreground">Hanya anggota yang bisa melihat postingan</p></div><Switch id="priv" checked={priv} onCheckedChange={setPriv}/></div>
                  <Button onClick={handleCreate} disabled={creating} className="w-full rounded-xl bg-accent text-accent-foreground hover:bg-accent/90">{creating?"Membuat...":"Buat Grup"}</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground"/>
          <Input placeholder="Cari grup..." value={q} onChange={e=>setQ(e.target.value)} className="pl-10 rounded-xl bg-input/60 border-border focus-visible:ring-2 focus-visible:ring-accent"/>
        </div>

        {myGroups.length>0&&(
          <section>
            <h2 className="mb-4 text-xl font-semibold">Grup Saya</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {myGroups.map(g=>(
                <Card key={g.id} onClick={()=>navigate(`/groups/${g.id}`)} className="group cursor-pointer rounded-2xl border-border bg-card/60 backdrop-blur transition hover:shadow-md hover:-translate-y-0.5">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="truncate text-lg">{g.name}</CardTitle>
                        <CardDescription className="mt-1 line-clamp-2">{g.description||"Tidak ada deskripsi"}</CardDescription>
                        <div className="mt-3 flex items-center gap-2 text-sm">
                          <Avatar className="h-6 w-6"><AvatarImage src={g.profiles?.avatar_url||""}/><AvatarFallback className="bg-primary text-primary-foreground font-semibold">{initials(g.profiles?.full_name||"")}</AvatarFallback></Avatar>
                          <span className="truncate text-muted-foreground">Owner: {g.profiles?.full_name||"—"}</span>
                        </div>
                      </div>
                      {g.is_private?<Lock className="h-4 w-4 text-muted-foreground"/>:<Globe className="h-4 w-4 text-muted-foreground"/>}
                    </div>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4"/><span>{g.group_members?.[0]?.count||0} anggota</span></div>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={e=>{e.stopPropagation();setConfirmLeaveId(g.id);}}>Keluar</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-4 text-xl font-semibold">Semua Grup</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map(g=>(
              <Card key={g.id} className="rounded-2xl border-border bg-card/60 backdrop-blur transition hover:shadow-md hover:-translate-y-0.5">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="truncate text-lg">{g.name}</CardTitle>
                      <CardDescription className="mt-1 line-clamp-2">{g.description||"Tidak ada deskripsi"}</CardDescription>
                      <div className="mt-3 flex items-center gap-2 text-sm">
                        <Avatar className="h-6 w-6"><AvatarImage src={g.profiles?.avatar_url||""}/><AvatarFallback className="bg-primary text-primary-foreground font-semibold">{initials(g.profiles?.full_name||"")}</AvatarFallback></Avatar>
                        <span className="truncate text-muted-foreground">Owner: {g.profiles?.full_name||"—"}</span>
                      </div>
                    </div>
                    {g.is_private?<Lock className="h-4 w-4 text-muted-foreground"/>:<Globe className="h-4 w-4 text-muted-foreground"/>}
                  </div>
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="h-4 w-4"/><span>{g.group_members?.[0]?.count||0} anggota</span></div>
                  {myGroups.some(x=>x.id===g.id)?(
                    <Button size="sm" variant="outline" onClick={()=>navigate(`/groups/${g.id}`)} className="rounded-xl border-accent text-accent hover:bg-accent/10">Lihat Grup</Button>
                  ):(
                    <Button size="sm" onClick={()=>join(g.id)} className="rounded-xl bg-accent text-accent-foreground hover:bg-accent/90">Gabung</Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>

      <AlertDialog open={!!confirmLeaveId} onOpenChange={v=>!v&&setConfirmLeaveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Keluar dari grup?</AlertDialogTitle><AlertDialogDescription>Anda akan menghapus keanggotaan dari grup ini.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={()=>confirmLeaveId&&leave(confirmLeaveId)}>Keluar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Groups;