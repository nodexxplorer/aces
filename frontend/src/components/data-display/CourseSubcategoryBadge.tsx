import Badge from '../ui/Badge';
import type { CourseSubcategory } from '../../types';

interface CourseSubcategoryBadgeProps {
  subcategory: CourseSubcategory;
}

const colors: Record<CourseSubcategory, 'primary' | 'info' | 'success' | 'warning'> = {
  core: 'primary',
  elective: 'info',
  general: 'success',
  practical: 'warning',
};

const CourseSubcategoryBadge = ({ subcategory }: CourseSubcategoryBadgeProps) => (
  <Badge variant={colors[subcategory]}>
    {subcategory.toUpperCase()}
  </Badge>
);

export default CourseSubcategoryBadge;
