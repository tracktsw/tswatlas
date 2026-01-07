import { registerPlugin } from '@capacitor/core';

/**
 * Android WindowInsets data bridged from native layer.
 * 
 * Source of truth: WindowInsets (not CSS env())
 * - systemBarsBottom: Bottom inset from system bars (status bar, nav bar)
 * - systemGesturesBottom: Bottom inset from gesture navigation areas
 * - navigationBarsBottom: Bottom inset specifically for navigation bar
 * - imeBottom: IME (keyboard) inset - kept separate, never mixed with nav
 */
export interface InsetsData {
  /** Top inset in pixels */
  top: number;
  /** Left inset in pixels */
  left: number;
  /** Right inset in pixels */
  right: number;
  /** Computed bottom inset: max(systemBars, systemGestures) */
  bottom: number;
  /** IME (keyboard) inset in pixels - separate from nav bar inset */
  imeBottom?: number;
  /** Navigation mode: 'gesture', '3button', or 'unknown' */
  navMode?: 'gesture' | '3button' | 'unknown';
  /** Raw systemBars bottom inset for debugging */
  systemBarsBottom?: number;
  /** Raw systemGestures bottom inset for debugging */
  systemGesturesBottom?: number;
  /** Raw navigationBars bottom inset for debugging */
  navigationBarsBottom?: number;
  /** Reason for this inset update */
  reason?: 'initial' | 'insetsChanged' | 'resume' | 'rotation' | 'configChanged';
}

export interface AndroidInsetsPlugin {
  /** Get current WindowInsets values */
  getInsets(): Promise<InsetsData>;
  
  /** Listen for inset changes (nav mode switch, rotation, resume) */
  addListener(
    eventName: 'insetsChanged',
    listenerFunc: (data: InsetsData) => void
  ): Promise<{ remove: () => Promise<void> }>;
}

const AndroidInsets = registerPlugin<AndroidInsetsPlugin>('AndroidInsets');

export default AndroidInsets;
