// CoachChat.tsx (input bar updated for safe-bottom + nav height)
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
  { label: 'Analyze my week', prompt: 'Analyze my check-ins...eek. What patterns do you see in my mood and skin condition?' },
  { label: "What's helping?", prompt: 'Based on my data, which treatments seem to correlate with better skin days?' },
  { label: 'Show trends', prompt: 'What are the trends in my skin condition and mood over the past 2 weeks?' },
  { label: 'Daily summary', prompt: 'Give me a brief summary of my most recent check-ins and any notable observations.' },
];

const BOTTOM_NAV_CONTENT_HEIGHT = 64; // content height only; safe-bottom added dynamically

const getCssPxVar = (name: string) => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
};

export function CoachChat({ messages, isLoading, onSendMessage, onClearChat }: CoachChatProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [keyboardOverlap, setKeyboardOverlap] = useState(0);
  const platform = Capacitor.getPlatform();
  const isAndroid = platform === 'android';

  useEffect(() => {
    if (!isAndroid || typeof window.visualViewport === 'undefined') return;

    const calculateKeyboardOverlap = () => {
      if (!window.visualViewport) return;

      const vv = window.visualViewport;
      const vvBottom = vv.offsetTop + vv.height;
      const layoutBottom = window.innerHeight;
      const rawOverlap = Math.max(0, layoutBottom - vvBottom);

      // Android 15+ edge-to-edge can report a non-zero offset even with no keyboard.
      // Treat it as "keyboard" only when the viewport shrinks meaningfully.
      const heightDelta = Math.max(0, window.innerHeight - vv.height);
      const isKeyboardLikelyOpen = heightDelta > 120;

      setKeyboardOverlap(isKeyboardLikelyOpen ? rawOverlap : 0);
    };

    window.visualViewport.addEventListener('resize', calculateKeyboardOverlap, { passive: true });
    window.visualViewport.addEventListener('scroll', calculateKeyboardOverlap, { passive: true });

    calculateKeyboardOverlap();

    return () => {
      window.visualViewport?.removeEventListener('resize', calculateKeyboardOverlap);
      window.visualViewport?.removeEventListener('scroll', calculateKeyboardOverlap);
    };
  }, [isAndroid]);

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

  // For keyboard, we need to lift the input bar above it
  const getKeyboardOffset = () => {
    if (!isAndroid || keyboardOverlap <= 0) return 0;
    // When keyboard is open, we need to offset by keyboard minus nav bar (since nav hides)
    const safeBottom = getCssPxVar('--safe-bottom');
    const navHeight = BOTTOM_NAV_CONTENT_HEIGHT + safeBottom;
    return Math.max(0, keyboardOverlap - navHeight);
  };

  // Calculate bottom spacing for input bar
  const getInputBottomSpacing = () => {
    if (!isAndroid) return 0;

    const keyboardOffset = getKeyboardOffset();
    if (keyboardOffset > 0) {
      // Keyboard is open, use keyboard offset
      return keyboardOffset;
    } else {
      // Keyboard is closed, add space for nav bar
      const safeBottom = getCssPxVar('--safe-bottom');
      const navHeight = BOTTOM_NAV_CONTENT_HEIGHT + safeBottom;
      return navHeight;
    }
  };

  const inputBottomSpacing = getInputBottomSpacing();

  return (
    <div
      className={cn(
        "flex flex-col flex-1 min-h-0 bg-background overflow-hidden",
        isAndroid && "android-flex-fill"
      )}
      style={{ overscrollBehavior: 'contain' }}
    >
      {/* Scrollable chat area */}
      <ScrollArea
        className="flex-1 min-h-0 px-4 bg-background"
        ref={scrollRef}
        style={{ overscrollBehavior: 'contain' }}
      >
        <div style={{ paddingBottom: '16px' }}>
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

      {/* Input Area - positioned at bottom of this flex container */}
      <div
        className="shrink-0 border-t border-border p-4 bg-background"
        style={{
          // Add bottom spacing for nav bar or keyboard on Android
          marginBottom: isAndroid && inputBottomSpacing > 0 ? `${inputBottomSpacing}px` : undefined,
          transition: 'margin-bottom 0.2s ease-out',
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
          <Button type="submit" size="icon" disabled={!input.trim() || isLoading} className="shrink-0">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </form>
      </div>
    </div>
  );
}