
import React, { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Loader2 } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { AnalyticsWrapper } from "@/components/analytics/AnalyticsWrapper";

const PageLoader = () => (
  <div className="flex justify-center items-center h-screen w-full">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

const Index = lazy(() => import("./pages/Index"));
const Feed = lazy(() => import("./pages/Feed"));
const Auth = lazy(() => import("./pages/Auth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const Groups = lazy(() => import("./pages/Groups"));
const GroupDetail = lazy(() => import("./pages/GroupDetail"));
const Chat = lazy(() => import("./pages/Chat"));
const Messages = lazy(() => import("./pages/Messages"));
const Games = lazy(() => import("./pages/Games"));
const Notifications = lazy(() => import("./pages/Notifications"));
const SearchPage = lazy(() => import("./pages/SearchPage"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PostPage = lazy(() => import("./pages/PostPage"));
const UpdatePassword = lazy(() => import("./pages/UpdatePassword"));

const App = () => (
  <ThemeProvider defaultTheme="system" storageKey="eduforum-theme">
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <AnalyticsWrapper>
          <Suspense fallback={<PageLoader />}>
            <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/update-password" element={<UpdatePassword />} />

            <Route element={<AppShell />}>
              <Route path="/home" element={<Feed />} />
              <Route path="/profile/:userId?" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/groups" element={<Groups />} />
              <Route path="/groups/:groupId" element={<GroupDetail />} />
              <Route path="/messages" element={<Messages />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/chat/:conversationId" element={<Chat />} />
              <Route path="/games" element={<Games />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/post/:postId" element={<PostPage />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
          </Suspense>
        </AnalyticsWrapper>
      </BrowserRouter>
    </TooltipProvider>
  </ThemeProvider>
);

export default App;