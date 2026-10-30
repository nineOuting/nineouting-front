import { useRef, useState, type PointerEvent } from 'react';
import dividerMinutesSide from '../../assets/divider-minutes-side.svg';
import Placeholder from '../../components/Placeholder';
import type { TranscriptLine } from '../../types/meetingRoom';
import styles from './MinutesSidePanels.module.css';

const TITLE_ICON_SIZE = 24;
const DIVIDER_WIDTH = 454;
// 요약본 410px : 전사 392px (디자인). 끌어서 바꿀 수 있는 범위
const DEFAULT_RATIO = 410 / 802;
const MIN_RATIO = 0.2;
const MAX_RATIO = 0.8;

interface MinutesSidePanelsProps {
  /** 마지막으로 논의한 주제 (실시간 요약의 topic) */
  topic: string | null;
  summary: string[];
  lines: TranscriptLine[];
}

/** REQ-133~134 회의 요약본과 전사. 둘 사이 경계를 끌어 높이 비율을 바꾼다 */
export default function MinutesSidePanels({ topic, summary, lines }: MinutesSidePanelsProps) {
  const [ratio, setRatio] = useState(DEFAULT_RATIO);
  const containerRef = useRef<HTMLDivElement>(null);

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const drag = (event: PointerEvent<HTMLDivElement>) => {
    const box = containerRef.current?.getBoundingClientRect();
    if (!box || !event.currentTarget.hasPointerCapture(event.pointerId)) {
      return;
    }
    setRatio(Math.min(MAX_RATIO, Math.max(MIN_RATIO, (event.clientY - box.top) / box.height)));
  };

  return (
    <div ref={containerRef} className={styles.panels}>
      <section className={styles.card} style={{ flexBasis: `${ratio * 100}%` }} aria-labelledby="minutes-summary-title">
        <div className={styles.head}>
          <h2 id="minutes-summary-title" className={styles.title}>
            <Placeholder size={TITLE_ICON_SIZE} />
            회의 요약본
          </h2>
          <p className={styles.caption}>회의 중 정리된 요약을 보며 회의록을 작성해 보세요</p>
        </div>
        <img src={dividerMinutesSide} alt="" width={DIVIDER_WIDTH} height={1} className={styles.divider} />
        <div className={styles.body}>
          {summary.length === 0 ? (
            <p className={styles.empty}>정리된 요약이 없어요.</p>
          ) : (
            <>
              {topic && (
                <div className={styles.block}>
                  <p className={styles.label}>마지막 논의</p>
                  <p className={styles.topic}>{topic}</p>
                </div>
              )}
              <div className={styles.block}>
                <p className={styles.label}>지금까지 요약</p>
                <p className={styles.summary}>{summary.join(' ')}</p>
              </div>
            </>
          )}
        </div>
      </section>
      <div
        className={styles.handle}
        role="separator"
        aria-orientation="horizontal"
        aria-label="요약본과 전사 높이 조절"
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={MIN_RATIO * 100}
        aria-valuemax={MAX_RATIO * 100}
        tabIndex={0}
        onPointerDown={startDrag}
        onPointerMove={drag}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault();
            const step = event.key === 'ArrowUp' ? -0.05 : 0.05;
            setRatio((value) => Math.min(MAX_RATIO, Math.max(MIN_RATIO, value + step)));
          }
        }}
      />
      <section className={styles.card} style={{ flexBasis: `${(1 - ratio) * 100}%` }} aria-labelledby="minutes-transcript-title">
        <div className={styles.head}>
          <h2 id="minutes-transcript-title" className={styles.title}>
            <Placeholder size={TITLE_ICON_SIZE} />
            회의 전사
          </h2>
          <p className={styles.caption}>회의 중 받아쓴 발언을 시간 순서대로 볼 수 있어요</p>
        </div>
        <img src={dividerMinutesSide} alt="" width={DIVIDER_WIDTH} height={1} className={styles.divider} />
        <div className={styles.body}>
          {lines.length === 0 ? (
            <p className={styles.empty}>받아쓴 발언이 없어요.</p>
          ) : (
            <ol className={styles.lines}>
              {lines.map((line) => (
                <li key={line.seq} className={styles.line}>
                  <span className={styles.time}>{line.time}</span>
                  <p className={styles.text}>{line.text}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </div>
  );
}
