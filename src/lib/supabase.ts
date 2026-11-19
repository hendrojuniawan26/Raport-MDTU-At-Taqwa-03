import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const STORAGE_URL_KEY = 'mdtu_supabase_url';
const STORAGE_ANON_KEY = 'mdtu_supabase_anon_key';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  source: 'env' | 'localStorage' | 'unconfigured';
}

export function getSupabaseConfig(): SupabaseConfig {
  const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

  const localUrl =
    typeof window !== 'undefined'
      ? (window.localStorage.getItem(STORAGE_URL_KEY) || '').trim()
      : '';
  const localKey =
    typeof window !== 'undefined'
      ? (window.localStorage.getItem(STORAGE_ANON_KEY) || '').trim()
      : '';

  // Prioritize runtime localStorage override if user configured it in UI, else env
  if (localUrl && localKey) {
    return { url: localUrl, anonKey: localKey, source: 'localStorage' };
  }

  const isPlaceholderEnv =
    !envUrl ||
    !envKey ||
    envUrl.includes('your-project-ref') ||
    envKey.includes('your-supabase-anon-key');

  if (!isPlaceholderEnv) {
    return { url: envUrl, anonKey: envKey, source: 'env' };
  }

  return { url: '', anonKey: '', source: 'unconfigured' };
}

let cachedClient: SupabaseClient | null = null;
let cachedSignature = '';

export function getSupabaseClient(): SupabaseClient | null {
  const cfg = getSupabaseConfig();
  if (!cfg.url || !cfg.anonKey) {
    cachedClient = null;
    cachedSignature = '';
    return null;
  }

  const signature = `${cfg.url}::${cfg.anonKey}`;
  if (!cachedClient || cachedSignature !== signature) {
    cachedClient = createClient(cfg.url, cfg.anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    cachedSignature = signature;
  }

  return cachedClient;
}

export function createEphemeralSupabaseClient(): SupabaseClient | null {
  const cfg = getSupabaseConfig();
  if (!cfg.url || !cfg.anonKey) return null;
  return createClient(cfg.url, cfg.anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function saveSupabaseConfig(url: string, anonKey: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_URL_KEY, url.trim());
  window.localStorage.setItem(STORAGE_ANON_KEY, anonKey.trim());
  cachedClient = null;
  cachedSignature = '';
}

export function clearSupabaseConfig(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_URL_KEY);
  window.localStorage.removeItem(STORAGE_ANON_KEY);
  cachedClient = null;
  cachedSignature = '';
}

export async function testSupabaseConnection(
  url: string,
  anonKey: string
): Promise<{ ok: boolean; message: string }> {
  try {
    if (!url.startsWith('https://') || !anonKey) {
      return {
        ok: false,
        message: 'URL harus diawali https:// dan Anon Key tidak boleh kosong.',
      };
    }

    const tempClient = createClient(url.trim(), anonKey.trim(), {
      auth: { persistSession: false },
    });

    const { error } = await tempClient
      .from('madrasah_settings')
      .select('id')
      .limit(1);

    if (error) {
      if (
        error.message.includes('relation') ||
        error.code === '42P01' ||
        error.message.includes('schema cache')
      ) {
        return {
          ok: false,
          message:
            'Proyek Supabase ditemukan, tetapi tabel belum dibuat. Jalankan SQL Schema di SQL Editor Supabase terlebih dahulu.',
        };
      }
      if (error.code === '42501' || error.message.includes('permission')) {
        return {
          ok: true,
          message:
            'Terhubung ke Supabase. Silakan masuk atau daftar akun untuk mengakses data.',
        };
      }
      return { ok: false, message: `Gagal terhubung: ${error.message}` };
    }

    return {
      ok: true,
      message: 'Koneksi Supabase aktif dan skema database siap digunakan.',
    };
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error ? err.message : 'Terjadi kesalahan koneksi jaringan.',
    };
  }
}
