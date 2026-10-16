import type { Department } from '../../api/departments';
import { DepartmentLogo } from '../branding/DepartmentBrand';

interface DepartmentLogoPickerProps {
  departments: Department[];
  selected: string;
  onSelect: (slug: string) => void;
}

/**
 * One logo per active department. The chosen one is marked, and the choice is
 * the department the student signs in to. Each button is a toggle, so keyboard
 * and screen-reader users can move through the logos with Tab.
 */
export function DepartmentLogoPicker({ departments, selected, onSelect }: DepartmentLogoPickerProps) {
  return (
    <div role="group" aria-label="Choose your department" className="flex flex-wrap items-center gap-1.5">
      {departments.map((department) => {
        const isSelected = department.slug === selected;
        return (
          <button
            key={department.slug}
            type="button"
            aria-pressed={isSelected}
            aria-label={department.name}
            title={department.name}
            onClick={() => onSelect(department.slug)}
            className={[
              'flex h-9 w-9 items-center justify-center rounded-full bg-white p-1 transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A66D6] focus-visible:ring-offset-2',
              'dark:focus-visible:ring-[#5AB0FF] dark:focus-visible:ring-offset-[#0A1224]',
              isSelected
                ? 'ring-2 ring-[#1A66D6] dark:ring-[#5AB0FF]'
                : 'opacity-55 ring-1 ring-black/10 hover:opacity-100',
            ].join(' ')}
          >
            <DepartmentLogo department={department} className="h-full w-full" />
          </button>
        );
      })}
    </div>
  );
}

export default DepartmentLogoPicker;
