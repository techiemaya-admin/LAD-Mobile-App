/**
 * Safe Storage utilities for SDK
 * Handles localStorage with fallback to memory storage
 * Used for token storage across the SDK
 */

class SafeStorage {
  private memoryStore: Map<string, string> = new Map();

  private isStorageAvailable(): boolean {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const test = '__storage_test__';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  getItem(key: string): string | null {
    try {
      // Try localStorage first
      if (this.isStorageAvailable()) {
        const value = localStorage.getItem(key);
        if (value) return value;
      }
      
      // Fallback to memory store
      return this.memoryStore.get(key) || null;
    } catch (e) {
      console.warn('[SafeStorage] getItem failed', e);
      return this.memoryStore.get(key) || null;
    }
  }

  setItem(key: string, value: string): void {
    try {
      // Save to localStorage if available
      if (this.isStorageAvailable()) {
        localStorage.setItem(key, value);
      }
      
      // Always save to memory store as backup
      this.memoryStore.set(key, value);
    } catch (e) {
      console.error('[SafeStorage] setItem failed', e);
      this.memoryStore.set(key, value);
    }
  }

  removeItem(key: string): void {
    try {
      if (this.isStorageAvailable()) {
        localStorage.removeItem(key);
      }
      this.memoryStore.delete(key);
    } catch (e) {
      console.warn('[SafeStorage] removeItem failed', e);
      this.memoryStore.delete(key);
    }
  }

  clear(): void {
    try {
      if (this.isStorageAvailable()) {
        localStorage.clear();
      }
      this.memoryStore.clear();
    } catch (e) {
      console.warn('[SafeStorage] clear failed', e);
      this.memoryStore.clear();
    }
  }
}

// Export singleton instance
export const safeStorage = new SafeStorage();
