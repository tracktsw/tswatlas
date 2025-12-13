import { useState } from 'react';
import { BookOpen, Plus, Trash2, Edit2, Save, X } from 'lucide-react';
import { useLocalStorage } from '@/contexts/LocalStorageContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import PaywallGuard from '@/components/PaywallGuard';

const moodEmojis = ['😢', '😕', '😐', '🙂', '😊'];

const JournalPage = () => {
  const { journalEntries, addJournalEntry, updateJournalEntry, deleteJournalEntry } = useLocalStorage();
  const [isWriting, setIsWriting] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [newMood, setNewMood] = useState<number | undefined>();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

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
    <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Journal</h1>
          <p className="text-sm text-muted-foreground">Your healing thoughts</p>
        </div>
        <Dialog open={isWriting} onOpenChange={setIsWriting}>
          <DialogTrigger asChild>
            <Button className="gap-2 sage-gradient text-primary-foreground">
              <Plus className="w-4 h-4" />
              Write
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>New Journal Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">How are you feeling?</label>
                <div className="flex justify-between gap-2">
                  {moodEmojis.map((emoji, idx) => (
                    <button
                      key={idx}
                      onClick={() => setNewMood(newMood === idx + 1 ? undefined : idx + 1)}
                      className={cn(
                        'flex-1 py-2 text-xl rounded-lg transition-all',
                        newMood === idx + 1 
                          ? 'bg-primary/20 ring-2 ring-primary' 
                          : 'bg-muted/50 hover:bg-muted'
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">What's on your mind?</label>
                <Textarea 
                  placeholder="Write your thoughts, feelings, observations..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
              </div>
              <Button onClick={handleSave} className="w-full gap-2">
                <Save className="w-4 h-4" />
                Save Entry
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Entries */}
      {journalEntries.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No journal entries yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Start writing about your healing journey
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {journalEntries.map((entry) => (
            <div key={entry.id} className="glass-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {format(new Date(entry.timestamp), 'EEEE, MMM d')}
                  </span>
                  {entry.mood && (
                    <span className="text-lg">{moodEmojis[entry.mood - 1]}</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => handleEdit(entry.id)}
                    className="p-1.5 rounded-full hover:bg-muted transition-colors"
                  >
                    <Edit2 className="w-4 h-4 text-muted-foreground" />
                  </button>
                  <button 
                    onClick={() => handleDelete(entry.id)}
                    className="p-1.5 rounded-full hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {format(new Date(entry.timestamp), 'h:mm a')}
              </p>
              
              {editingId === entry.id ? (
                <div className="space-y-2">
                  <Textarea 
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveEdit} className="gap-1">
                      <Save className="w-3 h-3" />
                      Save
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setEditingId(null)}
                      className="gap-1"
                    >
                      <X className="w-3 h-3" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-foreground whitespace-pre-wrap">
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
