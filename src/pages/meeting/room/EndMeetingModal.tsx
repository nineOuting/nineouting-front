import { useState, type KeyboardEvent, type ReactNode } from 'react';
import type { DecisionStatusEdit } from '../../../api/meeting';
import editIcon from '../../../assets/icons/create-sm.svg';
import infoIcon from '../../../assets/icons/info.svg';
import Button from '../../../components/Button';
import Checkbox from '../../../components/Checkbox';
import Dialog from '../../../components/Dialog';
import Icon from '../../../components/Icon';
import Spinner from '../../../components/Spinner';
import type { DecisionPoint, DecisionStatus, RoomAgenda, RoomSummaryItem, RoomTodo } from '../../../types/meetingRoom';
import DecisionStatusButtons from './DecisionStatusButtons';
import room from './room.module.css';
import StatusPill from './StatusPill';
import TodoList, { type TodoChange } from './TodoList';
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
  /**
   * viewer: 회의록 작성자가 아닌 참석자. 작성자가 회의를 끝내려 하면 같은 요약을 읽기 전용으로 본다 (REQ-097 "다 같이 보며").
   * 닫으면 onContinue 대신 onClose를 부른다
   */
  isViewer?: boolean;
  /** REQ-095 이어서 논의하기 */
  onContinue: () => void;
  /** REQ-094 고른 안건을 다음 회의로 넘기고 오늘 회의 요약으로 */
  onCarryOver: (agendaIds: string[]) => void;
  /** REQ-098 마무리 */
  onFinish: () => void;
  onClose?: () => void;
  /** REQ-097 확인, 수정 (회의록 작성자). 넘기지 않으면 읽기만 */
  onChangeDecisionStatus?: (agendaId: string, decisionId: string, status: DecisionStatusEdit) => void;
  onSaveDecision?: (decisionId: string, text: string) => void;
  onSaveSummary?: (agendaId: string, item: RoomSummaryItem, text: string) => void;
  onSaveTodo?: (agendaId: string, todo: RoomTodo, change: TodoChange) => void;
}

const INFO_ICON_SIZE = 16;
const SPINNER_SIZE = 20;
const EDIT_ICON_SIZE = 16;

const TITLES: Record<EndStep, { title: string; description: string }> = {
  waiting: { title: '회의를 정리하고 있어요', description: '방금 나온 말까지 반영해 결론이 나지 않은 안건을 찾고 있어요' },
  leftover: { title: '회의를 끝낼까요?', description: '결론이 나지 않은 안건이 있어요. 다음 회의로 넘길 안건을 골라 주세요.' },
  summary: { title: '회의를 끝내고 회의록을 만들까요?', description: '오늘 회의 요약을 확인하고, 틀린 곳은 고친 뒤 끝내 주세요' },
};

const VIEWER_TITLES: Record<EndStep, { title: string; description: string }> = {
  waiting: { title: '회의를 정리하고 있어요', description: '회의록 작성자가 회의를 끝내려고 해요' },
  leftover: { title: '회의를 정리하고 있어요', description: '회의록 작성자가 결론 나지 않은 안건을 정하고 있어요' },
  summary: { title: '오늘 회의 요약', description: '회의록 작성자가 회의를 끝내려고 해요. 함께 확인해 주세요' },
};

/** 결정할 사항을 상태별로 나눠 보여 준다. 위에서부터 이 순서 */
const DECISION_GROUPS: { status: DecisionStatus; label: string }[] = [
  { status: 'decided', label: '결정' },
  { status: 'decisionCheck', label: '결정 확인 필요' },
  { status: 'undecided', label: '미결' },
  { status: 'notDiscussed', label: '논의 전' },
];

/** 디자인 InlineAlert (info) */
function InfoNote({ children }: { children: ReactNode }) {
  return (
    <p className={styles.note}>
      <Icon src={infoIcon} size={INFO_ICON_SIZE} />
      {children}
    </p>
  );
}

