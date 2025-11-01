import React, { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Navbar } from "@/components/Navbar";
import { LeftSidebar } from "@/components/LeftSidebar";
import { RightSidebar } from "@/components/RightSidebar";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const schema = z.object({
  name: z.string().trim().min(5, "Nama minimal 5 karakter").max(50, "Nama maksimal 50 karakter"),
  avatar_text: z
    .string()
    .transform((v) => (v ?? "").toUpperCase().trim())
    .refine((v) => /^[A-Z]{2}$/.test(v), "Inisial wajib 2 huruf (A–Z)"),
  bio: z
    .string()
    .trim()
    .max(160, "Bio maksimal 160 karakter")
    .optional()
    .or(z.literal(""))
    .nullable(),
});
type FormData = z.infer<typeof schema>;
type Profile = { id: string; name: string | null; bio: string | null; avatar_text: string | null; role: string | null };

export default function ProfileSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => { if (!authLoading && !user) navigate("/auth"); }, [authLoading, user, navigate]);

  const { data: profile, isLoading } = useQuery<Profile | null>({
    queryKey: ["userProfile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from("profiles").select("id,name,bio,avatar_text,role").eq("id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", avatar_text: "", bio: "" },
    mode: "onChange",
  });

  useEffect(() => {
    if (profile) reset({ name: profile.name ?? "", avatar_text: profile.avatar_text ?? "", bio: profile.bio ?? "" });
  }, [profile, reset]);

  // Counter bio realtime (maks 160)
  const bioLen = useMemo(() => (watch("bio")?.length ?? 0), [watch("bio")]);

  const mut = useMutation({
    mutationFn: async (values: FormData) => {
      if (!user) throw new Error("User tidak ditemukan");
      const { error } = await supabase
        .from("profiles")
        .update({ name: values.name.trim(), bio: (values.bio ?? "") || null, avatar_text: values.avatar_text.toUpperCase() })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil berhasil diperbarui!");
      qc.invalidateQueries({ queryKey: ["userProfile", user?.id] });
      qc.invalidateQueries({ queryKey: ["profile", user?.id] }); // halaman lain yang pakai query ini
    },
    onError: (e: any) => toast.error(`Gagal memperbarui profil: ${e.message}`),
  });

  const onSubmit = (v: FormData) => mut.mutate(v);

  if (authLoading || isLoading || !profile) {
    return (
      <div className="min-h-screen bg-muted">
        <Navbar />
        <main className="container mx-auto grid grid-cols-10 gap-6 py-6">
          <aside className="col-span-2 hidden md:block"><Skeleton className="h-40 w-full" /></aside>
          <section className="col-span-10 md:col-span-5 space-y-4"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-64 w-full" /></section>
          <aside className="col-span-10 md:col-span-3 hidden md:block"><Skeleton className="h-64 w-full" /></aside>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <Navbar userName={profile.name ?? ""} userInitials={profile.avatar_text ?? ""} />
      <main className="container mx-auto grid grid-cols-10 gap-6 py-6">
        <LeftSidebar />
        <section className="col-span-10 md:col-span-5 space-y-6">
          <h1 className="text-2xl font-bold">Pengaturan</h1>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Card>
              <CardHeader><CardTitle>Informasi Profil</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nama Lengkap</Label>
                  <Input id="name" placeholder="Nama lengkap Anda" {...register("name")} />
                  {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="avatar_text">Inisial Avatar (2 Huruf)</Label>
                  <div className="flex items-center gap-3">
                    <Input id="avatar_text" maxLength={2} className="w-20 text-center tracking-widest"
                      {...register("avatar_text", { setValueAs: (v) => (v ?? "").toUpperCase() })} />
                    <span className="text-xs text-muted-foreground">Contoh: <b>AS</b></span>
                  </div>
                  {errors.avatar_text && <p className="text-sm text-red-500">{errors.avatar_text.message}</p>}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="bio">Bio Singkat</Label>
                    <span className={`text-xs ${bioLen > 160 ? "text-red-500" : "text-muted-foreground"}`}>{bioLen}/160</span>
                  </div>
                  <Textarea id="bio" rows={3} placeholder="Ceritakan sedikit tentang diri Anda..." {...register("bio")} />
                  {errors.bio && <p className="text-sm text-red-500">{errors.bio.message}</p>}
                </div>

                <div className="space-y-2">
                  <Label>Peran</Label>
                  <Input value={profile.role ?? "Siswa"} disabled className="bg-muted" />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={!isDirty || isSubmitting || mut.isPending}>
                  {isSubmitting || mut.isPending ? "Menyimpan..." : "Simpan Perubahan"}
                </Button>
              </CardFooter>
            </Card>
          </form>
        </section>
        <RightSidebar />
      </main>
      <footer className="border-t py-4 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            <a href="https://flamyheart.site" target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline underline-offset-4">
              © {new Date().getFullYear()} Andre Saputra
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}