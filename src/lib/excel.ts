import * as XLSX from 'xlsx';
import type {
  MadrasahClass,
  MadrasahSettings,
  Student,
  StudentLegerSummary,
  Subject,
} from '../types';

export interface ParsedExcelSheet {
  sheetName: string;
  headers: string[];
  rows: Record<string, string | number>[];
}

export interface ParsedExcelWorkbook {
  fileName: string;
  sheets: ParsedExcelSheet[];
}

function cleanSubjectPrefix(raw: string): string {
  return raw
    .replace(/nama\s*guru\s*/gi, '')
    .replace(/[()]/g, '')
    .trim();
}

function isRepeatedSubHeader(val: string): boolean {
  const lower = val.trim().toLowerCase();
  return (
    lower === 'angka' ||
    lower === 'pred' ||
    lower === 'predikat' ||
    lower === 'desk' ||
    lower === 'deskripsi' ||
    lower === 'nilai'
  );
}

/**
 * Membaca file Excel (.xlsx / .xls) atau .csv dan mengekstrak seluruh sheet,
 * memecah header berulang (seperti Angka/Pred/Deskripsi di CSV At-Taqwa), serta baris data.
 */
export async function parseExcelFile(file: File): Promise<ParsedExcelWorkbook> {
  const isCsv = file.name.toLowerCase().endsWith('.csv');
  let workbook: XLSX.WorkBook;

  if (isCsv) {
    const text = await file.text();
    workbook = XLSX.read(text, { type: 'string' });
  } else {
    const buffer = await file.arrayBuffer();
    workbook = XLSX.read(buffer, { type: 'array' });
  }

  return parseWorkbookInstance(workbook, file.name);
}

export async function parseCsvTextAsWorkbook(
  csvText: string,
  fileName: string
): Promise<ParsedExcelWorkbook> {
  const workbook = XLSX.read(csvText, { type: 'string' });
  return parseWorkbookInstance(workbook, fileName);
}

