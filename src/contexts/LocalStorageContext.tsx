import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type BodyPart = 'face' | 'neck' | 'arms' | 'hands' | 'legs' | 'feet' | 'torso' | 'back';

export interface Photo {
  id: string;
  dataUrl: string;
  bodyPart: BodyPart;
  timestamp: string;
  notes?: string;
}

export interface CheckIn {
  id: string;
  timestamp: string;
  timeOfDay: 'morning' | 'evening';
  treatments: string[];
  mood: number; // 1-5
  skinFeeling: number; // 1-5
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

interface LocalStorageContextType {
  photos: Photo[];
  checkIns: CheckIn[];
  journalEntries: JournalEntry[];
  reminderSettings: ReminderSettings;
  voterId: string;
  addPhoto: (photo: Omit<Photo, 'id'>) => void;
  deletePhoto: (id: string) => void;
  addCheckIn: (checkIn: Omit<CheckIn, 'id'>) => void;
  addJournalEntry: (entry: Omit<JournalEntry, 'id'>) => void;
  updateJournalEntry: (id: string, content: string) => void;
  deleteJournalEntry: (id: string) => void;
  updateReminderSettings: (settings: ReminderSettings) => void;
  getPhotosByBodyPart: (bodyPart: BodyPart) => Photo[];
}

const LocalStorageContext = createContext<LocalStorageContextType | undefined>(undefined);

const generateId = () => Math.random().toString(36).substring(2, 15);

const getOrCreateVoterId = (): string => {
  const stored = localStorage.getItem('tsw_voter_id');
  if (stored) return stored;
  const newId = `voter_${generateId()}`;
  localStorage.setItem('tsw_voter_id', newId);
  return newId;
};

export const LocalStorageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [reminderSettings, setReminderSettings] = useState<ReminderSettings>({
    enabled: true,
    morningTime: '08:00',
    eveningTime: '20:00',
  });
  const [voterId] = useState<string>(getOrCreateVoterId);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const storedPhotos = localStorage.getItem('tsw_photos');
      const storedCheckIns = localStorage.getItem('tsw_check_ins');
      const storedJournalEntries = localStorage.getItem('tsw_journal_entries');
      const storedReminderSettings = localStorage.getItem('tsw_reminder_settings');

      if (storedPhotos) setPhotos(JSON.parse(storedPhotos));
      if (storedCheckIns) setCheckIns(JSON.parse(storedCheckIns));
      if (storedJournalEntries) setJournalEntries(JSON.parse(storedJournalEntries));
      if (storedReminderSettings) setReminderSettings(JSON.parse(storedReminderSettings));
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
  }, []);

  // Save to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem('tsw_photos', JSON.stringify(photos));
  }, [photos]);

  useEffect(() => {
    localStorage.setItem('tsw_check_ins', JSON.stringify(checkIns));
  }, [checkIns]);

  useEffect(() => {
    localStorage.setItem('tsw_journal_entries', JSON.stringify(journalEntries));
  }, [journalEntries]);

  useEffect(() => {
    localStorage.setItem('tsw_reminder_settings', JSON.stringify(reminderSettings));
  }, [reminderSettings]);

  const addPhoto = useCallback((photo: Omit<Photo, 'id'>) => {
    const newPhoto = { ...photo, id: generateId() };
    setPhotos(prev => [newPhoto, ...prev]);
  }, []);

  const deletePhoto = useCallback((id: string) => {
    setPhotos(prev => prev.filter(p => p.id !== id));
  }, []);

  const addCheckIn = useCallback((checkIn: Omit<CheckIn, 'id'>) => {
    const newCheckIn = { ...checkIn, id: generateId() };
    setCheckIns(prev => [newCheckIn, ...prev]);
  }, []);

  const addJournalEntry = useCallback((entry: Omit<JournalEntry, 'id'>) => {
    const newEntry = { ...entry, id: generateId() };
    setJournalEntries(prev => [newEntry, ...prev]);
  }, []);

  const updateJournalEntry = useCallback((id: string, content: string) => {
    setJournalEntries(prev => prev.map(e => e.id === id ? { ...e, content } : e));
  }, []);

  const deleteJournalEntry = useCallback((id: string) => {
    setJournalEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  const updateReminderSettings = useCallback((settings: ReminderSettings) => {
    setReminderSettings(settings);
  }, []);

  const getPhotosByBodyPart = useCallback((bodyPart: BodyPart) => {
    return photos.filter(p => p.bodyPart === bodyPart).sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, [photos]);

  return (
    <LocalStorageContext.Provider
      value={{
        photos,
        checkIns,
        journalEntries,
        reminderSettings,
        voterId,
        addPhoto,
        deletePhoto,
        addCheckIn,
        addJournalEntry,
        updateJournalEntry,
        deleteJournalEntry,
        updateReminderSettings,
        getPhotosByBodyPart,
      }}
    >
      {children}
    </LocalStorageContext.Provider>
  );
};

export const useLocalStorage = () => {
  const context = useContext(LocalStorageContext);
  if (context === undefined) {
    throw new Error('useLocalStorage must be used within a LocalStorageProvider');
  }
  return context;
};
