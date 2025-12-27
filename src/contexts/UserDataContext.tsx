import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { processImageForUpload, getThumbnailPath } from '@/utils/imageCompression';

export type BodyPart = 'face' | 'neck' | 'arms' | 'hands' | 'legs' | 'feet' | 'torso' | 'back';

export interface Photo {
  id: string;
  photoUrl: string;
  thumbnailUrl: string;
  bodyPart: BodyPart;
  timestamp: string;
  notes?: string;
}

export interface CheckIn {
  id: string;
  timestamp: string;
  timeOfDay: 'morning' | 'evening';
  treatments: string[];
  mood: number;
  skinFeeling: number;
  notes?: string;
}

export interface JournalEntry {
  id: string;
  timestamp: string;
  content: string;
  mood?: number;
  photoIds?: string[];
}

export interface ReminderSettings {
  enabled: boolean;
  morningTime: string;
  eveningTime: string;
}

interface UserDataContextType {
  photos: Photo[];
  checkIns: CheckIn[];
  journalEntries: JournalEntry[];
  reminderSettings: ReminderSettings;
  customTreatments: string[];
  tswStartDate: string | null;
  isLoading: boolean;
  isSyncing: boolean;
  addPhoto: (photo: { dataUrl: string; bodyPart: BodyPart; notes?: string }) => Promise<void>;
  deletePhoto: (id: string) => Promise<void>;
  addCheckIn: (checkIn: Omit<CheckIn, 'id' | 'timestamp'>) => Promise<void>;
  updateCheckIn: (id: string, checkIn: Omit<CheckIn, 'id' | 'timestamp'>) => Promise<void>;
  addJournalEntry: (entry: Omit<JournalEntry, 'id' | 'timestamp'>) => Promise<void>;
  updateJournalEntry: (id: string, content: string) => Promise<void>;
  deleteJournalEntry: (id: string) => Promise<void>;
  updateReminderSettings: (settings: ReminderSettings) => Promise<void>;
  addCustomTreatment: (treatment: string) => Promise<void>;
  getPhotosByBodyPart: (bodyPart: BodyPart) => Photo[];
  setTswStartDate: (date: string | null) => Promise<void>;
}

const UserDataContext = createContext<UserDataContextType | undefined>(undefined);

