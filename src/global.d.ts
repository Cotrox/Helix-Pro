export {};

type DesktopCollectionName = 'shooters' | 'sessions' | 'tournaments' | 'feedbacks';

interface DesktopAPI {
  readCollection: (collectionName: DesktopCollectionName) => Promise<any[]>;
  writeCollection: (collectionName: DesktopCollectionName, items: any[]) => Promise<{ success: true }>;
  openExternal?: (url: string) => Promise<{ success: true }>;
}

declare global {
  interface Window {
    desktopAPI?: DesktopAPI;
  }
}