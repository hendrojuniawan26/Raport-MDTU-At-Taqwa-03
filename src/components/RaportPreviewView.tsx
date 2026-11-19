import { Download, Eye, FileDown, Lock, Printer } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { buildClassLegerSummaries } from '../lib/grading';
import { exportClassRaportPdf, exportSingleRaportPdf } from '../lib/pdfExport';
import { getWaliClassIds, resolveParentStudent } from '../lib/rbac';
import { RaportSheet } from './RaportSheet';

export function RaportPreviewView() {
  const {
    userProfile,
    settings,
    updateSettings,
    classes,
    subjects,
    students,
    grades,
    nonAcademics,
    selectedClassId,
    setSelectedClassId,
    selectedStudentId,
    setSelectedStudentId,
    parentClassStats,
  } = useApp();

  const [previewMode, setPreviewMode] = useState<'single' | 'batch'>('single');

  useEffect(() => {
    if (selectedStudentId) {
      setPreviewMode('single');
    }
  }, [selectedStudentId]);

  const isParent = userProfile?.role === 'orang_tua';
  const isWali = userProfile?.role === 'wali_kelas';

  const parentChild = useMemo(
    () => (isParent ? resolveParentStudent(userProfile, students) : undefined),
    [isParent, userProfile, students]
  );

  const waliClassIds = useMemo(
    () => getWaliClassIds(userProfile, classes),
    [userProfile, classes]
  );

  const accessibleClasses = useMemo(() => {
    if (isParent && parentChild) {
      return classes.filter((c) => c.id === parentChild.class_id);
    }
    if (isWali && waliClassIds.length > 0) {
      return classes.filter((c) => waliClassIds.includes(c.id));
    }
    return classes;
  }, [classes, isParent, parentChild, isWali, waliClassIds]);

  const sortedSubjects = useMemo(
    () => [...subjects].sort((a, b) => a.sort_order - b.sort_order),
    [subjects]
  );

  const selectedClass = useMemo(() => {
    if (isParent && parentChild) {
      return classes.find((c) => c.id === parentChild.class_id);
    }
    return (
      accessibleClasses.find((c) => c.id === selectedClassId) ||
      accessibleClasses[0] ||
      classes[0]
    );
  }, [isParent, parentChild, accessibleClasses, classes, selectedClassId]);

  const classStudents = useMemo(
    () =>
      students.filter(
        (s) => s.class_id === selectedClass?.id && s.status === 'Aktif'
      ),
    [students, selectedClass]
  );

  const summaries = useMemo(
    () =>
      buildClassLegerSummaries(
        classStudents,
        sortedSubjects,
        grades,
        nonAcademics,
        settings
      ),
    [classStudents, sortedSubjects, grades, nonAcademics, settings]
  );

  const activeSummary = useMemo(() => {
    if (isParent && parentChild) {
      return summaries.find((s) => s.student.id === parentChild.id);
    }
    return (
      summaries.find((s) => s.student.id === selectedStudentId) || summaries[0]
    );
  }, [isParent, parentChild, summaries, selectedStudentId]);

  const effectiveActiveSummary = useMemo(() => {
    if (!activeSummary) return undefined;
    if (isParent && parentClassStats) {
      return { ...activeSummary, rank: parentClassStats.rank };
    }
    return activeSummary;
  }, [activeSummary, isParent, parentClassStats]);

  const effectiveTotalStudentsInClass =
    isParent && parentClassStats
      ? parentClassStats.totalStudents
      : summaries.length;

  const handlePaperSizeChange = (ukuran: 'F4' | 'A4') => {
    updateSettings({ ...settings, ukuran_kertas: ukuran });
  };

  const pageSizeCss =
    settings.ukuran_kertas === 'F4' ? '215mm 330mm' : 'A4 portrait';

  return (
    <div className="space-y-6">
      <style>{`@media print { @page { size: ${pageSizeCss}; margin: 10mm 12mm; } }`}</style>
      {/* Toolbar Non-Print */}
      <div className="no-print space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-slate-200 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              {isParent
                ? `Raport Resmi: ${parentChild?.full_name || 'Ananda'}`
                : 'Cetak Raport & Unduh PDF'}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {isParent
                ? 'Pratinjau raport resmi putra/putri Anda (mode lihat saja — cetak dan unduh PDF hanya tersedia melalui pihak Madrasah).'
                : `Pratinjau dokumen raport siap cetak ukuran ${settings.ukuran_kertas} (Satuan atau 1 Kelas sekaligus).`}
            </p>
          </div>

          {!isParent ? (
            <div className="flex flex-wrap items-center gap-2.5">
              {activeSummary && (
                <button
                  type="button"
                  onClick={() =>
                    exportSingleRaportPdf(
                      activeSummary,
                      summaries.length,
                      sortedSubjects,
                      selectedClass,
                      settings
                    )
                  }
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap"
                >
                  <Download className="w-4 h-4 text-emerald-700" />
                  Unduh PDF Satuan
                </button>
              )}
              <button
                type="button"
                disabled={summaries.length === 0}
                onClick={() =>
                  exportClassRaportPdf(
                    summaries,
                    sortedSubjects,
                    selectedClass,
                    settings
                  )
                }
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
              >
                <FileDown className="w-4 h-4 text-emerald-700" />
                Unduh PDF 1 Kelas ({summaries.length})
              </button>
              <button
                type="button"
                disabled={!activeSummary}
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 disabled:opacity-50 whitespace-nowrap"
              >
                <Printer className="w-4 h-4" />
                Cetak Printer ({settings.ukuran_kertas})
              </button>
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded-lg whitespace-nowrap shrink-0">
              <Eye className="w-4 h-4 text-emerald-700" />
              Mode Pratinjau (Hanya Lihat)
            </div>
          )}
        </div>

        {/* Selector Controls */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          {!isParent ? (
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={selectedClass?.id || ''}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  setSelectedStudentId('');
                }}
                disabled={accessibleClasses.length <= 1}
                className="px-3 py-2 text-sm font-medium border border-slate-200 rounded-lg bg-white disabled:bg-slate-50"
              >
                {accessibleClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {previewMode === 'single' && (
                <select
                  value={activeSummary?.student.id || ''}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white min-w-[230px]"
                >
                  {summaries.length === 0 ? (
                    <option value="">Tidak ada santri</option>
                  ) : (
                    summaries.map((s) => (
                      <option key={s.student.id} value={s.student.id}>
                        {s.student.full_name} (Rank #{s.rank})
                      </option>
                    ))
                  )}
                </select>
              )}
            </div>
          ) : (
            <div className="text-xs text-slate-600">
              <span className="font-semibold text-slate-900">
                {parentChild?.full_name || 'Data Santri'}
              </span>
              {parentChild?.nis && (
                <span className="ml-2 font-mono text-slate-500">
                  · NIS {parentChild.nis}
                </span>
              )}
              {selectedClass && (
                <span className="ml-2 text-slate-500">
                  · Kelas {selectedClass.name}
                </span>
              )}
            </div>
          )}

          {!isParent ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPreviewMode('single')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    previewMode === 'single'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Pratinjau Satuan
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('batch')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    previewMode === 'batch'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Semua Santri Kelas ({summaries.length})
                </button>
              </div>

              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                {(['F4', 'A4'] as const).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => handlePaperSizeChange(sz)}
                    className={`px-2.5 py-1.5 text-xs font-mono font-medium rounded-md transition-colors ${
                      settings.ukuran_kertas === sz
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <Lock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span>Cetak &amp; unduh PDF dinonaktifkan untuk akun Orang Tua</span>
            </div>
          )}
        </div>
      </div>

      {/* Pesan bila Orang Tua mencoba mencetak langsung via browser (Ctrl+P) */}
      {isParent && (
        <div className="hidden print:block p-10 text-center border border-slate-300 rounded-xl">
          <p className="text-base font-semibold text-slate-900">
            Pencetakan Raport Tidak Diizinkan untuk Akun Orang Tua / Wali
          </p>
          <p className="text-sm text-slate-600 mt-2">
            Silakan hubungi Wali Kelas atau Admin {settings.nama_madrasah} untuk memperoleh salinan cetak/PDF resmi raport santri.
          </p>
        </div>
      )}

      {/* Area Dokumen Raport */}
      <div
        className={
          isParent ? 'no-print select-none' : 'print-only-container'
        }
      >
        {summaries.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-sm text-slate-500">
            Belum ada santri aktif pada kelas {selectedClass?.name}. Tambahkan data santri di menu Data Master atau Import Excel terlebih dahulu.
          </div>
        ) : previewMode === 'single' && effectiveActiveSummary ? (
          <RaportSheet
            summary={effectiveActiveSummary}
            totalStudentsInClass={effectiveTotalStudentsInClass}
            subjects={sortedSubjects}
            madrasahClass={selectedClass}
            settings={settings}
            isLast
          />
        ) : (
          summaries.map((sum, idx) => (
            <RaportSheet
              key={sum.student.id}
              summary={sum}
              totalStudentsInClass={summaries.length}
              subjects={sortedSubjects}
              madrasahClass={selectedClass}
              settings={settings}
              isLast={idx === summaries.length - 1}
            />
          ))
        )}
      </div>
    </div>
  );
}
