import { Message } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";
import { ChartRenderer } from "./chart-renderer";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("flex max-w-[85%] gap-4", isUser ? "flex-row-reverse" : "flex-row")}>
        <div className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full mt-1",
          isUser ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground border"
        )}>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-primary" />}
        </div>
        
        <div className="flex flex-col gap-2 min-w-0">
          <div className={cn(
            "px-5 py-3.5 text-[15px] leading-relaxed",
            isUser 
              ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm shadow-sm" 
              : "bg-card border text-card-foreground rounded-2xl rounded-tl-sm shadow-sm"
          )}>
            <div className="whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: formatMessageContent(message.content) }} />
          </div>

          {!isUser && message.chartData && (
            <div className="w-full max-w-2xl animate-in fade-in slide-in-from-bottom-2 duration-500">
              <ChartRenderer data={message.chartData} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Simple formatter to bold text between asterisks or markdown bold
function formatMessageContent(content: string) {
  // Replace **bold** with <strong>bold</strong>
  let formatted = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // Handle lists briefly
  formatted = formatted.replace(/^- (.*)$/gm, '<li class="ml-4 list-disc">$1</li>');
  return formatted;
}
