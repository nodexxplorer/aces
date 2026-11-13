import { useEffect, useRef, useState } from 'react';
import { loadConnectAttachment, type ConnectAttachment } from '../../api/connect-media';

function Attachment({ item }: { item: ConnectAttachment }) {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
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
  return (
    <div className="max-w-sm rounded-xl border border-slate-300 dark:border-slate-600 p-2 my-2">
      {!url ? (
        <button type="button" disabled={busy} onClick={() => void load()} className="text-sm p-2 underline">
          {busy ? 'Loading…' : item.kind === 'image' ? 'Load image' : 'Load voice note'} ·{' '}
          {Math.ceil(item.bytes / 1024)} KB{item.kind === 'voice' && ` · ${Math.ceil(item.duration_seconds || 0)}s`}
        </button>
      ) : item.kind === 'image' ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt="Shared conversation image" className="max-h-96 max-w-full rounded-lg" />
        </a>
      ) : (
        <audio controls preload="none" src={url} className="max-w-full" aria-label="Voice note" />
      )}
      {error && (
        <p role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
export default function ConnectAttachments({ items }: { items?: ConnectAttachment[] }) {
  return (
    <>
      {items?.map((a) => (
        <Attachment key={a.id} item={a} />
      ))}
    </>
  );
}
