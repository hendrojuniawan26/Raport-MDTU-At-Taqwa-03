export type UserRole = 'admin' | 'wali_kelas' | 'guru' | 'orang_tua';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  nip_nuptk: string;
  assigned_class_id?: string | null;
  assigned_subject_ids?: string[];
  linked_student_id?: string | null;
  linked_student_nis?: string;
}

export interface MadrasahSettings {
  id: string;
  yayasan: string;
  nama_madrasah: string;
  sub_madrasah: string;
  nsm: string;
  alamat: string;
  kecamatan: string;
  kabupaten: string;
  provinsi: string;
  kode_pos: string;
  kepala_madrasah: string;
  nip_kepala: string;
  tempat_cetak: string;
  tanggal_raport: string;
  tahun_pelajaran: string;
  semester: 'Ganjil' | 'Genap';
  bobot_formatif: number;
  bobot_pts: number;
  bobot_pas: number;
  bobot_praktik: number;
  ukuran_kertas: 'F4' | 'A4';
}

export interface MadrasahClass {
  id: string;
  name: string;
  level: number;
  academic_year: string;
  wali_kelas_id?: string | null;
  wali_kelas_name: string;
  wali_kelas_nip: string;
}

export interface Subject {
  id: string;
  code: string;
  name: string;
  arabic_name: string;
  teacher_name: string;
  category: 'Pengetahuan' | 'Praktik';
  kkm: number;
  sort_order: number;
}

export interface Student {
  id: string;
  nis: string;
  nisn: string;
  full_name: string;
  birth_place: string;
  birth_date: string;
  gender: 'L' | 'P';
  parent_name: string;
  address: string;
  class_id: string;
  status: 'Aktif' | 'Lulus' | 'Pindah';
}

export interface GradeRecord {
  id: string;
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

export interface NonAcademicRecord {
  id: string;
  student_id: string;
  class_id: string;
  academic_year: string;
  semester: 'Ganjil' | 'Genap';
  sikap_spiritual_angka: number;
  sikap_spiritual: string;
  akhlak_catatan: string;
  sikap_sosial_angka: number;
  sikap_sosial: string;
  sosial_catatan: string;
  ekskul_1_nama: string;
  ekskul_1_nilai: string;
  ekskul_2_nama: string;
  ekskul_2_nilai: string;
  sakit: number;
  izin: number;
  alpa: number;
  catatan_wali: string;
  keputusan_naik: string;
}

export interface StudentLegerSummary {
  student: Student;
  gradesBySubject: Record<string, GradeRecord>;
  nonAcademic: NonAcademicRecord;
  totalScore: number;
  averageScore: number;
  rank: number;
  belowKkmCount: number;
  completedSubjectsCount: number;
}

export type ActiveTab =
  | 'dashboard'
  | 'leger'
  | 'master'
  | 'import-export'
  | 'raport'
  | 'settings';
