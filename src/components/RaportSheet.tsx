import { useState } from 'react';
import { getPredicate } from '../lib/grading';
import type {
  MadrasahClass,
  MadrasahSettings,
  StudentLegerSummary,
  Subject,
} from '../types';

interface RaportSheetProps {
  summary: StudentLegerSummary;
  totalStudentsInClass: number;
  subjects: Subject[];
  madrasahClass: MadrasahClass | undefined;
  settings: MadrasahSettings;
  isLast?: boolean;
}

export function RaportSheet({
  summary,
  totalStudentsInClass,
  subjects,
  madrasahClass,
  settings,
  isLast = true,
}: RaportSheetProps) {
  const [logoError, setLogoError] = useState(false);

  const pengetahuanSubjects = [...subjects]
    .filter((s) => s.category === 'Pengetahuan')
    .sort((a, b) => a.sort_order - b.sort_order);

  const praktikSubjects = [...subjects]
    .filter((s) => s.category === 'Praktik')
    .sort((a, b) => a.sort_order - b.sort_order);

  const paperWidthClass =
    settings.ukuran_kertas === 'F4' ? 'max-w-[215mm]' : 'max-w-[210mm]';

  const formatDays = (count: number | undefined) => {
    const val = count ?? 0;
    return val > 0 ? `${val} hari` : '-';
  };

  return (
    <div className="space-y-8 print:space-y-0 text-slate-900">
      {/* ==================== HALAMAN 1: KOP, IDENTITAS, SIKAP & PENGETAHUAN ==================== */}
      <article
        className={`raport-page bg-white mx-auto w-full ${paperWidthClass} border border-slate-200 rounded-sm shadow-sm px-7 py-8 sm:px-11 sm:py-10 flex flex-col justify-between min-h-[275mm] print:min-h-[274mm] raport-page-break`}
      >
        <div>
          {/* KOP MADRASAH (Seimbang Tengah Penuh) */}
          <header className="flex items-center gap-4 pb-3 border-b-[3px] border-double border-emerald-900">
            <div className="w-[74px] h-[74px] shrink-0 flex items-center justify-center">
              {!logoError ? (
                <img
                  src="/assets/aistudio/Desain_tanpa_judul_20261118_152836_0000_ef69cfc5.png"
                  alt="Logo MDTU At-Taqwa '03 Cibeureum"
                  referrerPolicy="no-referrer"
                  onError={() => setLogoError(true)}
                  className="w-[74px] h-[74px] object-contain"
                />
              ) : (
                <div className="w-[70px] h-[70px] rounded-full border-2 border-emerald-800 bg-emerald-50 flex items-center justify-center text-emerald-950 font-display font-bold text-[10px] text-center leading-tight p-1">
                  MDTU AT-TAQWA
                </div>
              )}
            </div>

            <div className="flex-1 text-center leading-snug">
              <p className="font-display text-[10.5px] font-semibold tracking-[0.08em] uppercase text-slate-700">
                {settings.yayasan}
              </p>
              <h2 className="font-display text-[16px] sm:text-[18px] font-bold tracking-tight uppercase text-emerald-900 mt-0.5">
                {settings.nama_madrasah}
              </h2>
              <p className="font-display text-[10.5px] font-semibold tracking-[0.1em] uppercase text-amber-800 mt-0.5">
                {settings.sub_madrasah || 'AHLUS SUNNAH WAL JAMA’AH (ASWAJA)'}
              </p>
              <p className="text-[10px] text-slate-600 mt-1">
                Sekretariat: {settings.alamat}, {settings.kecamatan},{' '}
                {settings.kabupaten}
              </p>
            </div>

            {/* Penyeimbang kanan agar judul kop tepat berada di sumbu tengah kertas */}
            <div className="hidden sm:block print:block w-[74px] shrink-0" />
          </header>

          {/* JUDUL RAPORT */}
          <div className="text-center mt-4 mb-4">
            <h3 className="font-display text-[13.5px] font-bold uppercase tracking-[0.14em] text-slate-950">
              CAPAIAN HASIL BELAJAR SANTRI
            </h3>
            <div className="w-24 h-[2px] bg-emerald-800 mx-auto mt-1.5" />
          </div>

          {/* IDENTITAS SANTRI (Grid Seimbang 3x3) */}
          <section className="raport-avoid-break bg-slate-50/80 border border-slate-300 rounded px-4 py-2.5 mb-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-x-8 gap-y-1 text-[11px]">
              <table className="w-full table-fixed">
                <tbody>
                  <tr>
                    <td className="py-[3px] w-[90px] text-slate-600 font-medium">
                      Nama Santri
                    </td>
                    <td className="py-[3px] w-3 text-slate-500">:</td>
                    <td className="py-[3px] font-display font-bold uppercase text-slate-950 tracking-tight">
                      {summary.student.full_name}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-[3px] text-slate-600 font-medium">
                      Nomor Induk
                    </td>
                    <td className="py-[3px] text-slate-500">:</td>
                    <td className="py-[3px] font-mono tabular-nums font-medium text-slate-900">
                      {summary.student.nis || '-'}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-[3px] text-slate-600 font-medium">
                      Kelas
                    </td>
                    <td className="py-[3px] text-slate-500">:</td>
                    <td className="py-[3px] font-semibold text-slate-900">
                      {madrasahClass?.name || '-'}
                    </td>
                  </tr>
                </tbody>
              </table>

              <table className="w-full table-fixed">
                <tbody>
                  <tr>
                    <td className="py-[3px] w-[96px] text-slate-600 font-medium">
                      Semester
                    </td>
                    <td className="py-[3px] w-3 text-slate-500">:</td>
                    <td className="py-[3px] font-semibold text-slate-950">
                      {settings.semester}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-[3px] text-slate-600 font-medium">
                      Th. Pelajaran
                    </td>
                    <td className="py-[3px] text-slate-500">:</td>
                    <td className="py-[3px] font-mono tabular-nums font-semibold text-slate-950">
                      {settings.tahun_pelajaran}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-[3px] text-slate-600 font-medium">
                      Wali Kelas
                    </td>
                    <td className="py-[3px] text-slate-500">:</td>
                    <td className="py-[3px] font-medium text-slate-900 truncate">
                      {madrasahClass?.wali_kelas_name || '-'}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* A. SIKAP */}
          <section className="raport-avoid-break mb-5">
            <h4 className="font-display text-[11.5px] font-bold tracking-[0.04em] uppercase text-emerald-950 mb-1.5">
              A. SIKAP
            </h4>

            <table className="w-full table-fixed text-[10.5px] border border-slate-700 border-collapse">
              <colgroup>
                <col className="w-[20%]" />
                <col className="w-[22%]" />
                <col className="w-[58%]" />
              </colgroup>
              <thead>
                <tr className="bg-[#F4DF9C] text-slate-950">
                  <th className="border border-slate-700 px-2.5 py-1.5 text-left font-display font-bold uppercase tracking-wider text-[10px]">
                    Aspek Sikap
                  </th>
                  <th className="border border-slate-700 px-2.5 py-1.5 text-center font-display font-bold uppercase tracking-wider text-[10px]">
                    Predikat
                  </th>
                  <th className="border border-slate-700 px-3 py-1.5 text-left font-display font-bold uppercase tracking-wider text-[10px]">
                    Deskripsi Capaian
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-700 px-2.5 py-2.5 font-display font-bold text-slate-900 align-middle bg-slate-50/50">
                    Sikap Spiritual
                  </td>
                  <td className="border border-slate-700 px-2.5 py-2.5 text-center font-semibold text-slate-900 align-middle leading-snug">
                    {summary.nonAcademic.sikap_spiritual}
                  </td>
                  <td className="border border-slate-700 px-3 py-2.5 text-left text-slate-800 align-middle leading-relaxed">
                    {summary.nonAcademic.akhlak_catatan}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-700 px-2.5 py-2.5 font-display font-bold text-slate-900 align-middle bg-slate-50/50">
                    Sikap Sosial
                  </td>
                  <td className="border border-slate-700 px-2.5 py-2.5 text-center font-semibold text-slate-900 align-middle leading-snug">
                    {summary.nonAcademic.sikap_sosial}
                  </td>
                  <td className="border border-slate-700 px-3 py-2.5 text-left text-slate-800 align-middle leading-relaxed">
                    {summary.nonAcademic.sosial_catatan}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* B. PENGETAHUAN */}
          <section className="raport-avoid-break mb-4">
            <h4 className="font-display text-[11.5px] font-bold tracking-[0.04em] uppercase text-emerald-950 mb-1.5">
              B. PENGETAHUAN
            </h4>
            <table className="w-full table-fixed text-[10.5px] border border-slate-700 border-collapse">
              <colgroup>
                <col className="w-[6%]" />
                <col className="w-[37%]" />
                <col className="w-[8%]" />
                <col className="w-[9%]" />
                <col className="w-[8%]" />
                <col className="w-[32%]" />
              </colgroup>
              <thead>
                <tr className="bg-[#0B4F3A] text-white">
                  <th className="border border-slate-700 px-1.5 py-2 text-center font-display font-bold uppercase tracking-wider text-[10px]">
                    No
                  </th>
                  <th className="border border-slate-700 px-2.5 py-2 text-left font-display font-bold uppercase tracking-wider text-[10px]">
                    Mata Pelajaran
                  </th>
                  <th className="border border-slate-700 px-1.5 py-2 text-center font-display font-bold uppercase tracking-wider text-[10px]">
                    KKM
                  </th>
                  <th className="border border-slate-700 px-1.5 py-2 text-center font-display font-bold uppercase tracking-wider text-[10px]">
                    Angka
                  </th>
                  <th className="border border-slate-700 px-1.5 py-2 text-center font-display font-bold uppercase tracking-wider text-[10px]">
                    Pred
                  </th>
                  <th className="border border-slate-700 px-3 py-2 text-left font-display font-bold uppercase tracking-wider text-[10px]">
                    Deskripsi Capaian
                  </th>
                </tr>
              </thead>
              <tbody>
                {pengetahuanSubjects.map((subj, idx) => {
                  const grade = summary.gradesBySubject[subj.id];
                  const score = grade?.final_score ?? 0;
                  const pred = getPredicate(score, subj.kkm);
                  const hasScore = score > 0;
                  const isBelow = hasScore && score < subj.kkm;
                  return (
                    <tr
                      key={subj.id}
                      className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}
                    >
                      <td className="border border-slate-700 px-1.5 py-2 text-center font-mono tabular-nums text-slate-700 align-middle">
                        {idx + 1}
                      </td>
                      <td className="border border-slate-700 px-2.5 py-2 align-middle leading-snug">
                        <div className="font-display font-bold text-slate-950 text-[10.5px]">
                          {subj.name}
                        </div>
                        <div className="text-[9.5px] text-slate-600 mt-0.5">
                          Guru: {subj.teacher_name || '-'}
                        </div>
                      </td>
                      <td className="border border-slate-700 px-1.5 py-2 text-center font-mono tabular-nums font-medium text-slate-700 align-middle">
                        {subj.kkm}
                      </td>
                      <td
                        className={`border border-slate-700 px-1.5 py-2 text-center font-mono tabular-nums font-bold align-middle ${
                          isBelow ? 'text-red-700' : 'text-slate-950'
                        }`}
                      >
                        {hasScore ? score : '-'}
                      </td>
                      <td className="border border-slate-700 px-1.5 py-2 text-center font-display font-bold text-slate-900 align-middle">
                        {hasScore ? grade?.predicate || pred.letter : '-'}
                      </td>
                      <td className="border border-slate-700 px-3 py-2 text-left text-slate-800 align-middle leading-snug">
                        {hasScore ? grade?.description || pred.arabicTerm : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>

        <footer className="border-t border-slate-300 pt-2.5 mt-4 flex items-center justify-between text-[10px] text-slate-600">
          <span className="font-display font-semibold text-slate-800">
            1 | Capaian Hasil Belajar Santri
          </span>
          <span className="font-mono tabular-nums">
            {summary.student.full_name} · {madrasahClass?.name || '-'} ·{' '}
            {settings.tahun_pelajaran}
          </span>
        </footer>
      </article>

      {/* ==================== HALAMAN 2: PRAKTIK, REKAP, ABSENSI, PESAN WALAS & TANDA TANGAN ==================== */}
      <article
        className={`raport-page bg-white mx-auto w-full ${paperWidthClass} border border-slate-200 rounded-sm shadow-sm px-7 py-8 sm:px-11 sm:py-10 flex flex-col justify-between min-h-[275mm] print:min-h-[274mm] ${
          !isLast ? 'raport-page-break' : ''
        }`}
      >
        <div>
          {/* C. PRAKTIK */}
          <section className="raport-avoid-break mb-5">
            <h4 className="font-display text-[11.5px] font-bold tracking-[0.04em] uppercase text-emerald-950 mb-1.5">
              C. PRAKTIK
            </h4>
            <table className="w-full table-fixed text-[10.5px] border border-slate-700 border-collapse">
              <colgroup>
                <col className="w-[6%]" />
                <col className="w-[37%]" />
                <col className="w-[8%]" />
                <col className="w-[9%]" />
                <col className="w-[8%]" />
                <col className="w-[32%]" />
              </colgroup>
              <thead>
                <tr className="bg-[#0B4F3A] text-white">
                  <th className="border border-slate-700 px-1.5 py-2 text-center font-display font-bold uppercase tracking-wider text-[10px]">
                    No
                  </th>
                  <th className="border border-slate-700 px-2.5 py-2 text-left font-display font-bold uppercase tracking-wider text-[10px]">
                    Materi Praktik
                  </th>
                  <th className="border border-slate-700 px-1.5 py-2 text-center font-display font-bold uppercase tracking-wider text-[10px]">
                    KKM
                  </th>
                  <th className="border border-slate-700 px-1.5 py-2 text-center font-display font-bold uppercase tracking-wider text-[10px]">
                    Angka
                  </th>
                  <th className="border border-slate-700 px-1.5 py-2 text-center font-display font-bold uppercase tracking-wider text-[10px]">
                    Pred
                  </th>
                  <th className="border border-slate-700 px-3 py-2 text-left font-display font-bold uppercase tracking-wider text-[10px]">
                    Deskripsi Capaian
                  </th>
                </tr>
              </thead>
              <tbody>
                {praktikSubjects.map((subj, idx) => {
                  const grade = summary.gradesBySubject[subj.id];
                  const score = grade?.final_score ?? 0;
                  const pred = getPredicate(score, subj.kkm);
                  const hasScore = score > 0;
                  const isBelow = hasScore && score < subj.kkm;
                  return (
                    <tr
                      key={subj.id}
                      className={idx % 2 === 1 ? 'bg-slate-50/70' : 'bg-white'}
                    >
                      <td className="border border-slate-700 px-1.5 py-2.5 text-center font-mono tabular-nums text-slate-700 align-middle">
                        {idx + 1}
                      </td>
                      <td className="border border-slate-700 px-2.5 py-2.5 align-middle leading-snug">
                        <div className="font-display font-bold text-slate-950 text-[10.5px]">
                          {subj.name}
                        </div>
                        {subj.teacher_name && (
                          <div className="text-[9.5px] text-slate-600 mt-0.5">
                            Guru: {subj.teacher_name}
                          </div>
                        )}
                      </td>
                      <td className="border border-slate-700 px-1.5 py-2.5 text-center font-mono tabular-nums font-medium text-slate-700 align-middle">
                        {subj.kkm}
                      </td>
                      <td
                        className={`border border-slate-700 px-1.5 py-2.5 text-center font-mono tabular-nums font-bold align-middle ${
                          isBelow ? 'text-red-700' : 'text-slate-950'
                        }`}
                      >
                        {hasScore ? score : '-'}
                      </td>
                      <td className="border border-slate-700 px-1.5 py-2.5 text-center font-display font-bold text-slate-900 align-middle">
                        {hasScore ? grade?.predicate || pred.letter : '-'}
                      </td>
                      <td className="border border-slate-700 px-3 py-2.5 text-left text-slate-800 align-middle leading-snug">
                        {hasScore ? grade?.description || '-' : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/* RINGKASAN CAPAIAN AKADEMIK */}
          <section className="raport-avoid-break mb-6">
            <div className="grid grid-cols-3 border border-slate-700 bg-slate-50/80 text-[10.5px]">
              <div className="px-3 py-2 border-r border-slate-700 flex items-center justify-between">
                <span className="font-medium text-slate-600">Jumlah Nilai</span>
                <span className="font-mono tabular-nums font-bold text-slate-950">
                  {summary.totalScore}
                </span>
              </div>
              <div className="px-3 py-2 border-r border-slate-700 flex items-center justify-between">
                <span className="font-medium text-slate-600">Rata-Rata</span>
                <span className="font-mono tabular-nums font-bold text-emerald-900">
                  {summary.averageScore.toFixed(1)}
                </span>
              </div>
              <div className="px-3 py-2 flex items-center justify-between">
                <span className="font-medium text-slate-600">
                  Peringkat Kelas
                </span>
                <span className="font-mono tabular-nums font-bold text-slate-950">
                  #{summary.rank} / {totalStudentsInClass}
                </span>
              </div>
            </div>
          </section>

          {/* ABSENSI, PESAN WALI KELAS & TANGGAPAN ORANGTUA/WALI */}
          <section className="raport-avoid-break mb-10">
            <h4 className="font-display text-[11.5px] font-bold tracking-[0.04em] uppercase text-emerald-950 mb-1.5">
              D. KETIDAKHADIRAN & CATATAN
            </h4>
            <table className="w-full table-fixed text-[10.5px] border border-slate-700 border-collapse">
              <colgroup>
                <col className="w-[19%]" />
                <col className="w-[9%]" />
                <col className="w-[38%]" />
                <col className="w-[34%]" />
              </colgroup>
              <thead>
                <tr className="bg-[#F4DF9C] text-slate-950">
                  <th
                    colSpan={2}
                    className="border border-slate-700 px-2.5 py-1.5 text-center font-display font-bold uppercase tracking-wider text-[10px]"
                  >
                    Absensi
                  </th>
                  <th className="border border-slate-700 px-3 py-1.5 text-center font-display font-bold uppercase tracking-wider text-[10px]">
                    Pesan Wali Kelas
                  </th>
                  <th className="border border-slate-700 px-3 py-1.5 text-center font-display font-bold uppercase tracking-wider text-[10px]">
                    Tanggapan Orangtua / Wali
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-slate-700 px-2.5 py-2.5 font-medium text-slate-800">
                    Sakit
                  </td>
                  <td className="border border-slate-700 px-2 py-2.5 text-center font-mono tabular-nums font-semibold text-slate-900">
                    {formatDays(summary.nonAcademic.sakit)}
                  </td>
                  <td
                    rowSpan={3}
                    className="border border-slate-700 px-3.5 py-3 text-left text-slate-800 leading-relaxed align-middle"
                  >
                    {summary.nonAcademic.catatan_wali || '-'}
                  </td>
                  <td
                    rowSpan={3}
                    className="border border-slate-700 px-3.5 py-3 align-middle"
                  >
                    <div className="space-y-4 py-1">
                      <div className="border-b border-dotted border-slate-300" />
                      <div className="border-b border-dotted border-slate-300" />
                      <div className="border-b border-dotted border-slate-300" />
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-700 px-2.5 py-2.5 font-medium text-slate-800">
                    Izin
                  </td>
                  <td className="border border-slate-700 px-2 py-2.5 text-center font-mono tabular-nums font-semibold text-slate-900">
                    {formatDays(summary.nonAcademic.izin)}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-700 px-2.5 py-2.5 font-medium text-slate-800">
                    Tanpa Keterangan
                  </td>
                  <td className="border border-slate-700 px-2 py-2.5 text-center font-mono tabular-nums font-semibold text-slate-900">
                    {formatDays(summary.nonAcademic.alpa)}
                  </td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* TANDA TANGAN 3 KOLOM */}
          <section className="raport-avoid-break text-[11px] pt-2">
            <div className="grid grid-cols-3 gap-6 text-center mb-1">
              <div />
              <div />
              <div className="text-slate-800 font-medium">
                {settings.tempat_cetak}, {settings.tanggal_raport}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 text-center">
              <div className="flex flex-col items-center">
                <p className="invisible">Mengetahui,</p>
                <p className="text-slate-800">Orangtua / Wali,</p>
                <div className="h-16" />
                <p className="font-medium text-slate-700 tracking-wide">
                  ( ........................................ )
                </p>
              </div>

              <div className="flex flex-col items-center">
                <p className="text-slate-700">Mengetahui,</p>
                <p className="text-slate-800">Kepala Madrasah,</p>
                <div className="h-16" />
                <p className="font-display font-bold text-slate-950 underline underline-offset-4 decoration-slate-400">
                  {settings.kepala_madrasah}
                </p>
                <p className="text-[9.5px] font-mono tabular-nums text-slate-600 mt-1">
                  {settings.nip_kepala}
                </p>
              </div>

              <div className="flex flex-col items-center">
                <p className="invisible">Mengetahui,</p>
                <p className="text-slate-800">Wali Kelas,</p>
                <div className="h-16" />
                <p className="font-display font-bold text-slate-950 underline underline-offset-4 decoration-slate-400">
                  {madrasahClass?.wali_kelas_name || '-'}
                </p>
                {madrasahClass?.wali_kelas_nip &&
                  madrasahClass.wali_kelas_nip !== '-' && (
                    <p className="text-[9.5px] font-mono tabular-nums text-slate-600 mt-1">
                      {madrasahClass.wali_kelas_nip}
                    </p>
                  )}
              </div>
            </div>
          </section>
        </div>

        <footer className="border-t border-slate-300 pt-2.5 mt-4 flex items-center justify-between text-[10px] text-slate-600">
          <span className="font-display font-semibold text-slate-800">
            2 | Capaian Hasil Belajar Santri
          </span>
          <span className="font-mono tabular-nums">
            {summary.student.full_name} · {madrasahClass?.name || '-'} ·{' '}
            {settings.tahun_pelajaran}
          </span>
        </footer>
      </article>
    </div>
  );
}
