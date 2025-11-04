// src/pages/Settings.tsx
import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Upload, Loader2, Maximize2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/lib/mediaUtils";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name is too long"),
  bio: z.string().max(500, "Bio is too long (max 500 characters)").optional(),
});

const Settings = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [viewerOpen, setViewerOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (error) throw error;
      setProfile(data);
      setFullName(data.full_name || "");
      setBio(data.bio || "");
      setAvatarPreview(data.avatar_url || "");
    } catch (error: any) { toast.error(error.message); }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("File harus berupa gambar"); return; }
    if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { profileSchema.parse({ fullName, bio: bio || undefined }); }
    catch (err) { if (err instanceof z.ZodError) toast.error(err.errors[0].message); return; }

    setLoading(true);
    try {
      let avatarUrl = profile.avatar_url || "";
      if (avatarFile) {
        const compressedFile = await compressImage(avatarFile);
        const ext = (compressedFile.name.split(".").pop() || "jpg").toLowerCase();
        const path = `${profile.id}/avatar.${ext}`;
        const { error: uploadError } = await supabase.storage.from("media").upload(path, compressedFile, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from("media").getPublicUrl(path);
        avatarUrl = `${publicUrl}?v=${Date.now()}`;
      }
      const { error } = await supabase.from("profiles").update({ full_name: fullName, bio, avatar_url: avatarUrl }).eq("id", profile.id);
      if (error) throw error;
      toast.success("Profil berhasil diperbarui!");
      navigate("/profile");
    } catch (error: any) { toast.error(error.message); }
    finally { setLoading(false); }
  };

  const handleDeleteAvatar = async () => {
    if (!profile) return;
    if (!confirm("Hapus foto profil dan kembali ke avatar default?")) return;
    setDeleting(true);
    try {
      const exts = ["jpg","jpeg","png","webp","gif","avif"];
      const paths = exts.map(ext => `${profile.id}/avatar.${ext}`);
      await supabase.storage.from("media").remove(paths);
      const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", profile.id);
      if (error) throw error;
      if (avatarPreview?.startsWith("blob:")) URL.revokeObjectURL(avatarPreview);
      setAvatarFile(null);
      setAvatarPreview("");
      setProfile((p: any) => ({ ...p, avatar_url: null }));
      toast.success("Foto profil dihapus. Menggunakan avatar default.");
    } catch (err: any) { toast.error(err.message); }
    finally { setDeleting(false); }
  };

  const getInitials = (name: string) => {
    const s = name.trim().split(" ");
    return ((s[0]?.[0] || "") + (s[1]?.[0] || "") || name.slice(0, 2)).toUpperCase();
  };

  if (!profile) {
    return (
      <div className="min-h-screen grid place-items-center bg-gradient-to-br from-background via-muted/40 to-accent/10">
        <div className="text-center">
          <div className="h-12 w-12 mx-auto animate-spin rounded-full border-2 border-border border-t-accent" />
          <p className="mt-4 text-muted-foreground">Memuat…</p>
        </div>
      </div>
    );
  }

  const isDefaultAvatar = !profile?.avatar_url;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-accent/10">
      <header className="sticky top-0 z-50 border-b bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/profile")} className="rounded-xl">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
            Pengaturan Profil
          </h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="rounded-2xl border-border bg-card/60 backdrop-blur shadow-xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">Edit Profil</CardTitle>
            <CardDescription>Perbarui identitas dan avatar akun Anda</CardDescription>
          </CardHeader>

          <CardContent className="pt-4">
            <form onSubmit={handleSubmit} className="space-y-7">
              <div className="flex flex-col items-center gap-4">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => !isDefaultAvatar && setViewerOpen(true)}
                    className={`group rounded-full outline-none ring-0 transition ${isDefaultAvatar ? "cursor-not-allowed opacity-60" : "focus:ring-2 focus:ring-accent/40"}`}
                    title={isDefaultAvatar ? "Avatar default — tidak ada gambar untuk diperbesar" : "Lihat foto asli"}
                    disabled={isDefaultAvatar}
                  >
                    <Avatar className="h-28 w-28 ring-4 ring-accent/20 shadow-md">
                      <AvatarImage src={avatarPreview} className="object-cover" />
                      <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                        {getInitials(fullName)}
                      </AvatarFallback>
                    </Avatar>
                    {!isDefaultAvatar && (
                      <span className="absolute -bottom-2 -right-2 grid place-items-center h-8 w-8 rounded-full bg-card/90 border shadow group-hover:scale-105 transition">
                        <Maximize2 className="h-4 w-4" />
                      </span>
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDeleteAvatar}
                    disabled={deleting || isDefaultAvatar}
                    className="rounded-xl"
                    title={isDefaultAvatar ? "Tidak ada foto untuk dihapus" : "Hapus foto profil"}
                  >
                    {deleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                    Hapus Foto
                  </Button>
                  <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="rounded-xl">
                    <Upload className="h-4 w-4 mr-2" /> Upload Foto
                  </Button>
                  {avatarFile && <span className="text-xs text-muted-foreground max-w-[220px] truncate"></span>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fullName">Nama Lengkap</Label>
                <Input id="fullName" value={fullName} onChange={(e)=>setFullName(e.target.value)} required className="bg-input/60 border-border rounded-xl" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <Input id="role" disabled value={profile.role?.charAt(0).toUpperCase()+profile.role?.slice(1)} className="bg-muted/50 border-border text-muted-foreground rounded-xl" />
                <p className="text-xs text-muted-foreground">Role tidak dapat diubah setelah registrasi.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e)=>setBio(e.target.value)}
                  placeholder="Ceritakan sedikit tentang diri Anda…"
                  className="min-h-[110px] bg-input/60 border-border rounded-xl resize-none"
                />
              </div>

              <Button type="submit" disabled={loading} className="w-full rounded-xl bg-accent text-accent-foreground hover:bg-accent/90">
                {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Menyimpan…</>) : "Simpan Perubahan"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6"><DialogTitle>Foto Profil</DialogTitle></DialogHeader>
          <div className="p-6 pt-0">
            <div className="rounded-xl overflow-hidden border bg-black/5">
              <img src={avatarPreview || profile.avatar_url || ""} alt="Avatar" className="w-full h-full object-contain max-h-[70vh]" />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;