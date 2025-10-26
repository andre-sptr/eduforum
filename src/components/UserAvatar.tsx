import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface UserAvatarProps {
  name: string;
  initials: string;
  size?: "sm" | "md" | "lg";
}

export const UserAvatar = ({ name, initials, size = "md" }: UserAvatarProps) => {
  const sizeClasses = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-base",
  };

  return (
    <Avatar className={sizeClasses[size]}>
      <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 font-semibold text-primary-foreground">
        {initials}
      </AvatarFallback>
    </Avatar>
  );
};
