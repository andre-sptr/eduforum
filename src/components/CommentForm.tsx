import React, { useState, useRef, ChangeEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "./UserAvatar";
import { toast } from "sonner";
import { Send, Image as ImageIcon, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface CommentFormProps {
  onSubmit: (data: { text: string, file: File | null }) => void;
  isLoading: boolean;
  placeholder: string;
  currentUserName: string;
  currentUserInitials: string;
  initialMention?: string;
  currentUserId: string;
}

const MENTION_DETECTION_REGEX = /@([\w\s]+)$/; 

export const CommentForm = ({
  onSubmit,
  isLoading,
  placeholder,
  currentUserName,
  currentUserInitials,
  initialMention = "",
  currentUserId
}: CommentFormProps) => {
  
  const [content, setContent] = useState(initialMention);
  const [commentImageFile, setCommentImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [activeMention, setActiveMention] = useState<string | null>(null);

  const { data: suggestedUsers = [], isLoading: isSearching } = useQuery({
      queryKey: ['suggestedUsersInComment', activeMention],
      queryFn: async () => {
          if (!activeMention || activeMention.length < 2) return [];

          const { data, error } = await supabase
              .from('profiles')
              .select('id, name, avatar_text, role')
              .ilike('name', `${activeMention}%`) 
              .neq('id', currentUserId)
              .limit(5);

          if (error) throw error;
          return data || [];
      },
      enabled: !!activeMention && activeMention.length > 1,
      staleTime: 0,
  });

  const handleContentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newContent = e.target.value;
      setContent(newContent);

      const match = newContent.match(MENTION_DETECTION_REGEX);

      if (match) {
          const typedText = match[1].trim(); 
          if (typedText.length >= 2 && !typedText.includes('@')) { 
              setActiveMention(typedText); 
          } else {
              setActiveMention(null); 
          }
      } else {
          setActiveMention(null);
      }
  };

  const handleSelectSuggestion = (userToTag: { name: string }) => {
      const regexToReplace = new RegExp(`@${activeMention}$`);
      const newContent = content.replace(regexToReplace, `@${userToTag.name} `);
      
      setContent(newContent);
      setActiveMention(null);
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
      const MAX_SIZE_MB = 5;
      const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
      if (!file) { clearImageSelection(); return; }
      if (!file.type.startsWith('image/')) { toast.error("Hanya file gambar yang diizinkan."); if (imageInputRef.current) imageInputRef.current.value = ""; return; }
      if (file.size > MAX_SIZE_BYTES) { toast.error(`Ukuran gambar maksimal ${MAX_SIZE_MB} MB.`); if (imageInputRef.current) imageInputRef.current.value = ""; clearImageSelection(); return; }
      setCommentImageFile(file);
      setImagePreviewUrl(URL.createObjectURL(file));
  };

  const triggerImageInput = () => imageInputRef.current?.click();

  const clearImageSelection = () => {
    setCommentImageFile(null);
    setImagePreviewUrl(null);
    if (imageInputRef.current) imageInputRef.current.value = "";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = content.trim();
    if (text || commentImageFile) {
      onSubmit({ text, file: commentImageFile });
      setContent(initialMention);
      clearImageSelection();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2 relative">
      {activeMention && (
          <div className="absolute bottom-full left-0 z-50 w-full mb-1 bg-card border rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {isSearching ? (
                  <p className="p-2 text-xs text-muted-foreground">Mencari...</p>
              ) : suggestedUsers.length === 0 ? (
                  <p className="p-2 text-xs text-muted-foreground">Tidak ada saran ditemukan.</p>
              ) : (
                  suggestedUsers.map((user) => (
                      <div 
                          key={user.id} 
                          className="flex items-center gap-2 p-2 hover:bg-muted cursor-pointer"
                          onClick={() => handleSelectSuggestion(user)}
                      >
                          <UserAvatar name={user.name} initials={user.avatar_text} size="xs" />
                          <span className="text-sm font-medium">@{user.name}</span>
                      </div>
                  ))
              )}
          </div>
      )}

      {imagePreviewUrl && (
          <div className="relative w-fit">
            <img src={imagePreviewUrl} alt="Preview" className="max-h-24 rounded border" />
            <Button variant="destructive" size="icon" className="absolute -top-2 -right-2 h-5 w-5 rounded-full z-10 p-0" onClick={clearImageSelection} aria-label="Hapus Gambar"> <X className="h-3 w-3" /> </Button>
          </div>
      )}
      
      <div className="flex gap-2 items-center">
        <UserAvatar name={currentUserName} initials={currentUserInitials} size="sm" />
        <input type="file" ref={imageInputRef} onChange={handleImageChange} className="hidden" accept="image/*" />
        <Button variant="ghost" size="icon" type="button" onClick={triggerImageInput} disabled={isLoading} className="text-muted-foreground">
            <ImageIcon className="h-5 w-5"/>
        </Button>
        <Input
          value={content}
          onChange={handleContentChange}
          placeholder={placeholder}
          className="flex-1"
        />
        <Button
            type="submit"
            size="icon"
            disabled={isLoading || (!content.trim() && !commentImageFile)}
        >
            <Send className="h-4 w-4" />
        </Button>
      </div>
    </form>
  );
};