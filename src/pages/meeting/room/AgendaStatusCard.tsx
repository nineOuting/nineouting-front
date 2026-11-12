import { Fragment, useRef, useState } from 'react';
import addIcon from '../../../assets/icons/add-plain.svg';
import agendaIcon from '../../../assets/icons/agenda-status.svg';
import createIcon from '../../../assets/icons/create-sm.svg';
import deleteIcon from '../../../assets/icons/delete-sm.svg';
import moreIcon from '../../../assets/icons/more-vert.svg';
import type { DecisionStatusEdit } from '../../../api/meeting';
import Icon from '../../../components/Icon';
import type { RoomAgenda } from '../../../types/meetingRoom';
import ActionMenu from '../../workspace/ActionMenu';
import DecisionItem from './DecisionItem';
import room from './room.module.css';
import StatusPill from './StatusPill';
import styles from './AgendaStatusCard.module.css';

const TITLE_ICON_SIZE = 24;

interface AgendaStatusCardProps {
  agendas: RoomAgenda[];
  selectedAgendaId: string;
  selectedDecisionId?: string;
  canEdit: boolean;
  onSelectAgenda: (agendaId: string) => void;
  onSelectDecision: (decisionId: string) => void;
  onSaveDecision: (decisionId: string, summary: string) => void;
  /** 결정할 사항 상태 정하기 (회의록 작성자) */
  onChangeDecisionStatus: (agendaId: string, decisionId: string, status: DecisionStatusEdit) => void;
  /** 안건 전체를 결정으로, 미결로 */
  onChangeAgendaStatus: (agendaId: string, status: DecisionStatusEdit) => void;
  onAddAgenda: () => void;
  /** REQ-173 회의록 작성자의 안건 수정하기, 안건 삭제 */
  onRenameAgenda: (agendaId: string) => void;
  onDeleteAgenda: (agendaId: string) => void;
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
  onChangeDecisionStatus,
  onChangeAgendaStatus,
  onAddAgenda,
  onRenameAgenda,
  onDeleteAgenda,
}: AgendaStatusCardProps) {
  const selectedAgenda = agendas.find(({ id }) => id === selectedAgendaId);
  const [menuAgendaId, setMenuAgendaId] = useState<string | null>(null);
  const menuAnchorRef = useRef<HTMLButtonElement | null>(null);

  return (
    <section className={styles.card} aria-labelledby="agenda-status-title">
      <div className={styles.head}>
        <div className={room.titleRow}>
          <Icon src={agendaIcon} size={TITLE_ICON_SIZE} className={room.titleIcon} />
          <h2 id="agenda-status-title" className={room.title}>
            안건 현황
          </h2>
        </div>
        {canEdit && (
          <button type="button" className={room.iconButton} aria-label="안건 추가" onClick={onAddAgenda}>
            <Icon src={addIcon} size={20} />
          </button>
        )}
      </div>
      <div className={room.divider} />

      <div className={styles.body}>
        <ul className={styles.agendaList}>
          {agendas.map((agenda) => (
            <Fragment key={agenda.id}>
              <li className={styles.agendaRow}>
                <button
                  type="button"
                  aria-pressed={agenda.id === selectedAgendaId}
                  className={[styles.agenda, agenda.id === selectedAgendaId ? styles.agendaSelected : '']
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => onSelectAgenda(agenda.id)}
                >
                  <span className={styles.agendaTitle}>
                    {agenda.title}
                  </span>
                  <StatusPill status={agenda.status} />
                </button>
                {canEdit && (
                  <span className={styles.menuAnchor}>
                    <button
                      ref={menuAgendaId === agenda.id ? menuAnchorRef : undefined}
                      type="button"
                      className={room.iconButton}
                      aria-label={`${agenda.title} 메뉴`}
                      aria-haspopup="menu"
                      aria-expanded={menuAgendaId === agenda.id}
                      onClick={() => setMenuAgendaId((current) => (current === agenda.id ? null : agenda.id))}
                    >
                      <Icon src={moreIcon} size={20} />
                    </button>
                    {menuAgendaId === agenda.id && (
                      <ActionMenu
                        label={`${agenda.title} 메뉴`}
                        anchorRef={menuAnchorRef}
                        className={styles.agendaMenu}
                        items={[
                          { label: '안건 수정하기', icon: createIcon, onSelect: () => onRenameAgenda(agenda.id) },
                          { label: '이 안건 전체를 결정으로', icon: createIcon, onSelect: () => onChangeAgendaStatus(agenda.id, 'DECIDED') },
                          { label: '이 안건 전체를 미결로', icon: createIcon, onSelect: () => onChangeAgendaStatus(agenda.id, 'UNDECIDED') },
                          ...(agenda.decisionPoints.some(({ statusEdited }) => statusEdited)
                            ? [{ label: '이 안건 AI 판정으로 되돌리기', icon: createIcon, onSelect: () => onChangeAgendaStatus(agenda.id, 'AUTO') }]
                            : []),
                          ...(agendas.length > 1
                            ? [{ label: '안건 삭제', icon: deleteIcon, isDanger: true, onSelect: () => onDeleteAgenda(agenda.id) }]
                            : []),
                        ].map((item) => ({
                          ...item,
                          onSelect: () => {
                            setMenuAgendaId(null);
                            item.onSelect();
                          },
                        }))}
                        onClose={() => setMenuAgendaId(null)}
                      />
                    )}
                  </span>
                )}
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
                    onChangeStatus={(status) => onChangeDecisionStatus(selectedAgenda.id, decision.id, status)}
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
