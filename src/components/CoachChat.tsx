// CoachChat.tsx - Simple flex layout for both iOS and Android
import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AndroidSafeTextarea } from '@/components/ui/android-safe-textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/hooks/useAICoach';

interface CoachChatProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  onClearChat: () => void;
}

const quickSuggestions = [
  { label: 'Analyze my week', prompt: 'Analyze my check-ins from this week. What patterns do you see in my mood and skin condition?' },
  { label: "What's helping?", prompt: 'Based on my data, which treatments seem to correlate with better skin days?' },
  { label: 'Show trends', prompt: 'What are the trends in my skin condition and mood over the past 2 weeks?' },
  { label: 'Daily summary', prompt: 'Give me a brief summary of my most recent check-ins and any notable observations.' },
];

export function CoachChat({ messages, isLoading, onSendMessage, onClearChat }: CoachChatProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const root = scrollRef.current;
    const viewport = root?.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    if (!viewport) return;

    requestAnimationFrame(() => {
      viewport.scrollTop = viewport.scrollHeight;
    });
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSendMessage(input.trim());
    setInput('');
  };

  const handleSuggestionClick = (prompt: string) => {
    if (isLoading) return;
    onSendMessage(prompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div 
      className="flex flex-col flex-1 min-h-0 bg-background overflow-hidden"
      style={{ overscrollBehavior: 'contain' }}
    >
      {/* Scrollable chat area - flex-1 takes remaining space */}
      <ScrollArea
        className="flex-1 min-h-0 px-4 bg-background"
        ref={scrollRef}
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="pb-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center py-8">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-primary" />
              </div>

              <h2 className="font-display font-semibold text-lg mb-2">Ask your AI Coach</h2>
              <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                Get insights from your check-ins, photos, and trends.
              </p>

              <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
                {quickSuggestions.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => handleSuggestionClick(s.prompt)}
                    className="text-left p-3 rounded-2xl bg-card/70 border border-border/60 hover:bg-card transition-colors"
                  >
                    <div className="text-sm font-semibold">{s.label}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn('flex mb-3', message.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm',
                      message.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted rounded-bl-md'
                    )}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}

              {isLoading && messages[messages.length - 1]?.role === 'user' && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2.5">
                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area - shrink-0 keeps it at natural height, never scrolls */}
      {/* No bottom padding here - Layout's pb-20 already reserves space above BottomNav */}
      <div className="shrink-0 border-t border-border bg-background p-4">
        {messages.length > 0 && (
          <div className="flex justify-end mb-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearChat}
              className="text-xs text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Clear chat
            </Button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex gap-2">
          <AndroidSafeTextarea
            ref={textareaRef}
            value={input}
            onValueChange={setInput}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your TSW journey..."
            className="min-h-[44px] max-h-32 resize-none"
            rows={1}
            disabled={isLoading}
          />
          <Button 
            type="submit" 
            size="icon" 
            disabled={!input.trim() || isLoading} 
            className="shrink-0"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}