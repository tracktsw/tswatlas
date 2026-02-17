import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Check, X, LogOut, Shield, Loader2, Trash2, Plus, Pencil, BookOpen, ExternalLink, ChevronUp, ChevronDown, Lightbulb, Building2, Globe, Upload, Image, BarChart3, Users, Activity, CreditCard } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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

interface ResourceSuggestion {
  id: string;
  url: string;
  submitted_by: string | null;
  submitted_at: string;
  status: string;
}

const CATEGORIES = ['moisture', 'therapy', 'bathing', 'relief', 'medication', 'lifestyle', 'supplements', 'protection', 'general'];


interface PractitionerForm {
  name: string;
  practitioner_type: string;
  city: string;
  country: string;
  website: string;
  contact_email: string;
  contact_phone: string;
  services: string[];
  remote_available: boolean;
  about: string;
  is_active: boolean;
  avatar_url: string | null;
}

const emptyPractitionerForm: PractitionerForm = {
  name: '',
  practitioner_type: '',
  city: '',
  country: '',
  website: '',
  contact_email: '',
  contact_phone: '',
  services: [],
  remote_available: false,
  about: '',
  is_active: true,
  avatar_url: null,
};

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
  // Practitioner state
  const [showPractitionerModal, setShowPractitionerModal] = useState(false);
  const [editingPractitioner, setEditingPractitioner] = useState<string | null>(null);
  const [practitionerForm, setPractitionerForm] = useState<PractitionerForm>(emptyPractitionerForm);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  
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

  // Resource suggestions query
  const { data: resourceSuggestions, isLoading: loadingResourceSuggestions } = useQuery({
    queryKey: ['resource-suggestions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('resource_suggestions')
        .select('*')
        .order('submitted_at', { ascending: false });
      
      if (error) throw error;
      return data as ResourceSuggestion[];
    },
    enabled: !!user && isAdmin,
  });

  // Practitioners query
  const { data: practitioners, isLoading: loadingPractitioners } = useQuery({
    queryKey: ['admin-practitioners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('practitioners')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: !!user && isAdmin,
  });

  // Dashboard metrics query
  const { data: metrics, isLoading: loadingMetrics } = useQuery({
    queryKey: ['admin-metrics'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_admin_metrics');
      if (error) throw error;
      return data as {
        total_users: number;
        dau_today: number;
        active_subscriptions: number;
        total_checkins: number;
        new_users_today: number;
        daily_breakdown: Array<{ day: string; dau: number; checkins: number }>;
      };
    },
    enabled: !!user && isAdmin,
  });

  const addPractitionerMutation = useMutation({
    mutationFn: async (form: PractitionerForm) => {
      const { error } = await supabase
        .from('practitioners')
        .insert({
          name: form.name.trim(),
          practitioner_type: form.practitioner_type.trim() || null,
          city: form.city.trim(),
          country: form.country.trim(),
          website: form.website.trim() || null,
          contact_email: form.contact_email.trim() || null,
          contact_phone: form.contact_phone.trim() || null,
          services: form.services,
          remote_available: form.remote_available,
          about: form.about.trim() || null,
          is_active: form.is_active,
          avatar_url: form.avatar_url,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-practitioners'] });
      queryClient.invalidateQueries({ queryKey: ['practitioners'] });
      toast.success('Practitioner added');
      setPractitionerForm(emptyPractitionerForm);
      setShowPractitionerModal(false);
    },
    onError: (error: any) => toast.error(error.message || 'Failed to add practitioner'),
  });

  const updatePractitionerMutation = useMutation({
    mutationFn: async ({ id, form }: { id: string; form: PractitionerForm }) => {
      const { error } = await supabase
        .from('practitioners')
        .update({
          name: form.name.trim(),
          practitioner_type: form.practitioner_type.trim() || null,
          city: form.city.trim(),
          country: form.country.trim(),
          website: form.website.trim() || null,
          contact_email: form.contact_email.trim() || null,
          contact_phone: form.contact_phone.trim() || null,
          services: form.services,
          remote_available: form.remote_available,
          about: form.about.trim() || null,
          is_active: form.is_active,
          avatar_url: form.avatar_url,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-practitioners'] });
      queryClient.invalidateQueries({ queryKey: ['practitioners'] });
      toast.success('Practitioner updated');
      setPractitionerForm(emptyPractitionerForm);
      setEditingPractitioner(null);
    },
    onError: (error: any) => toast.error(error.message || 'Failed to update practitioner'),
  });

  // Reorder practitioner mutation
  const reorderPractitionerMutation = useMutation({
    mutationFn: async ({ practitionerId, direction }: { practitionerId: string; direction: 'up' | 'down' }) => {
      if (!practitioners) return;
      
      const currentIndex = practitioners.findIndex(p => p.id === practitionerId);
      if (currentIndex === -1) return;
      
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= practitioners.length) return;
      
      const currentPractitioner = practitioners[currentIndex];
      const targetPractitioner = practitioners[targetIndex];
      
      const { error: error1 } = await supabase
        .from('practitioners')
        .update({ sort_order: targetIndex })
        .eq('id', currentPractitioner.id);
      
      if (error1) throw error1;
      
      const { error: error2 } = await supabase
        .from('practitioners')
        .update({ sort_order: currentIndex })
        .eq('id', targetPractitioner.id);
      
      if (error2) throw error2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-practitioners'] });
      queryClient.invalidateQueries({ queryKey: ['practitioners'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to reorder practitioner');
    },
  });

  const deletePractitionerMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('practitioners').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-practitioners'] });
      queryClient.invalidateQueries({ queryKey: ['practitioners'] });
      toast.success('Practitioner removed');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to remove practitioner'),
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
      
      // Use explicit index-based sort_order values to ensure proper ordering
      // This fixes the issue when multiple resources have the same sort_order
      const { error: error1 } = await supabase
        .from('resources')
        .update({ sort_order: targetIndex })
        .eq('id', currentResource.id);
      
      if (error1) throw error1;
      
      const { error: error2 } = await supabase
        .from('resources')
        .update({ sort_order: currentIndex })
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

  // Dismiss resource suggestion mutation
  const dismissSuggestionMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('resource_suggestions')
        .update({ 
          status: 'dismissed',
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id || null,
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resource-suggestions'] });
      toast.success('Suggestion dismissed');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to dismiss suggestion');
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

      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="treatments">Treatments</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="directory">Directory</TabsTrigger>
          <TabsTrigger value="suggested" className="relative">
            Suggested
            {resourceSuggestions?.filter(s => s.status === 'pending').length ? (
              <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                {resourceSuggestions.filter(s => s.status === 'pending').length}
              </Badge>
            ) : null}
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6 mt-4">
          {loadingMetrics ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : metrics ? (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="glass-card p-4 space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span className="text-xs font-medium">Total Users</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{metrics.total_users}</p>
                  {metrics.new_users_today > 0 && (
                    <p className="text-xs text-primary">+{metrics.new_users_today} today</p>
                  )}
                </div>
                <div className="glass-card p-4 space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Activity className="w-4 h-4" />
                    <span className="text-xs font-medium">DAU Today</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{metrics.dau_today}</p>
                </div>
                <div className="glass-card p-4 space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CreditCard className="w-4 h-4" />
                    <span className="text-xs font-medium">Active Subs</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{metrics.active_subscriptions}</p>
                </div>
                <div className="glass-card p-4 space-y-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <BarChart3 className="w-4 h-4" />
                    <span className="text-xs font-medium">Total Check-ins</span>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{metrics.total_checkins.toLocaleString()}</p>
                </div>
              </div>

              {/* 7-Day Activity Chart */}
              <div className="glass-card p-4 space-y-3">
                <h3 className="font-semibold text-sm text-foreground">7-Day Activity</h3>
                {metrics.daily_breakdown.length > 0 ? (
                  <div className="h-52">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics.daily_breakdown.map(d => ({
                        ...d,
                        day: new Date(d.day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="dau" name="Active Users" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="checkins" name="Check-ins" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.5} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">No activity data in the last 7 days</p>
                )}
              </div>
            </>
          ) : (
            <div className="glass-card p-6 text-center text-muted-foreground">
              Failed to load metrics
            </div>
          )}
        </TabsContent>

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

        {/* Suggested Resources Tab */}
        <TabsContent value="suggested" className="space-y-4 mt-4">
          <div className="space-y-2">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Lightbulb className="w-5 h-5" />
              Resource Suggestions
            </h2>
            <p className="text-sm text-muted-foreground">
              User-submitted article links for review. Add as a resource or dismiss.
            </p>
          </div>

          {loadingResourceSuggestions ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : !resourceSuggestions || resourceSuggestions.length === 0 ? (
            <div className="glass-card p-6 text-center text-muted-foreground">
              No resource suggestions yet
            </div>
          ) : (
            <>
              {/* Pending suggestions */}
              {resourceSuggestions.filter(s => s.status === 'pending').length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Pending Review</h3>
                  {resourceSuggestions.filter(s => s.status === 'pending').map((suggestion) => (
                    <div key={suggestion.id} className="glass-card p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <a 
                            href={suggestion.url.startsWith('http') ? suggestion.url : `https://${suggestion.url}`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline break-all"
                          >
                            {suggestion.url}
                          </a>
                          <p className="text-xs text-muted-foreground mt-1">
                            Submitted {new Date(suggestion.submitted_at).toLocaleDateString()} at {new Date(suggestion.submitted_at).toLocaleTimeString()}
                          </p>
                          {suggestion.submitted_by && (
                            <p className="text-xs text-muted-foreground">
                              User: {suggestion.submitted_by.slice(0, 8)}...
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <Button
                            size="sm"
                            onClick={() => {
                              setResourceUrl(suggestion.url);
                              setShowResourceModal(true);
                            }}
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Add
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => dismissSuggestionMutation.mutate(suggestion.id)}
                            disabled={dismissSuggestionMutation.isPending}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Reviewed suggestions */}
              {resourceSuggestions.filter(s => s.status !== 'pending').length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">Previously Reviewed</h3>
                  {resourceSuggestions.filter(s => s.status !== 'pending').slice(0, 10).map((suggestion) => (
                    <div key={suggestion.id} className="glass-card p-4 opacity-60">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm truncate flex-1">{suggestion.url}</span>
                        <Badge variant="secondary" className="shrink-0">
                          {suggestion.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Directory Tab */}
        <TabsContent value="directory" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Practitioner Directory
              {practitioners && practitioners.length > 0 && (
                <Badge variant="secondary">{practitioners.length}</Badge>
              )}
            </h2>
            <Button size="sm" onClick={() => {
              setPractitionerForm(emptyPractitionerForm);
              setShowPractitionerModal(true);
            }}>
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>

          {loadingPractitioners ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : !practitioners || practitioners.length === 0 ? (
            <div className="glass-card p-6 text-center text-muted-foreground">
              No practitioners added yet
            </div>
          ) : (
            practitioners.map((p) => (
              <div key={p.id} className="glass-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{p.name}</h3>
                      {!p.is_active && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">Inactive</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{p.city}, {p.country}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {p.services?.map((s: string) => (
                        <Badge key={s} variant="secondary" className="text-[10px] px-1.5 py-0">
                          {s}
                        </Badge>
                      ))}
                      {p.remote_available && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                          <Globe className="w-2.5 h-2.5 mr-0.5" />
                          Remote
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <div className="flex flex-col">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => reorderPractitionerMutation.mutate({ practitionerId: p.id, direction: 'up' })}
                        disabled={practitioners.indexOf(p) === 0 || reorderPractitionerMutation.isPending}
                      >
                        <ChevronUp className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => reorderPractitionerMutation.mutate({ practitionerId: p.id, direction: 'down' })}
                        disabled={practitioners.indexOf(p) === practitioners.length - 1 || reorderPractitionerMutation.isPending}
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setEditingPractitioner(p.id);
                        setPractitionerForm({
                          name: p.name,
                          practitioner_type: p.practitioner_type || '',
                          city: p.city,
                          country: p.country,
                          website: p.website || '',
                          contact_email: p.contact_email || '',
                          contact_phone: p.contact_phone || '',
                          services: p.services || [],
                          remote_available: p.remote_available,
                          about: p.about || '',
                          is_active: p.is_active,
                          avatar_url: p.avatar_url || null,
                        });
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deletePractitionerMutation.mutate(p.id)}
                      disabled={deletePractitionerMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Practitioner Modal */}
      <Dialog open={showPractitionerModal || !!editingPractitioner} onOpenChange={(open) => {
        if (!open) {
          setShowPractitionerModal(false);
          setEditingPractitioner(null);
          setPractitionerForm(emptyPractitionerForm);
        }
      }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPractitioner ? 'Edit Practitioner' : 'Add Practitioner'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Name *</label>
              <Input
                value={practitionerForm.name}
                onChange={(e) => setPractitionerForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Clinic or practitioner name"
                maxLength={200}
              />
            </div>
            {/* Avatar upload */}
            <div>
              <label className="text-sm font-medium mb-1 block">Avatar (optional)</label>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  
                  const validTypes = ['image/png', 'image/jpeg', 'image/webp'];
                  if (!validTypes.includes(file.type)) {
                    toast.error('Only PNG, JPG, or WebP images are accepted');
                    return;
                  }
                  
                  setAvatarUploading(true);
                  try {
                    // Create a square-cropped, compressed version
                    const bitmap = await createImageBitmap(file);
                    const size = Math.min(bitmap.width, bitmap.height);
                    const canvas = document.createElement('canvas');
                    canvas.width = 400;
                    canvas.height = 400;
                    const ctx = canvas.getContext('2d')!;
                    const sx = (bitmap.width - size) / 2;
                    const sy = (bitmap.height - size) / 2;
                    ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, 400, 400);
                    
                    const blob = await new Promise<Blob>((resolve) =>
                      canvas.toBlob((b) => resolve(b!), 'image/webp', 0.85)
                    );
                    
                    const fileName = `${Date.now()}.webp`;
                    
                    // Delete old avatar if exists
                    if (practitionerForm.avatar_url) {
                      const oldPath = practitionerForm.avatar_url.split('/practitioner-avatars/')[1];
                      if (oldPath) {
                        await supabase.storage.from('practitioner-avatars').remove([oldPath]);
                      }
                    }
                    
                    const { error: uploadError } = await supabase.storage
                      .from('practitioner-avatars')
                      .upload(fileName, blob, { contentType: 'image/webp', upsert: true });
                    
                    if (uploadError) throw uploadError;
                    
                    const { data: { publicUrl } } = supabase.storage
                      .from('practitioner-avatars')
                      .getPublicUrl(fileName);
                    
                    setPractitionerForm(f => ({ ...f, avatar_url: publicUrl }));
                    toast.success('Avatar uploaded');
                  } catch (err: any) {
                    toast.error(err.message || 'Failed to upload avatar');
                  } finally {
                    setAvatarUploading(false);
                    if (avatarInputRef.current) avatarInputRef.current.value = '';
                  }
                }}
              />
              <div className="flex items-center gap-3">
                {practitionerForm.avatar_url ? (
                  <img
                    src={practitionerForm.avatar_url}
                    alt="Avatar preview"
                    className="w-14 h-14 rounded-full object-cover border-2 border-border"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center border-2 border-dashed border-border">
                    <Image className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={avatarUploading}
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    {avatarUploading ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    ) : (
                      <Upload className="w-4 h-4 mr-1" />
                    )}
                    {practitionerForm.avatar_url ? 'Replace' : 'Upload'}
                  </Button>
                  {practitionerForm.avatar_url && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={async () => {
                        const oldPath = practitionerForm.avatar_url!.split('/practitioner-avatars/')[1];
                        if (oldPath) {
                          await supabase.storage.from('practitioner-avatars').remove([oldPath]);
                        }
                        setPractitionerForm(f => ({ ...f, avatar_url: null }));
                        toast.success('Avatar removed');
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Practitioner type</label>
              <Input
                value={practitionerForm.practitioner_type}
                onChange={(e) => setPractitionerForm(f => ({ ...f, practitioner_type: e.target.value }))}
                placeholder="e.g. Naturopath, Dermatologist"
                maxLength={100}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">City *</label>
                <Input
                  value={practitionerForm.city}
                  onChange={(e) => setPractitionerForm(f => ({ ...f, city: e.target.value }))}
                  placeholder="City"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Country *</label>
                <Input
                  value={practitionerForm.country}
                  onChange={(e) => setPractitionerForm(f => ({ ...f, country: e.target.value }))}
                  placeholder="Country"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Website</label>
              <Input
                type="url"
                value={practitionerForm.website}
                onChange={(e) => setPractitionerForm(f => ({ ...f, website: e.target.value }))}
                placeholder="https://example.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Contact email</label>
              <Input
                type="email"
                value={practitionerForm.contact_email}
                onChange={(e) => setPractitionerForm(f => ({ ...f, contact_email: e.target.value }))}
                placeholder="clinic@example.com"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Contact phone</label>
              <Input
                type="tel"
                value={practitionerForm.contact_phone}
                onChange={(e) => setPractitionerForm(f => ({ ...f, contact_phone: e.target.value }))}
                placeholder="+1 234 567 8900"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Services *</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {practitionerForm.services.filter(Boolean).map((service, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2.5 py-1 rounded-full"
                  >
                    {service}
                    <button
                      type="button"
                      onClick={() =>
                        setPractitionerForm(f => ({
                          ...f,
                          services: f.services.filter((_, i) => i !== idx),
                        }))
                      }
                      className="ml-0.5 hover:text-destructive transition-colors"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <Input
                placeholder="Type a service and press Enter"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault();
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (val) {
                      setPractitionerForm(f => ({
                        ...f,
                        services: [...f.services.filter(Boolean), val],
                      }));
                      (e.target as HTMLInputElement).value = '';
                    }
                  }
                }}
                onBlur={(e) => {
                  const val = e.target.value.trim();
                  if (val) {
                    setPractitionerForm(f => ({
                      ...f,
                      services: [...f.services.filter(Boolean), val],
                    }));
                    e.target.value = '';
                  }
                }}
              />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Remote available</label>
              <Switch
                checked={practitionerForm.remote_available}
                onCheckedChange={(checked) => setPractitionerForm(f => ({ ...f, remote_available: checked }))}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">About (optional)</label>
              <Textarea
                value={practitionerForm.about}
                onChange={(e) => setPractitionerForm(f => ({ ...f, about: e.target.value }))}
                placeholder="Brief description (max 500 characters)"
                maxLength={500}
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">{practitionerForm.about.length}/500</p>
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Active (visible in directory)</label>
              <Switch
                checked={practitionerForm.is_active}
                onCheckedChange={(checked) => setPractitionerForm(f => ({ ...f, is_active: checked }))}
              />
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (!practitionerForm.name.trim() || !practitionerForm.city.trim() || !practitionerForm.country.trim()) {
                  toast.error('Name, city, and country are required');
                  return;
                }
                if (practitionerForm.services.length === 0) {
                  toast.error('At least one service is required');
                  return;
                }
                if (editingPractitioner) {
                  updatePractitionerMutation.mutate({ id: editingPractitioner, form: practitionerForm });
                } else {
                  addPractitionerMutation.mutate(practitionerForm);
                }
              }}
              disabled={addPractitionerMutation.isPending || updatePractitionerMutation.isPending}
            >
              {(addPractitionerMutation.isPending || updatePractitionerMutation.isPending) && (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              )}
              {editingPractitioner ? 'Save Changes' : 'Add Practitioner'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
                rows={6}
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
