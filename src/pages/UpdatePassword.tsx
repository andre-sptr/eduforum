import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  password: z.string().min(6, "Password minimal 6 karakter").max(100),
  confirmPassword: z.string(),
}).refine(v => v.password === v.confirmPassword, { path: ["confirmPassword"], message: "Password tidak cocok" });

export default function UpdatePassword() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);
  const [password, setPwd] = useState("");
  const [confirmPassword, setCPwd] = useState("");
  const disabled = loading || password.length < 6 || password !== confirmPassword;

  useEffect(() => {
    if (!window.location.hash) {
      supabase.auth.getSession().then(({ data: { session } }) => { if (session) nav("/"); });
    }
  }, [nav]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ password, confirmPassword });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
      if (error) return toast.error(error.message.includes("expired") ? "Link reset kadaluwarsa. Minta link baru." : error.message);
      toast.success("Password berhasil diperbarui!"); nav("/auth");
    } catch (err) {
      toast.error((err as Error).message);
    } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <Card className="w-full max-w-md p-6 shadow-xl">
        <header className="mb-6 text-center">
          <h1 className="text-3xl font-extrabold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">Reset Password</h1>
          <p className="mt-1 text-sm text-muted-foreground">Masukkan password baru Anda. Minimal 6 karakter.</p>
        </header>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pwd">Password Baru</Label>
            <Input id="pwd" type="password" value={password} onChange={e => setPwd(e.target.value)} autoComplete="new-password" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cpwd">Konfirmasi Password</Label>
            <Input id="cpwd" type="password" value={confirmPassword} onChange={e => setCPwd(e.target.value)} autoComplete="new-password" required />
            {password && confirmPassword && password !== confirmPassword && (
              <p className="text-xs text-red-500">Password tidak cocok.</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={disabled}>
            {loading ? "Menyimpan..." : "Simpan Password"}
          </Button>
          <Button variant="link" type="button" className="w-full" onClick={() => nav("/auth")} disabled={loading}>
            Kembali ke Login
          </Button>
        </form>
      </Card>
    </div>
  );
}