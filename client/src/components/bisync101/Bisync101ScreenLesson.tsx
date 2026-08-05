import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import type { Bisync101Task } from '../../data/bisync101/types';
import { bisync101ClipUrl } from '../../data/bisync101/catalog';

type Props = {
  task: Bisync101Task;
};

const STEP_MS = 2800;
const INTRO_MS = 700;

/**
 * Short per-task capture player.
 * Prefers a real screen recording under /bisync101/clips when present;
 * otherwise plays an animated in-app screen lesson (cursor + hotspots).
 */
export function Bisync101ScreenLesson({ task }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const clipSrc = useMemo(() => bisync101ClipUrl(task), [task]);
  const [useVideo, setUseVideo] = useState(Boolean(clipSrc));
  const [playing, setPlaying] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [videoProgress, setVideoProgress] = useState(0);
  const startedAt = useRef<number | null>(null);
  const pausedAt = useRef(0);

  const totalMs = INTRO_MS + Math.max(task.steps.length, 1) * STEP_MS;

  useEffect(() => {
    setUseVideo(Boolean(clipSrc));
    setPlaying(true);
    setStepIndex(0);
    setElapsed(0);
    setVideoProgress(0);
    startedAt.current = null;
    pausedAt.current = 0;
  }, [task.id, clipSrc]);

  useEffect(() => {
    if (useVideo) return;
    if (!playing) return;

    let raf = 0;
    const tick = (now: number) => {
      if (startedAt.current == null) startedAt.current = now - pausedAt.current;
      const ms = now - startedAt.current;
      if (ms >= totalMs) {
        setElapsed(totalMs);
        setStepIndex(task.steps.length - 1);
        setPlaying(false);
        pausedAt.current = totalMs;
        return;
      }
      setElapsed(ms);
      const idx = Math.min(
        task.steps.length - 1,
        Math.max(0, Math.floor((ms - INTRO_MS) / STEP_MS)),
      );
      setStepIndex(idx);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, task.id, task.steps.length, totalMs, useVideo]);

  useEffect(() => {
    if (useVideo) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    drawLessonFrame(ctx, canvas.width, canvas.height, task, stepIndex, elapsed / totalMs);
  }, [elapsed, stepIndex, task, totalMs, useVideo]);

  function togglePlay() {
    if (useVideo && videoRef.current) {
      if (videoRef.current.paused) {
        void videoRef.current.play();
        setPlaying(true);
      } else {
        videoRef.current.pause();
        setPlaying(false);
      }
      return;
    }
    if (playing) {
      pausedAt.current = elapsed;
      setPlaying(false);
      return;
    }
    if (elapsed >= totalMs) {
      pausedAt.current = 0;
      startedAt.current = null;
      setElapsed(0);
      setStepIndex(0);
    }
    setPlaying(true);
  }

  function replay() {
    if (useVideo && videoRef.current) {
      videoRef.current.currentTime = 0;
      void videoRef.current.play();
      setPlaying(true);
      return;
    }
    pausedAt.current = 0;
    startedAt.current = null;
    setElapsed(0);
    setStepIndex(0);
    setPlaying(true);
  }

  const progress = useVideo
    ? videoProgress
    : Math.min(1, elapsed / totalMs);

  return (
    <div className="rounded-lg border border-border bg-[#1a1410] overflow-hidden">
      <div className="relative aspect-video bg-[#2A2118]">
        {useVideo && clipSrc ? (
          <video
            ref={videoRef}
            key={clipSrc}
            src={clipSrc}
            className="absolute inset-0 h-full w-full object-contain"
            autoPlay
            playsInline
            controls={false}
            onEnded={() => setPlaying(false)}
            onTimeUpdate={e => {
              const el = e.currentTarget;
              if (el.duration > 0) setVideoProgress(el.currentTime / el.duration);
            }}
            onError={() => {
              setUseVideo(false);
              setPlaying(true);
              pausedAt.current = 0;
              startedAt.current = null;
            }}
          />
        ) : (
          <canvas
            ref={canvasRef}
            width={960}
            height={540}
            className="absolute inset-0 h-full w-full"
            aria-label={`Screen lesson for ${task.title}`}
          />
        )}
        <div className="absolute left-2 top-2 rounded bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/90">
          {useVideo ? 'Screen capture' : 'Screen lesson'} · {task.durationLabel}
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-t border-white/10 bg-[#221a14]">
        <button
          type="button"
          onClick={togglePlay}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md bg-[#F37021] text-white hover:brightness-110"
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
        </button>
        <button
          type="button"
          onClick={replay}
          className="inline-flex items-center justify-center h-8 w-8 rounded-md border border-white/15 text-white/80 hover:bg-white/10"
          aria-label="Replay"
        >
          <RotateCcw size={13} />
        </button>
        <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full transition-[width] duration-100"
            style={{ width: `${progress * 100}%`, background: '#F37021' }}
          />
        </div>
        <span className="text-[11px] text-white/60 tabular-nums shrink-0">
          Step {Math.min(stepIndex + 1, task.steps.length)}/{task.steps.length}
        </span>
      </div>
    </div>
  );
}

function drawLessonFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  task: Bisync101Task,
  stepIndex: number,
  progress: number,
) {
  ctx.clearRect(0, 0, w, h);

  // App chrome
  ctx.fillStyle = '#2A2118';
  ctx.fillRect(0, 0, w, h);

  // Top bar
  ctx.fillStyle = '#241c15';
  ctx.fillRect(0, 0, w, h * 0.1);
  ctx.fillStyle = '#F37021';
  ctx.beginPath();
  ctx.roundRect(w * 0.03, h * 0.03, w * 0.1, h * 0.04, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '600 14px Inter, system-ui, sans-serif';
  ctx.fillText('Bisync.cloud', w * 0.15, h * 0.058);

  // Fake sidebar
  ctx.fillStyle = '#1c1612';
  ctx.fillRect(0, h * 0.1, w * 0.2, h * 0.9);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = '12px Inter, system-ui, sans-serif';
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(w * 0.03, h * (0.18 + i * 0.08), w * 0.14, h * 0.025);
  }

  // Content card
  ctx.fillStyle = '#f7f4ef';
  ctx.beginPath();
  ctx.roundRect(w * 0.23, h * 0.14, w * 0.72, h * 0.72, 10);
  ctx.fill();

  ctx.fillStyle = '#2A2118';
  ctx.font = '700 22px Inter, system-ui, sans-serif';
  ctx.fillText(task.title, w * 0.26, h * 0.22);

  ctx.fillStyle = '#5c534a';
  ctx.font = '14px Inter, system-ui, sans-serif';
  wrapText(ctx, task.summary, w * 0.26, h * 0.28, w * 0.64, 18);

  const step = task.steps[stepIndex] ?? task.steps[0];
  if (step?.hotspot) {
    const hx = w * (0.23 + (step.hotspot.x / 100) * 0.72);
    const hy = h * (0.14 + (step.hotspot.y / 100) * 0.72);
    const hw = w * (step.hotspot.w / 100) * 0.72;
    const hh = h * (step.hotspot.h / 100) * 0.72;
    ctx.strokeStyle = '#F37021';
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);
    ctx.strokeRect(hx, hy, hw, hh);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(243,112,33,0.12)';
    ctx.fillRect(hx, hy, hw, hh);

    // Cursor
    const cx = hx + hw * (0.35 + 0.3 * Math.sin(progress * Math.PI * 4));
    const cy = hy + hh * 0.55;
    drawCursor(ctx, cx, cy);

    if (step.hotspot.label) {
      ctx.fillStyle = '#F37021';
      ctx.beginPath();
      ctx.roundRect(hx, Math.max(h * 0.12, hy - 22), Math.min(hw, w * 0.28), 20, 4);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '600 11px Inter, system-ui, sans-serif';
      ctx.fillText(step.hotspot.label, hx + 8, Math.max(h * 0.12, hy - 22) + 14);
    }
  }

  // Step caption bar
  ctx.fillStyle = 'rgba(0,0,0,0.72)';
  ctx.fillRect(0, h * 0.88, w, h * 0.12);
  ctx.fillStyle = '#F37021';
  ctx.font = '700 12px Inter, system-ui, sans-serif';
  ctx.fillText(`STEP ${stepIndex + 1}`, w * 0.04, h * 0.93);
  ctx.fillStyle = '#fff';
  ctx.font = '600 16px Inter, system-ui, sans-serif';
  ctx.fillText(step?.title ?? '', w * 0.14, h * 0.93);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '13px Inter, system-ui, sans-serif';
  wrapText(ctx, step?.detail ?? '', w * 0.14, h * 0.97, w * 0.8, 16);
}

function drawCursor(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 18);
  ctx.lineTo(5, 14);
  ctx.lineTo(10, 22);
  ctx.lineTo(13, 20);
  ctx.lineTo(8, 12);
  ctx.lineTo(14, 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(/\s+/);
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}
