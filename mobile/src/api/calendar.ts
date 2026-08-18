import apiClient, { unwrap } from './client';

export interface CalendarEvent {
  id: string;
  creator_id: string;
  title: string;
  description?: string;
  event_type: string;
  start_time: string;
  end_time?: string;
  venue?: string;
  is_all_day: boolean;
  color: string;
  created_at: string;
  creator_name?: string;
}

export const listDepartmentalEvents = async (start?: string, end?: string) => {
  const res = await apiClient.get('/calendar', { params: { start, end } });
  return unwrap<CalendarEvent[]>(res);
};
