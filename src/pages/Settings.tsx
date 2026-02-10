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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
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
    if (!currentUser?.email) return;
    
    if (deleteConfirm !== currentUser.email) {
      toast.error(`Ketik email Anda (${currentUser.email}) untuk konfirmasi`);
      return;
    }
    setDeletingAccount(true);

    try {
        await supabase.from("posts").delete().eq("user_id", currentUser.id);

        const { error: profileError } = await supabase.from("profiles").delete().eq("id", currentUser.id);
        
        if (profileError) {
             console.error("Gagal hapus profile, mencoba reset data...", profileError);
             await supabase.from("profiles").update({ 
                 full_name: "Deleted User", 
                 bio: null, 
                 avatar_url: null 
             }).eq("id", currentUser.id);
        }

        toast.info("Akun Anda telah dihapus.");
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
    <div className="container max-w-5xl mx-auto py-8 space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">Pengaturan</h1>
        <p className="text-muted-foreground">Kelola profil, preferensi akun, dan tampilan aplikasi Anda.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        <aside className="md:w-64 flex-shrink-0">
          <div className="sticky top-24 space-y-1">
            <nav className="flex flex-row md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0 p-1">
              {[
                { id: "profile", label: "Profil", icon: User },
                { id: "account", label: "Akun", icon: Shield },
                { id: "appearance", label: "Tampilan", icon: Palette },
              ].map((tab) => (
                <Button
                  key={tab.id}
                  variant={activeTab === tab.id ? "secondary" : "ghost"}
                  className={`justify-start w-full transition-all duration-200 ${
                    activeTab === tab.id 
                      ? "bg-primary/10 text-primary hover:bg-primary/15 font-medium shadow-sm" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  <tab.icon className={`mr-2.5 h-4 w-4 ${activeTab === tab.id ? "text-primary" : "text-muted-foreground"}`} /> 
                  {tab.label}
                </Button>
              ))}
              
              <Separator className="my-3 hidden md:block opacity-50" />
              
              <Button
                variant="ghost"
                className="justify-start w-full text-destructive/80 hover:text-destructive hover:bg-destructive/10 transition-colors"
                onClick={handleLogout}
              >
                <LogOut className="mr-2.5 h-4 w-4" /> Keluar
              </Button>
            </nav>
          </div>
        </aside>

        <div className="flex-1 space-y-6 min-h-[500px]">
          {activeTab === "profile" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
              <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Profil Publik</CardTitle>
                  <CardDescription></CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleProfileSubmit} className="space-y-8">
                    <div className="flex flex-col sm:flex-row items-start gap-8">
                      <div className="flex flex-col items-center gap-4">
                        <div className="relative group">
                          <button
                            type="button"
                            onClick={() => !isDefaultAvatar && setViewerOpen(true)}
                            className={`relative overflow-hidden rounded-full ring-4 ring-background shadow-xl transition-all duration-300 hover:scale-105 hover:ring-primary/20 focus:outline-none focus:ring-primary ${isDefaultAvatar ? "cursor-default" : "cursor-zoom-in"}`}
                          >
                            <Avatar className="h-32 w-32">
                              <AvatarImage src={avatarPreview} className="object-cover" />
                              <AvatarFallback className="text-4xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-bold">
                                {getInitials(fullName)}
                              </AvatarFallback>
                            </Avatar>
                            {!isDefaultAvatar && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                    <Maximize2 className="h-8 w-8 text-white drop-shadow-md" />
                                </div>
                            )}
                          </button>
                          
                          <div className="absolute -bottom-2 -right-2 flex gap-1">
                             <Button 
                                type="button" 
                                size="icon" 
                                variant="secondary" 
                                className="h-9 w-9 rounded-full shadow-md hover:bg-primary hover:text-primary-foreground transition-colors"
                                onClick={() => fileInputRef.current?.click()}
                             >
                                <Upload className="h-4 w-4" />
                                <span className="sr-only">Upload avatar</span>
                             </Button>
                             {!isDefaultAvatar && (
                                <Button 
                                    type="button" 
                                    size="icon" 
                                    variant="destructive" 
                                    className="h-9 w-9 rounded-full shadow-md"
                                    onClick={handleDeleteAvatar} 
                                    disabled={deletingAvatar}
                                >
                                    {deletingAvatar ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    <span className="sr-only">Delete avatar</span>
                                </Button>
                             )}
                          </div>
                          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
                        </div>
                        <p className="text-xs text-muted-foreground font-medium">
                            JPG atau PNG (5MB)
                        </p>
                      </div>

                      <div className="flex-1 space-y-5 w-full">
                        <div className="grid gap-2.5">
                          <Label htmlFor="fullName" className="text-sm font-medium">Nama Lengkap</Label>
                          <Input 
                            id="fullName" 
                            value={fullName} 
                            onChange={(e) => setFullName(e.target.value)} 
                            required 
                            className="bg-background/50 focus:bg-background transition-colors"
                          />
                        </div>
                        <div className="grid gap-2.5">
                          <Label htmlFor="role" className="text-sm font-medium">Role</Label>
                          <div className="flex items-center gap-2">
                             <div className="relative flex-1">
                                <Shield className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/70" />
                                <Input 
                                    id="role" 
                                    disabled 
                                    value={profile.role?.toUpperCase()} 
                                    className="pl-9 bg-muted/50 text-muted-foreground" 
                                />
                             </div>
                             <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                                Permanen
                             </span>
                          </div>
                        </div>
                        <div className="grid gap-2.5">
                          <Label htmlFor="bio" className="text-sm font-medium">Bio</Label>
                          <Textarea
                            id="bio"
                            value={bio}
                            onChange={(e) => setBio(e.target.value)}
                            placeholder="Ceritakan sedikit tentang diri Anda..."
                            className="min-h-[120px] resize-none bg-background/50 focus:bg-background transition-colors"
                          />
                          <p className="text-xs text-muted-foreground text-right tabular-nums">{bio.length}/500</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end pt-6 border-t border-border/50">
                        <Button type="submit" disabled={loading} className="min-w-[140px] shadow-sm">
                            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Menyimpan</> : "Simpan"}
                        </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "account" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
              <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Keamanan Akun</CardTitle>
                  <CardDescription></CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    <div className="space-y-2">
                        <Label className="text-sm font-medium">Email</Label>
                        <div className="flex items-center gap-3">
                            <div className="relative flex-1">
                                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input value={currentUser?.email} disabled className="pl-9 bg-muted/50 font-medium" />
                            </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground">Email tidak dapat diubah.</p>
                    </div>

                    <Separator className="opacity-50" />

                    <form onSubmit={handlePasswordUpdate} className="space-y-5">
                        <h3 className="text-sm font-semibold flex items-center gap-2">
                            <Lock className="h-4 w-4 text-primary" />
                            Ganti Password
                        </h3>
                        <div className="grid gap-5 sm:grid-cols-2">
                            <div className="space-y-2.5">
                                <Label htmlFor="password">Password Baru</Label>
                                <div className="relative">
                                    <Input 
                                        id="password" 
                                        type="password" 
                                        value={password} 
                                        onChange={(e)=>setPassword(e.target.value)} 
                                        className="bg-background/50 focus:bg-background transition-colors"
                                        placeholder="••••••••" 
                                    />
                                </div>
                            </div>
                            <div className="space-y-2.5">
                                <Label htmlFor="confirmPassword">Konfirmasi Password</Label>
                                <div className="relative">
                                    <Input 
                                        id="confirmPassword" 
                                        type="password" 
                                        value={confirmPassword} 
                                        onChange={(e)=>setConfirmPassword(e.target.value)} 
                                        className="bg-background/50 focus:bg-background transition-colors"
                                        placeholder="••••••••" 
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end pt-2">
                            <Button type="submit" disabled={!password || passwordLoading} className="min-w-[140px] shadow-sm">
                                {passwordLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update"}
                            </Button>
                        </div>
                    </form>
                </CardContent>
              </Card>

              <Card className="border border-destructive/20 bg-destructive/5 overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-destructive/50" />
                <CardHeader>
                  <CardTitle className="text-destructive flex items-center gap-2 text-lg">
                      <AlertTriangle className="h-5 w-5" /> Danger Zone
                  </CardTitle>
                  <CardDescription></CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-4 rounded-lg bg-background/50 border border-destructive/10">
                        <div className="space-y-1 text-center sm:text-left">
                            <h4 className="font-semibold text-destructive">Hapus Akun</h4>
                            <p className="text-sm text-muted-foreground max-w-md">
                                Menghapus akun Anda akan menghapus semua data profil, postingan, dan aktivitas Anda secara permanen.
                            </p>
                        </div>
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="destructive" className="w-full sm:w-auto shadow-sm">Hapus Akun</Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                    <DialogTitle className="text-destructive flex items-center gap-2">
                                        <AlertTriangle className="h-5 w-5" /> Hapus Akun Permanen
                                    </DialogTitle>
                                    <DialogDescription className="pt-2">
                                        Apakah Anda yakin? Tindakan ini tidak dapat dibatalkan. Semua data akun Anda akan dihapus selamanya.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="p-3 bg-destructive/10 rounded-md text-sm text-destructive font-medium border border-destructive/20">
                                        Untuk keamanan, silakan ketik email Anda di bawah ini untuk mengonfirmasi.
                                        <div className="mt-2 p-1.5 bg-background/50 rounded border border-destructive/10 text-center font-mono select-all">
                                            {currentUser?.email}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="delete-confirm" className="text-xs font-medium text-muted-foreground">
                                            Konfirmasi Email
                                        </Label>
                                        <Input 
                                            id="delete-confirm"
                                            value={deleteConfirm} 
                                            onChange={(e) => setDeleteConfirm(e.target.value)} 
                                            placeholder={currentUser?.email}
                                            className="border-destructive/30 focus-visible:ring-destructive bg-background"
                                            onPaste={(e) => e.preventDefault()}
                                            autoComplete="off"
                                        />
                                    </div>
                                    <Button 
                                        variant="destructive" 
                                        className="w-full shadow-md hover:bg-destructive/90" 
                                        disabled={deleteConfirm !== currentUser?.email || deletingAccount}
                                        onClick={handleDeleteAccount}
                                    >
                                        {deletingAccount ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Hapus Akun Ini"}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "appearance" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 ease-out">
              <Card className="border-none shadow-sm bg-card/50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Tampilan Aplikasi</CardTitle>
                  <CardDescription></CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="space-y-4">
                        <Label className="text-base font-medium">Tema</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                            {[
                                { id: "light", label: "Terang", icon: Sun, bg: "bg-[#f4f4f5]", border: "border-gray-200" },
                                { id: "dark", label: "Gelap", icon: Moon, bg: "bg-[#18181b]", border: "border-gray-800" },
                                { id: "system", label: "System", icon: Monitor, bg: "bg-gradient-to-r from-[#f4f4f5] to-[#18181b]", border: "border-gray-200" }
                            ].map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => setTheme(item.id as "light" | "dark" | "system")}
                                    className={`group relative flex flex-col items-center gap-3 p-1 rounded-xl transition-all duration-200 focus:outline-none ${
                                        theme === item.id 
                                            ? "ring-2 ring-primary ring-offset-2 ring-offset-background" 
                                            : "hover:opacity-80"
                                    }`}
                                >
                                    <div className={`w-full aspect-video rounded-lg ${item.bg} ${item.border} border shadow-sm flex items-center justify-center overflow-hidden relative`}>
                                        <div className="space-y-2 w-3/4 opacity-40">
                                            <div className={`h-2 w-full rounded-md ${item.id === 'dark' ? 'bg-gray-700' : 'bg-gray-300'}`} />
                                            <div className={`h-2 w-2/3 rounded-md ${item.id === 'dark' ? 'bg-gray-700' : 'bg-gray-300'}`} />
                                        </div>
                                        <div className={`absolute inset-0 flex items-center justify-center bg-black/5 transition-opacity ${theme === item.id ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                                             <div className={`p-2 rounded-full shadow-lg backdrop-blur-sm ${theme === item.id ? 'bg-primary text-primary-foreground' : 'bg-background/80 text-foreground'}`}>
                                                 <item.icon className="h-5 w-5" />
                                             </div>
                                        </div>
                                    </div>
                                    <span className={`text-sm font-medium ${theme === item.id ? "text-primary" : "text-muted-foreground"}`}>
                                        {item.label}
                                    </span>
                                </button>
                            ))}
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
          <div className="relative w-full h-full flex items-center justify-center p-4">
             <img 
                src={avatarPreview || profile.avatar_url || ""} 
                alt="Avatar" 
                className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-300" 
             />
             <Button 
                variant="secondary" 
                size="icon" 
                className="absolute top-6 right-6 rounded-full shadow-lg bg-background/80 hover:bg-background backdrop-blur-sm" 
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
