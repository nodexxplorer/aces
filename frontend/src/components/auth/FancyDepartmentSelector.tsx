import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Search, Check, Building2, X } from 'lucide-react';
import type { Department } from '../../api/departments';
import { getDepartmentLocalLogo, departmentLogoUrl, formatDepartmentDisplayName } from '../branding/department';
import { cn } from '../../utils/cn';

interface FancyDepartmentSelectorProps {
  departments: Department[];
  selected: string;
  onSelect: (slug: string) => void;
  className?: string;
  fullWidth?: boolean;
}

export default function FancyDepartmentSelector({
  departments,
  selected,
  onSelect,
  className,
  fullWidth = true,
}: FancyDepartmentSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const activeDept = useMemo(
    () => departments.find((d) => d.slug === selected) || departments[0],
    [departments, selected],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return departments;
    return departments.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.matricCode && d.matricCode.toLowerCase().includes(q)) ||
        (d.faculty && d.faculty.toLowerCase().includes(q)) ||
        d.slug.toLowerCase().includes(q),
    );
  }, [departments, search]);

  if (departments.length === 0) return null;

  const getLogo = (dept?: Department) => {
    if (!dept) return undefined;
    return getDepartmentLocalLogo(dept) || departmentLogoUrl(dept.logoUrl);
  };

  const activeLogo = getLogo(activeDept);

  return (
    <div ref={containerRef} className={cn('relative text-left', fullWidth ? 'w-full' : 'inline-block', className)}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Select Engineering Department"
        className={cn(
          'group flex w-full items-center justify-between gap-3 rounded-2xl border p-2.5 sm:p-3 transition-all duration-200 select-none text-left',
          'border-[var(--border)] bg-white dark:bg-[#16181d] shadow-xs',
          'hover:border-[var(--primary)] hover:shadow-md active:scale-[0.99]',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2',
          isOpen && 'border-[var(--primary)] ring-2 ring-[var(--focus-ring)]/25',
        )}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Department Logo / Emblem */}
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[var(--surface)] border border-[var(--border)]/60">
            {activeLogo ? (
              <img
                src={activeLogo}
                alt={activeDept?.name || 'Department'}
                className="h-full w-full object-contain p-1"
                loading="lazy"
              />
            ) : (
              <Building2 className="h-5 w-5 text-[var(--primary)]" />
            )}
          </div>

          {/* Department Name & Code */}
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-[var(--text)] truncate">
                {formatDepartmentDisplayName(activeDept?.name) || 'Select Department'}
              </span>
              {activeDept?.matricCode && (
                <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-mono font-semibold bg-[var(--surface)] text-[var(--text-muted)] border border-[var(--border)]/70">
                  {activeDept.matricCode}
                </span>
              )}
            </div>
            <span className="text-xs text-[var(--text-muted)] truncate">
              {activeDept?.faculty || activeDept?.institution || 'Faculty of Engineering'}
            </span>
          </div>
        </div>

        <ChevronDown
          className={cn(
            'h-4 w-4 text-[var(--text-muted)] transition-transform duration-200 shrink-0 group-hover:text-[var(--text)] mr-1',
            isOpen && 'rotate-180 text-[var(--primary)]',
          )}
        />
      </button>

      {/* Fancy Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            className={cn(
              'absolute left-0 right-0 top-full mt-2 z-50 overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-xl',
              'border-[var(--border)] bg-white/98 dark:bg-[#16181d]/98',
            )}
          >
            {/* Header / Search */}
            <div className="border-b border-[var(--border)]/70 p-2.5">
              <div className="relative flex items-center">
                <Search className="absolute left-3 h-4 w-4 text-[var(--text-muted)] pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter engineering departments..."
                  className={cn(
                    'w-full rounded-xl border border-transparent bg-[var(--surface)] py-2 pl-9 pr-8 text-xs text-[var(--text)]',
                    'placeholder:text-[var(--text-muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--focus-ring)]',
                  )}
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    aria-label="Clear filter"
                    className="absolute right-2.5 rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text)]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Department List */}
            <div className="max-h-60 overflow-y-auto p-1.5 space-y-1">
              {filtered.length === 0 ? (
                <div className="py-6 text-center text-xs text-[var(--text-muted)]">No matching department found</div>
              ) : (
                filtered.map((dept) => {
                  const isSelected = dept.slug === selected;
                  const logo = getLogo(dept);

                  return (
                    <button
                      key={dept.slug}
                      type="button"
                      onClick={() => {
                        onSelect(dept.slug);
                        setIsOpen(false);
                        setSearch('');
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors duration-150',
                        isSelected
                          ? 'bg-[var(--primary)]/10 text-[var(--primary-text)] font-semibold'
                          : 'hover:bg-[var(--surface)] text-[var(--text)]',
                      )}
                    >
                      {/* Logo Badge */}
                      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white dark:bg-[#1f2228] border border-[var(--border)] shadow-2xs">
                        {logo ? (
                          <img src={logo} alt="" className="h-full w-full object-contain p-0.5" loading="lazy" />
                        ) : (
                          <span className="text-[10px] font-bold text-[var(--primary)]">
                            {dept.matricCode || dept.slug.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Name & Subtitle */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="truncate text-xs font-medium">{formatDepartmentDisplayName(dept.name)}</span>
                          {dept.matricCode && (
                            <span className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-mono font-medium bg-[var(--surface)] border border-[var(--border)]/60 text-[var(--text-muted)]">
                              {dept.matricCode}
                            </span>
                          )}
                        </div>
                        {dept.faculty && (
                          <p className="truncate text-[10px] text-[var(--text-muted)] font-normal">{dept.faculty}</p>
                        )}
                      </div>

                      {/* Selected Checkmark */}
                      {isSelected && <Check className="h-4 w-4 text-[var(--primary)] shrink-0" />}
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer with count */}
            <div className="border-t border-[var(--border)]/60 px-3 py-1.5 bg-[var(--surface)]/50 flex items-center justify-between text-[10px] text-[var(--text-muted)]">
              <span>{departments.length} Engineering Departments</span>
              <span className="font-mono text-[9px]">ACES Portal</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
