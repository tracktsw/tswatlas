import { Sparkles } from 'lucide-react';
import { CoachChat } from '@/components/CoachChat';
import { useAICoach } from '@/hooks/useAICoach';

const CoachPage = () => {
  const { messages, isLoading, sendMessage, clearChat } = useAICoach();

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="font-semibold text-base">AI Coach</h1>
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
  );
};

export default CoachPage;
