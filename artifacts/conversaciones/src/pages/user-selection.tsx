import { useListUsers, useSetSession } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetSessionQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldAlert, UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function UserSelection() {
  const { data: users, isLoading, error } = useListUsers();
  const setSession = useSetSession();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const handleSelectUser = (userId: number) => {
    setSession.mutate(
      { data: { userId } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSessionQueryKey() });
          setLocation("/chat");
        }
      }
    );
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary mb-4 shadow-lg shadow-primary/20">
            <span className="font-bold text-2xl text-primary-foreground tracking-tighter">C</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">CONVERSACIONES</h1>
          <p className="text-muted-foreground">Plataforma de Inteligencia Conversacional</p>
        </div>

        <Card className="border-border shadow-xl">
          <CardHeader>
            <CardTitle>Selecciona tu cuenta</CardTitle>
            <CardDescription>Para fines del MVP, elige con quién deseas iniciar sesión.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : error ? (
              <div className="text-center text-destructive p-4 bg-destructive/10 rounded-lg">
                <ShieldAlert className="h-8 w-8 mx-auto mb-2 opacity-80" />
                <p>No se pudieron cargar los usuarios. Verifica que el backend esté ejecutándose.</p>
              </div>
            ) : users?.length === 0 ? (
              <div className="text-center text-muted-foreground p-4">
                No hay usuarios registrados.
              </div>
            ) : (
              <div className="grid gap-3">
                {users?.map(user => (
                  <button
                    key={user.id}
                    onClick={() => handleSelectUser(user.id)}
                    className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-accent hover:border-primary/50 transition-all text-left focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
                  >
                    <Avatar className="h-10 w-10 border bg-background">
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {user.name.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 overflow-hidden">
                      <div className="font-medium text-foreground truncate flex items-center gap-2">
                        {user.name}
                        {user.role === 'admin' && (
                          <span className="text-[10px] uppercase font-bold tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded">Admin</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
