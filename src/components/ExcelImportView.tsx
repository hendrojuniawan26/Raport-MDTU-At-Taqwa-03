import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Sparkles,
  Upload,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import {
  autoDetectColumnMapping,
  downloadMdtuTemplateExcel,
  exportClassLegerToExcel,
  parseCsvTextAsWorkbook,
  parseExcelFile,
  type ParsedExcelWorkbook,
} from '../lib/excel';
import { buildClassLegerSummaries, clampScore } from '../lib/grading';
import { getWaliClassIds } from '../lib/rbac';
import type { Student } from '../types';

export function ExcelImportView() {
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
    bulkImportData,
    pushToast,
  } = useApp();

  const [workbook, setWorkbook] = useState<ParsedExcelWorkbook | null>(null);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState(0);
  const [targetClassId, setTargetClassId] = useState(
    selectedClassId || classes.find((c) => c.name === 'MDTU-2')?.id || classes[0]?.id || ''
  );
  const [importing, setImporting] = useState(false);

  // Mapping state
  const [nisCol, setNisCol] = useState('');
  const [nisnCol, setNisnCol] = useState('');
  const [nameCol, setNameCol] = useState('');
  const [genderCol, setGenderCol] = useState('');
  const [birthPlaceCol, setBirthPlaceCol] = useState('');
  const [birthDateCol, setBirthDateCol] = useState('');
  const [parentCol, setParentCol] = useState('');
  const [sakitCol, setSakitCol] = useState('');
  const [izinCol, setIzinCol] = useState('');
  const [alpaCol, setAlpaCol] = useState('');
  const [pesanCol, setPesanCol] = useState('');
  const [asCol, setAsCol] = useState('');
  const [assCol, setAssCol] = useState('');
  const [subjectCols, setSubjectCols] = useState<Record<string, string>>({});

  const isWali = userProfile?.role === 'wali_kelas';
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

  useEffect(() => {
    if (
      accessibleClasses.length > 0 &&
      !accessibleClasses.some((c) => c.id === targetClassId)
    ) {
      setTargetClassId(accessibleClasses[0].id);
    }
  }, [accessibleClasses, targetClassId]);

  const sortedSubjects = useMemo(
    () => [...subjects].sort((a, b) => a.sort_order - b.sort_order),
    [subjects]
  );

  const selectedClass = useMemo(
    () =>
      accessibleClasses.find((c) => c.id === targetClassId) ||
      accessibleClasses[0] ||
      classes[0],
    [accessibleClasses, classes, targetClassId]
  );

  const activeSheet = workbook?.sheets[selectedSheetIndex] || null;

  const applyAutoMapping = (headers: string[]) => {
    const detected = autoDetectColumnMapping(headers, sortedSubjects);
    setNisCol(detected.nisCol);
    setNisnCol(detected.nisnCol);
    setNameCol(detected.nameCol);
    setGenderCol(detected.genderCol);
    setBirthPlaceCol(detected.birthPlaceCol);
    setBirthDateCol(detected.birthDateCol);
    setParentCol(detected.parentCol);
    setSakitCol(detected.sakitCol);
    setIzinCol(detected.izinCol);
    setAlpaCol(detected.alpaCol);
    setPesanCol(detected.pesanCol);
    setAsCol(detected.asCol);
    setAssCol(detected.assCol);
    setSubjectCols(detected.subjectCols);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = await parseExcelFile(file);
      setWorkbook(parsed);
      setSelectedSheetIndex(0);
      if (parsed.sheets[0]) {
        applyAutoMapping(parsed.sheets[0].headers);
      }
      pushToast(
        'success',
        `File "${file.name}" berhasil dibaca (${parsed.sheets.length} sheet).`
      );
    } catch (err) {
      pushToast(
        'error',
        `Gagal membaca file: ${err instanceof Error ? err.message : 'Format tidak didukung'}`
      );
    }
  };

  const handleLoadAttachedAttaqwaCsv = async () => {
    try {
      const res = await fetch('/assets/aistudio/Data_Exel_Nilai_Rapot_Attaqwa_08831d68.csv');
      if (!res.ok) throw new Error('File CSV tidak ditemukan');
      const text = await res.text();
      const parsed = await parseCsvTextAsWorkbook(
        text,
        'Data_Exel_Nilai_Rapot_Attaqwa_08831d68.csv'
      );
      setWorkbook(parsed);
      setSelectedSheetIndex(0);
      if (parsed.sheets[0]) {
        applyAutoMapping(parsed.sheets[0].headers);
      }
      const mdtu2 = accessibleClasses.find((c) => c.name.toLowerCase().includes('2'));
      if (mdtu2) setTargetClassId(mdtu2.id);
      pushToast(
        'success',
        'Template CSV At-Taqwa berhasil dimuat & dipetakan otomatis.'
      );
    } catch (err) {
      pushToast(
        'error',
        `Gagal memuat CSV bawaan: ${err instanceof Error ? err.message : 'Error'}`
      );
    }
  };

  const handleSheetChange = (idx: number) => {
    setSelectedSheetIndex(idx);
    const sheet = workbook?.sheets[idx];
    if (sheet) {
      applyAutoMapping(sheet.headers);
    }
  };

  const validPreviewRows = useMemo(() => {
    if (!activeSheet || !nameCol) return [];
    return activeSheet.rows.filter((r) => {
      const nameVal = String(r[nameCol] ?? '').trim();
      return (
        nameVal.length > 0 &&
        !nameVal.toLowerCase().includes('kkm') &&
        !nameVal.toLowerCase().includes('rata')
      );
    });
  }, [activeSheet, nameCol]);

  const handleCommitImport = async () => {
    if (!activeSheet || !nameCol) {
      pushToast('error', 'Pilih kolom Nama Santri terlebih dahulu.');
      return;
    }
    if (!targetClassId) {
      pushToast('error', 'Pilih kelas tujuan import.');
      return;
    }

    setImporting(true);
    try {
      const newStudents: Omit<Student, 'id'>[] = [];
      const newGrades: {
        studentNis: string;
        subjectId: string;
        formatif: number;
        pts: number;
        pas: number;
        praktik: number;
        predicateOverride?: string;
        descriptionOverride?: string;
      }[] = [];
      const attendanceUpdates: {
        studentNis: string;
        sakit: number;
        izin: number;
        alpa: number;
        asScore?: number;
        assScore?: number;
        pesanWalas?: string;
      }[] = [];

      const findSiblingCol = (scoreHeader: string, keyword: string) => {
        const prefix = scoreHeader.split('—')[0].trim().toLowerCase();
        return activeSheet.headers.find(
          (h) =>
            h.toLowerCase().startsWith(prefix) &&
            h.toLowerCase().includes(keyword)
        );
      };

      validPreviewRows.forEach((row, idx) => {
        const fullName = String(row[nameCol] ?? '').trim();
        const rawNis = nisCol ? String(row[nisCol] ?? '').trim() : '';
        const nis =
          rawNis || `ATTQ-${(idx + 1).toString().padStart(3, '0')}-2025`;
        const genderRaw = genderCol
          ? String(row[genderCol] ?? '').trim().toUpperCase()
          : 'L';
        const gender: 'L' | 'P' = genderRaw.startsWith('P') ? 'P' : 'L';

        newStudents.push({
          nis,
          nisn: nisnCol ? String(row[nisnCol] ?? '').trim() : '',
          full_name: fullName,
          birth_place: birthPlaceCol
            ? String(row[birthPlaceCol] ?? 'Cimahi').trim() || 'Cimahi'
            : 'Cimahi',
          birth_date: birthDateCol ? String(row[birthDateCol] ?? '').trim() : '',
          gender,
          parent_name: parentCol
            ? String(row[parentCol] ?? '-').trim() || '-'
            : '-',
          address: 'Kel. Cibeureum, Cimahi Selatan',
          class_id: targetClassId,
          status: 'Aktif',
        });

        Object.entries(subjectCols).forEach(([subjectId, colName]) => {
          if (!colName) return;
          const rawVal = String(row[colName] ?? '').trim();
          if (rawVal === '' || rawVal === '-') return;
          const numScore = Number(rawVal);
          if (!Number.isNaN(numScore)) {
            const score = clampScore(numScore);
            const predCol = findSiblingCol(colName, 'pred');
            const deskCol = findSiblingCol(colName, 'desk');
            const predVal = predCol ? String(row[predCol] ?? '').trim() : '';
            const deskVal = deskCol ? String(row[deskCol] ?? '').trim() : '';

            newGrades.push({
              studentNis: nis,
              subjectId,
              formatif: score,
              pts: score,
              pas: score,
              praktik: score,
              predicateOverride:
                predVal && predVal !== '0' && predVal !== '-'
                  ? predVal
                  : undefined,
              descriptionOverride:
                deskVal && deskVal !== '-' ? deskVal : undefined,
            });
          }
        });

        const toInt = (val: string | number | undefined) => {
          const n = Number(String(val ?? '').trim());
          return Number.isNaN(n) ? 0 : Math.max(0, Math.round(n));
        };

        attendanceUpdates.push({
          studentNis: nis,
          sakit: sakitCol ? toInt(row[sakitCol]) : 0,
          izin: izinCol ? toInt(row[izinCol]) : 0,
          alpa: alpaCol ? toInt(row[alpaCol]) : 0,
          asScore: asCol ? toInt(row[asCol]) || 82 : undefined,
          assScore: assCol ? toInt(row[assCol]) || 82 : undefined,
          pesanWalas: pesanCol
            ? String(row[pesanCol] ?? '').trim() || undefined
            : undefined,
        });
      });

      await bulkImportData({
        newStudents,
        newGrades,
        attendanceUpdates,
        targetClassId,
      });
      setSelectedClassId(targetClassId);
    } finally {
      setImporting(false);
    }
  };

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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Import & Export Excel / CSV
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Unggah file CSV/Excel nilai raport At-Taqwa (.csv, .xlsx, .xls) untuk pemetaan otomatis ke database, atau ekspor Leger kelas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleLoadAttachedAttaqwaCsv}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-emerald-900 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4 text-emerald-700" />
            Muat CSV At-Taqwa (MDTU-2)
          </button>
          <button
            type="button"
            onClick={() =>
              downloadMdtuTemplateExcel(
                sortedSubjects,
                classStudents,
                selectedClass,
                settings
              )
            }
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="w-4 h-4 text-emerald-700" />
            Unduh Template
          </button>
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
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Export Leger {selectedClass?.name || ''}
          </button>
        </div>
      </div>

      {/* Upload Box & Kelas Tujuan */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-900">
            1. Pilih Kelas Tujuan & Unggah File
          </h2>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Kelas Tujuan Import
            </label>
            <select
              value={targetClassId}
              onChange={(e) => setTargetClassId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
            >
              {accessibleClasses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} (Wali: {c.wali_kelas_name})
                </option>
              ))}
            </select>
          </div>

          <label className="block border-2 border-dashed border-slate-300 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-700 hover:bg-emerald-50/30 transition-colors">
            <Upload className="w-8 h-8 text-emerald-700 mx-auto" />
            <p className="mt-3 text-sm font-medium text-slate-900">
              Klik untuk memilih file (.csv, .xlsx, .xls)
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Mendukung format CSV Nilai Raport At-Taqwa &amp; workbook Excel multi-sheet
            </p>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {workbook && (
            <div className="pt-2 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-700 truncate max-w-[200px]">
                  File: {workbook.fileName}
                </span>
                <span className="text-emerald-700 font-medium">
                  {workbook.sheets.length} Sheet terbaca
                </span>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Pilih Sheet yang Akan Diimport
                </label>
                <select
                  value={selectedSheetIndex}
                  onChange={(e) => handleSheetChange(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                >
                  {workbook.sheets.map((sh, i) => (
                    <option key={`${i}-${sh.sheetName}`} value={i}>
                      {sh.sheetName} ({sh.rows.length} baris)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Pemetaan Kolom */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              2. Pemetaan Kolom ke Database
            </h2>
            {activeSheet && (
              <span className="text-xs text-slate-500 font-mono">
                {activeSheet.headers.length} kolom terdeteksi
              </span>
            )}
          </div>

          {!activeSheet ? (
            <div className="py-12 text-center text-sm text-slate-500 border border-slate-100 rounded-lg bg-slate-50/50">
              Unggah file Excel/CSV atau klik <strong>Muat CSV At-Taqwa (MDTU-2)</strong> untuk melihat pemetaan kolom otomatis.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Nama Santri *', val: nameCol, set: setNameCol },
                  { label: 'Nomor Induk / NIS', val: nisCol, set: setNisCol },
                  { label: 'Sikap Spiritual (AS)', val: asCol, set: setAsCol },
                  { label: 'Sikap Sosial (ASS)', val: assCol, set: setAssCol },
                  { label: 'Sakit', val: sakitCol, set: setSakitCol },
                  { label: 'Izin', val: izinCol, set: setIzinCol },
                  { label: 'Alpha / Alpa', val: alpaCol, set: setAlpaCol },
                  { label: 'Pesan Walas', val: pesanCol, set: setPesanCol },
                  { label: 'Orang Tua', val: parentCol, set: setParentCol },
                ].map((f) => (
                  <div key={f.label}>
                    <label className="block text-[11px] font-medium text-slate-600 mb-1">
                      {f.label}
                    </label>
                    <select
                      value={f.val}
                      onChange={(e) => f.set(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                    >
                      <option value="">-- Abaikan --</option>
                      {activeSheet.headers.map((h, hIdx) => (
                        <option key={`${hIdx}-${h}`} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-100">
                <p className="text-xs font-semibold text-slate-800 mb-2">
                  Pemetaan Kolom Nilai Mata Pelajaran (Pengetahuan &amp; Praktik)
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {sortedSubjects.map((subj) => (
                    <div key={subj.id}>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1 truncate">
                        {subj.code} · {subj.name}
                      </label>
                      <select
                        value={subjectCols[subj.id] || ''}
                        onChange={(e) =>
                          setSubjectCols((prev) => ({
                            ...prev,
                            [subj.id]: e.target.value,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white"
                      >
                        <option value="">-- Tidak ada --</option>
                        {activeSheet.headers.map((h, hIdx) => (
                          <option key={`${hIdx}-${h}`} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Preview Table */}
      {activeSheet && validPreviewRows.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                3. Pratinjau Data Siap Import ({validPreviewRows.length} Santri)
              </h2>
              <p className="text-xs text-slate-500">
                Periksa kembali pemetaan sebelum menyimpan ke {selectedClass?.name}.
              </p>
            </div>
            <button
              type="button"
              disabled={importing}
              onClick={handleCommitImport}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <CheckCircle2 className="w-4 h-4" />
              {importing
                ? 'Mengimport...'
                : `Import ${validPreviewRows.length} Santri & Nilai`}
            </button>
          </div>

          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0">
                <tr>
                  <th className="px-3 py-2.5">No</th>
                  <th className="px-3 py-2.5">NIS</th>
                  <th className="px-3 py-2.5">Nama Santri</th>
                  {sortedSubjects.map((s) => (
                    <th key={s.id} className="px-2.5 py-2.5 text-center">
                      {s.code}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {validPreviewRows.slice(0, 50).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono text-slate-500">
                      {idx + 1}
                    </td>
                    <td className="px-3 py-2 font-mono">
                      {nisCol ? String(row[nisCol] || 'Otomatis') : 'Otomatis'}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {String(row[nameCol] || '')}
                    </td>
                    {sortedSubjects.map((s) => {
                      const col = subjectCols[s.id];
                      const val = col ? row[col] : '-';
                      return (
                        <td
                          key={s.id}
                          className="px-2.5 py-2 text-center font-mono tabular-nums"
                        >
                          {val !== '' && val !== undefined ? String(val) : '-'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
