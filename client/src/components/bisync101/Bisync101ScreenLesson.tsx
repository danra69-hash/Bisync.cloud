import { useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import type { Bisync101Hotspot, Bisync101Task } from '../../data/bisync101/types';
import { bisync101ClipUrl } from '../../data/bisync101/catalog';

type Props = {
  task: Bisync101Task;
};

const STEP_MS = 5600;
const INTRO_MS = 1400;
/** Recorded WebM clips play slower so the on-screen cursor is easier to follow. */
const VIDEO_PLAYBACK_RATE = 0.65;

const SADDLE = '#2A2118';
const ORANGE = '#F37021';
const MUTED = '#6B5E52';
const SOFT = '#F5F2EE';

type ScreenKind =
  | 'login'
  | 'home'
  | 'home-sidebar'
  | 'home-101'
  | 'rms'
  | 'pos'
  | 'pos-floor'
  | 'hr'
  | 'accounting'
  | 'system';

/**
 * Short per-task capture player.
 * Prefers a live-UI WebM under /bisync101/clips (cursor + typed examples);
 * otherwise plays an animated Bisync.cloud chrome lesson fallback.
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
    const afterIntro = Math.max(0, elapsed - INTRO_MS);
    const stepProgress = ((afterIntro % STEP_MS) + STEP_MS) % STEP_MS / STEP_MS;
    drawLessonFrame(
      ctx,
      canvas.width,
      canvas.height,
      task,
      stepIndex,
      stepProgress,
    );
  }, [elapsed, stepIndex, task, totalMs, useVideo]);

  useEffect(() => {
    if (!useVideo || !videoRef.current) return;
    videoRef.current.playbackRate = VIDEO_PLAYBACK_RATE;
  }, [useVideo, clipSrc, playing]);

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
            onLoadedMetadata={e => {
              e.currentTarget.playbackRate = VIDEO_PLAYBACK_RATE;
            }}
            onPlay={e => {
              e.currentTarget.playbackRate = VIDEO_PLAYBACK_RATE;
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
            aria-label={`Platform screen lesson for ${task.title}`}
          />
        )}
        <div className="absolute left-2 top-2 rounded bg-black/55 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/90">
          {useVideo
            ? `Platform screen · ${task.durationLabel} · slowed`
            : `Platform screen · ~${Math.max(1, Math.round(totalMs / 1000))} sec`}
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
            style={{ width: `${progress * 100}%`, background: ORANGE }}
          />
        </div>
        <span className="text-[11px] text-white/60 tabular-nums shrink-0">
          Step {Math.min(stepIndex + 1, task.steps.length)}/{task.steps.length}
        </span>
      </div>
    </div>
  );
}

function screenKindForTask(taskId: string): ScreenKind {
  if (taskId === 'gs-sign-in') return 'login';
  if (taskId === 'gs-navigate-modules') return 'home-sidebar';
  if (taskId === 'gs-bisync101') return 'home-101';
  if (taskId.startsWith('gs-')) return 'home';
  if (taskId.startsWith('sc-')) return 'system';
  if (taskId.startsWith('rms-')) return 'rms';
  if (taskId === 'pos-take-order') return 'pos-floor';
  if (taskId.startsWith('pos-')) return 'pos';
  if (taskId.startsWith('hr-')) return 'hr';
  if (taskId.startsWith('ac-')) return 'accounting';
  return 'home';
}

function pageTitle(task: Bisync101Task): string {
  const kind = screenKindForTask(task.id);
  if (kind === 'login' || kind.startsWith('home')) return 'Home';
  const where = task.whereInApp || '';
  if (where.includes('→')) return where.split('→').pop()?.trim().slice(0, 28) || task.title;
  if (where.includes('·')) return where.split('·').pop()?.trim().slice(0, 28) || task.title;
  if (where) return where.trim().slice(0, 28);
  return task.title.slice(0, 28);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function drawBrandLockup(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.font = '700 13px Nunito, system-ui, sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText('Bisync.', x, y);
  const tw = ctx.measureText('Bisync.').width;
  ctx.fillStyle = ORANGE;
  ctx.fillText('cloud', x + tw, y);
  const cw = ctx.measureText('cloud').width;
  const ax = x + tw + cw + 6;
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(ax, y - 4);
  ctx.lineTo(ax + 16, y - 4);
  ctx.stroke();
  ctx.fillStyle = ORANGE;
  ctx.beginPath();
  ctx.moveTo(ax + 12, y - 8);
  ctx.lineTo(ax + 18, y - 4);
  ctx.lineTo(ax + 12, y);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText('pasar', ax + 22, y);
  const pw = ctx.measureText('pasar').width;
  ctx.fillStyle = ORANGE;
  ctx.fillText('.ai', ax + 22 + pw, y);
}

function drawHeader(ctx: CanvasRenderingContext2D, w: number, headerH: number, title: string) {
  ctx.fillStyle = SADDLE;
  ctx.fillRect(0, 0, w, headerH);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(0, headerH - 1, w, 1);

  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 14, 16, 20, 20, 3);
  ctx.stroke();
  ctx.strokeStyle = '#fff';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(18, 22 + i * 5);
    ctx.lineTo(30, 22 + i * 5);
    ctx.stroke();
  }

  drawBrandLockup(ctx, 44, 30);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(210, 14, 1, 26);

  ctx.fillStyle = '#fff';
  ctx.font = '700 13px Nunito, system-ui, sans-serif';
  ctx.fillText(title.slice(0, 18), 220, 26);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '400 10px Nunito, system-ui, sans-serif';
  ctx.fillText('Asia/Singapore · 12:00', 220, 40);

  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  roundRect(ctx, 430, 14, 130, 26, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '600 11px Nunito, system-ui, sans-serif';
  ctx.fillText('Company ▾', 442, 31);

  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  roundRect(ctx, 570, 14, 120, 26, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.fillText('Location ▾', 582, 31);

  ctx.fillStyle = ORANGE;
  roundRect(ctx, w - 106, 14, 88, 26, 6);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '700 10px Nunito, system-ui, sans-serif';
  ctx.fillText('Bisync101', w - 94, 31);

  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(w - 124, 27, 11, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = '700 9px Nunito, system-ui, sans-serif';
  ctx.fillText('EN', w - 132, 30);

  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath();
  ctx.arc(w - 154, 27, 10, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = ORANGE;
  ctx.font = '700 12px Nunito, system-ui, sans-serif';
  ctx.fillText('⌂', w - 159, 31);
}

function drawModuleBar(
  ctx: CanvasRenderingContext2D,
  w: number,
  y: number,
  pills: string[],
  active: string,
): number {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, y, w, 44);
  ctx.fillStyle = 'rgba(42,33,24,0.1)';
  ctx.fillRect(0, y + 43, w, 1);
  let x = 16;
  for (const pill of pills) {
    ctx.font = '700 11px Nunito, system-ui, sans-serif';
    const tw = ctx.measureText(pill).width + 20;
    if (pill === active) {
      ctx.fillStyle = ORANGE;
      roundRect(ctx, x, y + 8, tw, 26, 13);
      ctx.fill();
      ctx.fillStyle = '#fff';
    } else {
      ctx.fillStyle = SOFT;
      roundRect(ctx, x, y + 8, tw, 26, 13);
      ctx.fill();
      ctx.fillStyle = MUTED;
    }
    ctx.fillText(pill, x + 10, y + 25);
    x += tw + 8;
  }
  return y + 44;
}

function drawTable(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  tw: number,
  th: number,
  headers: string[],
  rows: string[][],
) {
  ctx.fillStyle = '#fff';
  roundRect(ctx, x, y, tw, th, 8);
  ctx.fill();
  ctx.strokeStyle = 'rgba(42,33,24,0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();
  const rowH = 32;
  ctx.fillStyle = SOFT;
  ctx.fillRect(x, y, tw, rowH);
  const colW = tw / Math.max(headers.length, 1);
  ctx.font = '700 10px Nunito, system-ui, sans-serif';
  ctx.fillStyle = MUTED;
  headers.forEach((h, i) => ctx.fillText(h, x + 10 + i * colW, y + 20));
  rows.slice(0, 8).forEach((row, r) => {
    const yy = y + rowH * (r + 1);
    if (yy + rowH > y + th) return;
    if (r % 2 === 1) {
      ctx.fillStyle = '#faf8f5';
      ctx.fillRect(x, yy, tw, rowH);
    }
    ctx.fillStyle = SADDLE;
    ctx.font = '400 11px Nunito, system-ui, sans-serif';
    row.forEach((cell, i) => ctx.fillText(cell.slice(0, 22), x + 10 + i * colW, yy + 20));
  });
}

function drawHome(ctx: CanvasRenderingContext2D, w: number, h: number, headerH: number) {
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, headerH, w, h - headerH);
  ctx.fillStyle = SADDLE;
  ctx.font = '700 18px Nunito, system-ui, sans-serif';
  ctx.fillText('Home', 24, headerH + 32);
  ctx.fillStyle = MUTED;
  ctx.font = '400 11px Nunito, system-ui, sans-serif';
  ctx.fillText('Open a module to continue — only enabled modules are available.', 24, headerH + 52);

  const tiles: Array<{ code: string; name: string; accent: string }> = [
    { code: 'RMS', name: 'Revenue Management', accent: ORANGE },
    { code: 'POS', name: 'Point-of-Sales', accent: '#2A7A6A' },
    { code: 'HRM', name: 'Human Resources', accent: '#3B6EA5' },
    { code: 'Accounting', name: 'Accounting', accent: '#8A6A2A' },
  ];
  const tileW = 440;
  const tileH = 150;
  tiles.forEach((tile, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = 24 + col * (tileW + 16);
    const y = headerH + 70 + row * (tileH + 16);
    ctx.fillStyle = '#fff';
    roundRect(ctx, x, y, tileW, tileH, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(42,33,24,0.12)';
    ctx.stroke();
    ctx.fillStyle = SOFT;
    ctx.fillRect(x + tileW - 120, y + 24, 104, tileH - 48);
    ctx.fillStyle = tile.accent;
    for (let b = 0; b < 4; b++) {
      const bh = 28 + b * 10;
      ctx.fillRect(x + tileW - 108 + b * 22, y + tileH - 36 - bh / 2, 14, bh / 2);
    }
    ctx.fillStyle = tile.accent;
    ctx.font = '700 10px Nunito, system-ui, sans-serif';
    ctx.fillText(tile.code, x + 16, y + 28);
    ctx.fillStyle = SADDLE;
    ctx.font = '700 15px Nunito, system-ui, sans-serif';
    ctx.fillText(tile.name, x + 16, y + 52);
    ctx.fillStyle = ORANGE;
    ctx.font = '700 11px Nunito, system-ui, sans-serif';
    ctx.fillText('Open module →', x + 16, y + 78);
  });
}

function drawLogin(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = '#fdf8f2';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = SADDLE;
  ctx.fillRect(0, 0, w * 0.42, h);
  ctx.fillStyle = ORANGE;
  ctx.beginPath();
  ctx.arc(110, 160, 40, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '700 36px Nunito, system-ui, sans-serif';
  ctx.fillText('B', 96, 172);
  ctx.font = '700 22px Nunito, system-ui, sans-serif';
  ctx.fillText('Bisync.cloud', 70, 230);
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = '400 12px Nunito, system-ui, sans-serif';
  ctx.fillText('Restaurant operations platform', 70, 252);

  const cx = w * 0.5;
  const cy = h * 0.18;
  ctx.fillStyle = '#fff';
  roundRect(ctx, cx, cy, 380, 320, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(42,33,24,0.12)';
  ctx.stroke();
  ctx.fillStyle = SADDLE;
  ctx.font = '700 20px Nunito, system-ui, sans-serif';
  ctx.fillText('Sign in', cx + 28, cy + 48);
  ctx.fillStyle = MUTED;
  ctx.font = '400 11px Nunito, system-ui, sans-serif';
  ctx.fillText('Use your company account email and password.', cx + 28, cy + 72);
  ctx.fillStyle = SOFT;
  roundRect(ctx, cx + 28, cy + 100, 324, 36, 6);
  ctx.fill();
  roundRect(ctx, cx + 28, cy + 152, 324, 36, 6);
  ctx.fill();
  ctx.fillStyle = MUTED;
  ctx.fillText('Email', cx + 40, cy + 122);
  ctx.fillText('Password', cx + 40, cy + 174);
  ctx.fillStyle = ORANGE;
  roundRect(ctx, cx + 28, cy + 220, 324, 38, 8);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '700 13px Nunito, system-ui, sans-serif';
  ctx.fillText('Sign in', cx + 160, cy + 244);
}

function drawLessonFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  task: Bisync101Task,
  stepIndex: number,
  stepProgress: number,
) {
  ctx.clearRect(0, 0, w, h);
  const kind = screenKindForTask(task.id);
  const headerH = Math.round(h * 0.11);
  const title = pageTitle(task);

  if (kind === 'login') {
    drawLogin(ctx, w, h);
  } else {
    drawHeader(ctx, w, headerH, title);
    if (kind === 'home' || kind === 'home-sidebar' || kind === 'home-101') {
      drawHome(ctx, w, h, headerH);
      if (kind === 'home-sidebar') {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = SADDLE;
        ctx.fillRect(0, 0, w * 0.28, h);
        const nav = ['Home', 'Revenue Management', 'Point-of-Sales', 'Human Resources', 'Accounting', 'System Configuration'];
        nav.forEach((label, i) => {
          const y = 70 + i * 42;
          if (i === 0) {
            ctx.fillStyle = ORANGE;
            roundRect(ctx, 12, y, w * 0.28 - 24, 34, 6);
            ctx.fill();
            ctx.fillStyle = '#fff';
          } else {
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
          }
          ctx.font = '600 12px Nunito, system-ui, sans-serif';
          ctx.fillText(label, 24, y + 22);
        });
      } else if (kind === 'home-101') {
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = SADDLE;
        roundRect(ctx, 40, 40, w - 80, h - 80, 12);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = '700 16px Nunito, system-ui, sans-serif';
        ctx.fillText('Bisync101', 60, 70);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.font = '400 11px Nunito, system-ui, sans-serif';
        ctx.fillText('User guide & wiki', 60, 90);
        const mods = ['Getting Started', 'System Config', 'RMS Orders', 'POS', 'HR', 'Accounting'];
        mods.forEach((m, i) => {
          const y = 120 + i * 36;
          if (i === 0) {
            ctx.fillStyle = ORANGE;
            roundRect(ctx, 56, y, 184, 30, 6);
            ctx.fill();
            ctx.fillStyle = '#fff';
          } else {
            ctx.fillStyle = 'rgba(255,255,255,0.65)';
          }
          ctx.font = '600 11px Nunito, system-ui, sans-serif';
          ctx.fillText(m, 68, y + 19);
        });
        ctx.fillStyle = '#1a1410';
        roundRect(ctx, 260, 120, w - 320, h - 190, 8);
        ctx.fill();
        ctx.fillStyle = '#f7f4ef';
        roundRect(ctx, 280, 170, w - 360, 190, 6);
        ctx.fill();
        ctx.fillStyle = SADDLE;
        ctx.font = '700 14px Nunito, system-ui, sans-serif';
        ctx.fillText('Play a task clip', 300, 230);
      }
    } else if (kind === 'rms') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, headerH, w, h - headerH);
      const y = drawModuleBar(
        ctx,
        w,
        headerH,
        ['Operation', 'Component', 'Vendors', 'Products', 'Sales', 'Reports'],
        'Operation',
      );
      ctx.fillStyle = SADDLE;
      ctx.font = '700 16px Nunito, system-ui, sans-serif';
      ctx.fillText(title, 24, y + 30);
      ctx.fillStyle = ORANGE;
      roundRect(ctx, w - 160, y + 12, 136, 28, 6);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '700 11px Nunito, system-ui, sans-serif';
      ctx.fillText('+ New', w - 120, y + 30);
      drawTable(ctx, 24, y + 52, w - 48, h - y - 70, ['Document', 'Vendor / Outlet', 'Status', 'Amount'], [
        ['PO-1042', 'Central Kitchen', 'Open', '$1,240.00'],
        ['PO-1041', 'Fresh Farm Co', 'Received', '$860.50'],
        ['PO-1040', 'Dairy Supply', 'Draft', '$320.00'],
        ['PO-1039', 'Beverage Hub', 'Closed', '$2,110.25'],
      ]);
    } else if (kind === 'pos' || kind === 'pos-floor') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, headerH, w, h - headerH);
      const y = drawModuleBar(
        ctx,
        w,
        headerH,
        ['POS Menu', 'Modifier Group', 'Promotion Scheduler', 'POS Config', 'Devices'],
        kind === 'pos-floor' ? 'POS Menu' : 'POS Config',
      );
      if (kind === 'pos-floor') {
        ctx.fillStyle = SADDLE;
        ctx.font = '700 16px Nunito, system-ui, sans-serif';
        ctx.fillText('POS Floor · Take order', 24, y + 30);
        for (let i = 0; i < 8; i++) {
          const col = i % 4;
          const row = Math.floor(i / 4);
          const x = 24 + col * 230;
          const ty = y + 50 + row * 160;
          const occupied = i === 1 || i === 4;
          ctx.fillStyle = occupied ? ORANGE : SOFT;
          roundRect(ctx, x, ty, 210, 140, 10);
          ctx.fill();
          ctx.fillStyle = occupied ? '#fff' : SADDLE;
          ctx.font = '700 18px Nunito, system-ui, sans-serif';
          ctx.fillText(`T${i + 1}`, x + 16, ty + 36);
          ctx.font = '400 11px Nunito, system-ui, sans-serif';
          ctx.fillText(occupied ? '4 pax' : 'Open', x + 16, ty + 58);
        }
      } else {
        ctx.fillStyle = SADDLE;
        ctx.font = '700 16px Nunito, system-ui, sans-serif';
        ctx.fillText(title, 24, y + 30);
        drawTable(ctx, 24, y + 48, w - 48, h - y - 66, ['Code', 'Name', 'Group', 'Price', 'Active'], [
          ['BURG', 'Classic Burger', 'Mains', '$12.00', 'Yes'],
          ['BEER', 'Craft Beer', 'Beer', '$8.00', 'Yes'],
          ['Fries', 'Shoestring Fries', 'Sides', '$5.50', 'Yes'],
        ]);
      }
    } else if (kind === 'hr') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, headerH, w, h - headerH);
      const y = drawModuleBar(
        ctx,
        w,
        headerH,
        ['Directory', 'Attendance', 'Leave', 'Schedule', 'Team', 'HR Config'],
        'Directory',
      );
      ctx.fillStyle = SADDLE;
      ctx.font = '700 16px Nunito, system-ui, sans-serif';
      ctx.fillText(title, 24, y + 30);
      drawTable(ctx, 24, y + 48, w - 48, h - y - 66, ['Employee', 'Department', 'Position', 'Status'], [
        ['Alex Tan', 'FOH', 'Captain', 'Active'],
        ['Mei Wong', 'Kitchen', 'Chef', 'Active'],
        ['Raj Kumar', 'Bar', 'Bartender', 'Active'],
      ]);
    } else if (kind === 'accounting') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, headerH, w, h - headerH);
      ctx.fillStyle = SADDLE;
      ctx.font = '700 16px Nunito, system-ui, sans-serif';
      ctx.fillText(title, 24, headerH + 32);
      const cards = [
        ['Gross pay', '$48,220'],
        ['Deductions', '$6,140'],
        ['Net pay', '$42,080'],
      ];
      cards.forEach(([label, value], i) => {
        const x = 24 + i * 300;
        ctx.fillStyle = '#fff';
        roundRect(ctx, x, headerH + 56, 280, 84, 10);
        ctx.fill();
        ctx.strokeStyle = 'rgba(42,33,24,0.12)';
        ctx.stroke();
        ctx.fillStyle = MUTED;
        ctx.font = '400 11px Nunito, system-ui, sans-serif';
        ctx.fillText(label, x + 16, headerH + 80);
        ctx.fillStyle = SADDLE;
        ctx.font = '700 20px Nunito, system-ui, sans-serif';
        ctx.fillText(value, x + 16, headerH + 112);
      });
    } else if (kind === 'system') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, headerH, w, h - headerH);
      const y = drawModuleBar(
        ctx,
        w,
        headerH,
        ['Companies', 'Locations', 'Access Control', 'Audit Trail'],
        'Companies',
      );
      ctx.fillStyle = SADDLE;
      ctx.font = '700 16px Nunito, system-ui, sans-serif';
      ctx.fillText(title, 24, y + 30);
      drawTable(ctx, 24, y + 48, w - 48, h - y - 66, ['Name', 'Code', 'Locations', 'Status'], [
        ['Weissbrau Group', 'WEIS', '4', 'Active'],
        ['Demo Company', 'DEMO', '2', 'Active'],
      ]);
    }
  }

  const step = task.steps[stepIndex] ?? task.steps[0];
  if (step?.hotspot) {
    drawHotspot(ctx, w, h, step.hotspot, stepProgress);
  }

  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.fillRect(0, h * 0.88, w, h * 0.12);
  ctx.fillStyle = ORANGE;
  ctx.font = '700 11px Nunito, system-ui, sans-serif';
  ctx.fillText(`STEP ${stepIndex + 1}`, w * 0.03, h * 0.93);
  ctx.fillStyle = '#fff';
  ctx.font = '700 15px Nunito, system-ui, sans-serif';
  ctx.fillText(step?.title ?? '', w * 0.12, h * 0.93);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '400 12px Nunito, system-ui, sans-serif';
  wrapText(ctx, step?.detail ?? '', w * 0.12, h * 0.97, w * 0.8, 15);
}

function drawHotspot(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  hotspot: Bisync101Hotspot,
  stepProgress: number,
) {
  const hx = w * (hotspot.x / 100);
  const hy = h * (hotspot.y / 100);
  const hw = w * (hotspot.w / 100);
  const hh = h * (hotspot.h / 100);
  ctx.strokeStyle = ORANGE;
  ctx.lineWidth = 3;
  ctx.setLineDash([8, 6]);
  ctx.strokeRect(hx, hy, hw, hh);
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(243,112,33,0.14)';
  ctx.fillRect(hx, hy, hw, hh);

  // One slow pass across the hotspot per step (easier to follow).
  const t = Math.min(1, Math.max(0, stepProgress));
  const cx = hx + hw * (0.18 + 0.64 * t);
  const cy = hy + hh * (0.42 + 0.16 * Math.sin(t * Math.PI));
  drawCursor(ctx, cx, cy);

  if (hotspot.label) {
    ctx.fillStyle = ORANGE;
    roundRect(ctx, hx, Math.max(8, hy - 22), Math.min(hw, w * 0.28), 20, 4);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '700 11px Nunito, system-ui, sans-serif';
    ctx.fillText(hotspot.label, hx + 8, Math.max(8, hy - 22) + 14);
  }
}

function drawCursor(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.45, 1.45);
  // Soft drop shadow for contrast on light and dark UI.
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.moveTo(2, 2);
  ctx.lineTo(2, 20);
  ctx.lineTo(7, 16);
  ctx.lineTo(12, 24);
  ctx.lineTo(15, 22);
  ctx.lineTo(10, 14);
  ctx.lineTo(16, 14);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = ORANGE;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.8;
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
