import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { z } from "zod";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const signupSchema = z.object({
  email: z.string().email("Email tidak valid").max(255),
  password: z.string().min(6, "Password minimal 6 karakter").max(100),
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
  role: z.enum(["Siswa", "Guru", "Alumni"]),
});

const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(1, "Password harus diisi"),
});

const resetSchema = z.object({
  email: z.string().email("Email tidak valid"),
});

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("login");
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"Siswa" | "Guru" | "Alumni">("Siswa");
  const [isResetting, setIsResetting] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/");
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validated = loginSchema.parse({ email: loginEmail, password: loginPassword });
      setLoading(true);
      const { error } = await supabase.auth.signInWithPassword({
        email: validated.email,
        password: validated.password,
      });
      if (error) {
        toast.error(error.message.includes("Invalid") ? "Email atau password salah" : error.message);
        return;
      }
      toast.success("Login berhasil!");
      navigate("/");
    } catch (error) {
      if (error instanceof z.ZodError) toast.error(error.errors[0].message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validated = signupSchema.parse({ email: signupEmail, password: signupPassword, name, role });
      setLoading(true);
      const { error } = await supabase.auth.signUp({
        email: validated.email,
        password: validated.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: { name: validated.name, role: validated.role },
        },
      });
      if (error) {
        toast.error(error.message.includes("already") ? "Email sudah terdaftar" : error.message);
        return;
      }
      toast.success("Akun berhasil dibuat! Silakan login.");
      setActiveTab("login");
    } catch (error) {
      if (error instanceof z.ZodError) toast.error(error.errors[0].message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const validated = resetSchema.parse({ email: resetEmail });
      setLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(validated.email, {
        redirectTo: `${window.location.origin}/update-password`,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success("Link reset password telah dikirim ke email Anda!");
      setIsResetting(false);
      setResetEmail("");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else if (error instanceof Error) {
        toast.error(error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <Card className="w-full max-w-md p-6 shadow-xl">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-3">
            <img 
              src="/favicon.png" 
              alt="EduForum Logo" 
              className="h-12 w-12"
              loading="lazy"
              decoding="async"
            />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">EduForum</h1>
          </div>
          <p className="mt-2 text-muted-foreground">Platform Sosial Edukatif MAN IC Siak</p>
        </div>
        <Tabs 
          value={activeTab}
          onValueChange={(tab) => {
            setActiveTab(tab);
            setIsResetting(false);
          }}
          className="w-full"
        >
          {!isResetting && (
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Daftar</TabsTrigger>
            </TabsList>
          )}
          <TabsContent value="login">
            {isResetting ? (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="border-t border-gray-200"></div>
                <div className="text-center mb-4">
                  <h3 className="font-bold text-2xl">Reset Password</h3>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input 
                    id="reset-email" 
                    type="email" 
                    value={resetEmail} 
                    onChange={(e) => setResetEmail(e.target.value)} 
                    required 
                    placeholder="nama@gmail.com"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Mengirim..." : "Kirim Link Reset"}
                </Button>
                <Button 
                  variant="link" 
                  type="button" 
                  className="w-full" 
                  onClick={() => setIsResetting(false)}
                  disabled={loading}
                >
                  Batal (Kembali ke Login)
                </Button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input id="login-email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input id="login-password" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                </div>
                <div className="text-center">
                  <Button 
                    variant="link" 
                    type="button" 
                    onClick={() => {
                      setIsResetting(true);
                      setResetEmail(loginEmail); 
                    }} 
                    className="px-0 h-auto py-1 text-sm"
                  >
                    Lupa Password?
                  </Button>
                </div>
                <Button type="submit" className="w-full bg-gradient-to-r from-primary to-primary/90" disabled={loading}>{loading ? "Loading..." : "Login"}</Button>
              </form>
            )}
          </TabsContent>
          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Nama Lengkap</Label>
                <Input id="signup-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input id="signup-email" type="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input id="signup-password" type="password" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Peran</Label>
                <Select value={role} onValueChange={(value: any) => setRole(value)}>
                  <SelectTrigger id="role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Siswa">Siswa</SelectItem>
                    <SelectItem value="Guru">Guru</SelectItem>
                    <SelectItem value="Alumni">Alumni</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full bg-gradient-to-r from-primary to-primary/90" disabled={loading}>{loading ? "Loading..." : "Daftar"}</Button>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
};

export default Auth;