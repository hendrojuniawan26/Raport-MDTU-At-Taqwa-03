import {
  AlertCircle,
  BookOpen,
  Database,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  LogIn,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { ROLE_DESCRIPTIONS, ROLE_LABELS } from '../lib/rbac';
import { testSupabaseConnection } from '../lib/supabase';
import type { UserRole } from '../types';

const ROLE_OPTIONS: {
  id: UserRole;
  label: string;
  icon: typeof ShieldCheck;
}[] = [
  {
    id: 'admin',
    label: 'Admin / Operator',
    icon: ShieldCheck,
  },
  {
    id: 'wali_kelas',
    label: 'Wali Kelas',
    icon: UserCheck,
  },
  {
    id: 'guru',
    label: 'Guru Mapel',
    icon: BookOpen,
  },
  {
    id: 'orang_tua',
    label: 'Orang Tua / Wali',
    icon: Users,
  },
];

export function LoginView() {
  const {
    settings,
    configReady,
    isSupabaseConfigured,
    authLoading,
    signIn,
    updateSupabaseCredentials,
    pushToast,
  } = useApp();

  const [logoError, setLogoError] = useState(false);
  const [selectedRoleHint, setSelectedRoleHint] = useState<UserRole>('admin');

  // Login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // First-time Admin Supabase setup (only visible when server & env are both unconfigured)
  const [showInitialSetup, setShowInitialSetup] = useState(false);
  const [setupUrl, setSetupUrl] = useState('');
  const [setupKey, setSetupKey] = useState('');
  const [connectingSetup, setConnectingSetup] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await signIn(email, password);
  };

  const handleInitialSupabaseSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setConnectingSetup(true);
    const check = await testSupabaseConnection(setupUrl, setupKey);
    if (!check.ok) {
      setConnectingSetup(false);
      pushToast('error', check.message);
      return;
    }
    await updateSupabaseCredentials(setupUrl, setupKey);
    setConnectingSetup(false);
    setShowInitialSetup(false);
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#F7F9F8]">
      {/* Panel Identitas Madrasah Kiri */}
      <aside className="lg:col-span-5 bg-[#0B2B1F] text-white p-8 sm:p-10 lg:p-12 flex flex-col justify-between">
        <div className="space-y-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-white p-1 shrink-0 flex items-center justify-center overflow-hidden">
              {!logoError ? (
                <img
                  src="/assets/aistudio/Desain_tanpa_judul_20261118_152836_0000_ef69cfc5.png"
                  alt="Logo MDTU At-Taqwa '03 Cibeureum"
                  referrerPolicy="no-referrer"
                  onError={() => setLogoError(true)}
                  className="w-full h-full object-contain"
                />
              ) : (
                <GraduationCap className="w-8 h-8 text-emerald-900" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-widest text-emerald-200/80 font-medium">
                Sistem E-Raport Online
              </p>
              <h1 className="text-lg font-bold tracking-tight text-white mt-0.5">
                MDTU At-Taqwa &apos;03 Cibeureum
              </h1>
              <p className="text-xs text-emerald-200/75 mt-0.5">
                {settings.sub_madrasah}
              </p>
            </div>
          </div>

          <div className="space-y-3 border-t border-white/10 pt-7">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight text-balance">
              Portal Pengolahan Nilai &amp; Raport Online
            </h2>
            <p className="text-sm text-emerald-100/80 leading-relaxed max-w-md">
              Sistem informasi raport terpadu berbasis online dengan pembagian hak akses untuk Admin Madrasah, Wali Kelas, Guru Mata Pelajaran, dan Orang Tua / Wali Santri.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {ROLE_OPTIONS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-white/5 border border-white/10"
                >
                  <Icon className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white">
                      {item.label}
                    </div>
                    <div className="text-[11px] text-emerald-100/70 leading-relaxed mt-0.5">
                      {ROLE_DESCRIPTIONS[item.id]}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-8 mt-8 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-200/75">
          <span>
            Semester {settings.semester} · Tahun Pelajaran{' '}
            {settings.tahun_pelajaran}
          </span>
          <span>Kota Cimahi</span>
        </div>
      </aside>

      {/* Panel Kanan: Halaman Login Utama (Tanpa Pendaftaran Publik) */}
      <main className="lg:col-span-7 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-lg">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                Masuk ke Portal Raport
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Masuk menggunakan akun resmi yang diberikan oleh Admin Madrasah.
              </p>
            </div>

            {!configReady && !isSupabaseConfigured ? (
              <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
                <Database className="w-4 h-4 text-emerald-700 shrink-0 animate-pulse" />
                <span>Menyinkronkan koneksi Supabase madrasah secara otomatis...</span>
              </div>
            ) : (
              !isSupabaseConfigured && (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div className="space-y-2 flex-1">
                      <p>
                        Koneksi Supabase belum terpasang di server. Admin cukup menghubungkannya satu kali agar seluruh web/perangkat baru langsung terhubung otomatis.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowInitialSetup((v) => !v)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-950 bg-amber-200/70 hover:bg-amber-200 rounded-lg transition-colors whitespace-nowrap"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        {showInitialSetup
                          ? 'Tutup Form Koneksi Awal'
                          : 'Hubungkan Supabase Pertama Kali (Admin)'}
                      </button>
                    </div>
                  </div>

                  {showInitialSetup && (
                    <form
                      onSubmit={handleInitialSupabaseSetup}
                      className="pt-3 border-t border-amber-200/80 space-y-2.5"
                    >
                      <div>
                        <label className="block text-[11px] font-medium text-amber-950 mb-1">
                          Project URL Supabase (VITE_SUPABASE_URL)
                        </label>
                        <input
                          type="url"
                          required
                          placeholder="https://xyzcompany.supabase.co"
                          value={setupUrl}
                          onChange={(e) => setSetupUrl(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-amber-300 rounded-lg font-mono text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-amber-950 mb-1">
                          Anon Public Key (VITE_SUPABASE_ANON_KEY)
                        </label>
                        <textarea
                          rows={2}
                          required
                          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                          value={setupKey}
                          onChange={(e) => setSetupKey(e.target.value)}
                          className="w-full px-3 py-2 text-xs bg-white border border-amber-300 rounded-lg font-mono text-slate-900"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={connectingSetup}
                        className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 disabled:opacity-60"
                      >
                        <Database className="w-3.5 h-3.5" />
                        {connectingSetup
                          ? 'Menghubungkan...'
                          : 'Uji & Aktifkan Otomatis untuk Semua Web'}
                      </button>
                    </form>
                  )}
                </div>
              )
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <span className="block text-xs font-medium text-slate-700 mb-1.5">
                  Peran Pengguna
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-100 rounded-lg">
                  {ROLE_OPTIONS.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedRoleHint(r.id)}
                      className={`px-2.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap truncate ${
                        selectedRoleHint === r.id
                          ? 'bg-white text-emerald-900 shadow-sm'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {r.id === 'admin'
                        ? 'Admin'
                        : r.id === 'wali_kelas'
                        ? 'Wali Kelas'
                        : r.id === 'guru'
                        ? 'Guru'
                        : 'Orang Tua'}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  {ROLE_DESCRIPTIONS[selectedRoleHint]}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Email Terdaftar
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@madrasah.sch.id"
                  className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Kata Sandi
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Masukkan kata sandi"
                    className="w-full pl-3.5 pr-10 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label="Tampilkan atau sembunyikan kata sandi"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={authLoading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 transition-colors disabled:opacity-60 whitespace-nowrap"
              >
                <LogIn className="w-4 h-4" />
                {authLoading
                  ? 'Memverifikasi...'
                  : `Masuk sebagai ${ROLE_LABELS[selectedRoleHint]}`}
              </button>
            </form>

            <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 leading-relaxed">
              Pembuatan dan pengelolaan akun Wali Kelas, Guru Mapel, serta Orang Tua / Wali Santri dikelola sepenuhnya oleh <strong>Admin Madrasah</strong>.
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
