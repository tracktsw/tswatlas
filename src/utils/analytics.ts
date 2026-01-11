import posthog from 'posthog-js';

// Storage key for pending onboarding survey
const PENDING_ONBOARDING_KEY = 'pending_onboarding_survey';

// Mapping for TSW impact (Q1)
const TSW_IMPACT_MAP: Record<string, string> = {
  mild: 'mild',
  frustrating: 'manageable',
  disrupting: 'disrupting',
  takeover: 'severe',
};

// Mapping for hardest issue (Q2)
const HARDEST_ISSUE_MAP: Record<string, string> = {
  sleep: 'sleep',
  pain: 'pain_burning',
  itch: 'itch',
  appearance: 'appearance',
  mental: 'mental_health',
  flares: 'unpredictable_flares',
  triggers: 'unknown_triggers',
};

// Mapping for primary goal (Q3)
const PRIMARY_GOAL_MAP: Record<string, string> = {
  triggers: 'understand_triggers',
  track: 'track_symptoms',
  improving: 'see_improving',
  control: 'more_control',
  reduce: 'reduce_flares',
  exploring: 'exploring',
};

interface OnboardingSurveyPayload {
  tsw_impact: string;
  hardest_issue: string;
  primary_goal: string;
}

/**
 * Store onboarding survey answers in localStorage.
 * Maps UI values to analytics enum values.
 * Does NOT send event - that happens after auth.
 */
export function storePendingOnboardingSurvey(
  impactLevel: string,
  hardest: string,
  hoping: string
): void {
  const payload: OnboardingSurveyPayload = {
    tsw_impact: TSW_IMPACT_MAP[impactLevel] || impactLevel,
    hardest_issue: HARDEST_ISSUE_MAP[hardest] || hardest,
    primary_goal: PRIMARY_GOAL_MAP[hoping] || hoping,
  };
  
  localStorage.setItem(PENDING_ONBOARDING_KEY, JSON.stringify(payload));
}

/**
 * Check if there's a pending onboarding survey to send.
 */
export function hasPendingOnboardingSurvey(): boolean {
  return localStorage.getItem(PENDING_ONBOARDING_KEY) !== null;
}

/**
 * Send pending onboarding survey after successful auth.
 * Identifies user and captures event, then removes from localStorage.
 * Must only be called once after signup/login with valid user.id.
 */
export function sendPendingOnboardingSurvey(userId: string): void {
  const stored = localStorage.getItem(PENDING_ONBOARDING_KEY);
  if (!stored) return;
  
  try {
    const payload = JSON.parse(stored) as OnboardingSurveyPayload;
    
    // Identify user first
    posthog.identify(userId);
    
    // Send the onboarding survey event
    posthog.capture('onboarding_survey_submitted', {
      tsw_impact: payload.tsw_impact,
      hardest_issue: payload.hardest_issue,
      primary_goal: payload.primary_goal,
    });
    
    // Remove from localStorage immediately after sending
    localStorage.removeItem(PENDING_ONBOARDING_KEY);
  } catch (error) {
    console.error('[Analytics] Failed to send onboarding survey:', error);
    // Remove corrupted data
    localStorage.removeItem(PENDING_ONBOARDING_KEY);
  }
}

/**
 * Identify user after login (without onboarding survey).
 * Called when user logs in and there's no pending survey.
 */
export function identifyUser(userId: string): void {
  posthog.identify(userId);
}

// Context types for AI coach messages
type CoachContext = 'general' | 'flare' | 'sleep' | 'symptoms' | 'triggers';

/**
 * Track AI coach message sent (after successful API response).
 */
export function trackAICoachMessage(messageLength: number, context: CoachContext = 'general'): void {
  posthog.capture('ai_coach_message_sent', {
    message_length: messageLength,
    context,
  });
}

// Photo source types
type PhotoSource = 'camera' | 'library';

/**
 * Track photo logged (after successful upload).
 * Does NOT send image URL or metadata.
 */
export function trackPhotoLogged(photoType: string, source: PhotoSource): void {
  posthog.capture('photo_logged', {
    photo_type: photoType,
    source,
  });
}

/**
 * Track check-in completed (after successful submission).
 * Does NOT send check-in content.
 */
export function trackCheckInCompleted(checkinType: string = 'daily'): void {
  posthog.capture('check_in_completed', {
    checkin_type: checkinType,
  });
}

/**
 * Track insights card/screen opened.
 */
export function trackInsightsClicked(insightId: string, location: string): void {
  posthog.capture('insights_clicked', {
    insight_id: insightId,
    location,
  });
}
