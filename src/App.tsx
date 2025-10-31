// App.tsx
import React, { Suspense } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

const Index = React.lazy(() => import("./pages/Index"));
const Auth = React.lazy(() => import("./pages/Auth"));
const NotFound = React.lazy(() => import("./pages/NotFound"));
const SearchPage = React.lazy(() => import("./pages/SearchPage"));
const ProfileSettingsPage = React.lazy(() => import("./pages/ProfileSettingsPage"));
const UserProfilePage = React.lazy(() => import("./pages/UserProfilePage"));
const ChatPage = React.lazy(() => import("./pages/ChatPage"));
const UpdatePassword = React.lazy(() => import("./pages/UpdatePassword"));
const PostPage = React.lazy(() => import("./pages/PostPage"));
const RedirectByName = React.lazy(() => import("./pages/RedirectByName"));

const PageLoader = (): JSX.Element => (
  <div className="flex h-screen items-center justify-center bg-background">
    <div>Memuat...</div>
  </div>
);

class ErrorBoundary extends React.Component<React.PropsWithChildren<unknown>, { hasError: boolean }> {
  state: Readonly<{ hasError: boolean }> = { hasError: false };
  static getDerivedStateFromError(_: Error): { hasError: boolean } {
    return { hasError: true };
  }
  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center">
          <button className="px-4 py-2 rounded-md border" onClick={() => (window.location.href = "/")}>
            Terjadi kesalahan — Kembali
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, gcTime: 300000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

const App = (): JSX.Element => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <BrowserRouter>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/settings/profile" element={<ProfileSettingsPage />} />
              <Route path="/profile/u/:username" element={<UserProfilePage />} />
              <Route path="/profile/name/:name" element={<RedirectByName />} />
              <Route path="/update-password" element={<UpdatePassword />} />
              <Route path="/post/:postId" element={<PostPage />} />
              <Route path="/chat/:roomId" element={<ChatPage />} />
              <Route path="/404" element={<NotFound />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;