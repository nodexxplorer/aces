import apiClient from './client';

// A standing subscription feed (Timetable + Study Task due dates merged
// into one .ics) that Google/Apple/Outlook Calendar can "subscribe by
// URL" to — distinct from the one-off departmental-event .ics downloads
// in api/additional-features.ts.

export const getMyCalendarToken = async () => {
  const { data } = await apiClient.get<{ token: string }>('/calendar/token');
  return data.token;
};

export const regenerateMyCalendarToken = async () => {
  const { data } = await apiClient.post<{ token: string }>('/calendar/token/regenerate');
  return data.token;
};

export const getCalendarFeedUrl = (token: string) => {
  const base = apiClient.defaults.baseURL || '/api/v1';
  return `${base}/calendar/feed/${token}`;
};
