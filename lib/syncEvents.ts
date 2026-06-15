import type { SyncOptions } from './sync';

type SyncCompletedListener = (event: { reason?: SyncOptions['reason'] }) => void;

const syncCompletedListeners = new Set<SyncCompletedListener>();

export function subscribeSyncCompleted(listener: SyncCompletedListener): () => void {
  syncCompletedListeners.add(listener);
  return () => {
    syncCompletedListeners.delete(listener);
  };
}

export function emitSyncCompleted(reason?: SyncOptions['reason']): void {
  for (const listener of syncCompletedListeners) {
    listener({ reason });
  }
}
