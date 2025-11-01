import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUsernameAvailability } from "@/hooks/useUsernameAvailability";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = { profileId: string; initialUsername?: string };

export default function UsernameForm({ profileId, initialUsername = "" }: Props) {
  const [username, setUsername] = useState(initialUsername);
  const status = useUsernameAvailability(username);
  const canSubmit = status.state === "available";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const { error } = await supabase.from("profiles").update({ username }).eq("id", profileId);
    if (error) {
      toast.error("Gagal menyimpan username");
      return;
    }
    toast.success("Username disimpan");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <label htmlFor="username-input" className="text-sm">Username</label>
      <Input 
        id="username-input"
        value={username} 
        onChange={(e) => setUsername(e.target.value)} 
        placeholder="contoh: andre-pratama" 
        aria-describedby="username-status-message"
      />
      <div id="username-status-message" className="text-xs">
        {status.state === "idle" && <span className="text-muted-foreground">Hanya huruf kecil, angka, dan tanda minus.</span>}
        {status.state === "format-invalid" && <span className="text-amber-600">Format tidak valid. Saran: <b>{status.suggestion}</b></span>}
        {status.state === "checking" && <span className="text-muted-foreground">Memeriksa ketersediaan…</span>}
        {status.state === "taken" && <span className="text-red-600">Sudah dipakai. Coba: <b>{status.suggestion}</b></span>}
        {status.state === "available" && <span className="text-emerald-600">Tersedia ✔</span>}
      </div>
      <Button type="submit" disabled={!canSubmit}>Simpan</Button>
    </form>
  );
}