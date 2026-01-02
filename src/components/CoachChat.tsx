import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useIOSKeyboard } from '@/hooks/useIOSKeyboard';
import type { ChatMessage } from '@/hooks/useAICoach';

interface CoachChatProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  onClearChat: () => void;
}

const quickSuggestions = [
  { label: "Analyze my week", prompt: "Analyze my check-ins from the past week. What patterns do you see in my mood and skin condition?" },
  { label: "What's helping?", prompt: "Based on my data, which treatments seem to correlate with better skin days?" },
  { label: "Show trends", prompt: "What are the trends in my skin condition and mood over the past 2 weeks?" },
  { label: "Daily summary", prompt: "Give me a brief summary of my most recent check-ins and any notable observations." },
];

export function CoachChat({ messages, isLoading, onSendMessage, onClearChat }: CoachChatProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { keyboardHeight, isIOS } = useIOSKeyboard();

  // Scroll to bottom when messages change or keyboard opens/closes
  useEffect(() => {
    const root = scrollRef.current;
    const viewport = root?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLElement | null;

    if (!viewport) return;

    // Ensure we scroll after the DOM has painted (important on iOS)
    requestAnimationFrame(() => {
      viewport.scrollTop = viewport.scrollHeight;
    });
  }, [messages, isLoading, keyboardHeight]);

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
    <div className="flex flex-col h-full">
      {/* Chat Messages */}
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Your TSW Coach</h3>
            <p className="text-muted-foreground text-sm max-w-xs mb-6">
              I can analyze your check-ins, identify patterns, and provide objective insights about your TSW journey.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {quickSuggestions.map((suggestion) => (
                <Button
                  key={suggestion.label}
                  variant="outline"
                  size="sm"
                  onClick={() => handleSuggestionClick(suggestion.prompt)}
                  className="text-xs"
                >
                  {suggestion.label}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="py-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
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
      </ScrollArea>

      {/* Input Area - add padding for iOS keyboard */}
      <div 
        className="border-t border-border p-4 bg-background"
        style={isIOS && keyboardHeight > 0 ? { paddingBottom: `calc(1rem + ${keyboardHeight}px)` } : undefined}
      >
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
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
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
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          AI Coach provides insights, not medical advice. Consult your healthcare provider for treatment decisions.
        </p>
      </div>
    </div>
  );
}
