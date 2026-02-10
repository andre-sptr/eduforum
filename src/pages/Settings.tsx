import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, Loader2, Maximize2, Trash2, LogOut, User, Shield, Palette, Moon, Sun, Monitor, Lock, AlertTriangle, Mail, X } from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/lib/mediaUtils";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useTheme } from "@/components/ThemeProvider";
import { Separator } from "@/components/ui/separator";

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name is too long"),
  bio: z.string().max(500, "Bio is too long (max 500 characters)").optional(),
});

const passwordSchema = z.object({
  password: z.string().min(6, "Password minimal 6 karakter"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Password tidak cocok",
  path: ["confirmPassword"],
});

const Settings = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string>("");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [deletingAvatar, setDeletingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => { loadProfile(); }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      setCurrentUser(user);
      
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

  const handleProfileSubmit = async (e: React.FormEvent) => {
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

      setProfile(prev => ({ ...prev, full_name: fullName, bio, avatar_url: avatarUrl }));
      setAvatarFile(null);
      toast.success("Profil berhasil diperbarui!");
    } catch (error: any) { toast.error(error.message); }
    finally { setLoading(false); }
  };

  const handleDeleteAvatar = async () => {
    if (!profile) return;
    if (!confirm("Hapus foto profil dan kembali ke avatar default?")) return;
    setDeletingAvatar(true);
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
      toast.success("Foto profil dihapus.");
    } catch (err: any) { toast.error(err.message); }
    finally { setDeletingAvatar(false); }
  };

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try { passwordSchema.parse({ password, confirmPassword }); }
    catch (err) { if (err instanceof z.ZodError) toast.error(err.errors[0].message); return; }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: password });
      if (error) throw error;
      toast.success("Password berhasil diperbarui!");
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) { toast.error(err.message); }
    finally { setPasswordLoading(false); }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== "DELETE") {
      toast.error("Ketik DELETE untuk konfirmasi");
      return;
    }
    setDeletingAccount(true);

    try {

        toast.info("Fitur hapus akun permanen perlu konfirmasi admin. Anda telah logged out.");
        await supabase.auth.signOut();
        navigate("/auth");
    } catch (err: any) { toast.error(err.message); }
    finally { setDeletingAccount(false); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const getInitials = (name: string) => {
    const s = name.trim().split(" ");
    return ((s[0]?.[0] || "") + (s[1]?.[0] || "") || name.slice(0, 2)).toUpperCase();
  };

  if (!profile) {
    return (
      <div className="min-h-[50vh] grid place-items-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isDefaultAvatar = !profile?.avatar_url && !avatarFile;

  return (
    <div className="container max-w-5xl mx-auto py-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pengaturan</h1>
        <p className="text-muted-foreground">Kelola profil, preferensi akun, dan tampilan aplikasi Anda.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        { }
        <aside className="md:w-64 flex-shrink-0">
          <nav className="flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible pb-2 md:pb-0">
            <Button
              variant={activeTab === "profile" ? "secondary" : "ghost"}
              className="justify-start"
              onClick={() => setActiveTab("profile")}
            >
              <User className="mr-2 h-4 w-4" /> Profil
            </Button>
            <Button
              variant={activeTab === "account" ? "secondary" : "ghost"}
              className="justify-start"
              onClick={() => setActiveTab("account")}
            >
              <Shield className="mr-2 h-4 w-4" /> Akun
            </Button>
            <Button
              variant={activeTab === "appearance" ? "secondary" : "ghost"}
              className="justify-start"
              onClick={() => setActiveTab("appearance")}
            >
              <Palette className="mr-2 h-4 w-4" /> Tampilan
            </Button>
            <Separator className="my-2 hidden md:block" />
            <Button
              variant="ghost"
              className="justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" /> Keluar
            </Button>
          </nav>
        </aside>

        { }
        <div className="flex-1 space-y-6">
          
          { }
          {activeTab === "profile" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card>
                <CardHeader>
                  <CardTitle>Profil Publik</CardTitle>
                  <CardDescription>Informasi ini akan ditampilkan secara publik di profil Anda.</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleProfileSubmit} className="space-y-8">
                    <div className="flex flex-col sm:flex-row items-start gap-6">
                      <div className="flex flex-col items-center gap-3">
                        <div className="relative group">
                          <button
                            type="button"
                            onClick={() => !isDefaultAvatar && setViewerOpen(true)}
                            className={`relative overflow-hidden rounded-full ring-4 ring-background shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-accent ${isDefaultAvatar ? "cursor-default" : "cursor-zoom-in"}`}
                          >
                            <Avatar className="h-32 w-32">
                              <AvatarImage src={avatarPreview} className="object-cover" />
                              <AvatarFallback className="text-3xl bg-primary text-primary-foreground font-bold">
                                {getInitials(fullName)}
                              </AvatarFallback>
                            </Avatar>
                            {!isDefaultAvatar && (
                                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Maximize2 className="h-6 w-6 text-white" />
                                </div>
                            )}
                          </button>
                        </div>
                        <div className="flex items-center gap-2">
                            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                            <Button type="button" size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
                                <Upload className="h-3.5 w-3.5 mr-2" /> Ubah
                            </Button>
                            {!isDefaultAvatar && (
                                <Button type="button" size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={handleDeleteAvatar} disabled={deletingAvatar}>
                                    {deletingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                </Button>
                            )}
                        </div>
                      </div>

                      <div className="flex-1 space-y-4 w-full">
                        <div className="grid gap-2">
                          <Label htmlFor="fullName">Nama Lengkap</Label>
                          <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="role">Role</Label>
                          <div className="flex items-center gap-2">
                             <Input id="role" disabled value={profile.role?.toUpperCase()} className="bg-muted text-muted-foreground w-full sm:w-1/3" />
                             <span className="text-xs text-muted-foreground">Permanen</span>
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="bio">Bio</Label>
                          <Textarea
                            id="bio"
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            placeholder="Ceritakan sedikit tentang diri Anda..."
                            className="min-h-[120px] resize-none"
                          />
                          <p className="text-xs text-muted-foreground text-right">{bio.length}/500</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-4 border-t">
                        <Button type="submit" disabled={loading} className="min-w-[120px]">
                            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan</> : "Simpan Perubahan"}
                        </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}

          { }
          {activeTab === "account" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card>
                <CardHeader>
                  <CardTitle>Keamanan Akun</CardTitle>
                  <CardDescription>Kelola email dan password akun Anda.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-1">
                        <Label>Email</Label>
                        <div className="flex items-center gap-3">
                            <div className="relative flex-1">
                                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input value={currentUser?.email} disabled className="pl-9 bg-muted" />
                            </div>
                            <Button variant="outline" disabled>Ubah</Button>
                        </div>
                        <p className="text-[11px] text-muted-foreground">Email tidak dapat diubah saat ini.</p>
                    </div>

                    <Separator />

                    <form onSubmit={handlePasswordUpdate} className="space-y-4">
                        <h3 className="text-sm font-medium">Ganti Password</h3>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="password">Password Baru</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input id="password" type="password" value={password} onChange={(e)=>setPassword(e.target.value)} className="pl-9" placeholder="••••••••" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e)=>setConfirmPassword(e.target.value)} className="pl-9" placeholder="••••••••" />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <Button type="submit" disabled={!password || passwordLoading}>
                                {passwordLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Password"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
              </Card>

              <Card className="border-destructive/30 bg-destructive/5">
                <CardHeader>
                  <CardTitle className="text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" /> Danger Zone
                  </CardTitle>
                  <CardDescription>Tindakan ini tidak dapat dibatalkan.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border border-destructive/20 rounded-lg bg-card/50">
                        <div className="space-y-1">
                            <h4 className="font-medium text-destructive">Hapus Akun</h4>
                            <p className="text-sm text-muted-foreground">Menghapus akun Anda dan semua datanya secara permanen.</p>
                        </div>
                        <Dialog>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Apakah Anda yakin?</DialogTitle>
                                    <DialogDescription>
                                        Tindakan ini tidak dapat dibatalkan. Ini akan menghapus akun Anda secara permanen dan menghapus data Anda dari server kami.
                                        <br/><br/>
                                        Ketik <strong>DELETE</strong> untuk mengonfirmasi.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <Input 
                                        value={deleteConfirm} 
                                        onChange={(e) => setDeleteConfirm(e.target.value)} 
                                        placeholder="Ketik DELETE"
                                        className="border-destructive/50 focus-visible:ring-destructive"
                                    />
                                    <Button 
                                        variant="destructive" 
                                        className="w-full" 
                                        disabled={deleteConfirm !== "DELETE" || deletingAccount}
                                        onClick={handleDeleteAccount}
                                    >
                                        {deletingAccount ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Hapus Akun Permanen"}
                                    </Button>
                                </div>
                            </DialogContent>
                            <Button variant="destructive">Hapus Akun</Button>
                        </Dialog>
                    </div>
                </CardContent>
              </Card>
            </div>
          )}

          { }
          {activeTab === "appearance" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card>
                <CardHeader>
                  <CardTitle>Tampilan Aplikasi</CardTitle>
                  <CardDescription>Sesuaikan tampilan EduForum sesuai preferensi Anda.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6">
                    <div className="space-y-4">
                        <Label className="text-base">Tema</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <button
                                onClick={() => setTheme("light")}
                                className={`group relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${theme === "light" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                            >
                                <div className="h-20 w-full rounded-lg bg-[#f0f0f0] border border-gray-200 flex items-center justify-center overflow-hidden">
                                    <div className="space-y-2 w-3/4 opacity-50">
                                        <div className="h-2 w-full bg-white rounded-md shadow-sm" />
                                        <div className="h-2 w-2/3 bg-white rounded-md shadow-sm" />
                                    </div>
                                    <Sun className={`absolute h-6 w-6 text-orange-500 ${theme === "light" ? "scale-110" : "scale-100"}`} />
                                </div>
                                <span className="text-sm font-medium">Terang</span>
                            </button>

                            <button
                                onClick={() => setTheme("dark")}
                                className={`group relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${theme === "dark" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                            >
                                <div className="h-20 w-full rounded-lg bg-[#1a1a1a] border border-gray-800 flex items-center justify-center overflow-hidden">
                                    <div className="space-y-2 w-3/4 opacity-50">
                                        <div className="h-2 w-full bg-gray-800 rounded-md" />
                                        <div className="h-2 w-2/3 bg-gray-800 rounded-md" />
                                    </div>
                                    <Moon className={`absolute h-6 w-6 text-blue-400 ${theme === "dark" ? "scale-110" : "scale-100"}`} />
                                </div>
                                <span className="text-sm font-medium">Gelap</span>
                            </button>

                            <button
                                onClick={() => setTheme("system")}
                                className={`group relative flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${theme === "system" ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`}
                            >
                                <div className="h-20 w-full rounded-lg bg-gradient-to-r from-[#f0f0f0] to-[#1a1a1a] border border-gray-200 flex items-center justify-center overflow-hidden">
                                     <Monitor className={`absolute h-6 w-6 text-foreground ${theme === "system" ? "scale-110" : "scale-100"}`} />
                                </div>
                                <span className="text-sm font-medium">System</span>
                            </button>
                        </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

        </div>
      </div>

      <Dialog open={viewerOpen} onOpenChange={setViewerOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-transparent border-none shadow-none">
          <DialogTitle className="sr-only">Foto Profil</DialogTitle>
          <div className="relative w-full h-full flex items-center justify-center">
             <img src={avatarPreview || profile.avatar_url || ""} alt="Avatar" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
             <Button 
                variant="secondary" 
                size="icon" 
                className="absolute top-2 right-2 rounded-full opacity-70 hover:opacity-100" 
                onClick={() => setViewerOpen(false)}
             >
                <X className="h-4 w-4" />
             </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
