import { registerPlugin } from '@capacitor/core';

export interface InsetsData {
  /** Bottom inset in pixels (max of systemBars and systemGestures) */
  bottom: number;
  top: number;
  left: number;
  right: number;
  /** IME (keyboard) inset in pixels - separate from nav bar inset */
  imeBottom?: number;
  /** Navigation mode: 'gesture', '3button', or 'unknown' */
  navMode?: 'gesture' | '3button' | 'unknown';
}

export interface AndroidInsetsPlugin {
  getInsets(): Promise<InsetsData>;
  addListener(
    eventName: 'insetsChanged',
    listenerFunc: (data: InsetsData) => void
  ): Promise<{ remove: () => Promise<void> }>;
}

const AndroidInsets = registerPlugin<AndroidInsetsPlugin>('AndroidInsets');

export default AndroidInsets;
