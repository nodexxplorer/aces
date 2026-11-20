import { useEffect, useRef, useState } from "react";
import { Image, Modal, ScrollView, View, TouchableOpacity, Pressable, ActivityIndicator } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioSource,
} from "expo-audio";
import { Ionicons } from "@expo/vector-icons";
import Text from "./ui/Text";
import Button from "./ui/Button";
import {
  connectMediaSource,
  type ConnectAttachment,
} from "../api/connect-media";
import { useTheme } from "../theme/ThemeProvider";

export function generateWaveform(seed: string, count = 28): number[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const bars: number[] = [];
  let prev = 0.45;
  for (let i = 0; i < count; i++) {
    hash = Math.imul(hash ^ (hash >>> 16), 2246822507);
    hash = Math.imul(hash ^ (hash >>> 13), 3266489909);
    const rand = Math.abs((hash ^ (hash >>> 16)) % 1000) / 1000;
    const target = (i % 5 === 0 ? 0.85 : i % 3 === 0 ? 0.65 : 0.35) * rand;
    const height = Math.min(1, Math.max(0.18, prev * 0.4 + target * 0.6 + rand * 0.2));
    bars.push(Math.round(height * 100) / 100);
    prev = height;
  }
  return bars;
}

function formatDuration(sec: number): string {
  if (!sec || isNaN(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

export function VoicePlayer({
  source,
  compact = false,
  seed = "voice",
}: {
  source: AudioSource;
  compact?: boolean;
  seed?: string;
}) {
  const player = useAudioPlayer(source);
  const state = useAudioPlayerStatus(player);
  const { theme } = useTheme();
  const [error, setError] = useState("");
  const bars = useRef(generateWaveform(seed, compact ? 22 : 28)).current;

  const duration = state.duration || 0;
  const currentTime = state.currentTime || 0;
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  const togglePlay = () => {
    try {
      if (state.playing) {
        player.pause();
      } else {
        if (duration && currentTime >= duration - 0.1) {
          void player.seekTo(0);
        }
        player.play();
      }
    } catch {
      setError("Unable to play audio. Reload the voice note.");
    }
  };

  const handleSeek = (index: number) => {
    if (!duration) return;
    const target = (index / bars.length) * duration;
    void player.seekTo(target).catch(() => setError("Could not seek."));
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: compact ? "rgba(0, 168, 132, 0.08)" : theme.card,
        borderRadius: 20,
        padding: 10,
        borderWidth: 1,
        borderColor: compact ? "rgba(0, 168, 132, 0.2)" : theme.cardBorder,
        gap: 10,
        minWidth: 220,
        maxWidth: 290,
      }}
    >
      {/* WhatsApp Circular Play/Pause Button */}
      <TouchableOpacity
        onPress={togglePlay}
        activeOpacity={0.8}
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: "#00a884",
          alignItems: "center",
          justifyContent: "center",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.15,
          shadowRadius: 2,
          elevation: 2,
        }}
      >
        <Ionicons
          name={state.playing ? "pause" : "play"}
          size={20}
          color="#ffffff"
          style={{ marginLeft: state.playing ? 0 : 2 }}
        />
      </TouchableOpacity>

      {/* Waveform and Progress */}
      <View style={{ flex: 1, gap: 4 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            height: 24,
            gap: 2.5,
          }}
        >
          {bars.map((h, i) => {
            const barProgress = (i + 0.5) / bars.length;
            const isPlayed = barProgress <= progress;
            return (
              <Pressable
                key={i}
                onPress={() => handleSeek(i)}
                style={{
                  flex: 1,
                  height: "100%",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <View
                  style={{
                    width: 3,
                    height: `${Math.round(h * 100)}%`,
                    borderRadius: 2,
                    backgroundColor: isPlayed ? "#00a884" : theme.cardBorder,
                  }}
                />
              </Pressable>
            );
          })}
        </View>

        {/* Time and Mic Indicator */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 11, color: theme.textMuted, fontFamily: "monospace" }}>
            {formatDuration(state.playing || currentTime > 0 ? currentTime : duration)}
          </Text>
          <Ionicons name="mic" size={12} color="#00a884" />
        </View>
      </View>

      {!!(error || state.error) && (
        <Text style={{ color: theme.danger, fontSize: 11 }}>
          {error || "Audio unavailable."}
        </Text>
      )}
    </View>
  );
}

