import client, { unwrap } from './client';

export interface ConnectAttachment {
  id: string;
  kind: 'image' | 'voice';
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
}
export interface ConnectTarget {
  kind: 'dm' | 'group';
  id: string;
}
export interface ConnectSendOptions {
  attachments: string[];
  client_nonce: string;
}
export async function compressConnectImage(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 25 * 1024 * 1024) {
    throw new Error('Choose a JPEG, PNG or WebP image under 25 MB. Videos and other files are disabled.');
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Image processing is not supported by this browser.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not compress image.'))), 'image/jpeg', 0.88),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
export async function uploadConnectAttachment(
  target: ConnectTarget,
  kind: 'image' | 'voice',
  blob: Blob,
  nonce: string,
  signal: AbortSignal,
  progress: (percent: number) => void,
) {
  let intent = '';
  if (kind === 'voice')
    intent = unwrap<{ id: string }>(
      await client.post('/campus-connect/media/recording-intents', target, { signal }),
    ).id;
  const body = new FormData();
  body.append('target_kind', target.kind);
  body.append('target_id', target.id);
  body.append('kind', kind);
  body.append('upload_nonce', nonce);
  if (intent) body.append('recording_intent', intent);
  body.append('file', blob, kind === 'image' ? 'photo.jpg' : 'recording');
  return unwrap<ConnectAttachment>(
    await client.post('/campus-connect/media', body, {
      signal,
      timeout: 180000,
      headers: { 'Content-Type': undefined },
      onUploadProgress: (e) => progress(e.total ? Math.round((e.loaded / e.total) * 100) : 0),
    }),
  );
}
export const discardConnectAttachment = (id: string) => client.delete(`/campus-connect/media/${id}`);
export async function loadConnectAttachment(id: string, signal: AbortSignal): Promise<Blob> {
  const response = await client.get<Blob>(`/campus-connect/media/${id}/content`, { responseType: 'blob', signal });
  return response.data;
}
