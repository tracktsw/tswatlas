import { useState } from 'react';
import { BookOpen, Plus, Trash2, Edit2, Save, X, Feather } from 'lucide-react';
import { useLocalStorage } from '@/contexts/LocalStorageContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import PaywallGuard from '@/components/PaywallGuard';
import { LeafIllustration, HeartIllustration } from '@/components/illustrations';
import { SparkleEffect } from '@/components/SparkleEffect';

const moodEmojis = ['😢', '😕', '😐', '🙂', '😊'];

const JournalPage = () => {
  const { journalEntries, addJournalEntry, updateJournalEntry, deleteJournalEntry } = useLocalStorage();
  const [isWriting, setIsWriting] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newMood, setNewMood] = useState<number | undefined>();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [showSparkles, setShowSparkles] = useState(false);

  const handleSave = () => {
    if (!newContent.trim()) {
      toast.error('Please write something first');
      return;
    }
    
    addJournalEntry({
      timestamp: new Date().toISOString(),
      content: newContent.trim(),
      mood: newMood,
    });
    
    // Show celebration sparkles
    setShowSparkles(true);
    
    setNewContent('');
    setNewMood(undefined);
    setIsWriting(false);
    toast.success('Journal entry saved');
  };

  const handleEdit = (id: string) => {
    const entry = journalEntries.find(e => e.id === id);
    if (entry) {
      setEditingId(id);
      setEditContent(entry.content);
    }
  };

  const handleSaveEdit = () => {
    if (editingId && editContent.trim()) {
      updateJournalEntry(editingId, editContent.trim());
      setEditingId(null);
      setEditContent('');
      toast.success('Entry updated');
    }
  };

  const handleDelete = (id: string) => {
    deleteJournalEntry(id);
    toast.success('Entry deleted');
  };

  return (
    <PaywallGuard feature="Journal">
    <div className="px-4 py-6 space-y-6 max-w-lg mx-auto relative">
      {/* Sparkle celebration effect */}
      <SparkleEffect isActive={showSparkles} onComplete={() => setShowSparkles(false)} />
      
      {/* Decorative elements */}
      <div className="decorative-blob w-36 h-36 bg-primary/25 -top-10 -right-10 fixed" />
      <div className="decorative-blob w-40 h-40 bg-honey/20 bottom-32 -left-16 fixed" />
      
      {/* Decorative illustrations */}
      <LeafIllustration variant="branch" className="w-24 h-20 fixed top-20 right-0 opacity-25 pointer-events-none" />
      <HeartIllustration variant="decorated" className="w-16 h-16 fixed bottom-52 left-0 opacity-20 pointer-events-none" />
      
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground text-warm-shadow">Journal</h1>
          <p className="text-muted-foreground">Your healing thoughts</p>
        </div>
        <Dialog open={isWriting} onOpenChange={setIsWriting}>
          <DialogTrigger asChild>
            <Button variant="warm" className="gap-2">
              <Plus className="w-4 h-4" />
              Write
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="font-display text-xl">New Journal Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-semibold mb-2 block">How are you feeling?</label>
                <div className="flex justify-between gap-2">
                  {moodEmojis.map((emoji, idx) => (
                    <button
                      key={idx}
                      onClick={() => setNewMood(newMood === idx + 1 ? undefined : idx + 1)}
                      className={cn(
                        'flex-1 py-3 text-xl rounded-2xl transition-all duration-300',
                        newMood === idx + 1 
                          ? 'bg-gradient-to-br from-coral/20 to-coral-light shadow-warm scale-110' 
                          : 'bg-muted/50 hover:bg-muted hover:scale-105'
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold mb-2 block">What's on your mind?</label>
                <Textarea 
                  placeholder="Write your thoughts, feelings, observations..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={6}
                  className="resize-none rounded-xl border-2"
                />
              </div>
              <Button onClick={handleSave} variant="warm" className="w-full h-11 gap-2">
                <Save className="w-4 h-4" />
                Save Entry
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Entries */}
      {journalEntries.length === 0 ? (
        <div className="glass-card-warm p-8 text-center animate-fade-in relative overflow-hidden">
          <LeafIllustration variant="cluster" className="w-20 h-20 absolute -right-4 -bottom-4 opacity-15" />
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-primary/20 to-sage-light flex items-center justify-center animate-float relative">
            <Feather className="w-8 h-8 text-primary" />
          </div>
          <p className="font-display font-bold text-lg text-foreground">No journal entries yet</p>
          <p className="text-muted-foreground mt-1">
            Start writing about your healing journey
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {journalEntries.map((entry, index) => (
            <div 
              key={entry.id} 
              className="glass-card p-5 space-y-3 animate-slide-up hover:shadow-warm transition-all duration-300"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-foreground">
                    {format(new Date(entry.timestamp), 'EEEE, MMM d')}
                  </span>
                  {entry.mood && (
                    <span className="text-xl">{moodEmojis[entry.mood - 1]}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => handleEdit(entry.id)}
                    className="p-2 rounded-xl hover:bg-muted transition-colors"
                  >
                    <Edit2 className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button 
                    onClick={() => handleDelete(entry.id)}
                    className="p-2 rounded-xl hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground font-medium">
                {format(new Date(entry.timestamp), 'h:mm a')}
              </p>
              
              {editingId === entry.id ? (
                <div className="space-y-3">
                  <Textarea 
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={4}
                    className="resize-none rounded-xl border-2"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveEdit} variant="warm" className="gap-1.5 rounded-xl">
                      <Save className="w-3.5 h-3.5" />
                      Save
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setEditingId(null)}
                      className="gap-1.5 rounded-xl"
                    >
                      <X className="w-3.5 h-3.5" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                  {entry.content}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
    </PaywallGuard>
  );
};

export default JournalPage;
