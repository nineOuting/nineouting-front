import dividerSummary from '../../../assets/divider-summary.svg';
import Placeholder from '../../../components/Placeholder';
import type { LiveSummary, RoomAgenda } from '../../../types/meetingRoom';
import room from './room.module.css';
import StatusPill from './StatusPill';
import styles from './LiveSummaryCard.module.css';

const TITLE_ICON_SIZE = 24;
const EMPTY_ICON_SIZE = 48;

interface LiveSummaryCardProps {
  summary: LiveSummary | null;
  /** 지금 논의 중인 안건 (안건 보드가 정한다) */
  agenda?: RoomAgenda;
}

/** REQ-085, 087 지금 논의 중인 안건과 지금까지 요약, 주요 의견, 아직 합의되지 않은 부분 */
export default function LiveSummaryCard({ summary, agenda }: LiveSummaryCardProps) {
  return (
    <section className={styles.card} aria-labelledby="live-summary-title">
      <div className={styles.head}>
        <div className={room.titleRow}>
          <Placeholder size={TITLE_ICON_SIZE} />
          <h2 id="live-summary-title" className={room.title}>
            실시간 요약
          </h2>
        </div>
        <p className={room.caption}>실시간으로 전사 내용을 수정해보세요</p>
      </div>
      <img src={dividerSummary} alt="" width={740} height={1} className={room.divider} />

      {summary ? (
        <div className={styles.content}>
          {agenda && (
            <div className={styles.block}>
              <p className={styles.label}>현재 논의</p>
              <div className={styles.currentRow}>
                <p className={styles.currentTitle}>{agenda.title}</p>
                <StatusPill status={agenda.status} soft />
              </div>
            </div>
          )}
          <div className={styles.block}>
            <p className={styles.label}>지금까지 요약</p>
            <p className={styles.summary}>{summary.summary.join(' ')}</p>
          </div>
          {(summary.opinions.length > 0 || summary.openIssues.length > 0) && (
            <div className={styles.columns}>
              <div className={styles.column}>
                <p className={styles.label}>주요 의견</p>
                <ul className={styles.list}>
                  {summary.opinions.map((opinion) => (
                    <li key={opinion}>{opinion}</li>
                  ))}
                </ul>
              </div>
              <div className={styles.column}>
                <p className={styles.label}>아직 합의되지 않은 부분</p>
                <ul className={styles.list}>
                  {summary.openIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      ) : (
        // MSG-024
        <div className={room.empty}>
          <Placeholder size={EMPTY_ICON_SIZE} />
          <p className={room.emptyTitle}>아직 논의 내용이 없습니다.</p>
          <p className={room.emptyCaption}>회의 발언이 시작되면 이곳에서 논의 흐름과 주요 의견을 확인할 수 있습니다.</p>
        </div>
      )}
    </section>
  );
}
