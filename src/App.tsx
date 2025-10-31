import React, { Suspense } from 'react';
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";


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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/settings/profile" element={<ProfileSettingsPage />} />
            <Route path="/profile/name/:name" element={<UserProfilePage />} />
            <Route path="/update-password" element={<UpdatePassword />} />
            <Route path="/post/:postId" element={<PostPage />} />
            <Route path="/chat/:roomId" element={<ChatPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;