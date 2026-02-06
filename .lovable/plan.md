
# Fix: Remove Character Limit on Resource Summary Textarea

## Problem Identified
The resource summary textarea in the Admin panel has a `maxLength={1000}` attribute that prevents typing beyond 1000 characters. This is too restrictive for educational resource summaries that may require more detailed content.

## Solution
Remove the hard character limit from the resource summary textarea to allow unrestricted text entry. The database uses PostgreSQL `text` type which has no practical limit.

---

## Technical Changes

### File: `src/pages/AdminPage.tsx`

**Current Code (lines 1095-1101):**
```typescript
<Textarea
  value={resourceSummary}
  onChange={(e) => setResourceSummary(e.target.value)}
  placeholder="Leave empty for AI-generated summary (5-8 sentences)"
  rows={4}
  maxLength={1000}  // ← Remove this
/>
```

**Updated Code:**
```typescript
<Textarea
  value={resourceSummary}
  onChange={(e) => setResourceSummary(e.target.value)}
  placeholder="Leave empty for AI-generated summary (5-8 sentences)"
  rows={6}
/>
```

### Additional Consideration
If you're using an Android device, the standard `Textarea` component may also have issues with certain keyboards (like SwiftKey). If problems persist after this fix, we can switch to the `AndroidSafeTextarea` component which handles Android IME quirks.

---

## Summary
| Change | Details |
|--------|---------|
| Remove `maxLength={1000}` | Allows unlimited character entry |
| Increase `rows={4}` → `rows={6}` | Better UX for longer summaries |
| Database impact | None (already supports unlimited text) |