function SharedImage({
  source,
  item,
  onError,
  onForward,
}: {
  source: Awaited<ReturnType<typeof connectMediaSource>>;
  item: ConnectAttachment;
  onError: () => void;
  onForward?: (item: ConnectAttachment) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const width = item.width || 220,
    height = item.height || 220;

  async function handleDownload() {
    if (saving) return;
    setSaving(true);
    setSaveStatus("Saving…");
    try {
      const filename = `aces_connect_${item.id.slice(0, 8)}.jpg`;
      const dest = `${FileSystem.cacheDirectory}${filename}`;
      await FileSystem.downloadAsync(source.uri, dest, {
        headers: source.headers,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(dest, {
          mimeType: item.mime || "image/jpeg",
          dialogTitle: "Save image to device",
          UTI: "public.jpeg",
        });
      }
      setSaveStatus("Saved!");
      setTimeout(() => setSaveStatus(""), 2500);
    } catch {
      setSaveStatus("Save failed");
      setTimeout(() => setSaveStatus(""), 2500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <TouchableOpacity activeOpacity={0.9} onPress={() => setExpanded(true)}>
        <Image
          source={source}
          style={{
            width: 240,
            height: Math.min(320, (240 * height) / width),
            borderRadius: 16,
          }}
          resizeMode="cover"
          onError={onError}
        />
      </TouchableOpacity>
      <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
        <Button
          label="View full"
          size="sm"
          variant="ghost"
          onPress={() => setExpanded(true)}
        />
        <Button
          label={saveStatus || (saving ? "Saving…" : "Save to device")}
          size="sm"
          variant="outline"
          onPress={() => void handleDownload()}
        />
        {onForward && (
          <Button
            label="Forward"
            size="sm"
            variant="ghost"
            onPress={() => onForward(item)}
          />
        )}
      </View>
      <Modal
        visible={expanded}
        onRequestClose={() => setExpanded(false)}
        animationType="slide"
      >
        <View
          style={{
            flex: 1,
            paddingTop: 48,
            paddingBottom: 24,
            backgroundColor: "#111827",
            paddingHorizontal: 16,
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <Button label="Close" variant="outline" onPress={() => setExpanded(false)} />
            <Button
              label={saveStatus || (saving ? "Saving…" : "Save to device")}
              onPress={() => void handleDownload()}
            />
          </View>
          <ScrollView>
            <ScrollView horizontal>
              <Image
                accessibilityLabel="Full conversation image"
                source={source}
                style={{ width, height }}
                resizeMode="contain"
                onError={() => {
                  setExpanded(false);
                  onError();
                }}
              />
            </ScrollView>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function Attachment({
  item,
  onForward,
}: {
  item: ConnectAttachment;
  onForward?: (item: ConnectAttachment) => void;
}) {
  const [source, setSource] = useState<Awaited<
    ReturnType<typeof connectMediaSource>
  > | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { theme } = useTheme();
  const active = useRef(true);
  const placeholderBars = useRef(generateWaveform(item.id, 22)).current;

  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  async function load() {
    setBusy(true);
    setError("");
    try {
      const next = await connectMediaSource(item.id);
      if (active.current) setSource(next);
    } catch {
      if (active.current)
        setError(
          "Could not load media. Check your connection and conversation access.",
        );
    } finally {
      if (active.current) setBusy(false);
    }
  }

  return (
    <View style={{ gap: 8, marginVertical: 8 }}>
      {!source ? (
        /* Pre-load WhatsApp Card */
        <TouchableOpacity
          onPress={() => void load()}
          disabled={busy}
          activeOpacity={0.8}
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: 10,
            borderRadius: 18,
            backgroundColor: theme.card,
            borderWidth: 1,
            borderColor: theme.cardBorder,
            gap: 10,
            minWidth: 200,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "#00a884",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {busy ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <Ionicons name="arrow-down" size={18} color="#ffffff" />
            )}
          </View>

          <View style={{ flex: 1, gap: 4 }}>
            {item.kind === "voice" ? (
              <View style={{ flexDirection: "row", height: 16, alignItems: "center", gap: 2, opacity: 0.4 }}>
                {placeholderBars.map((h, i) => (
                  <View
                    key={i}
                    style={{
                      flex: 1,
                      height: `${Math.round(h * 100)}%`,
                      backgroundColor: theme.textMuted,
                      borderRadius: 1,
                    }}
                  />
                ))}
              </View>
            ) : null}
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 12, fontWeight: "600", color: theme.text }}>
                {busy ? "Loading…" : item.kind === "image" ? "Load image" : "Load voice note"}
              </Text>
              <Text style={{ fontSize: 11, color: theme.textMuted }}>
                {Math.ceil(item.bytes / 1024)} KB
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      ) : item.kind === "image" ? (
        <SharedImage
          source={source}
          item={item}
          onError={() => {
            setSource(null);
            setError("Image unavailable; tap to retry.");
          }}
          onForward={onForward}
        />
      ) : (
        <View style={{ gap: 4 }}>
          <VoicePlayer source={source} seed={item.id} />
          <TouchableOpacity
            onPress={() => {
              setSource(null);
              void load();
            }}
            style={{ paddingHorizontal: 6 }}
          >
            <Text style={{ fontSize: 11, color: theme.textMuted }}>Reload voice note</Text>
          </TouchableOpacity>
        </View>
      )}
      {!!error && <Text style={{ color: theme.danger }}>{error}</Text>}
    </View>
  );
}

export default function ConnectAttachments({
  items,
  onForward,
}: {
  items?: ConnectAttachment[];
  onForward?: (item: ConnectAttachment) => void;
}) {
  return (
    <>
      {items?.map((a) => (
        <Attachment key={a.id} item={a} onForward={onForward} />
      ))}
    </>
  );
}
