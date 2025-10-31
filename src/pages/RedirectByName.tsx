// pages/RedirectByName.tsx
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function RedirectByName(): JSX.Element | null {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    (async () => {
      const decoded = decodeURIComponent(name || "");
      const { data } = await supabase.from("profiles").select("username").ilike("name", decoded).maybeSingle();
      if (!alive) return;
      if (!data?.username) {
        navigate("/404", { replace: true });
        return;
      }
      navigate(`/profile/u/${encodeURIComponent(data.username)}`, { replace: true });
    })();
    return () => {
      alive = false;
    };
  }, [name, navigate]);

  return null;
}
