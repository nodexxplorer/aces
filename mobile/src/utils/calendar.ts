import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';
import apiClient from '../api/client';

// Fetches a backend-generated .ics file and hands it to the OS share sheet —
// on iOS/Android that's "Add to Calendar" / "Open with <calendar app>",
// which works for Google Calendar, Apple Calendar, Outlook, etc. without any
// Google/Microsoft login or API integration on our side.
async function shareICS(url: string, filename: string) {
  if (Platform.OS === 'web') {
    Alert.alert('Not Supported', 'Adding to calendar from the web preview is not supported — use the mobile app.');
    return;
  }

  const res = await apiClient.get<string>(url, { responseType: 'text' });

  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  file.write(res.data);

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    Alert.alert('Not Supported', "Your device doesn't support sharing files.");
    return;
  }
  await Sharing.shareAsync(file.uri, { mimeType: 'text/calendar', dialogTitle: 'Add to Calendar', UTI: 'com.apple.ical.ics' });
}

export async function addTimetableEntryToCalendar(entryId: string) {
  await shareICS(`/timetable/${entryId}/ics`, `class-${entryId}.ics`);
}

export async function addDepartmentalEventToCalendar(eventId: string) {
  await shareICS(`/calendar/${eventId}/ics`, `event-${eventId}.ics`);
}
