import { useState, useEffect } from 'react';
import { ArrowLeft, Check, X, LogOut, Shield, Loader2, Trash2, Plus, Pencil } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

interface Treatment {
  id: string;
  name: string;
  description: string | null;
  category: string;
  is_approved: boolean;
}

const CATEGORIES = ['moisturizers', 'diet', 'supplements', 'lifestyle', 'topical', 'general'];

const AdminPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('general');
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

  const { data: treatments, isLoading: loadingTreatments } = useQuery({
    queryKey: ['treatments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('treatments')
        .select('*')
        .eq('is_approved', true)
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user && isAdmin,
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

  const deleteTreatmentMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('treatments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treatments'] });
      toast.success('Treatment removed from community list');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to remove treatment');
    },
  });

  const addTreatmentMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; category: string }) => {
      const { error } = await supabase
        .from('treatments')
        .insert({
          name: data.name.trim(),
          description: data.description.trim() || null,
          category: data.category,
          is_approved: true,
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treatments'] });
      toast.success('Treatment added successfully');
      resetForm();
      setShowAddModal(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add treatment');
    },
  });

  const updateTreatmentMutation = useMutation({
    mutationFn: async (data: { id: string; name: string; description: string; category: string }) => {
      const { error } = await supabase
        .from('treatments')
        .update({
          name: data.name.trim(),
          description: data.description.trim() || null,
          category: data.category,
        })
        .eq('id', data.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['treatments'] });
      toast.success('Treatment updated successfully');
      resetForm();
      setEditingTreatment(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update treatment');
    },
  });

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormCategory('general');
  };

  const openEditModal = (treatment: Treatment) => {
    setEditingTreatment(treatment);
    setFormName(treatment.name);
    setFormDescription(treatment.description || '');
    setFormCategory(treatment.category);
  };

  const handleSubmit = () => {
    if (!formName.trim()) {
      toast.error('Treatment name is required');
      return;
    }

    if (editingTreatment) {
      updateTreatmentMutation.mutate({
        id: editingTreatment.id,
        name: formName,
        description: formDescription,
        category: formCategory,
      });
    } else {
      addTreatmentMutation.mutate({
        name: formName,
        description: formDescription,
        category: formCategory,
      });
    }
  };

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

      {/* Community Treatments */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            Community Treatments
            {treatments && treatments.length > 0 && (
              <Badge variant="secondary">{treatments.length}</Badge>
            )}
          </h2>
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </div>

        {loadingTreatments ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : !treatments || treatments.length === 0 ? (
          <div className="glass-card p-6 text-center text-muted-foreground">
            No treatments in the community list
          </div>
        ) : (
          treatments.map((treatment) => (
            <div key={treatment.id} className="glass-card p-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-medium">{treatment.name}</span>
                  <Badge variant="outline" className="ml-2">{treatment.category}</Badge>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => openEditModal(treatment)}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => deleteTreatmentMutation.mutate(treatment.id)}
                    disabled={deleteTreatmentMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              {treatment.description && (
                <p className="text-sm text-muted-foreground mt-2">{treatment.description}</p>
              )}
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

      {/* Add/Edit Treatment Modal */}
      <Dialog open={showAddModal || !!editingTreatment} onOpenChange={(open) => {
        if (!open) {
          setShowAddModal(false);
          setEditingTreatment(null);
          resetForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTreatment ? 'Edit Treatment' : 'Add Treatment'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Name</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Treatment name"
                maxLength={100}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Category</label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat.charAt(0).toUpperCase() + cat.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description (optional)</label>
              <Textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description..."
                maxLength={500}
              />
            </div>
            <Button 
              className="w-full" 
              onClick={handleSubmit}
              disabled={addTreatmentMutation.isPending || updateTreatmentMutation.isPending}
            >
              {addTreatmentMutation.isPending || updateTreatmentMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {editingTreatment ? 'Save Changes' : 'Add Treatment'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPage;
