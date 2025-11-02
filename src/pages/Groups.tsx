import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Users, Lock, Globe, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

const Groups = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<any[]>([]);
  const [myGroups, setMyGroups] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // New group form
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setCurrentUser(user);
    await loadGroups(user.id);
  };

  const loadGroups = async (userId: string) => {
    try {
      // Load all accessible groups
      const { data: allGroups, error: groupsError } = await supabase
        .from("groups")
        .select(
          `
          *,
          group_members (count),
          profiles!groups_created_by_fkey (full_name, avatar_url)
        `,
        )
        .order("created_at", { ascending: false });

      if (groupsError) throw groupsError;

      // Load user's groups
      const { data: userGroups, error: userGroupsError } = await supabase
        .from("group_members")
        .select(
          `
          *,
          groups (
            *,
            group_members (count),
            profiles!groups_created_by_fkey (full_name, avatar_url)
          )
        `,
        )
        .eq("user_id", userId);

      if (userGroupsError) throw userGroupsError;

      setGroups(allGroups || []);
      setMyGroups(userGroups?.map((ug) => ug.groups) || []);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      toast.error("Nama grup tidak boleh kosong");
      return;
    }

    setCreating(true);

    try {
      const { error } = await supabase.from("groups").insert({
        name: newGroupName.trim(),
        description: newGroupDescription.trim(),
        is_private: isPrivate,
        created_by: currentUser.id,
      });

      if (error) throw error;

      toast.success("Grup berhasil dibuat!");
      setShowCreateDialog(false);
      setNewGroupName("");
      setNewGroupDescription("");
      setIsPrivate(false);
      await loadGroups(currentUser.id);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCreating(false);
    }
  };

  const handleJoinGroup = async (groupId: string) => {
    try {
      const { error } = await supabase.from("group_members").insert({
        group_id: groupId,
        user_id: currentUser.id,
        role: "member",
      });

      if (error) throw error;

      toast.success("Berhasil bergabung ke grup!");
      await loadGroups(currentUser.id);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleLeaveGroup = async (groupId: string) => {
    try {
      const { error } = await supabase
        .from("group_members")
        .delete()
        .eq("group_id", groupId)
        .eq("user_id", currentUser.id);

      if (error) throw error;

      toast.success("Berhasil keluar dari grup");
      await loadGroups(currentUser.id);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const filteredGroups = groups.filter((group) => group.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const isUserInGroup = (groupId: string) => {
    return myGroups.some((g) => g.id === groupId);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Memuat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card border-b border-border shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>

            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Grup Diskusi
            </h1>

            <div className="ml-auto">
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-[var(--shadow-gold)]">
                  <Plus className="h-4 w-4 mr-2" />
                  Buat Grup
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader>
                  <DialogTitle>Buat Grup Baru</DialogTitle>
                  <DialogDescription>Buat ruang diskusi untuk komunitas Anda</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="groupName">Nama Grup</Label>
                    <Input
                      id="groupName"
                      placeholder="Contoh: Matematika Kelas 12"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      className="bg-input border-border"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="groupDescription">Deskripsi</Label>
                    <Textarea
                      id="groupDescription"
                      placeholder="Jelaskan tentang grup ini..."
                      value={newGroupDescription}
                      onChange={(e) => setNewGroupDescription(e.target.value)}
                      className="bg-input border-border resize-none"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="private">Grup Privat</Label>
                      <p className="text-xs text-muted-foreground">Hanya anggota yang bisa melihat postingan</p>
                    </div>
                    <Switch id="private" checked={isPrivate} onCheckedChange={setIsPrivate} />
                  </div>
                  <Button
                    onClick={handleCreateGroup}
                    disabled={creating}
                    className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {creating ? "Membuat..." : "Buat Grup"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Cari grup..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-input border-border"
            />
          </div>
        </div>

        {myGroups.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-foreground mb-4">Grup Saya</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {myGroups.map((group) => (
                <Card
                  key={group.id}
                  className="bg-card border-border hover:border-accent/50 transition-[var(--transition-smooth)] cursor-pointer"
                  onClick={() => navigate(`/groups/${group.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{group.name}</CardTitle>
                        <CardDescription className="line-clamp-2 mt-1">
                          {group.description || "Tidak ada deskripsi"}
                        </CardDescription>
                      </div>
                      {group.is_private ? (
                        <Lock className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Globe className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span>{group.group_members?.[0]?.count || 0} anggota</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLeaveGroup(group.id);
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        Keluar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="text-xl font-bold text-foreground mb-4">Semua Grup</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredGroups.map((group) => (
              <Card
                key={group.id}
                className="bg-card border-border hover:border-accent/50 transition-[var(--transition-smooth)]"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{group.name}</CardTitle>
                      <CardDescription className="line-clamp-2 mt-1">
                        {group.description || "Tidak ada deskripsi"}
                      </CardDescription>
                    </div>
                    {group.is_private ? (
                      <Lock className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{group.group_members?.[0]?.count || 0} anggota</span>
                    </div>
                    {isUserInGroup(group.id) ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/groups/${group.id}`)}
                        className="border-accent text-accent hover:bg-accent/10"
                      >
                        Lihat Grup
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleJoinGroup(group.id)}
                        className="bg-accent text-accent-foreground hover:bg-accent/90"
                      >
                        Gabung
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Groups;
