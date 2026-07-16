import { useState } from "react";
import { useGetSession, useListConversations, getListConversationsQueryKey, useDeleteConversation } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link as WouterLink } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { History as HistoryIcon, Search, MessageSquare, Trash2, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

export function History() {
  const { data: session } = useGetSession();
  const userId = session?.user?.id;
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const deleteConversation = useDeleteConversation();

  const { data: conversations, isLoading } = useListConversations(
    { userId: userId! },
    { query: { enabled: !!userId, queryKey: getListConversationsQueryKey({ userId: userId! }) } }
  );

  const filteredConversations = conversations?.filter(c => 
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = (id: number) => {
    if (confirm("¿Eliminar esta conversación?")) {
      deleteConversation.mutate(
        { conversationId: id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey({ userId: userId! }) });
            toast({ title: "Conversación eliminada" });
          }
        }
      );
    }
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <HistoryIcon className="h-8 w-8 text-primary" />
              Historial
            </h1>
            <p className="text-muted-foreground mt-2">
              Revisa todas tus consultas y análisis anteriores.
            </p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar conversaciones..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3,4].map(i => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
            </div>
          ) : filteredConversations?.length === 0 ? (
            <div className="text-center py-20 border border-dashed rounded-xl bg-muted/20">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">No se encontraron conversaciones.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredConversations?.map((conv) => (
                <Card key={conv.id} className="group hover:border-primary/50 transition-colors">
                  <CardContent className="p-0">
                    <div className="flex items-center justify-between p-4">
                      <div className="flex items-start gap-4">
                        <div className="h-10 w-10 bg-primary/10 text-primary rounded-full flex items-center justify-center shrink-0">
                          <MessageSquare className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{conv.title}</h3>
                          <div className="flex items-center text-sm text-muted-foreground gap-3 mt-1">
                            <span>{format(new Date(conv.createdAt), "PPP", { locale: es })}</span>
                            <span>•</span>
                            <span>{conv.messageCount} mensajes</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10" onClick={() => handleDelete(conv.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        <WouterLink href={`/chat/${conv.id}`}>
                          <Button variant="secondary" className="gap-2">
                            Ver <ArrowRight className="h-4 w-4" />
                          </Button>
                        </WouterLink>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
