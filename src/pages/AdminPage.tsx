import { useState, useEffect } from 'react';
import { ArrowLeft, Check, X, LogOut, Shield, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { User } from '@supabase/supabase-js';

interface Suggestion {
  id: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
  created_at: string;
  suggested_by: string | null;
}

const AdminPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      
      if (user) {
        // Check if user has admin role
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin');
        
        setIsAdmin(roles && roles.length > 0);
      }
      setCheckingAuth(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['suggestions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('treatment_suggestions')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Suggestion[];
    },
    enabled: !!user,
  });

  const approveMutation = useMutation({
    mutationFn: async (suggestion: Suggestion) => {
      // Insert into treatments table
      const { error: insertError } = await supabase
        .from('treatments')
        .insert({
          name: suggestion.name,
          description: suggestion.description,
          category: suggestion.category,
          is_approved: true,
          suggested_by: suggestion.suggested_by,
        });
      
      if (insertError) throw insertError;

      // Update suggestion status
      const { error: updateError } = await supabase
        .from('treatment_suggestions')
        .update({ status: 'approved' })
        .eq('id', suggestion.id);
      
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      queryClient.invalidateQueries({ queryKey: ['treatments'] });
      toast.success('Treatment approved and added to the list');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to approve treatment');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('treatment_suggestions')
        .update({ status: 'rejected' })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      toast.success('Suggestion rejected');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reject suggestion');
    },
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/settings');
  };

  if (checkingAuth) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  if (!isAdmin) {
    return (
      <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
        <div className="flex items-center gap-3">
          <Link 
            to="/settings" 
            className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="font-display text-2xl font-bold text-foreground">Admin Panel</h1>
        </div>

        <div className="glass-card p-6 text-center space-y-4">
          <div className="p-4 rounded-full bg-destructive/10 w-fit mx-auto">
            <Shield className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="font-semibold text-lg">Access Denied</h2>
          <p className="text-muted-foreground">
            You don't have admin privileges. Contact the app owner to request access.
          </p>
          <p className="text-sm text-muted-foreground">
            Logged in as: {user.email}
          </p>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    );
  }

  const pendingSuggestions = suggestions?.filter(s => s.status === 'pending') || [];
  const reviewedSuggestions = suggestions?.filter(s => s.status !== 'pending') || [];

  return (
    <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link 
            to="/settings" 
            className="p-2 rounded-full bg-muted hover:bg-muted/80 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">Manage treatment suggestions</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout}>
          <LogOut className="w-5 h-5" />
        </Button>
      </div>

      {/* Pending Suggestions */}
      <div className="space-y-3">
        <h2 className="font-semibold text-lg flex items-center gap-2">
          Pending Suggestions
          {pendingSuggestions.length > 0 && (
            <Badge variant="secondary">{pendingSuggestions.length}</Badge>
          )}
        </h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : pendingSuggestions.length === 0 ? (
          <div className="glass-card p-6 text-center text-muted-foreground">
            No pending suggestions
          </div>
        ) : (
          pendingSuggestions.map((suggestion) => (
            <div key={suggestion.id} className="glass-card p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{suggestion.name}</h3>
                  <Badge variant="outline" className="mt-1">{suggestion.category}</Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => approveMutation.mutate(suggestion)}
                    disabled={approveMutation.isPending}
                  >
                    <Check className="w-5 h-5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => rejectMutation.mutate(suggestion.id)}
                    disabled={rejectMutation.isPending}
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>
              {suggestion.description && (
                <p className="text-sm text-muted-foreground">{suggestion.description}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Submitted {new Date(suggestion.created_at).toLocaleDateString()}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Reviewed Suggestions */}
      {reviewedSuggestions.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-lg">Previously Reviewed</h2>
          {reviewedSuggestions.slice(0, 5).map((suggestion) => (
            <div key={suggestion.id} className="glass-card p-4 opacity-60">
              <div className="flex items-center justify-between">
                <span className="font-medium">{suggestion.name}</span>
                <Badge variant={suggestion.status === 'approved' ? 'default' : 'destructive'}>
                  {suggestion.status}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminPage;
