import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { processImageForUpload, getPublicUrl } from '@/utils/imageCompression';

export type BodyPart = 'face' | 'neck' | 'arms' | 'hands' | 'legs' | 'feet' | 'torso' | 'back';

export interface Photo {
  id: string;
  photoUrl: string; // medium URL for fullscreen
  thumbnailUrl: string; // thumb URL for grid
  originalUrl?: string; // original for export
  bodyPart: BodyPart;
  /** Display date: taken_at if available, otherwise created_at (upload date) */
  timestamp: string;
  /** Actual upload date (created_at) - used for daily limit tracking */
  createdAt: string;
  /** True if timestamp came from EXIF (taken_at), false if fallback to upload date */
  hasTakenAt: boolean;
  notes?: string;
}

export interface SymptomEntry {
  symptom: string;
  severity: 1 | 2 | 3; // 1 = Mild, 2 = Moderate, 3 = Severe
}

export interface CheckIn {
  id: string;
  timestamp: string;
  timeOfDay: 'morning' | 'evening';
  treatments: string[];
  mood: number;
  skinFeeling: number;
  skinIntensity?: number; // 4=High-intensity, 3=Active, 2=Noticeable, 1=Settling, 0=Calm
  painScore?: number; // 0-10 pain scale (optional)
  sleepScore?: number; // 1-5 sleep quality (optional): 1=Very poor, 2=Poor, 3=Okay, 4=Good, 5=Very good
  notes?: string;
  symptomsExperienced?: SymptomEntry[];
  triggers?: string[];
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
  reminderTime: string; // Single daily reminder time
  // Legacy fields kept for migration
  morningTime?: string;
  eveningTime?: string;
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
  userId: string | null;
  addPhoto: (photo: { dataUrl: string; bodyPart: BodyPart; notes?: string }) => Promise<void>;
  deletePhoto: (id: string) => Promise<void>;
  addCheckIn: (checkIn: Omit<CheckIn, 'id' | 'timestamp'>, clientRequestId: string) => Promise<void>;
  updateCheckIn: (id: string, checkIn: Omit<CheckIn, 'id' | 'timestamp'>) => Promise<void>;
  getTodayCheckInCount: () => number;
  addJournalEntry: (entry: Omit<JournalEntry, 'id' | 'timestamp'>) => Promise<void>;
  updateJournalEntry: (id: string, content: string) => Promise<void>;
  deleteJournalEntry: (id: string) => Promise<void>;
  updateReminderSettings: (settings: ReminderSettings) => Promise<void>;
  addCustomTreatment: (treatment: string) => Promise<void>;
  removeCustomTreatment: (treatment: string) => Promise<void>;
  getPhotosByBodyPart: (bodyPart: BodyPart) => Photo[];
  setTswStartDate: (date: string | null) => Promise<void>;
  /** Refresh photos from backend - call after external uploads */
  refreshPhotos: () => Promise<void>;
  /** Add a photo directly to state (optimistic update) */
  addPhotoToState: (photo: Photo) => void;
}

const UserDataContext = createContext<UserDataContextType | undefined>(undefined);

// Helper to safely parse symptoms from JSONB (handles both old string[] and new SymptomEntry[] formats)
const parseSymptoms = (data: unknown): SymptomEntry[] | undefined => {
  if (!data || !Array.isArray(data) || data.length === 0) return undefined;
  
  return data.map(item => {
    // New format: { symptom: string, severity: number }
    if (typeof item === 'object' && item !== null && 'symptom' in item) {
      return {
        symptom: String((item as { symptom: string }).symptom),
        severity: ((item as { severity?: number }).severity || 2) as 1 | 2 | 3,
      };
    }
    // Legacy format: just a string
    if (typeof item === 'string') {
      return { symptom: item, severity: 2 as const };
    }
    // Unknown format, skip
    return null;
  }).filter((s): s is SymptomEntry => s !== null);
};

