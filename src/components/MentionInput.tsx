import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface User { id:string; full_name:string; avatar_url:string|null; role:string }
interface MentionInputProps {
  value:string; onChange:(v:string)=>void; placeholder?:string; className?:string; multiline?:boolean; disabled?:boolean; onKeyDown?:(e:React.KeyboardEvent)=>void; allowedUserIds?:string[]; currentUserId?:string;
}

export const MentionInput=({
  value,onChange,placeholder="Ketik pesan...",className="",multiline=false,disabled=false,onKeyDown,allowedUserIds,currentUserId
}:MentionInputProps)=>{
  const [show,setShow]=useState(false); const [items,setItems]=useState<User[]>([]); const [sel,setSel]=useState(0);
  const [q,setQ]=useState(""); const [cursor,setCursor]=useState(0); const [pos,setPos]=useState<"top"|"bottom">("bottom");
  const inputRef=useRef<HTMLInputElement|HTMLTextAreaElement>(null); const listRef=useRef<HTMLDivElement>(null);

  useEffect(()=>{ if(!show||!inputRef.current) return; const r=inputRef.current.getBoundingClientRect(); const vh=window.innerHeight; setPos(vh-r.bottom>300||r.top<300?"bottom":"top"); },[show]);

  useEffect(()=>{ const search=async()=>{ if(!q){ setItems([]); setShow(false); return; }
    let query=supabase.from("profiles").select("id,full_name,avatar_url,role").ilike("full_name",`%${q}%`);
    if(currentUserId) query=query.neq("id",currentUserId); if(allowedUserIds?.length) query=query.in("id",allowedUserIds);
    const {data}=await query.limit(5); if(data?.length){ setItems(data); setShow(true); setSel(0);} else { setItems([]); setShow(false); }
  }; search(); },[q,allowedUserIds,currentUserId]);

  const handleChange=(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>{
    const nv=e.target.value, c=e.target.selectionStart||0; onChange(nv); setCursor(c);
    const before=nv.substring(0,c); const i=before.lastIndexOf("@");
    if(i!==-1){ const after=before.substring(i+1); if(!after.includes(" ")){ setQ(after); return; } }
    setQ(""); setShow(false);
  };

  const insert=(u:User)=>{
    const beforeAll=value.substring(0,cursor), afterAll=value.substring(cursor), i=beforeAll.lastIndexOf("@");
    const before=beforeAll.substring(0,i), mention=`@[${u.full_name}](${u.id})`, nv=before+mention+" "+afterAll;
    onChange(nv); setShow(false); setQ("");
    setTimeout(()=>{ if(inputRef.current){ const p=before.length+mention.length+1; inputRef.current.focus(); inputRef.current.setSelectionRange(p,p);} },0);
  };

  const handleKeys=(e:React.KeyboardEvent<HTMLInputElement|HTMLTextAreaElement>)=>{
    if(show&&items.length){
      if(e.key==="ArrowDown"){ e.preventDefault(); setSel(v=>(v+1)%items.length); return; }
      if(e.key==="ArrowUp"){ e.preventDefault(); setSel(v=>(v-1+items.length)%items.length); return; }
      if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); insert(items[sel]); return; }
      if(e.key==="Escape"){ setShow(false); setQ(""); return; }
    }
    onKeyDown?.(e);
  };

  const initials=(n:string)=>{const a=n.split(" ");return a.length>=2?(a[0][0]+a[1][0]).toUpperCase():n.slice(0,2).toUpperCase();}
  const Field=multiline?Textarea:Input;
  const fieldClass=[
    "rounded-xl bg-input/60 border-border focus-visible:ring-2 focus-visible:ring-accent/70",
    "placeholder:text-muted-foreground/70",
    multiline?"min-h-[100px]":"",
    className
  ].filter(Boolean).join(" ");

  return (
    <div className="relative w-full">
      <Field
        ref={inputRef as any}
        type={multiline?undefined:"text"}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeys}
        placeholder={placeholder}
        disabled={disabled}
        className={fieldClass}
      />
      {show&&items.length>0&&(
        <Card ref={listRef} className={`absolute ${pos==="top"?"bottom-full mb-2":"top-full mt-2"} left-0 z-50 w-full overflow-hidden rounded-xl border border-border bg-card/95 shadow-xl backdrop-blur`}>
          <div className="divide-y divide-border/60">
            {items.map((u,i)=>(
              <button key={u.id} onClick={()=>insert(u)} className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${i===sel?"bg-accent/90 text-accent-foreground":"hover:bg-accent/40"}`}>
                <Avatar className="h-8 w-8 ring-1 ring-border">
                  <AvatarImage src={u.avatar_url||undefined}/>
                  <AvatarFallback className="bg-primary text-primary-foreground font-semibold">{initials(u.full_name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="text-sm font-medium leading-tight">{u.full_name}</div>
                  <div className="text-[11px] text-muted-foreground">{u.role}</div>
                </div>
                <kbd className="hidden sm:inline-block rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">Enter</kbd>
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
