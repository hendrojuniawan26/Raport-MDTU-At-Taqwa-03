import type {
  GradeRecord,
  MadrasahSettings,
  NonAcademicRecord,
  Student,
  StudentLegerSummary,
  Subject,
} from '../types';

export interface PredicateInfo {
  letter: 'A+' | 'A' | 'B' | 'C' | 'D' | '-';
  arabicTerm: string;
  label: string;
  passedKkm: boolean;
}

/**
 * Menghitung Nilai Akhir berdasarkan bobot yang dikonfigurasi di Pengaturan Madrasah.
 * Jika nilai diambil langsung dari Excel/CSV (formatif=pts=pas=praktik), hasilnya tetap identik.
 */
export function calculateFinalScore(
  formatif: number,
  pts: number,
  pas: number,
  praktik: number,
  settings: Pick<
    MadrasahSettings,
    'bobot_formatif' | 'bobot_pts' | 'bobot_pas' | 'bobot_praktik'
  >
): number {
  const f = clampScore(formatif);
  const t = clampScore(pts);
  const a = clampScore(pas);
  const p = clampScore(praktik);

  const totalWeight =
    settings.bobot_formatif +
    settings.bobot_pts +
    settings.bobot_pas +
    settings.bobot_praktik;

  if (totalWeight <= 0) {
    return Math.round((f + t + a + p) / 4);
  }

  const weighted =
    (f * settings.bobot_formatif +
      t * settings.bobot_pts +
      a * settings.bobot_pas +
      p * settings.bobot_praktik) /
    totalWeight;

  return Math.round(weighted);
}

export function clampScore(val: number): number {
  if (Number.isNaN(val) || !Number.isFinite(val)) return 0;
  return Math.max(0, Math.min(100, Number(val)));
}

/**
 * Konversi nilai angka ke Predikat sesuai format Raport & CSV MDTU At-Taqwa '03 Cibeureum:
 * >= 90 : A+ (Sangat Terlampaui)
 * 80-89 : A  (Terlampaui)
 * 65-79 : B  (Terlampaui)
 * KKM-64: C  (Cukup Terlampaui)
 * < KKM : D / 0 (Tidak Terlampaui)
 */
export function getPredicate(score: number, kkm: number): PredicateInfo {
  if (score <= 0) {
    return {
      letter: '-',
      arabicTerm: 'Belum Dinilai',
      label: '- (Belum Dinilai)',
      passedKkm: false,
    };
  }

  const passedKkm = score >= kkm;

  if (score >= 90 && passedKkm) {
    return {
      letter: 'A+',
      arabicTerm: 'Sangat Terlampaui',
      label: 'A+ (Sangat Terlampaui)',
      passedKkm: true,
    };
  }
  if (score >= 80 && passedKkm) {
    return {
      letter: 'A',
      arabicTerm: 'Terlampaui',
      label: 'A (Terlampaui)',
      passedKkm: true,
    };
  }
  if (score >= Math.max(65, kkm) && passedKkm) {
    return {
      letter: 'B',
      arabicTerm: 'Terlampaui',
      label: 'B (Terlampaui)',
      passedKkm: true,
    };
  }
  if (passedKkm) {
    return {
      letter: 'C',
      arabicTerm: 'Cukup Terlampaui',
      label: 'C (Cukup Terlampaui)',
      passedKkm: true,
    };
  }
  return {
    letter: 'D',
    arabicTerm: 'Tidak Terlampaui',
    label: 'D (Tidak Terlampaui)',
    passedKkm: false,
  };
}

/**
 * Menghasilkan deskripsi capaian kompetensi otomatis persis seperti template PDF & CSV At-Taqwa '03:
 * - Kategori Pengetahuan: Sangat Terlampaui / Terlampaui / Cukup Terlampaui / Tidak Terlampaui
 * - Kategori Praktik:
 *   - Hafalan Juz 30: Sangat Hafal / Hafal / Kurang Hafal
 *   - Khot Imla: Sangat Rapi / Rapi / Kurang Rapi
 *   - Nuroniyah / Qiroatul Quran / Praktik Ibadah: Sangat Lancar / Lancar / Kurang Lancar / Tidak Lancar
 */
export function generateCompetencyDescription(
  subjectName: string,
  score: number,
  kkm: number,
  category: 'Pengetahuan' | 'Praktik' = 'Pengetahuan'
): string {
  if (score <= 0) return '-';

  const lower = subjectName.toLowerCase();

  if (category === 'Praktik') {
    if (lower.includes('hafalan') || lower.includes('juz')) {
      if (score >= 90) return 'Sangat Hafal';
      if (score >= 75) return 'Hafal';
      if (score >= kkm) return 'Kurang Hafal';
      return 'Belum Hafal';
    }
    if (lower.includes('khot') || lower.includes('imla')) {
      if (score >= 90) return 'Sangat Rapi';
      if (score >= 70) return 'Rapi';
      if (score >= kkm) return 'Kurang Rapi';
      return 'Belum Rapi';
    }
    // Nuroniyah, Qiroatul Quran, Praktek Ibadah
    if (score >= 90) return 'Sangat Lancar';
    if (score >= 70) return 'Lancar';
    if (score >= kkm) return 'Kurang Lancar';
    return 'Tidak Lancar';
  }

  const pred = getPredicate(score, kkm);
  return pred.arabicTerm;
}