function parseWorkbookInstance(
  workbook: XLSX.WorkBook,
  fileName: string
): ParsedExcelWorkbook {
  const sheets: ParsedExcelSheet[] = workbook.SheetNames.map((sheetName) => {
    const worksheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(
      worksheet,
      {
        header: 1,
        defval: '',
        blankrows: false,
      }
    );

    if (matrix.length === 0) {
      return { sheetName, headers: [], rows: [] };
    }

    // Deteksi baris header (baris pertama yang punya >= 2 sel berisi teks nama/nis/nomor induk/santri)
    let headerRowIndex = 0;
    for (let i = 0; i < Math.min(matrix.length, 15); i++) {
      const row = matrix[i].map((c) => String(c ?? '').trim().toLowerCase());
      const nonEmpty = row.filter(Boolean);
      const looksLikeHeader =
        nonEmpty.length >= 2 &&
        row.some(
          (c) =>
            c.includes('nama santri') ||
            c.includes('nomor induk') ||
            c.includes('nama') ||
            c.includes('nis') ||
            c.includes('santri')
        );
      if (looksLikeHeader) {
        headerRowIndex = i;
        break;
      }
    }

    // Cek apakah baris di bawahnya adalah sub-header (merged Excel sheet 2 baris)
    const nextRow = matrix[headerRowIndex + 1] || [];
    const nextRowLower = nextRow.map((c) => String(c ?? '').trim().toLowerCase());
    const hasSubHeaderRow = nextRowLower.some((c) => isRepeatedSubHeader(c));

    const effectiveHeaderRowIdx = hasSubHeaderRow
      ? headerRowIndex + 1
      : headerRowIndex;
    const parentRowIdx = hasSubHeaderRow
      ? headerRowIndex
      : headerRowIndex > 0
      ? headerRowIndex - 1
      : -1;

    const rawSubHeaders = matrix[effectiveHeaderRowIdx] || [];
    const rawParentRow = parentRowIdx >= 0 ? matrix[parentRowIdx] || [] : [];
    const colCount = Math.max(rawSubHeaders.length, rawParentRow.length);

    // Propagasi label sel yang di-merge secara horizontal pada baris induk
    const parentLabels: string[] = Array.from({ length: colCount }, (_, idx) =>
      String(rawParentRow[idx] ?? '').trim()
    );
    const merges = worksheet['!merges'] || [];
    for (const m of merges) {
      if (parentRowIdx >= 0 && m.s.r <= parentRowIdx && m.e.r >= parentRowIdx) {
        const mergedVal = String(rawParentRow[m.s.c] ?? '').trim();
        if (mergedVal) {
          for (let c = m.s.c; c <= m.e.c && c < colCount; c++) {
            parentLabels[c] = mergedVal;
          }
        }
      }
    }

    // Hitung frekuensi sub-header untuk mendeteksi kolom berulang dalam 1 baris (seperti CSV At-Taqwa)
    const subHeaderFreq = new Map<string, number>();
    for (let idx = 0; idx < colCount; idx++) {
      const subText = String(rawSubHeaders[idx] ?? '').trim();
      if (subText) {
        subHeaderFreq.set(subText, (subHeaderFreq.get(subText) || 0) + 1);
      }
    }

    const seenHeaderCounts = new Map<string, number>();
    const headers: string[] = [];
    let lastGroupPrefix = '';

    for (let idx = 0; idx < colCount; idx++) {
      const subText = String(rawSubHeaders[idx] ?? '').trim();
      const parentText = parentLabels[idx] || '';

      if (subText && !isRepeatedSubHeader(subText)) {
        // Misal "Nama Guru (Al-Quran)", "juz'amma", "khot Imla", "Nuroniyah", "Qiroatul Quran", "ML"
        lastGroupPrefix = cleanSubjectPrefix(subText);
      }

      let combined = subText || parentText || `Kolom_${idx + 1}`;

      if (hasSubHeaderRow && subText && parentText && parentText.toLowerCase() !== subText.toLowerCase()) {
        // Format Excel 2 baris dengan merge header
        combined = `${cleanSubjectPrefix(parentText)} — ${subText}`;
      } else if (!hasSubHeaderRow && subText && isRepeatedSubHeader(subText) && lastGroupPrefix) {
        // Format CSV At-Taqwa 1 baris di mana Angka/Pred/Deskripsi berada di kanan nama guru/mapel
        combined = `${lastGroupPrefix} — ${subText}`;
      } else if (!subText && parentText) {
        combined = parentText;
      }

      const count = (seenHeaderCounts.get(combined) || 0) + 1;
      seenHeaderCounts.set(combined, count);
      headers.push(count > 1 ? `${combined} (${count})` : combined);
    }

    const rows: Record<string, string | number>[] = [];
    for (let r = effectiveHeaderRowIdx + 1; r < matrix.length; r++) {
      const rawRow = matrix[r];
      if (!rawRow) continue;
      const nonEmptyCount = rawRow.filter(
        (c) => String(c ?? '').trim() !== ''
      ).length;
      if (nonEmptyCount < 2) continue;

      const rowObj: Record<string, string | number> = {};
      headers.forEach((h, cIdx) => {
        const val = rawRow[cIdx];
        rowObj[h] = val === null || val === undefined ? '' : val;
      });
      rows.push(rowObj);
    }

    return { sheetName, headers, rows };
  });

  return {
    fileName,
    sheets,
  };
}

/**
 * Auto-deteksi pemetaan kolom Excel/CSV standar MDTU At-Taqwa '03.
 */