/** 글 한 줄. onSave를 넘기면 연필을 눌러 바로 고친다 (Enter 저장, Esc 취소) */
function EditableLine({ text, label, onSave }: { text: string; label: string; onSave?: (text: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const finish = () => {
    if (draft !== null && draft.trim() && draft.trim() !== text) {
      onSave?.(draft.trim());
    }
    setDraft(null);
  };
  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      finish();
    } else if (event.key === 'Escape') {
      setDraft(null);
    }
  };
  if (draft !== null) {
    return (
      <input
        className={styles.lineInput}
        aria-label={`${label} 고치기`}
        value={draft}
        autoFocus
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={keyDown}
        onBlur={finish}
      />
    );
  }
  return (
    <span className={styles.line}>
      <span>{text}</span>
      {onSave && (
        <button type="button" className={room.iconButton} aria-label={`${label} 고치기`} onClick={() => setDraft(text)}>
          <Icon src={editIcon} size={EDIT_ICON_SIZE} />
        </button>
      )}
    </span>
  );
}

function DecisionRow({
  agendaId,
  decision,
  onChangeStatus,
  onSave,
}: {
  agendaId: string;
  decision: DecisionPoint;
  onChangeStatus?: EndMeetingModalProps['onChangeDecisionStatus'];
  onSave?: EndMeetingModalProps['onSaveDecision'];
}) {
  return (
    <li className={styles.decision}>
      <span className={styles.decisionTitle}>
        {decision.title}
        {decision.statusEdited && !onChangeStatus && <span className={styles.badge}>직접 정함</span>}
        {decision.needsCheck && <span className={styles.check}>확인 필요</span>}
      </span>
      {decision.summary && (
        <EditableLine
          text={decision.summary}
          label={`${decision.title} 결정 내용`}
          onSave={onSave && ((text) => onSave(decision.id, text))}
        />
      )}
      {decision.status === 'decided' && decision.evidenceSeqs.length === 0 && (
        <span className={styles.noEvidence}>근거 발언이 없어요</span>
      )}
      {onChangeStatus && (
        <DecisionStatusButtons decision={decision} onChange={(status) => onChangeStatus(agendaId, decision.id, status)} />
      )}
    </li>
  );
}

/**
 * REQ-093~098 회의 끝내기: 정리 기다림 → 결론 나지 않은 안건 → 오늘 회의 요약 → 마무리.
 * 디자인 MeetingEndConfirmPage의 창 모양을 따르고, 단계는 요구사항대로 셋으로 나눈다.
 * 요약 단계에서 작성자는 결정할 사항의 상태와 결정 내용, 요약 문장, 할 일을 고친다 (임시 디자인)
 */
