import { buttonVariants } from "@repo/ui/components/ui/button";
import { Link } from "@tanstack/react-router";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/settings", label: "Settings" },
] as const;

export function AppNav({ currentPath }: { currentPath: string }) {
  return (
    <nav className="flex w-full max-w-4xl items-center gap-1" aria-label="Main">
      {links.map((link) => {
        const active = currentPath === link.to;
        return (
          <Link
            key={link.to}
            to={link.to}
            className={`${buttonVariants({
              variant: active ? "secondary" : "ghost",
              size: "sm",
            })}${active ? " pointer-events-none" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
