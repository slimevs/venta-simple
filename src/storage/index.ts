// Almacenamiento con AsyncStorage si está disponible, con fallback en memoria.
type Engine = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

const memory: Record<string, string> = {};
let warned = false;

function memoryEngine(): Engine {
  if (!warned) {
    // eslint-disable-next-line no-console
    console.warn('[storage] AsyncStorage no disponible, usando memoria volátil');
    warned = true;
  }
  return {
    async getItem(key) {
      return key in memory ? memory[key] : null;
    },
    async setItem(key, value) {
      memory[key] = value;
    },
    async removeItem(key) {
      delete memory[key];
    },
  };
}

function detectEngine(): Engine {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('@react-native-async-storage/async-storage');
    const AsyncStorage = mod?.default ?? mod;
    if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
      return AsyncStorage as Engine;
    }
  } catch (_) {
    // ignore
  }
  // Web fallback si existe localStorage
  if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
    const ls = (globalThis as any).localStorage as Storage;
    return {
      async getItem(key) {
        return ls.getItem(key);
      },
      async setItem(key, value) {
        ls.setItem(key, value);
      },
      async removeItem(key) {
        ls.removeItem(key);
      },
    } as Engine;
  }
  return memoryEngine();
}

const engine = detectEngine();

export async function getJSON<T>(key: string, fallback: T): Promise<T> {
  const raw = await engine.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    return fallback;
  }
}

export async function setJSON<T>(key: string, value: T): Promise<void> {
  await engine.setItem(key, JSON.stringify(value));
}

export async function remove(key: string): Promise<void> {
  await engine.removeItem(key);
}

export const KEYS = {
  PRODUCTS: 'venta_simple_products',
  SALES: 'venta_simple_sales',
} as const;

