import { useState, useRef } from 'react';
import { Camera, Plus, Trash2, Image, Sparkles } from 'lucide-react';
import { useLocalStorage, BodyPart, Photo } from '@/contexts/LocalStorageContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import PaywallGuard from '@/components/PaywallGuard';
import { LeafIllustration, SparkleIllustration } from '@/components/illustrations';

const bodyParts: { value: BodyPart; label: string; emoji: string }[] = [
  { value: 'face', label: 'Face', emoji: '😊' },
  { value: 'neck', label: 'Neck', emoji: '🦒' },
  { value: 'arms', label: 'Arms', emoji: '💪' },
  { value: 'hands', label: 'Hands', emoji: '🤲' },
  { value: 'legs', label: 'Legs', emoji: '🦵' },
  { value: 'feet', label: 'Feet', emoji: '🦶' },
  { value: 'torso', label: 'Torso', emoji: '👕' },
  { value: 'back', label: 'Back', emoji: '🔙' },
];

const PhotoDiaryPage = () => {
  const { photos, addPhoto, deletePhoto, getPhotosByBodyPart } = useLocalStorage();
  const [selectedBodyPart, setSelectedBodyPart] = useState<BodyPart | 'all'>('all');
  const [isCapturing, setIsCapturing] = useState(false);
  const [newPhotoBodyPart, setNewPhotoBodyPart] = useState<BodyPart>('face');
  const [newPhotoNotes, setNewPhotoNotes] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [selectedPhotos, setSelectedPhotos] = useState<Photo[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredPhotos = selectedBodyPart === 'all' 
    ? photos 
    : getPhotosByBodyPart(selectedBodyPart);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      addPhoto({
        dataUrl,
        bodyPart: newPhotoBodyPart,
        timestamp: new Date().toISOString(),
        notes: newPhotoNotes || undefined,
      });
      setNewPhotoNotes('');
      setIsCapturing(false);
      toast.success('Photo saved locally');
    };
    reader.readAsDataURL(file);
  };

  const handleDelete = (id: string) => {
    deletePhoto(id);
    toast.success('Photo deleted');
  };

  const togglePhotoSelection = (photo: Photo) => {
    if (selectedPhotos.find(p => p.id === photo.id)) {
      setSelectedPhotos(prev => prev.filter(p => p.id !== photo.id));
    } else if (selectedPhotos.length < 2) {
      setSelectedPhotos(prev => [...prev, photo]);
    }
  };

  return (
    <PaywallGuard feature="Photo Diary">
    <div className="px-4 py-6 space-y-6 max-w-lg mx-auto relative">
      {/* Decorative elements */}
      <div className="decorative-blob w-32 h-32 bg-coral/25 -top-10 -left-10 fixed" />
      <div className="decorative-blob w-44 h-44 bg-honey/20 bottom-32 -right-16 fixed" />
      
      {/* Decorative illustrations */}
      <LeafIllustration variant="branch" className="w-24 h-20 fixed top-16 right-0 opacity-30 pointer-events-none" />
      <SparkleIllustration variant="trail" className="w-28 h-10 fixed bottom-56 left-0 opacity-25 pointer-events-none" />
      
      <div className="flex items-center justify-between animate-fade-in">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground text-warm-shadow">Photo Diary</h1>
          <p className="text-muted-foreground">Track your skin's progress</p>
        </div>
        {compareMode ? (
          <Button 
            variant="outline" 
            size="sm"
            className="rounded-xl"
            onClick={() => {
              setCompareMode(false);
              setSelectedPhotos([]);
            }}
          >
            Exit Compare
          </Button>
        ) : (
          <Button 
            variant="outline" 
            size="sm"
            className="rounded-xl"
            onClick={() => setCompareMode(true)}
            disabled={photos.length < 2}
          >
            Compare
          </Button>
        )}
      </div>

      {/* Compare View */}
      {compareMode && selectedPhotos.length === 2 && (
        <div className="glass-card-warm p-5 space-y-4 animate-scale-in">
          <h3 className="font-display font-bold text-center text-foreground">Side by Side Comparison</h3>
          <div className="grid grid-cols-2 gap-3">
            {selectedPhotos.map((photo, idx) => (
              <div key={photo.id} className="space-y-2">
                <img 
                  src={photo.dataUrl} 
                  alt={`Comparison ${idx + 1}`}
                  className="w-full aspect-square object-cover rounded-2xl shadow-warm"
                />
                <p className="text-xs text-muted-foreground text-center font-medium">
                  {format(new Date(photo.timestamp), 'MMM d, yyyy')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {compareMode && selectedPhotos.length < 2 && (
        <div className="glass-card p-5 text-center text-muted-foreground animate-fade-in">
          <Sparkles className="w-8 h-8 mx-auto mb-2 text-coral" />
          Select {2 - selectedPhotos.length} more photo{selectedPhotos.length === 0 ? 's' : ''} to compare
        </div>
      )}

      {/* Body Part Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide animate-slide-up" style={{ animationDelay: '0.05s' }}>
        <Button
          variant={selectedBodyPart === 'all' ? 'warm' : 'outline'}
          size="sm"
          onClick={() => setSelectedBodyPart('all')}
          className="shrink-0 rounded-xl"
        >
          All
        </Button>
        {bodyParts.map(({ value, label, emoji }) => (
          <Button
            key={value}
            variant={selectedBodyPart === value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedBodyPart(value)}
            className="shrink-0 rounded-xl"
          >
            {emoji} {label}
          </Button>
        ))}
      </div>

      {/* Add Photo Dialog */}
      <Dialog open={isCapturing} onOpenChange={setIsCapturing}>
        <DialogTrigger asChild>
          <Button variant="warm" className="w-full gap-2 h-12">
            <Plus className="w-5 h-5" />
            Add Photo
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-xl">Add New Photo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold mb-2 block">Body Part</label>
              <Select value={newPhotoBodyPart} onValueChange={(v) => setNewPhotoBodyPart(v as BodyPart)}>
                <SelectTrigger className="h-11 rounded-xl border-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bodyParts.map(({ value, label, emoji }) => (
                    <SelectItem key={value} value={value}>
                      {emoji} {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-semibold mb-2 block">Notes (optional)</label>
              <Textarea 
                placeholder="Any notes about this photo..."
                value={newPhotoNotes}
                onChange={(e) => setNewPhotoNotes(e.target.value)}
                rows={2}
                className="rounded-xl border-2 resize-none"
              />
            </div>
            <input 
              type="file" 
              accept="image/*" 
              capture="environment"
              ref={fileInputRef}
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button 
              variant="warm"
              className="w-full h-11 gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="w-5 h-5" />
              Take or Choose Photo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photos Grid */}
      {filteredPhotos.length === 0 ? (
        <div className="glass-card-warm p-8 text-center animate-fade-in relative overflow-hidden">
          <LeafIllustration variant="cluster" className="w-20 h-20 absolute -right-4 -bottom-4 opacity-15" />
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-coral/20 to-coral-light flex items-center justify-center relative">
            <Image className="w-8 h-8 text-coral" />
          </div>
          <p className="font-display font-bold text-lg text-foreground">No photos yet</p>
          <p className="text-muted-foreground mt-1">
            Start tracking your progress by adding a photo
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {filteredPhotos.map((photo, index) => {
            const isSelected = selectedPhotos.find(p => p.id === photo.id);
            const bodyPartInfo = bodyParts.find(b => b.value === photo.bodyPart);
            
            return (
              <div 
                key={photo.id} 
                className={cn(
                  'glass-card overflow-hidden group relative cursor-pointer transition-all duration-300 hover:shadow-warm hover:-translate-y-1 animate-scale-in',
                  compareMode && isSelected && 'ring-2 ring-coral shadow-glow-coral',
                  compareMode && 'hover:opacity-90'
                )}
                style={{ animationDelay: `${index * 0.05}s` }}
                onClick={() => compareMode && togglePhotoSelection(photo)}
              >
                <img 
                  src={photo.dataUrl} 
                  alt={`${photo.bodyPart} photo`}
                  className="w-full aspect-square object-cover"
                />
                <div className="p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold bg-coral/10 text-coral px-2.5 py-1 rounded-full">
                      {bodyPartInfo?.emoji} {bodyPartInfo?.label}
                    </span>
                    {!compareMode && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(photo.id); }}
                        className="p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-medium">
                    {format(new Date(photo.timestamp), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </PaywallGuard>
  );
};

export default PhotoDiaryPage;
