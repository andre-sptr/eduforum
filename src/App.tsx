import React from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import Groups from "./pages/Groups";
import GroupDetail from "./pages/GroupDetail";
import Chat from "./pages/Chat";
import Messages from "./pages/Messages";
import Games from "./pages/Games";
import SearchPage from "./pages/SearchPage";
import NotFound from "./pages/NotFound";
import PostPage from "./pages/PostPage";

const App = () => (
  <ThemeProvider defaultTheme="system" storageKey="eduforum-theme">
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/profile/:userId?" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/groups/:groupId" element={<GroupDetail />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/chat/:conversationId" element={<Chat />} />
          <Route path="/games" element={<Games />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/post/:postId" element={<PostPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </ThemeProvider>
);

export default App;
