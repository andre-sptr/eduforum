import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, Image, Video, Music, FileText } from "lucide-react";
import { MediaFile, DocumentFile, getMediaType, validateMediaFile } from "@/lib/mediaUtils";
import { toast } from "sonner";

interface MediaUploaderProps{onMediaChange:(f:MediaFile[])=>void;onDocumentChange?:(f:DocumentFile[])=>void;acceptDocs?:string;maxDocSizeMB?:number;onSpotifyClick?:()=>void}
const DEFAULT_DOC_ACCEPT="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain";
const DEFAULT_DOC_MAX_MB=15;

const MediaUploader=({onMediaChange,onDocumentChange,acceptDocs=DEFAULT_DOC_ACCEPT,maxDocSizeMB=DEFAULT_DOC_MAX_MB,onSpotifyClick}:MediaUploaderProps)=>{
  const [mediaFiles,setMediaFiles]=useState<MediaFile[]>([]);
  const [documentFiles,setDocumentFiles]=useState<DocumentFile[]>([]);
  const imageInputRef=useRef<HTMLInputElement>(null);
  const videoInputRef=useRef<HTMLInputElement>(null);
  const audioInputRef=useRef<HTMLInputElement>(null);
  const documentInputRef=useRef<HTMLInputElement>(null);

  const clearInput=(ref:React.RefObject<HTMLInputElement>)=>{if(ref.current) ref.current.value=""};

  const handleFileSelect=(files:FileList|null,expected:"image"|"video"|"audio")=>{
    if(!files) return;
    const next:MediaFile[]=[];
    Array.from(files).forEach(f=>{
      const t=getMediaType(f);
      if(!t||t!==expected) return toast.error(`File ${f.name} bukan ${expected} yang valid`);
      if(!validateMediaFile(f,t)) return toast.error(`File ${f.name} terlalu besar`);
      next.push({file:f,preview:URL.createObjectURL(f),type:t});
    });
    if(next.length===0) return;
    const updated=[...mediaFiles,...next];
    setMediaFiles(updated);
    onMediaChange(updated);
  };

  const removeFile=(i:number)=>{
    const target=mediaFiles[i]; if(target?.preview) URL.revokeObjectURL(target.preview);
    const updated=mediaFiles.filter((_,idx)=>idx!==i);
    setMediaFiles(updated);
    onMediaChange(updated);
  };

  const handleDocumentSelect=(files:FileList|null)=>{
    if(!files) return;
    const allowed=acceptDocs.split(",").map(s=>s.trim().toLowerCase());
    const maxBytes=maxDocSizeMB*1024*1024;
    const next:DocumentFile[]=[];
    Array.from(files).forEach(f=>{
      const mime=(f.type||"").toLowerCase();
      const okType=allowed.some(a=>a.endsWith("/*")?mime.startsWith(a.replace("/*","/")):a===mime);
      if(!okType) return toast.error(`File ${f.name} bukan dokumen yang didukung`);
      if(f.size>maxBytes) return toast.error(`File ${f.name} melebihi ${maxDocSizeMB}MB`);
      next.push({file:f,preview:URL.createObjectURL(f),type:"document",name:f.name,size:f.size,mime});
    });
    if(next.length===0) return;
    const updated=[...documentFiles,...next];
    setDocumentFiles(updated);
    onDocumentChange?.(updated);
  };

  const removeDocument=(i:number)=>{
    const target=documentFiles[i]; if(target?.preview) URL.revokeObjectURL(target.preview);
    const updated=documentFiles.filter((_,idx)=>idx!==i);
    setDocumentFiles(updated);
    onDocumentChange?.(updated);
  };

  const formatBytes=(b:number)=>b<1024?`${b} B`:b<1048576?`${(b/1024).toFixed(1)} KB`:`${(b/1048576).toFixed(1)} MB`;

  const hasImages = mediaFiles.some(f => f.type === "image");
  const hasVideos = mediaFiles.some(f => f.type === "video");
  const hasAudios = mediaFiles.some(f => f.type === "audio");
  const hasDocuments = documentFiles.length > 0;

  return(
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e=>{handleFileSelect(e.target.files,"image");clearInput(imageInputRef)}}/>
        <Button 
            type="button" 
            variant="ghost" 
            size="sm" 
            className="rounded-xl bg-white/5 hover:bg-blue-500/10 hover:text-blue-500 border border-white/5 transition-all gap-2 h-9 px-3" 
            onClick={()=>imageInputRef.current?.click()}
            disabled={hasVideos || hasAudios || hasDocuments}
        >
            <Image className="h-4 w-4"/> 
            <span className="text-xs font-medium">Foto</span>
        </Button>
        
        <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={e=>{handleFileSelect(e.target.files,"video");clearInput(videoInputRef)}}/>
        <Button 
            type="button" 
            variant="ghost" 
            size="sm" 
            className="rounded-xl bg-white/5 hover:bg-pink-500/10 hover:text-pink-500 border border-white/5 transition-all gap-2 h-9 px-3" 
            onClick={()=>videoInputRef.current?.click()}
            disabled={hasImages || hasAudios || hasDocuments}
        >
            <Video className="h-4 w-4"/> 
            <span className="text-xs font-medium">Video</span>
        </Button>
        
        <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={e=>{handleFileSelect(e.target.files,"audio");clearInput(audioInputRef)}}/>
        <Button 
            type="button" 
            variant="ghost" 
            size="sm" 
            className="rounded-xl bg-white/5 hover:bg-purple-500/10 hover:text-purple-500 border border-white/5 transition-all gap-2 h-9 px-3" 
            onClick={()=>audioInputRef.current?.click()}
            disabled={hasImages || hasVideos || hasDocuments}
        >
            <Music className="h-4 w-4"/> 
            <span className="text-xs font-medium">Musik</span>
        </Button>
        
        <input ref={documentInputRef} type="file" accept={acceptDocs} multiple className="hidden" onChange={e=>{handleDocumentSelect(e.target.files);clearInput(documentInputRef)}}/>
        <Button 
            type="button" 
            variant="ghost" 
            size="sm" 
            className="rounded-xl bg-white/5 hover:bg-orange-500/10 hover:text-orange-500 border border-white/5 transition-all gap-2 h-9 px-3" 
            onClick={()=>documentInputRef.current?.click()}
            disabled={hasImages || hasVideos || hasAudios}
        >
            <FileText className="h-4 w-4"/> 
            <span className="text-xs font-medium">Dokumen</span>
        </Button>
        
        {onSpotifyClick && (
            <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                className="rounded-xl bg-white/5 hover:bg-green-500/10 hover:text-green-500 border border-white/5 transition-all gap-2 h-9 px-3" 
                onClick={onSpotifyClick}
                disabled={hasImages || hasVideos || hasAudios || hasDocuments}
            >
                <Music className="h-4 w-4"/> 
                <span className="text-xs font-medium">Spotify</span>
            </Button>
        )}
      </div>

      {mediaFiles.length>0&&(
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          {mediaFiles.map((m,i)=>(
            <div key={`m-${i}-${m.preview}`} className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/20 backdrop-blur-sm shadow-md transition-all hover:scale-[1.02]">
              {m.type==="image"&&(<img src={m.preview} alt="" className="h-36 w-full object-cover transition-transform duration-500 group-hover:scale-110"/>)}
              {m.type==="video"&&(<video src={m.preview} className="h-36 w-full object-cover"/>)}
              {m.type==="audio"&&(<div className="grid h-36 w-full place-items-center bg-gradient-to-br from-purple-500/10 to-blue-500/10"><Music className="h-10 w-10 text-purple-400"/></div>)}
              
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                 <button type="button" onClick={()=>removeFile(i)} className="rounded-full bg-red-500/80 p-2 text-white shadow-lg hover:bg-red-600 transition-colors transform scale-90 group-hover:scale-100">
                    <X className="h-5 w-5"/>
                 </button>
              </div>
              
              <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/60 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm border border-white/10">
                {m.type}
              </span>
            </div>
          ))}
        </div>
      )}

      {documentFiles.length>0&&(
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
          {documentFiles.map((d,i)=>(
            <div key={`d-${i}-${d.preview}`} className="group relative flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 p-3 transition-all backdrop-blur-sm">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20 group-hover:scale-110 transition-transform"><FileText className="h-6 w-6"/></div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground/90">{d.name}</div>
                <div className="text-xs text-muted-foreground font-medium">{formatBytes(d.size)}</div>
              </div>
              <button type="button" onClick={()=>removeDocument(i)} className="rounded-full p-2 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"><X className="h-4 w-4"/></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MediaUploader;