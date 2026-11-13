import { useEffect, useRef, useState } from "react";
import { AppState, Image, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import * as Crypto from "expo-crypto";
import { File } from "expo-file-system";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import Text from "./ui/Text";
import Button from "./ui/Button";
import { VoicePlayer } from "./ConnectAttachments";
import { useTheme } from "../theme/ThemeProvider";
import {
  discardConnectAttachment,
  uploadConnectAttachment,
  type ConnectTarget,
} from "../api/connect-media";
import {
  sendChatMessage,
  sendGroupMessage,
  type ChatMessage,
  type GroupMessage,
} from "../api/connect";

type Draft = {
  nonce: string;
  kind: "image" | "voice";
  uri: string;
  assetId?: string;
};
const errorText = (e: unknown) =>
  (e as { response?: { data?: { error?: string } } })?.response?.data?.error ||
  (e instanceof Error
    ? e.message
    : "Could not send. Retry this draft; it will not duplicate the message.");
function deleteLocal(d: Draft) {
  try {
    const f = new File(d.uri);
    if (f.exists) f.delete();
  } catch {
    /* OS cache cleanup is the fallback. */
  }
}
export default function ConnectComposer({
  target,
  text,
  onText,
  onSent,
}: {
  target: ConnectTarget;
  text: string;
  onText: (s: string) => void;
  onSent: (m: ChatMessage | GroupMessage) => void;
}) {
  const { theme } = useTheme();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const latest = useRef<Draft[]>([]);
  const alive = useRef(true);
  const [busy, setBusy] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const request = useRef<AbortController | undefined>(undefined);
  const nonce = useRef(Crypto.randomUUID());
  const cancelled = useRef(false);
  const finished = useRef("");
  function update(ds: Draft[]) {
    latest.current = ds;
    setDrafts(ds);
  }
  function addVoice(uri: string) {
    if (!alive.current || cancelled.current || finished.current === uri) return;
    finished.current = uri;
    update([{ nonce: Crypto.randomUUID(), kind: "voice", uri }]);
    void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
  }
  const recorder = useAudioRecorder(
    {
      ...RecordingPresets.HIGH_QUALITY,
      sampleRate: 24000,
      numberOfChannels: 1,
      bitRate: 32000,
    },
    (s) => {
      if (!alive.current) return;
      if (s.hasError || s.mediaServicesDidReset) {
        cancelled.current = true;
        setError("Recording was interrupted. Nothing was sent.");
        void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      } else if (s.isFinished && s.url) addVoice(s.url);
    },
  );
  const state = useAudioRecorderState(recorder, 250);
  function dispose(d: Draft) {
    deleteLocal(d);
    if (d.assetId) void discardConnectAttachment(d.assetId).catch(() => {});
  }
  async function finish(cancel: boolean) {
    cancelled.current = cancel;
    try {
      if (recorder.isRecording) await recorder.stop();
      if (!cancel && recorder.uri) addVoice(recorder.uri);
    } catch {
      if (alive.current)
        setError("Could not finish recording. Nothing was sent.");
    } finally {
      if (cancel && recorder.uri)
        deleteLocal({ nonce: "", kind: "voice", uri: recorder.uri });
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    }
  }
  useEffect(() => {
    alive.current = true;
    const listener = AppState.addEventListener("change", (s) => {
      if (s !== "active" && recorder.isRecording) void finish(true);
    });
    return () => {
      alive.current = false;
      request.current?.abort();
      cancelled.current = true;
      if (recorder.isRecording)
        void recorder
          .stop()
          .then(() => {
            if (recorder.uri)
              deleteLocal({ nonce: "", kind: "voice", uri: recorder.uri });
          })
          .catch(() => {});
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      latest.current.forEach(dispose);
      listener.remove();
    };
    // The parent keys this component by conversation and signed-in account.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  async function photos() {
    if (
      busy ||
      locked ||
      state.isRecording ||
      drafts.some((d) => d.kind === "voice") ||
      drafts.length >= 4
    )
      return;
    setBusy(true);
    setError("");
    const added: Draft[] = [];
    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted)
        throw new Error("Photo permission is needed to choose an image.");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: 4 - drafts.length,
        quality: 1,
      });
      if (result.canceled) return;
      if (result.assets.length + latest.current.length > 4)
        throw new Error("Send up to four images per message.");
      setStatus("Compressing images…");
      for (const asset of result.assets) {
        const edge = Math.max(asset.width, asset.height);
        const resize =
          edge > 1600
            ? [
                {
                  resize:
                    asset.width >= asset.height
                      ? { width: 1600 }
                      : { height: 1600 },
                },
              ]
            : [];
        const photo = await ImageManipulator.manipulateAsync(
          asset.uri,
          resize,
          { compress: 0.88, format: ImageManipulator.SaveFormat.JPEG },
        );
        if (!alive.current) {
          deleteLocal({ nonce: "", kind: "image", uri: photo.uri });
          return;
        }
        added.push({
          nonce: Crypto.randomUUID(),
          kind: "image",
          uri: photo.uri,
        });
      }
      update([...latest.current, ...added]);
    } catch (e) {
      added.forEach(deleteLocal);
      if (alive.current) setError(errorText(e));
    } finally {
      if (!alive.current) added.forEach(deleteLocal);
      if (alive.current) {
        setBusy(false);
        setStatus("");
      }
    }
  }
  async function record() {
    if (busy || locked || state.isRecording || drafts.length) return;
    setBusy(true);
    setError("");
    cancelled.current = false;
    finished.current = "";
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted)
        throw new Error(
          "Microphone permission is needed to record a voice note.",
        );
      if (!alive.current) return;
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await recorder.prepareToRecordAsync();
      if (!alive.current || AppState.currentState !== "active") {
        cancelled.current = true;
        await setAudioModeAsync({ allowsRecording: false });
        return;
      }
      recorder.record({ forDuration: 300 });
    } catch (e) {
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      if (alive.current) setError(errorText(e));
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  async function send() {
    if (busy || state.isRecording || (!text.trim() && !latest.current.length))
      return;
    setBusy(true);
    setLocked(true);
    setError("");
    const c = new AbortController();
    request.current = c;
    try {
      for (const d of latest.current)
        if (!d.assetId) {
          setStatus("Uploading and compressing…");
          const a = await uploadConnectAttachment(
            target,
            d.kind,
            d.uri,
            d.nonce,
            c.signal,
            (n) => {
              if (alive.current)
                setStatus(`Uploading ${n}% · processing follows`);
            },
          );
          d.assetId = a.id;
          if (!alive.current) {
            dispose(d);
            return;
          }
        }
      if (!alive.current) return;
      setStatus("Sending…");
      const options = {
        attachments: latest.current.map((d) => d.assetId!),
        client_nonce: nonce.current,
      };
      const m =
        target.kind === "dm"
          ? await sendChatMessage(target.id, text.trim(), options)
          : await sendGroupMessage(target.id, text.trim(), options);
      if (!alive.current) return;
      latest.current.forEach(deleteLocal);
      update([]);
      nonce.current = Crypto.randomUUID();
      onText("");
      setLocked(false);
      onSent(m);
    } catch (e) {
      if (alive.current) setError(errorText(e));
    } finally {
      if (alive.current) {
        setBusy(false);
        setStatus("");
      }
    }
  }
  return (
    <View
      style={{
        padding: 12,
        gap: 8,
        borderTopWidth: 1,
        borderColor: theme.divider,
      }}
    >
      <Text style={{ color: theme.textMuted, fontSize: 10 }}>
        Up to 4 images or a recorded voice note (5 min). Auto-compressed. No
        video or audio-file uploads.
      </Text>
      {!!error && (
        <Text accessibilityRole="alert" style={{ color: theme.danger }}>
          {error}
        </Text>
      )}
      {locked && !busy && (
        <Text style={{ color: theme.textMuted, fontSize: 11 }}>
          Sending is unconfirmed. Retry keeps the same message ID. Discarding
          cannot recall a message already accepted by the server.
        </Text>
      )}
      {!!status && <Text style={{ color: theme.textMuted }}>{status}</Text>}
      {state.isRecording && (
        <>
          <Text style={{ color: theme.danger }}>
            Recording {Math.floor(state.durationMillis / 1000)}s / 300s
          </Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button
              label="Stop & preview"
              size="sm"
              onPress={() => void finish(false)}
            />
            <Button
              label="Cancel"
              size="sm"
              variant="outline"
              onPress={() => void finish(true)}
            />
          </View>
        </>
      )}
      {drafts.map((d) => (
        <View key={d.nonce} style={{ gap: 5 }}>
          {d.kind === "image" ? (
            <Image
              source={{ uri: d.uri }}
              style={{ width: 100, height: 100 }}
              resizeMode="contain"
            />
          ) : (
            <VoicePlayer source={d.uri} />
          )}
          <Button
            label="Remove"
            size="sm"
            variant="ghost"
            disabled={busy || locked}
            onPress={() => {
              dispose(d);
              update(latest.current.filter((x) => x !== d));
            }}
          />
        </View>
      ))}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button
          label="Images"
          size="sm"
          variant="outline"
          disabled={
            busy ||
            locked ||
            state.isRecording ||
            drafts.some((d) => d.kind === "voice")
          }
          onPress={() => void photos()}
        />
        <Button
          label="Record"
          size="sm"
          variant="outline"
          disabled={busy || locked || state.isRecording || drafts.length > 0}
          onPress={() => void record()}
        />
      </View>
      <TextInput
        accessibilityLabel="Message or caption"
        placeholder={drafts.length ? "Optional caption" : "Message"}
        placeholderTextColor={theme.textMuted}
        value={text}
        onChangeText={onText}
        maxLength={8000}
        editable={!busy && !locked && !state.isRecording}
        style={{
          color: theme.text,
          backgroundColor: theme.card,
          borderRadius: 10,
          padding: 12,
        }}
        multiline
      />
      <Button
        label={locked ? "Retry sending" : "Send"}
        loading={busy}
        disabled={busy || state.isRecording || (!text.trim() && !drafts.length)}
        onPress={() => void send()}
      />
      {(drafts.length > 0 || locked) && (
        <Button
          label="Discard draft"
          variant="ghost"
          size="sm"
          disabled={busy}
          onPress={() => {
            latest.current.forEach(dispose);
            update([]);
            nonce.current = Crypto.randomUUID();
            setLocked(false);
            setError("");
            onText("");
          }}
        />
      )}
    </View>
  );
}
