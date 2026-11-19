import type {
  GradeRecord,
  MadrasahClass,
  MadrasahSettings,
  NonAcademicRecord,
  Student,
  Subject,
} from '../types';
import {
  calculateFinalScore,
  generateCompetencyDescription,
  getPredicate,
} from '../lib/grading';

export const INITIAL_SETTINGS: MadrasahSettings = {
  id: 'default-settings',
  yayasan: 'LEMBAGA PENGEMBANGAN PENDIDIKAN AGAMA ISLAM (LP2AI)',
  nama_madrasah: 'MADRASAH DINIYAH TAKMILIYAH “AT-TAQWA ‘03”',
  sub_madrasah: 'AHLUS SUNNAH WAL JAMA’AH (ASWAJA)',
  nsm: '311232770003',
  alamat: 'Jl. Terusan Mukodar 235 RT.05 RW.03 Kel. Cibeureum',
  kecamatan: 'Kec. Cimahi Selatan',
  kabupaten: 'Kota Cimahi',
  provinsi: 'Jawa Barat',
  kode_pos: '40535',
  kepala_madrasah: 'Kiagus Akbar Saman, M.Pd',
  nip_kepala: 'NUPTK: 7538759660130152',
  tempat_cetak: 'Cimahi',
  tanggal_raport: '22 Desember 2025',
  tahun_pelajaran: '2025-2026',
  semester: 'Ganjil',
  bobot_formatif: 30,
  bobot_pts: 20,
  bobot_pas: 30,
  bobot_praktik: 20,
  ukuran_kertas: 'A4',
};

export const INITIAL_SUBJECTS: Subject[] = [
  // B. PENGETAHUAN (Urutan persis sesuai PDF Rapor_At-taqwa)
  {
    id: 'subj-aq',
    code: 'AQ',
    name: 'AL-QURAN/TAJWID',
    arabic_name: 'القرآن والتجويد',
    teacher_name: 'Osi Rosmawati',
    category: 'Pengetahuan',
    kkm: 62,
    sort_order: 1,
  },
  {
    id: 'subj-hd',
    code: 'HD',
    name: 'AL-HADITS',
    arabic_name: 'الحديث',
    teacher_name: 'Novizal Darwis, S.Ag',
    category: 'Pengetahuan',
    kkm: 62,
    sort_order: 2,
  },
  {
    id: 'subj-aqd',
    code: 'AQD',
    name: 'AQIDAH/TAUHID',
    arabic_name: 'العقيدة',
    teacher_name: "Yasir Jum'aturrohman",
    category: 'Pengetahuan',
    kkm: 62,
    sort_order: 3,
  },
  {
    id: 'subj-akh',
    code: 'AKH',
    name: 'AKHLAK',
    arabic_name: 'الأخلاق',
    teacher_name: 'Kuswati Endah W., S.Pd',
    category: 'Pengetahuan',
    kkm: 62,
    sort_order: 4,
  },
  {
    id: 'subj-fqh',
    code: 'FQH',
    name: 'FIQIH',
    arabic_name: 'الفقه',
    teacher_name: 'Hendro Kartika J., M.Hum',
    category: 'Pengetahuan',
    kkm: 62,
    sort_order: 5,
  },
  {
    id: 'subj-skh',
    code: 'SKH',
    name: 'TARIKH / SEJARAH ISLAM',
    arabic_name: 'تاريخ الإسلام',
    teacher_name: 'Osi Rosmawati',
    category: 'Pengetahuan',
    kkm: 62,
    sort_order: 6,
  },
  // C. PRAKTIK (Urutan persis sesuai PDF Halaman 2 & CSV)
  {
    id: 'subj-nur',
    code: 'NRN',
    name: "NURONIYAH/BACAAN AL-QUR'AN",
    arabic_name: 'النورانية',
    teacher_name: 'Osi Rosmawati',
    category: 'Praktik',
    kkm: 62,
    sort_order: 7,
  },
  {
    id: 'subj-juz',
    code: 'JUZ',
    name: 'HAFALAN JUZ 30',
    arabic_name: 'حفظ جزء عم',
    teacher_name: 'Osi Rosmawati',
    category: 'Praktik',
    kkm: 62,
    sort_order: 8,
  },
  {
    id: 'subj-kht',
    code: 'KHT',
    name: 'KHOT IMLA',
    arabic_name: 'الخط والإملاء',
    teacher_name: 'Hendro Kartika J., M.Hum',
    category: 'Praktik',
    kkm: 62,
    sort_order: 9,
  },
  {
    id: 'subj-prd',
    code: 'PRD',
    name: 'PRAKTEK IBADAH',
    arabic_name: 'العبادة العملية',
    teacher_name: 'Hendro Kartika J., M.Hum',
    category: 'Praktik',
    kkm: 62,
    sort_order: 10,
  },
];

export const INITIAL_CLASSES: MadrasahClass[] = [
  {
    id: 'cls-1',
    name: 'MDTU-1',
    level: 1,
    academic_year: '2025-2026',
    wali_kelas_name: 'Osi Rosmawati',
    wali_kelas_nip: '-',
  },
  {
    id: 'cls-2',
    name: 'MDTU-2',
    level: 2,
    academic_year: '2025-2026',
    wali_kelas_name: 'Hendro Kartika Juniawan, M.Hum',
    wali_kelas_nip: '-',
  },
  {
    id: 'cls-3',
    name: 'MDTU-3',
    level: 3,
    academic_year: '2025-2026',
    wali_kelas_name: 'Kuswati Endah W., S.Pd',
    wali_kelas_nip: '-',
  },
  {
    id: 'cls-4',
    name: 'MDTU-4',
    level: 4,
    academic_year: '2025-2026',
    wali_kelas_name: 'Novizal Darwis, S.Ag',
    wali_kelas_nip: '-',
  },
];

