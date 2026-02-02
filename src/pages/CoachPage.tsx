// CoachPage.tsx
import { Brain } from 'lucide-react';
import { CoachChat } from '@/components/CoachChat';
import { useAICoach } from '@/hooks/useAICoach';
import PaywallGuard from '@/components/PaywallGuard';
import { Capacitor } from '@capacitor/core';

const CoachPage = () => {
  const { messages, isLoading, sendMessage, clearChat } = useAICoach();
  const platform = Capacitor.getPlatform();

  return (
    <PaywallGuard feature="AI Coach">
      <div 
        className="flex flex-col h-full relative bg-background overflow-hidden"
        style={{ overscrollBehavior: 'none' }}
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
              <Brain className="w-5 h-5 text-coral" />
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