export const UserDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [customTreatments, setCustomTreatments] = useState<string[]>([]);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>({
    enabled: true,
    reminderTime: '09:00', // Single daily reminder
  });
  const [tswStartDate, setTswStartDateState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const { toast } = useToast();

  // OPTIMIZED: Single auth listener - onAuthStateChange fires immediately with current session
  // No separate getUser() call needed - eliminates auth waterfall
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const newUserId = session?.user?.id || null;
      setUserId(newUserId);
      
      // Load data when we have a user, otherwise stop loading
      if (newUserId) {
        loadUserData(newUserId);
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserData = async (uid: string) => {
    if (!uid) return;
    
    setIsLoading(true);
    try {
      // Check if user has cloud data
      const { data: settings } = await supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle();

      if (!settings) {
        // First login - migrate localStorage data to cloud
        await migrateLocalStorageToCloud(uid);
      } else {
        // Load from cloud
        await fetchCloudData(uid);
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

  const migrateLocalStorageToCloud = async (uid: string) => {
    if (!uid) return;
    
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
        reminderTime: '09:00',
      };
      const localCustomTreatments = storedCustomTreatments ? JSON.parse(storedCustomTreatments) : [];

      // Create user settings
      await supabase.from('user_settings').insert({
        user_id: uid,
        tsw_start_date: storedTswStartDate || null,
        custom_treatments: localCustomTreatments,
        reminders_enabled: localReminderSettings.enabled,
        morning_time: localReminderSettings.reminderTime || localReminderSettings.morningTime || '09:00',
        evening_time: '20:00', // Legacy, not used
      });

      // Upload photos to storage and create records
      for (const photo of localPhotos) {
        if (photo.dataUrl) {
          const fileName = `${uid}/${Date.now()}-${Math.random().toString(36).substring(2)}.jpg`;
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
            await supabase.from('user_photos').insert({
              user_id: uid,
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
          user_id: uid,
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
          user_id: uid,
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
      await fetchCloudData(uid);
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

  const fetchCloudData = async (uid: string) => {
    if (!uid) return;

    try {
      // Fetch all data in parallel for faster loading
      const [settingsResult, photosResult, checkInsResult, journalResult] = await Promise.all([
        // Settings
        supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', uid)
          .maybeSingle(),
        // Photos with explicit URL columns
        supabase
          .from('user_photos')
          .select('id, photo_url, thumb_url, medium_url, original_url, body_part, created_at, taken_at, notes')
          .eq('user_id', uid)
          .order('created_at', { ascending: false }),
        // Check-ins
        supabase
          .from('user_check_ins')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false }),
        // Journal entries
        supabase
          .from('user_journal_entries')
          .select('*')
          .eq('user_id', uid)
          .order('created_at', { ascending: false }),
      ]);

      // Process settings
      if (settingsResult.data) {
        setTswStartDateState(settingsResult.data.tsw_start_date);
        setCustomTreatments(settingsResult.data.custom_treatments || []);
        setReminderSettings({
          enabled: settingsResult.data.reminders_enabled,
          // Use morning_time as the single reminder time (legacy migration)
          reminderTime: settingsResult.data.morning_time || '09:00',
        });
      }

      // Process photos
      if (photosResult.data && photosResult.data.length > 0) {
        const photosWithUrls = photosResult.data.map(photo => ({
          id: photo.id,
          photoUrl: photo.medium_url || photo.photo_url || '',
          thumbnailUrl: photo.thumb_url || photo.medium_url || photo.photo_url || '',
          originalUrl: photo.original_url || undefined,
          bodyPart: photo.body_part as BodyPart,
          timestamp: photo.taken_at || photo.created_at,
          createdAt: photo.created_at,
          hasTakenAt: !!photo.taken_at,
          notes: photo.notes || undefined,
        }));
        setPhotos(photosWithUrls);
      } else {
        setPhotos([]);
      }

      // Process check-ins
      if (checkInsResult.data) {
        setCheckIns(checkInsResult.data.map(c => ({
          id: c.id,
          timestamp: c.created_at,
          timeOfDay: c.time_of_day as 'morning' | 'evening',
          treatments: c.treatments,
          mood: c.mood,
          skinFeeling: c.skin_feeling,
          skinIntensity: (c as any).skin_intensity ?? undefined,
          painScore: (c as any).pain_score ?? undefined,
          sleepScore: (c as any).sleep_score ?? undefined,
          notes: c.notes || undefined,
          symptomsExperienced: parseSymptoms(c.symptoms_experienced),
          triggers: (c as any).triggers || undefined,
        })));
      }

      // Process journal entries
      if (journalResult.data) {
        setJournalEntries(journalResult.data.map(j => ({
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

  /**
   * Refresh only photos from backend - lightweight refresh for after uploads.
   * Used by useSingleUpload and other external upload flows.
   */
  const refreshPhotos = useCallback(async () => {
    if (!userId) return;

    try {
      const { data: photosData } = await supabase
        .from('user_photos')
        .select('id, photo_url, thumb_url, medium_url, original_url, body_part, created_at, taken_at, notes')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (photosData && photosData.length > 0) {
        // timestamp = taken_at (EXIF date) if available, else created_at (upload date)
        const photosWithUrls = photosData.map(photo => ({
          id: photo.id,
          photoUrl: photo.medium_url || photo.photo_url || '',
          thumbnailUrl: photo.thumb_url || photo.medium_url || photo.photo_url || '',
          originalUrl: photo.original_url || undefined,
          bodyPart: photo.body_part as BodyPart,
          // Display date: prefer taken_at (EXIF), fall back to created_at (upload)
          timestamp: photo.taken_at || photo.created_at,
          createdAt: photo.created_at,
          hasTakenAt: !!photo.taken_at,
          notes: photo.notes || undefined,
        }));
        setPhotos(photosWithUrls);
      } else {
        setPhotos([]);
      }
    } catch (error) {
      console.error('Error refreshing photos:', error);
    }
  }, [userId]);

  /**
   * Add a photo directly to state (optimistic update).
   * Call this immediately after a successful upload for instant UI feedback.
   */
  const addPhotoToState = useCallback((photo: Photo) => {
    setPhotos(prev => {
      // Avoid duplicates
      if (prev.some(p => p.id === photo.id)) return prev;
      return [photo, ...prev];
    });
  }, []);

  const reloadCheckIns = useCallback(async () => {
    if (!userId) {
      throw new Error('Please sign in to sync your check-ins.');
    }

    const { data: checkInsData, error } = await supabase
      .from('user_check_ins')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    setCheckIns(
      (checkInsData ?? []).map((c) => ({
        id: c.id,
        timestamp: c.created_at,
        timeOfDay: c.time_of_day as 'morning' | 'evening',
        treatments: c.treatments,
        mood: c.mood,
        skinFeeling: c.skin_feeling,
        skinIntensity: (c as any).skin_intensity ?? undefined,
        painScore: (c as any).pain_score ?? undefined,
        sleepScore: (c as any).sleep_score ?? undefined,
        notes: c.notes || undefined,
        symptomsExperienced: parseSymptoms(c.symptoms_experienced),
        triggers: (c as any).triggers || undefined,
      }))
    );
  }, [userId]);

  const addPhoto = useCallback(async (photo: { dataUrl: string; bodyPart: BodyPart; notes?: string }) => {
    if (!userId) return;

    let uploadedPaths: string[] = [];

    try {
      // Process image: generates UUID + original, medium, and thumbnail versions
      // Paths: {userId}/{photoId}/thumb.webp, medium.webp, original.jpg
      const processed = await processImageForUpload(photo.dataUrl, userId);
      
      // Upload all three versions to public "photos" bucket in parallel
      const [thumbResult, mediumResult, originalResult] = await Promise.all([
        // Thumbnail (400px WebP, quality 75) for grid view
        supabase.storage
          .from('photos')
          .upload(processed.thumbnail.path, processed.thumbnail.blob, {
            contentType: 'image/webp',
            cacheControl: '31536000',
          }),
        // Medium (1400px WebP, quality 80) for fullscreen/compare
        supabase.storage
          .from('photos')
          .upload(processed.medium.path, processed.medium.blob, {
            contentType: 'image/webp',
            cacheControl: '31536000',
          }),
        // Original JPEG for backup/export (no long cache)
        supabase.storage
          .from('photos')
          .upload(processed.original.path, processed.original.blob, {
            contentType: 'image/jpeg',
          }),
      ]);

      // Track successful uploads for cleanup on failure
      if (!thumbResult.error) uploadedPaths.push(processed.thumbnail.path);
      if (!mediumResult.error) uploadedPaths.push(processed.medium.path);
      if (!originalResult.error) uploadedPaths.push(processed.original.path);

      // Require at least thumb and medium to succeed
      if (thumbResult.error) {
        throw new Error(`Thumbnail upload failed: ${thumbResult.error.message}`);
      }
      if (mediumResult.error) {
        throw new Error(`Medium upload failed: ${mediumResult.error.message}`);
      }
      // Original is optional - warn but don't fail
      if (originalResult.error) {
        console.warn('Original upload failed:', originalResult.error);
      }

      // Generate public URLs (not signed - bucket is public)
      const thumbUrl = getPublicUrl(processed.thumbnail.path);
      const mediumUrl = getPublicUrl(processed.medium.path);
      const originalUrl = !originalResult.error ? getPublicUrl(processed.original.path) : null;

      // Insert with explicit URL columns storing public URLs
      const { data: insertedPhoto, error: insertError } = await supabase
        .from('user_photos')
        .insert({
          user_id: userId,
          body_part: photo.bodyPart,
          photo_url: mediumUrl, // Legacy field
          thumb_url: thumbUrl,
          medium_url: mediumUrl,
          original_url: originalUrl,
          notes: photo.notes || null,
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Database insert failed: ${insertError.message}`);
      }

      const newPhoto: Photo = {
        id: insertedPhoto.id,
        photoUrl: mediumUrl,
        thumbnailUrl: thumbUrl,
        originalUrl: originalUrl || undefined,
        bodyPart: photo.bodyPart,
        timestamp: insertedPhoto.created_at,
        createdAt: insertedPhoto.created_at,
        hasTakenAt: false, // addPhoto uses legacy flow, no EXIF extraction here
        notes: photo.notes,
      };

      setPhotos(prev => [newPhoto, ...prev]);
    } catch (error) {
      // Cleanup uploaded files on failure to avoid orphaned storage
      if (uploadedPaths.length > 0) {
        try {
          await supabase.storage.from('photos').remove(uploadedPaths);
        } catch (cleanupError) {
          console.warn('Failed to cleanup uploaded files:', cleanupError);
        }
      }
      console.error('Error adding photo:', error);
      throw error;
    }
  }, [userId]);

  const deletePhoto = useCallback(async (id: string) => {
    if (!userId) return;

    try {
      const photo = photos.find(p => p.id === id);
      if (!photo) return;

      // Get all file paths from the database
      const { data: photoData } = await supabase
        .from('user_photos')
        .select('photo_url, thumb_url, medium_url, original_url')
        .eq('id', id)
        .single();

      if (photoData) {
        // Extract storage paths from public URLs
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const bucketPrefix = `${supabaseUrl}/storage/v1/object/public/photos/`;
        
        const extractPath = (url: string | null): string | null => {
          if (!url) return null;
          if (url.startsWith(bucketPrefix)) {
            return url.slice(bucketPrefix.length);
          }
          // Legacy: if it's already a path (not a URL), use as-is
          if (!url.startsWith('http')) return url;
          return null;
        };

        const pathsToDelete = [
          extractPath(photoData.thumb_url),
          extractPath(photoData.medium_url),
          extractPath(photoData.original_url),
        ].filter(Boolean) as string[];

        // Remove duplicates
        const uniquePaths = [...new Set(pathsToDelete)];
        if (uniquePaths.length > 0) {
          await supabase.storage.from('photos').remove(uniquePaths);
        }
      }

      await supabase.from('user_photos').delete().eq('id', id);
      setPhotos(prev => prev.filter(p => p.id !== id));
    } catch (error) {
      console.error('Error deleting photo:', error);
      throw error;
    }
  }, [userId, photos]);

  // Debug flag for check-in logging
  const DEBUG_CHECKINS = true;

  // Get count of check-ins for today (user's local date)
  const getTodayCheckInCount = useCallback(() => {
    const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD format
    const todayCount = checkIns.filter(c => {
      const checkInDate = new Date(c.timestamp).toLocaleDateString('en-CA');
      return checkInDate === today;
    }).length;
    
    if (DEBUG_CHECKINS) {
      console.log('[CHECK-IN] Today check-in count:', todayCount, 'for date:', today);
    }
    
    return todayCount;
  }, [checkIns]);

  const addCheckIn = useCallback(
    async (checkIn: Omit<CheckIn, 'id' | 'timestamp'>, clientRequestId: string) => {
      if (!userId) {
        throw new Error('Please sign in to save check-ins.');
      }

      if (DEBUG_CHECKINS) {
        console.log('[CHECK-IN] Starting save with client_request_id:', clientRequestId);
      }

      // Check daily limit (max 1 per day - single daily check-in)
      const today = new Date().toLocaleDateString('en-CA');
      const todayCheckIns = checkIns.filter(c => {
        const checkInDate = new Date(c.timestamp).toLocaleDateString('en-CA');
        return checkInDate === today;
      });

      if (DEBUG_CHECKINS) {
        console.log('[CHECK-IN] Daily count before save:', todayCheckIns.length);
      }

      if (todayCheckIns.length >= 1) {
        throw new Error("You've already checked in today. Edit your existing check-in if needed.");
      }

      try {
        // Calculate skin_intensity from skinFeeling (1-5 → 4-0)
        const skinIntensity = 5 - checkIn.skinFeeling;

        const { data, error } = await supabase
          .from('user_check_ins')
          .insert({
            user_id: userId,
            time_of_day: checkIn.timeOfDay,
            treatments: checkIn.treatments,
            mood: checkIn.mood,
            skin_feeling: checkIn.skinFeeling,
            skin_intensity: skinIntensity,
            pain_score: checkIn.painScore ?? null,
            sleep_score: checkIn.sleepScore ?? null,
            notes: checkIn.notes || null,
            symptoms_experienced: JSON.parse(JSON.stringify(checkIn.symptomsExperienced || [])),
            triggers: checkIn.triggers || [],
            client_request_id: clientRequestId,
          })
          .select()
          .single();

        if (error) {
          // Check if this is a duplicate constraint violation (idempotent retry)
          if (error.code === '23505' && error.message.includes('client_request')) {
            if (DEBUG_CHECKINS) {
              console.log('[CHECK-IN] Duplicate request detected (idempotent), treating as success');
            }
            // This is a retry of an already-successful request - reload and return success
            await reloadCheckIns();
            return;
          }
          throw error;
        }

        if (DEBUG_CHECKINS) {
          console.log('[CHECK-IN] Save successful, id:', data.id);
        }

        // Confirm persistence by re-loading latest check-ins from backend
        await reloadCheckIns();

        // Keep optimistic UI snappy for slow networks (prepend in case reload is delayed)
        const newCheckIn: CheckIn = {
          id: data.id,
          timestamp: data.created_at,
          timeOfDay: data.time_of_day as 'morning' | 'evening',
          treatments: data.treatments,
          mood: data.mood,
          skinFeeling: data.skin_feeling,
          skinIntensity: (data as any).skin_intensity ?? undefined,
          painScore: (data as any).pain_score ?? undefined,
          sleepScore: (data as any).sleep_score ?? undefined,
          notes: data.notes || undefined,
          symptomsExperienced: parseSymptoms(data.symptoms_experienced),
          triggers: (data as any).triggers || undefined,
        };

        setCheckIns((prev) => (prev.some((c) => c.id === newCheckIn.id) ? prev : [newCheckIn, ...prev]));
      } catch (error: any) {
        if (DEBUG_CHECKINS) {
          console.log('[CHECK-IN] Save failed:', error?.message || error);
        }
        console.error('Error adding check-in:', error);
        throw error;
      }
    },
    [userId, reloadCheckIns, checkIns]
  );

  const updateCheckIn = useCallback(
    async (id: string, checkIn: Omit<CheckIn, 'id' | 'timestamp'>) => {
      if (!userId) {
        throw new Error('Please sign in to update check-ins.');
      }

      try {
        // Calculate skin_intensity from skinFeeling (1-5 → 4-0)
        const skinIntensity = 5 - checkIn.skinFeeling;

        const { data, error } = await supabase
          .from('user_check_ins')
          .update({
            time_of_day: checkIn.timeOfDay,
            treatments: checkIn.treatments,
            mood: checkIn.mood,
            skin_feeling: checkIn.skinFeeling,
            skin_intensity: skinIntensity,
            pain_score: checkIn.painScore ?? null,
            sleep_score: checkIn.sleepScore ?? null,
            notes: checkIn.notes || null,
            symptoms_experienced: JSON.parse(JSON.stringify(checkIn.symptomsExperienced || [])),
            triggers: checkIn.triggers || [],
          })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;

        // Confirm persistence by re-loading latest check-ins from backend
        await reloadCheckIns();

        // Immediate UI update
        setCheckIns((prev) =>
          prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  timeOfDay: data.time_of_day as 'morning' | 'evening',
                  treatments: data.treatments,
                  mood: data.mood,
                  skinFeeling: data.skin_feeling,
                  skinIntensity: (data as any).skin_intensity ?? undefined,
                  painScore: (data as any).pain_score ?? undefined,
                  sleepScore: (data as any).sleep_score ?? undefined,
                  notes: data.notes || undefined,
                  symptomsExperienced: parseSymptoms(data.symptoms_experienced),
                  triggers: (data as any).triggers || undefined,
                }
              : c
          )
        );
      } catch (error) {
        console.error('Error updating check-in:', error);
        throw error;
      }
    },
    [userId, reloadCheckIns]
  );

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

      setJournalEntries(prev => prev.map(e => 
        e.id === id ? { ...e, content } : e
      ));
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

  const removeCustomTreatment = useCallback(async (treatment: string) => {
    if (!userId) return;

    try {
      const newTreatments = customTreatments.filter(t => t !== treatment);
      
      const { error } = await supabase
        .from('user_settings')
        .update({ custom_treatments: newTreatments })
        .eq('user_id', userId);

      if (error) throw error;

      setCustomTreatments(newTreatments);
    } catch (error) {
      console.error('Error removing custom treatment:', error);
      throw error;
    }
  }, [userId, customTreatments]);

  const getPhotosByBodyPart = useCallback((bodyPart: BodyPart) => {
    return photos.filter(p => p.bodyPart === bodyPart);
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
        userId,
        addPhoto,
        deletePhoto,
        addCheckIn,
        updateCheckIn,
        addJournalEntry,
        updateJournalEntry,
        deleteJournalEntry,
        updateReminderSettings,
        addCustomTreatment,
        removeCustomTreatment,
        getPhotosByBodyPart,
        setTswStartDate,
        refreshPhotos,
        addPhotoToState,
        getTodayCheckInCount,
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
