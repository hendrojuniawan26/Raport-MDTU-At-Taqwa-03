import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  GraduationCap,
  Users,
} from 'lucide-react';
import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { buildClassLegerSummaries } from '../lib/grading';
import { canEditSubject, getWaliClassIds, ROLE_LABELS } from '../lib/rbac';
import type { ActiveTab } from '../types';
import { ParentPortalView } from './ParentPortalView';

interface DashboardViewProps {
  onNavigate: (tab: ActiveTab) => void;
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const {
    userProfile,
    settings,
    classes,
    subjects,
    students,
    grades,
    nonAcademics,
    setSelectedClassId,
  } = useApp();

  const isAdmin = userProfile?.role === 'admin';
  const isWali = userProfile?.role === 'wali_kelas';
  const isGuru = userProfile?.role === 'guru';

  const waliClassIds = useMemo(
    () => getWaliClassIds(userProfile, classes),
    [userProfile, classes]
  );

  const visibleClasses = useMemo(() => {
    if (isWali && waliClassIds.length > 0) {
      return classes.filter((c) => waliClassIds.includes(c.id));
    }
    return classes;
  }, [classes, isWali, waliClassIds]);

  const sortedSubjects = useMemo(
    () => [...subjects].sort((a, b) => a.sort_order - b.sort_order),
    [subjects]
  );

  const activeStudents = useMemo(
    () => students.filter((s) => s.status === 'Aktif'),
    [students]
  );

  // Hitung metrik per kelas
  const classMetrics = useMemo(() => {
    return visibleClasses.map((cls) => {
      const clsStudents = activeStudents.filter((s) => s.class_id === cls.id);
      const summaries = buildClassLegerSummaries(
        clsStudents,
        sortedSubjects,
        grades,
        nonAcademics,
        settings
      );

      const studentCount = clsStudents.length;
      const avgClass =
        studentCount > 0
          ? Number(
              (
                summaries.reduce((acc, s) => acc + s.averageScore, 0) /
                studentCount
              ).toFixed(1)
            )
          : 0;

      const totalExpectedEntries = studentCount * sortedSubjects.length;
      const completedEntries = summaries.reduce(
        (acc, s) => acc + s.completedSubjectsCount,
        0
      );
      const completionPct =
        totalExpectedEntries > 0
          ? Math.round((completedEntries / totalExpectedEntries) * 100)
          : 0;

      const belowKkmStudents = summaries.filter(
        (s) => s.belowKkmCount > 0 && s.completedSubjectsCount > 0
      ).length;

      return {
        cls,
        studentCount,
        avgClass,
        completionPct,
        belowKkmStudents,
      };
    });
  }, [visibleClasses, activeStudents, sortedSubjects, grades, nonAcademics, settings]);

  // Rata-rata per Mapel seluruh santri aktif (Guru hanya melihat mapel yang diampu jika tersedia)
  const subjectStats = useMemo(() => {
    const baseSubjects = isGuru
      ? sortedSubjects.filter((s) => canEditSubject(userProfile, s))
      : sortedSubjects;
    const targetSubjects = baseSubjects.length > 0 ? baseSubjects : sortedSubjects;

    return targetSubjects.map((subj) => {
      const relevantGrades = grades.filter(
        (g) =>
          g.subject_id === subj.id &&
          g.academic_year === settings.tahun_pelajaran &&
          g.semester === settings.semester &&
          g.final_score > 0
      );
      const avg =
        relevantGrades.length > 0
          ? Number(
              (
                relevantGrades.reduce((acc, g) => acc + g.final_score, 0) /
                relevantGrades.length
              ).toFixed(1)
            )
          : 0;
      const belowCount = relevantGrades.filter(
        (g) => g.final_score < subj.kkm
      ).length;
      return {
        subj,
        avg,
        gradedCount: relevantGrades.length,
        belowCount,
      };
    });
  }, [sortedSubjects, grades, settings, isGuru, userProfile]);

  const overallAverage = useMemo(() => {
    const valid = subjectStats.filter((s) => s.avg > 0);
    if (valid.length === 0) return 0;
    return Number(
      (valid.reduce((acc, s) => acc + s.avg, 0) / valid.length).toFixed(1)
    );
  }, [subjectStats]);

  const overallCompletion = useMemo(() => {
    const totalExpected = activeStudents.length * sortedSubjects.length;
    if (totalExpected === 0) return 0;
    const filled = grades.filter(
      (g) =>
        g.academic_year === settings.tahun_pelajaran &&
        g.semester === settings.semester &&
        g.final_score > 0
    ).length;
    return Math.min(100, Math.round((filled / totalExpected) * 100));
  }, [activeStudents.length, sortedSubjects.length, grades, settings]);

  const totalRemedialAlerts = useMemo(
    () => subjectStats.reduce((acc, s) => acc + s.belowCount, 0),
    [subjectStats]
  );

  if (userProfile?.role === 'orang_tua') {
    return <ParentPortalView onNavigate={onNavigate} />;
  }

