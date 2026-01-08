import { Sparkles } from 'lucide-react';
import { CoachChat } from '@/components/CoachChat';
import { useAICoach } from '@/hooks/useAICoach';
import PaywallGuard from '@/components/PaywallGuard';
import { SparkleIllustration, HeartIllustration } from '@/components/illustrations';
import { Capacitor } from '@capacitor/core';

const CoachPage = () => {
  const { messages, isLoading, sendMessage, clearChat } = useAICoach();
  const platform = Capacitor.getPlatform();

  return (
    <PaywallGuard feature="AI Coach">
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div 
        className="px-4 border-b border-border/60 bg-card/50 backdrop-blur-sm shrink-0"
        style={platform === 'android' ? { paddingTop: '20px', paddingBottom: '16px' } : { paddingTop: '16px', paddingBottom: '16px' }}
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

      {/* Chat Area */}
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