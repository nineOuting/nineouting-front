import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import dragIcon from '../../../assets/icons/drag.svg';
import pauseIcon from '../../../assets/icons/pause.svg';
import playIcon from '../../../assets/icons/play.svg';
import Icon from '../../../components/Icon';
import { formatElapsed } from './roomData';
import styles from './RecordingBar.module.css';

const ICON_SIZE = 16;
const TICK_MS = 1000;
// 끌어 옮길 때 창 가장자리와 남길 틈
const EDGE_GAP = 8;
// 방향키 한 번에 옮기는 거리
const KEY_STEP = 16;
const ARROW_KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-KEY_STEP, 0],
  ArrowRight: [KEY_STEP, 0],
  ArrowUp: [0, -KEY_STEP],
  ArrowDown: [0, KEY_STEP],
};

interface Offset {
  x: number;
  y: number;
}

/** 막대(rect)를 (x, y)만큼 옮길 때 창 밖으로 나가지 않게 줄인 이동량 */
function clampMove(rect: DOMRect, x: number, y: number): Offset {
  return {
    x: Math.min(Math.max(x, EDGE_GAP - rect.left), window.innerWidth - EDGE_GAP - rect.right),
    y: Math.min(Math.max(y, EDGE_GAP - rect.top), window.innerHeight - EDGE_GAP - rect.bottom),
  };
}

interface RecordingBarProps {
  elapsedSeconds: number;
  /** 회의 예정 길이(분) */
  plannedMinutes?: number;
  isPaused: boolean;
  isFinished: boolean;
  /** 넘기면 회의록 작성자가 일시정지·다시 시작한다 (REQ-081, 084) */
  onTogglePause?: () => void;
}

/** 멈춘 뒤 몇 분째인지. 멈출 때 새로 그려져 그때부터 센다 */
function PausedFor() {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(startedAt);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  return <>일시정지 중 · {Math.floor((now - startedAt) / 60000)}분째</>;
}

/**
 * 디자인 Version02 Live RecordingBar: 화면 아래 가운데 떠 있는 녹음 상태와 경과 시간.
 * 일시정지면 "일시정지 중 · N분째"와 [다시 시작](보라), 예정 시간이 지나면 "+N분 초과".
 * ⋮ 메뉴(나가기 창)는 뺐다. 나가기는 상단 뒤로 가기로 한다 (SCRUM-365)
 * 기본 자리는 가운데 칸 아래 가운데. 왼쪽 손잡이를 끌거나 방향키로 옮기고, 두 번 누르면 기본 자리로 돌아간다.
 * 옮긴 자리는 기억하지 않는다. 회의 화면에 들어올 때마다 가운데에서 시작한다 (SCRUM-365)
 */
export default function RecordingBar({ elapsedSeconds, plannedMinutes, isPaused, isFinished, onTogglePause }: RecordingBarProps) {
  const overMinutes = plannedMinutes !== undefined ? Math.floor(elapsedSeconds / 60) - plannedMinutes : 0;
  const state = isFinished ? '회의 종료' : isPaused ? <PausedFor /> : '녹음 중';
  const barRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerX: number; pointerY: number; rect: DOMRect; from: Offset } | null>(null);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // 창 크기나 막대 폭(일시정지 문구 등)이 바뀌어 창 밖으로 나가면 안쪽으로 당긴다
  useEffect(() => {
    const bar = barRef.current;
    if (!bar) {
      return undefined;
    }
    const keepInside = () => {
      const move = clampMove(bar.getBoundingClientRect(), 0, 0);
      if (move.x !== 0 || move.y !== 0) {
        setOffset((prev) => ({ x: prev.x + move.x, y: prev.y + move.y }));
      }
    };
    const observer = new ResizeObserver(keepInside);
    observer.observe(bar);
    window.addEventListener('resize', keepInside);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', keepInside);
    };
  }, []);

  const startDrag = (event: PointerEvent<HTMLButtonElement>) => {
    if (!barRef.current || event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      rect: barRef.current.getBoundingClientRect(),
      from: offset,
    };
    setIsDragging(true);
  };

  const drag = (event: PointerEvent<HTMLButtonElement>) => {
    const start = dragRef.current;
    if (!start) {
      return;
    }
    const move = clampMove(start.rect, event.clientX - start.pointerX, event.clientY - start.pointerY);
    setOffset({ x: start.from.x + move.x, y: start.from.y + move.y });
  };

  const endDrag = () => {
    dragRef.current = null;
    setIsDragging(false);
  };

  const moveByKey = (event: KeyboardEvent<HTMLButtonElement>) => {
    const step = ARROW_KEYS[event.key];
    if (!step || !barRef.current) {
      return;
    }
    event.preventDefault();
    const move = clampMove(barRef.current.getBoundingClientRect(), step[0], step[1]);
    setOffset((prev) => ({ x: prev.x + move.x, y: prev.y + move.y }));
  };

  return (
    <div
      ref={barRef}
      className={[styles.bar, isPaused ? styles.barPaused : '', isDragging ? styles.dragging : ''].filter(Boolean).join(' ')}
      // 기본 자리(CSS의 가운데 정렬 translateX(-50%))에서 옮긴 만큼 더한다
      style={{ transform: `translate(calc(-50% + ${offset.x}px), ${offset.y}px)` }}
      role="status"
      aria-live="polite"
    >
      <button
        type="button"
        className={styles.handle}
        aria-label="녹음 막대 옮기기"
        onPointerDown={startDrag}
        onPointerMove={drag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => setOffset({ x: 0, y: 0 })}
        onKeyDown={moveByKey}
      >
        <Icon src={dragIcon} size={ICON_SIZE} />
      </button>
      <span className={[styles.state, isPaused || isFinished ? styles.paused : ''].filter(Boolean).join(' ')}>
        <span className={styles.dot} aria-hidden="true" />
        {state}
      </span>
      <span className={styles.time}>{formatElapsed(elapsedSeconds)}</span>
      {plannedMinutes !== undefined && (
        <span className={[styles.planned, overMinutes > 0 ? styles.overtime : ''].filter(Boolean).join(' ')}>
          {overMinutes > 0 ? `+${overMinutes}분 초과` : `/ ${plannedMinutes}분`}
        </span>
      )}
      {/* 디자인 MicLevel: 녹음 중이면 움직이는 막대 3개 (디자인 체크 2026-11-19 "웨이브 아이콘") */}
      <span className={[styles.level, isPaused || isFinished ? '' : styles.levelLive].filter(Boolean).join(' ')} aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      {onTogglePause && !isFinished && (
        <>
          <span className={styles.divider} aria-hidden="true" />
          <button
            type="button"
            className={[styles.pauseButton, isPaused ? styles.resumeButton : ''].filter(Boolean).join(' ')}
            aria-pressed={isPaused}
            onClick={onTogglePause}
          >
            <Icon src={isPaused ? playIcon : pauseIcon} size={ICON_SIZE} />
            {isPaused ? '다시 시작' : '일시정지'}
          </button>
        </>
      )}
    </div>
  );
}
