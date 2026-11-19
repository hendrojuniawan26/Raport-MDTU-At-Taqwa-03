import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  MadrasahClass,
  MadrasahSettings,
  StudentLegerSummary,
  Subject,
} from '../types';
import { getPredicate } from './grading';

function getPageDimensions(paper: 'F4' | 'A4'): [number, number] {
  return paper === 'F4' ? [215, 330] : [210, 297];
}

const LOGO_URL =
  '/assets/aistudio/Desain_tanpa_judul_20261118_152836_0000_ef69cfc5.png';

let cachedLogoDataUrl: string | null = null;

async function getLogoDataUrl(): Promise<string | null> {
  if (cachedLogoDataUrl) return cachedLogoDataUrl;
  try {
    const res = await fetch(LOGO_URL);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Failed to read logo'));
      reader.readAsDataURL(blob);
    });
    cachedLogoDataUrl = dataUrl;
    return dataUrl;
  } catch {
    return null;
  }
}

const EMERALD_DARK: [number, number, number] = [11, 79, 58]; // #0B4F3A
const GOLD_SOFT: [number, number, number] = [244, 223, 156]; // #F4DF9C
const SLATE_TEXT: [number, number, number] = [15, 23, 42]; // #0F172A
const SLATE_MUTED: [number, number, number] = [71, 85, 105]; // #475569
const BORDER_COLOR: [number, number, number] = [51, 65, 85]; // #334155
const ZEBRA_BG: [number, number, number] = [248, 250, 252]; // #F8FAFC

function formatDays(count: number | undefined): string {
  const val = count ?? 0;
  return val > 0 ? `${val} hari` : '-';
}

function drawFooter(
  doc: jsPDF,
  pageNumber: number,
  summary: StudentLegerSummary,
  madrasahClass: MadrasahClass | undefined,
  settings: MadrasahSettings
): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 13;
  const footerY = pageHeight - 10;

  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.25);
  doc.line(marginX, footerY - 4, pageWidth - marginX, footerY - 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.2);
  doc.setTextColor(...SLATE_TEXT);
  doc.text(
    `${pageNumber} | Capaian Hasil Belajar Santri`,
    marginX,
    footerY
  );

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...SLATE_MUTED);
  doc.text(
    `${summary.student.full_name}  ·  ${madrasahClass?.name || '-'}  ·  ${settings.tahun_pelajaran}`,
    pageWidth - marginX,
    footerY,
    { align: 'right' }
  );
}

