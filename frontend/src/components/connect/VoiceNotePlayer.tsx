import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, Mic, Share2, Loader2 } from 'lucide-react';

interface VoiceNotePlayerProps {
  src: string;
  durationSeconds?: number | null;
  seed?: string;
  onForward?: () => void;
  ariaLabel?: string;
  className?: string;
  compact?: boolean;
}

// Generate realistic speech pattern waveform bars based on a seed or id
export function generateWaveform(seed: string, count = 34): number[] {
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
    // Natural speech pattern mixing cadence and bursts
    const target = (i % 5 === 0 ? 0.85 : i % 3 === 0 ? 0.65 : 0.35) * rand;
    const height = Math.min(1, Math.max(0.18, prev * 0.4 + target * 0.6 + rand * 0.2));
    bars.push(Math.round(height * 100) / 100);
    prev = height;
  }
  return bars;
}

export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VoiceNotePlayer({
  src,
  durationSeconds,
  seed = 'voice-note',
  onForward,
  ariaLabel = 'Voice note',
  className = '',
  compact = false,
}: VoiceNotePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds || 0);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);

  const waveformBars = useRef<number[]>(generateWaveform(seed, compact ? 26 : 34)).current;

  // Sync duration prop if updated
  useEffect(() => {
    if (durationSeconds && durationSeconds > 0) {
      setDuration(durationSeconds);
    }
  }, [durationSeconds]);

  // Handle Playback rate change
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      // If at the end, restart from beginning
      if (currentTime >= duration && duration > 0) {
        audioRef.current.currentTime = 0;
        setCurrentTime(0);
      }
      audioRef.current.play().catch(() => {});
    }
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    setPlaybackRate((prev) => (prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1));
  };

  const handleTimeUpdate = () => {
    if (audioRef.current && !isScrubbing) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const d = audioRef.current.duration;
      if (d && !isNaN(d) && isFinite(d) && d > 0) {
        setDuration(d);
      }
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) audioRef.current.currentTime = 0;
  };

  // Waveform click / scrub calculation
  const seekToPosition = (clientX: number) => {
    if (!waveformRef.current || !audioRef.current) return;
    const rect = waveformRef.current.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const targetTime = percent * (duration || durationSeconds || 1);
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    seekToPosition(e.clientX);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    setIsScrubbing(true);
    seekToPosition(e.clientX);

    const onMouseMove = (ev: MouseEvent) => {
      seekToPosition(ev.clientX);
    };

    const onMouseUp = () => {
      setIsScrubbing(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const displayTime = isPlaying || currentTime > 0 ? currentTime : duration;

  return (
    <div
      className={`group/vn relative flex items-center gap-3 rounded-2xl p-2.5 transition-all select-none ${
        compact
          ? 'bg-emerald-50/80 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-800/40'
          : 'bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-sm border border-slate-200/80 dark:border-slate-700/80 shadow-sm'
      } ${className}`}
    >
      {/* Hidden standard audio element with aria-label for accessibility & tests */}
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        aria-label={ariaLabel}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        className="sr-only"
      />

      {/* WhatsApp Circular Play / Pause Button */}
      <button
        type="button"
        onClick={togglePlay}
        className="relative flex items-center justify-center w-10 h-10 rounded-full bg-[#00a884] hover:bg-[#008f6f] active:scale-95 text-white shadow-sm shrink-0 transition-all focus:outline-none focus:ring-2 focus:ring-[#00a884]/40"
        title={isPlaying ? 'Pause voice note' : 'Play voice note'}
        aria-label={isPlaying ? 'Pause voice note' : 'Play voice note'}
      >
        {isBuffering ? (
          <Loader2 className="w-5 h-5 animate-spin text-white" />
        ) : isPlaying ? (
          <Pause className="w-5 h-5 fill-current" />
        ) : (
          <Play className="w-5 h-5 fill-current ml-0.5" />
        )}
      </button>

      {/* Waveform Scrubber & Metadata */}
      <div className="flex-1 min-w-[160px] max-w-[280px] flex flex-col justify-center gap-1.5 py-0.5">
        {/* Interactive Waveform */}
        <div
          ref={waveformRef}
          onClick={handleWaveformClick}
          onMouseDown={handleMouseDown}
          className="relative h-7 flex items-center gap-[2.5px] cursor-pointer group/wave py-1 px-0.5"
          title="Click to seek"
          role="slider"
          aria-valuemin={0}
          aria-valuemax={duration || 1}
          aria-valuenow={currentTime}
          aria-label="Audio timeline"
          tabIndex={0}
        >
          {waveformBars.map((barHeight, idx) => {
            const barProgress = (idx + 0.5) / waveformBars.length;
            const isPlayed = barProgress <= progress;

            return (
              <div
                key={idx}
                className="flex-1 flex items-center justify-center h-full group-hover/wave:scale-y-110 transition-transform origin-center"
              >
                <div
                  style={{ height: `${Math.round(barHeight * 100)}%` }}
                  className={`w-full max-w-[3.5px] min-w-[2px] rounded-full transition-colors duration-150 ${
                    isPlayed ? 'bg-[#00a884] dark:bg-[#25D366]' : 'bg-slate-300 dark:bg-slate-600/90'
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Time, Speed & Mic Indicator */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium px-0.5">
          <div className="flex items-center gap-1.5">
            <span className="tabular-nums tracking-tight font-mono">{formatDuration(displayTime)}</span>
            <div className="flex items-center text-[#00a884] dark:text-[#25D366]" title="Voice message">
              <Mic className="w-3 h-3" />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* WhatsApp Speed Toggle Pill (1x / 1.5x / 2x) */}
            <button
              type="button"
              onClick={cycleSpeed}
              className="px-1.5 py-0.2 rounded-full bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-700/80 dark:hover:bg-slate-600 text-[10px] font-semibold text-slate-700 dark:text-slate-200 transition-colors"
              title="Change playback speed"
            >
              {playbackRate}x
            </button>

            {onForward && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onForward();
                }}
                className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                title="Forward voice note"
              >
                <Share2 className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
