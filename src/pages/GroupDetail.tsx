import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Users, Send } from "lucide-react";
import { toast } from "sonner";
import PostCard from "@/components/PostCard";
import MediaUploader from "@/components/MediaUploader";
import { MediaFile, compressImage } from "@/lib/mediaUtils";

const GroupDetail = () => {
  const navigate = useNavigate();
  const { groupId } = useParams();
  const [group, setGroup] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Post creation
  const [newPostContent, setNewPostContent] = useState("");
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    checkUser();
  }, [groupId]);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }
    setCurrentUser(user);
    await loadGroupData(user.id);
  };

  const loadGroupData = async (userId: string) => {
    try {
      // Load group info
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select(`
          *,
          profiles!groups_created_by_fkey (full_name, avatar_url)
        `)
        .eq('id', groupId)
        .single();

      if (groupError) throw groupError;
      setGroup(groupData);

      // Check if user is member
      const { data: memberData } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', groupId)
        .eq('user_id', userId)
        .single();

      setIsMember(!!memberData);

      if (!memberData && groupData.is_private) {
        toast.error("Anda bukan anggota grup ini");
        navigate('/groups');
        return;
      }

      // Load members
      const { data: membersData } = await supabase
        .from('group_members')
        .select(`
          *,
          profiles (full_name, avatar_url, role)
        `)
        .eq('group_id', groupId);

      setMembers(membersData || []);

      // Load posts
      await loadPosts();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPosts = async () => {
    const { data, error } = await supabase
      .from('group_posts')
      .select(`
        *,
        profiles (
          id,
          full_name,
          avatar_url,
          role
        )
      `)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error(error.message);
      return;
    }

    // Transform to match PostCard interface
    const transformedPosts = data.map(post => ({
      ...post,
      likes: [], // Group posts don't have likes yet, could be added later
    }));

    setPosts(transformedPosts);
  };

  const uploadMedia = async (file: File, userId: string, type: string): Promise<string> => {
    let fileToUpload = file;

    if (type === 'image') {
      fileToUpload = await compressImage(file);
    }

    const fileExt = fileToUpload.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(fileName, fileToUpload);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim() && mediaFiles.length === 0) {
      toast.error("Postingan tidak boleh kosong");
      return;
    }

    setPosting(true);

    try {
      const mediaUrls: string[] = [];
      const mediaTypes: string[] = [];

      for (const media of mediaFiles) {
        const url = await uploadMedia(media.file, currentUser.id, media.type);
        mediaUrls.push(url);
        mediaTypes.push(media.type);
      }

      const { error } = await supabase.from('group_posts').insert({
        group_id: groupId,
        user_id: currentUser.id,
        content: newPostContent.trim(),
        media_urls: mediaUrls.length > 0 ? mediaUrls : null,
        media_types: mediaTypes.length > 0 ? mediaTypes : null,
      });

      if (error) throw error;

      toast.success("Postingan berhasil dibuat!");
      setNewPostContent("");
      setMediaFiles([]);
      await loadPosts();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setPosting(false);
    }
  };

  const getInitials = (name: string) => {
    const names = name.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
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

  if (!group) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Grup tidak ditemukan</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 bg-card border-b border-border shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/groups')}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-foreground">{group.name}</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              {members.length} anggota
            </p>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {group.description && (
          <Card className="bg-card border-border p-6 mb-6">
            <p className="text-foreground">{group.description}</p>
          </Card>
        )}

        {isMember && (
          <Card className="bg-card border-border p-6 mb-6">
            <Textarea
              placeholder="Bagikan sesuatu dengan grup..."
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
              className="min-h-[100px] bg-input border-border resize-none mb-4"
            />
            
            <MediaUploader onMediaChange={setMediaFiles} />

            <div className="flex justify-end mt-4">
              <Button
                onClick={handleCreatePost}
                disabled={posting || (!newPostContent.trim() && mediaFiles.length === 0)}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                {posting ? "Memposting..." : "Posting"}
              </Button>
            </div>
          </Card>
        )}

        <div className="space-y-4">
          {posts.length === 0 ? (
            <Card className="bg-card border-border p-8 text-center">
              <p className="text-muted-foreground">
                {isMember ? "Belum ada postingan. Jadilah yang pertama!" : "Bergabung untuk melihat postingan"}
              </p>
            </Card>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                currentUserId={currentUser?.id}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupDetail;
