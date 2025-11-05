import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface User { id:string; full_name:string; avatar_url:string|null; role:string }
interface MentionInputProps {
  value:string; onChange:(v:string)=>void; placeholder?:string; className?:string; multiline?:boolean; disabled?:boolean; onKeyDown?:(e:React.KeyboardEvent)=>void; allowedUserIds?:string[]; currentUserId?:string;
}

const findQuery = (text: string, cursor: number) => {
  const beforeCursor = text.substring(0, cursor);
  let i = beforeCursor.length - 1;
  while (i >= 0) {
    const char = beforeCursor[i];
    if (char === " " || char === "\n" || char === ")") break;
    if (char === "@") {
      if (i > 0 && beforeCursor[i - 1] === "[") {
        i--;
        continue;
      }
      const query = beforeCursor.substring(i + 1);
      if (!query.includes(" ")) {
        return { query, queryStartIndex: i };
      } else {
        break;
      }
    }
    i--;
  }
  return { query: null, queryStartIndex: -1 };
};

export const MentionInput=({
  value,onChange,placeholder="Ketik pesan...",className="",multiline=false,disabled=false,onKeyDown,allowedUserIds,currentUserId
}:MentionInputProps)=>{
  const [show,setShow]=useState(false); 
  const [items,setItems]=useState<User[]>([]); 
  const [sel,setSel]=useState(0);
  const [q,setQ]=useState(""); 
  const [cursor,setCursor]=useState(0); 
  const [pos,setPos]=useState<"top"|"bottom">("bottom");
  const [queryStartIndex, setQueryStartIndex] = useState(-1);
  const inputRef=useRef<HTMLInputElement|HTMLTextAreaElement>(null); 

  useEffect(()=>{ 
    if(!show||!inputRef.current) return; 
    const r=inputRef.current.getBoundingClientRect(); 
    const vh=window.innerHeight; 
    setPos(vh - r.bottom > 220 || r.top < 220 ? "bottom" : "top");
  },[show, items.length]);

  useEffect(() => {
    const search = async () => {
      if (!q) {
        setShow(false);
        setItems([]);
        return;
      }
      let query = supabase.from("profiles")
        .select("id,full_name,avatar_url,role")
        .ilike("full_name", `%${q}%`);
        
      if (currentUserId) query = query.neq("id", currentUserId);
      if (allowedUserIds?.length) query = query.in("id", allowedUserIds);

      const { data } = await query.limit(5);
      setItems(data || []);
      setShow(!!data?.length);
      if (data?.length) setSel(0);
    };
    
    search();
  }, [q, allowedUserIds, currentUserId]);

  const handleChange=(e:React.ChangeEvent<HTMLInputElement|HTMLTextAreaElement>)=>{
    const nv = e.target.value;
    const c = e.target.selectionStart || 0;
    onChange(nv);
    setCursor(c);

    const { query, queryStartIndex } = findQuery(nv, c);
    
    setQ(query || "");
    setQueryStartIndex(queryStartIndex);
    
    if (query === null) {
      setShow(false);
    }
  };

  const insert=(u:User)=>{
    if (queryStartIndex === -1) return; 

    const beforeQuery = value.substring(0, queryStartIndex);
    const afterCursor = value.substring(cursor);
    const mention = `@[${u.full_name}](${u.id})`;
    const newValue = `${beforeQuery}${mention} ${afterCursor}`;
    
    onChange(newValue);
    setShow(false);
    setQ("");
    setQueryStartIndex(-1);

    setTimeout(()=>{ if(inputRef.current){ 
      const newCursorPos = beforeQuery.length + mention.length + 1;
      inputRef.current.focus(); 
      inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
    }}, 0);
  };

  const handleKeys=(e:React.KeyboardEvent<HTMLInputElement|HTMLTextAreaElement>)=>{
    if(show&&items.length){
      const keyMap: Record<string, () => void> = {
        ArrowDown: () => setSel(v => (v + 1) % items.length),
        ArrowUp: () => setSel(v => (v - 1 + items.length) % items.length),
        Enter: () => insert(items[sel]),
        Escape: () => { setShow(false); setQ(""); },
      };
      
      const handler = keyMap[e.key];
      
      if (handler && !(e.key === 'Enter' && e.shiftKey)) {
        e.preventDefault();
        handler();
        return;
      }
    }
    onKeyDown?.(e);
  };

  const initials=(n:string)=>{const a=n.split(" ");return (a[0]?.[0]||"")+(a[1]?.[0]||"").toUpperCase()||"U";}
  
  const Field=multiline?Textarea:Input;
  
  const fieldClass = cn(
    "rounded-xl bg-input/60 border-border focus-visible:ring-2 focus-visible:ring-accent/70",
    "placeholder:text-muted-foreground/70",
    multiline && "min-h-[100px]",
    className
  );

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
        <Card className={cn(
          "absolute left-0 z-50 w-full overflow-hidden rounded-xl border border-border bg-card/95 shadow-xl backdrop-blur",
          pos === "top" ? "bottom-full mb-2" : "top-full mt-2"
        )}>
          <div className="divide-y divide-border/60">
            {items.map((u,i)=>(
              <button 
                key={u.id} 
                onClick={()=>insert(u)} 
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2 text-left transition", 
                  i===sel?"bg-accent/90 text-accent-foreground":"hover:bg-accent/40"
                )}
              >
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