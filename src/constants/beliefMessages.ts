/**
 * Belief Reinforcement Notification Messages
 * 
 * Purpose: Reinforce understanding that flares follow patterns, not randomness.
 * Rules:
 * - Short, declarative statements
 * - Educational, authoritative tone
 * - No motivation, encouragement, or positivity
 * - No emojis, questions, or CTAs
 * - Core theme: flares are not random; reactions are delayed; patterns emerge with data
 */

export const BELIEF_MESSAGES: readonly string[] = [
  // Pattern recognition
  "Flares feel random until the pattern appears.",
  "Patterns don't show early. That's normal.",
  "Chaos is often just untracked order.",
  
  // Delayed reactions
  "Skin reactions are delayed. Triggers come first.",
  "Today's symptoms often start days earlier.",
  "Signals appear before symptoms.",
  
  // Data vs memory
  "Memory lies. Data doesn't.",
  "Early logs feel useless. They aren't.",
  
  // Control and understanding
  "Unpredictable doesn't mean uncontrollable.",
  
  // Time and consistency
  "One log shows nothing. A month shows everything.",
  "Consistency reveals what memory forgets.",
  "The body remembers what you ate three days ago.",
  
  // Tracking value
  "Every log is a data point. Data points become patterns.",
  "You can't see the pattern from inside the pattern.",
  "Flares have histories. Logs reveal them.",
  
  // Delayed causality
  "Cause and effect rarely happen on the same day.",
  "The trigger was days ago. The flare is now.",
  "What helped yesterday may show up tomorrow.",
  
  // Understanding over time
  "Symptoms are signals, not random noise.",
  "Bodies are predictable. Just not in real-time.",
  "The pattern exists. It just needs enough data.",
] as const;

/**
 * Get a random belief message from the pool.
 * Uses a simple random selection - for more sophisticated 
 * rotation (avoiding repeats), track shown messages in storage.
 */
export function getRandomBeliefMessage(): string {
  const index = Math.floor(Math.random() * BELIEF_MESSAGES.length);
  return BELIEF_MESSAGES[index];
}

/**
 * Get a belief message that hasn't been shown recently.
 * Pass an array of recently shown message indices to avoid.
 */
export function getBeliefMessageAvoidingRecent(recentIndices: number[]): {
  message: string;
  index: number;
} {
  // If we've shown all messages, reset
  if (recentIndices.length >= BELIEF_MESSAGES.length) {
    recentIndices = [];
  }
  
  // Get available indices
  const availableIndices = BELIEF_MESSAGES.map((_, i) => i)
    .filter(i => !recentIndices.includes(i));
  
  // Pick random from available
  const randomAvailableIndex = Math.floor(Math.random() * availableIndices.length);
  const messageIndex = availableIndices[randomAvailableIndex];
  
  return {
    message: BELIEF_MESSAGES[messageIndex],
    index: messageIndex,
  };
}
