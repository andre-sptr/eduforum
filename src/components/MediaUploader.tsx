import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, Image, Video, Music } from "lucide-react";
import { MediaFile, getMediaType, validateMediaFile } from "@/lib/mediaUtils";
import { toast } from "sonner";

interface MediaUploaderProps { onMediaChange: (files: MediaFile[]) => void }

const MediaUploader = ({ onMediaChange }: MediaUploaderProps) => {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (files: FileList | null, expected: "image"|"video"|"audio") => {
    if (!files) return;
    const next: MediaFile[] = [];
    Array.from(files).forEach(f => {
      const t = getMediaType(f);
      if (!t || t !== expected) return toast.error(`File ${f.name} bukan ${expected} yang valid`);
      if (!validateMediaFile(f, t)) return toast.error(`File ${f.name} terlalu besar`);
      next.push({ file: f, preview: URL.createObjectURL(f), type: t });
    });
    const updated = [...mediaFiles, ...next];
    setMediaFiles(updated);
    onMediaChange(updated);
  };

  const removeFile = (i: number) => {
    const updated = mediaFiles.filter((_, idx) => idx !== i);
    setMediaFiles(updated);
    onMediaChange(updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e=>handleFileSelect(e.target.files,"image")} />
        <Button type="button" variant="ghost" size="sm" className="rounded-xl ring-1 ring-border hover:ring-accent/60 gap-2" onClick={()=>imageInputRef.current?.click()}>
          <Image className="h-4 w-4" /> Foto
        </Button>
        <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={e=>handleFileSelect(e.target.files,"video")} />
        <Button type="button" variant="ghost" size="sm" className="rounded-xl ring-1 ring-border hover:ring-accent/60 gap-2" onClick={()=>videoInputRef.current?.click()}>
          <Video className="h-4 w-4" /> Video
        </Button>
        <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={e=>handleFileSelect(e.target.files,"audio")} />
        <Button type="button" variant="ghost" size="sm" className="rounded-xl ring-1 ring-border hover:ring-accent/60 gap-2" onClick={()=>audioInputRef.current?.click()}>
          <Music className="h-4 w-4" /> Musik
        </Button>
      </div>

      {mediaFiles.length>0&&(
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {mediaFiles.map((m,i)=>(
            <div key={i} className="group relative overflow-hidden rounded-xl border border-border/60 bg-black/5">
              {m.type==="image"&&(<img src={m.preview} alt="" className="h-32 w-full object-cover" />)}
              {m.type==="video"&&(<video src={m.preview} className="h-32 w-full object-cover" />)}
              {m.type==="audio"&&(
                <div className="grid h-32 w-full place-items-center">
                  <Music className="h-7 w-7 text-muted-foreground" />
                </div>
              )}
              <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[11px] uppercase tracking-wide text-white">
                {m.type}
              </span>
              <button type="button" onClick={()=>removeFile(i)} className="absolute right-2 top-2 rounded-full bg-destructive p-1 text-destructive-foreground opacity-0 shadow transition group-hover:opacity-100">
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
