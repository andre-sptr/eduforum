import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { X, Image, Video, Music, FileText } from "lucide-react";
import { MediaFile, getMediaType, validateMediaFile } from "@/lib/mediaUtils";
import { toast } from "sonner";

type DocumentFile={file:File;preview:string;type:"document";name:string;size:number;mime:string};
interface MediaUploaderProps{onMediaChange:(f:MediaFile[])=>void;onDocumentChange?:(f:DocumentFile[])=>void;acceptDocs?:string;maxDocSizeMB?:number}
const DEFAULT_DOC_ACCEPT="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain";
const DEFAULT_DOC_MAX_MB=15;

const MediaUploader=({onMediaChange,onDocumentChange,acceptDocs=DEFAULT_DOC_ACCEPT,maxDocSizeMB=DEFAULT_DOC_MAX_MB}:MediaUploaderProps)=>{
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

  return(
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input ref={imageInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e=>{handleFileSelect(e.target.files,"image");clearInput(imageInputRef)}}/>
        <Button type="button" variant="ghost" size="sm" className="rounded-xl ring-1 ring-border hover:ring-accent/60 gap-2" onClick={()=>imageInputRef.current?.click()}><Image className="h-4 w-4"/> Foto</Button>
        <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={e=>{handleFileSelect(e.target.files,"video");clearInput(videoInputRef)}}/>
        <Button type="button" variant="ghost" size="sm" className="rounded-xl ring-1 ring-border hover:ring-accent/60 gap-2" onClick={()=>videoInputRef.current?.click()}><Video className="h-4 w-4"/> Video</Button>
        <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={e=>{handleFileSelect(e.target.files,"audio");clearInput(audioInputRef)}}/>
        <Button type="button" variant="ghost" size="sm" className="rounded-xl ring-1 ring-border hover:ring-accent/60 gap-2" onClick={()=>audioInputRef.current?.click()}><Music className="h-4 w-4"/> Musik</Button>
        <input ref={documentInputRef} type="file" accept={acceptDocs} multiple className="hidden" onChange={e=>{handleDocumentSelect(e.target.files);clearInput(documentInputRef)}}/>
        <Button type="button" variant="ghost" size="sm" className="rounded-xl ring-1 ring-border hover:ring-accent/60 gap-2" onClick={()=>documentInputRef.current?.click()}><FileText className="h-4 w-4"/> Dokumen</Button>
      </div>

      {mediaFiles.length>0&&(
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {mediaFiles.map((m,i)=>(
            <div key={`m-${i}-${m.preview}`} className="group relative overflow-hidden rounded-xl border border-border/60 bg-black/5">
              {m.type==="image"&&(<img src={m.preview} alt="" className="h-32 w-full object-cover"/>)}
              {m.type==="video"&&(<video src={m.preview} className="h-32 w-full object-cover"/>)}
              {m.type==="audio"&&(<div className="grid h-32 w-full place-items-center"><Music className="h-7 w-7 text-muted-foreground"/></div>)}
              <span className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-[11px] uppercase tracking-wide text-white">{m.type}</span>
              <button type="button" onClick={()=>removeFile(i)} className="absolute right-2 top-2 rounded-full bg-destructive p-1 text-destructive-foreground opacity-0 shadow transition group-hover:opacity-100"><X className="h-4 w-4"/></button>
            </div>
          ))}
        </div>
      )}

      {documentFiles.length>0&&(
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {documentFiles.map((d,i)=>(
            <div key={`d-${i}-${d.preview}`} className="group relative flex items-center gap-3 rounded-xl border border-border/60 bg-black/5 p-3">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-white/60"><FileText className="h-5 w-5"/></div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{d.name}</div>
                <div className="text-xs text-muted-foreground">{formatBytes(d.size)}</div>
              </div>
              <button type="button" onClick={()=>removeDocument(i)} className="rounded-full bg-destructive p-1 text-destructive-foreground opacity-90 shadow transition"><X className="h-4 w-4"/></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MediaUploader;