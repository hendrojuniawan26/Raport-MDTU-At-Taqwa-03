import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RUNTIME_CONFIG_PATH = path.resolve(__dirname, '.supabase-runtime.json');
const ENV_FILE_PATH = path.resolve(__dirname, '.env');
const DIST_DIR = path.resolve(__dirname, 'dist');

interface StoredSupabaseConfig {
  url: string;
  anonKey: string;
  updatedAt?: string;
}

function isPlaceholder(url: string, key: string): boolean {
  return (
    !url ||
    !key ||
    !url.startsWith('https://') ||
    url.includes('your-project-ref') ||
    key.includes('your-supabase-anon-key')
  );
}

function readRuntimeFile(): StoredSupabaseConfig | null {
  try {
    if (!fs.existsSync(RUNTIME_CONFIG_PATH)) return null;
    const raw = fs.readFileSync(RUNTIME_CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<StoredSupabaseConfig>;
    const url = typeof parsed.url === 'string' ? parsed.url.trim() : '';
    const anonKey =
      typeof parsed.anonKey === 'string' ? parsed.anonKey.trim() : '';
    if (isPlaceholder(url, anonKey)) return null;
    return { url, anonKey, updatedAt: parsed.updatedAt };
  } catch {
    return null;
  }
}

function getEffectiveServerConfig(): {
  url: string;
  anonKey: string;
  configured: boolean;
  source: 'server' | 'env' | 'unconfigured';
} {
  const stored = readRuntimeFile();
  if (stored) {
    return {
      url: stored.url,
      anonKey: stored.anonKey,
      configured: true,
      source: 'server',
    };
  }

  const envUrl = (
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ''
  )
    .trim()
    .replace(/\/+$/, '');
  const envKey = (
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    ''
  ).trim();

  if (!isPlaceholder(envUrl, envKey)) {
    return {
      url: envUrl,
      anonKey: envKey,
      configured: true,
      source: 'env',
    };
  }

  return {
    url: 'https://oyzujyqzthqzvkvtwpvt.supabase.co',
    anonKey:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im95enVqeXF6dGhxenZrdnR3cHZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUwNjk2NjksImV4cCI6MjExMDY0NTY2OX0.kqBdBubCkUwoLI5x_S_RRNvYFUNiq40j29dW7uybZsU',
    configured: true,
    source: 'env',
  };
}

function syncEnvFile(url: string | null, anonKey: string | null): void {
  try {
    let lines: string[] = [];
    if (fs.existsSync(ENV_FILE_PATH)) {
      lines = fs.readFileSync(ENV_FILE_PATH, 'utf-8').split(/\r?\n/);
    } else if (fs.existsSync(path.resolve(__dirname, '.env.example'))) {
      lines = fs
        .readFileSync(path.resolve(__dirname, '.env.example'), 'utf-8')
        .split(/\r?\n/);
    }

    const filtered = lines.filter(
      (line) =>
        !line.startsWith('VITE_SUPABASE_URL=') &&
        !line.startsWith('VITE_SUPABASE_ANON_KEY=')
    );

    if (url && anonKey) {
      filtered.push(`VITE_SUPABASE_URL="${url}"`);
      filtered.push(`VITE_SUPABASE_ANON_KEY="${anonKey}"`);
    }

    const output = filtered.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
    fs.writeFileSync(ENV_FILE_PATH, output, 'utf-8');
  } catch {
    // Ignore if filesystem is read-only in some serverless runtimes
  }
}

async function verifyAdminWithSupabase(
  supabaseUrl: string,
  anonKey: string,
  bearerToken: string
): Promise<boolean> {
  try {
    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${bearerToken}`,
      },
    });
    if (!userRes.ok) return false;
    const user = (await userRes.json()) as { id?: string };
    if (!user?.id) return false;

    const profRes = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${bearerToken}`,
        },
      }
    );
    if (!profRes.ok) return false;
    const rows = (await profRes.json()) as Array<{ role?: string }>;
    return Array.isArray(rows) && rows[0]?.role === 'admin';
  } catch {
    return false;
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/supabase-config', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(getEffectiveServerConfig());
  });

  app.post('/api/supabase-config', async (req: Request, res: Response) => {
    const body = (req.body || {}) as { url?: unknown; anonKey?: unknown };
    const url = typeof body.url === 'string' ? body.url.trim().replace(/\/+$/, '') : '';
    const anonKey = typeof body.anonKey === 'string' ? body.anonKey.trim() : '';

    if (isPlaceholder(url, anonKey)) {
      res.status(400).json({
        ok: false,
        message: 'URL Supabase harus diawali https:// dan Anon Key wajib diisi.',
      });
      return;
    }

    const existing = getEffectiveServerConfig();
    if (
      existing.configured &&
      (existing.url !== url || existing.anonKey !== anonKey)
    ) {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : '';
      if (!token) {
        res.status(401).json({
          ok: false,
          message: 'Sesi Admin diperlukan untuk mengubah koneksi Supabase aktif.',
        });
        return;
      }
      const isAdmin = await verifyAdminWithSupabase(
        existing.url,
        existing.anonKey,
        token
      );
      if (!isAdmin) {
        res.status(403).json({
          ok: false,
          message: 'Hanya Admin Madrasah yang dapat mengubah konfigurasi Supabase.',
        });
        return;
      }
    }

    try {
      const payload: StoredSupabaseConfig = {
        url,
        anonKey,
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(
        RUNTIME_CONFIG_PATH,
        JSON.stringify(payload, null, 2),
        'utf-8'
      );
      syncEnvFile(url, anonKey);
      process.env.VITE_SUPABASE_URL = url;
      process.env.VITE_SUPABASE_ANON_KEY = anonKey;

      res.json({
        ok: true,
        url,
        anonKey,
        configured: true,
        source: 'server',
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'Gagal menyimpan konfigurasi Supabase di server.',
      });
    }
  });

  app.delete('/api/supabase-config', async (req: Request, res: Response) => {
    const existing = getEffectiveServerConfig();
    if (existing.configured) {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : '';
      if (!token) {
        res.status(401).json({
          ok: false,
          message: 'Sesi Admin diperlukan untuk memutus koneksi Supabase server.',
        });
        return;
      }
      const isAdmin = await verifyAdminWithSupabase(
        existing.url,
        existing.anonKey,
        token
      );
      if (!isAdmin) {
        res.status(403).json({
          ok: false,
          message: 'Hanya Admin Madrasah yang dapat memutus koneksi Supabase.',
        });
        return;
      }
    }

    try {
      if (fs.existsSync(RUNTIME_CONFIG_PATH)) {
        fs.unlinkSync(RUNTIME_CONFIG_PATH);
      }
      syncEnvFile(null, null);
      delete process.env.VITE_SUPABASE_URL;
      delete process.env.VITE_SUPABASE_ANON_KEY;
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : 'Gagal menghapus konfigurasi server.',
      });
    }
  });

  const isProd =
    process.env.NODE_ENV === 'production' && fs.existsSync(DIST_DIR);

  if (isProd) {
    app.use(express.static(DIST_DIR));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(DIST_DIR, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server berjalan pada http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Gagal menjalankan server:', err);
  process.exit(1);
});
