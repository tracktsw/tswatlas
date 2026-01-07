import { registerPlugin } from '@capacitor/core';

export interface InsetsData {
  bottom: number;
  top: number;
  left: number;
  right: number;
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