export const UserDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [customTreatments, setCustomTreatments] = useState<string[]>([]);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>({
    enabled: true,
    morningTime: '08:00',
    eveningTime: '20:00',
  });
  const [tswStartDate, setTswStartDateState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    };
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Load data when user changes
  useEffect(() => {
    if (userId) {
      loadUserData();
    } else {
      setIsLoading(false);
    }
  }, [userId]);

  const loadUserData = async () => {
    if (!userId) return;
    
    setIsLoading(true);
    try {
      // Check if user has cloud data
      const { data: settings } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (!settings) {
        // First login - migrate localStorage data to cloud
        await migrateLocalStorageToCloud();
      } else {
        // Load from cloud
        await fetchCloudData();
      }
    } catch (error) {
      console.error('Error loading user data:', error);
      toast({
        title: "Sync Error",
        description: "Failed to load your data. Using local cache.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const migrateLocalStorageToCloud = async () => {
    if (!userId) return;
    
    setIsSyncing(true);
    try {
      // Get localStorage data
      const storedPhotos = localStorage.getItem('tsw_photos');
      const storedCheckIns = localStorage.getItem('tsw_check_ins');
      const storedJournalEntries = localStorage.getItem('tsw_journal_entries');
      const storedReminderSettings = localStorage.getItem('tsw_reminder_settings');
      const storedCustomTreatments = localStorage.getItem('tsw_custom_treatments');
      const storedTswStartDate = localStorage.getItem('tsw_start_date');

      const localPhotos = storedPhotos ? JSON.parse(storedPhotos) : [];
      const localCheckIns = storedCheckIns ? JSON.parse(storedCheckIns) : [];
      const localJournalEntries = storedJournalEntries ? JSON.parse(storedJournalEntries) : [];
      const localReminderSettings = storedReminderSettings ? JSON.parse(storedReminderSettings) : {
        enabled: true,
        morningTime: '08:00',
        eveningTime: '20:00',
      };
      const localCustomTreatments = storedCustomTreatments ? JSON.parse(storedCustomTreatments) : [];

      // Create user settings
      await supabase.from('user_settings').insert({
        user_id: userId,
        tsw_start_date: storedTswStartDate || null,
        custom_treatments: localCustomTreatments,
        reminders_enabled: localReminderSettings.enabled,
        morning_time: localReminderSettings.morningTime,
        evening_time: localReminderSettings.eveningTime,
      });

      // Upload photos to storage and create records
      for (const photo of localPhotos) {
        if (photo.dataUrl) {
          const fileName = `${userId}/${Date.now()}-${Math.random().toString(36).substring(2)}.jpg`;
          const base64Data = photo.dataUrl.split(',')[1];
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'image/jpeg' });

          const { error: uploadError } = await supabase.storage
            .from('user-photos')
            .upload(fileName, blob);

          if (!uploadError) {
            const { data: { publicUrl } } = supabase.storage
              .from('user-photos')
              .getPublicUrl(fileName);

            await supabase.from('user_photos').insert({
              user_id: userId,
              body_part: photo.bodyPart,
              photo_url: fileName,
              notes: photo.notes || null,
              created_at: photo.timestamp,
            });
          }
        }
      }

      // Migrate check-ins
      for (const checkIn of localCheckIns) {
        await supabase.from('user_check_ins').insert({
          user_id: userId,
          time_of_day: checkIn.timeOfDay,
          treatments: checkIn.treatments,
          mood: checkIn.mood,
          skin_feeling: checkIn.skinFeeling,
          notes: checkIn.notes || null,
          created_at: checkIn.timestamp,
        });
      }

      // Migrate journal entries
      for (const entry of localJournalEntries) {
        await supabase.from('user_journal_entries').insert({
          user_id: userId,
          content: entry.content,
          mood: entry.mood || null,
          photo_ids: entry.photoIds || null,
          created_at: entry.timestamp,
        });
      }

      // Clear localStorage after successful migration
      localStorage.removeItem('tsw_photos');
      localStorage.removeItem('tsw_check_ins');
      localStorage.removeItem('tsw_journal_entries');
      localStorage.removeItem('tsw_reminder_settings');
      localStorage.removeItem('tsw_custom_treatments');
      localStorage.removeItem('tsw_start_date');

      toast({
        title: "Data Synced!",
        description: "Your existing data has been synced to the cloud.",
      });

      // Load the migrated data
      await fetchCloudData();
    } catch (error) {
      console.error('Migration error:', error);
      toast({
        title: "Migration Error",
        description: "Some data may not have been synced.",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const fetchCloudData = async () => {
    if (!userId) return;

    try {
      // Fetch settings
      const { data: settings } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (settings) {
        setTswStartDateState(settings.tsw_start_date);
        setCustomTreatments(settings.custom_treatments || []);
        setReminderSettings({
          enabled: settings.reminders_enabled,
          morningTime: settings.morning_time,
          eveningTime: settings.evening_time,
        });
      }

      // Fetch photos
      const { data: photosData } = await supabase
        .from('user_photos')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (photosData && photosData.length > 0) {
        // Get all photo paths including thumbnails
        const photoPaths = photosData.map(photo => photo.photo_url);
        const thumbnailPaths = photoPaths.map(path => getThumbnailPath(path));
        const allPaths = [...photoPaths, ...thumbnailPaths];
        
        // Batch generate signed URLs for all photos and thumbnails (30 day cache)
        const { data: signedUrls } = await supabase.storage
          .from('user-photos')
          .createSignedUrls(allPaths, 60 * 60 * 24 * 30); // 30 day signed URLs for caching

        const photosWithUrls = photosData.map((photo, index) => ({
          id: photo.id,
          photoUrl: signedUrls?.[index]?.signedUrl || '',
          // Thumbnail URL is in the second half of the array
          thumbnailUrl: signedUrls?.[index + photosData.length]?.signedUrl || signedUrls?.[index]?.signedUrl || '',
          bodyPart: photo.body_part as BodyPart,
          timestamp: photo.created_at,
          notes: photo.notes || undefined,
        }));
        setPhotos(photosWithUrls);
      } else {
        setPhotos([]);
      }

      // Fetch check-ins
      const { data: checkInsData } = await supabase
        .from('user_check_ins')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (checkInsData) {
        setCheckIns(checkInsData.map(c => ({
          id: c.id,
          timestamp: c.created_at,
          timeOfDay: c.time_of_day as 'morning' | 'evening',
          treatments: c.treatments,
          mood: c.mood,
          skinFeeling: c.skin_feeling,
          notes: c.notes || undefined,
        })));
      }

      // Fetch journal entries
      const { data: journalData } = await supabase
        .from('user_journal_entries')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (journalData) {
        setJournalEntries(journalData.map(j => ({
          id: j.id,
          timestamp: j.created_at,
          content: j.content,
          mood: j.mood || undefined,
          photoIds: j.photo_ids || undefined,
        })));
      }
    } catch (error) {
      console.error('Error fetching cloud data:', error);
    }
  };

  const addPhoto = useCallback(async (photo: { dataUrl: string; bodyPart: BodyPart; notes?: string }) => {
    if (!userId) return;

    try {
      // Process image: generates original, medium, and thumbnail versions
      const processed = await processImageForUpload(photo.dataUrl, userId);
      
      // Upload all three versions in parallel
      const [mediumResult, thumbResult, originalResult] = await Promise.all([
        // Medium image (1200px) for fullscreen/compare
        supabase.storage
          .from('user-photos')
          .upload(processed.medium.fileName, processed.medium.blob, {
            contentType: processed.format.mimeType,
            cacheControl: '31536000', // 1 year cache
          }),
        // Thumbnail (400px) for grid view
        supabase.storage
          .from('user-photos')
          .upload(processed.thumbnail.fileName, processed.thumbnail.blob, {
            contentType: processed.format.mimeType,
            cacheControl: '31536000', // 1 year cache
          }),
        // Original for backup/export
        supabase.storage
          .from('user-photos')
          .upload(processed.original.fileName, processed.original.blob, {
            contentType: 'image/jpeg',
            cacheControl: '31536000', // 1 year cache
          }),
      ]);

      if (mediumResult.error) throw mediumResult.error;

      if (thumbResult.error) {
        console.warn('Thumbnail upload failed, continuing without thumbnail:', thumbResult.error);
      }
      
      if (originalResult.error) {
        console.warn('Original upload failed, continuing without original:', originalResult.error);
      }

      const { data: insertedPhoto, error: insertError } = await supabase
        .from('user_photos')
        .insert({
          user_id: userId,
          body_part: photo.bodyPart,
          photo_url: processed.medium.fileName,
          notes: photo.notes || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Generate signed URLs for medium and thumbnail (30 day cache)
      const [mediumUrlData, thumbUrlData] = await Promise.all([
        supabase.storage.from('user-photos').createSignedUrl(processed.medium.fileName, 60 * 60 * 24 * 30),
        supabase.storage.from('user-photos').createSignedUrl(processed.thumbnail.fileName, 60 * 60 * 24 * 30),
      ]);

      const newPhoto: Photo = {
        id: insertedPhoto.id,
        photoUrl: mediumUrlData.data?.signedUrl || '',
        thumbnailUrl: thumbUrlData.data?.signedUrl || mediumUrlData.data?.signedUrl || '',
        bodyPart: photo.bodyPart,
        timestamp: insertedPhoto.created_at,
        notes: photo.notes,
      };

      setPhotos(prev => [newPhoto, ...prev]);
    } catch (error) {
      console.error('Error adding photo:', error);
      throw error;
    }
  }, [userId]);

  const deletePhoto = useCallback(async (id: string) => {
    if (!userId) return;

    try {
      const photo = photos.find(p => p.id === id);
      if (!photo) return;

      // Get the file path from the database
      const { data: photoData } = await supabase
        .from('user_photos')
        .select('photo_url')
        .eq('id', id)
        .single();

      if (photoData) {
        await supabase.storage.from('user-photos').remove([photoData.photo_url]);
      }

      await supabase.from('user_photos').delete().eq('id', id);
      setPhotos(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting photo:', error);
      throw error;
    }
  }, [userId, photos]);

  const addCheckIn = useCallback(async (checkIn: Omit<CheckIn, 'id' | 'timestamp'>) => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('user_check_ins')
        .insert({
          user_id: userId,
          time_of_day: checkIn.timeOfDay,
          treatments: checkIn.treatments,
          mood: checkIn.mood,
          skin_feeling: checkIn.skinFeeling,
          notes: checkIn.notes || null,
        })
        .select()
        .single();

      if (error) throw error;

      const newCheckIn: CheckIn = {
        id: data.id,
        timestamp: data.created_at,
        timeOfDay: data.time_of_day as 'morning' | 'evening',
        treatments: data.treatments,
        mood: data.mood,
        skinFeeling: data.skin_feeling,
        notes: data.notes || undefined,
      };

      setCheckIns(prev => [newCheckIn, ...prev]);
    } catch (error) {
      console.error('Error adding check-in:', error);
      throw error;
    }
  }, [userId]);

  const updateCheckIn = useCallback(async (id: string, checkIn: Omit<CheckIn, 'id' | 'timestamp'>) => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('user_check_ins')
        .update({
          time_of_day: checkIn.timeOfDay,
          treatments: checkIn.treatments,
          mood: checkIn.mood,
          skin_feeling: checkIn.skinFeeling,
          notes: checkIn.notes || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      const updatedCheckIn: CheckIn = {
        id: data.id,
        timestamp: data.created_at,
        timeOfDay: data.time_of_day as 'morning' | 'evening',
        treatments: data.treatments,
        mood: data.mood,
        skinFeeling: data.skin_feeling,
        notes: data.notes || undefined,
      };

      setCheckIns(prev => prev.map(c => c.id === id ? updatedCheckIn : c));
    } catch (error) {
      console.error('Error updating check-in:', error);
      throw error;
    }
  }, [userId]);

  const addJournalEntry = useCallback(async (entry: Omit<JournalEntry, 'id' | 'timestamp'>) => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('user_journal_entries')
        .insert({
          user_id: userId,
          content: entry.content,
          mood: entry.mood || null,
          photo_ids: entry.photoIds || null,
        })
        .select()
        .single();

      if (error) throw error;

      const newEntry: JournalEntry = {
        id: data.id,
        timestamp: data.created_at,
        content: data.content,
        mood: data.mood || undefined,
        photoIds: data.photo_ids || undefined,
      };

      setJournalEntries(prev => [newEntry, ...prev]);
    } catch (error) {
      console.error('Error adding journal entry:', error);
      throw error;
    }
  }, [userId]);

  const updateJournalEntry = useCallback(async (id: string, content: string) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('user_journal_entries')
        .update({ content })
        .eq('id', id);

      if (error) throw error;

      setJournalEntries(prev => prev.map(e => e.id === id ? { ...e, content } : e));
    } catch (error) {
      console.error('Error updating journal entry:', error);
      throw error;
    }
  }, [userId]);

  const deleteJournalEntry = useCallback(async (id: string) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('user_journal_entries')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setJournalEntries(prev => prev.filter(e => e.id !== id));
    } catch (error) {
      console.error('Error deleting journal entry:', error);
      throw error;
    }
  }, [userId]);

  const updateReminderSettings = useCallback(async (settings: ReminderSettings) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('user_settings')
        .update({
          reminders_enabled: settings.enabled,
          morning_time: settings.morningTime,
          evening_time: settings.eveningTime,
        })
        .eq('user_id', userId);

      if (error) throw error;

      setReminderSettings(settings);
    } catch (error) {
      console.error('Error updating reminder settings:', error);
      throw error;
    }
  }, [userId]);

  const addCustomTreatment = useCallback(async (treatment: string) => {
    if (!userId) return;
    if (customTreatments.includes(treatment)) return;

    try {
      const newTreatments = [...customTreatments, treatment];
      
      const { error } = await supabase
        .from('user_settings')
        .update({ custom_treatments: newTreatments })
        .eq('user_id', userId);

      if (error) throw error;

      setCustomTreatments(newTreatments);
    } catch (error) {
      console.error('Error adding custom treatment:', error);
      throw error;
    }
  }, [userId, customTreatments]);

  const getPhotosByBodyPart = useCallback((bodyPart: BodyPart) => {
    return photos.filter(p => p.bodyPart === bodyPart).sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [photos]);

  const setTswStartDate = useCallback(async (date: string | null) => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from('user_settings')
        .update({ tsw_start_date: date })
        .eq('user_id', userId);

      if (error) throw error;

      setTswStartDateState(date);
    } catch (error) {
      console.error('Error updating TSW start date:', error);
      throw error;
    }
  }, [userId]);

  return (
    <UserDataContext.Provider
      value={{
        photos,
        checkIns,
        journalEntries,
        reminderSettings,
        customTreatments,
        tswStartDate,
        isLoading,
        isSyncing,
        addPhoto,
        deletePhoto,
        addCheckIn,
        updateCheckIn,
        addJournalEntry,
        updateJournalEntry,
        deleteJournalEntry,
        updateReminderSettings,
        addCustomTreatment,
        getPhotosByBodyPart,
        setTswStartDate,
      }}
    >
      {children}
    </UserDataContext.Provider>
  );
};

export const useUserData = () => {
  const context = useContext(UserDataContext);
  if (context === undefined) {
    throw new Error('useUserData must be used within a UserDataProvider');
  }
  return context;
};
