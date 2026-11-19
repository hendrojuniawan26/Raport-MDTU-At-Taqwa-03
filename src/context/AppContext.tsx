import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
import {
  clearSupabaseConfig,
  createEphemeralSupabaseClient,
  getSupabaseClient,
  getSupabaseConfig,
  saveSupabaseConfig,
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

  // Auth & Supabase Connection
  isSupabaseConfigured: boolean;
  supabaseUrl: string;
  supabaseAnonKey: string;
  configSource: 'env' | 'localStorage' | 'unconfigured';
  userProfile: UserProfile | null;
  supabaseProfiles: UserProfile[];
  authLoading: boolean;
  dataLoading: boolean;
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
  }) => Promise<boolean>;
  signOut: () => Promise<void>;
  updateSupabaseProfileRole: (profile: UserProfile) => Promise<void>;

  updateSupabaseCredentials: (url: string, anonKey: string) => Promise<void>;
  resetSupabaseCredentials: () => void;
  refreshFromSupabase: () => Promise<void>;
  initializeMdtuDataInSupabase: () => Promise<void>;

  // Mutations (Supabase PostgreSQL)
  updateSettings: (next: MadrasahSettings) => Promise<void>;
  upsertClass: (item: Omit<MadrasahClass, 'id'> & { id?: string }) => Promise<void>;
  deleteClass: (id: string) => Promise<void>;
  upsertSubject: (item: Omit<Subject, 'id'> & { id?: string }) => Promise<void>;
  deleteSubject: (id: string) => Promise<void>;
  upsertStudent: (item: Omit<Student, 'id'> & { id?: string }) => Promise<void>;
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

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<MadrasahSettings>(INITIAL_SETTINGS);
  const [classes, setClasses] = useState<MadrasahClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<GradeRecord[]>([]);
  const [nonAcademics, setNonAcademics] = useState<NonAcademicRecord[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [supabaseProfiles, setSupabaseProfiles] = useState<UserProfile[]>([]);

  const [configVersion, setConfigVersion] = useState(0);
  const supabaseCfg = useMemo(() => {
    void configVersion;
    return getSupabaseConfig();
  }, [configVersion]);

  const isSupabaseConfigured = supabaseCfg.source !== 'unconfigured';

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(isSupabaseConfigured);
  const [dataLoading, setDataLoading] = useState<boolean>(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

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
    }
  }, [pushToast]);

  // Monitor Supabase Auth Session & Public Catalog
  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) {
      setUserProfile(null);
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
          metaRole && ['admin', 'wali_kelas', 'guru', 'orang_tua'].includes(metaRole)
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
    };

    client.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session?.user) {
        loadProfile(
          data.session.user.id,
          data.session.user.email || '',
          data.session.user.user_metadata
        ).finally(() => mounted && setAuthLoading(false));
      } else {
        setUserProfile(null);
        setAuthLoading(false);
      }
    });

    const { data: sub } = client.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        loadProfile(
          session.user.id,
          session.user.email || '',
          session.user.user_metadata
        );
      } else {
        setUserProfile(null);
        setStudents([]);
        setGrades([]);
        setNonAcademics([]);
        setSupabaseProfiles([]);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [configVersion, fetchPublicCatalog, refreshFromSupabase]);

  const signIn = async (email: string, password: string): Promise<boolean> => {
    const client = getSupabaseClient();
    if (!client) {
      pushToast('error', 'Hubungkan proyek Supabase terlebih dahulu.');
      return false;
    }

    setAuthLoading(true);
    const { error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setAuthLoading(false);
    if (error) {
      pushToast('error', `Login gagal: ${error.message}`);
      return false;
    }
    pushToast('success', 'Berhasil masuk ke sistem online Supabase MDTU.');
    return true;
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
  }): Promise<boolean> => {
    if (userProfile?.role !== 'admin') {
      pushToast('error', 'Hanya Admin yang dapat membuat akun pengguna.');
      return false;
    }

    const ephemeral = createEphemeralSupabaseClient();
    if (!ephemeral) {
      pushToast('error', 'Hubungkan proyek Supabase terlebih dahulu.');
      return false;
    }

    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await ephemeral.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          role,
          assigned_class_id:
            role === 'wali_kelas' ? options?.assignedClassId || '' : '',
          assigned_subject_ids:
            role === 'guru' ? options?.assignedSubjectIds || [] : [],
          linked_student_nis:
            role === 'orang_tua' ? (options?.linkedStudentNis || '').trim() : '',
        },
      },
    });

    if (error) {
      pushToast('error', `Gagal membuat akun: ${error.message}`);
      return false;
    }

    // Tunggu sebentar agar trigger handle_new_user selesai membuat baris profiles
    await new Promise((r) => setTimeout(r, 450));
    await refreshFromSupabase();

    if (data.user) {
      pushToast(
        'success',
        `Akun "${fullName.trim()}" (${cleanEmail}) berhasil dibuat.`
      );
    }
    return true;
  };

  const signOut = async () => {
    const client = getSupabaseClient();
    if (client) {
      await client.auth.signOut();
    }
    setUserProfile(null);
    setStudents([]);
    setGrades([]);
    setNonAcademics([]);
    setSupabaseProfiles([]);
    pushToast('info', 'Anda telah keluar dari sesi aplikasi.');
  };

  const updateSupabaseProfileRole = async (profile: UserProfile) => {
    const client = getSupabaseClient();
    if (!client) return;

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

    const { error } = await client
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
      .eq('id', profile.id);

    if (error) {
      pushToast('error', `Gagal memperbarui peran: ${error.message}`);
      return;
    }
    await refreshFromSupabase();
    pushToast('success', `Peran pengguna "${profile.full_name}" diperbarui.`);
  };

  const updateSupabaseCredentials = async (url: string, anonKey: string) => {
    saveSupabaseConfig(url, anonKey);
    setUserProfile(null);
    setConfigVersion((v) => v + 1);
    pushToast('success', 'Koneksi Supabase disimpan. Silakan masuk atau daftar akun.');
  };

  const resetSupabaseCredentials = () => {
    clearSupabaseConfig();
    setUserProfile(null);
    setConfigVersion((v) => v + 1);
    pushToast('info', 'Konfigurasi Supabase pada browser telah dihapus.');
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

  const updateSettings = async (next: MadrasahSettings) => {
    const client = getSupabaseClient();
    if (!client) return;

    const { id, ...rest } = next;
    if (id && id !== 'settings-default') {
      const { error } = await client
        .from('madrasah_settings')
        .update(rest)
        .eq('id', id);
      if (error) {
        pushToast('error', `Gagal menyimpan pengaturan: ${error.message}`);
        return;
      }
    } else {
      const { error } = await client.from('madrasah_settings').insert(rest);
      if (error) {
        pushToast('error', `Gagal menyimpan pengaturan: ${error.message}`);
        return;
      }
    }
    await refreshFromSupabase();
    pushToast('success', 'Pengaturan madrasah & bobot nilai disimpan ke Supabase.');
  };

  const upsertClass = async (
    item: Omit<MadrasahClass, 'id'> & { id?: string }
  ) => {
    const client = getSupabaseClient();
    if (!client) return;

    if (item.id) {
      const { error } = await client
        .from('classes')
        .update({
          name: item.name,
          level: item.level,
          academic_year: item.academic_year,
          wali_kelas_name: item.wali_kelas_name,
          wali_kelas_nip: item.wali_kelas_nip,
        })
        .eq('id', item.id);
      if (error) {
        pushToast('error', error.message);
        return;
      }
    } else {
      const { error } = await client.from('classes').insert({
        name: item.name,
        level: item.level,
        academic_year: item.academic_year,
        wali_kelas_name: item.wali_kelas_name,
        wali_kelas_nip: item.wali_kelas_nip,
      });
      if (error) {
        pushToast('error', error.message);
        return;
      }
    }
    await refreshFromSupabase();
    pushToast('success', 'Data kelas berhasil disimpan ke Supabase.');
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
    await refreshFromSupabase();
    pushToast('success', 'Kelas dihapus dari Supabase.');
  };

  const upsertSubject = async (item: Omit<Subject, 'id'> & { id?: string }) => {
    const client = getSupabaseClient();
    if (!client) return;

    if (item.id) {
      const { error } = await client
        .from('subjects')
        .update({
          code: item.code,
          name: item.name,
          arabic_name: item.arabic_name,
          teacher_name: item.teacher_name,
          category: item.category,
          kkm: item.kkm,
          sort_order: item.sort_order,
        })
        .eq('id', item.id);
      if (error) {
        pushToast('error', error.message);
        return;
      }
    } else {
      const { error } = await client.from('subjects').insert({
        code: item.code,
        name: item.name,
        arabic_name: item.arabic_name,
        teacher_name: item.teacher_name,
        category: item.category,
        kkm: item.kkm,
        sort_order: item.sort_order,
      });
      if (error) {
        pushToast('error', error.message);
        return;
      }
    }
    await refreshFromSupabase();
    pushToast('success', 'Data mata pelajaran & KKM disimpan ke Supabase.');
  };

  const deleteSubject = async (id: string) => {
    const client = getSupabaseClient();
    if (!client) return;

    const { error } = await client.from('subjects').delete().eq('id', id);
    if (error) {
      pushToast('error', error.message);
      return;
    }
    await refreshFromSupabase();
    pushToast('success', 'Mata pelajaran dihapus.');
  };

  const upsertStudent = async (item: Omit<Student, 'id'> & { id?: string }) => {
    const client = getSupabaseClient();
    if (!client) return;

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
    if (item.id) {
      const { error } = await client
        .from('students')
        .update(payload)
        .eq('id', item.id);
      if (error) {
        pushToast('error', error.message);
        return;
      }
    } else {
      const { error } = await client.from('students').insert(payload);
      if (error) {
        pushToast('error', error.message);
        return;
      }
    }
    await refreshFromSupabase();
    pushToast('success', 'Data santri berhasil disimpan ke Supabase.');
  };

  const deleteStudent = async (id: string) => {
    const client = getSupabaseClient();
    if (!client) return;

    const { error } = await client.from('students').delete().eq('id', id);
    if (error) {
      pushToast('error', error.message);
      return;
    }
    await refreshFromSupabase();
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

    const recordPayload: Omit<GradeRecord, 'id'> = {
      student_id: params.student_id,
      subject_id: params.subject_id,
      class_id: params.class_id,
      academic_year: settings.tahun_pelajaran,
      semester: settings.semester,
      formatif: params.formatif,
      pts: params.pts,
      pas: params.pas,
      praktik: params.praktik,
      final_score: finalScore,
      predicate: pred.letter,
      description,
    };

    const { data, error } = await client
      .from('grades')
      .upsert(recordPayload, {
        onConflict: 'student_id,subject_id,academic_year,semester',
      })
      .select('*')
      .single();

    if (error) {
      pushToast('error', `Gagal simpan nilai ke Supabase: ${error.message}`);
      return;
    }

    if (data) {
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
            g.student_id === params.student_id &&
            g.subject_id === params.subject_id &&
            g.academic_year === settings.tahun_pelajaran &&
            g.semester === settings.semester
        );
        if (idx >= 0) {
          const clone = [...prev];
          clone[idx] = normalized;
          return clone;
        }
        return [...prev, normalized];
      });
    }
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

    for (const st of params.newStudents) {
      const { data: upserted, error } = await client
        .from('students')
        .upsert(
          {
            nis: st.nis,
            nisn: st.nisn,
            full_name: st.full_name,
            birth_place: st.birth_place,
            birth_date: st.birth_date || null,
            gender: st.gender,
            parent_name: st.parent_name,
            address: st.address,
            class_id: params.targetClassId,
            status: st.status,
          },
          { onConflict: 'nis' }
        )
        .select('id, nis')
        .single();
      if (!error && upserted) {
        nisToStudentId.set(upserted.nis, upserted.id);
        importedStudents++;
      }
    }

    const gradePayloads = params.newGrades
      .map((g) => {
        const stId = nisToStudentId.get(g.studentNis);
        const subj = subjects.find((s) => s.id === g.subjectId);
        if (!stId || !subj) return null;
        const finalScore = calculateFinalScore(
          g.formatif,
          g.pts,
          g.pas,
          g.praktik,
          settings
        );
        const pred = getPredicate(finalScore, subj.kkm);
        return {
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
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (gradePayloads.length > 0) {
      const { error } = await client.from('grades').upsert(gradePayloads, {
        onConflict: 'student_id,subject_id,academic_year,semester',
      });
      if (!error) importedGrades = gradePayloads.length;
    }

    const nonAcadPayloads = params.attendanceUpdates
      .map((att) => {
        const stId = nisToStudentId.get(att.studentNis);
        if (!stId) return null;
        return {
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
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);

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
        isSupabaseConfigured,
        supabaseUrl: supabaseCfg.url,
        supabaseAnonKey: supabaseCfg.anonKey,
        configSource: supabaseCfg.source,
        userProfile,
        supabaseProfiles,
        authLoading,
        dataLoading,
        toasts,
        pushToast,
        dismissToast,
        signIn,
        adminCreateUserAccount,
        signOut,
        updateSupabaseProfileRole,
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