function renderStudentTwoPageRaport(
  doc: jsPDF,
  summary: StudentLegerSummary,
  totalStudentsInClass: number,
  subjects: Subject[],
  madrasahClass: MadrasahClass | undefined,
  settings: MadrasahSettings,
  logoDataUrl: string | null
): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 13;
  const contentWidth = pageWidth - marginX * 2;
  let y = 14;

  // ==================== HALAMAN 1 ====================
  // Logo Madrasah (kiri) & Teks Kop tepat di sumbu tengah kertas
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', marginX, 10, 20, 20);
    } catch {
      // Abaikan jika gagal memuat gambar
    }
  }
  const kopCenterX = pageWidth / 2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_MUTED);
  doc.text(settings.yayasan.toUpperCase(), kopCenterX, y, {
    align: 'center',
  });
  y += 5.2;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(6, 78, 59); // Emerald 900
  doc.text(settings.nama_madrasah.toUpperCase(), kopCenterX, y, {
    align: 'center',
  });
  y += 4.8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(146, 64, 14); // Amber 800
  doc.text(
    (settings.sub_madrasah || 'AHLUS SUNNAH WAL JAMA’AH (ASWAJA)').toUpperCase(),
    kopCenterX,
    y,
    { align: 'center' }
  );
  y += 4.4;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...SLATE_MUTED);
  doc.text(
    `Sekretariat: ${settings.alamat}, ${settings.kecamatan}, ${settings.kabupaten}`,
    kopCenterX,
    y,
    { align: 'center' }
  );
  y += 3.5;

  // Garis Ganda Resmi Kop
  doc.setDrawColor(6, 78, 59);
  doc.setLineWidth(0.8);
  doc.line(marginX, y, pageWidth - marginX, y);
  doc.setDrawColor(148, 163, 184);
  doc.setLineWidth(0.25);
  doc.line(marginX, y + 1.1, pageWidth - marginX, y + 1.1);
  y += 8;

  // Judul Dokumen
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...SLATE_TEXT);
  doc.text('CAPAIAN HASIL BELAJAR SANTRI', kopCenterX, y, {
    align: 'center',
  });
  doc.setDrawColor(6, 78, 59);
  doc.setLineWidth(0.6);
  doc.line(kopCenterX - 14, y + 1.8, kopCenterX + 14, y + 1.8);
  y += 6.5;

  // Kotak Identitas Santri Seimbang 3x3
  const boxHeight = 20;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.setLineWidth(0.25);
  doc.roundedRect(marginX, y, contentWidth, boxHeight, 1.5, 1.5, 'FD');

  const idStartY = y + 5.2;
  const leftX = marginX + 4;
  const rightX = marginX + contentWidth / 2 + 4;

  const leftRows: [string, string][] = [
    ['Nama Santri', summary.student.full_name.toUpperCase()],
    ['Nomor Induk', summary.student.nis || '-'],
    ['Kelas', madrasahClass?.name || '-'],
  ];
  const rightRows: [string, string][] = [
    ['Semester', settings.semester],
    ['Th. Pelajaran', settings.tahun_pelajaran],
    ['Wali Kelas', madrasahClass?.wali_kelas_name || '-'],
  ];

  doc.setFontSize(8.5);
  leftRows.forEach(([label, value], i) => {
    const rowY = idStartY + i * 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE_MUTED);
    doc.text(label, leftX, rowY);
    doc.text(':', leftX + 24, rowY);
    doc.setFont('helvetica', i === 0 ? 'bold' : 'normal');
    doc.setTextColor(...SLATE_TEXT);
    doc.text(value, leftX + 27, rowY, { maxWidth: contentWidth / 2 - 33 });
  });

  rightRows.forEach(([label, value], i) => {
    const rowY = idStartY + i * 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SLATE_MUTED);
    doc.text(label, rightX, rowY);
    doc.text(':', rightX + 25, rowY);
    doc.setFont('helvetica', i < 2 ? 'bold' : 'normal');
    doc.setTextColor(...SLATE_TEXT);
    doc.text(value, rightX + 28, rowY, { maxWidth: contentWidth / 2 - 34 });
  });

  y += boxHeight + 6;

  // A. SIKAP (Tabel 3 Kolom Terpadu)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(6, 78, 59);
  doc.text('A. SIKAP', marginX, y);
  y += 2.2;

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['ASPEK SIKAP', 'PREDIKAT', 'DESKRIPSI CAPAIAN']],
    body: [
      [
        {
          content: 'Sikap Spiritual',
          styles: {
            fontStyle: 'bold',
            fillColor: [248, 250, 252],
            halign: 'left',
          },
        },
        {
          content: summary.nonAcademic.sikap_spiritual,
          styles: { fontStyle: 'bold', halign: 'center' },
        },
        {
          content: summary.nonAcademic.akhlak_catatan,
          styles: { halign: 'left' },
        },
      ],
      [
        {
          content: 'Sikap Sosial',
          styles: {
            fontStyle: 'bold',
            fillColor: [248, 250, 252],
            halign: 'left',
          },
        },
        {
          content: summary.nonAcademic.sikap_sosial,
          styles: { fontStyle: 'bold', halign: 'center' },
        },
        {
          content: summary.nonAcademic.sosial_catatan,
          styles: { halign: 'left' },
        },
      ],
    ],
    theme: 'grid',
    styles: {
      fontSize: 8.2,
      cellPadding: 2.6,
      lineColor: BORDER_COLOR,
      lineWidth: 0.2,
      textColor: SLATE_TEXT,
      valign: 'middle',
    },
    headStyles: {
      fillColor: GOLD_SOFT,
      textColor: SLATE_TEXT,
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.2, halign: 'left' },
      1: { cellWidth: contentWidth * 0.22, halign: 'center' },
      2: { cellWidth: contentWidth * 0.58, halign: 'left' },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 6;

  // B. PENGETAHUAN (Lebar kolom identik dengan C. PRAKTIK)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(6, 78, 59);
  doc.text('B. PENGETAHUAN', marginX, y);
  y += 2.2;

  const pengetahuanSubjects = [...subjects]
    .filter((s) => s.category === 'Pengetahuan')
    .sort((a, b) => a.sort_order - b.sort_order);

  const pengetahuanRows = pengetahuanSubjects.map((subj, idx) => {
    const grade = summary.gradesBySubject[subj.id];
    const score = grade?.final_score ?? 0;
    const pred = getPredicate(score, subj.kkm);
    const hasScore = score > 0;
    const isBelow = hasScore && score < subj.kkm;
    return [
      String(idx + 1),
      `${subj.name}\nGuru: ${subj.teacher_name || '-'}`,
      String(subj.kkm),
      {
        content: hasScore ? String(score) : '-',
        styles: {
          textColor: isBelow ? ([185, 28, 28] as [number, number, number]) : SLATE_TEXT,
          fontStyle: 'bold' as const,
        },
      },
      hasScore ? grade?.predicate || pred.letter : '-',
      hasScore ? grade?.description || pred.arabicTerm : '-',
    ];
  });

  const colWidths = {
    no: contentWidth * 0.06,
    mapel: contentWidth * 0.37,
    kkm: contentWidth * 0.08,
    angka: contentWidth * 0.09,
    pred: contentWidth * 0.08,
    desk: contentWidth * 0.32,
  };

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['NO', 'MATA PELAJARAN', 'KKM', 'ANGKA', 'PRED', 'DESKRIPSI CAPAIAN']],
    body: pengetahuanRows,
    theme: 'grid',
    alternateRowStyles: { fillColor: ZEBRA_BG },
    styles: {
      fontSize: 8.2,
      cellPadding: 2.5,
      lineColor: BORDER_COLOR,
      lineWidth: 0.2,
      textColor: SLATE_TEXT,
      valign: 'middle',
    },
    headStyles: {
      fillColor: EMERALD_DARK,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: colWidths.no, halign: 'center' },
      1: { cellWidth: colWidths.mapel, halign: 'left' },
      2: { cellWidth: colWidths.kkm, halign: 'center' },
      3: { cellWidth: colWidths.angka, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: colWidths.pred, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: colWidths.desk, halign: 'left' },
    },
    didParseCell(data) {
      if (data.section === 'head') {
        if (data.column.index === 1 || data.column.index === 5) {
          data.cell.styles.halign = 'left';
        } else {
          data.cell.styles.halign = 'center';
        }
      }
      if (data.section === 'body' && data.column.index === 1) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  drawFooter(doc, 1, summary, madrasahClass, settings);

  // ==================== HALAMAN 2 ====================
  doc.addPage(getPageDimensions(settings.ukuran_kertas), 'portrait');
  y = 16;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(6, 78, 59);
  doc.text('C. PRAKTIK', marginX, y);
  y += 2.2;

  const praktikSubjects = [...subjects]
    .filter((s) => s.category === 'Praktik')
    .sort((a, b) => a.sort_order - b.sort_order);

  const praktikRows = praktikSubjects.map((subj, idx) => {
    const grade = summary.gradesBySubject[subj.id];
    const score = grade?.final_score ?? 0;
    const pred = getPredicate(score, subj.kkm);
    const hasScore = score > 0;
    const isBelow = hasScore && score < subj.kkm;
    const label = subj.teacher_name
      ? `${subj.name}\nGuru: ${subj.teacher_name}`
      : subj.name;
    return [
      String(idx + 1),
      label,
      String(subj.kkm),
      {
        content: hasScore ? String(score) : '-',
        styles: {
          textColor: isBelow ? ([185, 28, 28] as [number, number, number]) : SLATE_TEXT,
          fontStyle: 'bold' as const,
        },
      },
      hasScore ? grade?.predicate || pred.letter : '-',
      hasScore ? grade?.description || '-' : '-',
    ];
  });

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [['NO', 'MATERI PRAKTIK', 'KKM', 'ANGKA', 'PRED', 'DESKRIPSI CAPAIAN']],
    body: praktikRows,
    theme: 'grid',
    alternateRowStyles: { fillColor: ZEBRA_BG },
    styles: {
      fontSize: 8.2,
      cellPadding: 2.6,
      lineColor: BORDER_COLOR,
      lineWidth: 0.2,
      textColor: SLATE_TEXT,
      valign: 'middle',
    },
    headStyles: {
      fillColor: EMERALD_DARK,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: colWidths.no, halign: 'center' },
      1: { cellWidth: colWidths.mapel, halign: 'left' },
      2: { cellWidth: colWidths.kkm, halign: 'center' },
      3: { cellWidth: colWidths.angka, halign: 'center', fontStyle: 'bold' },
      4: { cellWidth: colWidths.pred, halign: 'center', fontStyle: 'bold' },
      5: { cellWidth: colWidths.desk, halign: 'left' },
    },
    didParseCell(data) {
      if (data.section === 'head') {
        if (data.column.index === 1 || data.column.index === 5) {
          data.cell.styles.halign = 'left';
        } else {
          data.cell.styles.halign = 'center';
        }
      }
      if (data.section === 'body' && data.column.index === 1) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 5;

  // Ringkasan Capaian Akademik (3 kolom sejajar)
  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    body: [
      [
        `Jumlah Nilai :  ${summary.totalScore}`,
        `Rata-Rata Nilai :  ${summary.averageScore.toFixed(1)}`,
        `Peringkat Kelas :  #${summary.rank} dari ${totalStudentsInClass} Santri`,
      ],
    ],
    theme: 'grid',
    styles: {
      fontSize: 8.2,
      cellPadding: 2.4,
      fillColor: [248, 250, 252],
      lineColor: BORDER_COLOR,
      lineWidth: 0.2,
      textColor: SLATE_TEXT,
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: contentWidth / 3 },
      1: { cellWidth: contentWidth / 3, textColor: [6, 78, 59] },
      2: { cellWidth: contentWidth / 3 },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 7;

  // D. KETIDAKHADIRAN & CATATAN
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(6, 78, 59);
  doc.text('D. KETIDAKHADIRAN & CATATAN', marginX, y);
  y += 2.2;

  autoTable(doc, {
    startY: y,
    margin: { left: marginX, right: marginX },
    head: [
      [
        {
          content: 'ABSENSI',
          colSpan: 2,
          styles: {
            fillColor: GOLD_SOFT,
            textColor: SLATE_TEXT,
            halign: 'center',
            fontStyle: 'bold',
          },
        },
        {
          content: 'PESAN WALI KELAS',
          styles: {
            fillColor: GOLD_SOFT,
            textColor: SLATE_TEXT,
            halign: 'center',
            fontStyle: 'bold',
          },
        },
        {
          content: 'TANGGAPAN ORANGTUA / WALI',
          styles: {
            fillColor: GOLD_SOFT,
            textColor: SLATE_TEXT,
            halign: 'center',
            fontStyle: 'bold',
          },
        },
      ],
    ],
    body: [
      [
        'Sakit',
        {
          content: formatDays(summary.nonAcademic.sakit),
          styles: { halign: 'center', fontStyle: 'bold' },
        },
        {
          content: summary.nonAcademic.catatan_wali || '-',
          rowSpan: 3,
          styles: { halign: 'left', valign: 'middle' },
        },
        {
          content: '\n............................................\n\n............................................\n\n............................................',
          rowSpan: 3,
          styles: {
            halign: 'center',
            valign: 'middle',
            textColor: [148, 163, 184],
          },
        },
      ],
      [
        'Izin',
        {
          content: formatDays(summary.nonAcademic.izin),
          styles: { halign: 'center', fontStyle: 'bold' },
        },
      ],
      [
        'Tanpa Keterangan',
        {
          content: formatDays(summary.nonAcademic.alpa),
          styles: { halign: 'center', fontStyle: 'bold' },
        },
      ],
    ],
    theme: 'grid',
    styles: {
      fontSize: 8.2,
      cellPadding: 2.8,
      lineColor: BORDER_COLOR,
      lineWidth: 0.2,
      textColor: SLATE_TEXT,
      valign: 'middle',
    },
    headStyles: {
      fontSize: 8,
    },
    columnStyles: {
      0: { cellWidth: contentWidth * 0.19 },
      1: { cellWidth: contentWidth * 0.09 },
      2: { cellWidth: contentWidth * 0.38 },
      3: { cellWidth: contentWidth * 0.34 },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 12;

  // Blok Tanda Tangan 3 Kolom Sejajar
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(...SLATE_TEXT);

  const colW = contentWidth / 3;
  const leftSignX = marginX + colW * 0.5;
  const centerSignX = marginX + colW * 1.5;
  const rightSignX = marginX + colW * 2.5;

  doc.text(
    `${settings.tempat_cetak}, ${settings.tanggal_raport}`,
    rightSignX,
    y,
    { align: 'center' }
  );
  y += 4.8;

  doc.text('Mengetahui,', centerSignX, y, { align: 'center' });
  y += 4.5;

  doc.text('Orangtua / Wali,', leftSignX, y, { align: 'center' });
  doc.text('Kepala Madrasah,', centerSignX, y, { align: 'center' });
  doc.text('Wali Kelas,', rightSignX, y, { align: 'center' });

  y += 19;
  doc.setFont('helvetica', 'normal');
  doc.text('( ........................................ )', leftSignX, y, {
    align: 'center',
  });

  doc.setFont('helvetica', 'bold');
  doc.text(settings.kepala_madrasah, centerSignX, y, { align: 'center' });
  const kepW = doc.getTextWidth(settings.kepala_madrasah);
  doc.setDrawColor(...SLATE_MUTED);
  doc.setLineWidth(0.25);
  doc.line(centerSignX - kepW / 2, y + 0.9, centerSignX + kepW / 2, y + 0.9);

  const waliName = madrasahClass?.wali_kelas_name || '-';
  doc.text(waliName, rightSignX, y, { align: 'center' });
  const waliW = doc.getTextWidth(waliName);
  doc.line(rightSignX - waliW / 2, y + 0.9, rightSignX + waliW / 2, y + 0.9);

  y += 4.6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  doc.setTextColor(...SLATE_MUTED);
  doc.text(settings.nip_kepala || '', centerSignX, y, { align: 'center' });
  if (madrasahClass?.wali_kelas_nip && madrasahClass.wali_kelas_nip !== '-') {
    doc.text(madrasahClass.wali_kelas_nip, rightSignX, y, { align: 'center' });
  }

  drawFooter(doc, 2, summary, madrasahClass, settings);
}

export async function exportSingleRaportPdf(
  summary: StudentLegerSummary,
  totalStudentsInClass: number,
  subjects: Subject[],
  madrasahClass: MadrasahClass | undefined,
  settings: MadrasahSettings
): Promise<void> {
  const format = getPageDimensions(settings.ukuran_kertas);
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format,
  });

  const logoDataUrl = await getLogoDataUrl();
  renderStudentTwoPageRaport(
    doc,
    summary,
    totalStudentsInClass,
    subjects,
    madrasahClass,
    settings,
    logoDataUrl
  );

  const safeName = summary.student.full_name.replace(/[^a-zA-Z0-9]+/g, '_');
  doc.save(`Raport_${summary.student.nis || 'Santri'}_${safeName}.pdf`);
}

export async function exportClassRaportPdf(
  summaries: StudentLegerSummary[],
  subjects: Subject[],
  madrasahClass: MadrasahClass | undefined,
  settings: MadrasahSettings
): Promise<void> {
  if (summaries.length === 0) return;

  const format = getPageDimensions(settings.ukuran_kertas);
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format,
  });

  const logoDataUrl = await getLogoDataUrl();
  summaries.forEach((summary, idx) => {
    if (idx > 0) {
      doc.addPage(format, 'portrait');
    }
    renderStudentTwoPageRaport(
      doc,
      summary,
      summaries.length,
      subjects,
      madrasahClass,
      settings,
      logoDataUrl
    );
  });

  const safeClass = (madrasahClass?.name || 'Kelas').replace(/\s+/g, '_');
  doc.save(
    `Raport_Satu_Kelas_${safeClass}_${settings.semester}_${settings.tahun_pelajaran.replace('/', '-')}.pdf`
  );
}
