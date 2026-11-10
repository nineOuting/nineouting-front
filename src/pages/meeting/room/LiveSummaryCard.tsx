import type { ReactNode } from 'react';
import summaryIcon from '../../../assets/icons/summary.svg';
import Icon from '../../../components/Icon';
import type { RoomAgenda } from '../../../types/meetingRoom';
import room from './room.module.css';
import TodoList from './TodoList';
import styles from './LiveSummaryCard.module.css';

const TITLE_ICON_SIZE = 24;
const EMPTY_ICON_SIZE = 40;

interface LiveSummaryCardProps {
  /** REQ-172 AI 결과 안내 줄 */
  notice?: ReactNode;
  /** 지금 논의 중인 안건 (안건 보드가 정한다). 요약·의견도 이 안건의 것을 보여 준다 */
  agenda?: RoomAgenda;
}

/** REQ-085, 087 지금 논의 중인 안건과 그 안건의 지금까지 요약, 주요 의견, 아직 합의되지 않은 부분 (안건 보드) */
export default function LiveSummaryCard({ agenda, notice }: LiveSummaryCardProps) {
  return (
    <section className={styles.card} aria-labelledby="live-summary-title">
      <div className={styles.head}>
        <div className={styles.titleGroup}>
          <div className={room.titleRow}>
            <Icon src={summaryIcon} size={TITLE_ICON_SIZE} className={room.titleIcon} />
            <h2 id="live-summary-title" className={room.title}>
              실시간 요약
            </h2>
          </div>
          <p className={room.caption}>논의 흐름을 실시간으로 정리해요</p>
        </div>
        {agenda && (
          <div className={styles.currentAgenda}>
            <span className={styles.currentTitle}>{agenda.title}</span>
            <span className={room.soundWave} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </div>
        )}
      </div>
      <div className={room.divider} />
      {notice}

      {agenda && agenda.summary.length > 0 ? (
        <div className={styles.content}>
          <div className={styles.block}>
            <p className={styles.label}>지금까지 요약</p>
            <p className={styles.summary}>{agenda.summary.join(' ')}</p>
          </div>
          {(agenda.opinions.length > 0 || agenda.openIssues.length > 0) && (
            <div className={styles.columns}>
              <div className={styles.column}>
                <p className={styles.label}>주요 의견</p>
                <ul className={styles.list}>
                  {agenda.opinions.map((opinion) => (
                    <li key={opinion}>{opinion}</li>
                  ))}
                </ul>
              </div>
              <div className={styles.column}>
                <p className={styles.label}>아직 합의되지 않은 부분</p>
                <ul className={styles.list}>
                  {agenda.openIssues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          {agenda.todos.length > 0 && (
            <div className={styles.block}>
              <p className={styles.label}>해야 할 일 ㅣ 담당자 ㅣ 기한</p>
              <TodoList todos={agenda.todos} />
            </div>
          )}
        </div>
      ) : (
        // MSG-024
        <div className={room.empty}>
          <Icon src={summaryIcon} size={EMPTY_ICON_SIZE} className={room.emptyIcon} />
          <p className={room.emptyTitle}>아직 논의 내용이 없습니다.</p>
          <p className={room.emptyCaption}>회의 발언이 시작되면 이곳에서 논의 흐름과 주요 의견을 확인할 수 있습니다.</p>
        </div>
      )}
    </section>
  );
}
