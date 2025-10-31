import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";

const updatePasswordSchema = z
  .object({
    password: z.string().min(6, "Password minimal 6 karakter").max(100).transform((v) => v.trim()),
    confirmPassword: z.string().transform((v) => v.trim()),
  })
  .refine((d) => d.password === d.confirmPassword, { message: "Password tidak cocok", path: ["confirmPassword"] });

export default function UpdatePassword(): JSX.Element {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (!window.location.hash) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) navigate("/");
      });
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { password: newPass } = updatePasswordSchema.parse({ password, confirmPassword });
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) {
        toast.error(error.message.includes("expired") ? "Link reset password Anda sudah kedaluwarsa. Silakan minta yang baru." : error.message);
        return;
      }
      toast.success("Password Anda berhasil diperbarui!");
      navigate("/auth");
    } catch (err) {
      if (err instanceof z.ZodError) toast.error(err.errors[0].message);
      else if (err instanceof Error) toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <Card className="w-full max-w-md p-6 shadow-xl">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold">Reset Password</h1>
          <p className="mt-2 text-muted-foreground">Silakan masukkan password baru Anda.</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Password Baru</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Konfirmasi Password Baru</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading} aria-busy={loading}>
            {loading ? "Menyimpan..." : "Simpan Password"}
          </Button>
          <Button variant="link" type="button" className="w-full" onClick={() => navigate("/auth")} disabled={loading}>
            Kembali ke Login
          </Button>
        </form>
      </Card>
    </div>
  );
}