import { Avatar } from "@heroui/react";

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase();
}

/** Foto de la persona o sus iniciales con su color personal. */
export function UserAvatar({
  name,
  src,
  color,
  size = "sm",
  className,
}: {
  name: string;
  src: string | null;
  color?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <Avatar size={size} className={className}>
      {src && <Avatar.Image alt={name} src={src} />}
      <Avatar.Fallback style={color ? { background: color, color: "#fff" } : undefined}>{initials(name)}</Avatar.Fallback>
    </Avatar>
  );
}
