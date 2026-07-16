import { Link as WouterLink, useLocation } from "wouter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useGetSession, useClearSession } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetSessionQueryKey } from "@workspace/api-client-react";
import { Database, Settings, LogOut, MessageSquare, History, Users, FolderOpen, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Sidebar() {
  const [location, setLocation] = useLocation();
  const { data: session } = useGetSession();
  const clearSession = useClearSession();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    clearSession.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey() });
        setLocation("/");
      }
    });
  };

  if (!session?.user) return null;

  const isAdmin = session.user.role === 'admin';

  const navItems = [
    { icon: MessageSquare, label: "Conversaciones", href: "/chat", match: "/chat" },
    { icon: Database, label: "Centro de Datos", href: "/data-center", match: "/data-center" },
    { icon: History, label: "Historial", href: "/history", match: "/history" },
  ];

  if (isAdmin) {
    navItems.push({ icon: Building2, label: "Marcas", href: "/admin/marcas", match: "/admin/marcas" });
    navItems.push({ icon: FolderOpen, label: "Carpetas", href: "/admin/folders", match: "/admin/folders" });
    navItems.push({ icon: Users, label: "Usuarios", href: "/admin/users", match: "/admin/users" });
  }

  return (
    <div className="w-64 border-r bg-sidebar flex flex-col h-[100dvh]">
      <div className="p-4 border-b flex items-center gap-2">
        <div className="h-8 w-8 bg-primary rounded flex items-center justify-center">
          <MessageSquare className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="font-bold text-lg tracking-tight">CONVERSACIONES</span>
      </div>

      <div className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = location === item.href || (item.match !== '/' && location.startsWith(item.match));
          return (
            <WouterLink key={item.href} href={item.href} className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
            )}>
              <item.icon className="h-4 w-4" />
              {item.label}
            </WouterLink>
          );
        })}
      </div>

      <div className="p-4 border-t space-y-4">
        <WouterLink href="/settings" className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors">
          <Settings className="h-4 w-4" />
          Configuración
        </WouterLink>
        <div className="flex items-center gap-3 px-3">
          <Avatar className="h-8 w-8 border">
            <AvatarFallback>{session.user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate">{session.user.name}</p>
            <p className="text-xs text-muted-foreground truncate">{session.user.email}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleLogout} title="Cerrar sesión">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
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
