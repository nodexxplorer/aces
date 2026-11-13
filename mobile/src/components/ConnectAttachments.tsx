import { useEffect, useRef, useState } from "react";
import { Image, Modal, ScrollView, View } from "react-native";
import {
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioSource,
} from "expo-audio";
import Text from "./ui/Text";
import Button from "./ui/Button";
import {
  connectMediaSource,
  type ConnectAttachment,
} from "../api/connect-media";
import { useTheme } from "../theme/ThemeProvider";

export function VoicePlayer({ source }: { source: AudioSource }) {
  const player = useAudioPlayer(source);
  const state = useAudioPlayerStatus(player);
  const { theme } = useTheme();
  const [error, setError] = useState("");
  return (
    <View style={{ gap: 5, minWidth: 190 }}>
      <Text style={{ color: theme.text }}>
        {Math.floor(state.currentTime)} / {Math.ceil(state.duration || 0)}{" "}
        seconds
      </Text>
      <View style={{ flexDirection: "row", gap: 6 }}>
        <Button
          label={state.playing ? "Pause" : "Play"}
          size="sm"
          onPress={() => {
            try {
              if (state.playing) player.pause();
              else {
                if (state.duration && state.currentTime >= state.duration - 0.1)
                  void player.seekTo(0);
                player.play();
              }
            } catch {
              setError("Unable to play audio. Reload the voice note.");
            }
          }}
        />
        <Button
          label="−10s"
          size="sm"
          variant="outline"
          onPress={() => {
            void player
              .seekTo(Math.max(0, state.currentTime - 10))
              .catch(() => setError("Could not seek."));
          }}
        />
        <Button
          label="+10s"
          size="sm"
          variant="outline"
          onPress={() => {
            void player
              .seekTo(Math.min(state.duration, state.currentTime + 10))
              .catch(() => setError("Could not seek."));
          }}
        />
      </View>
      {!!(error || state.error) && (
        <Text style={{ color: theme.danger }}>
          {error || "Audio unavailable. Reload the voice note and try again."}
        </Text>
      )}
    </View>
  );
}
function SharedImage({
  source,
  item,
  onError,
}: {
  source: Awaited<ReturnType<typeof connectMediaSource>>;
  item: ConnectAttachment;
  onError: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const width = item.width || 220,
    height = item.height || 220;
  return (
    <>
      <Image
        source={source}
        style={{
          width: 220,
          height: Math.min(320, (220 * height) / width),
          borderRadius: 10,
        }}
        resizeMode="contain"
        onError={onError}
      />
      <Button
        label="View full image"
        size="sm"
        variant="ghost"
        onPress={() => setExpanded(true)}
      />
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
          }}
        >
          <Button label="Close image" onPress={() => setExpanded(false)} />
          <Text style={{ color: "white", padding: 12 }}>
            Scroll to read the full-resolution image.
          </Text>
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
function Attachment({ item }: { item: ConnectAttachment }) {
  const [source, setSource] = useState<Awaited<
    ReturnType<typeof connectMediaSource>
  > | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { theme } = useTheme();
  const active = useRef(true);
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
        <Button
          size="sm"
          variant="outline"
          loading={busy}
          label={`Load ${item.kind === "image" ? "image" : "voice note"} · ${Math.ceil(item.bytes / 1024)} KB`}
          onPress={() => void load()}
        />
      ) : item.kind === "image" ? (
        <SharedImage
          source={source}
          item={item}
          onError={() => {
            setSource(null);
            setError("Image unavailable; tap to retry.");
          }}
        />
      ) : (
        <>
          <VoicePlayer source={source} />
          <Button
            label="Reload voice note"
            size="sm"
            variant="ghost"
            onPress={() => {
              setSource(null);
              void load();
            }}
          />
        </>
      )}
      {!!error && <Text style={{ color: theme.danger }}>{error}</Text>}
    </View>
  );
}
export default function ConnectAttachments({
  items,
}: {
  items?: ConnectAttachment[];
}) {
  return (
    <>
      {items?.map((a) => (
        <Attachment key={a.id} item={a} />
      ))}
    </>
  );
}
