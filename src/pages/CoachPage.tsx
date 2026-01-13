// CoachPage.tsx
import { useEffect } from 'react';
import { Sparkles } from 'lucide-react';
import { CoachChat } from '@/components/CoachChat';
import { useAICoach } from '@/hooks/useAICoach';
import PaywallGuard from '@/components/PaywallGuard';
import { Capacitor } from '@capacitor/core';
import { cn } from '@/lib/utils';

const CoachPage = () => {
  const { messages, isLoading, sendMessage, clearChat } = useAICoach();
  const platform = Capacitor.getPlatform();
  const isAndroid = platform === 'android';

  // Android WebView: hard-lock document scrolling while this page is mounted.
  // Uses the "body position: fixed" technique so the chat input never gets pushed off-screen.
  useEffect(() => {
    if (!isAndroid) return;

    const scrollY = window.scrollY;

    const prev = {
      position: document.body.style.position,
      top: document.body.style.top,
      left: document.body.style.left,
      right: document.body.style.right,
      width: document.body.style.width,
      overflow: document.body.style.overflow,
    };

    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = '0';
    document.body.style.right = '0';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.position = prev.position;
      document.body.style.top = prev.top;
      document.body.style.left = prev.left;
      document.body.style.right = prev.right;
      document.body.style.width = prev.width;
      document.body.style.overflow = prev.overflow;

      window.scrollTo(0, scrollY);
    };
  }, [isAndroid]);

  return (
    <PaywallGuard feature="AI Coach">
      <div 
        className={cn(
          "flex flex-col h-full relative bg-background overflow-hidden",
          isAndroid && "android-page-height"
        )}
        style={{ 
          overscrollBehavior: 'none',
          touchAction: 'pan-x pan-y',
        }}
      >
        {/* Header - fixed, never scrolls */}
        <div
          className="px-4 border-b border-border/60 bg-card/50 backdrop-blur-sm shrink-0 z-10"
          style={{
            paddingTop:
              platform === 'ios'
                ? 'calc(var(--safe-top, 0px) + 2px)'
                : 'calc(var(--safe-top, 0px) + 8px)',
            paddingBottom: '12px',
            touchAction: 'none',
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-coral/20 to-coral-light flex items-center justify-center shadow-warm-sm">
              <Sparkles className="w-5 h-5 text-coral" />
            </div>
            <div>
              <h1 className="font-display font-bold text-lg text-foreground">AI Coach</h1>
              <p className="text-xs text-muted-foreground">Objective insights from your data</p>
            </div>
          </div>
        </div>

        {/* Chat Area - this is the only scrollable section */}
        <CoachChat
          messages={messages}
          isLoading={isLoading}
          onSendMessage={sendMessage}
          onClearChat={clearChat}
        />
      </div>
    </PaywallGuard>
  );
};

export default CoachPage;