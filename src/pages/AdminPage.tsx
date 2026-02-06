import { useState, useEffect } from 'react';
import { ArrowLeft, Check, X, LogOut, Shield, Loader2, Trash2, Plus, Pencil, BookOpen, ExternalLink, ChevronUp, ChevronDown } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  banner_text: string | null;
}

interface Resource {
  id: string;
  url: string;
  source_domain: string;
  custom_title: string | null;
  custom_summary: string | null;
  ai_summary: string | null;
  summary_status: string;
  created_at: string;
  sort_order: number;
}

const CATEGORIES = ['moisture', 'therapy', 'bathing', 'relief', 'medication', 'lifestyle', 'supplements', 'protection', 'general'];

const AdminPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTreatment, setEditingTreatment] = useState<Treatment | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('general');
  const [formBannerText, setFormBannerText] = useState('');
  
  // Resource form state
  const [showResourceModal, setShowResourceModal] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [resourceUrl, setResourceUrl] = useState('');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceSummary, setResourceSummary] = useState('');
  
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

  // Resources query - sorted by admin-defined sort_order
  const { data: resources, isLoading: loadingResources } = useQuery({
    queryKey: ['admin-resources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data as Resource[];
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
    mutationFn: async (data: { name: string; description: string; category: string; banner_text: string }) => {
      const { error } = await supabase
        .from('treatments')
        .insert({
          name: data.name.trim(),
          description: data.description.trim() || null,
          category: data.category,
          is_approved: true,
          banner_text: data.banner_text.trim() || null,
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
    mutationFn: async (data: { id: string; name: string; description: string; category: string; banner_text: string }) => {
      const { error } = await supabase
        .from('treatments')
        .update({
          name: data.name.trim(),
          description: data.description.trim() || null,
          category: data.category,
          banner_text: data.banner_text.trim() || null,
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
    setFormBannerText('');
  };

  const resetResourceForm = () => {
    setResourceUrl('');
    setResourceTitle('');
    setResourceSummary('');
  };

  const openEditModal = (treatment: Treatment) => {
    setEditingTreatment(treatment);
    setFormName(treatment.name);
    setFormDescription(treatment.description || '');
    setFormCategory(treatment.category);
    setFormBannerText(treatment.banner_text || '');
  };

  const openEditResourceModal = (resource: Resource) => {
    setEditingResource(resource);
    setResourceUrl(resource.url);
    setResourceTitle(resource.custom_title || '');
    setResourceSummary(resource.custom_summary || '');
  };

  // Extract domain from URL
  const extractDomain = (url: string): string => {
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      return parsed.hostname.replace('www.', '');
    } catch {
      return url;
    }
  };

  // Add resource mutation
  const addResourceMutation = useMutation({
    mutationFn: async (data: { url: string; custom_title: string; custom_summary: string }) => {
      const normalizedUrl = data.url.startsWith('http') ? data.url : `https://${data.url}`;
      const sourceDomain = extractDomain(normalizedUrl);
      
      const { data: inserted, error } = await supabase
        .from('resources')
        .insert({
          url: normalizedUrl,
          source_domain: sourceDomain,
          custom_title: data.custom_title.trim() || null,
          custom_summary: data.custom_summary.trim() || null,
          summary_status: data.custom_summary.trim() ? 'completed' : 'pending',
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // If no custom summary, trigger AI summarization
      if (!data.custom_summary.trim()) {
        supabase.functions.invoke('summarize-resource', {
          body: { resourceId: inserted.id, url: normalizedUrl },
        }).catch(console.error);
      }
      
      return inserted;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-resources'] });
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      toast.success('Resource added successfully');
      resetResourceForm();
      setShowResourceModal(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to add resource');
    },
  });

  // Update resource mutation
  const updateResourceMutation = useMutation({
    mutationFn: async (data: { id: string; url: string; custom_title: string; custom_summary: string }) => {
      const normalizedUrl = data.url.startsWith('http') ? data.url : `https://${data.url}`;
      const sourceDomain = extractDomain(normalizedUrl);
      
      const { error } = await supabase
        .from('resources')
        .update({
          url: normalizedUrl,
          source_domain: sourceDomain,
          custom_title: data.custom_title.trim() || null,
          custom_summary: data.custom_summary.trim() || null,
        })
        .eq('id', data.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-resources'] });
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      toast.success('Resource updated successfully');
      resetResourceForm();
      setEditingResource(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update resource');
    },
  });

  // Delete resource mutation
  const deleteResourceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('resources')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-resources'] });
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      toast.success('Resource removed');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to remove resource');
    },
  });

  // Regenerate summary mutation
  const regenerateSummaryMutation = useMutation({
    mutationFn: async (resource: Resource) => {
      await supabase
        .from('resources')
        .update({ summary_status: 'pending', ai_summary: null })
        .eq('id', resource.id);
      
      const { error } = await supabase.functions.invoke('summarize-resource', {
        body: { resourceId: resource.id, url: resource.url },
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-resources'] });
      queryClient.invalidateQueries({ queryKey: ['resources'] });
      toast.success('Summary regeneration started');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to regenerate summary');
    },
  });

  // Reorder resource mutation
  const reorderResourceMutation = useMutation({
    mutationFn: async ({ resourceId, direction }: { resourceId: string; direction: 'up' | 'down' }) => {
      if (!resources) return;
      
      const currentIndex = resources.findIndex(r => r.id === resourceId);
      if (currentIndex === -1) return;
      
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= resources.length) return;
      
      const currentResource = resources[currentIndex];
      const targetResource = resources[targetIndex];
      
      // Swap sort_order values
      const { error: error1 } = await supabase
        .from('resources')
        .update({ sort_order: targetResource.sort_order })
        .eq('id', currentResource.id);
      
      if (error1) throw error1;
      
      const { error: error2 } = await supabase
        .from('resources')
        .update({ sort_order: currentResource.sort_order })
        .eq('id', targetResource.id);
      
      if (error2) throw error2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-resources'] });
      queryClient.invalidateQueries({ queryKey: ['resources'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reorder resource');
    },
  });

  const handleResourceSubmit = () => {
    if (!resourceUrl.trim()) {
      toast.error('URL is required');
      return;
    }

    if (editingResource) {
      updateResourceMutation.mutate({
        id: editingResource.id,
        url: resourceUrl,
        custom_title: resourceTitle,
        custom_summary: resourceSummary,
      });
    } else {
      addResourceMutation.mutate({
        url: resourceUrl,
        custom_title: resourceTitle,
        custom_summary: resourceSummary,
      });
    }
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
        banner_text: formBannerText,
      });
    } else {
      addTreatmentMutation.mutate({
        name: formName,
        description: formDescription,
        category: formCategory,
        banner_text: formBannerText,
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
            <p className="text-sm text-muted-foreground">Manage content</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={handleLogout}>
          <LogOut className="w-5 h-5" />
        </Button>
      </div>

      <Tabs defaultValue="treatments" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="treatments">Treatments</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>

        {/* Treatments Tab */}
        <TabsContent value="treatments" className="space-y-6 mt-4">
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
                        className="text-primary hover:text-primary hover:bg-primary/10"
                        onClick={() => approveMutation.mutate(suggestion)}
                        disabled={approveMutation.isPending}
                      >
                        <Check className="w-5 h-5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
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
        </TabsContent>

        {/* Resources Tab */}
        <TabsContent value="resources" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5" />
              Educational Resources
              {resources && resources.length > 0 && (
                <Badge variant="secondary">{resources.length}</Badge>
              )}
            </h2>
            <Button size="sm" onClick={() => setShowResourceModal(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            Add external educational links. AI will auto-generate summaries unless you provide a custom one.
          </p>

          {loadingResources ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : !resources || resources.length === 0 ? (
            <div className="glass-card p-6 text-center text-muted-foreground">
              No resources added yet
            </div>
          ) : (
            resources.map((resource, index) => (
              <div key={resource.id} className="glass-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  {/* Reorder controls */}
                  <div className="flex flex-col gap-0.5 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => reorderResourceMutation.mutate({ resourceId: resource.id, direction: 'up' })}
                      disabled={index === 0 || reorderResourceMutation.isPending}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => reorderResourceMutation.mutate({ resourceId: resource.id, direction: 'down' })}
                      disabled={index === resources.length - 1 || reorderResourceMutation.isPending}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">
                      {resource.custom_title || resource.source_domain}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">{resource.source_domain}</p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      asChild
                    >
                      <a href={resource.url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEditResourceModal(resource)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deleteResourceMutation.mutate(resource.id)}
                      disabled={deleteResourceMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-8">
                  <Badge 
                    variant={
                      resource.summary_status === 'completed' ? 'default' : 
                      resource.summary_status === 'pending' ? 'secondary' : 'outline'
                    }
                    className="text-[10px]"
                  >
                    {resource.summary_status === 'completed' ? 
                      (resource.custom_summary ? 'Custom summary' : 'AI summary') : 
                      resource.summary_status === 'pending' ? 'Generating...' : 'Unavailable'}
                  </Badge>
                  {resource.summary_status !== 'pending' && !resource.custom_summary && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs"
                      onClick={() => regenerateSummaryMutation.mutate(resource)}
                      disabled={regenerateSummaryMutation.isPending}
                    >
                      {regenerateSummaryMutation.isPending ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        'Regenerate'
                      )}
                    </Button>
                  )}
                </div>
                {(resource.custom_summary || resource.ai_summary) && (
                  <p className="text-xs text-muted-foreground line-clamp-3 ml-8">
                    {resource.custom_summary || resource.ai_summary}
                  </p>
                )}
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

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
                <SelectContent className="max-h-60 overflow-y-auto">
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
            <div>
              <label className="text-sm font-medium mb-1 block">Status badge text (optional)</label>
              <Input
                value={formBannerText}
                onChange={(e) => setFormBannerText(e.target.value)}
                placeholder="e.g., Not to be used with CAP"
                maxLength={40}
              />
              <p className="text-xs text-muted-foreground mt-1">Displays as an inline badge next to the name</p>
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

      {/* Add/Edit Resource Modal */}
      <Dialog open={showResourceModal || !!editingResource} onOpenChange={(open) => {
        if (!open) {
          setShowResourceModal(false);
          setEditingResource(null);
          resetResourceForm();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingResource ? 'Edit Resource' : 'Add Resource'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Website URL *</label>
              <Input
                type="url"
                value={resourceUrl}
                onChange={(e) => setResourceUrl(e.target.value)}
                placeholder="https://example.com/article"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Custom title (optional)</label>
              <Input
                value={resourceTitle}
                onChange={(e) => setResourceTitle(e.target.value)}
                placeholder="Leave empty to auto-extract"
                maxLength={200}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Custom summary (optional)</label>
              <Textarea
                value={resourceSummary}
                onChange={(e) => setResourceSummary(e.target.value)}
                placeholder="Leave empty for AI-generated summary (5-8 sentences)"
                rows={4}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground mt-1">
                If left empty, an AI summary will be generated automatically.
              </p>
            </div>
            <Button 
              className="w-full" 
              onClick={handleResourceSubmit}
              disabled={addResourceMutation.isPending || updateResourceMutation.isPending}
            >
              {addResourceMutation.isPending || updateResourceMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {editingResource ? 'Save Changes' : 'Add Resource'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPage;
