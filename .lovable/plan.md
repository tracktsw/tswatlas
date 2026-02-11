

# TSW Practitioner Directory

## Overview
Add a new "Practitioners" page to the app that displays a directory of clinics/practitioners supporting TSW patients. The page will sit next to Resources in the bottom navigation. It includes a detail page for each clinic and an admin management tab.

## Database

### New table: `practitioners`

| Column | Type | Nullable | Default | Notes |
|---|---|---|---|---|
| id | uuid | No | gen_random_uuid() | Primary key |
| name | text | No | - | Clinic/practitioner name |
| practitioner_type | text | Yes | - | e.g. "Naturopath", "Dermatologist" |
| city | text | No | - | City location |
| country | text | No | - | Country location |
| website | text | Yes | - | Clinic website URL |
| contact_email | text | Yes | - | Email (one contact method) |
| contact_phone | text | Yes | - | Phone (one contact method) |
| services | text[] | No | '{}' | Array of enum-like values: 'meditation', 'cap_therapy', 'naturopathy' |
| remote_available | boolean | No | false | Whether remote sessions are offered |
| about | text | Yes | - | Optional description, max 500 chars |
| is_active | boolean | No | true | Admin toggle for visibility |
| sort_order | integer | No | 0 | For future use |
| created_at | timestamptz | No | now() | |
| updated_at | timestamptz | No | now() | |

### RLS Policies
- **SELECT**: Anyone can view active practitioners (`is_active = true`)
- **INSERT/UPDATE/DELETE**: Admin only (using existing `has_role` function)

### Trigger
- Reuse existing `update_updated_at_column` trigger for the `updated_at` field

## New Files

### 1. `src/pages/PractitionerDirectoryPage.tsx`
- Uses the exact same layout container as ResourcesPage: `px-4 md:px-8 lg:px-12 py-6 space-y-6 max-w-lg md:max-w-none mx-auto safe-area-inset-top`
- Same decorative background blobs and PlantIllustration pattern
- Header with Lucide `Building2` icon (no emojis), matching the Resources page header style
- Small disclaimer text below the header: "Listings are paid placements. TrackTSW does not rank or endorse practitioners."
- Fetches practitioners ordered alphabetically by name, filtered to `is_active = true`
- Each clinic rendered as a `glass-card` button (same as resource cards) with:
  - Clinic name (bold) and City, Country subtitle
  - Service pills using `Badge` components
  - "Remote" badge if applicable
  - ChevronRight arrow on the right
  - Staggered `animate-slide-up` animations
- Empty state matching the Resources empty state pattern
- Loading skeleton matching the Resources loading pattern

### 2. `src/pages/PractitionerDetailPage.tsx`
- Uses the same detail-page layout as `ResourceDetailPage.tsx`
- Same decorative background, back button style, and glass-card content area
- Displays: name, practitioner type, city + country, website link, contact method, services as badges, about section
- "Visit website" button styled identically to the "Read full source" button on ResourceDetailPage
- No booking links, reviews, ratings, or recommendations

## Modified Files

### 3. `src/App.tsx`
- Add lazy import for `PractitionerDirectoryPage` and `PractitionerDetailPage`
- Add routes: `/practitioners` and `/practitioners/:id` inside the protected layout routes

### 4. `src/components/BottomNav.tsx`
- Add nav item for Practitioners between Resources and the end, using `Building2` icon with label "Directory"
- Add preload entry for `/practitioners`
- This will make 7 nav items total

### 5. `src/pages/AdminPage.tsx`
- Add a 4th tab "Directory" to the existing Tabs component (change `grid-cols-3` to `grid-cols-4`)
- Admin can: add, edit, delete/deactivate practitioners
- Form fields: name, practitioner_type, city, country, website, contact_email, contact_phone, services (multi-select checkboxes), remote_available (switch), about (textarea with 500 char limit), is_active toggle
- Services are fixed options: Meditation, CAP therapy, Naturopathy
- List view shows all practitioners (including inactive, marked with a badge)

## Technical Details

- Services stored as a PostgreSQL text array, validated in the UI to only allow the three fixed values
- The structured data approach (separate city/country columns, services array) makes it straightforward to add filters later without schema changes
- Alphabetical ordering is handled by the database query (`ORDER BY name ASC`)
- No search or filters in v1, but the schema supports adding them without refactoring
