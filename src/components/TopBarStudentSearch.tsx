import { Printer, Search, Table2, Users, X } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { getAllowedTabs, getWaliClassIds } from '../lib/rbac';
import type { ActiveTab, Student } from '../types';

interface TopBarStudentSearchProps {
  activeTab: ActiveTab;
  onNavigate: (tab: ActiveTab) => void;
}

export function TopBarStudentSearch({
  activeTab,
  onNavigate,
}: TopBarStudentSearchProps) {
  const {
    userProfile,
    students,
    classes,
    globalSearchQuery,
    setGlobalSearchQuery,
    setSelectedClassId,
    setSelectedStudentId,
  } = useApp();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const allowedTabs = useMemo(
    () => getAllowedTabs(userProfile?.role),
    [userProfile?.role]
  );

  const waliClassIds = useMemo(
    () => getWaliClassIds(userProfile, classes),
    [userProfile, classes]
  );

  const classMap = useMemo(
    () => new Map(classes.map((c) => [c.id, c])),
    [classes]
  );

  const accessibleStudents = useMemo(() => {
    if (!userProfile || userProfile.role === 'orang_tua') return [];
    if (userProfile.role === 'wali_kelas' && waliClassIds.length > 0) {
      const allowedSet = new Set(waliClassIds);
      return students.filter((s) => allowedSet.has(s.class_id));
    }
    return students;
  }, [userProfile, waliClassIds, students]);

  const matchingStudents = useMemo(() => {
    const q = globalSearchQuery.trim().toLowerCase();
    if (!q) return [];
    return accessibleStudents
      .filter(
        (s) =>
          s.full_name.toLowerCase().includes(q) ||
          s.nis.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [accessibleStudents, globalSearchQuery]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [globalSearchQuery]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleGlobalShortcut = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setDropdownOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, []);

  if (!userProfile || userProfile.role === 'orang_tua') {
    return null;
  }

  const handleSelectStudent = (student: Student, targetTab?: ActiveTab) => {
    setSelectedClassId(student.class_id);
    setSelectedStudentId(student.id);
    setGlobalSearchQuery(student.full_name);
    setDropdownOpen(false);

    if (targetTab && allowedTabs.includes(targetTab)) {
      onNavigate(targetTab);
      return;
    }

    if (
      activeTab === 'raport' ||
      activeTab === 'leger' ||
      activeTab === 'master'
    ) {
      return;
    }

    if (allowedTabs.includes('raport')) {
      onNavigate('raport');
    } else if (allowedTabs.includes('leger')) {
      onNavigate('leger');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!dropdownOpen || matchingStudents.length === 0) {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
        inputRef.current?.blur();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % matchingStudents.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev <= 0 ? matchingStudents.length - 1 : prev - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target =
        matchingStudents[highlightedIndex] || matchingStudents[0];
      if (target) {
        handleSelectStudent(target);
      }
    } else if (e.key === 'Escape') {
      setDropdownOpen(false);
    }
  };

  const showResults = dropdownOpen && globalSearchQuery.trim().length > 0;

  return (
    <div
      ref={containerRef}
      className="relative flex-1 max-w-[210px] sm:max-w-xs md:max-w-sm"
    >
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={globalSearchQuery}
          onFocus={() => setDropdownOpen(true)}
          onChange={(e) => {
            setGlobalSearchQuery(e.target.value);
            setDropdownOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Cari nama santri / NIS..."
          aria-label="Cari santri berdasarkan nama atau NIS"
          className="w-full h-9 pl-8 pr-8 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700 transition-colors"
        />
        {globalSearchQuery && (
          <button
            type="button"
            onClick={() => {
              setGlobalSearchQuery('');
              setSelectedStudentId('');
              inputRef.current?.focus();
            }}
            aria-label="Hapus pencarian santri"
            className="absolute right-2 p-1 text-slate-400 hover:text-slate-700 rounded"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {showResults && (
        <div
          role="listbox"
          aria-label="Hasil pencarian santri"
          className="absolute left-0 right-0 sm:min-w-[340px] mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-50"
        >
          {matchingStudents.length === 0 ? (
            <div className="px-4 py-3.5 text-xs text-slate-500">
              Tidak ada santri dengan nama atau NIS &ldquo;{globalSearchQuery.trim()}&rdquo;.
            </div>
          ) : (
            <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
              {matchingStudents.map((st, idx) => {
                const cls = classMap.get(st.class_id);
                const isHighlighted = idx === highlightedIndex;
                return (
                  <div
                    key={st.id}
                    className={`flex items-center justify-between gap-2 px-3.5 py-2.5 transition-colors ${
                      isHighlighted ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectStudent(st)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="text-xs font-semibold text-slate-900 truncate">
                        {st.full_name}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {cls ? cls.name : 'Kelas -'} · NIS{' '}
                        <span className="font-mono">{st.nis}</span>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      {allowedTabs.includes('raport') && (
                        <button
                          type="button"
                          onClick={() => handleSelectStudent(st, 'raport')}
                          title="Buka Raport Santri"
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md whitespace-nowrap"
                        >
                          <Printer className="w-3 h-3" />
                          <span className="hidden sm:inline">Raport</span>
                        </button>
                      )}
                      {allowedTabs.includes('leger') && (
                        <button
                          type="button"
                          onClick={() => handleSelectStudent(st, 'leger')}
                          title="Buka Leger Nilai"
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md whitespace-nowrap"
                        >
                          <Table2 className="w-3 h-3" />
                          <span className="hidden sm:inline">Leger</span>
                        </button>
                      )}
                      {allowedTabs.includes('master') && (
                        <button
                          type="button"
                          onClick={() => handleSelectStudent(st, 'master')}
                          title="Buka Data Santri"
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-md whitespace-nowrap"
                        >
                          <Users className="w-3 h-3" />
                          <span className="hidden sm:inline">Data</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
