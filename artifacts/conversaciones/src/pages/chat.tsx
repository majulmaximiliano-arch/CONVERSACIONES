import { useGetSession, useGetDashboardOverview, getGetDashboardOverviewQueryKey } from "@workspace/api-client-react";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { Bot, LineChart, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export function ChatList() {
  const { data: session } = useGetSession();
  const userId = session?.user?.id;
  const [, setLocation] = useLocation();

  const { data: dashboard, isLoading } = useGetDashboardOverview(
    { userId: userId! },
    { query: { enabled: !!userId, queryKey: getGetDashboardOverviewQueryKey({ userId: userId! }) } }
  );

  return (
    <div className="flex h-full w-full">
      <ChatSidebar />
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-muted/10">
        <div className="max-w-md space-y-6">
          <div className="h-20 w-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto text-primary shadow-sm border border-primary/20">
            <Bot className="h-10 w-10" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Bienvenido a CONVERSACIONES</h2>
          <p className="text-muted-foreground">
            Soy tu analista de negocios. Selecciona una conversación reciente, o inicia una nueva para explorar tus datos.
          </p>
          
          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="p-4 border bg-card rounded-xl text-left shadow-sm">
              <FileSpreadsheet className="h-5 w-5 text-primary mb-2" />
              <div className="text-2xl font-bold">{dashboard?.totalFiles ?? '-'}</div>
              <div className="text-xs text-muted-foreground">Archivos indexados</div>
            </div>
            <div className="p-4 border bg-card rounded-xl text-left shadow-sm">
              <LineChart className="h-5 w-5 text-primary mb-2" />
              <div className="text-2xl font-bold">{dashboard?.totalConversations ?? '-'}</div>
              <div className="text-xs text-muted-foreground">Consultas realizadas</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
