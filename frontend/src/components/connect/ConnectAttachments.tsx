import React, { useEffect, useRef, useState } from 'react';
import { Download, Share2, Maximize2, Loader2, Image as ImageIcon } from 'lucide-react';
import { loadConnectAttachment, type ConnectAttachment } from '../../api/connect-media';
import VoiceNotePlayer, { generateWaveform } from './VoiceNotePlayer';
import MediaLightbox from './MediaLightbox';

function Attachment({ item, onForward }: { item: ConnectAttachment; onForward?: (item: ConnectAttachment) => void }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const controller = useRef<AbortController>();
  const objectUrl = useRef('');

  useEffect(
    () => () => {
      controller.current?.abort();
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    },
    [],
  );

  async function load() {
    if (busy) return;
    setBusy(true);
    setError('');
    const c = new AbortController();
    controller.current = c;
    try {
      const blob = await loadConnectAttachment(item.id, c.signal);
      if (!c.signal.aborted) {
        const u = URL.createObjectURL(blob);
        objectUrl.current = u;
        setUrl(u);
      }
    } catch {
      if (!c.signal.aborted)
        setError('Unable to load media. Check your connection and conversation access, then retry.');
    } finally {
      if (!c.signal.aborted) setBusy(false);
    }
  }

  function handleDownload(e?: React.MouseEvent) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `connect-media-${item.id.slice(0, 8)}.${item.kind === 'voice' ? 'webm' : 'jpg'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Placeholder waveform bars for pre-load card
  const placeholderBars = useRef(generateWaveform(item.id, 28)).current;

  return (
    <div className="my-2 max-w-sm select-none">
      {!url ? (
        /* Pre-load Card: Sleek WhatsApp/Telegram Lazy Download Card */
        <button
          type="button"
          disabled={busy}
          onClick={() => void load()}
          aria-label={
            busy
              ? 'Loading…'
              : item.kind === 'image'
                ? `Load image · ${Math.ceil(item.bytes / 1024)} KB`
                : `Load voice note · ${Math.ceil(item.bytes / 1024)} KB`
          }
          className="group relative flex items-center gap-3 p-3 w-full rounded-2xl bg-slate-100/90 hover:bg-slate-200/90 dark:bg-slate-800/80 dark:hover:bg-slate-750/90 border border-slate-200 dark:border-slate-700/80 shadow-sm transition-all text-left focus:outline-none focus:ring-2 focus:ring-[#00a884]/40"
        >
          {/* Circular Action Button with Download / Spinner */}
          <div className="relative flex items-center justify-center w-10 h-10 rounded-full bg-[#00a884] text-white shadow-sm shrink-0 group-hover:scale-105 active:scale-95 transition-transform">
            {busy ? (
              <Loader2 className="w-5 h-5 animate-spin text-white" />
            ) : item.kind === 'voice' ? (
              <Download className="w-5 h-5" />
            ) : (
              <Download className="w-5 h-5" />
            )}
          </div>

          {/* Card Info */}
          {item.kind === 'voice' ? (
            <div className="flex-1 min-w-[140px] flex flex-col gap-1.5">
              {/* Waveform preview placeholder */}
              <div className="h-5 flex items-center gap-[2.5px] opacity-40">
                {placeholderBars.map((h, i) => (
                  <div
                    key={i}
                    style={{ height: `${Math.round(h * 100)}%` }}
                    className="flex-1 min-w-[2px] max-w-[3px] bg-slate-400 dark:bg-slate-500 rounded-full"
                  />
                ))}
              </div>

              {/* Text metadata */}
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium text-slate-700 dark:text-slate-200">
                  {busy ? 'Loading voice note…' : 'Load voice note'}
                </span>
                <span className="tabular-nums">
                  {item.duration_seconds ? `${Math.ceil(item.duration_seconds)}s · ` : ''}
                  {Math.ceil(item.bytes / 1024)} KB
                </span>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-w-[140px] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-slate-400" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  {busy ? 'Loading image…' : 'Load image'}
                </span>
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                {Math.ceil(item.bytes / 1024)} KB
              </span>
            </div>
          )}
        </button>
      ) : item.kind === 'image' ? (
        /* Loaded Image: WhatsApp Style Rounded Thumbnail with Lightbox */
        <div className="group relative rounded-2xl overflow-hidden shadow-md border border-black/5 dark:border-white/10 bg-black/5 dark:bg-black/20">
          <div onClick={() => setLightboxOpen(true)} className="cursor-pointer overflow-hidden block">
            <img
              src={url}
              alt="Shared conversation image"
              className="max-h-96 w-full rounded-2xl object-cover hover:scale-[1.01] transition-transform duration-200"
            />
          </div>

          {/* Quick Hover Controls Overlay */}
          <div className="absolute bottom-2 right-2 flex items-center gap-1.5 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 backdrop-blur-md rounded-xl p-1 text-white shadow-lg">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxOpen(true);
              }}
              className="p-1.5 rounded-lg hover:bg-white/20 active:scale-95 transition-colors"
              title="View full screen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => handleDownload(e)}
              className="p-1.5 rounded-lg hover:bg-white/20 active:scale-95 transition-colors"
              title="Download image"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
            {onForward && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onForward(item);
                }}
                className="p-1.5 rounded-lg hover:bg-white/20 active:scale-95 transition-colors"
                title="Forward image"
              >
                <Share2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Fullscreen Lightbox Modal */}
          {lightboxOpen && (
            <MediaLightbox
              src={url}
              alt="Shared conversation image"
              onClose={() => setLightboxOpen(false)}
              onDownload={() => handleDownload()}
              onForward={onForward ? () => onForward(item) : undefined}
            />
          )}
        </div>
      ) : (
        /* Loaded Voice Note: WhatsApp Voice Note Player */
        <VoiceNotePlayer
          src={url}
          durationSeconds={item.duration_seconds}
          seed={item.id}
          onForward={onForward ? () => onForward(item) : undefined}
          ariaLabel="Voice note"
        />
      )}

      {error && (
        <p role="alert" className="mt-1.5 text-xs text-red-500 font-medium px-1">
          {error}
        </p>
      )}
    </div>
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
