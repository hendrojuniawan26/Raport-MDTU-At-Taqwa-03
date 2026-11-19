import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  INITIAL_CLASSES,
  INITIAL_GRADES,
  INITIAL_NON_ACADEMIC,
  INITIAL_SETTINGS,
  INITIAL_STUDENTS,
  INITIAL_SUBJECTS,
} from '../data/seedData';
import {
  calculateFinalScore,
  generateCompetencyDescription,
  getPredicate,
} from '../lib/grading';
import { resolveParentStudent } from '../lib/rbac';
import {
  clearSupabaseConfig,
  createEphemeralSupabaseClient,
  deleteServerSupabaseConfig,
  fetchServerSupabaseConfig,
  getSupabaseClient,
  getSupabaseConfig,
  saveServerSupabaseConfig,
  saveSupabaseConfig,
  type SupabaseConfigSource,
} from '../lib/supabase';
import type {
  GradeRecord,
  MadrasahClass,
  MadrasahSettings,
  NonAcademicRecord,
  Student,
  Subject,
  UserProfile,
  UserRole,
} from '../types';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

interface SignUpExtraOptions {
  assignedClassId?: string | null;
  assignedSubjectIds?: string[];
  linkedStudentNis?: string;
}

interface AppContextValue {
  settings: MadrasahSettings;
  classes: MadrasahClass[];
  subjects: Subject[];
  students: Student[];
  grades: GradeRecord[];
  nonAcademics: NonAcademicRecord[];
  selectedClassId: string;
  setSelectedClassId: (id: string) => void;
  selectedStudentId: string;
  setSelectedStudentId: (id: string) => void;
  globalSearchQuery: string;
  setGlobalSearchQuery: (q: string) => void;

  // Auth & Supabase Connection
  configReady: boolean;
  isSupabaseConfigured: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  configSource: SupabaseConfigSource;
  userProfile: UserProfile | null;
  supabaseProfiles: UserProfile[];
  authLoading: boolean;
  dataLoading: boolean;
  isOnline: boolean;
  pendingSavesCount: number;
  parentClassStats: { rank: number; totalStudents: number } | null;
  isAccountRpcReady: boolean | null;
  checkAccountRpcAvailability: () => Promise<boolean>;
  toasts: ToastMessage[];
  pushToast: (type: ToastMessage['type'], text: string) => void;
  dismissToast: (id: string) => void;

  signIn: (email: string, password: string) => Promise<boolean>;
  adminCreateUserAccount: (params: {
    email: string;
    password: string;
    fullName: string;
    role: UserRole;
    options?: SignUpExtraOptions;
  }) => Promise<{ ok: boolean; error?: string; needsSqlSetup?: boolean }>;
  signOut: () => Promise<void>;
  updateSupabaseProfileRole: (profile: UserProfile) => Promise<boolean>;
  adminUpdateUserPassword: (userId: string, newPassword: string) => Promise<boolean>;
  adminDeleteUserAccount: (userId: string, fullName?: string) => Promise<boolean>;

  updateSupabaseCredentials: (url: string, anonKey: string) => Promise<void>;
  resetSupabaseCredentials: () => Promise<void>;
  refreshFromSupabase: () => Promise<void>;
  initializeMdtuDataInSupabase: () => Promise<void>;

  // Mutations (Supabase PostgreSQL)
  updateSettings: (next: MadrasahSettings) => Promise<boolean>;
  upsertClass: (item: Omit<MadrasahClass, 'id'> & { id?: string }) => Promise<boolean>;
  deleteClass: (id: string) => Promise<void>;
  upsertSubject: (item: Omit<Subject, 'id'> & { id?: string }) => Promise<boolean>;
  deleteSubject: (id: string) => Promise<void>;
  upsertStudent: (item: Omit<Student, 'id'> & { id?: string }) => Promise<boolean>;
  deleteStudent: (id: string) => Promise<void>;
  upsertGrade: (params: {
    student_id: string;
    subject_id: string;
    class_id: string;
    formatif: number;
    pts: number;
    pas: number;
    praktik: number;
    customDescription?: string;
  }) => Promise<void>;
  upsertNonAcademic: (record: NonAcademicRecord) => Promise<void>;
  bulkImportData: (params: {
    newStudents: (Omit<Student, 'id'> & { id?: string })[];
    newGrades: {
      studentNis: string;
      subjectId: string;
      formatif: number;
      pts: number;
      pas: number;
      praktik: number;
      predicateOverride?: string;
      descriptionOverride?: string;
    }[];
    attendanceUpdates: {
      studentNis: string;
      sakit: number;
      izin: number;
      alpa: number;
      asScore?: number;
      assScore?: number;
      pesanWalas?: string;
    }[];
    targetClassId: string;
  }) => Promise<{ importedStudents: number; importedGrades: number }>;
}

const AppContext = createContext<AppContextValue | null>(null);

