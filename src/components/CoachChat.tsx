import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Capacitor } from '@capacitor/core';
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

const BOTTOM_NAV_HEIGHT = 64; // Your app's bottom navigation height

export function CoachChat({ messages, isLoading, onSendMessage, onClearChat }: CoachChatProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const [keyboardOverlap, setKeyboardOverlap] = useState(0);
  const isAndroid = Capacitor.getPlatform() === 'android';

  // CORRECT Visual Viewport calculation
  useEffect(() => {
    if (!isAndroid || typeof window.visualViewport === 'undefined') {
      console.log('[CoachChat] Visual Viewport not available');
      return;
    }

    const calculateKeyboardOverlap = () => {
      if (!window.visualViewport) return;

      // Visual viewport bottom position
      const vvBottom = window.visualViewport.offsetTop + window.visualViewport.height;
      
      // Layout viewport (window) bottom position
      const layoutBottom = window.innerHeight;
      
      // Keyboard overlap = how much viewport is cut off from bottom
      const overlap = Math.max(0, layoutBottom - vvBottom);

      console.log('[CoachChat] VV bottom:', vvBottom, 'Layout bottom:', layoutBottom, 'Overlap:', overlap);
      
      setKeyboardOverlap(overlap);
    };

    // Listen for viewport changes (passive for scroll performance)
    window.visualViewport.addEventListener('resize', calculateKeyboardOverlap, { passive: true });
    window.visualViewport.addEventListener('scroll', calculateKeyboardOverlap, { passive: true });
    
    // Initial calculation
    calculateKeyboardOverlap();

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', calculateKeyboardOverlap);
        window.visualViewport.removeEventListener('scroll', calculateKeyboardOverlap);
      }
    };
  }, [isAndroid]);

  // Scroll to bottom when messages change
  useEffect(() => {
    const root = scrollRef.current;
    const viewport = root?.querySelector(
      '[data-radix-scroll-area-viewport]'
    ) as HTMLElement | null;

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

  // Calculate input bar bottom position
  // When keyboard closed: sit above bottom nav with buffer
  // When keyboard open: sit at max(keyboardOverlap, bottomNavHeight + buffer) to avoid both
  const calculateBottom = () => {
    if (!isAndroid) {
      return BOTTOM_NAV_HEIGHT + 16; // iOS or web - add 16px buffer
    }

    if (keyboardOverlap > 0) {
      // Keyboard open: use the larger of overlap or (nav height + buffer)
      // This ensures input sits above BOTH keyboard and nav bar
      return Math.max(keyboardOverlap, BOTTOM_NAV_HEIGHT + 16);
    } else {
      // Keyboard closed: sit above nav bar with buffer
      return BOTTOM_NAV_HEIGHT + 16;
    }
  };

  const bottomPosition = calculateBottom();

  return (
    <div className="flex flex-col h-full">
      {/* Chat Messages */}
      <ScrollArea 
        className="flex-1 px-4" 
        ref={scrollRef}
        style={{
          paddingBottom: `${bottomPosition + 120}px`,
        }}
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
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

      {/* Input Area - Position using calculated bottom */}
      <div 
        ref={inputContainerRef}
        className="fixed left-0 right-0 border-t border-border p-4 bg-background"
        style={{
          bottom: `${bottomPosition}px`,
          zIndex: 50,
          transition: 'bottom 0.2s ease-out',
        }}
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
      </div>
    </div>
  );
}