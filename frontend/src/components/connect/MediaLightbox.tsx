import { useEffect } from 'react';
import { X, Download, Share2 } from 'lucide-react';

interface MediaLightboxProps {
  src: string;
  alt?: string;
  onClose: () => void;
  onDownload?: () => void;
  onForward?: () => void;
}

export default function MediaLightbox({
  src,
  alt = 'Media preview',
  onClose,
  onDownload,
  onForward,
}: MediaLightboxProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in p-4 select-none"
      onClick={onClose}
    >
      {/* Top Floating Control Bar */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10" onClick={(e) => e.stopPropagation()}>
        {onDownload && (
          <button
            type="button"
            onClick={onDownload}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white backdrop-blur-sm transition-all"
            title="Download image"
          >
            <Download className="w-5 h-5" />
          </button>
        )}
        {onForward && (
          <button
            type="button"
            onClick={onForward}
            className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white backdrop-blur-sm transition-all"
            title="Forward image"
          >
            <Share2 className="w-5 h-5" />
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-white backdrop-blur-sm transition-all"
          title="Close (Esc)"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Image View */}
      <div
        className="relative max-w-full max-h-full flex items-center justify-center p-2"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={src}
          alt={alt}
          className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-2xl transition-transform"
        />
      </div>
    </div>
  );
}
