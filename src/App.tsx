import React, { Suspense, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";

const Index = React.lazy(() => import("./pages/Index"));
const Auth = React.lazy(() => import("./pages/Auth"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const SearchPage = React.lazy(() => import("./pages/SearchPage"));
const ProfileSettingsPage = React.lazy(() => import("./pages/ProfileSettingsPage"));
const UserProfilePage = React.lazy(() => import("./pages/UserProfilePage"));
const ChatPage = React.lazy(() => import("./pages/ChatPage"));
const UpdatePassword = React.lazy(() => import("./pages/UpdatePassword"));
const PostPage = React.lazy(() => import("./pages/PostPage"));

const PageLoader = () => (
  <div className="flex h-screen items-center justify-center bg-background">
    <div>Memuat...</div>
  </div>
);

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [pathname]);
  return null;
}

function LegacyNameRedirect() {
  const { username = "" } = useParams<{ username: string }>();
  return <Navigate replace to={`/profile/u/${encodeURIComponent(username)}`} />;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, refetchOnReconnect: true, staleTime: 15_000, gcTime: 300_000 },
    mutations: { retry: 0 },
  },
});

function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/settings/profile" element={<ProfileSettingsPage />} />
          <Route path="/profile/u/:username" element={<UserProfilePage />} />
          <Route path="/profile/name/:name" element={<LegacyNameRedirect />} />
          <Route path="/update-password" element={<UpdatePassword />} />
          <Route path="/post/:postId" element={<PostPage />} />
          <Route path="/chat/:roomId" element={<ChatPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}