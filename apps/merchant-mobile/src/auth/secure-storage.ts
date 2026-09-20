import * as SecureStore from 'expo-secure-store';

export interface ISecureStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  deleteItem(key: string): Promise<void>;
}

const memoryStore = new Map<string, string>();

export class MobileSecureStorage implements ISecureStorage {
  constructor(private readonly prefix: string) {}

  private prefixedKey(key: string): string {
    return `${this.prefix}_${key}`;
  }

  async getItem(key: string): Promise<string | null> {
    try {
      if (typeof SecureStore.getItemAsync === 'function') {
        const val = await SecureStore.getItemAsync(this.prefixedKey(key));
        if (val !== null) return val;
      }
    } catch (err) {
      void err;
    }
    return memoryStore.get(this.prefixedKey(key)) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    const pKey = this.prefixedKey(key);
    try {
      if (typeof SecureStore.setItemAsync === 'function') {
        await SecureStore.setItemAsync(pKey, value, {
          keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
        });
        return;
      }
    } catch (err) {
      void err;
    }
    memoryStore.set(pKey, value);
  }

  async deleteItem(key: string): Promise<void> {
    const pKey = this.prefixedKey(key);
    try {
      if (typeof SecureStore.deleteItemAsync === 'function') {
        await SecureStore.deleteItemAsync(pKey);
        return;
      }
    } catch (err) {
      void err;
    }
    memoryStore.delete(pKey);
  }

  clearMemoryForTest(): void {
    memoryStore.clear();
  }
}

export const merchantSecureStorage = new MobileSecureStorage('toranggo_merchant');
