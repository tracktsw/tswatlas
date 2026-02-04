
# Fix Meta StartTrial Event Tracking

## Problem Identified

The StartTrial event is being sent as a **custom event** with the string `"StartTrial"` rather than using the Facebook SDK's built-in **standard event constants**. This is why it's not appearing in your Meta Events Manager under Standard Events.

When you send `AppEvents.Name("StartTrial")` (iOS) or `logger.logEvent("StartTrial")` (Android), Meta treats it as a custom event, not the standard "Start Trial" event.

## Solution

Update both iOS and Android native code to use the SDK's predefined standard event constants instead of string literals.

---

## Technical Details

### 1. iOS Changes (MetaEventHandler.swift)

**Current Code:**
```swift
AppEvents.shared.logEvent(AppEvents.Name(eventName))
```

**Problem:** Creates a custom event name from the string "StartTrial"

**Fix:** Map incoming event names to Facebook SDK standard event constants:
```swift
// Map JS event names to SDK standard events
private func getAppEventName(_ eventName: String) -> AppEvents.Name {
    switch eventName {
    case "StartTrial":
        return .startTrial
    case "Subscribe":
        return .subscribe
    default:
        return AppEvents.Name(eventName) // Custom events
    }
}
```

### 2. Android Changes (MetaAnalyticsPlugin.java)

**Current Code:**
```java
logger.logEvent(eventName);
```

**Problem:** Creates a custom event with the string "StartTrial"

**Fix:** Map incoming event names to Facebook SDK standard event constants:
```java
// Map JS event names to SDK standard events
private String mapToStandardEvent(String eventName) {
    switch (eventName) {
        case "StartTrial":
            return AppEventsConstants.EVENT_NAME_START_TRIAL;
        case "Subscribe":
            return AppEventsConstants.EVENT_NAME_SUBSCRIBE;
        default:
            return eventName; // Custom events
    }
}
```

---

## Files to Modify

| File | Change |
|------|--------|
| `ios/App/App/MetaEventHandler.swift` | Add mapping from "StartTrial" → `AppEvents.Name.startTrial` |
| `android/app/src/main/java/app/tracktsw/atlas/MetaAnalyticsPlugin.java` | Add mapping from "StartTrial" → `AppEventsConstants.EVENT_NAME_START_TRIAL` |

---

## Why This Matters

- **Standard events** are recognized by Meta for optimization and attribution
- **Custom events** with string names don't get the same treatment
- The internal constants use prefixed names like `fb_mobile_start_trial` which Meta expects for standard event tracking

---

## After Implementation

Once deployed and a trial is started on a real device:
1. The event will appear under **Standard events** in Meta Events Manager
2. It will be properly attributed for Meta Ads campaigns
3. You can use the Meta **Test Events** tool to verify events are received

