import type {
  ActiveTab,
  MadrasahClass,
  Student,
  Subject,
  UserProfile,
  UserRole,
} from '../types';

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin / Operator',
  wali_kelas: 'Wali Kelas',
  guru: 'Guru Mapel',
  orang_tua: 'Orang Tua / Wali',
};

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin:
    'Akses penuh ke seluruh kelas, data master, import Excel, leger nilai, cetak raport, pengaturan madrasah, dan manajemen akun.',
  wali_kelas:
    'Mengelola data santri, seluruh nilai, sikap, absensi, catatan wali kelas, import Excel, dan cetak raport pada kelas binaannya.',
  guru:
    'Menginput dan memperbarui nilai akademik/praktik khusus pada mata pelajaran yang diampu.',
  orang_tua:
    'Melihat ringkasan capaian belajar, kehadiran, catatan wali kelas, dan pratinjau raport resmi putra/putrinya (hanya lihat, tanpa cetak atau unduh PDF).',
};

export const ROLE_ALLOWED_TABS: Record<UserRole, ActiveTab[]> = {
  admin: ['dashboard', 'leger', 'master', 'import-export', 'raport', 'settings'],
  wali_kelas: ['dashboard', 'leger', 'master', 'import-export', 'raport', 'settings'],
  guru: ['dashboard', 'leger', 'raport', 'settings'],
  orang_tua: ['dashboard', 'raport', 'settings'],
};

export function getAllowedTabs(role?: UserRole): ActiveTab[] {
  if (!role) return [];
  return ROLE_ALLOWED_TABS[role] || ['dashboard'];
}

export function getWaliClassIds(
  user: UserProfile | null,
  classes: MadrasahClass[]
): string[] {
  if (!user || user.role !== 'wali_kelas') return [];
  const matched = new Set<string>();
  if (user.assigned_class_id) {
    matched.add(user.assigned_class_id);
  }
  const normalizedName = user.full_name.trim().toLowerCase();
  classes.forEach((c) => {
    if (
      c.wali_kelas_id === user.id ||
      (normalizedName && c.wali_kelas_name.trim().toLowerCase() === normalizedName)
    ) {
      matched.add(c.id);
    }
  });
  return Array.from(matched);
}

export function canEditClass(
  user: UserProfile | null,
  classId: string,
  classes: MadrasahClass[]
): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'wali_kelas') {
    const allowed = getWaliClassIds(user, classes);
    return allowed.length === 0 ? true : allowed.includes(classId);
  }
  if (user.role === 'guru') return true;
  return false;
}

export function canEditSubject(
  user: UserProfile | null,
  subject: Subject
): boolean {
  if (!user) return false;
  if (user.role === 'admin' || user.role === 'wali_kelas') return true;
  if (user.role === 'guru') {
    if (user.assigned_subject_ids && user.assigned_subject_ids.length > 0) {
      return user.assigned_subject_ids.includes(subject.id);
    }
    const normalizedUser = user.full_name.trim().toLowerCase();
    const normalizedTeacher = (subject.teacher_name || '').trim().toLowerCase();
    return Boolean(normalizedUser && normalizedTeacher && normalizedTeacher === normalizedUser);
  }
  return false;
}

export function canEditNonAcademic(
  user: UserProfile | null,
  classId: string,
  classes: MadrasahClass[]
): boolean {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (user.role === 'wali_kelas') return canEditClass(user, classId, classes);
  return false;
}

export function resolveParentStudent(
  user: UserProfile | null,
  students: Student[]
): Student | undefined {
  if (!user || user.role !== 'orang_tua') return undefined;
  return students.find(
    (s) =>
      (user.linked_student_id && s.id === user.linked_student_id) ||
      (user.linked_student_nis &&
        s.nis.trim().toLowerCase() === user.linked_student_nis.trim().toLowerCase())
  );
}