export function createDefaultNonAcademic(
  studentId: string,
  classId: string,
  academicYear: string,
  semester: 'Ganjil' | 'Genap'
): NonAcademicRecord {
  return {
    id: `na-${studentId}-${academicYear}-${semester}`,
    student_id: studentId,
    class_id: classId,
    academic_year: academicYear,
    semester,
    sikap_spiritual_angka: 82,
    sikap_spiritual: 'Berkembang Sesuai Harapan',
    akhlak_catatan:
      'Siswa memiliki sikap yang berkembang sesuai harapan dalam nilai religious meliputi beriman, bertaqwa, bersih, toleransi, dan cinta lingkungan',
    sikap_sosial_angka: 82,
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
    keputusan_naik:
      semester === 'Genap'
        ? 'Naik ke Kelas Berikutnya'
        : 'Lanjut ke Semester Genap',
  };
}

/**
 * Menghitung ringkasan leger kelas lengkap beserta Total Nilai, Rata-rata, Peringkat (Ranking),
 * dan indikator ketuntasan KKM secara real-time.
 */
export function buildClassLegerSummaries(
  students: Student[],
  subjects: Subject[],
  grades: GradeRecord[],
  nonAcademics: NonAcademicRecord[],
  settings: MadrasahSettings
): StudentLegerSummary[] {
  const sortedSubjects = [...subjects].sort((a, b) => a.sort_order - b.sort_order);

  const rawSummaries: StudentLegerSummary[] = students.map((student) => {
    const gradesBySubject: Record<string, GradeRecord> = {};
    let totalScore = 0;
    let belowKkmCount = 0;
    let completedSubjectsCount = 0;

    for (const subject of sortedSubjects) {
      const existing = grades.find(
        (g) =>
          g.student_id === student.id &&
          g.subject_id === subject.id &&
          g.academic_year === settings.tahun_pelajaran &&
          g.semester === settings.semester
      );

      if (existing) {
        const finalScore = calculateFinalScore(
          existing.formatif,
          existing.pts,
          existing.pas,
          existing.praktik,
          settings
        );
        const pred = getPredicate(finalScore, subject.kkm);
        const computed: GradeRecord = {
          ...existing,
          final_score: finalScore,
          predicate: existing.predicate || pred.letter,
          description:
            existing.description ||
            generateCompetencyDescription(
              subject.name,
              finalScore,
              subject.kkm,
              subject.category
            ),
        };
        gradesBySubject[subject.id] = computed;
        if (finalScore > 0) {
          totalScore += finalScore;
          completedSubjectsCount += 1;
          if (finalScore < subject.kkm) {
            belowKkmCount += 1;
          }
        }
      } else {
        const emptyRecord: GradeRecord = {
          id: `temp-${student.id}-${subject.id}`,
          student_id: student.id,
          subject_id: subject.id,
          class_id: student.class_id,
          academic_year: settings.tahun_pelajaran,
          semester: settings.semester,
          formatif: 0,
          pts: 0,
          pas: 0,
          praktik: 0,
          final_score: 0,
          predicate: '-',
          description: '-',
        };
        gradesBySubject[subject.id] = emptyRecord;
      }
    }

    const divisor = completedSubjectsCount || sortedSubjects.length || 1;
    const averageScore =
      completedSubjectsCount > 0
        ? Number((totalScore / divisor).toFixed(1))
        : 0;

    const existingNonAcad =
      nonAcademics.find(
        (n) =>
          n.student_id === student.id &&
          n.academic_year === settings.tahun_pelajaran &&
          n.semester === settings.semester
      ) ||
      createDefaultNonAcademic(
        student.id,
        student.class_id,
        settings.tahun_pelajaran,
        settings.semester
      );

    return {
      student,
      gradesBySubject,
      nonAcademic: existingNonAcad,
      totalScore,
      averageScore,
      rank: 0,
      belowKkmCount,
      completedSubjectsCount,
    };
  });

  const rankedOrder = [...rawSummaries].sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return a.student.full_name.localeCompare(b.student.full_name, 'id');
  });

  const rankByStudentId = new Map<string, number>();
  let prevScore = -1;
  let prevRank = 0;

  rankedOrder.forEach((item, idx) => {
    if (item.totalScore === prevScore) {
      rankByStudentId.set(item.student.id, prevRank);
    } else {
      const currentRank = idx + 1;
      rankByStudentId.set(item.student.id, currentRank);
      prevScore = item.totalScore;
      prevRank = currentRank;
    }
  });

  return rawSummaries.map((item) => ({
    ...item,
    rank: rankByStudentId.get(item.student.id) || 1,
  }));
}
