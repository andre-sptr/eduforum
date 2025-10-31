import React, { memo, useMemo } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface UserAvatarProps {
  name?: string | null;
  initials?: string | null;
  size?: "xs" | "sm" | "md" | "lg";
}

export const UserAvatar = memo(function UserAvatar({
  name,
  initials,
  size = "md",
}: UserAvatarProps): JSX.Element {
  const sizeClasses: Record<NonNullable<UserAvatarProps["size"]>, string> = {
    xs: "h-6 w-6 text-[10px]",
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-base",
  };

  const safeName = (name || "").trim() || "Pengguna";
  const normInitials = useMemo(() => {
    const base =
      (initials || "")
        .trim()
        .slice(0, 2) ||
      safeName
        .trim()
        .split(/\s+/)
        .map((w) => w[0] || "")
        .join("")
        .slice(0, 2);
    return base.toUpperCase() || "?";
  }, [initials, safeName]);

  return (
    <Avatar className={sizeClasses[size]} title={safeName} role="img" aria-label={safeName}>
      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 font-semibold text-primary-foreground">
        {normInitials}
      </AvatarFallback>
    </Avatar>
  );
});