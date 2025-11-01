import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { z } from "zod";

const signupSchema = z.object({
  email: z.string().email("Email tidak valid").max(255),
  password: z.string().min(6, "Password minimal 6 karakter").max(100),
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(100),
  role: z.enum(["Siswa", "Guru", "Alumni"]),
});
const loginSchema = z.object({ email: z.string().email("Email tidak valid"), password: z.string().min(1, "Password harus diisi") });
const resetSchema = z.object({ email: z.string().email("Email tidak valid") });

type Role = "Siswa" | "Guru" | "Alumni";
const Brand = () => (
  <div className="mb-6 text-center">
    <div className="inline-flex items-center gap-3">
      <img src="/favicon.png" alt="EduForum Logo" className="h-12 w-12" loading="lazy" decoding="async" />
      <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">EduForum</h1>
    </div>
    <p className="mt-2 text-muted-foreground">Platform Sosial Edukatif MAN IC Siak</p>
  </div>
);

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

export default function Auth() {
  const nav = useNavigate();
  const [tab, setTab] = useState<"login" | "signup">("login");
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);

  // state login
  const [login, setLogin] = useState({ email: "", password: "" });
  // state signup
  const [signup, setSignup] = useState<{ email: string; password: string; name: string; role: Role }>({
    email: "", password: "", name: "", role: "Siswa",
  });
  // state reset
  const [resetEmail, setResetEmail] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { if (session) nav("/"); });
  }, [nav]);

  const safeParse = <T,>(schema: z.ZodSchema<T>, data: unknown) => {
    const res = schema.safeParse(data);
    if (!res.success) throw new Error(res.error.errors[0].message);
    return res.data;
  };

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const v = safeParse(loginSchema, login);
      const { email, password } = v;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return toast.error(error.message.includes("Invalid") ? "Email atau password salah" : error.message);
      toast.success("Login berhasil!"); nav("/");
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setLoading(false); }
  };

  const onSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const v = safeParse(signupSchema, signup);
      const { error } = await supabase.auth.signUp({
        email: v.email, password: v.password,
        options: { emailRedirectTo: `${window.location.origin}/`, data: { name: v.name, role: v.role } },
      });
      if (error) return toast.error(error.message.includes("already") ? "Email sudah terdaftar" : error.message);
      toast.success("Akun berhasil dibuat! Silakan login."); setTab("login");
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setLoading(false); }
  };

  const onReset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const v = safeParse(resetSchema, { email: resetEmail });
      const { error } = await supabase.auth.resetPasswordForEmail(v.email, { redirectTo: `${window.location.origin}/update-password` });
      if (error) return toast.error(error.message);
      toast.success("Link reset password telah dikirim!"); setResetMode(false); setResetEmail("");
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <Card className="w-full max-w-md p-6 shadow-xl">
        <Brand />
        <Tabs value={tab} onValueChange={(v) => { setTab(v as typeof tab); setResetMode(false); }} className="w-full">
          {!resetMode && (
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="signup">Daftar</TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="login">
            {resetMode ? (
              <form onSubmit={onReset} className="space-y-4">
                <div className="border-t" />
                <div className="text-center mb-2"><h3 className="font-bold text-2xl">Reset Password</h3></div>
                <Field id="reset-email" label="Email">
                  <Input id="reset-email" type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required placeholder="nama@gmail.com" />
                </Field>
                <Button type="submit" className="w-full" disabled={loading}>{loading ? "Mengirim..." : "Kirim Link Reset"}</Button>
                <Button variant="link" type="button" className="w-full" onClick={() => setResetMode(false)} disabled={loading}>Batal (Kembali ke Login)</Button>
              </form>
            ) : (
              <form onSubmit={onLogin} className="space-y-4">
                <Field id="login-email" label="Email">
                  <Input id="login-email" type="email" value={login.email} onChange={(e) => setLogin((s) => ({ ...s, email: e.target.value }))} required />
                </Field>
                <Field id="login-password" label="Password">
                  <Input id="login-password" type="password" value={login.password} onChange={(e) => setLogin((s) => ({ ...s, password: e.target.value }))} required />
                </Field>
                <div className="text-center">
                  <Button variant="link" type="button" className="px-0 h-auto py-1 text-sm"
                    onClick={() => { setResetMode(true); setResetEmail(login.email); }}>
                    Lupa Password?
                  </Button>
                </div>
                <Button type="submit" className="w-full bg-gradient-to-r from-primary to-primary/90" disabled={loading}>
                  {loading ? "Loading..." : "Login"}
                </Button>
              </form>
            )}
          </TabsContent>

          <TabsContent value="signup">
            <form onSubmit={onSignup} className="space-y-4">
              <Field id="signup-name" label="Nama Lengkap">
                <Input id="signup-name" value={signup.name} onChange={(e) => setSignup((s) => ({ ...s, name: e.target.value }))} required />
              </Field>
              <Field id="signup-email" label="Email">
                <Input id="signup-email" type="email" value={signup.email} onChange={(e) => setSignup((s) => ({ ...s, email: e.target.value }))} required />
              </Field>
              <Field id="signup-password" label="Password">
                <Input id="signup-password" type="password" value={signup.password} onChange={(e) => setSignup((s) => ({ ...s, password: e.target.value }))} required />
              </Field>
              <Field id="role" label="Peran">
                <Select value={signup.role} onValueChange={(v) => setSignup((s) => ({ ...s, role: v as Role }))}>
                  <SelectTrigger id="role"><SelectValue placeholder="Pilih peran" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Siswa">Siswa</SelectItem>
                    <SelectItem value="Guru">Guru</SelectItem>
                    <SelectItem value="Alumni">Alumni</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Button type="submit" className="w-full bg-gradient-to-r from-primary to-primary/90" disabled={loading}>
                {loading ? "Loading..." : "Daftar"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </Card>
    </div>
  );
}