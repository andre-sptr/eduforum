import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface User {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
}

interface MentionInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  multiline?: boolean;
  disabled?: boolean;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  allowedUserIds?: string[]; // Filter untuk user yang boleh di-mention
  currentUserId?: string; // ID user saat ini, untuk exclude dari suggestions
}

export const MentionInput = ({
  value,
  onChange,
  placeholder = "Ketik pesan...",
  className = "",
  multiline = false,
  disabled = false,
  onKeyDown,
  allowedUserIds,
  currentUserId,
}: MentionInputProps) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionSearch, setMentionSearch] = useState("");
  const [cursorPosition, setCursorPosition] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState<'top' | 'bottom'>('bottom');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showSuggestions && inputRef.current) {
      const inputRect = inputRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - inputRect.bottom;
      const spaceAbove = inputRect.top;
      
      // Set dropdown position based on available space
      // If there's more space below or not enough space above, show below
      if (spaceBelow > 300 || spaceAbove < 300) {
        setDropdownPosition('bottom');
      } else {
        setDropdownPosition('top');
      }
    }
  }, [showSuggestions]);

  useEffect(() => {
    const searchMentions = async () => {
      if (!mentionSearch) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }

      let query = supabase
        .from("profiles")
        .select("id, full_name, avatar_url, role")
        .ilike("full_name", `%${mentionSearch}%`);

      // Exclude current user from suggestions
      if (currentUserId) {
        query = query.neq("id", currentUserId);
      }

      // Filter by allowed user IDs if provided
      if (allowedUserIds && allowedUserIds.length > 0) {
        query = query.in("id", allowedUserIds);
      }

      const { data } = await query.limit(5);

      if (data && data.length > 0) {
        setSuggestions(data);
        setShowSuggestions(true);
        setSelectedIndex(0);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    };

    searchMentions();
  }, [mentionSearch, allowedUserIds, currentUserId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const newCursor = e.target.selectionStart || 0;
    
    onChange(newValue);
    setCursorPosition(newCursor);

    // Check for @ symbol
    const textBeforeCursor = newValue.substring(0, newCursor);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    
    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      const hasSpace = textAfterAt.includes(" ");
      
      if (!hasSpace && textAfterAt.length >= 0) {
        setMentionSearch(textAfterAt);
      } else {
        setMentionSearch("");
        setShowSuggestions(false);
      }
    } else {
      setMentionSearch("");
      setShowSuggestions(false);
    }
  };

  const insertMention = (user: User) => {
    const textBeforeCursor = value.substring(0, cursorPosition);
    const textAfterCursor = value.substring(cursorPosition);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");
    
    const beforeMention = value.substring(0, lastAtIndex);
    const mention = `@[${user.full_name}](${user.id})`;
    const newValue = beforeMention + mention + " " + textAfterCursor;
    
    onChange(newValue);
    setShowSuggestions(false);
    setMentionSearch("");
    
    // Focus back to input
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        const newPosition = beforeMention.length + mention.length + 1;
        inputRef.current.setSelectionRange(newPosition, newPosition);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % suggestions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        insertMention(suggestions[selectedIndex]);
        return;
      } else if (e.key === "Escape") {
        setShowSuggestions(false);
        setMentionSearch("");
      }
    }
    
    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  const renderDisplayText = () => {
    // Replace mention format with display format
    return value.replace(/@\[([^\]]+)\]\([a-f0-9\-]+\)/g, "@$1");
  };

  const getInitials = (name: string) => {
    const names = name.split(" ");
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const InputComponent = multiline ? Textarea : Input;

  return (
    <div className="relative w-full">
      <InputComponent
        ref={inputRef as any}
        type={multiline ? undefined : "text"}
        value={renderDisplayText()}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
      />
      
      {showSuggestions && suggestions.length > 0 && (
        <Card
          ref={suggestionsRef}
          className={`absolute ${
            dropdownPosition === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          } left-0 w-full max-h-64 overflow-y-auto bg-card border-border shadow-lg z-50`}
        >
          <div className="p-2">
            {suggestions.map((user, index) => (
              <div
                key={user.id}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                  index === selectedIndex ? "bg-accent" : "hover:bg-accent/50"
                }`}
                onClick={() => insertMention(user)}
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {getInitials(user.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-foreground">{user.full_name}</p>
                  <p className="text-xs text-muted-foreground">{user.role}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};