import { useState, useRef } from 'react';
import { Camera, Plus, Trash2, ArrowLeft, ArrowRight, Image } from 'lucide-react';
import { useLocalStorage, BodyPart, Photo } from '@/contexts/LocalStorageContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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
    <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Photo Diary</h1>
          <p className="text-sm text-muted-foreground">Track your skin's progress</p>
        </div>
        {compareMode ? (
          <Button 
            variant="outline" 
            size="sm"
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
            onClick={() => setCompareMode(true)}
            disabled={photos.length < 2}
          >
            Compare
          </Button>
        )}
      </div>

      {/* Compare View */}
      {compareMode && selectedPhotos.length === 2 && (
        <div className="glass-card p-4 space-y-3">
          <h3 className="font-semibold text-center">Side by Side Comparison</h3>
          <div className="grid grid-cols-2 gap-2">
            {selectedPhotos.map((photo, idx) => (
              <div key={photo.id} className="space-y-1">
                <img 
                  src={photo.dataUrl} 
                  alt={`Comparison ${idx + 1}`}
                  className="w-full aspect-square object-cover rounded-lg"
                />
                <p className="text-xs text-muted-foreground text-center">
                  {format(new Date(photo.timestamp), 'MMM d, yyyy')}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {compareMode && selectedPhotos.length < 2 && (
        <div className="glass-card p-4 text-center text-muted-foreground">
          Select {2 - selectedPhotos.length} more photo{selectedPhotos.length === 0 ? 's' : ''} to compare
        </div>
      )}

      {/* Body Part Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        <Button
          variant={selectedBodyPart === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setSelectedBodyPart('all')}
          className="shrink-0"
        >
          All
        </Button>
        {bodyParts.map(({ value, label, emoji }) => (
          <Button
            key={value}
            variant={selectedBodyPart === value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setSelectedBodyPart(value)}
            className="shrink-0"
          >
            {emoji} {label}
          </Button>
        ))}
      </div>

      {/* Add Photo Dialog */}
      <Dialog open={isCapturing} onOpenChange={setIsCapturing}>
        <DialogTrigger asChild>
          <Button className="w-full gap-2 sage-gradient text-primary-foreground">
            <Plus className="w-4 h-4" />
            Add Photo
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add New Photo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Body Part</label>
              <Select value={newPhotoBodyPart} onValueChange={(v) => setNewPhotoBodyPart(v as BodyPart)}>
                <SelectTrigger>
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
              <label className="text-sm font-medium mb-2 block">Notes (optional)</label>
              <Textarea 
                placeholder="Any notes about this photo..."
                value={newPhotoNotes}
                onChange={(e) => setNewPhotoNotes(e.target.value)}
                rows={2}
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
              className="w-full gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="w-4 h-4" />
              Take or Choose Photo
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Photos Grid */}
      {filteredPhotos.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Image className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No photos yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Start tracking your progress by adding a photo
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filteredPhotos.map((photo) => {
            const isSelected = selectedPhotos.find(p => p.id === photo.id);
            const bodyPartInfo = bodyParts.find(b => b.value === photo.bodyPart);
            
            return (
              <div 
                key={photo.id} 
                className={cn(
                  'glass-card overflow-hidden group relative cursor-pointer transition-all',
                  compareMode && isSelected && 'ring-2 ring-primary',
                  compareMode && 'hover:opacity-90'
                )}
                onClick={() => compareMode && togglePhotoSelection(photo)}
              >
                <img 
                  src={photo.dataUrl} 
                  alt={`${photo.bodyPart} photo`}
                  className="w-full aspect-square object-cover"
                />
                <div className="p-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                      {bodyPartInfo?.emoji} {bodyPartInfo?.label}
                    </span>
                    {!compareMode && (
                      <button 
                        onClick={() => handleDelete(photo.id)}
                        className="p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-destructive" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(photo.timestamp), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PhotoDiaryPage;
