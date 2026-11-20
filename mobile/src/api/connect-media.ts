import api, { unwrap } from "./client";
import { getStoredAccessToken } from "../store/authStore";

export interface ConnectAttachment {
  id: string;
  kind: "image" | "voice";
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
}
export interface ConnectSendOptions {
  attachments: string[];
  client_nonce: string;
}
export interface ConnectTarget {
  kind: "dm" | "group";
  id: string;
}
export async function uploadConnectAttachment(
  target: ConnectTarget,
  kind: "image" | "voice",
  uri: string,
  nonce: string,
  signal: AbortSignal,
  progress: (n: number) => void,
) {
  let intent = "";
  if (kind === "voice")
    intent = unwrap<{ id: string }>(
      await api.post("/campus-connect/media/recording-intents", target, {
        signal,
      }),
    ).id;
  const form = new FormData();
  form.append("target_kind", target.kind);
  form.append("target_id", target.id);
  form.append("kind", kind);
  form.append("upload_nonce", nonce);
  if (intent) form.append("recording_intent", intent);
  form.append("file", {
    uri,
    type: kind === "image" ? "image/jpeg" : "audio/mp4",
    name: kind === "image" ? "photo.jpg" : "recording.m4a",
  } as unknown as Blob);
  return unwrap<ConnectAttachment>(
    await api.post("/campus-connect/media", form, {
      signal,
      timeout: 180000,
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) =>
        progress(e.total ? Math.round((e.loaded / e.total) * 100) : 0),
    }),
  );
}
export const discardConnectAttachment = (id: string) =>
  api.delete(`/campus-connect/media/${id}`);
export async function connectMediaSource(id: string) {
  // Authorize metadata through the normal refresh-token interceptor first.
  await api.get(`/campus-connect/media/${id}`);
  const token = await getStoredAccessToken();
  if (!token) throw new Error("Please sign in again.");
  return {
    uri: `${api.defaults.baseURL?.replace(/\/$/, "")}/campus-connect/media/${id}/content`,
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Client-Platform": "mobile",
    },
  };
}
