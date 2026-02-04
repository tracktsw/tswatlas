import { useState, useEffect, useRef } from 'react';
import { Mail, Lock, Heart, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { AndroidSafeInput } from '@/components/ui/android-safe-input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import trackTswLogo from '@/assets/tracktsw-logo-transparent.png';
import { usePlatform } from '@/hooks/usePlatform';
import { useOnboardingSubmit } from '@/hooks/useOnboardingSubmit';
import { hasPendingOnboardingSurvey, sendPendingOnboardingSurvey, identifyUser } from '@/utils/analytics';
import { trackMetaOnboardingComplete } from '@/utils/metaAnalytics';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { scheduleCheckInReminders } from '@/utils/notificationScheduler';


type AuthMode = 'login' | 'signup' | 'forgot';

const AuthPage = () => {
  const [searchParams] = useSearchParams();
  const initialMode = (searchParams.get('mode') as AuthMode) || 'login';
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [authError, setAuthError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  const { isAndroid } = usePlatform();
  const { submitOnboardingData, hasPendingOnboardingData } = useOnboardingSubmit();

  // Refs for inputs
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmPasswordRef = useRef<HTMLInputElement>(null);

  // Common valid email domains
  const validDomains = [
    'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com',
    'aol.com', 'protonmail.com', 'mail.com', 'zoho.com', 'yandex.com',
    'live.com', 'msn.com', 'me.com', 'mac.com', 'googlemail.com',
    'fastmail.com', 'tutanota.com', 'hey.com', 'pm.me'
  ];

  // Valid TLDs (top-level domains)
  const validTLDs = [
    'com', 'org', 'net', 'edu', 'gov', 'io', 'co', 'uk', 'de', 'fr', 'es',
    'it', 'nl', 'be', 'at', 'ch', 'au', 'ca', 'us', 'info', 'biz', 'app',
    'dev', 'tech', 'online', 'store', 'shop', 'blog', 'site', 'xyz', 'me',
    'tv', 'cc', 'in', 'jp', 'cn', 'ru', 'br', 'mx', 'pl', 'se', 'no', 'fi',
    'dk', 'nz', 'ie', 'pt', 'cz', 'hu', 'ro', 'gr', 'za', 'sg', 'hk', 'tw',
    'kr', 'my', 'ph', 'id', 'th', 'vn', 'ae', 'sa', 'il', 'eg', 'ng', 'ke',
    'co.uk', 'co.nz', 'co.za', 'com.au', 'com.br', 'com.mx', 'org.uk', 'net.au'
  ];

  // Email validation: exactly one @, at least one . after @, valid domain
  const validateEmail = (email: string): boolean => {
    const trimmed = email.trim().toLowerCase();
    const atIndex = trimmed.indexOf('@');
    const lastAtIndex = trimmed.lastIndexOf('@');
    
    // Must have exactly one @
    if (atIndex === -1 || atIndex !== lastAtIndex) return false;
    
    const domain = trimmed.slice(atIndex + 1);
    
    // Domain must have at least one .
    const dotIndex = domain.indexOf('.');
    if (dotIndex === -1) return false;
    
    // Domain can't start or end with .
    if (domain.startsWith('.') || domain.endsWith('.')) return false;
    
    // Must have content before @ and valid domain parts
    const local = trimmed.slice(0, atIndex);
    if (local.length === 0) return false;
    
    // Domain must have content after last dot
    const lastDot = domain.lastIndexOf('.');
    const tld = domain.slice(lastDot + 1);
    if (tld.length === 0) return false;
    
    // Check if it's a known valid domain first
    if (validDomains.includes(domain)) return true;
    
    // Check for compound TLDs first (like co.uk, com.au)
    const compoundTLDs = validTLDs.filter(t => t.includes('.'));
    for (const compoundTld of compoundTLDs) {
      if (domain.endsWith('.' + compoundTld)) return true;
    }
    
    // Check if the extracted TLD is in our valid list
    const tldLower = tld.toLowerCase();
    return validTLDs.includes(tldLower);
  };

  // Password validation for signup
  const validatePassword = (password: string): boolean => {
    return password.length >= 6;
  };

  // Check if already logged in - single check, no subscription
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate('/');
      }
    });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clear previous errors
    setAuthError('');
    setPasswordError('');
    setConfirmPasswordError('');
    setEmailError('');
    
    // Client-side email validation first
    if (!validateEmail(email)) {
      setEmailError('Invalid email address');
      return;
    }
    
    // Password validation for signup only
    if (mode === 'signup' && !validatePassword(password)) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    
    // Confirm password validation for signup only
    if (mode === 'signup' && password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match');
      return;
    }
    
    // Server-side domain validation for signup only
    if (mode === 'signup') {
      try {
        const { data, error } = await supabase.functions.invoke('validate-email-domain', {
          body: { email },
        });
        
        if (error || !data?.valid) {
          setEmailError('Invalid email domain');
          return;
        }
      } catch {
        setEmailError('Invalid email domain');
        return;
      }
    }
    
    setLoading(true);

    try {
      if (mode === 'forgot') {
        console.log('[RESET] Calling send-password-reset edge function...');
        
        // Always send users to the production web reset page (same UX as website users)
        const redirectTo = `https://tracktsw.app/reset-password`;
        
        const { data, error } = await supabase.functions.invoke('send-password-reset', {
          body: { 
            email, 
            redirectTo
          },
        });
        console.log('[RESET] Response:', { data, error });
        if (error) {
          console.error('[RESET] Edge function error:', error);
          throw error;
        }
        toast.success('If that email exists, we sent a reset link. Check your inbox!');
        setMode('login');
        setEmail('');
      } else if (mode === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        
        // Identify user for analytics after successful login
        if (data?.user?.id) {
          // Check for pending onboarding survey (edge case: signup interrupted before survey sent)
          if (hasPendingOnboardingSurvey()) {
            sendPendingOnboardingSurvey(data.user.id);
          } else {
            identifyUser(data.user.id);
          }
        }
        
        // Request notification permission on native platforms after login
        if (Capacitor.isNativePlatform()) {
          try {
            const permResult = await LocalNotifications.requestPermissions();
            if (permResult.display === 'granted') {
              // Schedule daily reminders at default time (9:00 PM)
              await scheduleCheckInReminders('21:00', true);
            }
          } catch (err) {
            console.log('[AUTH] Notification permission request failed:', err);
          }
        }
        
        toast.success('Welcome back!');
        navigate('/');
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        
        // IMPORTANT: Only after successful signup, save onboarding data to backend
        if (data?.user?.id) {
          // Send pending onboarding survey to PostHog (identifies user first)
          if (hasPendingOnboardingSurvey()) {
            sendPendingOnboardingSurvey(data.user.id);
          } else {
            identifyUser(data.user.id);
          }
          
          // Submit onboarding data first (if any exists from the onboarding flow)
          // This is the ONLY place where onboarding data gets persisted to backend
          if (hasPendingOnboardingData()) {
            console.log('[AUTH] Submitting onboarding data after successful signup');
            await submitOnboardingData(data.user.id);
          }
          
          // Create user settings and send welcome email
          const { data: existingSettings } = await supabase
            .from('user_settings')
            .select('welcome_email_sent_at')
            .eq('user_id', data.user.id)
            .maybeSingle();
          
          // Only send if no settings exist or welcome email not sent
          if (!existingSettings?.welcome_email_sent_at) {
            supabase.functions.invoke('send-welcome-email', {
              body: { email },
            }).then(() => {
              // Mark welcome email as sent (fire-and-forget)
              supabase
                .from('user_settings')
                .upsert({
                  user_id: data.user!.id,
                  welcome_email_sent_at: new Date().toISOString(),
                }, { onConflict: 'user_id' })
                .then(() => {});
            }).catch(() => {
              // Silently ignore errors - don't block signup
            });
          }
          
          // Fire Meta onboarding_complete event (only once per user, tracked via localStorage)
          trackMetaOnboardingComplete();
          
          // Mark that user just signed up - AuthGuard will show trial offer on first login
          localStorage.setItem('just_signed_up', 'true');
          
          // Request notification permission on native platforms after signup
          if (Capacitor.isNativePlatform()) {
            try {
              const permResult = await LocalNotifications.requestPermissions();
              if (permResult.display === 'granted') {
                // Schedule daily reminders at default time (9:00 PM)
                await scheduleCheckInReminders('21:00', true);
              }
            } catch (err) {
              console.log('[AUTH] Notification permission request failed:', err);
            }
          }
        }
        
        toast.success('Account created! Check your email to verify, then sign in.');
        setMode('login');
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Authentication failed';
      console.error('[AUTH] Error:', errorMessage);
      
      // Provide user-friendly messages for common errors
      if (
        errorMessage.includes('Invalid login credentials') ||
        errorMessage.includes('invalid_credentials') ||
        errorMessage.includes('invalid credentials')
      ) {
        setAuthError('Incorrect email or password');
      } else if (errorMessage.includes('Email not confirmed')) {
        setAuthError('Please verify your email address before signing in.');
      } else if (errorMessage.includes('User already registered')) {
        setAuthError('An account with this email already exists. Try signing in instead.');
      } else if (
        errorMessage.includes('Invalid email') ||
        errorMessage.includes('invalid email') ||
        errorMessage.includes('Unable to validate email')
      ) {
        setEmailError('Invalid email address');
      } else {
        setAuthError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const getTitle = () => {
    switch (mode) {
      case 'forgot': return 'Reset Password';
      case 'signup': return 'Join TrackTSW';
      default: return 'Welcome Back';
    }
  };

  const getSubtitle = () => {
    switch (mode) {
      case 'forgot': return "Enter your email and we'll send you a reset link";
      case 'signup': return 'Start tracking your TSW recovery today';
      default: return 'Sign in to continue your healing journey';
    }
  };

  const getButtonText = () => {
    if (loading) return 'Please wait...';
    switch (mode) {
      case 'forgot': return 'Send Reset Link';
      case 'signup': return 'Create Account';
      default: return 'Sign In';
    }
  };

  return (
    <>
      <div 
        className="h-[100dvh] flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden" 
        style={isAndroid ? undefined : { paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}
      >
      {/* Decorative background - simplified for mobile performance */}
      <div className="hidden sm:block">
        <div className="decorative-blob w-64 h-64 bg-coral/40 -top-20 -right-20 fixed" />
        <div className="decorative-blob w-80 h-80 bg-sage/30 -bottom-32 -left-32 fixed" />
        <div className="decorative-blob w-48 h-48 bg-honey/20 top-1/3 right-0 fixed" />
      </div>
      
      {/* Dot pattern overlay - hidden on mobile */}
      <div className="hidden sm:block fixed inset-0 decorative-dots opacity-30 pointer-events-none" />
      
      <div className="w-full max-w-sm space-y-8 relative z-10">
        {/* Header */}
        <div className="text-center space-y-4 animate-fade-in">
          {mode === 'forgot' ? (
            <button
              onClick={() => setMode('login')}
              className="inline-flex items-center justify-center p-3 rounded-2xl bg-muted/80 hover:bg-muted hover:shadow-warm transition-all duration-300 mb-2"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          ) : (
            <div className="inline-flex flex-col items-center gap-3">
              <div className="w-24 h-24 rounded-full bg-background flex items-center justify-center">
                <img 
                  src={trackTswLogo} 
                  alt="TrackTSW" 
                  className="w-20 h-20 object-contain" 
                />
              </div>
              <h2 className="font-display text-lg font-semibold text-anchor">TrackTSW</h2>
            </div>
          )}
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-bold text-foreground text-warm-shadow">
              {getTitle()}
            </h1>
            <p className="text-muted-foreground">
              {getSubtitle()}
            </p>
          </div>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="glass-card-warm p-6 space-y-5 animate-slide-up">
          <div className="space-y-2">
            <Label htmlFor="email" className="font-semibold">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <AndroidSafeInput
                ref={emailRef}
                id="email"
                type="email"
                value={email}
                onValueChange={(val) => {
                  setEmail(val);
                  if (emailError) setEmailError('');
                }}
                placeholder="you@example.com"
                className={`pl-11 h-12 rounded-xl border-2 transition-colors ${emailError ? 'border-destructive focus:border-destructive' : 'focus:border-coral/50'}`}
                required
              />
            </div>
            {emailError && (
              <p className="text-sm text-destructive">{emailError}</p>
            )}
          </div>

          {mode !== 'forgot' && (
            <div className="space-y-2">
              <Label htmlFor="password" className="font-semibold">Password</Label>
              <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <AndroidSafeInput
                  ref={passwordRef}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onValueChange={(val) => {
                    setPassword(val);
                    if (authError) setAuthError('');
                    if (passwordError) setPasswordError('');
                    if (confirmPasswordError) setConfirmPasswordError('');
                  }}
                  placeholder="••••••••"
                  className="pl-11 pr-11 h-12 rounded-xl border-2 focus:border-coral/50 transition-colors"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {passwordError && (
                <p className="text-sm text-destructive text-center">{passwordError}</p>
              )}
              {authError && (
                <p className="text-sm text-destructive text-center">{authError}</p>
              )}
            </div>
          )}

          {mode === 'signup' && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="font-semibold">Confirm Password</Label>
              <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <AndroidSafeInput
                  ref={confirmPasswordRef}
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onValueChange={(val) => {
                    setConfirmPassword(val);
                    if (confirmPasswordError) setConfirmPasswordError('');
                  }}
                  placeholder="••••••••"
                  className={`pl-11 pr-11 h-12 rounded-xl border-2 transition-colors ${confirmPasswordError ? 'border-destructive focus:border-destructive' : 'focus:border-coral/50'}`}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPasswordError && (
                <p className="text-sm text-destructive">{confirmPasswordError}</p>
              )}
            </div>
          )}

          {mode === 'login' && (
            <div className="text-center">
              <button
                type="button"
                onClick={() => setMode('forgot')}
                className="text-sm text-coral hover:text-coral-deep hover:underline transition-colors font-medium"
              >
                Forgot password?
              </button>
            </div>
          )}

          <Button type="submit" variant="default" className="w-full h-12 text-base" disabled={loading}>
            {getButtonText()}
          </Button>

          {mode === 'signup' && (
            <p className="text-xs text-center text-muted-foreground">
              By creating an account, you agree to our{' '}
              <a
                href="https://tracktsw.com/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-coral hover:text-coral-deep underline"
              >
                Privacy Policy
              </a>{' '}
              and{' '}
              <a
                href="https://tracktsw.com/terms"
                target="_blank"
                rel="noopener noreferrer"
                className="text-coral hover:text-coral-deep underline"
              >
                Terms of Service
              </a>
              .
            </p>
          )}

          {mode === 'forgot' && (
            <p className="text-xs text-center text-muted-foreground">
              Your reset link should arrive within a few minutes — don't forget to check your junk/spam folder.
            </p>
          )}

          {mode !== 'forgot' && (
            <p className="text-sm text-center text-muted-foreground">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                className="text-coral hover:text-coral-deep hover:underline transition-colors font-semibold"
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          )}
        </form>

        {/* Privacy Note - only show on login */}
        {mode === 'login' && (
          <div className="glass-card p-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-start gap-3">
              <Heart className="w-5 h-5 text-coral flex-shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your photos and personal data are stored securely with your account.
              </p>
            </div>
          </div>
        )}
      </div>
      </div>
    </>
  );
};

export default AuthPage;
