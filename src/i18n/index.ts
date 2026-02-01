import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import all translation files
import enCommon from './locales/en/common.json';
import enHome from './locales/en/home.json';
import enSettings from './locales/en/settings.json';
import enCheckin from './locales/en/checkin.json';
import enInsights from './locales/en/insights.json';
import enPhotos from './locales/en/photos.json';
import enCommunity from './locales/en/community.json';
import enJournal from './locales/en/journal.json';
import enCoach from './locales/en/coach.json';
import enOnboarding from './locales/en/onboarding.json';
import enAuth from './locales/en/auth.json';

import deCommon from './locales/de/common.json';
import deHome from './locales/de/home.json';
import deSettings from './locales/de/settings.json';
import deCheckin from './locales/de/checkin.json';
import deInsights from './locales/de/insights.json';
import dePhotos from './locales/de/photos.json';
import deCommunity from './locales/de/community.json';
import deJournal from './locales/de/journal.json';
import deCoach from './locales/de/coach.json';
import deOnboarding from './locales/de/onboarding.json';
import deAuth from './locales/de/auth.json';

import frCommon from './locales/fr/common.json';
import frHome from './locales/fr/home.json';
import frSettings from './locales/fr/settings.json';
import frCheckin from './locales/fr/checkin.json';
import frInsights from './locales/fr/insights.json';
import frPhotos from './locales/fr/photos.json';
import frCommunity from './locales/fr/community.json';
import frJournal from './locales/fr/journal.json';
import frCoach from './locales/fr/coach.json';
import frOnboarding from './locales/fr/onboarding.json';
import frAuth from './locales/fr/auth.json';

import esCommon from './locales/es/common.json';
import esHome from './locales/es/home.json';
import esSettings from './locales/es/settings.json';
import esCheckin from './locales/es/checkin.json';
import esInsights from './locales/es/insights.json';
import esPhotos from './locales/es/photos.json';
import esCommunity from './locales/es/community.json';
import esJournal from './locales/es/journal.json';
import esCoach from './locales/es/coach.json';
import esOnboarding from './locales/es/onboarding.json';
import esAuth from './locales/es/auth.json';

import itCommon from './locales/it/common.json';
import itHome from './locales/it/home.json';
import itSettings from './locales/it/settings.json';
import itCheckin from './locales/it/checkin.json';
import itInsights from './locales/it/insights.json';
import itPhotos from './locales/it/photos.json';
import itCommunity from './locales/it/community.json';
import itJournal from './locales/it/journal.json';
import itCoach from './locales/it/coach.json';
import itOnboarding from './locales/it/onboarding.json';
import itAuth from './locales/it/auth.json';

import nlCommon from './locales/nl/common.json';
import nlHome from './locales/nl/home.json';
import nlSettings from './locales/nl/settings.json';
import nlCheckin from './locales/nl/checkin.json';
import nlInsights from './locales/nl/insights.json';
import nlPhotos from './locales/nl/photos.json';
import nlCommunity from './locales/nl/community.json';
import nlJournal from './locales/nl/journal.json';
import nlCoach from './locales/nl/coach.json';
import nlOnboarding from './locales/nl/onboarding.json';
import nlAuth from './locales/nl/auth.json';

import ptCommon from './locales/pt/common.json';
import ptHome from './locales/pt/home.json';
import ptSettings from './locales/pt/settings.json';
import ptCheckin from './locales/pt/checkin.json';
import ptInsights from './locales/pt/insights.json';
import ptPhotos from './locales/pt/photos.json';
import ptCommunity from './locales/pt/community.json';
import ptJournal from './locales/pt/journal.json';
import ptCoach from './locales/pt/coach.json';
import ptOnboarding from './locales/pt/onboarding.json';
import ptAuth from './locales/pt/auth.json';

export const supportedLanguages = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
  { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
] as const;

export type SupportedLanguage = typeof supportedLanguages[number]['code'];

const resources = {
  en: {
    common: enCommon,
    home: enHome,
    settings: enSettings,
    checkin: enCheckin,
    insights: enInsights,
    photos: enPhotos,
    community: enCommunity,
    journal: enJournal,
    coach: enCoach,
    onboarding: enOnboarding,
    auth: enAuth,
  },
  de: {
    common: deCommon,
    home: deHome,
    settings: deSettings,
    checkin: deCheckin,
    insights: deInsights,
    photos: dePhotos,
    community: deCommunity,
    journal: deJournal,
    coach: deCoach,
    onboarding: deOnboarding,
    auth: deAuth,
  },
  fr: {
    common: frCommon,
    home: frHome,
    settings: frSettings,
    checkin: frCheckin,
    insights: frInsights,
    photos: frPhotos,
    community: frCommunity,
    journal: frJournal,
    coach: frCoach,
    onboarding: frOnboarding,
    auth: frAuth,
  },
  es: {
    common: esCommon,
    home: esHome,
    settings: esSettings,
    checkin: esCheckin,
    insights: esInsights,
    photos: esPhotos,
    community: esCommunity,
    journal: esJournal,
    coach: esCoach,
    onboarding: esOnboarding,
    auth: esAuth,
  },
  it: {
    common: itCommon,
    home: itHome,
    settings: itSettings,
    checkin: itCheckin,
    insights: itInsights,
    photos: itPhotos,
    community: itCommunity,
    journal: itJournal,
    coach: itCoach,
    onboarding: itOnboarding,
    auth: itAuth,
  },
  nl: {
    common: nlCommon,
    home: nlHome,
    settings: nlSettings,
    checkin: nlCheckin,
    insights: nlInsights,
    photos: nlPhotos,
    community: nlCommunity,
    journal: nlJournal,
    coach: nlCoach,
    onboarding: nlOnboarding,
    auth: nlAuth,
  },
  pt: {
    common: ptCommon,
    home: ptHome,
    settings: ptSettings,
    checkin: ptCheckin,
    insights: ptInsights,
    photos: ptPhotos,
    community: ptCommunity,
    journal: ptJournal,
    coach: ptCoach,
    onboarding: ptOnboarding,
    auth: ptAuth,
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'home', 'settings', 'checkin', 'insights', 'photos', 'community', 'journal', 'coach', 'onboarding', 'auth'],
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },
    react: {
      useSuspense: false, // Prevent suspense issues with lazy loading
    },
  });

export default i18n;
