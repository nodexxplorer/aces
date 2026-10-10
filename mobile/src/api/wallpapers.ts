import apiClient from './client';

/** A picture the server created, base64-encoded, with its image type. */
export interface CreatedWallpaper {
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  data: string;
}

/**
 * Creates a sign-in wallpaper from a short description. Public (the sign-in screen
 * comes before login). The picture comes back only to this caller; the server
 * keeps nothing. Generation can take a while, so this call has its own timeout.
 */
export const createWallpaper = async (prompt: string): Promise<CreatedWallpaper> => {
  const { data } = await apiClient.post<CreatedWallpaper>(
    '/wallpapers/generate',
    { prompt },
    { timeout: 90_000 },
  );
  return data;
};
