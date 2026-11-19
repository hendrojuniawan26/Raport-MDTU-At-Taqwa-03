import {
  Check,
  Copy,
  Database,
  Download,
  Edit3,
  KeyRound,
  Link2,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Users,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useApp } from '../context/AppContext';
import { ROLE_LABELS } from '../lib/rbac';
import {
  buildAutoConnectShareUrl,
  testSupabaseConnection,
} from '../lib/supabase';
import type { UserProfile, UserRole } from '../types';
import schemaSqlRaw from '../../supabase/schema.sql?raw';

type SettingsSubTab = 'madrasah' | 'accounts' | 'supabase' | 'sql-guide';

export function SettingsAndSupabaseView() {
  const {
    settings,
    classes,
    subjects,
    students,
    updateSettings,
    supabaseUrl,
    supabaseAnonKey,
    configSource,
    userProfile,
    supabaseProfiles,
    dataLoading,
    signOut,
    adminCreateUserAccount,
    updateSupabaseProfileRole,
    updateSupabaseCredentials,
    resetSupabaseCredentials,
    refreshFromSupabase,
    initializeMdtuDataInSupabase,
    pushToast,
  } = useApp();

  const isAdmin = userProfile?.role === 'admin';
  const [subTab, setSubTab] = useState<SettingsSubTab>('madrasah');
  const [formSettings, setFormSettings] = useState(settings);

  useEffect(() => {
    setFormSettings(settings);
  }, [settings]);

  // Account management modal state (Admin)
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] =
    useState<Partial<UserProfile> | null>(null);
  const [accountPassword, setAccountPassword] = useState('');
  const [savingAccount, setSavingAccount] = useState(false);

  // Supabase credential inputs
  const [urlInput, setUrlInput] = useState(supabaseUrl);
  const [keyInput, setKeyInput] = useState(supabaseAnonKey);
  const [testingConn, setTestingConn] = useState(false);
  const [connResult, setConnResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [copiedSql, setCopiedSql] = useState(false);
  const [copiedShareLink, setCopiedShareLink] = useState(false);

  useEffect(() => {
    setUrlInput(supabaseUrl);
    setKeyInput(supabaseAnonKey);
  }, [supabaseUrl, supabaseAnonKey]);

  const totalBobot =
    Number(formSettings.bobot_formatif) +
    Number(formSettings.bobot_pts) +
    Number(formSettings.bobot_pas) +
    Number(formSettings.bobot_praktik);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings(formSettings);
  };

  const handleTestAndSaveSupabase = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestingConn(true);
    setConnResult(null);
    const res = await testSupabaseConnection(urlInput, keyInput);
    setConnResult(res);
    setTestingConn(false);
    if (res.ok) {
      await updateSupabaseCredentials(urlInput, keyInput);
    } else {
      pushToast('error', res.message);
    }
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(schemaSqlRaw);
      setCopiedSql(true);
      pushToast('success', 'Script SQL Supabase disalin ke clipboard.');
      setTimeout(() => setCopiedSql(false), 2500);
    } catch {
      pushToast('error', 'Gagal menyalin otomatis. Gunakan tombol Unduh SQL.');
    }
  };

  const handleDownloadSql = () => {
    const blob = new Blob([schemaSqlRaw], { type: 'text/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'supabase_schema_mdtu_attaqwa03.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !editingAccount?.email?.trim() ||
      !editingAccount.full_name?.trim() ||
      !editingAccount.role
    ) {
      pushToast('error', 'Nama lengkap, email, dan peran wajib diisi.');
      return;
    }

    setSavingAccount(true);
    try {
      if (editingAccount.id) {
        await updateSupabaseProfileRole({
          id: editingAccount.id,
          email: editingAccount.email.trim(),
          full_name: editingAccount.full_name.trim(),
          role: editingAccount.role,
          nip_nuptk: editingAccount.nip_nuptk || '-',
          assigned_class_id: editingAccount.assigned_class_id || null,
          assigned_subject_ids: editingAccount.assigned_subject_ids || [],
          linked_student_id: editingAccount.linked_student_id || null,
          linked_student_nis: editingAccount.linked_student_nis || '',
        });
        setAccountModalOpen(false);
        setEditingAccount(null);
        setAccountPassword('');
      } else {
        if (accountPassword.length < 6) {
          pushToast('error', 'Kata sandi awal minimal 6 karakter.');
          return;
        }
        const ok = await adminCreateUserAccount({
          email: editingAccount.email.trim(),
          password: accountPassword,
          fullName: editingAccount.full_name.trim(),
          role: editingAccount.role,
          options: {
            assignedClassId: editingAccount.assigned_class_id || undefined,
            assignedSubjectIds: editingAccount.assigned_subject_ids || [],
            linkedStudentNis: editingAccount.linked_student_nis || undefined,
          },
        });
        if (ok) {
          setAccountModalOpen(false);
          setEditingAccount(null);
          setAccountPassword('');
        }
      }
    } finally {
      setSavingAccount(false);
    }
  };

  // Tampilan ringkas Akun & Sesi untuk non-admin (Wali Kelas, Guru, Orang Tua)
  if (!isAdmin && userProfile) {
    const linkedClass = classes.find(
      (c) => c.id === userProfile.assigned_class_id
    );
    const linkedStudent = students.find(
      (s) =>
        s.id === userProfile.linked_student_id ||
        (userProfile.linked_student_nis &&
          s.nis === userProfile.linked_student_nis)
    );
    const assignedSubjectsList = subjects.filter((s) =>
      userProfile.assigned_subject_ids?.includes(s.id)
    );

    return (
      <div className="space-y-6">
        <div className="border-b border-slate-200 pb-5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Profil Akun &amp; Sesi Aktif
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Informasi akun pengguna dan hak akses Anda pada sistem E-Raport MDTU At-Taqwa &apos;03.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 max-w-2xl space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <div className="text-xs text-slate-500">Nama Lengkap</div>
              <div className="font-semibold text-slate-900 mt-0.5">
                {userProfile.full_name}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Peran Akses</div>
              <div className="font-semibold text-emerald-800 mt-0.5">
                {ROLE_LABELS[userProfile.role]}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Email</div>
              <div className="font-mono text-xs text-slate-800 mt-0.5">
                {userProfile.email}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Database Aktif</div>
              <div className="text-slate-800 mt-0.5">
                Supabase PostgreSQL (Online)
              </div>
            </div>
          </div>

          {userProfile.role === 'wali_kelas' && (
            <div className="pt-4 border-t border-slate-100 text-xs text-slate-600">
              <span className="font-medium text-slate-800">Kelas Binaan:</span>{' '}
              {linkedClass ? linkedClass.name : 'Semua kelas yang diampu'}
            </div>
          )}

          {userProfile.role === 'guru' && (
            <div className="pt-4 border-t border-slate-100 text-xs text-slate-600">
              <span className="font-medium text-slate-800">
                Mata Pelajaran Diampu:
              </span>{' '}
              {assignedSubjectsList.length > 0
                ? assignedSubjectsList.map((s) => s.name).join(', ')
                : 'Berdasarkan nama guru pada Data Master Mapel'}
            </div>
          )}

          {userProfile.role === 'orang_tua' && (
            <div className="pt-4 border-t border-slate-100 text-xs text-slate-600">
              <span className="font-medium text-slate-800">
                Santri Tertaut:
              </span>{' '}
              {linkedStudent
                ? `${linkedStudent.full_name} (NIS ${linkedStudent.nis})`
                : userProfile.linked_student_nis || 'Belum tertaut'}
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={dataLoading}
              onClick={refreshFromSupabase}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Muat Ulang Data
            </button>
            <button
              type="button"
              onClick={signOut}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50"
            >
              <LogOut className="w-3.5 h-3.5" />
              Keluar dari Akun
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Pengaturan Madrasah, Akun &amp; Supabase
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Atur kop madrasah, bobot rumus nilai, manajemen akun 4 peran, koneksi Supabase PostgreSQL, dan skema SQL.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setSubTab('madrasah')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              subTab === 'madrasah'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Identitas &amp; Rumus
          </button>
          <button
            type="button"
            onClick={() => setSubTab('accounts')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              subTab === 'accounts'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Manajemen Akun
          </button>
          <button
            type="button"
            onClick={() => setSubTab('supabase')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              subTab === 'supabase'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Koneksi &amp; Auth Supabase
          </button>
          <button
            type="button"
            onClick={() => setSubTab('sql-guide')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              subTab === 'sql-guide'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Skema SQL &amp; Panduan
          </button>
        </div>
      </div>

      {/* SUBTAB 1: IDENTITAS MADRASAH & RUMUS NILAI */}
      {subTab === 'madrasah' && (
        <form
          onSubmit={handleSaveSettings}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900">
              Identitas Madrasah & Penandatangan Raport
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Yayasan / Lembaga Menaungi
                </label>
                <input
                  type="text"
                  value={formSettings.yayasan}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, yayasan: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Madrasah
                </label>
                <input
                  type="text"
                  value={formSettings.nama_madrasah}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      nama_madrasah: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Sub-Judul / Afiliasi (Kop Baris 3)
                </label>
                <input
                  type="text"
                  value={formSettings.sub_madrasah}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      sub_madrasah: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  NSM / Nomor Statistik Madrasah
                </label>
                <input
                  type="text"
                  value={formSettings.nsm}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, nsm: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Alamat Lengkap
                </label>
                <input
                  type="text"
                  value={formSettings.alamat}
                  onChange={(e) =>
                    setFormSettings({ ...formSettings, alamat: e.target.value })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Kecamatan
                </label>
                <input
                  type="text"
                  value={formSettings.kecamatan}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      kecamatan: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Kabupaten / Kota
                </label>
                <input
                  type="text"
                  value={formSettings.kabupaten}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      kabupaten: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Kepala Madrasah
                </label>
                <input
                  type="text"
                  value={formSettings.kepala_madrasah}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      kepala_madrasah: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  NIP / NUPTK Kepala Madrasah
                </label>
                <input
                  type="text"
                  value={formSettings.nip_kepala}
                  onChange={(e) =>
                    setFormSettings({
                      ...formSettings,
                      nip_kepala: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                />
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
              <h2 className="text-base font-semibold text-slate-900">
                Periode Aktif & Rumus Bobot Nilai
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tahun Pelajaran
                  </label>
                  <input
                    type="text"
                    value={formSettings.tahun_pelajaran}
                    onChange={(e) =>
                      setFormSettings({
                        ...formSettings,
                        tahun_pelajaran: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Semester
                  </label>
                  <select
                    value={formSettings.semester}
                    onChange={(e) =>
                      setFormSettings({
                        ...formSettings,
                        semester: e.target.value as 'Ganjil' | 'Genap',
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Ganjil">Ganjil</option>
                    <option value="Genap">Genap</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tempat Cetak Raport
                  </label>
                  <input
                    type="text"
                    value={formSettings.tempat_cetak}
                    onChange={(e) =>
                      setFormSettings({
                        ...formSettings,
                        tempat_cetak: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tanggal Raport
                  </label>
                  <input
                    type="text"
                    value={formSettings.tanggal_raport}
                    onChange={(e) =>
                      setFormSettings({
                        ...formSettings,
                        tanggal_raport: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-800">
                    Bobot Komponen Nilai Akhir (%)
                  </span>
                  <span
                    className={`text-xs font-mono ${
                      totalBobot === 100 ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    Total: {totalBobot}%
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      Formatif
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={formSettings.bobot_formatif}
                      onChange={(e) =>
                        setFormSettings({
                          ...formSettings,
                          bobot_formatif: Number(e.target.value),
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      PTS/UTS
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={formSettings.bobot_pts}
                      onChange={(e) =>
                        setFormSettings({
                          ...formSettings,
                          bobot_pts: Number(e.target.value),
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      PAS/UAS
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={formSettings.bobot_pas}
                      onChange={(e) =>
                        setFormSettings({
                          ...formSettings,
                          bobot_pas: Number(e.target.value),
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-600 mb-1">
                      Praktik
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={formSettings.bobot_praktik}
                      onChange={(e) =>
                        setFormSettings({
                          ...formSettings,
                          bobot_praktik: Number(e.target.value),
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg font-mono text-center"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">
                  Nilai Akhir = (Formatif×{formSettings.bobot_formatif} + PTS×
                  {formSettings.bobot_pts} + PAS×{formSettings.bobot_pas} +
                  Praktik×{formSettings.bobot_praktik}) / {totalBobot || 100}
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-800 rounded-lg hover:bg-emerald-900"
                >
                  <Save className="w-4 h-4" />
                  Simpan Pengaturan
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* SUBTAB: MANAJEMEN AKUN 4 PERAN */}
      {subTab === 'accounts' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-700" />
                Manajemen Akun Pengguna Supabase (4 Peran)
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Seluruh akun (Admin, Wali Kelas, Guru Mapel, dan Orang Tua) dibuat dan dikelola secara eksklusif oleh Admin. Gunakan tombol Tambah Akun Baru atau ubah penugasan kelas/mapel/NIS pada daftar di bawah ini.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={dataLoading}
                onClick={refreshFromSupabase}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Muat Ulang
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingAccount({
                    role: 'guru',
                    full_name: '',
                    email: '',
                    nip_nuptk: '-',
                    assigned_class_id: classes[0]?.id || '',
                    assigned_subject_ids: [],
                    linked_student_nis: '',
                  });
                  setAccountPassword('');
                  setAccountModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Akun Baru
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">Nama Lengkap</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Peran</th>
                  <th className="px-4 py-3 font-medium">Cakupan Akses</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {supabaseProfiles.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-xs text-slate-500"
                    >
                      Belum ada profil akun terbaca. Pastikan SQL schema sudah dijalankan dan pengguna sudah terdaftar di Supabase Auth.
                    </td>
                  </tr>
                ) : (
                  supabaseProfiles.map((acc) => {
                    const cls = classes.find((c) => c.id === acc.assigned_class_id);
                    const subjCount = acc.assigned_subject_ids?.length || 0;
                    const scopeText =
                      acc.role === 'admin'
                        ? 'Akses Penuh Madrasah'
                        : acc.role === 'wali_kelas'
                        ? `Kelas ${cls?.name || '-'}`
                        : acc.role === 'guru'
                        ? `${subjCount} Mapel Diampu`
                        : `NIS Santri: ${acc.linked_student_nis || '-'}`;

                    return (
                      <tr key={acc.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {acc.full_name}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-600">
                          {acc.email}
                        </td>
                        <td className="px-4 py-3 text-xs font-semibold text-emerald-800">
                          {ROLE_LABELS[acc.role]}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {scopeText}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAccount({ ...acc });
                              setAccountModalOpen(true);
                            }}
                            aria-label={`Ubah ${acc.full_name}`}
                            className="p-1.5 text-slate-500 hover:text-emerald-800 rounded-md hover:bg-slate-100"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB: KONEKSI & AUTH SUPABASE */}
      {subTab === 'supabase' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Kredensial Supabase */}
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-700" />
                  Konfigurasi Proyek Supabase
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Sumber aktif saat ini:{' '}
                  <span className="font-medium text-slate-800">
                    {configSource === 'server'
                      ? 'Tersinkron Otomatis ke Semua Web Baru (Server & .env)'
                      : configSource === 'env'
                      ? 'Variabel Lingkungan (.env / Hosting)'
                      : configSource === 'localStorage'
                      ? 'Konfigurasi Browser Tersimpan'
                      : configSource === 'default'
                      ? 'Konfigurasi Bawaan Aplikasi (Aktif Otomatis di Semua Web)'
                      : 'Belum dikonfigurasi'}
                  </span>
                </p>
              </div>
            </div>

            <form onSubmit={handleTestAndSaveSupabase} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  VITE_SUPABASE_URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://xyzcompany.supabase.co"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  VITE_SUPABASE_ANON_KEY
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono"
                />
              </div>

              {connResult && (
                <div
                  className={`p-3 rounded-lg text-xs border ${
                    connResult.ok
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-red-50 border-red-200 text-red-800'
                  }`}
                >
                  {connResult.message}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                {(configSource === 'localStorage' || configSource === 'server') && (
                  <button
                    type="button"
                    onClick={async () => {
                      await resetSupabaseCredentials();
                      setUrlInput('');
                      setKeyInput('');
                      setConnResult(null);
                    }}
                    className="px-3 py-2 text-xs font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50 whitespace-nowrap"
                  >
                    Putuskan Koneksi
                  </button>
                )}
                <button
                  type="submit"
                  disabled={testingConn}
                  className="ml-auto inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 disabled:opacity-60 whitespace-nowrap"
                >
                  <KeyRound className="w-4 h-4" />
                  {testingConn ? 'Menguji...' : 'Uji & Simpan Koneksi'}
                </button>
              </div>
            </form>

            {urlInput && keyInput && (
              <div className="pt-4 border-t border-slate-100 space-y-2.5">
                <div className="text-xs text-slate-600 leading-relaxed">
                  <strong>Koneksi Otomatis di Berbagai Web/Perangkat Baru:</strong>{' '}
                  Saat Anda menyimpan koneksi di atas, server aplikasi otomatis menyimpannya sehingga siapa pun yang membuka alamat web ini dari browser atau HP baru langsung terhubung ke Supabase. Jika Anda menghosting frontend statis terpisah (tanpa server Node), bagikan tautan otomatis di bawah ini:
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const shareUrl = buildAutoConnectShareUrl(urlInput, keyInput);
                    try {
                      await navigator.clipboard.writeText(shareUrl);
                      setCopiedShareLink(true);
                      pushToast(
                        'success',
                        'Link akses web otomatis berhasil disalin ke clipboard.'
                      );
                      setTimeout(() => setCopiedShareLink(false), 2500);
                    } catch {
                      pushToast('error', 'Gagal menyalin link otomatis.');
                    }
                  }}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 whitespace-nowrap"
                >
                  {copiedShareLink ? (
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                  ) : (
                    <Link2 className="w-3.5 h-3.5" />
                  )}
                  {copiedShareLink
                    ? 'Link Otomatis Tersalin'
                    : 'Salin Link Akses Web Otomatis'}
                </button>
              </div>
            )}
          </div>

          {/* Sesi Aktif & Inisialisasi Data MDTU */}
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              Sesi Online &amp; Inisialisasi Data MDTU
            </h2>

            {userProfile && (
              <div className="space-y-4">
                <div className="p-4 border border-emerald-200 bg-emerald-50/50 rounded-lg space-y-1">
                  <div className="text-sm font-semibold text-slate-900">
                    {userProfile.full_name}
                  </div>
                  <div className="text-xs text-slate-600">
                    {userProfile.email} · Peran:{' '}
                    <span className="font-semibold text-emerald-800 uppercase">
                      {ROLE_LABELS[userProfile.role]}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 pt-1">
                    Status: Terhubung langsung ke PostgreSQL Supabase.
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Jika proyek Supabase Anda baru dibuat dan daftar kelas/santri masih kosong, Anda dapat mengklik tombol <strong>Inisialisasi Data Awal MDTU</strong> untuk mengisi struktur kelas (MDTU-1 s/d MDTU-6) dan 10 mata pelajaran standar secara otomatis, lalu mengimport file Excel Anda.
                </p>

                <div className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    disabled={dataLoading}
                    onClick={refreshFromSupabase}
                    className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Muat Ulang dari Supabase
                  </button>
                  <button
                    type="button"
                    disabled={dataLoading}
                    onClick={initializeMdtuDataInSupabase}
                    className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-emerald-800 rounded-lg hover:bg-emerald-900"
                  >
                    <Database className="w-3.5 h-3.5" />
                    Inisialisasi Data Awal MDTU ke Supabase
                  </button>
                  <button
                    type="button"
                    onClick={signOut}
                    className="ml-auto inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Keluar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB: SKEMA SQL & PANDUAN ONLINE */}
      {subTab === 'sql-guide' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
            <h2 className="text-base font-semibold text-slate-900">
              Panduan Akses Online &amp; Integrasi Supabase MDTU At-Taqwa &apos;03 Cibeureum
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-sm text-slate-700 leading-relaxed">
              <li>
                Buat proyek baru di{' '}
                <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                  supabase.com
                </span>{' '}
                dan buka menu <strong>SQL Editor</strong>.
              </li>
              <li>
                Salin seluruh script SQL di bawah ini lalu klik{' '}
                <strong>Run</strong> untuk membuat tabel{' '}
                <span className="font-mono text-xs">profiles</span>,{' '}
                <span className="font-mono text-xs">madrasah_settings</span>,{' '}
                <span className="font-mono text-xs">classes</span>,{' '}
                <span className="font-mono text-xs">subjects</span>,{' '}
                <span className="font-mono text-xs">students</span>,{' '}
                <span className="font-mono text-xs">grades</span>,{' '}
                <span className="font-mono text-xs">non_academic_records</span>{' '}
                beserta kebijakan <strong>Row Level Security (RLS) 4 peran</strong>.
              </li>
              <li>
                Buka <strong>Authentication → URL Configuration</strong> di Dashboard Supabase, lalu masukkan URL domain aplikasi online Anda pada <strong>Site URL</strong> dan <strong>Redirect URLs</strong>.
              </li>
              <li>
                Buka <strong>Project Settings → API</strong>, salin{' '}
                <strong>Project URL</strong> dan <strong>anon public key</strong>, lalu pasang sebagai Environment Variables di hosting/deployment Anda:{' '}
                <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                  VITE_SUPABASE_URL
                </span>{' '}
                dan{' '}
                <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                  VITE_SUPABASE_ANON_KEY
                </span>{' '}
                agar seluruh Wali Kelas, Guru, dan Orang Tua dapat langsung login tanpa mengisi kunci API lagi.
              </li>
              <li>
                Buat akun Admin pertama melalui Dashboard Supabase menu{' '}
                <strong>Authentication → Users → Add user</strong> (otomatis ditetapkan sebagai Admin oleh trigger SQL jika belum ada admin). Setelah login, klik{' '}
                <strong>Inisialisasi Data Awal MDTU ke Supabase</strong> pada tab{' '}
                <strong>Koneksi &amp; Auth Supabase</strong> atau import data santri dari Excel, lalu buat serta kelola seluruh akun Wali Kelas, Guru Mapel, dan Orang Tua melalui tab{' '}
                <strong>Manajemen Akun</strong>.
              </li>
            </ol>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  supabase/schema.sql
                </h3>
                <p className="text-xs text-slate-500">
                  Script PostgreSQL lengkap dengan Foreign Key, Trigger, RLS, dan Data Mapel MDTU
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  {copiedSql ? (
                    <Check className="w-3.5 h-3.5 text-emerald-700" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copiedSql ? 'Tersalin' : 'Salin SQL'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadSql}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-800 rounded-lg hover:bg-emerald-900"
                >
                  <Download className="w-3.5 h-3.5" />
                  Unduh .sql
                </button>
              </div>
            </div>
            <pre className="p-4 text-xs font-mono text-slate-800 bg-slate-50/40 overflow-x-auto max-h-[460px] leading-relaxed">
              {schemaSqlRaw}
            </pre>
          </div>
        </div>
      )}
      {/* MODAL TAMBAH/EDIT AKUN */}
      {accountModalOpen && editingAccount && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 shadow-xl my-8">
            <h3 className="text-lg font-semibold text-slate-900">
              {editingAccount.id ? 'Edit Akun Pengguna' : 'Tambah Akun Baru'}
            </h3>
            <form onSubmit={handleSaveAccount} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nama Lengkap *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingAccount.full_name || ''}
                    onChange={(e) =>
                      setEditingAccount({
                        ...editingAccount,
                        full_name: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Peran *
                  </label>
                  <select
                    value={editingAccount.role || 'guru'}
                    onChange={(e) =>
                      setEditingAccount({
                        ...editingAccount,
                        role: e.target.value as UserRole,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="admin">Admin / Operator</option>
                    <option value="wali_kelas">Wali Kelas</option>
                    <option value="guru">Guru Mapel</option>
                    <option value="orang_tua">Orang Tua / Wali</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={editingAccount.id ? 'sm:col-span-2' : ''}>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Email Pengguna *
                  </label>
                  <input
                    type="email"
                    required
                    disabled={Boolean(editingAccount.id)}
                    placeholder="nama@attaqwa03.sch.id"
                    value={editingAccount.email || ''}
                    onChange={(e) =>
                      setEditingAccount({
                        ...editingAccount,
                        email: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg disabled:bg-slate-50"
                  />
                </div>
                {!editingAccount.id && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Kata Sandi Awal (min. 6 karakter) *
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      placeholder="Minimal 6 karakter"
                      value={accountPassword}
                      onChange={(e) => setAccountPassword(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                    />
                  </div>
                )}
              </div>

              {editingAccount.role === 'wali_kelas' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Kelas Binaan
                  </label>
                  <select
                    value={editingAccount.assigned_class_id || ''}
                    onChange={(e) =>
                      setEditingAccount({
                        ...editingAccount,
                        assigned_class_id: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="">-- Pilih Kelas --</option>
                    {classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.wali_kelas_name})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {editingAccount.role === 'guru' && (
                <div>
                  <span className="block text-xs font-medium text-slate-700 mb-1.5">
                    Mata Pelajaran yang Diampu
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto p-2.5 border border-slate-200 rounded-lg bg-slate-50/50">
                    {subjects.map((s) => {
                      const checked =
                        editingAccount.assigned_subject_ids?.includes(s.id) ||
                        false;
                      return (
                        <label
                          key={s.id}
                          className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              const current =
                                editingAccount.assigned_subject_ids || [];
                              setEditingAccount({
                                ...editingAccount,
                                assigned_subject_ids: checked
                                  ? current.filter((x) => x !== s.id)
                                  : [...current, s.id],
                              });
                            }}
                            className="rounded border-slate-300 text-emerald-800"
                          />
                          <span className="truncate">{s.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {editingAccount.role === 'orang_tua' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Pilih / Masukkan NIS Santri
                  </label>
                  <select
                    value={editingAccount.linked_student_nis || ''}
                    onChange={(e) =>
                      setEditingAccount({
                        ...editingAccount,
                        linked_student_nis: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="">-- Pilih Santri --</option>
                    {students.map((st) => (
                      <option key={st.id} value={st.nis}>
                        {st.full_name} — NIS {st.nis}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={savingAccount}
                  onClick={() => {
                    setAccountModalOpen(false);
                    setEditingAccount(null);
                    setAccountPassword('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingAccount}
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 disabled:opacity-60"
                >
                  {savingAccount
                    ? 'Menyimpan...'
                    : editingAccount.id
                    ? 'Simpan Perubahan'
                    : 'Buat Akun'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
