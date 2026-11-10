import { useRef, useState, type PointerEvent } from 'react';
import archiveIcon from '../../assets/icons/archive.svg';
import transcriptIcon from '../../assets/icons/transcript.svg';
import Icon from '../../components/Icon';
import type { TranscriptLine } from '../../types/meetingRoom';
import styles from './MinutesSidePanels.module.css';

const TITLE_ICON_SIZE = 20;
// 디자인은 요약본과 전사가 반씩. 끌어서 바꿀 수 있는 범위
const DEFAULT_RATIO = 0.5;
const MIN_RATIO = 0.2;
const MAX_RATIO = 0.8;

/** REQ-133 안건별 요약 (안건 보드). 요약이 없는 안건은 보여 주지 않는다 */
export interface AgendaSummary {
  id: string;
  title: string;
  summary: string[];
}

interface MinutesSidePanelsProps {
  agendas: AgendaSummary[];
  lines: TranscriptLine[];
}

/** REQ-133~134 회의 요약본(안건별)과 전사 (디자인 SummaryTranscriptPanel). 가운데 SplitBar를 끌어 높이 비율을 바꾼다 */
export default function MinutesSidePanels({ agendas, lines }: MinutesSidePanelsProps) {
  const summarized = agendas.filter(({ summary }) => summary.length > 0);
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
            <Icon src={archiveIcon} size={TITLE_ICON_SIZE} className={styles.titleIcon} />
            회의 요약본
          </h2>
        </div>
        <div className={styles.body}>
          {summarized.length === 0 ? (
            <p className={styles.empty}>정리된 요약이 없어요.</p>
          ) : (
            summarized.map((agenda) => (
              <div key={agenda.id} className={styles.block}>
                <p className={styles.label}>{agenda.title}</p>
                <p className={styles.summary}>{agenda.summary.join(' ')}</p>
              </div>
            ))
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
      >
        {/* 디자인 SplitBar: 양쪽 선 + 가운데 손잡이 */}
        <span className={styles.handleLine} />
        <span className={styles.handleGrip} />
        <span className={styles.handleLine} />
      </div>
      <section className={styles.card} style={{ flexBasis: `${(1 - ratio) * 100}%` }} aria-labelledby="minutes-transcript-title">
        <div className={styles.head}>
          <h2 id="minutes-transcript-title" className={styles.title}>
            <Icon src={transcriptIcon} size={TITLE_ICON_SIZE} className={styles.titleIcon} />
            전사 기록
          </h2>
        </div>
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
