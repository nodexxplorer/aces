import { useEffect, useRef, useState } from 'react';
import { Mic, ImagePlus, Send, Trash2, Square, Sparkles, CornerUpLeft, X, Loader2 } from 'lucide-react';
import {
  compressConnectImage,
  discardConnectAttachment,
  uploadConnectAttachment,
  type ConnectTarget,
} from '../../api/connect-media';
import { sendMessage, sendGroupMessage, type Message, type GroupMessage } from '../../api/connect';
import { getErrorMessage } from '../../utils/errors';
import VoiceNotePlayer from './VoiceNotePlayer';

type Draft = { nonce: string; kind: 'image' | 'voice'; blob: Blob; url: string; assetId?: string };
export default function ConnectComposer({
  target,
  text,
  onText,
  onSent,
  onAI,
  replyingTo,
  onClearReply,
}: {
  target: ConnectTarget;
  text: string;
  onText: (s: string) => void;
  onSent: (m: Message | GroupMessage) => void;
  onAI?: () => void;
  replyingTo?: { senderName: string; content: string } | null;
  onClearReply?: () => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const latest = useRef<Draft[]>([]);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [working, setWorking] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const request = useRef<AbortController>();
  const recorder = useRef<MediaRecorder>();
  const timer = useRef<ReturnType<typeof setInterval>>();
  const cancelled = useRef(false);
  const nonce = useRef(crypto.randomUUID());
  function update(ds: Draft[]) {
    latest.current = ds;
    setDrafts(ds);
  }
  function dispose(d: Draft) {
    URL.revokeObjectURL(d.url);
    if (d.assetId) void discardConnectAttachment(d.assetId).catch(() => {});
  }
  function stop(cancel = false) {
    cancelled.current = cancel;
    if (timer.current) clearInterval(timer.current);
    const r = recorder.current;
    if (r?.state === 'recording') r.stop();
    r?.stream.getTracks().forEach((t) => t.stop());
    if (alive.current) setRecording(false);
  }
  useEffect(() => {
    alive.current = true;
    const interrupt = () => {
      if (document.hidden) stop();
    };
    document.addEventListener('visibilitychange', interrupt);
    return () => {
      alive.current = false;
      request.current?.abort();
      cancelled.current = true;
      stop(true);
      latest.current.forEach(dispose);
      document.removeEventListener('visibilitychange', interrupt);
    };
    // A composer is keyed to its conversation/account by its caller.
  }, []);
  async function photos(files: FileList | null) {
    if (!files || working || recording || locked) return;
    const chosen = [...files];
    if (drafts.some((d) => d.kind === 'voice') || drafts.length + chosen.length > 4) {
      setError('Send up to four images, or one voice note, per message.');
      return;
    }
    setWorking(true);
    setError('');
    setStatus('Compressing images…');
    const added: Draft[] = [];
    try {
      for (const f of chosen) {
        const blob = await compressConnectImage(f);
        if (!alive.current) return;
        added.push({ nonce: crypto.randomUUID(), kind: 'image', blob, url: URL.createObjectURL(blob) });
      }
      update([...latest.current, ...added]);
    } catch (e) {
      added.forEach(dispose);
      if (alive.current) setError(getErrorMessage(e, 'Could not prepare image.'));
    } finally {
      if (!alive.current) added.forEach(dispose);
      if (alive.current) {
        setWorking(false);
        setStatus('');
      }
      if (input.current) input.current.value = '';
    }
  }
  async function record() {
    if (working || recording || locked || drafts.length) return;
    setError('');
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice recording requires HTTPS and a browser with microphone recording support.');
      return;
    }
    setWorking(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 }, video: false });
      if (!alive.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      let r: MediaRecorder;
      try {
        const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find((m) =>
          MediaRecorder.isTypeSupported(m),
        );
        r = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 32000 });
      } catch (e) {
        stream.getTracks().forEach((t) => t.stop());
        throw e;
      }
      recorder.current = r;
      cancelled.current = false;
      const chunks: Blob[] = [];
      const start = Date.now();
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timer.current) clearInterval(timer.current);
        if (!alive.current || cancelled.current || recorder.current !== r) return;
        const blob = new Blob(chunks, { type: r.mimeType });
        if (!blob.size || blob.size > 8 * 1024 * 1024) {
          setError('Recording was empty or too large. Please record a shorter voice note.');
          return;
        }
        update([{ nonce: crypto.randomUUID(), kind: 'voice', blob, url: URL.createObjectURL(blob) }]);
        setRecording(false);
      };
      r.onerror = () => {
        stop(true);
        if (alive.current) setError('Recording was interrupted. Nothing was sent.');
      };
      try {
        r.start(1000);
      } catch (e) {
        stream.getTracks().forEach((t) => t.stop());
        throw e;
      }
      setRecording(true);
      setSeconds(0);
      timer.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - start) / 1000);
        setSeconds(elapsed);
        if (elapsed >= 300) stop();
      }, 250);
    } catch {
      if (alive.current) setError('Could not start recording. Allow microphone access and try again.');
    } finally {
      if (alive.current) setWorking(false);
    }
  }
  async function send() {
    if (working || recording || (!text.trim() && !latest.current.length)) return;
    setWorking(true);
    setLocked(true);
    setError('');
    const c = new AbortController();
    request.current = c;
    try {
      for (const d of latest.current)
        if (!d.assetId) {
          setStatus(d.kind === 'image' ? 'Uploading image…' : 'Compressing and uploading voice note…');
          const a = await uploadConnectAttachment(target, d.kind, d.blob, d.nonce, c.signal, (n) => {
            if (alive.current) setStatus(`Uploading ${n}% · server processing follows`);
          });
          d.assetId = a.id;
          if (!alive.current) {
            dispose(d);
            return;
          }
        }
      if (!alive.current) return;
      setStatus('Sending…');
      const contentToSend = replyingTo
        ? `> **${replyingTo.senderName}**: ${replyingTo.content.replace(/\n/g, ' ').slice(0, 100)}\n\n${text.trim()}`
        : text.trim();
      const options = { attachments: latest.current.map((d) => d.assetId!), client_nonce: nonce.current };
      const m =
        target.kind === 'dm'
          ? await sendMessage(target.id, contentToSend, options)
          : await sendGroupMessage(target.id, contentToSend, options);
      if (!alive.current) return;
      latest.current.forEach((d) => URL.revokeObjectURL(d.url));
      update([]);
      nonce.current = crypto.randomUUID();
      onText('');
      onClearReply?.();
      setLocked(false);
      onSent(m);
    } catch (e) {
      if (alive.current)
        setError(getErrorMessage(e, 'Not confirmed sent. Retry this draft; retries do not duplicate messages.'));
    } finally {
      if (alive.current) {
        setWorking(false);
        setStatus('');
      }
    }
  }
  function discard() {
    stop(true);
    latest.current.forEach(dispose);
    update([]);
    nonce.current = crypto.randomUUID();
    setLocked(false);
    setError('');
    onText('');
  }
  return (
    <div className="border-t border-slate-200 dark:border-slate-700 p-3 space-y-2">
      <p className="text-[10px] text-slate-500">
        Images and recorded voice notes only · auto-compressed · no video or audio-file attachments
      </p>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {locked && !working && (
        <p className="text-xs text-slate-500">
          Sending is unconfirmed. Retry keeps the same message ID. Discarding cannot recall a message already accepted
          by the server.
        </p>
      )}
      {status && (
        <p role="status" className="text-xs">
          {status}
        </p>
      )}
      {recording && (
        <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-red-50/80 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 animate-fade-in shadow-sm">
          <div className="flex items-center gap-3">
            {/* WhatsApp live pulsing red recording indicator */}
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <span role="status" className="font-mono text-sm font-semibold text-red-600 dark:text-red-400 tabular-nums">
              Recording {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} / 5:00
            </span>
          </div>

          {/* WhatsApp Recording equalizer waves */}
          <div className="hidden sm:flex items-center gap-1 h-6 flex-1 max-w-[200px] px-2">
            {[40, 75, 55, 90, 60, 85, 45, 100, 70, 50, 80, 65, 95, 40].map((h, i) => (
              <div
                key={i}
                style={{ height: `${h}%`, animationDelay: `${i * 80}ms` }}
                className="flex-1 bg-red-500/80 rounded-full animate-pulse min-w-[2px]"
              />
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => stop(true)}
              aria-label="Cancel recording"
              title="Cancel recording"
              className="p-2 rounded-full text-red-500 hover:bg-red-100 dark:hover:bg-red-900/40 active:scale-95 transition-all"
            >
              <Trash2 size={18} />
            </button>
            <button
              type="button"
              onClick={() => stop()}
              aria-label="Stop and preview recording"
              title="Stop & preview"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00a884] hover:bg-[#008f6f] active:scale-95 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <Square size={13} className="fill-current" />
              <span>Stop & Preview</span>
            </button>
          </div>
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        {drafts.map((d) => (
          <div key={d.nonce} className="relative group">
            {d.kind === 'image' ? (
              <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-sm bg-slate-50 dark:bg-slate-800">
                <img src={d.url} alt="Image ready to send" className="w-24 h-24 object-cover" />
                <button
                  type="button"
                  disabled={working || locked}
                  onClick={() => {
                    dispose(d);
                    update(latest.current.filter((x) => x !== d));
                  }}
                  aria-label="Remove image"
                  title="Remove image"
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/60 hover:bg-black/80 text-white backdrop-blur-sm transition-all"
                >
                  <X size={14} />
                  <span className="sr-only">Remove</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-1 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <VoiceNotePlayer src={d.url} compact={true} seed={d.nonce} ariaLabel="Voice note preview" />
                <button
                  type="button"
                  disabled={working || locked}
                  onClick={() => {
                    dispose(d);
                    update(latest.current.filter((x) => x !== d));
                  }}
                  aria-label="Remove"
                  title="Discard voice note"
                  className="p-2 mr-1 rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 active:scale-95 transition-all"
                >
                  <Trash2 size={18} />
                  <span className="sr-only">Remove</span>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
      {replyingTo && (
        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-800/80 border-l-4 border-[#1d68ec] text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <CornerUpLeft className="w-3.5 h-3.5 text-[#1d68ec] shrink-0" />
            <div className="truncate">
              <span className="font-bold text-[#1d68ec] mr-1.5">Replying to {replyingTo.senderName}:</span>
              <span className="text-[var(--text-muted)] truncate">{replyingTo.content}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClearReply}
            className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-[var(--text-muted)] hover:text-[var(--text)] ml-2 shrink-0"
            aria-label="Cancel reply"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="flex items-center gap-2"
      >
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => void photos(e.target.files)}
          aria-label="Choose chat images"
        />
        <button
          type="button"
          aria-label="Attach images"
          disabled={working || recording || locked || drafts.some((d) => d.kind === 'voice')}
          onClick={() => input.current?.click()}
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 active:scale-95 transition-all disabled:opacity-40"
          title="Attach images"
        >
          <ImagePlus size={20} />
        </button>
        <button
          type="button"
          aria-label="Record voice note"
          disabled={working || recording || locked || drafts.length > 0}
          onClick={() => void record()}
          className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 active:scale-95 transition-all disabled:opacity-40"
          title="Record voice note"
        >
          <Mic size={20} />
        </button>
        <input
          value={text}
          onChange={(e) => onText(e.target.value)}
          disabled={working || recording || locked}
          maxLength={8000}
          placeholder={drafts.length ? 'Optional caption…' : 'Message…'}
          aria-label="Message or caption"
          className="min-w-0 flex-1 rounded-full border border-slate-200 dark:border-slate-700/80 px-4 py-2 text-sm bg-slate-50/50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-[#00a884]/40 dark:focus:ring-[#00a884]/30 transition-all placeholder:text-slate-400"
        />
        {onAI && (
          <button
            type="button"
            onClick={onAI}
            disabled={working || locked || recording}
            aria-label="AI assistant"
            className="p-2 rounded-full hover:bg-purple-50 dark:hover:bg-purple-950/30 text-purple-600 dark:text-purple-400 transition-colors"
            title="Ask AI"
          >
            <Sparkles size={18} />
          </button>
        )}
        <button
          type="submit"
          disabled={working || recording || (!text.trim() && !drafts.length)}
          aria-label={locked ? 'Retry sending' : 'Send message'}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#008f6f] active:scale-95 text-white shadow-sm shrink-0 transition-all disabled:opacity-40 disabled:hover:bg-[#00a884] disabled:scale-100"
        >
          {working ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="ml-0.5" />}
        </button>
      </form>
      {(drafts.length > 0 || locked) && (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            disabled={working}
            onClick={discard}
            className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:underline transition-colors"
          >
            Discard draft
          </button>
        </div>
      )}
    </div>
  );
}
