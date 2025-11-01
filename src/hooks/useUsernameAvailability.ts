import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export type UsernameStatus =
  | { state: "idle" }
  | { state: "format-invalid"; suggestion: string }
  | { state: "checking"; suggestion: string }
  | { state: "taken"; suggestion: string }
  | { state: "available"; suggestion: string };

export function useUsernameAvailability(input: string) {
  const [status, setStatus] = useState<UsernameStatus>({ state: "idle" });
  const suggestion = useMemo(() => slugify(input || ""), [input]);
  useEffect(() => {
    if (!input) {
      setStatus({ state: "idle" });
      return;
    }
    if (!RE.test(suggestion)) {
      setStatus({ state: "format-invalid", suggestion });
      return;
    }
    let alive = true;
    setStatus({ state: "checking", suggestion });
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc("is_username_available", { p_username: suggestion });
      if (!alive) return;
      if (error) {
        setStatus({ state: "format-invalid", suggestion });
        return;
      }
      setStatus(data ? { state: "available", suggestion } : { state: "taken", suggestion });
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [input, suggestion]);
  return status;
}