export function autoDetectColumnMapping(
  headers: string[],
  subjects: Subject[]
): {
  nisCol: string;
  nisnCol: string;
  nameCol: string;
  genderCol: string;
  birthPlaceCol: string;
  birthDateCol: string;
  parentCol: string;
  sakitCol: string;
  izinCol: string;
  alpaCol: string;
  pesanCol: string;
  asCol: string;
  assCol: string;
  subjectCols: Record<string, string>;
} {
  const findCol = (patterns: string[], exactMatches: string[] = []) => {
    const matched = headers.find((h) => {
      const lower = h.trim().toLowerCase();
      if (exactMatches.includes(lower)) return true;
      return patterns.some((p) => lower.includes(p));
    });
    return matched || '';
  };

  const exactNis =
    headers.find((h) => h.trim().toLowerCase() === 'nomor induk') ||
    headers.find((h) => h.trim().toLowerCase() === 'nis') ||
    headers.find(
      (h) =>
        h.toLowerCase().includes('nis') && !h.toLowerCase().includes('nisn')
    ) ||
    '';

  const subjectCols: Record<string, string> = {};
  for (const subj of subjects) {
    const lowerName = subj.name.toLowerCase();
    const lowerCode = subj.code.toLowerCase();

    const candidates = headers.filter((h) => {
      const lh = h.toLowerCase();
      if (lh.includes('pred') || lh.includes('desk') || lh.includes('nama guru')) {
        return false;
      }
      if (lh === lowerName || lh === lowerCode || lh.includes(lowerName)) {
        return true;
      }
      if (
        (lowerName.includes('quran') || lowerName.includes("qur'an")) &&
        !lowerName.includes('nuroniyah') &&
        lh.includes('al-quran')
      ) {
        return true;
      }
      if (lowerName.includes('hadits') && lh.includes('hadits')) return true;
      if (lowerName.includes('aqidah') && lh.includes('aqidah')) return true;
      if (lowerName.includes('akhlak') && lh.includes('akhlak')) return true;
      if (lowerName.includes('fiqih') && lh.includes('fiqih')) return true;
      if (lowerName.includes('tarikh') && (lh.includes('tarikh') || lh.includes('ski'))) return true;
      if (lowerName.includes('arab') && lh.includes('arab')) return true;
      if (lowerName.includes('nuroniyah') && lh.includes('nuroniyah')) return true;
      if (lowerName.includes('juz') && (lh.includes("juz'amma") || lh.includes('juz'))) return true;
      if (lowerName.includes('khot') && lh.includes('khot')) return true;
      if (lowerName.includes('praktek') && (lh.includes('praktek') || lh.includes('praktik'))) return true;
      return false;
    });

    const preferred =
      candidates.find((h) => h.toLowerCase().includes('angka')) ||
      candidates.find((h) => h.toLowerCase().includes('nilai')) ||
      candidates[0];
    if (preferred) {
      subjectCols[subj.id] = preferred;
    }
  }

  return {
    nisCol: exactNis,
    nisnCol: findCol(['nisn']),
    nameCol: findCol(['nama santri', 'nama lengkap', 'nama siswa', 'nama']),
    genderCol: findCol(['l/p', 'jenis kelamin', 'kelamin'], ['jk']),
    birthPlaceCol: findCol(['tempat lahir', 'tmp lahir', 'tempat']),
    birthDateCol: findCol(['tanggal lahir', 'tgl lahir']),
    parentCol: findCol(['orang tua', 'nama ayah', 'ortu']),
    sakitCol: findCol(['sakit'], ['s']),
    izinCol: findCol(['izin'], ['i']),
    alpaCol: findCol(['alpha', 'alpa', 'alfa', 'tanpa keterangan'], ['a']),
    pesanCol: findCol(['pesan walas', 'pesan wali', 'catatan wali']),
    asCol: findCol([], ['as']),
    assCol: findCol([], ['ass']),
    subjectCols,
  };
}

/**
 * Mengunduh Template Excel resmi MDTU At-Taqwa '03 Cibeureum siap diisi & diimport kembali.
 */
