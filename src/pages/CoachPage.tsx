import { Sparkles, Heart } from 'lucide-react';
import { CoachChat } from '@/components/CoachChat';
import { useAICoach } from '@/hooks/useAICoach';
import PaywallGuard from '@/components/PaywallGuard';
import { SparkleIllustration, HeartIllustration } from '@/components/illustrations';

const CoachPage = () => {
  const { messages, isLoading, sendMessage, clearChat } = useAICoach();

  return (
    <PaywallGuard feature="AI Coach">
    <div className="flex flex-col h-full relative">
      {/* Decorative elements */}
      <div className="decorative-blob w-32 h-32 bg-coral/20 -top-10 -right-10 fixed" />
      <div className="decorative-blob w-40 h-40 bg-primary/15 bottom-40 -left-16 fixed" />
      
      {/* Decorative illustrations */}
      <SparkleIllustration variant="cluster" className="w-20 h-20 fixed top-[calc(env(safe-area-inset-top,0px)+4rem)] right-2 opacity-25 pointer-events-none" />
      <HeartIllustration variant="floating" className="w-14 h-18 fixed bottom-48 left-0 opacity-20 pointer-events-none" />
      
      {/* Header */}
      <div className="px-4 py-4 border-b border-border/60 bg-card/50 backdrop-blur-sm">
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
