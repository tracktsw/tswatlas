import { useState, useEffect } from 'react';
import { Lock, CheckCircle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import trackTswLogo from '@/assets/tracktsw-logo-transparent.png';

const ResetPasswordPage = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const navigate = useNavigate();

  useEffect(() => {
    const initSession = async () => {
      // Parse tokens from BOTH hash and search params
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const searchParams = new URLSearchParams(window.location.search);
      
      // Check hash first, then search params
      const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
      const type = hashParams.get('type') || searchParams.get('type');
      const errorParam = hashParams.get('error') || searchParams.get('error');
      const errorDesc = hashParams.get('error_description') || searchParams.get('error_description');
      
      console.log('[ResetPassword] Params:', { 
        hasAccessToken: !!accessToken, 
        hasRefreshToken: !!refreshToken,
        type, 
        error: errorParam 
      });

      // Handle error in URL
      if (errorParam) {
        console.log('[ResetPassword] Error in URL:', errorDesc);
        setHasSession(false);
        return;
      }

      // If we have tokens and type=recovery, set the session
      if (accessToken && refreshToken && type === 'recovery') {
        console.log('[ResetPassword] Setting session from tokens');
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        
        if (error) {
          console.log('[ResetPassword] Error setting session:', error.message);
          setHasSession(false);
        } else if (data.session) {
          console.log('[ResetPassword] Session set successfully');
          setHasSession(true);
          // Clean up URL
          window.history.replaceState(null, '', window.location.pathname);
        }
        return;
      }

      // No valid tokens - show error
      setHasSession(false);
    };
    
    initSession();
  }, []);

  const validateForm = (): boolean => {
    const newErrors: { password?: string; confirm?: string } = {};
    
    if (password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    
    if (password !== confirmPassword) {
      newErrors.confirm = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) throw error;
      
      setSuccess(true);
      toast.success('Password updated successfully!');
      
      // Sign out and redirect to login
      await supabase.auth.signOut();
      setTimeout(() => navigate('/auth'), 2000);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (hasSession === null) {
    return (
      <div 
        className="h-[100dvh] flex items-center justify-center overflow-hidden" 
        style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}
      >
        <div className="animate-pulse text-muted-foreground">Verifying reset link...</div>
      </div>
    );
  }

  // Invalid/expired link
  if (!hasSession) {
    return (
      <div 
        className="h-[100dvh] flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden" 
        style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}
      >
        <div className="hidden sm:block">
          <div className="decorative-blob w-64 h-64 bg-coral/40 -top-20 -right-20 fixed" />
          <div className="decorative-blob w-80 h-80 bg-sage/30 -bottom-32 -left-32 fixed" />
        </div>
        
        <div className="w-full max-w-sm space-y-8 relative z-10">
          <div className="text-center space-y-4 animate-fade-in">
            <div className="inline-flex flex-col items-center gap-3">
              <div className="w-24 h-24 rounded-full bg-background flex items-center justify-center">
                <img src={trackTswLogo} alt="TrackTSW" className="w-20 h-20 object-contain" />
              </div>
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Link Expired
            </h1>
            <p className="text-muted-foreground">
              This password reset link has expired or is invalid.
            </p>
          </div>
          
          <div className="space-y-3">
            <Button 
              onClick={() => navigate('/auth')} 
              variant="default" 
              className="w-full h-12"
            >
              Request New Link
            </Button>
            <Button 
              onClick={() => navigate('/auth')} 
              variant="outline" 
              className="w-full h-12"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Sign In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div 
        className="h-[100dvh] flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden" 
        style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}
      >
        <div className="hidden sm:block">
          <div className="decorative-blob w-64 h-64 bg-coral/40 -top-20 -right-20 fixed" />
          <div className="decorative-blob w-80 h-80 bg-sage/30 -bottom-32 -left-32 fixed" />
        </div>
        
        <div className="w-full max-w-sm space-y-8 relative z-10">
          <div className="text-center space-y-4 animate-fade-in">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-sage/20">
              <CheckCircle className="w-10 h-10 text-sage" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">
              Password Updated!
            </h1>
            <p className="text-muted-foreground">
              Redirecting you to sign in...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Password reset form
  return (
    <div 
      className="h-[100dvh] flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden" 
      style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}
    >
      <div className="hidden sm:block">
        <div className="decorative-blob w-64 h-64 bg-coral/40 -top-20 -right-20 fixed" />
        <div className="decorative-blob w-80 h-80 bg-sage/30 -bottom-32 -left-32 fixed" />
        <div className="decorative-blob w-48 h-48 bg-honey/20 top-1/3 right-0 fixed" />
      </div>
      <div className="hidden sm:block fixed inset-0 decorative-dots opacity-30 pointer-events-none" />
      
      <div className="w-full max-w-sm space-y-8 relative z-10">
        <div className="text-center space-y-4 animate-fade-in">
          <div className="inline-flex flex-col items-center gap-3">
            <div className="w-24 h-24 rounded-full bg-background flex items-center justify-center">
              <img src={trackTswLogo} alt="TrackTSW" className="w-20 h-20 object-contain" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="font-display text-3xl font-bold text-foreground text-warm-shadow">
              Set New Password
            </h1>
            <p className="text-muted-foreground">
              Choose a secure password for your account
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="glass-card-warm p-6 space-y-5 animate-slide-up">
          <div className="space-y-2">
            <Label htmlFor="password" className="font-semibold">New Password</Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors(prev => ({ ...prev, password: undefined }));
                }}
                placeholder="••••••••"
                className={`pl-11 h-12 rounded-xl border-2 transition-colors ${
                  errors.password ? 'border-destructive focus:border-destructive' : 'focus:border-coral/50'
                }`}
                required
              />
            </div>
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="font-semibold">Confirm Password</Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  if (errors.confirm) setErrors(prev => ({ ...prev, confirm: undefined }));
                }}
                placeholder="••••••••"
                className={`pl-11 h-12 rounded-xl border-2 transition-colors ${
                  errors.confirm ? 'border-destructive focus:border-destructive' : 'focus:border-coral/50'
                }`}
                required
              />
            </div>
            {errors.confirm && (
              <p className="text-sm text-destructive">{errors.confirm}</p>
            )}
          </div>

          <Button type="submit" variant="default" className="w-full h-12 text-base" disabled={loading}>
            {loading ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
