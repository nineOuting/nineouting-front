import { Fragment } from 'react';
import dividerAgendaList from '../../../assets/divider-agenda-list.svg';
import dividerSummary from '../../../assets/divider-summary.svg';
import Placeholder from '../../../components/Placeholder';
import type { RoomAgenda } from '../../../types/meetingRoom';
import DecisionItem from './DecisionItem';
import room from './room.module.css';
import StatusPill from './StatusPill';
import styles from './AgendaStatusCard.module.css';

const TITLE_ICON_SIZE = 24;
const AGENDA_ICON_SIZE = 24;

interface AgendaStatusCardProps {
  agendas: RoomAgenda[];
  selectedAgendaId: string;
  selectedDecisionId?: string;
  canEdit: boolean;
  onSelectAgenda: (agendaId: string) => void;
  onSelectDecision: (decisionId: string) => void;
  onSaveDecision: (decisionId: string, summary: string) => void;
  onAddAgenda: () => void;
}

/** REQ-086, 124, 090 안건 현황. 왼쪽은 안건과 상태, 오른쪽은 고른 안건의 결정할 사항 */
export default function AgendaStatusCard({
  agendas,
  selectedAgendaId,
  selectedDecisionId,
  canEdit,
  onSelectAgenda,
  onSelectDecision,
  onSaveDecision,
  onAddAgenda,
}: AgendaStatusCardProps) {
  const selectedAgenda = agendas.find(({ id }) => id === selectedAgendaId);

  return (
    <section className={styles.card} aria-labelledby="agenda-status-title">
      <div className={styles.head}>
        <div className={room.titleRow}>
          <Placeholder size={TITLE_ICON_SIZE} />
          <h2 id="agenda-status-title" className={room.title}>
            안건 현황
          </h2>
        </div>
        {canEdit && (
          <button type="button" className={room.iconButton} aria-label="안건 추가" onClick={onAddAgenda}>
            <Placeholder size={TITLE_ICON_SIZE} />
          </button>
        )}
      </div>
      <img src={dividerSummary} alt="" width={740} height={1} className={room.divider} />

      <div className={styles.body}>
        <ul className={styles.agendaList}>
          {agendas.map((agenda, index) => (
            <Fragment key={agenda.id}>
              {index > 0 && (
                <li aria-hidden="true" className={styles.separator}>
                  <img src={dividerAgendaList} alt="" width={292} height={1} className={room.divider} />
                </li>
              )}
              <li>
                <button
                  type="button"
                  aria-pressed={agenda.id === selectedAgendaId}
                  className={[styles.agenda, agenda.id === selectedAgendaId ? styles.agendaSelected : '']
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => onSelectAgenda(agenda.id)}
                >
                  <span className={styles.agendaTitle}>
                    <Placeholder size={AGENDA_ICON_SIZE} />
                    {agenda.title}
                  </span>
                  <StatusPill status={agenda.status} />
                </button>
              </li>
            </Fragment>
          ))}
        </ul>

        <div className={styles.detail}>
          {selectedAgenda && (
            <>
              <p className={styles.detailTitle}>{selectedAgenda.title}</p>
              <p className={styles.detailCaption}>결정 내용을 선택해서 근거 발언을 확인할 수 있어요</p>
              <ul className={styles.decisions}>
                {selectedAgenda.decisionPoints.map((decision) => (
                  <DecisionItem
                    key={decision.id}
                    decision={decision}
                    isSelected={decision.id === selectedDecisionId}
                    canEdit={canEdit}
                    onSelect={() => onSelectDecision(decision.id)}
                    onSave={(summary) => onSaveDecision(decision.id, summary)}
                  />
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
