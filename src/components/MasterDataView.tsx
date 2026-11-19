import { BookOpen, Edit3, Plus, Search, Trash2, Users, School } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { getWaliClassIds } from '../lib/rbac';
import type { MadrasahClass, Student, Subject } from '../types';

type MasterSubTab = 'students' | 'classes' | 'subjects';

export function MasterDataView() {
  const {
    userProfile,
    classes,
    subjects,
    students,
    settings,
    globalSearchQuery: searchQuery,
    setGlobalSearchQuery: setSearchQuery,
    selectedStudentId,
    upsertStudent,
    deleteStudent,
    upsertClass,
    deleteClass,
    upsertSubject,
    deleteSubject,
    pushToast,
  } = useApp();

  const isAdmin = userProfile?.role === 'admin';
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

  const [subTab, setSubTab] = useState<MasterSubTab>('students');

  useEffect(() => {
    if (!isAdmin && subTab !== 'students') {
      setSubTab('students');
    }
  }, [isAdmin, subTab]);

  useEffect(() => {
    if (selectedStudentId) {
      setSubTab('students');
      setFilterClassId('all');
    }
  }, [selectedStudentId]);

  const [filterClassId, setFilterClassId] = useState<string>('all');

  // Student Modal
  const [studentModalOpen, setStudentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Partial<Student> | null>(
    null
  );

  // Class Modal
  const [classModalOpen, setClassModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Partial<MadrasahClass> | null>(
    null
  );

  // Subject Modal
  const [subjectModalOpen, setSubjectModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Partial<Subject> | null>(
    null
  );

  const sortedSubjects = useMemo(
    () => [...subjects].sort((a, b) => a.sort_order - b.sort_order),
    [subjects]
  );

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const allowedSet = new Set(accessibleClasses.map((c) => c.id));
    return students.filter((s) => {
      if (isWali && waliClassIds.length > 0 && !allowedSet.has(s.class_id)) {
        return false;
      }
      const matchClass = filterClassId === 'all' || s.class_id === filterClassId;
      const matchQuery =
        !q ||
        s.full_name.toLowerCase().includes(q) ||
        s.nis.toLowerCase().includes(q) ||
        s.parent_name.toLowerCase().includes(q);
      return matchClass && matchQuery;
    });
  }, [students, accessibleClasses, isWali, waliClassIds, filterClassId, searchQuery]);

  const classMap = useMemo(
    () => new Map(classes.map((c) => [c.id, c])),
    [classes]
  );

  const handleSaveStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent?.full_name || !editingStudent.nis || !editingStudent.class_id) {
      pushToast('error', 'NIS, Nama Santri, dan Kelas wajib diisi.');
      return;
    }
    await upsertStudent({
      id: editingStudent.id,
      nis: editingStudent.nis.trim(),
      nisn: (editingStudent.nisn || '').trim(),
      full_name: editingStudent.full_name.trim(),
      birth_place: (editingStudent.birth_place || 'Cibeureum').trim(),
      birth_date: editingStudent.birth_date || '',
      gender: (editingStudent.gender as 'L' | 'P') || 'L',
      parent_name: (editingStudent.parent_name || '-').trim(),
      address: (editingStudent.address || '-').trim(),
      class_id: editingStudent.class_id,
      status: (editingStudent.status as Student['status']) || 'Aktif',
    });
    setStudentModalOpen(false);
    setEditingStudent(null);
  };

  const handleSaveClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClass?.name || !editingClass.wali_kelas_name) {
      pushToast('error', 'Nama Kelas dan Wali Kelas wajib diisi.');
      return;
    }
    await upsertClass({
      id: editingClass.id,
      name: editingClass.name.trim(),
      level: Number(editingClass.level || 1),
      academic_year: editingClass.academic_year || settings.tahun_pelajaran,
      wali_kelas_name: editingClass.wali_kelas_name.trim(),
      wali_kelas_nip: (editingClass.wali_kelas_nip || '-').trim(),
    });
    setClassModalOpen(false);
    setEditingClass(null);
  };

  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject?.code || !editingSubject.name) {
      pushToast('error', 'Kode dan Nama Mata Pelajaran wajib diisi.');
      return;
    }
    await upsertSubject({
      id: editingSubject.id,
      code: editingSubject.code.trim().toUpperCase(),
      name: editingSubject.name.trim(),
      arabic_name: (editingSubject.arabic_name || '').trim(),
      teacher_name: (editingSubject.teacher_name || '-').trim(),
      category:
        (editingSubject.category as Subject['category']) || 'Pengetahuan',
      kkm: Math.max(0, Math.min(100, Number(editingSubject.kkm ?? 62))),
      sort_order: Number(editingSubject.sort_order ?? subjects.length + 1),
    });
    setSubjectModalOpen(false);
    setEditingSubject(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Data Master Madrasah
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Kelola daftar santri, rombongan belajar, wali kelas, dan mata pelajaran beserta KKM.
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setSubTab('students')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                subTab === 'students'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Data Santri ({filteredStudents.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('classes')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                subTab === 'classes'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <School className="w-3.5 h-3.5" />
              Kelas ({classes.length})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('subjects')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                subTab === 'subjects'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              Mapel & KKM ({subjects.length})
            </button>
          </div>
        )}
      </div>

      {/* TAB 1: SANTRI */}
      {subTab === 'students' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama, NIS, atau orang tua..."
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
                />
              </div>
              <select
                value={filterClassId}
                onChange={(e) => setFilterClassId(e.target.value)}
                className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              >
                <option value="all">
                  {isWali ? 'Kelas Binaan Saya' : 'Semua Kelas'}
                </option>
                {accessibleClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingStudent({
                  class_id: accessibleClasses[0]?.id || classes[0]?.id || '',
                  gender: 'L',
                  status: 'Aktif',
                  birth_place: 'Cimahi',
                });
                setStudentModalOpen(true);
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Tambah Santri
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">NIS / NISN</th>
                  <th className="px-4 py-3 font-medium">Nama Santri</th>
                  <th className="px-4 py-3 font-medium">L/P</th>
                  <th className="px-4 py-3 font-medium">Kelas</th>
                  <th className="px-4 py-3 font-medium">Tempat, Tgl Lahir</th>
                  <th className="px-4 py-3 font-medium">Orang Tua / Wali</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-sm text-slate-500"
                    >
                      Tidak ada data santri yang cocok dengan filter.
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((st) => (
                    <tr key={st.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono tabular-nums text-xs text-slate-600">
                        <div className="font-medium text-slate-900">{st.nis}</div>
                        {st.nisn && <div className="text-slate-400">{st.nisn}</div>}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {st.full_name}
                        <span className="ml-2 text-xs font-normal text-slate-400">
                          · {st.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{st.gender}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {classMap.get(st.class_id)?.name || '-'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {st.birth_place}
                        {st.birth_date ? `, ${st.birth_date}` : ''}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {st.parent_name}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingStudent(st);
                              setStudentModalOpen(true);
                            }}
                            aria-label={`Edit ${st.full_name}`}
                            className="p-1.5 text-slate-500 hover:text-emerald-800 rounded-md hover:bg-slate-100"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteStudent(st.id)}
                            aria-label={`Hapus ${st.full_name}`}
                            className="p-1.5 text-slate-500 hover:text-red-700 rounded-md hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: KELAS */}
      {subTab === 'classes' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Daftar rombongan belajar dan Wali Kelas aktif Tahun Pelajaran{' '}
              {settings.tahun_pelajaran}
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingClass({
                  level: classes.length + 1,
                  academic_year: settings.tahun_pelajaran,
                });
                setClassModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Tambah Kelas
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">Tingkat</th>
                  <th className="px-4 py-3 font-medium">Nama Kelas</th>
                  <th className="px-4 py-3 font-medium">Wali Kelas</th>
                  <th className="px-4 py-3 font-medium">NIP / NUPTK</th>
                  <th className="px-4 py-3 font-medium text-right">Jumlah Santri</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classes.map((cls) => {
                  const count = students.filter(
                    (s) => s.class_id === cls.id
                  ).length;
                  return (
                    <tr key={cls.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono tabular-nums text-slate-700">
                        Tingkat {cls.level}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {cls.name}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {cls.wali_kelas_name}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">
                        {cls.wali_kelas_nip}
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                        {count}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingClass(cls);
                              setClassModalOpen(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-emerald-800 rounded-md hover:bg-slate-100"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteClass(cls.id)}
                            className="p-1.5 text-slate-500 hover:text-red-700 rounded-md hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: MATA PELAJARAN & KKM */}
      {subTab === 'subjects' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Kurikulum Mata Pelajaran MDTU At-Taqwa &apos;03 Cibeureum beserta standar KKM.
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingSubject({
                  category: 'Pengetahuan',
                  teacher_name: '',
                  kkm: 62,
                  sort_order: subjects.length + 1,
                });
                setSubjectModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-800 rounded-lg hover:bg-emerald-900 whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              Tambah Mapel
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-medium">Urutan</th>
                  <th className="px-4 py-3 font-medium">Kode</th>
                  <th className="px-4 py-3 font-medium">Nama Mata Pelajaran</th>
                  <th className="px-4 py-3 font-medium">Guru Pengampu</th>
                  <th className="px-4 py-3 font-medium">Kategori</th>
                  <th className="px-4 py-3 font-medium text-right">KKM</th>
                  <th className="px-4 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedSubjects.map((subj) => (
                  <tr key={subj.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-500">
                      {subj.sort_order}
                    </td>
                    <td className="px-4 py-3 font-mono font-semibold text-emerald-800">
                      {subj.code}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-900">
                        {subj.name}
                      </span>
                      {subj.arabic_name && (
                        <span className="ml-2 text-xs text-slate-400">
                          · {subj.arabic_name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {subj.teacher_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{subj.category}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {subj.kkm}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSubject(subj);
                            setSubjectModalOpen(true);
                          }}
                          className="p-1.5 text-slate-500 hover:text-emerald-800 rounded-md hover:bg-slate-100"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSubject(subj.id)}
                          className="p-1.5 text-slate-500 hover:text-red-700 rounded-md hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL SANTRI */}
      {studentModalOpen && editingStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              {editingStudent.id ? 'Edit Data Santri' : 'Tambah Santri Baru'}
            </h3>
            <form onSubmit={handleSaveStudent} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    NIS *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingStudent.nis || ''}
                    onChange={(e) =>
                      setEditingStudent({ ...editingStudent, nis: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    NISN
                  </label>
                  <input
                    type="text"
                    value={editingStudent.nisn || ''}
                    onChange={(e) =>
                      setEditingStudent({ ...editingStudent, nisn: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Lengkap Santri *
                </label>
                <input
                  type="text"
                  required
                  value={editingStudent.full_name || ''}
                  onChange={(e) =>
                    setEditingStudent({
                      ...editingStudent,
                      full_name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Kelas *
                  </label>
                  <select
                    required
                    value={editingStudent.class_id || ''}
                    onChange={(e) =>
                      setEditingStudent({
                        ...editingStudent,
                        class_id: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    {accessibleClasses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Jenis Kelamin
                  </label>
                  <select
                    value={editingStudent.gender || 'L'}
                    onChange={(e) =>
                      setEditingStudent({
                        ...editingStudent,
                        gender: e.target.value as 'L' | 'P',
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="L">Laki-laki (L)</option>
                    <option value="P">Perempuan (P)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tempat Lahir
                  </label>
                  <input
                    type="text"
                    value={editingStudent.birth_place || ''}
                    onChange={(e) =>
                      setEditingStudent({
                        ...editingStudent,
                        birth_place: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tanggal Lahir
                  </label>
                  <input
                    type="date"
                    value={editingStudent.birth_date || ''}
                    onChange={(e) =>
                      setEditingStudent({
                        ...editingStudent,
                        birth_date: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Orang Tua / Wali
                </label>
                <input
                  type="text"
                  value={editingStudent.parent_name || ''}
                  onChange={(e) =>
                    setEditingStudent({
                      ...editingStudent,
                      parent_name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStudentModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-800 rounded-lg hover:bg-emerald-900"
                >
                  Simpan Santri
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KELAS */}
      {classModalOpen && editingClass && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              {editingClass.id ? 'Edit Kelas' : 'Tambah Kelas Baru'}
            </h3>
            <form onSubmit={handleSaveClass} className="mt-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nama Kelas *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Kelas 1 Ula"
                    value={editingClass.name || ''}
                    onChange={(e) =>
                      setEditingClass({ ...editingClass, name: e.target.value })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Tingkat
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={editingClass.level || 1}
                    onChange={(e) =>
                      setEditingClass({
                        ...editingClass,
                        level: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Wali Kelas *
                </label>
                <input
                  type="text"
                  required
                  value={editingClass.wali_kelas_name || ''}
                  onChange={(e) =>
                    setEditingClass({
                      ...editingClass,
                      wali_kelas_name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  NIP / NUPTK Wali Kelas
                </label>
                <input
                  type="text"
                  value={editingClass.wali_kelas_nip || ''}
                  onChange={(e) =>
                    setEditingClass({
                      ...editingClass,
                      wali_kelas_nip: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setClassModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-800 rounded-lg hover:bg-emerald-900"
                >
                  Simpan Kelas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL MATA PELAJARAN */}
      {subjectModalOpen && editingSubject && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">
              {editingSubject.id ? 'Edit Mata Pelajaran' : 'Tambah Mata Pelajaran'}
            </h3>
            <form onSubmit={handleSaveSubject} className="mt-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Kode *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="FQH"
                    value={editingSubject.code || ''}
                    onChange={(e) =>
                      setEditingSubject({
                        ...editingSubject,
                        code: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono uppercase"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nama Mapel *
                  </label>
                  <input
                    type="text"
                    required
                    value={editingSubject.name || ''}
                    onChange={(e) =>
                      setEditingSubject({
                        ...editingSubject,
                        name: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Nama Arab (Opsional)
                  </label>
                  <input
                    type="text"
                    value={editingSubject.arabic_name || ''}
                    onChange={(e) =>
                      setEditingSubject({
                        ...editingSubject,
                        arabic_name: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    KKM (0–100) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    required
                    value={editingSubject.kkm ?? 70}
                    onChange={(e) =>
                      setEditingSubject({
                        ...editingSubject,
                        kkm: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Guru Pengampu (Tampil di Raport)
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Osi Rosmawati"
                  value={editingSubject.teacher_name || ''}
                  onChange={(e) =>
                    setEditingSubject({
                      ...editingSubject,
                      teacher_name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Kategori
                  </label>
                  <select
                    value={editingSubject.category || 'Pengetahuan'}
                    onChange={(e) =>
                      setEditingSubject({
                        ...editingSubject,
                        category: e.target.value as Subject['category'],
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white"
                  >
                    <option value="Pengetahuan">B. Pengetahuan</option>
                    <option value="Praktik">C. Praktik</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Urutan di Raport
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={editingSubject.sort_order ?? 1}
                    onChange={(e) =>
                      setEditingSubject({
                        ...editingSubject,
                        sort_order: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSubjectModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-emerald-800 rounded-lg hover:bg-emerald-900"
                >
                  Simpan Mapel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
