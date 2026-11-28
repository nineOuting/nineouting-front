import { useState } from 'react';
import { PENDING_AGENDA_UNAVAILABLE_MESSAGE, type FolderMeetingStat } from '../../api/meeting';
import deleteIcon from '../../assets/icons/delete-sm.svg';
import Icon from '../../components/Icon';
import Skeleton from '../../components/Skeleton';
import type { FolderPendingAgenda } from '../../types/workspace';
import styles from './FolderStats.module.css';

const CHART_HEIGHT = 84;
const STACK_GAP = 4;
const MAX_UNIT = 14;
const DELETE_ICON_SIZE = 16;

interface FolderStatsProps {
  stats: FolderMeetingStat[];
  pendingAgendas: FolderPendingAgenda[];
  onDiscardPending: (agenda: FolderPendingAgenda) => void;
}

/** 2026-10-20 → 10/20 */
const shortDate = (date: string) => `${date.slice(5, 7)}/${date.slice(8, 10)}`;

/**
 * 피그마 Page 8 StatsRow: 안건 결정률(REQ-200) + 남은 안건(REQ-051, 188), 예정 시간 초과(REQ-200).
 * 그래프는 최근 끝난 회의 6개. 회의가 하나도 없으면 그래프 대신 안내 문구
 */
export default function FolderStats({ stats, pendingAgendas, onDiscardPending }: FolderStatsProps) {
  // 누르면 제목 전체와 결정할 사항을 펼쳐 본다
  const [openId, setOpenId] = useState<number | null>(null);
  const total = stats.reduce((sum, stat) => sum + stat.decided + stat.carried + stat.excluded, 0);
  const decided = stats.reduce((sum, stat) => sum + stat.decided, 0);
  const maxAgendas = Math.max(1, ...stats.map((stat) => stat.decided + stat.carried + stat.excluded));
  // 안건 1개 높이. 가장 많은 회의도 84px 안에 들어가게 줄인다
  const unit = Math.min(MAX_UNIT, (CHART_HEIGHT - STACK_GAP * 2) / maxAgendas);

  const overruns = stats.filter((stat) => stat.actualMinutes > stat.scheduledMinutes);
  const averageOver =
    overruns.length === 0
      ? 0
      : Math.round(overruns.reduce((sum, stat) => sum + stat.actualMinutes - stat.scheduledMinutes, 0) / overruns.length);
  const plannedAverage =
    stats.length === 0 ? 0 : Math.round(stats.reduce((sum, stat) => sum + stat.scheduledMinutes, 0) / stats.length);
  const maxMinutes = Math.max(1, ...stats.map((stat) => Math.max(stat.actualMinutes, stat.scheduledMinutes)));
  const minuteHeight = (minutes: number) => (minutes / maxMinutes) * CHART_HEIGHT;

  return (
    <div className={styles.row}>
      <section className={styles.agendaCard} aria-label="안건 결정률과 남은 안건">
        <div className={styles.block}>
          <div className={styles.head}>
            <p className={styles.label}>안건 결정률</p>
            <p className={styles.value}>
              {total === 0 ? '-' : `${Math.round((decided / total) * 100)}%`}
              <span className={styles.caption}>
                {stats.length === 0 ? '끝난 회의가 생기면 보여요' : `최근 ${stats.length}회 · 안건 ${total}개 중 결정 ${decided}`}
              </span>
            </p>
          </div>
          {stats.length > 0 && (
            <>
              <div className={styles.chart}>
                {stats.map((stat) => (
                  <div key={stat.meetingId} className={styles.bar} title={stat.title}>
                    <div className={styles.stack}>
                      {stat.excluded > 0 && (
                        <span className={`${styles.segment} ${styles.excluded}`} style={{ height: stat.excluded * unit }} />
                      )}
                      {stat.carried > 0 && (
                        <span className={`${styles.segment} ${styles.carried}`} style={{ height: stat.carried * unit }} />
                      )}
                      {stat.decided > 0 && (
                        <span className={`${styles.segment} ${styles.decided}`} style={{ height: stat.decided * unit }} />
                      )}
                    </div>
                    <span className={styles.tick}>{shortDate(stat.date)}</span>
                  </div>
                ))}
              </div>
              <div className={styles.legend}>
                <span className={styles.legendItem}>
                  <span className={`${styles.dot} ${styles.decided}`} />
                  결정
                </span>
                <span className={styles.legendItem}>
                  <span className={`${styles.dot} ${styles.carried}`} />
                  넘김
                </span>
                <span className={styles.legendItem}>
                  <span className={`${styles.dot} ${styles.excluded}`} />
                  제외
                </span>
              </div>
            </>
          )}
        </div>
        <span className={styles.divider} aria-hidden="true" />
        <div className={styles.pending}>
          <div className={styles.pendingHead}>
            <p className={styles.label}>남은 안건</p>
            <span className={styles.countBadge}>{pendingAgendas.length}개</span>
          </div>
          {pendingAgendas.length === 0 ? (
            // MSG-035
            <p className={styles.empty}>남은 안건 없이 다 정했어요.</p>
          ) : (
            <ul className={styles.pendingList}>
              {pendingAgendas.map((agenda) => (
                <li key={agenda.pendingAgendaId} className={styles.pendingRow}>
                  <button
                    type="button"
                    className={styles.pendingText}
                    aria-expanded={openId === agenda.pendingAgendaId}
                    onClick={() => setOpenId((id) => (id === agenda.pendingAgendaId ? null : agenda.pendingAgendaId))}
                  >
                    <span className={openId === agenda.pendingAgendaId ? styles.pendingTitleOpen : styles.pendingTitle}>
                      {agenda.title}
                    </span>
                    {openId === agenda.pendingAgendaId && agenda.decisionPoints.length > 0 && (
                      <ul className={styles.pendingPoints}>
                        {agenda.decisionPoints.map((point) => (
                          <li key={point}>{point}</li>
                        ))}
                      </ul>
                    )}
                    <span className={styles.pendingMeta}>
                      {agenda.fromMeetingTitle}
                      <span className={styles.separator} aria-hidden="true" />
                      {agenda.carriedAt.replaceAll('-', '.')}
                    </span>
                  </button>
                  {/* 디자인: 휴지통. 다음 회의에 이미 불러온 안건은 흐리게 (MSG-089) */}
                  <button
                    type="button"
                    className={styles.discard}
                    aria-label={`${agenda.title} 남은 안건에서 삭제`}
                    title={agenda.isTaken ? PENDING_AGENDA_UNAVAILABLE_MESSAGE : undefined}
                    disabled={agenda.isTaken}
                    onClick={() => onDiscardPending(agenda)}
                  >
                    <Icon src={deleteIcon} size={DELETE_ICON_SIZE} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className={styles.overrunCard} aria-label="예정 시간 초과">
        <div className={styles.head}>
          <p className={styles.label}>예정 시간 초과</p>
          <p className={styles.value}>
            {stats.length === 0 ? '-' : `${stats.length}회 중 ${overruns.length}회 초과`}
            {overruns.length > 0 && <span className={styles.caption}>초과할 때 평균 +{averageOver}분</span>}
          </p>
        </div>
        {stats.length > 0 && (
          <>
            <div className={styles.chart}>
              {stats.map((stat) => (
                <div key={stat.meetingId} className={styles.bar} title={`${stat.title} ${stat.actualMinutes}분 / 예정 ${stat.scheduledMinutes}분`}>
                  <div className={styles.area}>
                    <span
                      className={`${styles.segment} ${stat.actualMinutes > stat.scheduledMinutes ? styles.over : styles.excluded}`}
                      style={{ height: Math.max(2, minuteHeight(stat.actualMinutes)) }}
                    />
                  </div>
                  <span className={styles.tick}>{shortDate(stat.date)}</span>
                </div>
              ))}
              <span className={styles.plannedLine} style={{ bottom: `calc(${minuteHeight(plannedAverage)}px + 24px)` }} />
            </div>
            <div className={styles.legend}>
              <span className={styles.legendItem}>
                <span className={`${styles.dot} ${styles.over}`} />
                예정 초과
              </span>
              <span className={styles.legendItem}>
                <span className={styles.dashed} />
                예정 {plannedAverage}분
              </span>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

// 불러오는 동안 "남은 안건" 옆 개수 배지 자리 (실제 배지 35×24)
const SKELETON_COUNT_WIDTH = 36;
const SKELETON_COUNT_HEIGHT = 24;

/**
 * 폴더 화면을 불러오는 동안의 카드 줄: 카드 틀과 제목("안건 결정률", "남은 안건", "예정 시간 초과")은 진짜로 그리고
 * 차트 등 받아야 아는 내용만 회색. 높이는 다 불러온 카드와 같게 잡는다
 */
export function FolderStatsSkeleton() {
  return (
    <div className={`${styles.row} ${styles.skeletonRow}`} aria-busy="true">
      <section className={styles.agendaCard} aria-label="안건 결정률과 남은 안건">
        <div className={styles.block}>
          <div className={styles.head}>
            <p className={styles.label}>안건 결정률</p>
          </div>
          <Skeleton height="auto" className={styles.skeletonFill} />
        </div>
        <span className={styles.divider} aria-hidden="true" />
        <div className={styles.pending}>
          <div className={styles.pendingHead}>
            <p className={styles.label}>남은 안건</p>
            <Skeleton width={SKELETON_COUNT_WIDTH} height={SKELETON_COUNT_HEIGHT} />
          </div>
          <Skeleton height="auto" className={styles.skeletonFill} />
        </div>
      </section>
      <section className={styles.overrunCard} aria-label="예정 시간 초과">
        <div className={styles.head}>
          <p className={styles.label}>예정 시간 초과</p>
        </div>
        <Skeleton height="auto" className={styles.skeletonFill} />
      </section>
    </div>
  );
}
