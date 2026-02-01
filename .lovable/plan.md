
# Multi-Language Support for TrackTSW

## Overview

Implementing internationalization (i18n) to allow users to switch the app language to common European languages. The user would select their preferred language in Settings, and all UI text would update accordingly.

## Supported Languages

- **English** (en) - Default
- **German** (de) - Deutsch
- **French** (fr) - Francais
- **Spanish** (es) - Espanol
- **Italian** (it) - Italiano
- **Dutch** (nl) - Nederlands
- **Portuguese** (pt) - Portugues

## Translation Accuracy

**Short answer: Yes, translations can be highly accurate.**

The approach:
1. Use AI-assisted translation (Lovable AI) to generate initial translations for all ~400-500 text strings
2. Translations will be reviewed for context-specific terminology (medical/skin care terms)
3. The translation files are stored as JSON, making it easy to refine specific phrases later
4. Community members who speak these languages could help validate translations

**Important considerations:**
- Medical/TSW terminology needs careful handling (e.g., "flare", "oozing", "topical steroid withdrawal")
- Emoji/mood labels remain universal
- Dates/times will auto-format based on locale (e.g., "13. Januar 2026" in German)

---

## Architecture

```text
src/
  i18n/
    index.ts              # i18next configuration
    locales/
      en/
        common.json       # General UI (buttons, labels, navigation)
        checkin.json      # Check-in page specific
        settings.json     # Settings page specific
        insights.json     # Insights/charts
        home.json         # Home page
        ...
      de/
        common.json
        checkin.json
        ...
      fr/
        ...
      (etc.)
```

---

## Implementation Steps

### Step 1: Database Migration

Add a `language` column to `user_settings` to persist the user's choice:

```sql
ALTER TABLE user_settings 
ADD COLUMN language TEXT DEFAULT 'en';
```

### Step 2: Install i18next Dependencies

- `i18next` - Core internationalization framework
- `react-i18next` - React bindings for i18next
- `i18next-browser-languagedetector` - Auto-detect browser language on first visit

### Step 3: Create i18n Configuration

Set up i18next with:
- Fallback to English if translation missing
- Lazy loading of language files
- Integration with React context

### Step 4: Extract All Hardcoded Strings

This is the largest task. Every page contains hardcoded English text that needs extraction:

| Page/Component | Estimated Strings |
|----------------|-------------------|
| HomePage | ~30 |
| CheckInPage | ~80 |
| SettingsPage | ~50 |
| InsightsPage | ~40 |
| PhotoDiaryPage | ~25 |
| CommunityPage | ~30 |
| JournalPage | ~20 |
| CoachPage | ~15 |
| BottomNav | 6 |
| Onboarding | ~60 |
| Common UI (buttons, toasts) | ~50 |
| **Total** | **~400 strings** |

**Before:**
```typescript
<h1>Settings</h1>
<p>Customize your experience</p>
```

**After:**
```typescript
const { t } = useTranslation('settings');

<h1>{t('title')}</h1>
<p>{t('subtitle')}</p>
```

### Step 5: Create Translation Files

Generate JSON files for each language with all extracted strings. Example structure:

```json
// en/settings.json
{
  "title": "Settings",
  "subtitle": "Customize your experience",
  "nightMode": "Night Mode",
  "nightModeDesc": "Easier on your eyes in the dark",
  "dailyReminder": "Daily Reminder",
  "cloudSync": "Cloud Sync",
  ...
}
```

```json
// de/settings.json
{
  "title": "Einstellungen",
  "subtitle": "Personalisiere deine Erfahrung",
  "nightMode": "Nachtmodus",
  "nightModeDesc": "Schont deine Augen im Dunkeln",
  "dailyReminder": "Tagliche Erinnerung",
  "cloudSync": "Cloud-Synchronisierung",
  ...
}
```

### Step 6: Add Language Selector to Settings

Add a new settings card with a language dropdown:

```text
+----------------------------------+
|  [Globe Icon]  Language          |
|  Choose your preferred language  |
|  [Dropdown: English v]           |
+----------------------------------+
```

When changed:
1. Update `user_settings.language` in database
2. Call `i18n.changeLanguage(selectedLang)`
3. Show toast: "Language changed to Deutsch"

### Step 7: Update Email Templates (Optional Enhancement)

Emails could also be translated based on user's stored language preference:
- Welcome email
- Password reset email
- Re-engagement email

This would require the edge functions to check `user_settings.language` and select the appropriate template.

---

## Technical Details

### Language Context Provider

```typescript
// Wraps the app to provide language context
<LanguageProvider>
  <App />
</LanguageProvider>
```

The provider:
- Syncs language preference with database
- Loads user's saved language on login
- Falls back to browser language for new users

### Date/Number Formatting

Use `date-fns` locale support for proper date formatting:
```typescript
import { de, fr, es } from 'date-fns/locale';

format(date, 'MMMM d, yyyy', { locale: de })
// Output: "13. Januar 2026"
```

### Handling Dynamic Content

For user-generated content (notes, journal entries, treatment names):
- These remain in the language the user wrote them
- Only UI chrome/labels are translated

---

## Scope Summary

| Component | Changes Required |
|-----------|-----------------|
| Database | Add `language` column |
| Dependencies | Add i18next packages |
| New Files | ~15 translation JSON files |
| Modified Files | All pages and most components (~40 files) |
| Settings Page | Add language selector UI |
| Edge Functions (optional) | Template translations for emails |

---

## Timeline Estimate

This is a significant undertaking:
- **Phase 1** (Core setup): i18n configuration, language selector, 1-2 key pages translated
- **Phase 2** (Full coverage): All pages and components converted
- **Phase 3** (Polish): Date formatting, email translations, validation

---

## Limitations

1. **AI Coach responses** - These come from AI models and would remain in English (or the language the user writes in)
2. **Treatment/symptom names from database** - Community-submitted treatments are in English; translating these would require a separate translation layer
3. **Push notifications** - Would need native code updates for iOS/Android to support translated notification content

