import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export function AnalyticsWrapper({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  useEffect(() => {

    const logPageView = (path: string) => {
      console.log(`[Analytics] Page View: ${path} at ${new Date().toISOString()}`);
    };

    logPageView(location.pathname);
  }, [location]);

  return <>{children}</>;
}
