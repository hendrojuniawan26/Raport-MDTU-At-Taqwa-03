import {
  AlertCircle,
  ClipboardEdit,
  Download,
  FileSpreadsheet,
  Search,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { exportClassLegerToExcel } from '../lib/excel';
import { buildClassLegerSummaries, clampScore, getPredicate } from '../lib/grading';
import {
  canEditClass,
  canEditNonAcademic,
  canEditSubject,
  getWaliClassIds,
} from '../lib/rbac';
import type { NonAcademicRecord } from '../types';

export function LegerView() {
  const {
    userProfile,
    settings,
    classes,
    subjects,
    students,
    grades,
    nonAcademics,
    selectedClassId,
    setSelectedClassId,
    upsertGrade,
    upsertNonAcademic,
  } = useApp();

  const [mode, setMode] = useState<'rekap' | 'detail'>('detail');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    subjects[0]?.id || ''
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNonAcad, setEditingNonAcad] =
    useState<NonAcademicRecord | null>(null);
  const [editingStudentName, setEditingStudentName] = useState<string>('');

  const isWali = userProfile?.role === 'wali_kelas';
  const isGuru = userProfile?.role === 'guru';

  const waliClassIds = useMemo(
    () => getWaliClassIds(userProfile, classes),
    [userProfile, classes]
  );

  const accessibleClasses = useMemo(() => {
    if (isWali && waliClassIds.length > 0) {
      return classes.filter((c) => waliClassIds.includes(c.id));
    }
    return classes;
  }, [classes, isWali, waliClassIds]);

  const sortedSubjects = useMemo(
    () => [...subjects].sort((a, b) => a.sort_order - b.sort_order),
    [subjects]
  );

  const editableSubjects = useMemo(
    () => sortedSubjects.filter((s) => canEditSubject(userProfile, s)),
    [sortedSubjects, userProfile]
  );

  const detailSubjectChoices = useMemo(() => {
    if (isGuru && editableSubjects.length > 0) {
      return editableSubjects;
    }
    return sortedSubjects;
  }, [isGuru, editableSubjects, sortedSubjects]);

  const activeSubject = useMemo(
    () =>
      detailSubjectChoices.find((s) => s.id === selectedSubjectId) ||
      detailSubjectChoices[0],
    [detailSubjectChoices, selectedSubjectId]
  );

  const selectedClass = useMemo(
    () =>
      accessibleClasses.find((c) => c.id === selectedClassId) ||
      accessibleClasses[0] ||
      classes[0],
    [accessibleClasses, classes, selectedClassId]
  );

  const canEditActiveSubject =
    Boolean(activeSubject) &&
    canEditSubject(userProfile, activeSubject!) &&
    canEditClass(userProfile, selectedClass?.id || '', classes);

  const canEditClassNonAcad = canEditNonAcademic(
    userProfile,
    selectedClass?.id || '',
    classes
  );

  const classStudents = useMemo(
    () =>
      students.filter(
        (s) => s.class_id === selectedClass?.id && s.status === 'Aktif'
      ),
    [students, selectedClass]
  );

  const legerSummaries = useMemo(
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

  const filteredSummaries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return legerSummaries;
    return legerSummaries.filter(
      (sum) =>
        sum.student.full_name.toLowerCase().includes(q) ||
        sum.student.nis.toLowerCase().includes(q)
    );
  }, [legerSummaries, searchQuery]);

  const handleScoreChange = (
    studentId: string,
    subjectId: string,
    field: 'formatif' | 'pts' | 'pas' | 'praktik',
    rawVal: string
  ) => {
    const val = rawVal === '' ? 0 : clampScore(Number(rawVal));
    const current = legerSummaries.find((s) => s.student.id === studentId)
      ?.gradesBySubject[subjectId];

    upsertGrade({
      student_id: studentId,
      subject_id: subjectId,
      class_id: selectedClass?.id || '',
      formatif: field === 'formatif' ? val : current?.formatif ?? 0,
      pts: field === 'pts' ? val : current?.pts ?? 0,
      pas: field === 'pas' ? val : current?.pas ?? 0,
      praktik: field === 'praktik' ? val : current?.praktik ?? 0,
    });
  };

  const handleSaveNonAcademic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingNonAcad) return;
    await upsertNonAcademic(editingNonAcad);
    setEditingNonAcad(null);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Leger & Pengolahan Nilai
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>
              Bobot: Formatif {settings.bobot_formatif}% · PTS{' '}
              {settings.bobot_pts}% · PAS {settings.bobot_pas}% · Praktik{' '}
              {settings.bobot_praktik}%
            </span>
            <span aria-hidden="true">·</span>
            <span>Wali Kelas: {selectedClass?.wali_kelas_name || '-'}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setMode('detail')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                mode === 'detail'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Input Rinci per Mapel
            </button>
            <button
              type="button"
              onClick={() => setMode('rekap')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                mode === 'rekap'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Leger Rekap Kelas
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              exportClassLegerToExcel(
                legerSummaries,
                sortedSubjects,
                selectedClass,
                settings
              )
            }
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            Export Leger Excel
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="sr-only" htmlFor="leger-class-select">
              Pilih Kelas
            </label>
            <select
              id="leger-class-select"
              value={selectedClass?.id || ''}
              onChange={(e) => setSelectedClassId(e.target.value)}
              disabled={accessibleClasses.length <= 1}
              className="px-3 py-2 text-sm font-medium border border-slate-200 rounded-lg bg-white disabled:bg-slate-50 disabled:text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
            >
              {accessibleClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {mode === 'detail' && activeSubject && (
            <div>
              <label className="sr-only" htmlFor="leger-subject-select">
                Pilih Mata Pelajaran
              </label>
              <select
                id="leger-subject-select"
                value={activeSubject.id}
                onChange={(e) => setSelectedSubjectId(e.target.value)}
                className="px-3 py-2 text-sm font-medium border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
              >
                {detailSubjectChoices.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name} (KKM {s.kkm})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari santri / NIS..."
              className="pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg w-56 focus:outline-none focus:ring-2 focus:ring-emerald-700/20"
            />
          </div>
        </div>

        <div className="text-xs text-slate-500 flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
          <span>
            {filteredSummaries.length} santri · Nilai di bawah KKM ditandai merah
          </span>
        </div>
      </div>

      {/* MODE 1: INPUT RINCI PER MAPEL */}
      {mode === 'detail' && activeSubject && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="font-semibold text-slate-900">
              {activeSubject.name}{' '}
              <span className="font-normal text-slate-500">
                ({activeSubject.code}) · KKM: {activeSubject.kkm}
              </span>
            </div>
            <div className="text-slate-500">
              Ubah angka langsung pada sel tabel — Nilai Akhir, Predikat & Ranking otomatis terhitung.
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead className="bg-slate-50 text-xs text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3 font-medium w-12 text-center">No</th>
                  <th className="px-3 py-3 font-medium">NIS</th>
                  <th className="px-4 py-3 font-medium min-w-[200px]">
                    Nama Santri
                  </th>
                  <th className="px-2 py-3 font-medium text-center w-24">
                    Formatif ({settings.bobot_formatif}%)
                  </th>
                  <th className="px-2 py-3 font-medium text-center w-24">
                    PTS ({settings.bobot_pts}%)
                  </th>
                  <th className="px-2 py-3 font-medium text-center w-24">
                    PAS ({settings.bobot_pas}%)
                  </th>
                  <th className="px-2 py-3 font-medium text-center w-24">
                    Praktik ({settings.bobot_praktik}%)
                  </th>
                  <th className="px-3 py-3 font-medium text-center w-24">
                    Nilai Akhir
                  </th>
                  <th className="px-3 py-3 font-medium text-center w-36">
                    Predikat & KKM
                  </th>
                  <th className="px-3 py-3 font-medium text-right">
                    Sikap & Absensi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSummaries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-10 text-center text-slate-500"
                    >
                      Belum ada santri aktif di kelas ini.
                    </td>
                  </tr>
                ) : (
                  filteredSummaries.map((sum, idx) => {
                    const grade = sum.gradesBySubject[activeSubject.id];
                    const score = grade?.final_score ?? 0;
                    const pred = getPredicate(score, activeSubject.kkm);
                    const isBelow = score < activeSubject.kkm;

                    return (
                      <tr
                        key={sum.student.id}
                        className="hover:bg-slate-50/60 transition-colors"
                      >
                        <td className="px-3 py-2 text-center font-mono tabular-nums text-xs text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="px-3 py-2 font-mono tabular-nums text-xs text-slate-600">
                          {sum.student.nis}
                        </td>
                        <td className="px-4 py-2 font-medium text-slate-900">
                          {sum.student.full_name}
                        </td>
                        {(['formatif', 'pts', 'pas', 'praktik'] as const).map(
                          (field) => (
                            <td key={field} className="px-2 py-1.5 text-center">
                              <input
                                type="number"
                                min={0}
                                max={100}
                                disabled={!canEditActiveSubject}
                                value={grade?.[field] ?? 0}
                                onChange={(e) =>
                                  handleScoreChange(
                                    sum.student.id,
                                    activeSubject.id,
                                    field,
                                    e.target.value
                                  )
                                }
                                className="w-16 px-2 py-1 text-center font-mono tabular-nums text-sm border border-slate-200 rounded disabled:bg-slate-50 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-700/30 focus:border-emerald-700"
                              />
                            </td>
                          )
                        )}
                        <td
                          className={`px-3 py-2 text-center font-mono tabular-nums font-bold ${
                            isBelow
                              ? 'text-red-700 bg-red-50/70'
                              : 'text-emerald-900 bg-emerald-50/40'
                          }`}
                        >
                          {score}
                        </td>
                        <td className="px-3 py-2 text-center text-xs">
                          {isBelow ? (
                            <span className="inline-flex items-center gap-1 text-red-700 font-medium">
                              <AlertCircle className="w-3.5 h-3.5" />
                              {pred.letter} · &lt; KKM
                            </span>
                          ) : (
                            <span className="text-slate-700 font-medium">
                              {pred.letter} ({pred.arabicTerm})
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {canEditClassNonAcad ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingNonAcad(sum.nonAcademic);
                                setEditingStudentName(sum.student.full_name);
                              }}
                              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-800 hover:underline whitespace-nowrap"
                            >
                              <ClipboardEdit className="w-3.5 h-3.5" />
                              S:{sum.nonAcademic.sakit} I:{sum.nonAcademic.izin} A:
                              {sum.nonAcademic.alpa}
                            </button>
                          ) : (
                            <span className="text-xs font-mono tabular-nums text-slate-500">
                              S:{sum.nonAcademic.sakit} I:{sum.nonAcademic.izin} A:
                              {sum.nonAcademic.alpa}
                            </span>
                          )}
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

      {/* MODE 2: LEGER REKAP SATU KELAS */}
      {mode === 'rekap' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-50 text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="px-3 py-3 font-semibold text-center sticky left-0 bg-slate-50 z-10 border-r border-slate-200">
                    No
                  </th>
                  <th className="px-3 py-3 font-semibold min-w-[180px] sticky left-10 bg-slate-50 z-10 border-r border-slate-200">
                    Nama Santri
                  </th>
                  {sortedSubjects.map((subj) => (
                    <th
                      key={subj.id}
                      className="px-2.5 py-3 font-semibold text-center min-w-[68px]"
                      title={`${subj.name} (KKM ${subj.kkm})`}
                    >
                      <div>{subj.code}</div>
                      <div className="text-[10px] font-normal text-slate-400 font-mono">
                        KKM {subj.kkm}
                      </div>
                    </th>
                  ))}
                  <th className="px-3 py-3 font-semibold text-right bg-slate-100/70">
                    Jumlah
                  </th>
                  <th className="px-3 py-3 font-semibold text-right bg-slate-100/70">
                    Rata²
                  </th>
                  <th className="px-3 py-3 font-semibold text-center bg-slate-100/70">
                    Rank
                  </th>
                  <th className="px-3 py-3 font-semibold text-center">S/I/A</th>
                  <th className="px-3 py-3 font-semibold text-right">
                    Non-Akad
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSummaries.map((sum, idx) => (
                  <tr key={sum.student.id} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2.5 text-center font-mono tabular-nums text-slate-500 sticky left-0 bg-white border-r border-slate-100">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-900 sticky left-10 bg-white border-r border-slate-100">
                      <div>{sum.student.full_name}</div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {sum.student.nis}
                      </div>
                    </td>
                    {sortedSubjects.map((subj) => {
                      const val =
                        sum.gradesBySubject[subj.id]?.final_score ?? 0;
                      const below = val < subj.kkm;
                      return (
                        <td
                          key={subj.id}
                          className={`px-2.5 py-2.5 text-center font-mono tabular-nums ${
                            below
                              ? 'text-red-700 font-semibold bg-red-50/60'
                              : 'text-slate-800'
                          }`}
                        >
                          {val}
                          {below && <span className="ml-0.5 text-[10px]">*</span>}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900 bg-slate-50/70">
                      {sum.totalScore}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold text-emerald-900 bg-slate-50/70">
                      {sum.averageScore}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono tabular-nums font-bold text-amber-800 bg-slate-50/70">
                      #{sum.rank}
                    </td>
                    <td className="px-3 py-2.5 text-center font-mono tabular-nums text-slate-600">
                      {sum.nonAcademic.sakit}/{sum.nonAcademic.izin}/
                      {sum.nonAcademic.alpa}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {canEditClassNonAcad ? (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNonAcad(sum.nonAcademic);
                            setEditingStudentName(sum.student.full_name);
                          }}
                          className="text-emerald-800 font-medium hover:underline"
                        >
                          Ubah
                        </button>
                      ) : (
                        <span className="text-slate-400">Terkunci</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 text-[11px] text-slate-500">
            * Tanda bintang dan warna merah menandakan Nilai Akhir santri masih di bawah KKM mata pelajaran terkait.
          </div>
        </div>
      )}

      {/* MODAL NON-AKADEMIK & KEHADIRAN */}
      {editingNonAcad && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl p-6 shadow-xl my-8">
            <h3 className="text-lg font-semibold text-slate-900">
              Sikap, Ekstrakurikuler & Kehadiran
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Santri: {editingStudentName} · Semester {settings.semester}{' '}
              {settings.tahun_pelajaran}
            </p>
            <form onSubmit={handleSaveNonAcademic} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Predikat Sikap Spiritual
                  </label>
                  <select
                    value={editingNonAcad.sikap_spiritual}
                    onChange={(e) =>
                      setEditingNonAcad({
                        ...editingNonAcad,
                        sikap_spiritual: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Sangat Baik">Sangat Baik</option>
                    <option value="Berkembang Sesuai Harapan">
                      Berkembang Sesuai Harapan
                    </option>
                    <option value="Baik">Baik</option>
                    <option value="Mulai Berkembang">Mulai Berkembang</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Predikat Sikap Sosial
                  </label>
                  <select
                    value={editingNonAcad.sikap_sosial}
                    onChange={(e) =>
                      setEditingNonAcad({
                        ...editingNonAcad,
                        sikap_sosial: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Sangat Baik">Sangat Baik</option>
                    <option value="Berkembang Sesuai Harapan">
                      Berkembang Sesuai Harapan
                    </option>
                    <option value="Baik">Baik</option>
                    <option value="Mulai Berkembang">Mulai Berkembang</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Deskripsi Sikap Spiritual
                </label>
                <textarea
                  rows={2}
                  value={editingNonAcad.akhlak_catatan}
                  onChange={(e) =>
                    setEditingNonAcad({
                      ...editingNonAcad,
                      akhlak_catatan: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Deskripsi Sikap Sosial
                </label>
                <textarea
                  rows={2}
                  value={editingNonAcad.sosial_catatan}
                  onChange={(e) =>
                    setEditingNonAcad({
                      ...editingNonAcad,
                      sosial_catatan: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Ekstrakurikuler 1
                  </label>
                  <input
                    type="text"
                    value={editingNonAcad.ekskul_1_nama}
                    onChange={(e) =>
                      setEditingNonAcad({
                        ...editingNonAcad,
                        ekskul_1_nama: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Predikat 1
                  </label>
                  <select
                    value={editingNonAcad.ekskul_1_nilai}
                    onChange={(e) =>
                      setEditingNonAcad({
                        ...editingNonAcad,
                        ekskul_1_nilai: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="A">A (Sangat Baik)</option>
                    <option value="B">B (Baik)</option>
                    <option value="C">C (Cukup)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Ekstrakurikuler 2
                  </label>
                  <input
                    type="text"
                    value={editingNonAcad.ekskul_2_nama}
                    onChange={(e) =>
                      setEditingNonAcad({
                        ...editingNonAcad,
                        ekskul_2_nama: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Predikat 2
                  </label>
                  <select
                    value={editingNonAcad.ekskul_2_nilai}
                    onChange={(e) =>
                      setEditingNonAcad({
                        ...editingNonAcad,
                        ekskul_2_nilai: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="A">A (Sangat Baik)</option>
                    <option value="B">B (Baik)</option>
                    <option value="C">C (Cukup)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Sakit (hari)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editingNonAcad.sakit}
                    onChange={(e) =>
                      setEditingNonAcad({
                        ...editingNonAcad,
                        sakit: Math.max(0, Number(e.target.value)),
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Izin (hari)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editingNonAcad.izin}
                    onChange={(e) =>
                      setEditingNonAcad({
                        ...editingNonAcad,
                        izin: Math.max(0, Number(e.target.value)),
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Alpa (hari)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editingNonAcad.alpa}
                    onChange={(e) =>
                      setEditingNonAcad({
                        ...editingNonAcad,
                        alpa: Math.max(0, Number(e.target.value)),
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Catatan Wali Kelas
                </label>
                <textarea
                  rows={2}
                  value={editingNonAcad.catatan_wali}
                  onChange={(e) =>
                    setEditingNonAcad({
                      ...editingNonAcad,
                      catatan_wali: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>

              {settings.semester === 'Genap' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Keputusan Akhir Tahun
                  </label>
                  <select
                    value={editingNonAcad.keputusan_naik}
                    onChange={(e) =>
                      setEditingNonAcad({
                        ...editingNonAcad,
                        keputusan_naik: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Naik ke Kelas Berikutnya">
                      Naik ke Kelas Berikutnya
                    </option>
                    <option value="Lulus / Tamat MDTU">
                      Lulus / Tamat MDTU
                    </option>
                    <option value="Tinggal Kelas (Perlu Pembinaan)">
                      Tinggal Kelas (Perlu Pembinaan)
                    </option>
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingNonAcad(null)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-800 rounded-lg hover:bg-emerald-900"
                >
                  Simpan Catatan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
