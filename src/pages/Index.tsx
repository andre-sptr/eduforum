import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Landing from "./Landing";
import { Loader2 } from "lucide-react";

export default function Index() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        navigate("/home");
      }
      setLoading(false);
    });
  }, [navigate]);

  if (loading) {
     return (
        <div className="flex justify-center items-center h-screen w-full bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
     );
  }

  return <Landing />;
}
