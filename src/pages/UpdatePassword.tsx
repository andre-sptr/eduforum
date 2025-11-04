// src/pages/UpdatePassword.tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { z } from "zod";

const updatePasswordSchema = z
  .object({
    password: z.string().min(6, "Password minimal harus 6 karakter"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Password tidak cocok",
    path: ["confirmPassword"],
  });

const UpdatePassword = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      updatePasswordSchema.parse({ password, confirmPassword });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error("Terjadi kesalahan validasi");
      }
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      toast.success("Password berhasil diperbarui! Silakan login kembali.");
      navigate("/auth"); 
    } catch (error: any) {
      toast.error(error.message || "Gagal memperbarui password");
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "bg-input/60 border-border focus-visible:ring-2 focus-visible:ring-accent";
  const btnCls = "w-full bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg";

  return (
    <div className="min-h-screen grid place-items-center bg-gradient-to-b from-background to-muted/40 p-4">
      <div className="w-full max-w-md">
        <Button
          variant="ghost"
          className="mb-4 text-accent hover:text-accent/80"
          onClick={() => navigate("/auth")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali ke Login
        </Button>

        <Card className="rounded-3xl shadow-2xl border border-border/60 backdrop-blur-sm">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center">
              <img src="/favicon.ico" alt="Logo EduForum" className="w-14 h-14 rounded-xl shadow" />
            </div>
            <CardTitle className="text-2xl">Update Password</CardTitle>
            <CardDescription>Masukkan password baru Anda.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password Baru</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className={inputCls}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Konfirmasi Password Baru</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className={inputCls}
                />
              </div>
              <Button type="submit" className={btnCls} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Memproses...
                  </>
                ) : (
                  "Update Password"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UpdatePassword;