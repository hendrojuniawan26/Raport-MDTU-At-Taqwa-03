import {
  Award,
  BookOpen,
  CalendarCheck2,
  Eye,
  GraduationCap,
  MessageSquareText,
  RefreshCw,
} from 'lucide-react';
import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { buildClassLegerSummaries, getPredicate } from '../lib/grading';
import { resolveParentStudent } from '../lib/rbac';
import type { ActiveTab } from '../types';

interface ParentPortalViewProps {
  onNavigate: (tab: ActiveTab) => void;
}

export function ParentPortalView({ onNavigate }: ParentPortalViewProps) {
  const {
    userProfile,
    settings,
    classes,
    subjects,
    students,
    grades,
    nonAcademics,
    dataLoading,
    refreshFromSupabase,
    parentClassStats,
  } = useApp();

  const child = useMemo(
    () => resolveParentStudent(userProfile, students),
    [userProfile, students]
  );

  const childClass = useMemo(
    () => classes.find((c) => c.id === child?.class_id),
    [classes, child]
  );

  const sortedSubjects = useMemo(
    () => [...subjects].sort((a, b) => a.sort_order - b.sort_order),
    [subjects]
  );

  const classSummaries = useMemo(() => {
    if (!childClass) return [];
    const clsStudents = students.filter(
      (s) => s.class_id === childClass.id && s.status === 'Aktif'
    );
    return buildClassLegerSummaries(
      clsStudents,
      sortedSubjects,
      grades,
      nonAcademics,
      settings
    );
  }, [childClass, students, sortedSubjects, grades, nonAcademics, settings]);

  const childSummary = useMemo(
    () => classSummaries.find((s) => s.student.id === child?.id),
    [classSummaries, child]
  );

  if (dataLoading && (!child || !childSummary)) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-3">
        <RefreshCw className="w-7 h-7 text-emerald-700 mx-auto animate-spin" />
        <h2 className="text-base font-semibold text-slate-900">
          Memuat Data Capaian Santri...
        </h2>
        <p className="text-xs text-slate-500">
          Mengambil nilai rapor dan kehadiran terbaru dari server Supabase.
        </p>
      </div>
    );
  }

  if (!child || !childSummary) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-10 text-center space-y-2">
        <GraduationCap className="w-8 h-8 text-emerald-700 mx-auto" />
        <h2 className="text-lg font-semibold text-slate-900">
          Data Santri Belum Tertaut
        </h2>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Akun Orang Tua ({userProfile?.email}) belum terhubung ke data NIS santri aktif. Hubungi Admin atau Wali Kelas MDTU At-Taqwa &apos;03 untuk menautkan NIS putra/putri Anda.
        </p>
      </div>
    );
  }

  const effectiveRank = parentClassStats?.rank ?? childSummary.rank;
  const effectiveTotalStudents =
    parentClassStats?.totalStudents ?? classSummaries.length;

  const pengetahuanSubjects = sortedSubjects.filter(
    (s) => s.category === 'Pengetahuan'
  );
  const praktikSubjects = sortedSubjects.filter(
    (s) => s.category === 'Praktik'
  );
  const totalAbsent =
    childSummary.nonAcademic.sakit +
    childSummary.nonAcademic.izin +
    childSummary.nonAcademic.alpa;

  return (
    <div className="space-y-6">
      {/* Header Orang Tua */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <p className="text-xs font-medium text-emerald-800">
            Portal Wali Santri · {settings.nama_madrasah}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            Capaian Belajar: {child.full_name}
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span className="font-mono tabular-nums">NIS {child.nis}</span>
            <span aria-hidden="true">·</span>
            <span>Kelas {childClass?.name || '-'}</span>
            <span aria-hidden="true">·</span>
            <span>Wali Kelas: {childClass?.wali_kelas_name || '-'}</span>
            <span aria-hidden="true">·</span>
            <span>
              Semester {settings.semester} {settings.tahun_pelajaran}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={dataLoading}
            onClick={refreshFromSupabase}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`w-4 h-4 text-emerald-700 ${dataLoading ? 'animate-spin' : ''}`}
            />
            Muat Ulang Nilai
          </button>
          <button
            type="button"
            onClick={() => onNavigate('raport')}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 transition-colors whitespace-nowrap shrink-0"
          >
            <Eye className="w-4 h-4" />
            Lihat Raport Resmi
          </button>
        </div>
      </div>

      {/* 4-Column KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Rata-Rata Nilai</span>
            <GraduationCap className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {childSummary.averageScore.toFixed(1)}
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            Total Skor: {childSummary.totalScore}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Peringkat Kelas</span>
            <Award className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            #{effectiveRank}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Dari {effectiveTotalStudents} santri aktif
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Ketuntasan KKM</span>
            <BookOpen className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {childSummary.completedSubjectsCount}/{sortedSubjects.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {childSummary.belowKkmCount === 0
              ? 'Semua nilai tuntas KKM'
              : `${childSummary.belowKkmCount} mapel di bawah KKM`}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Ketidakhadiran</span>
            <CalendarCheck2 className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="mt-3 text-2xl font-bold text-slate-900 font-mono tabular-nums">
            {totalAbsent} hari
          </p>
          <p className="mt-1 text-xs text-slate-500 font-mono tabular-nums">
            S:{childSummary.nonAcademic.sakit} · I:{childSummary.nonAcademic.izin}{' '}
            · A:{childSummary.nonAcademic.alpa}
          </p>
        </div>
      </div>

      {/* Tabel Nilai Pengetahuan & Praktik */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200">
            <h2 className="text-base font-semibold text-slate-900">
              Rincian Nilai Mata Pelajaran
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Nilai akhir berdasarkan penilaian Pengetahuan &amp; Praktik semester berjalan
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">Mata Pelajaran</th>
                  <th className="px-3 py-3 font-medium text-center">Kategori</th>
                  <th className="px-3 py-3 font-medium text-center">KKM</th>
                  <th className="px-3 py-3 font-medium text-center">Nilai</th>
                  <th className="px-3 py-3 font-medium text-center">Predikat</th>
                  <th className="px-4 py-3 font-medium">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...pengetahuanSubjects, ...praktikSubjects].map((subj) => {
                  const grade = childSummary.gradesBySubject[subj.id];
                  const score = grade?.final_score ?? 0;
                  const hasScore = score > 0;
                  const pred = getPredicate(score, subj.kkm);
                  const isBelow = hasScore && score < subj.kkm;

                  return (
                    <tr key={subj.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900">
                          {subj.name}
                        </div>
                        <div className="text-xs text-slate-500">
                          Guru: {subj.teacher_name || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center text-xs text-slate-600">
                        {subj.category}
                      </td>
                      <td className="px-3 py-3 text-center font-mono tabular-nums text-slate-600">
                        {subj.kkm}
                      </td>
                      <td
                        className={`px-3 py-3 text-center font-mono tabular-nums font-bold ${
                          isBelow ? 'text-red-700' : 'text-emerald-900'
                        }`}
                      >
                        {hasScore ? score : '-'}
                      </td>
                      <td className="px-3 py-3 text-center font-semibold text-slate-800">
                        {hasScore ? grade?.predicate || pred.letter : '-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {hasScore
                          ? grade?.description || pred.arabicTerm
                          : 'Belum dinilai'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sikap & Pesan Wali Kelas */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h2 className="text-base font-semibold text-slate-900">
              Perkembangan Sikap
            </h2>
            <div className="pt-1 space-y-3 text-xs">
              <div>
                <div className="font-semibold text-slate-800">
                  Sikap Spiritual · {childSummary.nonAcademic.sikap_spiritual}
                </div>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  {childSummary.nonAcademic.akhlak_catatan}
                </p>
              </div>
              <div className="pt-3 border-t border-slate-100">
                <div className="font-semibold text-slate-800">
                  Sikap Sosial · {childSummary.nonAcademic.sikap_sosial}
                </div>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  {childSummary.nonAcademic.sosial_catatan}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <MessageSquareText className="w-4 h-4 text-emerald-700" />
              Pesan Wali Kelas
            </div>
            <p className="text-xs text-slate-700 leading-relaxed">
              {childSummary.nonAcademic.catatan_wali || '-'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
