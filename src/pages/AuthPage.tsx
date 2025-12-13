import { useState, useEffect } from 'react';
import { Mail, Lock, Heart, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
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
      case 'signup': return 'Create Account';
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
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-6">
      <div className="w-full max-w-sm space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          {mode === 'forgot' ? (
            <button
              onClick={() => setMode('login')}
              className="inline-flex items-center justify-center p-3 rounded-full bg-muted hover:bg-muted/80 transition-colors mb-2"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          ) : (
            <div className="inline-flex items-center justify-center p-3 rounded-full bg-primary/10 mb-2">
              <Heart className="w-8 h-8 text-primary" />
            </div>
          )}
          <h1 className="font-display text-2xl font-bold text-foreground">
            {getTitle()}
          </h1>
          <p className="text-sm text-muted-foreground">
            {getSubtitle()}
          </p>
        </div>

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="glass-card p-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="pl-10"
                required
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-10"
                  required
                  minLength={6}
                />
              </div>
            </div>
          )}

          {mode === 'login' && (
            <button
              type="button"
              onClick={() => setMode('forgot')}
              className="text-sm text-primary hover:underline"
            >
              Forgot password?
            </button>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {getButtonText()}
          </Button>

          {mode !== 'forgot' && (
            <p className="text-sm text-center text-muted-foreground">
              {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button
                type="button"
                onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                className="text-primary hover:underline"
              >
                {mode === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </p>
          )}
        </form>

        {/* Privacy Note */}
        <p className="text-xs text-center text-muted-foreground">
          Your photos and personal data are stored locally on your device. 
          Only your account info is stored securely.
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
