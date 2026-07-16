import { useState, useRef, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { MessageSquarePlus, MessageSquare, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGetSession, useListConversations, useCreateConversation, getListConversationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function ChatSidebar() {
  const { data: session } = useGetSession();
  const userId = session?.user?.id;
  const [location, setLocation] = useLocation();
  const { id: conversationId } = useParams();
  
  const { data: conversations, isLoading } = useListConversations(
    { userId: userId! },
    { query: { enabled: !!userId, queryKey: getListConversationsQueryKey({ userId: userId! }) } }
  );

  const createConversation = useCreateConversation();
  const queryClient = useQueryClient();

  const handleNewConversation = () => {
    if (!userId) return;
    createConversation.mutate(
      { data: { userId, title: "Nueva conversación" } },
      {
        onSuccess: (newConv) => {
          queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey({ userId }) });
          setLocation(`/chat/${newConv.id}`);
        }
      }
    );
  };

  return (
    <div className="w-72 border-r bg-card/50 flex flex-col h-full flex-shrink-0">
      <div className="p-4">
        <Button 
          onClick={handleNewConversation} 
          disabled={createConversation.isPending}
          className="w-full justify-start gap-2 h-10 shadow-sm"
        >
          <PlusCircle className="h-4 w-4" />
          Nueva Conversación
        </Button>
      </div>
      
      <div className="px-4 pb-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Historial Reciente</h3>
      </div>

      <ScrollArea className="flex-1 px-2">
        <div className="space-y-1 pb-4">
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Cargando...</div>
          ) : conversations?.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No tienes conversaciones aún.
            </div>
          ) : (
            conversations?.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setLocation(`/chat/${conv.id}`)}
                className={cn(
                  "w-full flex flex-col items-start px-3 py-2.5 rounded-lg text-left transition-colors",
                  Number(conversationId) === conv.id 
                    ? "bg-accent text-accent-foreground font-medium" 
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2 w-full">
                  <MessageSquare className="h-4 w-4 shrink-0 opacity-70" />
                  <span className="truncate text-sm flex-1">{conv.title}</span>
                </div>
                <span className="text-[10px] ml-6 opacity-60 mt-1">
                  {format(new Date(conv.updatedAt), "d MMM, HH:mm", { locale: es })}
                </span>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
