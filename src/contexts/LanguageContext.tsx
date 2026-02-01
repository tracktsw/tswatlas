import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/integrations/supabase/client';
import { supportedLanguages, SupportedLanguage } from '@/i18n';
import { toast } from 'sonner';

interface LanguageContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  isLoading: boolean;
  supportedLanguages: typeof supportedLanguages;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { i18n, t } = useTranslation('common');
  const [language, setLanguageState] = useState<SupportedLanguage>(
    (i18n.language?.substring(0, 2) as SupportedLanguage) || 'en'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Get current user and load their language preference
  useEffect(() => {
    const loadUserLanguage = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setUserId(user.id);
        
        // Fetch user's language preference from database
        const { data: settings } = await supabase
          .from('user_settings')
          .select('language')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (settings?.language) {
          const userLang = settings.language as SupportedLanguage;
          setLanguageState(userLang);
          if (i18n.language !== userLang) {
            await i18n.changeLanguage(userLang);
          }
        }
      }
    };

    loadUserLanguage();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUserId(session.user.id);
        
        // Load language preference for newly signed in user
        const { data: settings } = await supabase
          .from('user_settings')
          .select('language')
          .eq('user_id', session.user.id)
          .maybeSingle();
        
        if (settings?.language) {
          const userLang = settings.language as SupportedLanguage;
          setLanguageState(userLang);
          await i18n.changeLanguage(userLang);
        }
      } else if (event === 'SIGNED_OUT') {
        setUserId(null);
        // Reset to browser default or English
        const browserLang = navigator.language.substring(0, 2) as SupportedLanguage;
        const validLang = supportedLanguages.some(l => l.code === browserLang) ? browserLang : 'en';
        setLanguageState(validLang);
        await i18n.changeLanguage(validLang);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [i18n]);

  const setLanguage = useCallback(async (lang: SupportedLanguage) => {
    setIsLoading(true);
    
    try {
      // Change i18n language
      await i18n.changeLanguage(lang);
      setLanguageState(lang);
      
      // Save to database if user is logged in
      if (userId) {
        const { error } = await supabase
          .from('user_settings')
          .update({ language: lang })
          .eq('user_id', userId);
        
        if (error) {
          console.error('Failed to save language preference:', error);
          // Don't show error toast, the local change still works
        }
      }
      
      // Store in localStorage for persistence
      localStorage.setItem('i18nextLng', lang);
      
      // Find the native name for the toast
      const langInfo = supportedLanguages.find(l => l.code === lang);
      toast.success(t('languageChanged', { language: langInfo?.nativeName || lang }));
    } catch (error) {
      console.error('Failed to change language:', error);
      toast.error(t('languageChangeFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [i18n, userId, t]);

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        isLoading,
        supportedLanguages,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
