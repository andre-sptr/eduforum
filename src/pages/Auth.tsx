
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { z } from "zod";

const loginSchema = z.object({ email: z.string().email("Invalid email address"), password: z.string().min(6, "Password must be at least 6 characters") });
const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Name must be at least 2 characters").max(100, "Name too long"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["siswa", "guru", "alumni"], { required_error: "Please select a role" }),
});

const Auth = () => {
  const navigate = useNavigate();
  const [tab, setTab] = useState("login");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState(""); const [role, setRole] = useState<string>("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      loginSchema.parse({ email, password });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error; toast.success("Login berhasil!"); navigate("/");
    } catch (error: any) {
      if (error instanceof z.ZodError) toast.error(error.errors[0].message); else toast.error(error.message);
    } finally { setLoading(false); }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    try {
      registerSchema.parse({ fullName, email, password, role });
      const { data, error: signUpError } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/`, data: { full_name: fullName, role } },
      });
      if (signUpError) throw signUpError;
      if (data.user) {
        const { error: roleError } = await supabase.from("user_roles").insert([{ user_id: data.user.id, role: role as "siswa" | "guru" | "alumni" }]);
        if (roleError) console.error("Role insertion error:", roleError);
      }
      toast.success("Registrasi berhasil! Silakan login."); setFullName(""); setPassword(""); setRole(""); setTab("login");
    } catch (error: any) {
      if (error instanceof z.ZodError) toast.error(error.errors[0].message); else toast.error(error.message);
    } finally { setLoading(false); }
  };

  const inputCls = "bg-white/5 border-white/10 focus-visible:ring-2 focus-visible:ring-primary/50 rounded-xl h-11 backdrop-blur-sm transition-all hover:bg-white/10";
  const btnCls = "w-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20 rounded-xl font-semibold h-11 transition-all hover:scale-[1.02] active:scale-[0.98]";

  return (
    <div className="min-h-screen grid place-items-center bg-background p-4 relative overflow-hidden">
      {}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/20 rounded-full blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-md relative z-10">
        <Card className="rounded-3xl shadow-2xl border-white/10 backdrop-blur-xl bg-card/30 overflow-hidden">
          <CardHeader className="text-center space-y-6 pb-2 pt-8">
            <div className="flex justify-center relative">
               <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full scale-150 animate-pulse" />
               <div className="relative p-4 bg-gradient-to-br from-card/50 to-card/10 border border-white/10 rounded-2xl shadow-xl backdrop-blur-md">
                 <img src="/favicon.ico" alt="Logo EduForum" className="w-12 h-12 object-contain" />
               </div>
            </div>
            <div className="space-y-2">
               <CardTitle className="text-3xl font-bold bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent tracking-tight">EduForum</CardTitle>
               <CardDescription className="text-base font-medium text-muted-foreground/80">Komunitas Digital MAN IC Siak</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-6 sm:p-8">
            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 rounded-2xl p-1.5 bg-black/20 backdrop-blur-md border border-white/5 mb-8">
                <TabsTrigger value="login" className="rounded-xl py-2.5 font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all duration-300">Masuk</TabsTrigger>
                <TabsTrigger value="register" className="rounded-xl py-2.5 font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-lg transition-all duration-300">Daftar</TabsTrigger>
              </TabsList>
              
              <TabsContent value="login" className="space-y-6 mt-0 animate-in fade-in-50 slide-in-from-bottom-4 duration-500">
                  <form onSubmit={handleLogin} className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="login-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Email</Label>
                        <Input id="login-email" type="email" placeholder="nama@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="login-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Password</Label>
                        </div>
                        <Input id="login-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputCls} />
                    </div>
                    <Button type="submit" className={btnCls} disabled={loading}>
                        {loading ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin" />Memproses...</>) : "Masuk Sekarang"}
                    </Button>
                  </form>
              </TabsContent>

              <TabsContent value="register" className="space-y-6 mt-0 animate-in fade-in-50 slide-in-from-bottom-4 duration-500">
                <form onSubmit={handleSignup} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="register-name" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Nama Lengkap</Label>
                    <Input id="register-name" type="text" placeholder="Nama Lengkap Anda" value={fullName} onChange={(e) => setFullName(e.target.value)} required className={inputCls} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Email</Label>
                    <Input id="register-email" type="email" placeholder="nama@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Password</Label>
                    <Input id="register-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputCls} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-role" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Status</Label>
                    <Select value={role} onValueChange={setRole} required>
                      <SelectTrigger className={inputCls}><SelectValue placeholder="Pilih Status Anda" /></SelectTrigger>
                      <SelectContent className="bg-card/95 backdrop-blur-xl border-white/10">
                        <SelectItem value="siswa">Siswa</SelectItem>
                        <SelectItem value="guru">Guru</SelectItem>
                        <SelectItem value="alumni">Alumni</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className={btnCls} disabled={loading}>
                    {loading ? (<><Loader2 className="mr-2 h-5 w-5 animate-spin" />Mendaftar...</>) : "Buat Akun Baru"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
          <div className="p-6 text-center border-t border-white/5 bg-black/10 backdrop-blur-md">
            <p className="text-xs text-muted-foreground">
                Dengan masuk, Anda menyetujui <a className="text-primary">Syarat & Ketentuan</a> kami.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Auth;