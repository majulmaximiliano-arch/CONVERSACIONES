import { useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { 
  useGetSession, 
  useGetConversation, 
  useSendMessage, 
  getGetConversationQueryKey,
  getListConversationsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ChatSidebar } from "@/components/chat/chat-sidebar";
import { ChatInput } from "@/components/chat/chat-input";
import { MessageBubble } from "@/components/chat/message-bubble";
import { InsightPanel } from "@/components/chat/insight-panel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2 } from "lucide-react";

export function ChatDetail() {
  const { id } = useParams();
  const conversationId = Number(id);
  const { data: session } = useGetSession();
  const userId = session?.user?.id;
  
  const queryClient = useQueryClient();
  const sendMessage = useSendMessage();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: conversation, isLoading } = useGetConversation(
    conversationId,
    { query: { enabled: !!conversationId, queryKey: getGetConversationQueryKey(conversationId) } }
  );

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [conversation?.messages, sendMessage.isPending]);

  const handleSendMessage = (content: string) => {
    if (!userId || !conversationId) return;
    
    sendMessage.mutate(
      { conversationId, data: { content } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetConversationQueryKey(conversationId) });
          queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey({ userId }) });
        }
      }
    );
  };

  const messages = conversation?.messages || [];
  const lastAssistantMessage = [...messages].reverse().find(m => m.role === 'assistant');

  return (
    <div className="flex h-full w-full">
      <ChatSidebar />
      
      <div className="flex-1 flex flex-col min-w-0 bg-background relative">
        <div className="flex-1 overflow-y-auto" ref={scrollRef}>
          <div className="max-w-4xl mx-auto w-full p-4 sm:p-6 space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
                <Loader2 className="h-5 w-5 animate-spin" /> Cargando mensajes...
              </div>
            ) : messages.length === 0 ? (
              <div className="py-20 text-center text-muted-foreground">
                <p>Escribe un mensaje para comenzar el análisis.</p>
              </div>
            ) : (
              messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))
            )}
            
            {sendMessage.isPending && (
              <div className="flex justify-start">
                <div className="flex max-w-[85%] gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground border mt-1">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  </div>
                  <div className="px-5 py-3.5 bg-card border text-card-foreground rounded-2xl rounded-tl-sm shadow-sm flex items-center h-10">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                      <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce"></span>
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Spacer for bottom padding */}
            <div className="h-4"></div>
          </div>
        </div>
        
        <div className="p-4 bg-gradient-to-t from-background via-background to-transparent pt-8 shrink-0">
          <div className="max-w-4xl mx-auto w-full">
            <ChatInput onSendMessage={handleSendMessage} isLoading={sendMessage.isPending} />
            <div className="text-center mt-2 text-[10px] text-muted-foreground">
              CONVERSACIONES puede cometer errores. Verifica los datos importantes.
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel for Insights */}
      <div className="w-80 border-l bg-muted/10 hidden lg:block overflow-y-auto flex-shrink-0">
        <InsightPanel 
          kpis={lastAssistantMessage?.kpis}
          insights={lastAssistantMessage?.insights}
          filesConsulted={lastAssistantMessage?.filesConsulted}
        />
      </div>
    </div>
  );
}
