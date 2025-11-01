import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface UserAvatarProps {
  name: string;
  initials: string;
  size?: "xs" | "sm" | "md" | "lg";
}

export const UserAvatar = ({ name, initials, size = "md" }: UserAvatarProps) => {
  const sizeClasses = {
    xs: "h-6 w-6 text-xs",
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-base",
  };
  const sizeClass = sizeClasses[size] || sizeClasses.md;

  return (
    <Avatar className={sizeClass}>
      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 font-semibold text-primary-foreground">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
};