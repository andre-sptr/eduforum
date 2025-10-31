import { useState, useEffect, useCallback } from "react";
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

type Role = "Siswa" | "Guru" | "Alumni";

const signupSchema = z.object({
  email: z.string().email("Email tidak valid").max(255).transform((v) => v.trim().toLowerCase()),
  password: z.string().min(6, "Password minimal 6 karakter").max(100),
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
  role: z.enum(["Siswa", "Guru", "Alumni"]),
});

const loginSchema = z.object({
  email: z.string().email("Email tidak valid").transform((v) => v.trim().toLowerCase()),
  password: z.string().min(1, "Password harus diisi"),
});

const resetSchema = z.object({
  email: z.string().email("Email tidak valid").transform((v) => v.trim().toLowerCase()),
});

export default function Auth(): JSX.Element {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"login" | "signup">("login");
  const [isResetting, setIsResetting] = useState(false);

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("Siswa");
  const [resetEmail, setResetEmail] = useState("");

  const [loadingLogin, setLoadingLogin] = useState(false);
  const [loadingSignup, setLoadingSignup] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session) navigate("/");
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) navigate("/");
    });
    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        const { email, password } = loginSchema.parse({ email: loginEmail, password: loginPassword });
        setLoadingLogin(true);
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          toast.error(error.message.includes("Invalid") ? "Email atau password salah" : error.message);
          return;
        }
        toast.success("Login berhasil!");
        navigate("/");
      } catch (error) {
        if (error instanceof z.ZodError) toast.error(error.errors[0].message);
        else if (error instanceof Error) toast.error(error.message);
      } finally {
        setLoadingLogin(false);
      }
    },
    [loginEmail, loginPassword, navigate]
  );

  const handleSignup = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        const validated = signupSchema.parse({ email: signupEmail, password: signupPassword, name, role });
        setLoadingSignup(true);
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
        toast.success("Akun berhasil dibuat! Silakan cek email untuk verifikasi, lalu login.");
        setActiveTab("login");
      } catch (error) {
        if (error instanceof z.ZodError) toast.error(error.errors[0].message);
        else if (error instanceof Error) toast.error(error.message);
      } finally {
        setLoadingSignup(false);
      }
    },
    [signupEmail, signupPassword, name, role]
  );

  const handleResetPassword = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        const { email } = resetSchema.parse({ email: resetEmail });
        setLoadingReset(true);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
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
        if (error instanceof z.ZodError) toast.error(error.errors[0].message);
        else if (error instanceof Error) toast.error(error.message);
      } finally {
        setLoadingReset(false);
      }
    },
    [resetEmail]
  );

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <Card className="w-full max-w-md p-6 shadow-xl">
        <div className="mb-6 text-center">
          <div className="inline-flex items-center gap-3">
            <img src="/favicon.png" alt="EduForum Logo" className="h-12 w-12" />
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">EduForum</h1>
          </div>
          <p className="mt-2 text-muted-foreground">Platform Sosial Edukatif MAN IC Siak</p>
        </div>
        <Tabs
          value={activeTab}
          onValueChange={(tab) => {
            setActiveTab(tab as "login" | "signup");
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
                <div className="border-t border-gray-200" />
                <div className="text-center mb-4">
                  <h3 className="font-bold text-2xl">Reset Password</h3>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    autoComplete="email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    required
                    placeholder="nama@gmail.com"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loadingReset} aria-busy={loadingReset}>
                  {loadingReset ? "Mengirim..." : "Kirim Link Reset"}
                </Button>
                <Button
                  variant="link"
                  type="button"
                  className="w-full"
                  onClick={() => setIsResetting(false)}
                  disabled={loadingReset}
                >
                  Batal (Kembali ke Login)
                </Button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Password</Label>
                  <Input
                    id="login-password"
                    type="password"
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
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
                    disabled={loadingLogin}
                  >
                    Lupa Password?
                  </Button>
                </div>
                <Button type="submit" className="w-full bg-gradient-to-r from-primary to-primary/90" disabled={loadingLogin} aria-busy={loadingLogin}>
                  {loadingLogin ? "Loading..." : "Login"}
                </Button>
              </form>
            )}
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">Nama Lengkap</Label>
                <Input
                  id="signup-name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <Input
                  id="signup-email"
                  type="email"
                  autoComplete="email"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Password</Label>
                <Input
                  id="signup-password"
                  type="password"
                  autoComplete="new-password"
                  value={signupPassword}
                  onChange={(e) => setSignupPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Peran</Label>
                <Select value={role} onValueChange={(value) => setRole(value as Role)}>
                  <SelectTrigger id="role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Siswa">Siswa</SelectItem>
                    <SelectItem value="Guru">Guru</SelectItem>
                    <SelectItem value="Alumni">Alumni</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" className="w-full bg-gradient-to-r from-primary to-primary/90" disabled={loadingSignup} aria-busy={loadingSignup}>
                {loadingSignup ? "Loading..." : "Daftar"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}