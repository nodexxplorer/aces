import apiClient, { unwrap } from './client';

export interface TimetableEntry {
  id: string;
  course_id: string;
  day_of_week?: number;
  start_time: string;
  end_time: string;
  venue: string;
  level?: number;
  courseCode: string;
  courseTitle: string;
  entry_type: 'class' | 'exam';
  class_type?: string;
  is_published: boolean;
}

export const getTimetable = async (level?: number) => {
  const res = await apiClient.get('/timetable', { params: { entryType: 'class', level } });
  return unwrap<TimetableEntry[]>(res);
};
