import { useState, useRef, useEffect } from "react";
import { Send, Paperclip } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChatInputProps {
  onSendMessage: (content: string) => void;
  isLoading: boolean;
}

export function ChatInput({ onSendMessage, isLoading }: ChatInputProps) {
  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = () => {
    if (!content.trim() || isLoading) return;
    onSendMessage(content.trim());
    setContent("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Auto-resize
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [content]);

  return (
    <div className="relative border rounded-2xl bg-background shadow-sm focus-within:ring-1 focus-within:ring-ring transition-all overflow-hidden flex">
      <Button 
        variant="ghost" 
        size="icon" 
        className="mt-2 ml-2 text-muted-foreground shrink-0 rounded-full hover:bg-muted"
        title="Adjuntar contexto (próximamente)"
      >
        <Paperclip className="h-5 w-5" />
      </Button>
      <Textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Pregunta sobre los datos del negocio..."
        className="min-h-[56px] border-0 focus-visible:ring-0 resize-none py-4 text-base max-h-[120px]"
        rows={1}
      />
      <div className="flex items-end p-2 shrink-0">
        <Button 
          onClick={handleSubmit} 
          disabled={!content.trim() || isLoading}
          size="icon"
          className="rounded-full h-10 w-10 transition-transform active:scale-95 disabled:active:scale-100 disabled:opacity-30"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
