import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, Image, Video, Music } from "lucide-react";
import { MediaFile, getMediaType, validateMediaFile } from "@/lib/mediaUtils";
import { toast } from "sonner";

interface MediaUploaderProps {
  onMediaChange: (files: MediaFile[]) => void;
}

const MediaUploader = ({ onMediaChange }: MediaUploaderProps) => {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: FileList | null, expectedType: 'image' | 'video' | 'audio') => {
    if (!files) return;

    const newMediaFiles: MediaFile[] = [];

    Array.from(files).forEach((file) => {
      const mediaType = getMediaType(file);
      
      if (!mediaType || mediaType !== expectedType) {
        toast.error(`File ${file.name} bukan ${expectedType} yang valid`);
        return;
      }

      if (!validateMediaFile(file, mediaType)) {
        toast.error(`File ${file.name} terlalu besar`);
        return;
      }

      const preview = URL.createObjectURL(file);
      newMediaFiles.push({ file, preview, type: mediaType });
    });

    const updatedFiles = [...mediaFiles, ...newMediaFiles];
    setMediaFiles(updatedFiles);
    onMediaChange(updatedFiles);
  };

  const removeFile = (index: number) => {
    const updatedFiles = mediaFiles.filter((_, i) => i !== index);
    setMediaFiles(updatedFiles);
    onMediaChange(updatedFiles);
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files, 'image')}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-accent"
          onClick={() => imageInputRef.current?.click()}
        >
          <Image className="h-5 w-5 mr-2" />
          Foto
        </Button>

        <input
          ref={videoInputRef}
          type="file"
          accept="video/*"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files, 'video')}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-accent"
          onClick={() => videoInputRef.current?.click()}
        >
          <Video className="h-5 w-5 mr-2" />
          Video
        </Button>

        <input
          ref={audioInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(e) => handleFileSelect(e.target.files, 'audio')}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-accent"
          onClick={() => audioInputRef.current?.click()}
        >
          <Music className="h-5 w-5 mr-2" />
          Musik
        </Button>
      </div>

      {mediaFiles.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {mediaFiles.map((media, index) => (
            <div key={index} className="relative group">
              {media.type === 'image' && (
                <img
                  src={media.preview}
                  alt="Preview"
                  className="w-full h-24 object-cover rounded-lg"
                />
              )}
              {media.type === 'video' && (
                <video
                  src={media.preview}
                  className="w-full h-24 object-cover rounded-lg"
                />
              )}
              {media.type === 'audio' && (
                <div className="w-full h-24 bg-muted rounded-lg flex items-center justify-center">
                  <Music className="h-8 w-8 text-muted-foreground" />
                </div>
              )}
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MediaUploader;