export const INITIAL_STUDENTS: Student[] = [
  {
    id: 'stu-201',
    nis: '0182-2526-03',
    nisn: '',
    full_name: 'NAFIS PUTRA MULYA',
    birth_place: 'Cimahi',
    birth_date: '2017-03-14',
    gender: 'L',
    parent_name: '-',
    address: 'Kel. Cibeureum, Cimahi Selatan',
    class_id: 'cls-2',
    status: 'Aktif',
  },
  {
    id: 'stu-202',
    nis: '0183-2526-03',
    nisn: '',
    full_name: 'Adwiyah Nuril Wahyudi',
    birth_place: 'Cimahi',
    birth_date: '2017-05-20',
    gender: 'P',
    parent_name: '-',
    address: 'Kel. Cibeureum, Cimahi Selatan',
    class_id: 'cls-2',
    status: 'Aktif',
  },
  {
    id: 'stu-203',
    nis: '0184-2526-03',
    nisn: '',
    full_name: 'Arjuna Sakhi Alghazali',
    birth_place: 'Cimahi',
    birth_date: '2017-08-11',
    gender: 'L',
    parent_name: '-',
    address: 'Kel. Cibeureum, Cimahi Selatan',
    class_id: 'cls-2',
    status: 'Aktif',
  },
  {
    id: 'stu-204',
    nis: '0185-2526-03',
    nisn: '',
    full_name: 'Elang Syafiq Assauqie Jauhari',
    birth_place: 'Cimahi',
    birth_date: '2017-02-05',
    gender: 'L',
    parent_name: '-',
    address: 'Kel. Cibeureum, Cimahi Selatan',
    class_id: 'cls-2',
    status: 'Aktif',
  },
  {
    id: 'stu-205',
    nis: '0186-2526-03',
    nisn: '',
    full_name: 'Maida Nafisah Rahmani',
    birth_place: 'Cimahi',
    birth_date: '2017-10-18',
    gender: 'P',
    parent_name: '-',
    address: 'Kel. Cibeureum, Cimahi Selatan',
    class_id: 'cls-2',
    status: 'Aktif',
  },
];

function createSeedGrades(): GradeRecord[] {
  // Urutan: AQ, HD, AQD, AKH, FQH, SKH, NUR, JUZ, KHT, PRD
  const scorePresets: Record<string, number[]> = {
    'stu-201': [63, 64, 76, 67, 69, 63, 70, 75, 60, 0], // Persis contoh PDF Nafis Putra Mulya
    'stu-202': [89, 84, 76, 82, 84, 97, 90, 90, 89, 0],
    'stu-203': [96, 79, 94, 88, 90, 97, 90, 90, 96, 0],
    'stu-204': [87, 92, 86, 94, 84, 97, 85, 85, 87, 0],
    'stu-205': [84, 89, 85, 83, 93, 97, 90, 90, 84, 0],
  };

  const result: GradeRecord[] = [];
  for (const stu of INITIAL_STUDENTS) {
    const baseScores = scorePresets[stu.id] || [75, 75, 75, 75, 75, 75, 75, 75, 75, 0];
    INITIAL_SUBJECTS.forEach((subj, idx) => {
      const score = baseScores[idx] ?? 0;
      const finalScore = calculateFinalScore(
        score,
        score,
        score,
        score,
        INITIAL_SETTINGS
      );
      const pred = getPredicate(finalScore, subj.kkm);
      result.push({
        id: `grd-${stu.id}-${subj.id}`,
        student_id: stu.id,
        subject_id: subj.id,
        class_id: stu.class_id,
        academic_year: INITIAL_SETTINGS.tahun_pelajaran,
        semester: INITIAL_SETTINGS.semester,
        formatif: score,
        pts: score,
        pas: score,
        praktik: score,
        final_score: finalScore,
        predicate: pred.letter,
        description: generateCompetencyDescription(
          subj.name,
          finalScore,
          subj.kkm,
          subj.category
        ),
      });
    });
  }
  return result;
}

export const INITIAL_GRADES: GradeRecord[] = createSeedGrades();

export const INITIAL_NON_ACADEMIC: NonAcademicRecord[] = [
  {
    id: 'na-stu-201',
    student_id: 'stu-201',
    class_id: 'cls-2',
    academic_year: '2025-2026',
    semester: 'Ganjil',
    sikap_spiritual_angka: 82,
    sikap_spiritual: 'Berkembang Sesuai Harapan',
    akhlak_catatan:
      'Siswa memiliki sikap yang berkembang sesuai harapan dalam nilai religious meliputi beriman, bertaqwa, bersih, toleransi, dan cinta lingkungan',
    sikap_sosial_angka: 80,
    sikap_sosial: 'Berkembang Sesuai Harapan',
    sosial_catatan:
      'Siswa memiliki sikap berkembang sesuai harapan dalam melakukan interaksi dengan teman dan lingkungannya',
    ekskul_1_nama: "Tahfidz Al-Qur'an",
    ekskul_1_nilai: 'B',
    ekskul_2_nama: 'Khot / Kaligrafi',
    ekskul_2_nilai: 'B',
    sakit: 0,
    izin: 0,
    alpa: 0,
    catatan_wali:
      'Ananda mengikuti pembelajaran dengan baik dan menunjukkan sikap yang sopan. Semoga terus meningkatkan semangat belajar.',
    keputusan_naik: 'Lanjut ke Semester Genap',
  },
];
