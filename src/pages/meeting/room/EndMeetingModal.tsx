import { useId, useState } from 'react';
import Modal from '../../../components/Modal';
import type { RoomAgenda } from '../../../types/meetingRoom';
import room from './room.module.css';
import StatusPill from './StatusPill';
import TodoList from './TodoList';
import styles from './EndMeetingModal.module.css';

export type EndStep = 'waiting' | 'leftover' | 'summary';

interface EndMeetingModalProps {
  step: EndStep;
  /** REQ-093 결론이 나지 않은 안건 */
  leftover: RoomAgenda[];
  /** REQ-097 오늘 회의 요약 (안건별). 아직 오지 않았으면 null */
  summary: RoomAgenda[] | null;
  /** 이번에 다음 회의로 넘긴 안건 */
  carriedIds: string[];
  isBusy: boolean;
  /** REQ-095 이어서 논의하기 */
  onContinue: () => void;
  /** REQ-094 고른 안건을 다음 회의로 넘기고 오늘 회의 요약으로 */
  onCarryOver: (agendaIds: string[]) => void;
  /** REQ-098 마무리 */
  onFinish: () => void;
}

/** REQ-093~098 회의 끝내기: 정리 기다림 → 결론 나지 않은 안건 → 오늘 회의 요약 → 마무리 (임시 디자인) */
export default function EndMeetingModal({
  step,
  leftover,
  summary,
  carriedIds,
  isBusy,
  onContinue,
  onCarryOver,
  onFinish,
}: EndMeetingModalProps) {
  const titleId = useId();
  // 처음에는 모두 다음 회의로 넘기는 쪽으로 골라 둔다
  const [selected, setSelected] = useState<string[]>(() => leftover.map(({ id }) => id));

  const toggle = (agendaId: string) =>
    setSelected((prev) => (prev.includes(agendaId) ? prev.filter((id) => id !== agendaId) : [...prev, agendaId]));

  return (
    <Modal labelledBy={titleId} onClose={isBusy ? undefined : onContinue} className={styles.card}>
      {step === 'waiting' && (
        <>
          <h2 id={titleId} className={styles.title}>
            회의를 정리하고 있어요
          </h2>
          <p className={styles.waiting}>
            <span className={styles.spinner} aria-hidden="true" />
            방금 나온 말까지 반영해 결론이 나지 않은 안건을 찾고 있어요.
          </p>
          <div className={room.pillRow}>
            <button type="button" className={`${room.pill} ${room.pillOutline}`} disabled={isBusy} onClick={onContinue}>
              이어서 논의하기
            </button>
            <button type="button" className={`${room.pill} ${room.pillPrimary}`} disabled={isBusy} onClick={onFinish}>
              바로 마무리
            </button>
          </div>
        </>
      )}

      {step === 'leftover' && (
        <>
          <h2 id={titleId} className={styles.title}>
            결론이 나지 않은 안건이 있어요
          </h2>
          <p className={styles.caption}>체크한 안건은 다음 회의로 넘겨요. 지금 결정하려면 [이어서 논의하기]를 눌러 주세요.</p>
          <ul className={styles.agendaList}>
            {leftover.map((agenda) => (
              <li key={agenda.id} className={styles.agenda}>
                <label className={styles.agendaHead}>
                  <input
                    type="checkbox"
                    checked={selected.includes(agenda.id)}
                    disabled={isBusy}
                    onChange={() => toggle(agenda.id)}
                  />
                  <span className={styles.agendaTitle}>{agenda.title}</span>
                  <StatusPill status={agenda.status} soft />
                </label>
                {agenda.summary.length > 0 && <p className={styles.agendaSummary}>{agenda.summary.join(' ')}</p>}
              </li>
            ))}
          </ul>
          <div className={room.pillRow}>
            <button type="button" className={`${room.pill} ${room.pillOutline}`} disabled={isBusy} onClick={onContinue}>
              이어서 논의하기
            </button>
            <button
              type="button"
              className={`${room.pill} ${room.pillPrimary}`}
              disabled={isBusy}
              onClick={() => onCarryOver(selected)}
            >
              다음
            </button>
          </div>
        </>
      )}

      {step === 'summary' && (
        <>
          <h2 id={titleId} className={styles.title}>
            오늘 회의 요약
          </h2>
          {summary === null ? (
            <p className={styles.waiting}>
              <span className={styles.spinner} aria-hidden="true" />
              오늘 회의 요약을 만들고 있어요.
            </p>
          ) : (
            <ul className={styles.agendaList}>
              {summary.map((agenda) => {
                const decisions = agenda.decisionPoints.filter(({ summary: text }) => text);
                return (
                  <li key={agenda.id} className={styles.agenda}>
                    <div className={styles.agendaHead}>
                      <span className={styles.agendaTitle}>{agenda.title}</span>
                      <StatusPill status={agenda.status} soft />
                      {carriedIds.includes(agenda.id) && <span className={styles.carried}>다음 회의로 넘김</span>}
                    </div>
                    {decisions.length > 0 && (
                      <div className={styles.section}>
                        <p className={styles.label}>결정</p>
                        <ul className={styles.bullets}>
                          {decisions.map((decision) => (
                            <li key={decision.id}>
                              {decision.title}: {decision.summary}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {agenda.summary.length > 0 && (
                      <div className={styles.section}>
                        <p className={styles.label}>논의 내용</p>
                        <p className={styles.agendaSummary}>{agenda.summary.join(' ')}</p>
                      </div>
                    )}
                    {agenda.todos.length > 0 && (
                      <div className={styles.section}>
                        <p className={styles.label}>할 일</p>
                        <TodoList todos={agenda.todos} />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <div className={room.pillRow}>
            <button type="button" className={`${room.pill} ${room.pillOutline}`} disabled={isBusy} onClick={onContinue}>
              이어서 논의하기
            </button>
            <button type="button" className={`${room.pill} ${room.pillPrimary}`} disabled={isBusy} onClick={onFinish}>
              마무리
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
