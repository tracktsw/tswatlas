
# Streamlined Onboarding Flow

## The Problem

The current onboarding has 6 screens, and analytics show that very few users complete it. Users are dropping off before they even create an account.

## Current Flow (6 screens)
1. **Screen 1**: Welcome / "Stop Guessing. Start Healing."
2. **Screen 2**: Pain points list (4 cards about TSW struggles)
3. **Screen 3**: Two feature screenshots (improvement + triggers)
4. **Screen 4**: Two feature screenshots (food + product analysis)
5. **Screen 5**: Two feature screenshots (symptoms + sleep)
6. **Screen 6**: Survey questions (3 dropdowns about TSW impact)

## Proposed New Flow (3 screens)

Reduce from 6 screens to 3 screens by consolidating the feature showcases into a single carousel:

| Screen | Content | Purpose |
|--------|---------|---------|
| **1** | Welcome + value prop | Hook them with the promise |
| **2** | Feature carousel (all 6 screenshots) | Show the app's value quickly |
| **3** | Quick survey (optional) | Gather user insights |

---

## Screen-by-Screen Changes

### Screen 1: Welcome (Keep mostly as-is)
- Keep the animated bar chart and "Stop Guessing. Start Healing."
- Change Skip button to black text for better visibility
- Button: "See How It Works"

### Screen 2: Feature Carousel (New - replaces screens 2-5)

A swipeable carousel showing all 6 feature screenshots with:
- **Main headline**: "Everything you need to understand your TSW"
- **Carousel dots** at the bottom for navigation
- **Auto-advance** every 4 seconds
- **Swipe gestures** supported

Each slide in the carousel:
```text
+-----------------------------------+
|  [Screenshot image]               |
|                                   |
|  "Turn 'good days' into a         |
|   repeatable strategy."           |
+-----------------------------------+
```

The 6 carousel slides (using existing images + subheadings):
1. onboarding-improvement.png - "Turn 'good days' into a repeatable strategy."
2. onboarding-triggers.png - "The flares are loud. The data is louder."
3. onboarding-food.png - "Log what you eat and see how your skin responds."
4. onboarding-product.png - "Identify products that appear before flares."
5. onboarding-symptoms.png - "Your symptoms are real. Your data makes them undeniable."
6. onboarding-sleep.png - "Your flares are stealing your sleep."

**Skip button**: Black text color (currently muted gray)

### Screen 3: Quick Survey (Keep screen 6)
- Keep the 3 survey questions
- Make Skip button black
- This is the final screen before account creation

---

## Technical Implementation

### Files to Modify

| File | Changes |
|------|---------|
| `OnboardingContext.tsx` | Change `totalScreens` from 6 to 3 |
| `OnboardingPage.tsx` | Update switch to only render 3 screens |
| `OnboardingScreen1.tsx` | Make Skip button black |
| `OnboardingScreen2.tsx` | **Replace entirely** with new carousel screen |
| `OnboardingScreen6.tsx` | Rename to Screen3, update progress, make Skip black |
| `OnboardingScreen3-5.tsx` | Delete (content merged into carousel) |
| `index.ts` | Update exports |

### New Screen 2 Component Structure

```typescript
// Uses existing embla-carousel-react
import { Carousel, CarouselContent, CarouselItem } from '@/components/ui/carousel';

const featureSlides = [
  { image: improvementImage, headline: "Turn 'good days' into a repeatable strategy." },
  { image: triggersImage, headline: "The flares are loud. The data is louder." },
  { image: foodImage, headline: "Log what you eat and see how your skin responds." },
  { image: productImage, headline: "Identify products that appear before flares." },
  { image: symptomsImage, headline: "Your symptoms are real. Your data makes them undeniable." },
  { image: sleepImage, headline: "Your flares are stealing your sleep." },
];

// Carousel with auto-play, dots indicator, and swipe support
<Carousel opts={{ loop: true }} plugins={[Autoplay({ delay: 4000 })]}>
  <CarouselContent>
    {featureSlides.map((slide, i) => (
      <CarouselItem key={i}>
        <img src={slide.image} />
        <p>{slide.headline}</p>
      </CarouselItem>
    ))}
  </CarouselContent>
  {/* Dot indicators */}
</Carousel>
```

### Skip Button Styling Update

```typescript
// Before (muted gray)
className="text-muted-foreground text-sm font-medium ..."

// After (black/foreground)
className="text-foreground text-sm font-semibold ..."
```

### Progress Bar Update

The `OnboardingProgress` component will now show 2 total steps (screen 2 = step 1, screen 3 = step 2). Screen 1 has no progress bar (it's the intro).

---

## Summary

| Metric | Before | After |
|--------|--------|-------|
| Total screens | 6 | 3 |
| Time to account creation | ~30+ seconds | ~15 seconds |
| Skip button visibility | Muted gray | Black (prominent) |
| Feature showcase | 3 separate screens | 1 carousel screen |

This reduces friction significantly while still showing all the app's value in a quick, swipeable format.
