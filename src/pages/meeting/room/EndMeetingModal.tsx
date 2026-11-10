import { useState, type ReactNode } from 'react';
import infoIcon from '../../../assets/icons/info.svg';
import Button from '../../../components/Button';
import Checkbox from '../../../components/Checkbox';
import Dialog from '../../../components/Dialog';
import Icon from '../../../components/Icon';
import Spinner from '../../../components/Spinner';
import type { RoomAgenda } from '../../../types/meetingRoom';
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

const INFO_ICON_SIZE = 16;
const SPINNER_SIZE = 20;

const TITLES: Record<EndStep, { title: string; description: string }> = {
  waiting: { title: '회의를 정리하고 있어요', description: '방금 나온 말까지 반영해 결론이 나지 않은 안건을 찾고 있어요' },
  leftover: { title: '결론 나지 않은 안건이 있어요', description: '체크한 안건은 다음 회의로 넘겨요' },
  summary: { title: '회의를 끝내고 회의록을 만들까요?', description: '지금까지 녹음한 내용으로 AI가 회의록 초안을 만들어요' },
};

/** 디자인 InlineAlert (info) */
function InfoNote({ children }: { children: ReactNode }) {
  return (
    <p className={styles.note}>
      <Icon src={infoIcon} size={INFO_ICON_SIZE} />
      {children}
    </p>
  );
}

/**
 * REQ-093~098 회의 끝내기: 정리 기다림 → 결론 나지 않은 안건 → 오늘 회의 요약 → 마무리.
 * 디자인 MeetingEndConfirmPage의 창 모양을 따르고, 단계는 요구사항대로 셋으로 나눈다
 */
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
  // 처음에는 모두 다음 회의로 넘기는 쪽으로 골라 둔다
  const [selected, setSelected] = useState<string[]>(() => leftover.map(({ id }) => id));

  const toggle = (agendaId: string) =>
    setSelected((prev) => (prev.includes(agendaId) ? prev.filter((id) => id !== agendaId) : [...prev, agendaId]));

  const continueButton = (
    <Button type="button" variant="secondary" size="md" disabled={isBusy} onClick={onContinue}>
      계속 회의하기
    </Button>
  );
  const footer: Record<EndStep, ReactNode> = {
    waiting: (
      <>
        {continueButton}
        <Button type="button" variant="primary" size="md" disabled={isBusy} onClick={onFinish}>
          바로 회의 끝내기
        </Button>
      </>
    ),
    leftover: (
      <>
        {continueButton}
        <Button type="button" variant="primary" size="md" disabled={isBusy} onClick={() => onCarryOver(selected)}>
          다음
        </Button>
      </>
    ),
    summary: (
      <>
        {continueButton}
        <Button type="button" variant="primary" size="md" disabled={isBusy} onClick={onFinish}>
          회의 끝내기
        </Button>
      </>
    ),
  };

  return (
    <Dialog
      title={TITLES[step].title}
      description={TITLES[step].description}
      width="md"
      hideClose={isBusy}
      onClose={isBusy ? () => undefined : onContinue}
      footer={footer[step]}
    >
      <div className={styles.body}>
        {step === 'waiting' && (
          <p className={styles.waiting}>
            <Spinner size={SPINNER_SIZE} />
            회의 내용을 정리하는 중이에요
          </p>
        )}

        {step === 'leftover' && (
          <>
            <ul className={styles.agendaList}>
              {leftover.map((agenda) => (
                <li key={agenda.id} className={styles.agenda}>
                  <Checkbox
                    className={styles.agendaHead}
                    checked={selected.includes(agenda.id)}
                    disabled={isBusy}
                    onChange={() => toggle(agenda.id)}
                  >
                    <span className={styles.agendaTitle}>{agenda.title}</span>
                    <StatusPill status={agenda.status} soft />
                  </Checkbox>
                  {agenda.summary.length > 0 && <p className={styles.agendaSummary}>{agenda.summary.join(' ')}</p>}
                </li>
              ))}
            </ul>
            <InfoNote>지금 결정하려면 [계속 회의하기]를 눌러 이어서 논의해요</InfoNote>
          </>
        )}

        {step === 'summary' && summary === null && (
          <p className={styles.waiting}>
            <Spinner size={SPINNER_SIZE} />
            오늘 회의 요약을 만들고 있어요
          </p>
        )}

        {step === 'summary' && summary !== null && (
          <>
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
            {carriedIds.length > 0 && <InfoNote>결론 나지 않은 안건은 다음 회의로 넘겨져요</InfoNote>}
          </>
        )}
      </div>
    </Dialog>
  );
}