export default function EndMeetingModal({
  step,
  leftover,
  summary,
  carriedIds,
  isBusy,
  isViewer = false,
  onContinue,
  onCarryOver,
  onFinish,
  onClose,
  onChangeDecisionStatus,
  onSaveDecision,
  onSaveSummary,
  onSaveTodo,
}: EndMeetingModalProps) {
  // 처음에는 모두 다음 회의로 넘기는 쪽으로 골라 둔다
  const [selected, setSelected] = useState<string[]>(() => leftover.map(({ id }) => id));

  const toggle = (agendaId: string) =>
    setSelected((prev) => (prev.includes(agendaId) ? prev.filter((id) => id !== agendaId) : [...prev, agendaId]));

  const continueButton = (
    <Button type="button" variant="secondary" size="md" disabled={isBusy} onClick={onContinue}>
      이어서 논의하기
    </Button>
  );
  const footer: Record<EndStep, ReactNode> = {
    waiting: (
      <>
        {continueButton}
        <Button isLoading={isBusy} type="button" variant="primary" size="md" disabled={isBusy} onClick={onFinish}>
          바로 회의 끝내기
        </Button>
      </>
    ),
    leftover: (
      <>
        {continueButton}
        <Button isLoading={isBusy} type="button" variant="primary" size="md" disabled={isBusy} onClick={() => onCarryOver(selected)}>
          다음
        </Button>
      </>
    ),
    summary: (
      <>
        {continueButton}
        <Button isLoading={isBusy} type="button" variant="primary" size="md" disabled={isBusy} onClick={onFinish}>
          회의 끝내기
        </Button>
      </>
    ),
  };
  const viewerFooter = (
    <Button type="button" variant="secondary" size="md" onClick={onClose}>
      닫기
    </Button>
  );
  const titles = isViewer ? VIEWER_TITLES : TITLES;
  // 참석자는 남은 안건 고르기를 하지 않는다. 요약이 오기 전에는 기다림만 보인다
  const shownStep: EndStep = isViewer && step === 'leftover' ? 'waiting' : step;

  return (
    <Dialog
      title={titles[shownStep].title}
      description={
        shownStep === 'leftover' && !isViewer
          ? `결론이 나지 않은 안건이 ${leftover.length}개 있어요. 다음 회의로 넘길 안건을 골라 주세요.`
          : titles[shownStep].description
      }
      onBack={!isViewer && !isBusy ? onContinue : undefined}
      width="md"
      hideClose={!isViewer && isBusy}
      onClose={isViewer ? (onClose ?? (() => undefined)) : isBusy ? () => undefined : onContinue}
      footer={isViewer ? viewerFooter : footer[shownStep]}
    >
      <div className={styles.body}>
        {shownStep === 'waiting' && (
          <p className={styles.waiting}>
            <Spinner size={SPINNER_SIZE} />
            {isViewer ? '작성자가 회의를 정리하고 있어요' : '회의 내용을 정리하는 중이에요'}
          </p>
        )}

        {shownStep === 'leftover' && (
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
            <InfoNote>고른 안건은 폴더의 "남은 안건"에 저장돼요. 회의를 끝내면 녹음이 멈추고 회의록 초안을 만들어요</InfoNote>
          </>
        )}

        {shownStep === 'summary' && summary === null && (
          <p className={styles.waiting}>
            <Spinner size={SPINNER_SIZE} />
            오늘 회의 요약을 만들고 있어요
          </p>
        )}

        {shownStep === 'summary' && summary !== null && (
          <>
            <ul className={styles.agendaList}>
              {summary.map((agenda) => {
                const summaryItems: RoomSummaryItem[] =
                  agenda.summaryItems ?? agenda.summary.map((text, index) => ({ id: String(index), text, evidenceSeqs: [] }));
                return (
                  <li key={agenda.id} className={styles.agenda}>
                    <div className={styles.agendaHead}>
                      <span className={styles.agendaTitle}>{agenda.title}</span>
                      <StatusPill status={agenda.status} soft />
                      {carriedIds.includes(agenda.id) && <span className={styles.carried}>다음 회의로 넘김</span>}
                    </div>
                    {DECISION_GROUPS.map(({ status, label }) => {
                      const decisions = agenda.decisionPoints.filter((decision) => decision.status === status);
                      if (decisions.length === 0) {
                        return null;
                      }
                      return (
                        <div key={status} className={styles.section}>
                          <p className={styles.label}>{label}</p>
                          <ul className={styles.decisions}>
                            {decisions.map((decision) => (
                              <DecisionRow
                                key={decision.id}
                                agendaId={agenda.id}
                                decision={decision}
                                onChangeStatus={onChangeDecisionStatus}
                                onSave={onSaveDecision}
                              />
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                    {summaryItems.length > 0 && (
                      <div className={styles.section}>
                        <p className={styles.label}>논의 내용</p>
                        <ul className={styles.bullets}>
                          {summaryItems.map((item) => (
                            <li key={item.id}>
                              <EditableLine
                                text={item.text}
                                label="요약 문장"
                                onSave={onSaveSummary && agenda.summaryItems && ((text) => onSaveSummary(agenda.id, item, text))}
                              />
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {agenda.todos.length > 0 && (
                      <div className={styles.section}>
                        <p className={styles.label}>할 일</p>
                        <TodoList
                          todos={agenda.todos}
                          onSave={onSaveTodo && ((todo, change) => onSaveTodo(agenda.id, todo, change))}
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {carriedIds.length > 0 && <InfoNote>결론 나지 않은 안건은 다음 회의로 넘겨져요</InfoNote>}
            {!isViewer && onChangeDecisionStatus && (
              <InfoNote>결정, 미결을 직접 정하면 그 사항은 AI가 바꾸지 않아요. [AI 판정으로]를 누르면 다시 AI가 정해요</InfoNote>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}
