import { Link, useLocation } from "@tanstack/react-router";
import { Home, Search, Camera, Scale, Settings } from "lucide-react";

const items: ReadonlyArray<{ to: "/app" | "/search" | "/photo" | "/weight" | "/settings"; label: string; Icon: typeof Home; primary?: boolean }> = [
  { to: "/app", label: "Hoje", Icon: Home },
  { to: "/search", label: "Buscar", Icon: Search },
  { to: "/photo", label: "Foto", Icon: Camera, primary: true },
  { to: "/weight", label: "Peso", Icon: Scale },
  { to: "/settings", label: "Perfil", Icon: Settings },
];

export function BottomNav() {
  const { pathname } = useLocation();
  return (
    <nav className="fixed bottom-0 inset-x-0 z-20 border-t border-border bg-background/95 backdrop-blur">
      <ul className="max-w-2xl mx-auto grid grid-cols-5">
        {items.map(({ to, label, Icon, primary }) => {
          const active = pathname === to;
          return (
            <li key={to}>
              <Link
                to={to}
                className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] transition-colors ${
                  primary
                    ? "text-primary"
                    : active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className={`flex items-center justify-center ${
                    primary
                      ? "w-10 h-10 rounded-full bg-gradient-primary shadow-glow -mt-5 mb-0.5"
                      : ""
                  }`}
                >
                  <Icon
                    className={`${primary ? "w-5 h-5 text-primary-foreground" : "w-5 h-5"}`}
                  />
                </span>
                <span className={primary ? "sr-only" : ""}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
