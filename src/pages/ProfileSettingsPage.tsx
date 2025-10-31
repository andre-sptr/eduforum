import React, { useEffect } from "react";
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
import { useNavigate } from "react-router-dom";

const profileSchema = z.object({
  name: z.string().min(5, "Nama minimal 5 karakter").max(50, "Nama maksimal 50 karakter"),
  avatar_text: z
    .string()
    .transform((v) => v.trim().toUpperCase())
    .refine((v) => v.length === 2, { message: "Inisial harus terdiri dari 2 karakter" }),
  bio: z
    .string()
    .max(160, "Bio maksimal 160 karakter")
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? "" : v ?? "")),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileData {
  id: string;
  name: string | null;
  bio: string | null;
  avatar_text: string | null;
  role: string | null;
}

export default function ProfileSettingsPage(): JSX.Element {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth");
  }, [authLoading, user, navigate]);

  const { data: currentProfile, isLoading: isProfileLoading } = useQuery<ProfileData | null>({
    queryKey: ["userProfile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: "", avatar_text: "", bio: "" },
    mode: "onBlur",
  });

  useEffect(() => {
    if (currentProfile) {
      reset({
        name: currentProfile.name ?? "",
        avatar_text: (currentProfile.avatar_text ?? "").toUpperCase(),
        bio: currentProfile.bio ?? "",
      });
    }
  }, [currentProfile, reset]);

  const updateProfileMutation = useMutation({
    mutationFn: async (formData: ProfileFormData) => {
      if (!user) throw new Error("User tidak ditemukan");
      const payload = {
        name: formData.name.trim(),
        bio: (formData.bio ?? "").trim(),
        avatar_text: formData.avatar_text.trim().toUpperCase(),
      };
      const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Profil berhasil diperbarui!");
      queryClient.invalidateQueries({ queryKey: ["userProfile", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
    onError: (error: unknown) => {
      const msg = error instanceof Error ? error.message : String(error);
      toast.error(`Gagal memperbarui profil: ${msg}`);
    },
  });

  const onSubmit = (data: ProfileFormData) => updateProfileMutation.mutate(data);

  if (authLoading || isProfileLoading || !currentProfile) {
    return (
      <div className="min-h-screen bg-muted">
        <Navbar />
        <main className="container mx-auto grid grid-cols-10 gap-6 py-6">
          <aside className="col-span-2 hidden md:block">
            <Skeleton className="h-40 w-full" />
          </aside>
          <section className="col-span-10 md:col-span-5 space-y-4">
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-64 w-full" />
          </section>
          <aside className="col-span-10 md:col-span-3 hidden md:block">
            <Skeleton className="h-64 w-full" />
          </aside>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted">
      <Navbar userName={currentProfile.name || ""} userInitials={currentProfile.avatar_text || ""} />
      <main className="container mx-auto grid grid-cols-10 gap-6 py-6">
        <LeftSidebar />
        <section className="col-span-10 md:col-span-5 space-y-6">
          <h1 className="text-2xl font-bold">Pengaturan</h1>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Card>
              <CardHeader>
                <CardTitle>Informasi Profil</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nama Lengkap</Label>
                  <Input id="name" {...register("name")} placeholder="Nama lengkap Anda" />
                  {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="avatar_text">Inisial Avatar (2 Huruf)</Label>
                  <Input id="avatar_text" {...register("avatar_text")} placeholder="IN" maxLength={2} className="w-20 text-center uppercase" />
                  {errors.avatar_text && <p className="text-sm text-red-500">{errors.avatar_text.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio Singkat</Label>
                  <Textarea id="bio" {...register("bio")} placeholder="Ceritakan sedikit tentang diri Anda..." rows={3} />
                  {errors.bio && <p className="text-sm text-red-500">{errors.bio.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Peran</Label>
                  <Input value={currentProfile.role || "Siswa"} disabled className="bg-muted" />
                </div>
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={!isDirty || isSubmitting}>
                  {isSubmitting ? "Menyimpan..." : "Simpan Perubahan"}
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