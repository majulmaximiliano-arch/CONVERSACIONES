import { useState } from "react";
import { Link as WouterLink, useLocation } from "wouter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useGetSession, useClearSession } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetSessionQueryKey } from "@workspace/api-client-react";
import {
  Database, Settings, LogOut, MessageSquare, History, Users,
  FolderOpen, Building2, ClipboardList, ChevronLeft, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_SIDEBAR_KEY = "conversaciones:nav-open";

export function Sidebar() {
  const [location, setLocation] = useLocation();
  const { data: session } = useGetSession();
  const clearSession = useClearSession();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(NAV_SIDEBAR_KEY);
      if (stored !== null) return stored === "true";
    } catch {}
    return true;
  });

  const toggleSidebar = () => {
    setIsOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem(NAV_SIDEBAR_KEY, String(next)); } catch {}
      return next;
    });
  };

  const handleLogout = () => {
    clearSession.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey() });
        setLocation("/");
      }
    });
  };

  if (!session?.user) return null;

  const isAdmin = session.user.role === "admin";

  const navItems = [
    { icon: MessageSquare, label: "Conversaciones", href: "/chat", match: "/chat" },
    { icon: Database, label: "Centro de Datos", href: "/data-center", match: "/data-center" },
    { icon: History, label: "Historial", href: "/history", match: "/history" },
    { icon: ClipboardList, label: "Checklist Mensual", href: "/checklist", match: "/checklist" },
  ];

  if (isAdmin) {
    navItems.push({ icon: Building2, label: "Marcas", href: "/admin/marcas", match: "/admin/marcas" });
    navItems.push({ icon: FolderOpen, label: "Carpetas", href: "/admin/folders", match: "/admin/folders" });
    navItems.push({ icon: Users, label: "Usuarios", href: "/admin/users", match: "/admin/users" });
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className={cn(
          "relative border-r bg-sidebar flex flex-col h-[100dvh] flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden",
          isOpen ? "w-64" : "w-14"
        )}
      >
        {/* Header */}
        <div className={cn(
          "border-b flex items-center gap-2 flex-shrink-0",
          isOpen ? "p-4" : "p-3 justify-center"
        )}>
          <div className="h-8 w-8 bg-primary rounded flex items-center justify-center shrink-0">
            <MessageSquare className="h-5 w-5 text-primary-foreground" />
          </div>
          {isOpen && (
            <span className="font-bold text-lg tracking-tight whitespace-nowrap overflow-hidden">
              CONVERSACIONES
            </span>
          )}
        </div>

        {/* Nav items */}
        <div className={cn(
          "flex-1 py-4 space-y-1 overflow-y-auto",
          isOpen ? "px-2" : "px-1.5"
        )}>
          {navItems.map((item) => {
            const isActive =
              location === item.href ||
              (item.match !== "/" && location.startsWith(item.match));

            if (isOpen) {
              return (
                <WouterLink
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </WouterLink>
              );
            }

            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <WouterLink
                    href={item.href}
                    className={cn(
                      "flex items-center justify-center h-9 w-9 mx-auto rounded-md transition-colors",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                  </WouterLink>
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Footer */}
        <div className={cn(
          "border-t space-y-2 flex-shrink-0",
          isOpen ? "p-4" : "p-2"
        )}>
          {isOpen ? (
            <>
              <WouterLink
                href="/settings"
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
              >
                <Settings className="h-4 w-4" />
                Configuración
              </WouterLink>
              <div className="flex items-center gap-3 px-3">
                <Avatar className="h-8 w-8 border shrink-0">
                  <AvatarFallback>{session.user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <p className="text-sm font-medium truncate">{session.user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handleLogout}
                  title="Cerrar sesión"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <WouterLink
                    href="/settings"
                    className="flex items-center justify-center h-9 w-9 rounded-md text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
                  >
                    <Settings className="h-4 w-4" />
                  </WouterLink>
                </TooltipTrigger>
                <TooltipContent side="right">Configuración</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleLogout}
                    className="flex items-center justify-center h-9 w-9 rounded-md text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Cerrar sesión</TooltipContent>
              </Tooltip>
            </div>
          )}
        </div>

        {/* Toggle button on the right edge */}
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 h-6 w-6 rounded-full border bg-background shadow-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title={isOpen ? "Cerrar menú" : "Abrir menú"}
        >
          {isOpen
            ? <ChevronLeft className="h-3.5 w-3.5" />
            : <ChevronRight className="h-3.5 w-3.5" />
          }
        </button>
      </div>
    </TooltipProvider>
  );
}

export function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-[100dvh] w-full bg-background overflow-hidden">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        {children}
      </main>
    </div>
  );
}