  return (
    <div className="space-y-6">
      {/* Header Kontekstual */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-medium text-emerald-800 tracking-wide">
            {settings.yayasan}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Ringkasan Akademik {settings.nama_madrasah}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>
              Masuk sebagai {userProfile ? ROLE_LABELS[userProfile.role] : '-'}
            </span>
            <span aria-hidden="true">·</span>
            <span>Semester {settings.semester}</span>
            <span aria-hidden="true">·</span>
            <span>Tahun Pelajaran {settings.tahun_pelajaran}</span>
            <span aria-hidden="true">·</span>
            <span>Kepala Madrasah: {settings.kepala_madrasah}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {(isAdmin || isWali) && (
            <button
              type="button"
              onClick={() => onNavigate('import-export')}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              Import Excel
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate('leger')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 transition-colors whitespace-nowrap shrink-0"
          >
            {isGuru ? 'Input Nilai Mapel' : 'Input Leger Nilai'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Santri Aktif</span>
            <Users className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {activeStudents.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Tersebar di {classes.length} rombongan belajar
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Mata Pelajaran</span>
            <BookOpen className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {sortedSubjects.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Kurikulum MDTU & Praktik Ibadah
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Rata-rata Madrasah</span>
            <GraduationCap className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {overallAverage || '-'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {totalRemedialAlerts === 0
              ? 'Seluruh nilai tuntas KKM'
              : `${totalRemedialAlerts} entri nilai di bawah KKM`}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Kelengkapan Nilai</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {overallCompletion}%
          </p>
          <div className="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-700 transition-all duration-300"
              style={{ width: `${overallCompletion}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main 2-Column Content: Rekap Kelas + Statistik per Mapel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Tabel Rekap Kelas */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Rekapitulasi per Kelas
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Klik kelas untuk membuka Leger Nilai atau Pratinjau Raport
              </p>
            </div>
            {(isAdmin || isWali) && (
              <button
                type="button"
                onClick={() => onNavigate('master')}
                className="text-xs font-medium text-emerald-800 hover:underline whitespace-nowrap shrink-0"
              >
                {isAdmin ? 'Kelola Kelas' : 'Kelola Santri'}
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3 font-medium">Kelas & Wali Kelas</th>
                  <th className="px-4 py-3 font-medium text-right">Santri</th>
                  <th className="px-4 py-3 font-medium text-right">Rata-rata</th>
                  <th className="px-4 py-3 font-medium text-right">Input</th>
                  <th className="px-5 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classMetrics.map(
                  ({
                    cls,
                    studentCount,
                    avgClass,
                    completionPct,
                    belowKkmStudents,
                  }) => (
                    <tr
                      key={cls.id}
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-slate-900">
                          {cls.name}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {cls.wali_kelas_name}
                          {belowKkmStudents > 0 && (
                            <span className="text-amber-700">
                              {' '}
                              · {belowKkmStudents} santri perlu pembinaan KKM
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-700">
                        {studentCount}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums font-medium text-slate-900">
                        {avgClass > 0 ? avgClass : '-'}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono tabular-nums text-slate-700">
                        {completionPct}%
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="inline-flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedClassId(cls.id);
                              onNavigate('leger');
                            }}
                            className="text-xs font-medium text-emerald-800 hover:underline whitespace-nowrap"
                          >
                            Leger
                          </button>
                          <span className="text-slate-300" aria-hidden="true">
                            /
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedClassId(cls.id);
                              onNavigate('raport');
                            }}
                            className="text-xs font-medium text-slate-700 hover:text-slate-900 hover:underline whitespace-nowrap"
                          >
                            Raport
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rata-rata Nilai per Mata Pelajaran */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Capaian per Mata Pelajaran
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Perbandingan rata-rata nilai akhir terhadap KKM
              </p>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => onNavigate('master')}
                className="text-xs font-medium text-emerald-800 hover:underline whitespace-nowrap shrink-0"
              >
                Atur KKM
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {subjectStats.map(({ subj, avg, belowCount }) => {
              const meetsKkm = avg === 0 || avg >= subj.kkm;
              return (
                <div key={subj.id} className="px-5 py-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="min-w-0 pr-2">
                      <span className="font-medium text-slate-900">
                        {subj.name}
                      </span>
                      <span className="ml-2 text-xs text-slate-400 font-mono">
                        KKM {subj.kkm}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 font-mono tabular-nums text-xs">
                      {belowCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-red-700">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {belowCount} &lt; KKM
                        </span>
                      )}
                      <span
                        className={`font-semibold text-sm ${
                          !meetsKkm ? 'text-red-700' : 'text-slate-900'
                        }`}
                      >
                        {avg > 0 ? avg : '-'}
                      </span>
                    </div>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        !meetsKkm ? 'bg-amber-600' : 'bg-emerald-700'
                      }`}
                      style={{ width: `${Math.min(100, avg)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
