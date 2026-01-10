import { useState, useCallback, useEffect } from 'react';
import { useUserData } from '@/contexts/UserDataContext';
import { prepareCoachContext } from '@/utils/prepareCoachContext';
import { useToast } from '@/hooks/use-toast';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface StoredChat {
  messages: ChatMessage[];
  createdAt: number;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-coach`;
const STORAGE_KEY = 'ai-coach-chat';
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

function loadStoredChat(): ChatMessage[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const parsed: StoredChat = JSON.parse(stored);
    const now = Date.now();
    
    // Check if chat has expired
    if (now - parsed.createdAt > EXPIRY_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
    
    return parsed.messages;
  } catch {
    return [];
  }
}

function saveChat(messages: ChatMessage[]) {
  if (messages.length === 0) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  
  // Get existing timestamp or create new one
  let createdAt = Date.now();
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed: StoredChat = JSON.parse(stored);
      createdAt = parsed.createdAt; // Preserve original timestamp
    }
  } catch {
    // Use new timestamp
  }
  
  const data: StoredChat = { messages, createdAt };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useAICoach() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadStoredChat());
  const [isLoading, setIsLoading] = useState(false);
  const { checkIns, journalEntries, photos, tswStartDate } = useUserData();
  const { toast } = useToast();

  // Persist messages whenever they change
  useEffect(() => {
    saveChat(messages);
  }, [messages]);

  const sendMessage = useCallback(async (input: string) => {
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Prepare user data context
    const userData = prepareCoachContext(checkIns, journalEntries, photos, tswStartDate);

    // Build message history for API
    const apiMessages = [...messages, userMessage].map(m => ({
      role: m.role,
      content: m.content,
    }));

    let assistantContent = '';

    try {
      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: apiMessages, userData }),
      });

      if (!response.ok || !response.body) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to connect to AI Coach');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';

      const upsertAssistant = (nextChunk: string) => {
        assistantContent += nextChunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant') {
            return prev.map((m, i) => 
              i === prev.length - 1 ? { ...m, content: assistantContent } : m
            );
          }
          return [...prev, { id: crypto.randomUUID(), role: 'assistant', content: assistantContent }];
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') break;

          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) upsertAssistant(content);
          } catch { /* ignore */ }
        }
      }
    } catch (error) {
      console.error('AI Coach error:', error);
      toast({
        variant: 'destructive',
        title: 'Connection Error',
        description: error instanceof Error ? error.message : 'Failed to connect to AI Coach',
      });
      // Remove the user message if we failed
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
    } finally {
      setIsLoading(false);
    }
  }, [messages, checkIns, journalEntries, photos, tswStartDate, toast]);

  const clearChat = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearChat,
  };
}
