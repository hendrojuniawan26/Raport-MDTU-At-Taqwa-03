import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const STORAGE_URL_KEY = 'mdtu_supabase_url';
const STORAGE_ANON_KEY = 'mdtu_supabase_anon_key';

export type SupabaseConfigSource = 'env' | 'server' | 'localStorage' | 'unconfigured';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  source: SupabaseConfigSource;
}

let serverConfigCache: { url: string; anonKey: string; source?: 'server' | 'env' } | null =
  null;
let urlParamsChecked = false;

function isPlaceholderConfig(url: string, key: string): boolean {
  return (
    !url ||
    !key ||
    !url.startsWith('https://') ||
    url.includes('your-project-ref') ||
    key.includes('your-supabase-anon-key')
  );
}

function encodeBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function decodeBase64Url(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary = atob(normalized + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Jika pengguna membuka link dengan parameter #autoconnect=... atau ?sb_url=...&sb_key=...,
 * otomatis simpan kredensial ke browser dan bersihkan URL bar.
 */
export function absorbAutoConnectFromUrl(): boolean {
  if (typeof window === 'undefined' || urlParamsChecked) return false;
  urlParamsChecked = true;

  try {
    let foundUrl = '';
    let foundKey = '';
    let shouldCleanHash = false;
    let shouldCleanQuery = false;

    const hash = window.location.hash || '';
    if (hash.includes('autoconnect=')) {
      const hashParams = new URLSearchParams(hash.replace(/^#/, ''));
      const token = hashParams.get('autoconnect');
      if (token) {
        const decoded = JSON.parse(decodeBase64Url(token)) as {
          u?: string;
          k?: string;
        };
        if (decoded?.u && decoded?.k) {
          foundUrl = decoded.u.trim().replace(/\/+$/, '');
          foundKey = decoded.k.trim();
          shouldCleanHash = true;
        }
      }
    }

    const searchParams = new URLSearchParams(window.location.search);
    const qUrl = searchParams.get('sb_url')?.trim();
    const qKey = searchParams.get('sb_key')?.trim();
    if (!foundUrl && qUrl && qKey) {
      foundUrl = qUrl.replace(/\/+$/, '');
      foundKey = qKey;
      shouldCleanQuery = true;
    }

    if (!isPlaceholderConfig(foundUrl, foundKey)) {
      window.localStorage.setItem(STORAGE_URL_KEY, foundUrl);
      window.localStorage.setItem(STORAGE_ANON_KEY, foundKey);

      const cleanUrl = new URL(window.location.href);
      if (shouldCleanHash) cleanUrl.hash = '';
      if (shouldCleanQuery) {
        cleanUrl.searchParams.delete('sb_url');
        cleanUrl.searchParams.delete('sb_key');
      }
      window.history.replaceState({}, document.title, cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
      return true;
    }
  } catch {
    // Abaikan jika parameter URL tidak valid
  }
  return false;
}

export function buildAutoConnectShareUrl(url: string, anonKey: string): string {
  if (typeof window === 'undefined') return '';
  const payload = JSON.stringify({
    u: url.trim().replace(/\/+$/, ''),
    k: anonKey.trim(),
  });
  const encoded = encodeBase64Url(payload);
  return `${window.location.origin}/#autoconnect=${encoded}`;
}

export function setServerSupabaseConfig(
  url: string,
  anonKey: string,
  source: 'server' | 'env' = 'server'
): void {
  const cleanUrl = url.trim().replace(/\/+$/, '');
  const cleanKey = anonKey.trim();
  if (isPlaceholderConfig(cleanUrl, cleanKey)) {
    serverConfigCache = null;
  } else {
    serverConfigCache = { url: cleanUrl, anonKey: cleanKey, source };
  }
  cachedClient = null;
  cachedSignature = '';
}

export async function fetchServerSupabaseConfig(): Promise<{
  configured: boolean;
  url: string;
  anonKey: string;
  source: 'server' | 'env' | 'unconfigured';
} | null> {
  try {
    const res = await fetch('/api/supabase-config', {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      configured?: boolean;
      url?: string;
      anonKey?: string;
      source?: 'server' | 'env' | 'unconfigured';
    };
    const url = typeof data.url === 'string' ? data.url.trim().replace(/\/+$/, '') : '';
    const anonKey = typeof data.anonKey === 'string' ? data.anonKey.trim() : '';
    if (data.configured && !isPlaceholderConfig(url, anonKey)) {
      setServerSupabaseConfig(url, anonKey, data.source === 'env' ? 'env' : 'server');
      return {
        configured: true,
        url,
        anonKey,
        source: data.source === 'env' ? 'env' : 'server',
      };
    }
    return { configured: false, url: '', anonKey: '', source: 'unconfigured' };
  } catch {
    return null;
  }
}

export async function saveServerSupabaseConfig(
  url: string,
  anonKey: string,
  accessToken?: string
): Promise<{ ok: boolean; message?: string }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    const res = await fetch('/api/supabase-config', {
      method: 'POST',
      headers,
      body: JSON.stringify({ url: url.trim().replace(/\/+$/, ''), anonKey: anonKey.trim() }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      message?: string;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, message: data.message };
    }
    setServerSupabaseConfig(url, anonKey, 'server');
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function deleteServerSupabaseConfig(
  accessToken?: string
): Promise<{ ok: boolean; message?: string }> {
  try {
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    const res = await fetch('/api/supabase-config', {
      method: 'DELETE',
      headers,
    });
    const data = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      message?: string;
    };
    if (!res.ok || !data.ok) {
      return { ok: false, message: data.message };
    }
    serverConfigCache = null;
    cachedClient = null;
    cachedSignature = '';
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export function getSupabaseConfig(): SupabaseConfig {
  absorbAutoConnectFromUrl();

  const localUrl =
    typeof window !== 'undefined'
      ? (window.localStorage.getItem(STORAGE_URL_KEY) || '').trim().replace(/\/+$/, '')
      : '';
  const localKey =
    typeof window !== 'undefined'
      ? (window.localStorage.getItem(STORAGE_ANON_KEY) || '').trim()
      : '';

  if (serverConfigCache && !isPlaceholderConfig(serverConfigCache.url, serverConfigCache.anonKey)) {
    return {
      url: serverConfigCache.url,
      anonKey: serverConfigCache.anonKey,
      source: serverConfigCache.source || 'server',
    };
  }

  if (!isPlaceholderConfig(localUrl, localKey)) {
    return { url: localUrl, anonKey: localKey, source: 'localStorage' };
  }

  const envUrl = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) || '')
    .trim()
    .replace(/\/+$/, '');
  const envKey = (
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || ''
  ).trim();

  if (!isPlaceholderConfig(envUrl, envKey)) {
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
  const cleanUrl = url.trim().replace(/\/+$/, '');
  const cleanKey = anonKey.trim();
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_URL_KEY, cleanUrl);
    window.localStorage.setItem(STORAGE_ANON_KEY, cleanKey);
  }
  cachedClient = null;
  cachedSignature = '';
}

export function clearSupabaseConfig(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_URL_KEY);
    window.localStorage.removeItem(STORAGE_ANON_KEY);
  }
  serverConfigCache = null;
  cachedClient = null;
  cachedSignature = '';
}

export async function testSupabaseConnection(
  url: string,
  anonKey: string
): Promise<{ ok: boolean; message: string }> {
  try {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    const cleanKey = anonKey.trim();
    if (!cleanUrl.startsWith('https://') || !cleanKey) {
      return {
        ok: false,
        message: 'URL harus diawali https:// dan Anon Key tidak boleh kosong.',
      };
    }

    const tempClient = createClient(cleanUrl, cleanKey, {
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
            'Terhubung ke Supabase. Silakan masuk menggunakan akun resmi Anda.',
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