export function downloadMdtuTemplateExcel(
  subjects: Subject[],
  students: Student[],
  selectedClass: MadrasahClass | undefined,
  settings: MadrasahSettings
): void {
  const wb = XLSX.utils.book_new();

  const legerHeader = [
    'No',
    'Nomor Induk',
    'Nama Santri',
    'Kelas',
    'Semester',
    'Th.Pelajaran',
    'AS',
    'ASS',
    ...subjects.map((s) => `${s.name} (${s.code})`),
    'Sakit',
    'Izin',
    'Alpha',
    'Pesan Walas',
  ];

  const legerRows =
    students.length > 0
      ? students.map((st, idx) => [
          idx + 1,
          st.nis,
          st.full_name,
          selectedClass?.name || 'MDTU-2',
          settings.semester,
          settings.tahun_pelajaran,
          82,
          82,
          ...subjects.map(() => 75),
          0,
          0,
          0,
          'Ananda mengikuti pembelajaran dengan baik dan menunjukkan sikap yang sopan.',
        ])
      : [
          [
            1,
            '0182-2526-03',
            'NAFIS PUTRA MULYA',
            selectedClass?.name || 'MDTU-2',
            settings.semester,
            settings.tahun_pelajaran,
            82,
            82,
            ...subjects.map(() => 75),
            0,
            0,
            0,
            'Ananda mengikuti pembelajaran dengan baik.',
          ],
        ];

  const wsLeger = XLSX.utils.aoa_to_sheet([legerHeader, ...legerRows]);
  XLSX.utils.book_append_sheet(wb, wsLeger, 'Import_Leger_Santri');

  const wsMapel = XLSX.utils.aoa_to_sheet([
    ['Kode', 'Mata Pelajaran', 'Kategori', 'Nama Guru', 'KKM'],
    ...subjects.map((s) => [s.code, s.name, s.category, s.teacher_name, s.kkm]),
  ]);
  XLSX.utils.book_append_sheet(wb, wsMapel, 'Daftar_Mapel_KKM');

  const safeClass = (selectedClass?.name || 'MDTU').replace(/\s+/g, '_');
  XLSX.writeFile(wb, `Template_Raport_${safeClass}_AtTaqwa03.xlsx`);
}

/**
 * Mengekspor Leger Nilai lengkap satu kelas ke Excel (.xlsx) dengan format resmi At-Taqwa '03.
 */
export function exportClassLegerToExcel(
  summaries: StudentLegerSummary[],
  subjects: Subject[],
  selectedClass: MadrasahClass | undefined,
  settings: MadrasahSettings
): void {
  const wb = XLSX.utils.book_new();
  const sortedSubjects = [...subjects].sort(
    (a, b) => a.sort_order - b.sort_order
  );

  const headerRow = [
    'No',
    'Nomor Induk',
    'Nama Santri',
    'AS',
    'ASS',
    ...sortedSubjects.map((s) => `${s.name} (KKM ${s.kkm})`),
    'Jumlah Nilai',
    'Rata-rata',
    'Peringkat',
    'Sakit',
    'Izin',
    'Alpha',
    'Pesan Walas',
  ];

  const dataRows = summaries.map((sum, idx) => [
    idx + 1,
    sum.student.nis,
    sum.student.full_name,
    sum.nonAcademic.sikap_spiritual_angka,
    sum.nonAcademic.sikap_sosial_angka,
    ...sortedSubjects.map((s) => sum.gradesBySubject[s.id]?.final_score ?? 0),
    sum.totalScore,
    sum.averageScore,
    sum.rank,
    sum.nonAcademic.sakit,
    sum.nonAcademic.izin,
    sum.nonAcademic.alpa,
    sum.nonAcademic.catatan_wali,
  ]);

  const ws = XLSX.utils.aoa_to_sheet([
    [settings.yayasan],
    [settings.nama_madrasah],
    [
      `LEGER NILAI RAPORT - ${selectedClass?.name || ''} · Semester ${settings.semester} · Th. Pelajaran ${settings.tahun_pelajaran}`,
    ],
    [`Wali Kelas: ${selectedClass?.wali_kelas_name || '-'}`],
    [],
    headerRow,
    ...dataRows,
  ]);

  ws['!cols'] = [
    { wch: 5 },
    { wch: 15 },
    { wch: 28 },
    { wch: 6 },
    { wch: 6 },
    ...sortedSubjects.map(() => ({ wch: 16 })),
    { wch: 13 },
    { wch: 11 },
    { wch: 10 },
    { wch: 7 },
    { wch: 7 },
    { wch: 7 },
    { wch: 42 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'Leger_Nilai');
  const safeClass = (selectedClass?.name || 'Kelas').replace(/\s+/g, '_');
  XLSX.writeFile(
    wb,
    `Leger_Nilai_${safeClass}_${settings.semester}_${settings.tahun_pelajaran.replace('/', '-')}.xlsx`
  );
}