function translateAuthError(rawMessage?: string): string {
  const msg = (rawMessage || '').trim();
  const lower = msg.toLowerCase();
  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid_credentials')
  ) {
    return 'Email atau kata sandi salah. Periksa kembali data masuk Anda.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Email akun belum terkonfirmasi. Minta Admin Madrasah mengaktifkan akun atau menjalankan SQL terbaru di Supabase.';
  }
  if (
    lower.includes('error sending confirmation') ||
    lower.includes('confirmation mail') ||
    lower.includes('over_email_send_rate_limit')
  ) {
    return 'Batas pengiriman email konfirmasi Supabase tercapai. Jalankan ulang SQL terbaru pada menu Skema SQL & Panduan agar Admin dapat membuat akun langsung tanpa email konfirmasi.';
  }
  if (
    lower.includes('user already registered') ||
    lower.includes('already exists') ||
    lower.includes('sudah terdaftar')
  ) {
    return 'Email tersebut sudah terdaftar pada sistem.';
  }
  if (
    lower.includes('email_address_invalid') ||
    lower.includes('unable to validate email')
  ) {
    return 'Format alamat email tidak valid. Gunakan email yang valid (contoh: nama@madrasah.sch.id).';
  }
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('load failed')
  ) {
    return 'Koneksi jaringan ke Supabase terganggu. Periksa internet Anda lalu coba lagi.';
  }
  if (lower.includes('too many requests') || lower.includes('rate limit')) {
    return 'Terlalu banyak percobaan dalam waktu singkat. Tunggu beberapa saat atau jalankan SQL terbaru untuk pembuatan akun langsung.';
  }
  if (lower.includes('password should be at least')) {
    return 'Kata sandi minimal 6 karakter.';
  }
  return msg || 'Terjadi kesalahan autentikasi.';
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<MadrasahSettings>(INITIAL_SETTINGS);
  const [classes, setClasses] = useState<MadrasahClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<GradeRecord[]>([]);
  const [nonAcademics, setNonAcademics] = useState<NonAcademicRecord[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [supabaseProfiles, setSupabaseProfiles] = useState<UserProfile[]>([]);

  const [configVersion, setConfigVersion] = useState(0);
  const [configReady, setConfigReady] = useState(false);
  const supabaseCfg = useMemo(() => {
    void configVersion;
    return getSupabaseConfig();
  }, [configVersion]);

  const isSupabaseConfigured = supabaseCfg.source !== 'unconfigured';

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(isSupabaseConfigured);
  const [dataLoading, setDataLoading] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingSavesCount, setPendingSavesCount] = useState<number>(0);
  const [parentClassStats, setParentClassStats] = useState<{
    rank: number;
    totalStudents: number;
  } | null>(null);
  const [isAccountRpcReady, setIsAccountRpcReady] = useState<boolean | null>(
    null
  );
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const loadedUserIdRef = useRef<string | null>(null);
  const gradeDebounceTimersRef = useRef<
    Map<string, ReturnType<typeof setTimeout>>
  >(new Map());
  const pendingGradePayloadsRef = useRef<
    Map<
      string,
      {
        payload: Omit<GradeRecord, 'id'>;
        studentId: string;
        subjectId: string;
        academicYear: string;
        semester: 'Ganjil' | 'Genap';
      }
    >
  >(new Map());
  const inflightSavesRef = useRef<number>(0);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const refreshPromiseRef = useRef<Promise<void> | null>(null);

  const syncPendingSavesCount = useCallback(() => {
    setPendingSavesCount(
      pendingGradePayloadsRef.current.size + inflightSavesRef.current
    );
  }, []);

  const clearPendingGradeSaves = useCallback(() => {
    gradeDebounceTimersRef.current.forEach((timer) => clearTimeout(timer));
    gradeDebounceTimersRef.current.clear();
    pendingGradePayloadsRef.current.clear();
    inflightSavesRef.current = 0;
    setPendingSavesCount(0);
  }, []);

  // Sinkronisasi otomatis konfigurasi Supabase dari server (/api/supabase-config)
  // sehingga setiap web/browser baru otomatis terhubung ke Supabase yang sama.
  useEffect(() => {
    let active = true;
    (async () => {
      const serverRes = await fetchServerSupabaseConfig();
      if (!active) return;
      if (serverRes?.configured) {
        setConfigVersion((v) => v + 1);
      } else if (serverRes && !serverRes.configured) {
        const current = getSupabaseConfig();
        if (current.source === 'localStorage' && current.url && current.anonKey) {
          const synced = await saveServerSupabaseConfig(current.url, current.anonKey);
          if (active && synced.ok) {
            setConfigVersion((v) => v + 1);
          }
        }
      }
      if (active) setConfigReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const pushToast = useCallback((type: ToastMessage['type'], text: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Auto-select wali_kelas class if assigned
  useEffect(() => {
    if (userProfile?.role === 'wali_kelas' && userProfile.assigned_class_id) {
      if (classes.some((c) => c.id === userProfile.assigned_class_id)) {
        setSelectedClassId(userProfile.assigned_class_id);
      }
    }
  }, [userProfile, classes]);

  const fetchPublicCatalog = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;

    try {
      const [settingsRes, classesRes, subjectsRes] = await Promise.all([
        client.from('madrasah_settings').select('*').limit(1),
        client.from('classes').select('*').order('level', { ascending: true }),
        client.from('subjects').select('*').order('sort_order', { ascending: true }),
      ]);

      if (!settingsRes.error && settingsRes.data && settingsRes.data.length > 0) {
        setSettings(settingsRes.data[0] as MadrasahSettings);
      }
      if (!classesRes.error && classesRes.data) {
        const clsList = classesRes.data as MadrasahClass[];
        setClasses(clsList);
        if (clsList.length > 0) {
          setSelectedClassId((prev) =>
            clsList.some((c) => c.id === prev) ? prev : clsList[0].id
          );
        }
      }
      if (!subjectsRes.error && subjectsRes.data) {
        setSubjects(subjectsRes.data as Subject[]);
      }
    } catch {
      // ignore if schema not yet initialized before first setup
    }
  }, []);

  const refreshFromSupabase = useCallback(async () => {
    const client = getSupabaseClient();
    if (!client) return;

    if (refreshPromiseRef.current) {
      return refreshPromiseRef.current;
    }

    const run = (async () => {
      setDataLoading(true);
      try {
        const [
          settingsRes,
          classesRes,
          subjectsRes,
          studentsRes,
          gradesRes,
          nonAcadRes,
          profilesRes,
        ] = await Promise.all([
          client.from('madrasah_settings').select('*').limit(1),
          client.from('classes').select('*').order('level', { ascending: true }),
          client.from('subjects').select('*').order('sort_order', { ascending: true }),
          client.from('students').select('*').order('full_name', { ascending: true }),
          client.from('grades').select('*'),
          client.from('non_academic_records').select('*'),
          client.from('profiles').select('*').order('full_name', { ascending: true }),
        ]);

        if (settingsRes.error) throw settingsRes.error;
        if (classesRes.error) throw classesRes.error;
        if (subjectsRes.error) throw subjectsRes.error;
        if (studentsRes.error) throw studentsRes.error;
        if (gradesRes.error) throw gradesRes.error;
        if (nonAcadRes.error) throw nonAcadRes.error;

        if (settingsRes.data && settingsRes.data.length > 0) {
          setSettings(settingsRes.data[0] as MadrasahSettings);
        }
        if (classesRes.data) {
          const clsList = classesRes.data as MadrasahClass[];
          setClasses(clsList);
          if (clsList.length > 0) {
            setSelectedClassId((prev) =>
              clsList.some((c) => c.id === prev) ? prev : clsList[0].id
            );
          }
        }
        if (subjectsRes.data) {
          setSubjects(subjectsRes.data as Subject[]);
        }
        if (studentsRes.data) {
          setStudents(studentsRes.data as Student[]);
        }
        if (gradesRes.data) {
          setGrades(
            gradesRes.data.map((g) => ({
              ...g,
              formatif: Number(g.formatif),
              pts: Number(g.pts),
              pas: Number(g.pas),
              praktik: Number(g.praktik),
              final_score: Number(g.final_score),
            })) as GradeRecord[]
          );
        }
        if (nonAcadRes.data) {
          setNonAcademics(nonAcadRes.data as NonAcademicRecord[]);
        }
        if (!profilesRes.error && profilesRes.data) {
          setSupabaseProfiles(profilesRes.data as UserProfile[]);
        }
      } catch (err) {
        pushToast(
          'error',
          `Gagal memuat data Supabase: ${err instanceof Error ? err.message : 'Periksa skema SQL & kebijakan RLS'}`
        );
      } finally {
        setDataLoading(false);
        refreshPromiseRef.current = null;
      }
    })();

    refreshPromiseRef.current = run;
    return run;
  }, [pushToast]);

  useEffect(() => {
    refreshRef.current = refreshFromSupabase;
  }, [refreshFromSupabase]);

  // Monitor status koneksi internet & sinkronkan ulang saat kembali online
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (loadedUserIdRef.current) {
        void refreshRef.current();
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Peringatkan bila masih ada nilai yang sedang disimpan saat menutup tab
  useEffect(() => {
    if (pendingSavesCount <= 0) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [pendingSavesCount]);

  const checkAccountRpcAvailability = useCallback(async (): Promise<boolean> => {
    const client = getSupabaseClient();
    if (!client) {
      setIsAccountRpcReady(null);
      return false;
    }
    try {
      const { error } = await client.rpc('admin_create_user_account', {
        p_email: '',
        p_password: '',
        p_full_name: '',
      });
      const msg = error?.message || '';
      const missing =
        error?.code === 'PGRST202' ||
        msg.includes('admin_create_user_account') ||
        msg.includes('schema cache') ||
        msg.includes('Could not find the function');
      setIsAccountRpcReady(!missing);
      return !missing;
    } catch {
      setIsAccountRpcReady(null);
      return false;
    }
  }, []);

  useEffect(() => {
    if (userProfile?.role === 'admin') {
      void checkAccountRpcAvailability();
    } else {
      setIsAccountRpcReady(null);
    }
  }, [userProfile?.role, configVersion, checkAccountRpcAvailability]);

  // Ambil peringkat & jumlah santri aktif sekelas untuk akun Orang Tua via RPC aman
  useEffect(() => {
    if (userProfile?.role !== 'orang_tua') {
      setParentClassStats(null);
      return;
    }
    const child = resolveParentStudent(userProfile, students);
    const client = getSupabaseClient();
    if (!child || !client) {
      setParentClassStats(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await client.rpc('get_parent_student_rank', {
          target_student_id: child.id,
          target_academic_year: settings.tahun_pelajaran,
          target_semester: settings.semester,
        });
        if (cancelled) return;
        if (error) {
          // Abaikan jika SQL RPC belum dijalankan di database
          setParentClassStats(null);
          return;
        }
        const row = Array.isArray(data) ? data[0] : data;
        if (
          row &&
          typeof row.rank === 'number' &&
          typeof row.total_students === 'number'
        ) {
          setParentClassStats({
            rank: row.rank,
            totalStudents: row.total_students,
          });
        }
      } catch {
        if (!cancelled) setParentClassStats(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    userProfile,
    students,
    grades,
    settings.tahun_pelajaran,
    settings.semester,
  ]);

  // Monitor Supabase Auth Session & Public Catalog
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      loadedUserIdRef.current = null;
      clearPendingGradeSaves();
      setUserProfile(null);
      setParentClassStats(null);
      setClasses([]);
      setSubjects([]);
      setStudents([]);
      setGrades([]);
      setNonAcademics([]);
      setSupabaseProfiles([]);
      setAuthLoading(false);
      return;
    }

    let mounted = true;
    setAuthLoading(true);
    void fetchPublicCatalog();

    const loadProfile = async (
      userId: string,
      email: string,
      metadata?: Record<string, unknown>
    ) => {
      try {
        const { data } = await client
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (!mounted) return;
        if (data) {
          setUserProfile(data as UserProfile);
        } else {
          const metaRole = metadata?.role as UserRole | undefined;
          const safeRole: UserRole =
            metaRole &&
            ['admin', 'wali_kelas', 'guru', 'orang_tua'].includes(metaRole)
              ? metaRole
              : 'guru';
          setUserProfile({
            id: userId,
            email,
            full_name:
              (metadata?.full_name as string | undefined) || email.split('@')[0],
            role: safeRole,
            nip_nuptk: '-',
            assigned_class_id:
              (metadata?.assigned_class_id as string | undefined) || null,
            assigned_subject_ids: Array.isArray(metadata?.assigned_subject_ids)
              ? (metadata?.assigned_subject_ids as string[])
              : [],
            linked_student_nis:
              (metadata?.linked_student_nis as string | undefined) || '',
          });
        }
        await refreshFromSupabase();
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    };

    client.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return;
        if (data.session?.user) {
          loadedUserIdRef.current = data.session.user.id;
          void loadProfile(
            data.session.user.id,
            data.session.user.email || '',
            data.session.user.user_metadata
          );
        } else {
          loadedUserIdRef.current = null;
          setUserProfile(null);
          setAuthLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          loadedUserIdRef.current = null;
          setAuthLoading(false);
        }
      });

    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (session?.user) {
        if (
          (event === 'INITIAL_SESSION' ||
            event === 'TOKEN_REFRESHED' ||
            event === 'SIGNED_IN') &&
          loadedUserIdRef.current === session.user.id
        ) {
          return;
        }
        loadedUserIdRef.current = session.user.id;
        void loadProfile(
          session.user.id,
          session.user.email || '',
          session.user.user_metadata
        );
      } else {
        loadedUserIdRef.current = null;
        clearPendingGradeSaves();
        setUserProfile(null);
        setParentClassStats(null);
        setStudents([]);
        setGrades([]);
        setNonAcademics([]);
        setSupabaseProfiles([]);
      }
    });

    return () => {
      mounted = false;
      clearPendingGradeSaves();
      sub.subscription.unsubscribe();
    };
  }, [
    configVersion,
    fetchPublicCatalog,
    refreshFromSupabase,
    clearPendingGradeSaves,
  ]);

  const signIn = async (email: string, password: string): Promise<boolean> => {
    const client = getSupabaseClient();
    if (!client) {
      pushToast('error', 'Hubungkan proyek Supabase terlebih dahulu.');
      return false;
    }

    setAuthLoading(true);
    try {
      const { error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        pushToast('error', `Login gagal: ${translateAuthError(error.message)}`);
        return false;
      }
      pushToast('success', 'Berhasil masuk ke sistem online Supabase MDTU.');
      return true;
    } catch (err) {
      pushToast(
        'error',
        `Login gagal: ${translateAuthError(err instanceof Error ? err.message : undefined)}`
      );
      return false;
    } finally {
      setAuthLoading(false);
    }
  };

  const adminCreateUserAccount = async ({
    email,
    password,
    fullName,
    role,
    options,
  }: {
    email: string;
    password: string;
    fullName: string;
    role: UserRole;
    options?: SignUpExtraOptions;
  }): Promise<{ ok: boolean; error?: string; needsSqlSetup?: boolean }> => {
    if (userProfile?.role !== 'admin') {
      const msg = 'Hanya Admin yang dapat membuat akun pengguna.';
      pushToast('error', msg);
      return { ok: false, error: msg };
    }

    const client = getSupabaseClient();
    if (!client) {
      const msg = 'Hubungkan proyek Supabase terlebih dahulu.';
      pushToast('error', msg);
      return { ok: false, error: msg };
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();
    const cleanClassId =
      role === 'wali_kelas' && options?.assignedClassId
        ? options.assignedClassId
        : null;
    const cleanSubjectIds =
      role === 'guru' ? options?.assignedSubjectIds || [] : [];
    const cleanStudentNis =
      role === 'orang_tua' ? (options?.linkedStudentNis || '').trim() : '';

    // Jalur utama & instan: RPC SECURITY DEFINER langsung ke auth.users + public.profiles (tanpa email SMTP / rate limit)
    const { data: rpcProfile, error: rpcError } = await client.rpc(
      'admin_create_user_account',
      {
        p_email: cleanEmail,
        p_password: password,
        p_full_name: cleanName,
        p_role: role,
        p_assigned_class_id: cleanClassId,
        p_assigned_subject_ids: cleanSubjectIds,
        p_linked_student_nis: cleanStudentNis,
      }
    );

    if (!rpcError && rpcProfile) {
      setIsAccountRpcReady(true);
      const created = (
        Array.isArray(rpcProfile) ? rpcProfile[0] : rpcProfile
      ) as UserProfile;
      if (created?.id) {
        setSupabaseProfiles((prev) => {
          const next = [...prev.filter((p) => p.id !== created.id), created];
          next.sort((a, b) => a.full_name.localeCompare(b.full_name));
          return next;
        });
      }
      pushToast(
        'success',
        `Akun "${cleanName}" (${cleanEmail}) berhasil dibuat dan langsung aktif.`
      );
      return { ok: true };
    }

    const rpcMsg = rpcError?.message || '';
    const isMissingRpc =
      rpcError?.code === 'PGRST202' ||
      rpcMsg.includes('admin_create_user_account') ||
      rpcMsg.includes('schema cache') ||
      rpcMsg.includes('Could not find the function');

    if (rpcError && !isMissingRpc) {
      setIsAccountRpcReady(true);
      const translated = translateAuthError(rpcMsg);
      pushToast('error', `Gagal membuat akun: ${translated}`);
      return { ok: false, error: translated };
    }

    setIsAccountRpcReady(false);

    // Fallback jika SQL RPC terbaru belum dijalankan di Supabase SQL Editor
    const ephemeral = createEphemeralSupabaseClient();
    if (!ephemeral) {
      const msg = 'Hubungkan proyek Supabase terlebih dahulu.';
      pushToast('error', msg);
      return { ok: false, error: msg };
    }

    const { data, error } = await ephemeral.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: cleanName,
          role,
          assigned_class_id: cleanClassId || '',
          assigned_subject_ids: cleanSubjectIds,
          linked_student_nis: cleanStudentNis,
        },
      },
    });

    if (error) {
      const lowerErr = error.message.toLowerCase();
      const hitEmailLimit =
        lowerErr.includes('rate limit') ||
        lowerErr.includes('too many requests') ||
        lowerErr.includes('confirmation') ||
        lowerErr.includes('over_email_send');
      const translated = hitEmailLimit
        ? 'Pembuatan akun terkena batas pengiriman email Supabase (maks. 2 akun/jam) karena SQL Aktivasi Akun belum dijalankan di Supabase. Klik tombol "Salin SQL Aktivasi Akun" di bawah, jalankan di SQL Editor Supabase, lalu coba buat akun lagi.'
        : translateAuthError(error.message);
      pushToast('error', translated);
      return { ok: false, error: translated, needsSqlSetup: true };
    }

    if (
      data.user &&
      Array.isArray(data.user.identities) &&
      data.user.identities.length === 0
    ) {
      const msg = 'Email tersebut sudah terdaftar pada sistem.';
      pushToast('error', msg);
      return { ok: false, error: msg };
    }

    if (data.user) {
      const matchedStudent =
        role === 'orang_tua' && cleanStudentNis
          ? students.find(
              (s) => s.nis.trim().toLowerCase() === cleanStudentNis.toLowerCase()
            )
          : undefined;

      const { data: syncedProfile } = await client
        .from('profiles')
        .upsert(
          {
            id: data.user.id,
            email: cleanEmail,
            full_name: cleanName,
            role,
            assigned_class_id: cleanClassId,
            assigned_subject_ids: cleanSubjectIds,
            linked_student_id: matchedStudent?.id || null,
            linked_student_nis: cleanStudentNis,
          },
          { onConflict: 'id' }
        )
        .select('*')
        .maybeSingle();

      if (syncedProfile) {
        const profileRow = syncedProfile as UserProfile;
        setSupabaseProfiles((prev) => {
          const next = [
            ...prev.filter((p) => p.id !== profileRow.id),
            profileRow,
          ];
          next.sort((a, b) => a.full_name.localeCompare(b.full_name));
          return next;
        });
      }

      if (!data.user.email_confirmed_at && !data.session) {
        pushToast(
          'info',
          `Akun "${cleanName}" dibuat, tetapi email masih menunggu konfirmasi Supabase. Jalankan SQL terbaru di Skema SQL & Panduan agar akun baru langsung aktif.`
        );
      } else {
        pushToast(
          'success',
          `Akun "${cleanName}" (${cleanEmail}) berhasil dibuat.`
        );
      }
      return { ok: true };
    }

    const unknownErr = 'Gagal membuat akun. Periksa kembali skema SQL Supabase.';
    pushToast('error', unknownErr);
    return { ok: false, error: unknownErr };
  };

  const signOut = async () => {
    clearPendingGradeSaves();
    loadedUserIdRef.current = null;
    const client = getSupabaseClient();
    if (client) {
      await client.auth.signOut();
    }
    setUserProfile(null);
    setParentClassStats(null);
    setSelectedStudentId('');
    setGlobalSearchQuery('');
    setStudents([]);
    setGrades([]);
    setNonAcademics([]);
    setSupabaseProfiles([]);
    pushToast('info', 'Anda telah keluar dari sesi aplikasi.');
  };

  const updateSupabaseProfileRole = async (
    profile: UserProfile
  ): Promise<boolean> => {
    const client = getSupabaseClient();
    if (!client) return false;

    let linkedStudentId = profile.linked_student_id || null;
    if (profile.role === 'orang_tua' && profile.linked_student_nis) {
      const matched = students.find(
        (s) =>
          s.nis.trim().toLowerCase() ===
          profile.linked_student_nis?.trim().toLowerCase()
      );
      linkedStudentId = matched ? matched.id : null;
    } else if (profile.role !== 'orang_tua') {
      linkedStudentId = null;
    }

    const { data, error } = await client
      .from('profiles')
      .update({
        full_name: profile.full_name,
        role: profile.role,
        nip_nuptk: profile.nip_nuptk,
        assigned_class_id:
          profile.role === 'wali_kelas' ? profile.assigned_class_id || null : null,
        assigned_subject_ids:
          profile.role === 'guru' ? profile.assigned_subject_ids || [] : [],
        linked_student_id: linkedStudentId,
        linked_student_nis:
          profile.role === 'orang_tua' ? profile.linked_student_nis || '' : '',
      })
      .eq('id', profile.id)
      .select('*')
      .single();

    if (error) {
      pushToast('error', `Gagal memperbarui peran: ${error.message}`);
      return false;
    }

    if (data) {
      const updated = data as UserProfile;
      setSupabaseProfiles((prev) => {
        const next = prev.map((p) => (p.id === updated.id ? updated : p));
        next.sort((a, b) => a.full_name.localeCompare(b.full_name));
        return next;
      });
      if (userProfile?.id === updated.id) {
        setUserProfile(updated);
      }
    }
    pushToast('success', `Peran pengguna "${profile.full_name}" diperbarui.`);
    return true;
  };

  const adminUpdateUserPassword = async (
    userId: string,
    newPassword: string
  ): Promise<boolean> => {
    if (userProfile?.role !== 'admin') {
      pushToast('error', 'Hanya Admin yang dapat mengubah kata sandi akun.');
      return false;
    }
    if (newPassword.length < 6) {
      pushToast('error', 'Kata sandi baru minimal 6 karakter.');
      return false;
    }

    const client = getSupabaseClient();
    if (!client) return false;

    const { error } = await client.rpc('admin_update_user_password', {
      target_user_id: userId,
      new_password: newPassword,
    });

    if (error) {
      const msg = error.message || '';
      const isMissingRpc =
        error.code === 'PGRST202' ||
        msg.includes('admin_update_user_password') ||
        msg.includes('schema cache');
      if (isMissingRpc) {
        if (userId === userProfile.id) {
          const { error: selfErr } = await client.auth.updateUser({
            password: newPassword,
          });
          if (!selfErr) {
            pushToast('success', 'Kata sandi akun Anda berhasil diperbarui.');
            return true;
          }
        }
        pushToast(
          'error',
          'Fungsi SQL edit kata sandi belum terpasang di Supabase. Jalankan ulang SQL terbaru dari tab Skema SQL & Panduan.'
        );
        return false;
      }
      pushToast('error', `Gagal mengubah kata sandi: ${msg}`);
      return false;
    }

    pushToast('success', 'Kata sandi akun berhasil diperbarui.');
    return true;
  };

  const adminDeleteUserAccount = async (
    userId: string,
    fullName?: string
  ): Promise<boolean> => {
    if (userProfile?.role !== 'admin') {
      pushToast('error', 'Hanya Admin yang dapat menghapus akun.');
      return false;
    }
    if (userId === userProfile.id) {
      pushToast(
        'error',
        'Tidak dapat menghapus akun Admin yang sedang aktif digunakan.'
      );
      return false;
    }

    const client = getSupabaseClient();
    if (!client) return false;

    const { error } = await client.rpc('admin_delete_user_account', {
      target_user_id: userId,
    });

    if (error) {
      const msg = error.message || '';
      const isMissingRpc =
        error.code === 'PGRST202' ||
        msg.includes('admin_delete_user_account') ||
        msg.includes('schema cache');
      if (isMissingRpc) {
        pushToast(
          'error',
          'Fungsi SQL hapus akun belum terpasang di Supabase. Jalankan ulang SQL terbaru dari tab Skema SQL & Panduan.'
        );
        return false;
      }
      pushToast('error', `Gagal menghapus akun: ${msg}`);
      return false;
    }

    setSupabaseProfiles((prev) => prev.filter((p) => p.id !== userId));
    pushToast(
      'success',
      `Akun "${fullName || 'pengguna'}" berhasil dihapus permanen.`
    );
    return true;
  };

  const updateSupabaseCredentials = async (url: string, anonKey: string) => {
    const cleanUrl = url.trim().replace(/\/+$/, '');
    const cleanKey = anonKey.trim();
    const currentClient = getSupabaseClient();
    const sessionRes = currentClient
      ? await currentClient.auth.getSession()
      : null;
    const accessToken = sessionRes?.data.session?.access_token;

    const serverRes = await saveServerSupabaseConfig(
      cleanUrl,
      cleanKey,
      accessToken
    );
    if (!serverRes.ok && serverRes.message) {
      pushToast('error', serverRes.message);
      return;
    }

    const isSame =
      supabaseCfg.url === cleanUrl && supabaseCfg.anonKey === cleanKey;
    saveSupabaseConfig(cleanUrl, cleanKey);
    if (!isSame) {
      setUserProfile(null);
    }
    setConfigVersion((v) => v + 1);
    pushToast(
      'success',
      serverRes.ok
        ? 'Koneksi Supabase aktif dan tersinkron otomatis untuk seluruh browser & web baru.'
        : 'Koneksi Supabase tersimpan di browser ini. Gunakan Link Akses Web Otomatis untuk perangkat lain.'
    );
  };

  const resetSupabaseCredentials = async () => {
    const currentClient = getSupabaseClient();
    const sessionRes = currentClient
      ? await currentClient.auth.getSession()
      : null;
    const accessToken = sessionRes?.data.session?.access_token;

    const serverRes = await deleteServerSupabaseConfig(accessToken);
    if (!serverRes.ok && serverRes.message) {
      pushToast('error', serverRes.message);
      return;
    }

    clearSupabaseConfig();
    setUserProfile(null);
    setConfigVersion((v) => v + 1);
    pushToast('info', 'Koneksi Supabase telah diputuskan.');
  };

  const initializeMdtuDataInSupabase = async () => {
    const client = getSupabaseClient();
    if (!client || !userProfile) {
      pushToast('error', 'Harus terhubung dan login ke Supabase terlebih dahulu.');
      return;
    }
    setDataLoading(true);
    try {
      const { data: existingSettings } = await client
        .from('madrasah_settings')
        .select('id')
        .limit(1);
      if (existingSettings && existingSettings.length > 0) {
        const { id: _ignored, ...rest } = INITIAL_SETTINGS;
        await client
          .from('madrasah_settings')
          .update(rest)
          .eq('id', existingSettings[0].id);
      } else {
        const { id: _ignored, ...rest } = INITIAL_SETTINGS;
        await client.from('madrasah_settings').insert(rest);
      }

      const classIdMap = new Map<string, string>();
      for (const cls of INITIAL_CLASSES) {
        const { data: found } = await client
          .from('classes')
          .select('id')
          .eq('name', cls.name)
          .eq('academic_year', cls.academic_year)
          .maybeSingle();
        if (found) {
          classIdMap.set(cls.id, found.id);
        } else {
          const { data: inserted, error } = await client
            .from('classes')
            .insert({
              name: cls.name,
              level: cls.level,
              academic_year: cls.academic_year,
              wali_kelas_name: cls.wali_kelas_name,
              wali_kelas_nip: cls.wali_kelas_nip,
            })
            .select('id')
            .single();
          if (error) throw error;
          classIdMap.set(cls.id, inserted.id);
        }
      }

      const subjectIdMap = new Map<string, string>();
      for (const subj of INITIAL_SUBJECTS) {
        const { data: found } = await client
          .from('subjects')
          .select('id')
          .eq('code', subj.code)
          .maybeSingle();
        if (found) {
          subjectIdMap.set(subj.id, found.id);
        } else {
          const { data: inserted, error } = await client
            .from('subjects')
            .insert({
              code: subj.code,
              name: subj.name,
              arabic_name: subj.arabic_name,
              teacher_name: subj.teacher_name,
              category: subj.category,
              kkm: subj.kkm,
              sort_order: subj.sort_order,
            })
            .select('id')
            .single();
          if (error) throw error;
          subjectIdMap.set(subj.id, inserted.id);
        }
      }

      const studentIdMap = new Map<string, string>();
      for (const st of INITIAL_STUDENTS) {
        const mappedClassId = classIdMap.get(st.class_id);
        if (!mappedClassId) continue;
        const { data: found } = await client
          .from('students')
          .select('id')
          .eq('nis', st.nis)
          .maybeSingle();
        if (found) {
          studentIdMap.set(st.id, found.id);
        } else {
          const { data: inserted, error } = await client
            .from('students')
            .insert({
              nis: st.nis,
              nisn: st.nisn,
              full_name: st.full_name,
              birth_place: st.birth_place,
              birth_date: st.birth_date || null,
              gender: st.gender,
              parent_name: st.parent_name,
              address: st.address,
              class_id: mappedClassId,
              status: st.status,
            })
            .select('id')
            .single();
          if (error) throw error;
          studentIdMap.set(st.id, inserted.id);
        }
      }

      const gradeRows = INITIAL_GRADES.map((g) => {
        const sId = studentIdMap.get(g.student_id);
        const subId = subjectIdMap.get(g.subject_id);
        const cId = classIdMap.get(g.class_id);
        if (!sId || !subId || !cId) return null;
        return {
          student_id: sId,
          subject_id: subId,
          class_id: cId,
          academic_year: g.academic_year,
          semester: g.semester,
          formatif: g.formatif,
          pts: g.pts,
          pas: g.pas,
          praktik: g.praktik,
          final_score: g.final_score,
          predicate: g.predicate,
          description: g.description,
        };
      }).filter((row): row is NonNullable<typeof row> => row !== null);

      if (gradeRows.length > 0) {
        const { error } = await client
          .from('grades')
          .upsert(gradeRows, {
            onConflict: 'student_id,subject_id,academic_year,semester',
          });
        if (error) throw error;
      }

      const nonAcadRows = INITIAL_NON_ACADEMIC.map((n) => {
        const sId = studentIdMap.get(n.student_id);
        const cId = classIdMap.get(n.class_id);
        if (!sId || !cId) return null;
        return {
          student_id: sId,
          class_id: cId,
          academic_year: n.academic_year,
          semester: n.semester,
          sikap_spiritual_angka: n.sikap_spiritual_angka,
          sikap_spiritual: n.sikap_spiritual,
          akhlak_catatan: n.akhlak_catatan,
          sikap_sosial_angka: n.sikap_sosial_angka,
          sikap_sosial: n.sikap_sosial,
          sosial_catatan: n.sosial_catatan,
          ekskul_1_nama: n.ekskul_1_nama,
          ekskul_1_nilai: n.ekskul_1_nilai,
          ekskul_2_nama: n.ekskul_2_nama,
          ekskul_2_nilai: n.ekskul_2_nilai,
          sakit: n.sakit,
          izin: n.izin,
          alpa: n.alpa,
          catatan_wali: n.catatan_wali,
          keputusan_naik: n.keputusan_naik,
        };
      }).filter((row): row is NonNullable<typeof row> => row !== null);

      if (nonAcadRows.length > 0) {
        const { error } = await client
          .from('non_academic_records')
          .upsert(nonAcadRows, {
            onConflict: 'student_id,academic_year,semester',
          });
        if (error) throw error;
      }

      await refreshFromSupabase();
      pushToast(
        'success',
        'Struktur kelas, mata pelajaran, dan data awal MDTU berhasil dibuat di Supabase.'
      );
    } catch (err) {
      pushToast(
        'error',
        `Gagal inisialisasi ke Supabase: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setDataLoading(false);
    }
  };

  // ==================== MUTATIONS (ONLINE SUPABASE) ====================

  const updateSettings = async (next: MadrasahSettings): Promise<boolean> => {
    const client = getSupabaseClient();
    if (!client) return false;

    const { id, ...rest } = next;
    if (id && id !== 'settings-default') {
      const { data, error } = await client
        .from('madrasah_settings')
        .update(rest)
        .eq('id', id)
        .select('*')
        .single();
      if (error) {
        pushToast('error', `Gagal menyimpan pengaturan: ${error.message}`);
        return false;
      }
      if (data) setSettings(data as MadrasahSettings);
    } else {
      const { data, error } = await client
        .from('madrasah_settings')
        .insert(rest)
        .select('*')
        .single();
      if (error) {
        pushToast('error', `Gagal menyimpan pengaturan: ${error.message}`);
        return false;
      }
      if (data) setSettings(data as MadrasahSettings);
    }
    pushToast('success', 'Pengaturan madrasah & bobot nilai disimpan ke Supabase.');
    return true;
  };

  const upsertClass = async (
    item: Omit<MadrasahClass, 'id'> & { id?: string }
  ): Promise<boolean> => {
    const client = getSupabaseClient();
    if (!client) return false;

    const payload = {
      name: item.name,
      level: item.level,
      academic_year: item.academic_year,
      wali_kelas_name: item.wali_kelas_name,
      wali_kelas_nip: item.wali_kelas_nip,
    };

    const { data, error } = item.id
      ? await client
          .from('classes')
          .update(payload)
          .eq('id', item.id)
          .select('*')
          .single()
      : await client.from('classes').insert(payload).select('*').single();

    if (error) {
      pushToast('error', error.message);
      return false;
    }

    if (data) {
      const saved = data as MadrasahClass;
      setClasses((prev) => {
        const next = item.id
          ? prev.map((c) => (c.id === saved.id ? saved : c))
          : [...prev, saved];
        next.sort((a, b) => a.level - b.level);
        return next;
      });
    }
    pushToast('success', 'Data kelas berhasil disimpan ke Supabase.');
    return true;
  };

  const deleteClass = async (id: string) => {
    const hasStudents = students.some((s) => s.class_id === id);
    if (hasStudents) {
      pushToast(
        'error',
        'Kelas masih memiliki santri. Pindahkan atau hapus data santri terlebih dahulu.'
      );
      return;
    }
    const client = getSupabaseClient();
    if (!client) return;

    const { error } = await client.from('classes').delete().eq('id', id);
    if (error) {
      pushToast('error', error.message);
      return;
    }
    setClasses((prev) => prev.filter((c) => c.id !== id));
    pushToast('success', 'Kelas dihapus dari Supabase.');
  };

  const upsertSubject = async (
    item: Omit<Subject, 'id'> & { id?: string }
  ): Promise<boolean> => {
    const client = getSupabaseClient();
    if (!client) return false;

    const payload = {
      code: item.code,
      name: item.name,
      arabic_name: item.arabic_name,
      teacher_name: item.teacher_name,
      category: item.category,
      kkm: item.kkm,
      sort_order: item.sort_order,
    };

    const { data, error } = item.id
      ? await client
          .from('subjects')
          .update(payload)
          .eq('id', item.id)
          .select('*')
          .single()
      : await client.from('subjects').insert(payload).select('*').single();

    if (error) {
      pushToast('error', error.message);
      return false;
    }

    if (data) {
      const saved = data as Subject;
      setSubjects((prev) => {
        const next = item.id
          ? prev.map((s) => (s.id === saved.id ? saved : s))
          : [...prev, saved];
        next.sort((a, b) => a.sort_order - b.sort_order);
        return next;
      });
    }
    pushToast('success', 'Data mata pelajaran & KKM disimpan ke Supabase.');
    return true;
  };

  const deleteSubject = async (id: string) => {
    const client = getSupabaseClient();
    if (!client) return;

    const { error } = await client.from('subjects').delete().eq('id', id);
    if (error) {
      pushToast('error', error.message);
      return;
    }
    setSubjects((prev) => prev.filter((s) => s.id !== id));
    pushToast('success', 'Mata pelajaran dihapus.');
  };

  const upsertStudent = async (
    item: Omit<Student, 'id'> & { id?: string }
  ): Promise<boolean> => {
    const client = getSupabaseClient();
    if (!client) return false;

    const payload = {
      nis: item.nis,
      nisn: item.nisn,
      full_name: item.full_name,
      birth_place: item.birth_place,
      birth_date: item.birth_date || null,
      gender: item.gender,
      parent_name: item.parent_name,
      address: item.address,
      class_id: item.class_id,
      status: item.status,
    };

    const { data, error } = item.id
      ? await client
          .from('students')
          .update(payload)
          .eq('id', item.id)
          .select('*')
          .single()
      : await client.from('students').insert(payload).select('*').single();

    if (error) {
      pushToast('error', error.message);
      return false;
    }

    if (data) {
      const saved = data as Student;
      setStudents((prev) => {
        const next = item.id
          ? prev.map((s) => (s.id === saved.id ? saved : s))
          : [...prev, saved];
        next.sort((a, b) => a.full_name.localeCompare(b.full_name));
        return next;
      });
    }
    pushToast('success', 'Data santri berhasil disimpan ke Supabase.');
    return true;
  };

  const deleteStudent = async (id: string) => {
    const client = getSupabaseClient();
    if (!client) return;

    const { error } = await client.from('students').delete().eq('id', id);
    if (error) {
      pushToast('error', error.message);
      return;
    }
    setStudents((prev) => prev.filter((s) => s.id !== id));
    pushToast('success', 'Data santri dihapus.');
  };

  const upsertGrade = async (params: {
    student_id: string;
    subject_id: string;
    class_id: string;
    formatif: number;
    pts: number;
    pas: number;
    praktik: number;
    customDescription?: string;
  }) => {
    const client = getSupabaseClient();
    if (!client) return;

    const subj = subjects.find((s) => s.id === params.subject_id);
    const kkm = subj?.kkm ?? 70;
    const finalScore = calculateFinalScore(
      params.formatif,
      params.pts,
      params.pas,
      params.praktik,
      settings
    );
    const pred = getPredicate(finalScore, kkm);
    const description =
      params.customDescription ||
      generateCompetencyDescription(
        subj?.name || 'Mata Pelajaran',
        finalScore,
        kkm,
        subj?.category || 'Pengetahuan'
      );

    const academicYear = settings.tahun_pelajaran;
    const semester = settings.semester;

    const recordPayload: Omit<GradeRecord, 'id'> = {
      student_id: params.student_id,
      subject_id: params.subject_id,
      class_id: params.class_id,
      academic_year: academicYear,
      semester,
      formatif: params.formatif,
      pts: params.pts,
      pas: params.pas,
      praktik: params.praktik,
      final_score: finalScore,
      predicate: pred.letter,
      description,
      updated_by: userProfile?.id || null,
    };

    const key = `${params.student_id}::${params.subject_id}::${academicYear}::${semester}`;

    // Perbarui state lokal secara optimis agar pengetikan angka selalu responsif
    setGrades((prev) => {
      const idx = prev.findIndex(
        (g) =>
          g.student_id === params.student_id &&
          g.subject_id === params.subject_id &&
          g.academic_year === academicYear &&
          g.semester === semester
      );
      if (idx >= 0) {
        const clone = [...prev];
        clone[idx] = { ...clone[idx], ...recordPayload };
        return clone;
      }
      return [...prev, { id: `temp-${key}`, ...recordPayload }];
    });

    const existingTimer = gradeDebounceTimersRef.current.get(key);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    pendingGradePayloadsRef.current.set(key, {
      payload: recordPayload,
      studentId: params.student_id,
      subjectId: params.subject_id,
      academicYear,
      semester,
    });
    syncPendingSavesCount();

    const timer = setTimeout(async () => {
      gradeDebounceTimersRef.current.delete(key);
      const pending = pendingGradePayloadsRef.current.get(key);
      if (!pending) return;
      pendingGradePayloadsRef.current.delete(key);
      inflightSavesRef.current += 1;
      syncPendingSavesCount();

      try {
        const { data, error } = await client
          .from('grades')
          .upsert(pending.payload, {
            onConflict: 'student_id,subject_id,academic_year,semester',
          })
          .select('*')
          .single();

        if (error) {
          pushToast('error', `Gagal simpan nilai ke Supabase: ${error.message}`);
          return;
        }

        if (data && !pendingGradePayloadsRef.current.has(key)) {
          const normalized: GradeRecord = {
            ...(data as GradeRecord),
            formatif: Number(data.formatif),
            pts: Number(data.pts),
            pas: Number(data.pas),
            praktik: Number(data.praktik),
            final_score: Number(data.final_score),
          };
          setGrades((prev) => {
            const idx = prev.findIndex(
              (g) =>
                g.student_id === pending.studentId &&
                g.subject_id === pending.subjectId &&
                g.academic_year === pending.academicYear &&
                g.semester === pending.semester
            );
            if (idx >= 0) {
              const clone = [...prev];
              clone[idx] = normalized;
              return clone;
            }
            return [...prev, normalized];
          });
        }
      } catch (err) {
        pushToast(
          'error',
          `Gagal simpan nilai: ${err instanceof Error ? err.message : 'Koneksi terganggu'}`
        );
      } finally {
        inflightSavesRef.current = Math.max(0, inflightSavesRef.current - 1);
        syncPendingSavesCount();
      }
    }, 450);

    gradeDebounceTimersRef.current.set(key, timer);
  };

  const upsertNonAcademic = async (record: NonAcademicRecord) => {
    const client = getSupabaseClient();
    if (!client) return;

    const { id: _id, ...payload } = record;
    const { data, error } = await client
      .from('non_academic_records')
      .upsert(payload, {
        onConflict: 'student_id,academic_year,semester',
      })
      .select('*')
      .single();

    if (error) {
      pushToast('error', `Gagal simpan catatan wali: ${error.message}`);
      return;
    }

    if (data) {
      setNonAcademics((prev) => {
        const idx = prev.findIndex(
          (n) =>
            n.student_id === record.student_id &&
            n.academic_year === record.academic_year &&
            n.semester === record.semester
        );
        if (idx >= 0) {
          const clone = [...prev];
          clone[idx] = data as NonAcademicRecord;
          return clone;
        }
        return [...prev, data as NonAcademicRecord];
      });
    }
    pushToast('success', 'Data sikap, ekskul & kehadiran tersimpan ke Supabase.');
  };

  const bulkImportData = async (params: {
    newStudents: (Omit<Student, 'id'> & { id?: string })[];
    newGrades: {
      studentNis: string;
      subjectId: string;
      formatif: number;
      pts: number;
      pas: number;
      praktik: number;
      predicateOverride?: string;
      descriptionOverride?: string;
    }[];
    attendanceUpdates: {
      studentNis: string;
      sakit: number;
      izin: number;
      alpa: number;
      asScore?: number;
      assScore?: number;
      pesanWalas?: string;
    }[];
    targetClassId: string;
  }) => {
    const client = getSupabaseClient();
    if (!client) {
      pushToast('error', 'Harus terhubung ke Supabase.');
      return { importedStudents: 0, importedGrades: 0 };
    }

    let importedStudents = 0;
    let importedGrades = 0;

    const nisToStudentId = new Map<string, string>();
    students.forEach((s) => nisToStudentId.set(s.nis, s.id));

    // Batch upsert seluruh santri sekaligus (jauh lebih cepat dibanding per-baris)
    const dedupedStudentsMap = new Map<string, Record<string, unknown>>();
    for (const st of params.newStudents) {
      dedupedStudentsMap.set(st.nis.trim(), {
        nis: st.nis.trim(),
        nisn: st.nisn,
        full_name: st.full_name,
        birth_place: st.birth_place,
        birth_date: st.birth_date || null,
        gender: st.gender,
        parent_name: st.parent_name,
        address: st.address,
        class_id: params.targetClassId,
        status: st.status,
      });
    }
    const studentPayloads = Array.from(dedupedStudentsMap.values());
    if (studentPayloads.length > 0) {
      const { data: upsertedList, error: stErr } = await client
        .from('students')
        .upsert(studentPayloads, { onConflict: 'nis' })
        .select('id, nis');
      if (stErr) {
        pushToast('error', `Gagal import data santri: ${stErr.message}`);
      } else if (upsertedList) {
        upsertedList.forEach((u) => nisToStudentId.set(u.nis, u.id));
        importedStudents = upsertedList.length;
      }
    }

    const gradeMap = new Map<
      string,
      {
        student_id: string;
        subject_id: string;
        class_id: string;
        academic_year: string;
        semester: 'Ganjil' | 'Genap';
        formatif: number;
        pts: number;
        pas: number;
        praktik: number;
        final_score: number;
        predicate: string;
        description: string;
      }
    >();

    for (const g of params.newGrades) {
      const stId = nisToStudentId.get(g.studentNis);
      const subj = subjects.find((s) => s.id === g.subjectId);
      if (!stId || !subj) continue;
      const finalScore = calculateFinalScore(
        g.formatif,
        g.pts,
        g.pas,
        g.praktik,
        settings
      );
      const pred = getPredicate(finalScore, subj.kkm);
      gradeMap.set(`${stId}::${subj.id}`, {
        student_id: stId,
        subject_id: subj.id,
        class_id: params.targetClassId,
        academic_year: settings.tahun_pelajaran,
        semester: settings.semester,
        formatif: g.formatif,
        pts: g.pts,
        pas: g.pas,
        praktik: g.praktik,
        final_score: finalScore,
        predicate: g.predicateOverride || pred.letter,
        description:
          g.descriptionOverride ||
          generateCompetencyDescription(
            subj.name,
            finalScore,
            subj.kkm,
            subj.category
          ),
      });
    }

    const gradePayloads = Array.from(gradeMap.values());
    if (gradePayloads.length > 0) {
      const { error } = await client.from('grades').upsert(gradePayloads, {
        onConflict: 'student_id,subject_id,academic_year,semester',
      });
      if (!error) importedGrades = gradePayloads.length;
      else pushToast('error', `Gagal import sebagian nilai: ${error.message}`);
    }

    const nonAcadMap = new Map<string, Record<string, unknown>>();
    for (const att of params.attendanceUpdates) {
      const stId = nisToStudentId.get(att.studentNis);
      if (!stId) continue;
      nonAcadMap.set(stId, {
        student_id: stId,
        class_id: params.targetClassId,
        academic_year: settings.tahun_pelajaran,
        semester: settings.semester,
        sikap_spiritual_angka: att.asScore ?? 82,
        sikap_spiritual: 'Berkembang Sesuai Harapan',
        akhlak_catatan:
          'Siswa memiliki sikap yang berkembang sesuai harapan dalam nilai religious meliputi beriman, bertaqwa, bersih, toleransi, dan cinta lingkungan',
        sikap_sosial_angka: att.assScore ?? 82,
        sikap_sosial: 'Berkembang Sesuai Harapan',
        sosial_catatan:
          'Siswa memiliki sikap berkembang sesuai harapan dalam melakukan interaksi dengan teman dan lingkungannya',
        sakit: att.sakit,
        izin: att.izin,
        alpa: att.alpa,
        catatan_wali:
          att.pesanWalas ||
          'Ananda mengikuti pembelajaran dengan baik dan menunjukkan sikap yang sopan. Semoga terus meningkatkan semangat belajar.',
      });
    }
    const nonAcadPayloads = Array.from(nonAcadMap.values());
    if (nonAcadPayloads.length > 0) {
      await client
        .from('non_academic_records')
        .upsert(nonAcadPayloads, {
          onConflict: 'student_id,academic_year,semester',
        });
    }

    await refreshFromSupabase();
    pushToast(
      'success',
      `Import ke Supabase selesai: ${importedStudents} santri, ${importedGrades} nilai.`
    );
    return { importedStudents, importedGrades };
  };

  return (
    <AppContext.Provider
      value={{
        settings,
        classes,
        subjects,
        students,
        grades,
        nonAcademics,
        selectedClassId,
        setSelectedClassId,
        selectedStudentId,
        setSelectedStudentId,
        globalSearchQuery,
        setGlobalSearchQuery,
        configReady,
        isSupabaseConfigured,
        supabaseUrl: supabaseCfg.url,
        supabaseAnonKey: supabaseCfg.anonKey,
        configSource: supabaseCfg.source,
        userProfile,
        supabaseProfiles,
        authLoading,
        dataLoading,
        isOnline,
        pendingSavesCount,
        parentClassStats,
        isAccountRpcReady,
        checkAccountRpcAvailability,
        toasts,
        pushToast,
        dismissToast,
        signIn,
        adminCreateUserAccount,
        signOut,
        updateSupabaseProfileRole,
        adminUpdateUserPassword,
        adminDeleteUserAccount,
        updateSupabaseCredentials,
        resetSupabaseCredentials,
        refreshFromSupabase,
        initializeMdtuDataInSupabase,
        updateSettings,
        upsertClass,
        deleteClass,
        upsertSubject,
        deleteSubject,
        upsertStudent,
        deleteStudent,
        upsertGrade,
        upsertNonAcademic,
        bulkImportData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
