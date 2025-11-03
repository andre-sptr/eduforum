// src/components/Auth.tsx
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

  const inputCls = "bg-input/60 border-border focus-visible:ring-2 focus-visible:ring-accent";
  const btnCls = "w-full bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg";

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-b from-background to-muted/40 p-4">
      <div className="w-full max-w-md">
        <Card className="rounded-3xl shadow-2xl border border-border/60 backdrop-blur-sm">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center"><img src="/favicon.ico" alt="Logo EduForum" className="w-14 h-14 rounded-xl shadow" /></div>
            <CardTitle className="text-2xl">EduForum MAN IC Siak</CardTitle>
            <CardDescription>Platform Edukasi Interaktif Eksklusif MAN IC Siak</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <TabsList className="grid w-full grid-cols-2 rounded-xl shadow">
                <TabsTrigger value="login" className="data-[state=active]:shadow">Login</TabsTrigger>
                <TabsTrigger value="register" className="data-[state=active]:shadow">Register</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input id="login-email" type="email" placeholder="nama@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <Input id="login-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputCls} />
                  </div>
                  <Button type="submit" className={btnCls} disabled={loading}>
                    {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memproses...</>) : "Masuk"}
                  </Button>
                  <div className="text-center">
                    <a href="/reset-password" className="text-sm text-accent hover:underline">Lupa Password?</a>
                  </div>
                </form>
              </TabsContent>

              <TabsContent value="register">
                <form onSubmit={handleSignup} className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="register-name">Nama Lengkap</Label>
                    <Input id="register-name" type="text" placeholder="Nama Lengkap" value={fullName} onChange={(e) => setFullName(e.target.value)} required className={inputCls} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-email">Email</Label>
                    <Input id="register-email" type="email" placeholder="nama@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputCls} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-password">Password</Label>
                    <Input id="register-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputCls} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="register-role">Role</Label>
                    <Select value={role} onValueChange={setRole} required>
                      <SelectTrigger className={inputCls}><SelectValue placeholder="Pilih Role" /></SelectTrigger>
                      <SelectContent className="bg-popover border-border">
                        <SelectItem value="siswa">Siswa</SelectItem>
                        <SelectItem value="guru">Guru</SelectItem>
                        <SelectItem value="alumni">Alumni</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className={btnCls} disabled={loading}>
                    {loading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memproses...</>) : "Daftar"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;