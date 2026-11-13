import { useEffect, useRef, useState } from 'react';
import { Mic, ImagePlus, Send, Trash2, Square, Sparkles } from 'lucide-react';
import {
  compressConnectImage,
  discardConnectAttachment,
  uploadConnectAttachment,
  type ConnectTarget,
} from '../../api/connect-media';
import { sendMessage, sendGroupMessage, type Message, type GroupMessage } from '../../api/connect';
import { getErrorMessage } from '../../utils/errors';

type Draft = { nonce: string; kind: 'image' | 'voice'; blob: Blob; url: string; assetId?: string };
export default function ConnectComposer({
  target,
  text,
  onText,
  onSent,
  onAI,
}: {
  target: ConnectTarget;
  text: string;
  onText: (s: string) => void;
  onSent: (m: Message | GroupMessage) => void;
  onAI?: () => void;
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
      const options = { attachments: latest.current.map((d) => d.assetId!), client_nonce: nonce.current };
      const m =
        target.kind === 'dm'
          ? await sendMessage(target.id, text.trim(), options)
          : await sendGroupMessage(target.id, text.trim(), options);
      if (!alive.current) return;
      latest.current.forEach((d) => URL.revokeObjectURL(d.url));
      update([]);
      nonce.current = crypto.randomUUID();
      onText('');
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
        <div className="flex items-center gap-3">
          <span role="status">
            Recording {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} / 5:00
          </span>
          <button type="button" onClick={() => stop()} className="p-2" aria-label="Stop and preview recording">
            <Square size={18} />
          </button>
          <button type="button" onClick={() => stop(true)} aria-label="Cancel recording">
            <Trash2 size={18} />
          </button>
        </div>
      )}
      <div className="flex gap-2 flex-wrap">
        {drafts.map((d) => (
          <div key={d.nonce} className="border rounded p-1">
            {d.kind === 'image' ? (
              <img src={d.url} alt="Image ready to send" className="w-24 h-24 object-contain" />
            ) : (
              <audio controls preload="metadata" src={d.url} aria-label="Voice note preview" />
            )}
            <button
              type="button"
              disabled={working || locked}
              onClick={() => {
                dispose(d);
                update(latest.current.filter((x) => x !== d));
              }}
              className="text-xs underline p-1"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
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
          className="p-2 disabled:opacity-40"
        >
          <ImagePlus size={20} />
        </button>
        <button
          type="button"
          aria-label="Record voice note"
          disabled={working || recording || locked || drafts.length > 0}
          onClick={() => void record()}
          className="p-2 disabled:opacity-40"
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
          className="min-w-0 flex-1 rounded-lg border p-2 bg-transparent"
        />
        {onAI && (
          <button
            type="button"
            onClick={onAI}
            disabled={working || locked || recording}
            aria-label="AI assistant"
            className="p-2"
          >
            <Sparkles size={18} />
          </button>
        )}
        <button
          type="submit"
          disabled={working || recording || (!text.trim() && !drafts.length)}
          aria-label={locked ? 'Retry sending' : 'Send message'}
          className="p-2 disabled:opacity-40"
        >
          <Send size={20} />
        </button>
      </form>
      {(drafts.length > 0 || locked) && (
        <button type="button" disabled={working} onClick={discard} className="text-xs underline">
          Discard draft
        </button>
      )}
    </div>
  );
}
