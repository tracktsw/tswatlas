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
  const navigate = useNavigate();

  useEffect(() => {
    // Check if there's a valid recovery session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setHasSession(!!session);
      
      if (!session) {
        // No session means the recovery link is invalid or expired
        toast.error('Invalid or expired reset link. Please request a new one.');
      }
    };
    
    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      
      if (error) throw error;
      
      setSuccess(true);
      toast.success('Password updated successfully!');
      
      // Sign out and redirect to login after a moment
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate('/auth');
      }, 2000);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  // Loading state while checking session
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

  // No valid session - show error state
  if (!hasSession) {
    return (
      <div 
        className="h-[100dvh] flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden" 
        style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}
      >
        <div className="decorative-blob w-64 h-64 bg-coral/40 -top-20 -right-20 fixed" />
        <div className="decorative-blob w-80 h-80 bg-sage/30 -bottom-32 -left-32 fixed" />
        <div className="fixed inset-0 decorative-dots opacity-30 pointer-events-none" />
        
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
          
          <Button 
            onClick={() => navigate('/auth')} 
            variant="warm" 
            className="w-full h-12"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Sign In
          </Button>
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
        <div className="decorative-blob w-64 h-64 bg-coral/40 -top-20 -right-20 fixed" />
        <div className="decorative-blob w-80 h-80 bg-sage/30 -bottom-32 -left-32 fixed" />
        <div className="fixed inset-0 decorative-dots opacity-30 pointer-events-none" />
        
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

  // Form to set new password
  return (
    <div 
      className="h-[100dvh] flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden" 
      style={{ paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)' }}
    >
      <div className="decorative-blob w-64 h-64 bg-coral/40 -top-20 -right-20 fixed" />
      <div className="decorative-blob w-80 h-80 bg-sage/30 -bottom-32 -left-32 fixed" />
      <div className="decorative-blob w-48 h-48 bg-honey/20 top-1/3 right-0 fixed" />
      <div className="fixed inset-0 decorative-dots opacity-30 pointer-events-none" />
      
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
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-11 h-12 rounded-xl border-2 focus:border-coral/50 transition-colors"
                required
                minLength={6}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="font-semibold">Confirm Password</Label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="pl-11 h-12 rounded-xl border-2 focus:border-coral/50 transition-colors"
                required
                minLength={6}
              />
            </div>
          </div>

          <Button type="submit" variant="warm" className="w-full h-12 text-base" disabled={loading}>
            {loading ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
