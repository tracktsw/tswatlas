import { useState, useEffect } from 'react';
import { Mail, Lock, Heart, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import trackTswLogo from '@/assets/tracktsw-logo-transparent.png';

type AuthMode = 'login' | 'signup' | 'forgot';

const AuthPage = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Check if already logged in
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          navigate('/');
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        navigate('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        toast.success('Password reset email sent! Check your inbox.');
        setMode('login');
        setEmail('');
      } else if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
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
        
        // Send welcome email for new users only (check if user was just created)
        if (data?.user?.id) {
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
        }
        
        toast.success('Account created! You can now sign in.');
        setMode('login');
      }
    } catch (error: any) {
      toast.error(error.message || 'Authentication failed');
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
      case 'forgot': return 'Enter your email to receive a reset link';
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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="decorative-blob w-64 h-64 bg-coral/40 -top-20 -right-20 fixed" />
      <div className="decorative-blob w-80 h-80 bg-sage/30 -bottom-32 -left-32 fixed" />
      <div className="decorative-blob w-48 h-48 bg-honey/20 top-1/3 right-0 fixed" />
      
      {/* Dot pattern overlay */}
      <div className="fixed inset-0 decorative-dots opacity-30 pointer-events-none" />
      
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
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="pl-11 h-12 rounded-xl border-2 focus:border-coral/50 transition-colors"
                required
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div className="space-y-2">
              <Label htmlFor="password" className="font-semibold">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-11 h-12 rounded-xl border-2 focus:border-coral/50 transition-colors"
                  required
                  minLength={6}
                />
              </div>
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

          <Button type="submit" variant="warm" className="w-full h-12 text-base" disabled={loading}>
            {getButtonText()}
          </Button>

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

        {/* Privacy Note */}
        <div className="glass-card p-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <div className="flex items-start gap-3">
            <Heart className="w-5 h-5 text-coral flex-shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your photos and personal data are stored securely with your account.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
