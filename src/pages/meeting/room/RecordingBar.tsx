import { useEffect, useState } from 'react';
import dragIcon from '../../../assets/icons/drag.svg';
import moreIcon from '../../../assets/icons/more-vert.svg';
import pauseIcon from '../../../assets/icons/pause.svg';
import playIcon from '../../../assets/icons/play.svg';
import Icon from '../../../components/Icon';
import { formatElapsed } from './roomData';
import styles from './RecordingBar.module.css';

const ICON_SIZE = 16;
const TICK_MS = 1000;

interface RecordingBarProps {
  elapsedSeconds: number;
  /** 회의 예정 길이(분) */
  plannedMinutes?: number;
  isPaused: boolean;
  isFinished: boolean;
  /** 넘기면 회의록 작성자가 일시정지·다시 시작한다 (REQ-081, 084) */
  onTogglePause?: () => void;
  /** ⋯ 메뉴 (나가기 등) */
  onMore?: () => void;
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
 * 일시정지면 "일시정지 중 · N분째"와 [다시 시작](보라), 예정 시간이 지나면 "+N분 초과"
 */
export default function RecordingBar({ elapsedSeconds, plannedMinutes, isPaused, isFinished, onTogglePause, onMore }: RecordingBarProps) {
  const overMinutes = plannedMinutes !== undefined ? Math.floor(elapsedSeconds / 60) - plannedMinutes : 0;
  const state = isFinished ? '회의 종료' : isPaused ? <PausedFor /> : '녹음 중';

  return (
    <div className={[styles.bar, isPaused ? styles.barPaused : ''].filter(Boolean).join(' ')} role="status" aria-live="polite">
      <span className={styles.handle} aria-hidden="true">
        <Icon src={dragIcon} size={ICON_SIZE} />
      </span>
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
      {onMore && (
        <button type="button" className={styles.more} aria-label="녹음 더보기" onClick={onMore}>
          <Icon src={moreIcon} size={ICON_SIZE} />
        </button>
      )}
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
