import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { useState } from 'react';
import ConnectComposer from '../ConnectComposer';
import ConnectAttachments from '../ConnectAttachments';
import * as media from '../../../api/connect-media';
import * as messages from '../../../api/connect';
vi.mock('../../../api/connect-media', () => ({
  compressConnectImage: vi.fn(),
  discardConnectAttachment: vi.fn(),
  uploadConnectAttachment: vi.fn(),
  loadConnectAttachment: vi.fn(),
}));
vi.mock('../../../api/connect', () => ({ sendMessage: vi.fn(), sendGroupMessage: vi.fn() }));
function Composer({ kind = 'dm' }: { kind?: 'dm' | 'group' }) {
  const [text, onText] = useState('Lecture notes');
  return <ConnectComposer target={{ kind, id: 'conversation' }} text={text} onText={onText} onSent={vi.fn()} />;
}
const item: media.ConnectAttachment = {
  id: 'asset',
  kind: 'image',
  mime: 'image/jpeg',
  bytes: 2000,
  width: 400,
  height: 300,
  duration_seconds: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  vi.mocked(media.compressConnectImage).mockResolvedValue(new Blob(['compressed'], { type: 'image/jpeg' }));
  vi.mocked(media.uploadConnectAttachment).mockResolvedValue(item);
  vi.mocked(media.discardConnectAttachment).mockResolvedValue({} as never);
  vi.mocked(media.loadConnectAttachment).mockResolvedValue(new Blob(['received']));
  vi.mocked(messages.sendMessage).mockResolvedValue({ id: 'message' } as messages.Message);
  vi.mocked(messages.sendGroupMessage).mockResolvedValue({ id: 'message' } as messages.GroupMessage);
});
afterEach(cleanup);
function choose(count = 1) {
  fireEvent.change(screen.getByLabelText('Choose chat images'), {
    target: {
      files: Array.from({ length: count }, (_, n) => new File(['photo'], `photo${n}.jpg`, { type: 'image/jpeg' })),
    },
  });
}
describe('Connect media', () => {
  it.each(['dm', 'group'] as const)(
    'uploads compressed image with caption for %s only after explicit send',
    async (kind) => {
      render(<Composer kind={kind} />);
      choose();
      await screen.findByAltText('Image ready to send');
      expect(media.uploadConnectAttachment).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
      const send = kind === 'dm' ? messages.sendMessage : messages.sendGroupMessage;
      await waitFor(() =>
        expect(send).toHaveBeenCalledWith('conversation', 'Lecture notes', {
          attachments: ['asset'],
          client_nonce: expect.any(String),
        }),
      );
      expect(media.compressConnectImage).toHaveBeenCalledTimes(1);
    },
  );
  it('rejects selecting more than four images', async () => {
    render(<Composer />);
    choose(5);
    expect(await screen.findByRole('alert')).toHaveTextContent('up to four');
    expect(media.compressConnectImage).not.toHaveBeenCalled();
  });
  it('keeps upload and message nonces stable across an uncertain send', async () => {
    vi.mocked(messages.sendMessage).mockRejectedValueOnce(new Error('Connection lost'));
    render(<Composer />);
    choose();
    await screen.findByAltText('Image ready to send');
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: /Retry/ }));
    await waitFor(() => expect(messages.sendMessage).toHaveBeenCalledTimes(2));
    expect(media.uploadConnectAttachment).toHaveBeenCalledTimes(1);
    expect(vi.mocked(messages.sendMessage).mock.calls[0]).toEqual(vi.mocked(messages.sendMessage).mock.calls[1]);
  });
  it('does not download received media until requested and supports retry', async () => {
    vi.mocked(media.loadConnectAttachment).mockRejectedValueOnce(new Error('Offline'));
    render(<ConnectAttachments items={[item]} />);
    expect(media.loadConnectAttachment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /Load image/ }));
    await screen.findByRole('alert');
    fireEvent.click(screen.getByRole('button', { name: /Load image/ }));
    await screen.findByAltText('Shared conversation image');
    expect(media.loadConnectAttachment).toHaveBeenCalledTimes(2);
  });
  it('has only an image picker, not video or audio-file upload controls', () => {
    render(<Composer />);
    expect(screen.getByLabelText('Choose chat images')).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
  });
});

class RecorderMock {
  static isTypeSupported() {
    return true;
  }
  state = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public stream: MediaStream) {}
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['recorded'], { type: this.mimeType }) });
    this.onstop?.();
  }
}
describe('recorded voice notes', () => {
  beforeEach(() => {
    vi.stubGlobal('MediaRecorder', RecorderMock);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: vi.fn() }] }) },
    });
  });
  afterEach(() => vi.unstubAllGlobals());
  it('requires explicit stop, preview and send for a microphone recording', async () => {
    render(<Composer />);
    fireEvent.click(screen.getByRole('button', { name: 'Record voice note' }));
    await screen.findByRole('button', { name: 'Stop and preview recording' });
    expect(media.uploadConnectAttachment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Stop and preview recording' }));
    await screen.findByLabelText('Voice note preview');
    expect(media.uploadConnectAttachment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));
    await waitFor(() =>
      expect(media.uploadConnectAttachment).toHaveBeenCalledWith(
        { kind: 'dm', id: 'conversation' },
        'voice',
        expect.any(Blob),
        expect.any(String),
        expect.any(AbortSignal),
        expect.any(Function),
      ),
    );
  });
  it('cancels a recording without uploading or leaving a preview', async () => {
    render(<Composer />);
    fireEvent.click(screen.getByRole('button', { name: 'Record voice note' }));
    await screen.findByRole('button', { name: 'Cancel recording' });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel recording' }));
    expect(screen.queryByLabelText('Voice note preview')).not.toBeInTheDocument();
    expect(media.uploadConnectAttachment).not.toHaveBeenCalled();
  });
});
