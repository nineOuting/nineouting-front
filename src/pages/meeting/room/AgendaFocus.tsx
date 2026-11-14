import { useCallback, useRef, useState, type ReactNode } from 'react';
import type { DecisionStatusEdit } from '../../../api/meeting';
import addIcon from '../../../assets/icons/add-sm.svg';
import checkIcon from '../../../assets/icons/check.svg';
import editIcon from '../../../assets/icons/edit.svg';
import moreIcon from '../../../assets/icons/more-vert.svg';
import pauseIcon from '../../../assets/icons/pause.svg';
import refreshIcon from '../../../assets/icons/refresh.svg';
import todoIcon from '../../../assets/icons/agenda-status.svg';
import transcriptIcon from '../../../assets/icons/transcript.svg';
import Icon from '../../../components/Icon';
import type { AgendaStatus, DecisionPoint, RoomAgenda, RoomTodo } from '../../../types/meetingRoom';
import ActionMenu from '../../workspace/ActionMenu';
import TodoList, { type TodoChange } from './TodoList';
import styles from './AgendaFocus.module.css';

const ICON_SIZE = 16;
// MSG-030
const EMPTY_SUMMARY_MESSAGE = '결정 내용을 입력해 주세요.';

const AGENDA_STATUS_LABELS: Record<AgendaStatus, string> = {
  decided: '결정된 안건',
  discussing: '지금 논의 중',
  undecided: '미결 안건',
  notStarted: '아직 논의 전',
  decisionCheck: '결정 확인 필요',
};

/** 안건을 언제부터 얼마나 논의했는지 (전사 줄의 안건 분류로 계산) */
export interface AgendaTiming {
  /** 14:12 */
  since: string;
  minutes: number;
}

type CardState = DecisionPoint['status'] | 'discussing';

interface DecisionCardProps {
  decision: DecisionPoint;
  state: CardState;
  discussingMinutes?: number;
  isPaused: boolean;
  isSelected: boolean;
  canEdit: boolean;
  onSelect: () => void;
  onSave: (summary: string) => void;
  onChangeStatus: (status: DecisionStatusEdit) => void;
}

/**
 * 디자인 Version02 DecisionCard: 결정(초록), 지금 이야기 중(보라), 미결(주황), 논의 전(점선).
 * 회의록 작성자는 ⋮ 메뉴로 결정 확정·결정 내용 수정·근거 보기를 하고, 수정은 카드 안에서 바로 한다 (REQ-124~126)
 */
function DecisionCard({
  decision,
  state,
  discussingMinutes,
  isPaused,
  isSelected,
  canEdit,
  onSelect,
  onSave,
  onChangeStatus,
}: DecisionCardProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuAnchorRef = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => setIsMenuOpen(false), []);
  const isEditing = draft !== null;

  const save = () => {
    if (draft === null) {
      return;
    }
    if (!draft.trim()) {
      setError(EMPTY_SUMMARY_MESSAGE);
      return;
    }
    onSave(draft.trim());
    setDraft(null);
    setError(undefined);
  };

  if (isEditing) {
    // 디자인 Live_11 결정 내용 수정: 카드가 펼쳐져 결정할 사항과 결정 내용을 보여 준다
    return (
      <li className={`${styles.decision} ${styles.discussing} ${styles.editingCard}`}>
        <p className={styles.editHeading}>결정 내용 수정</p>
        <label className={styles.editField}>
          <span className={styles.editLabel}>결정할 사항</span>
          <input className={styles.input} value={decision.title} readOnly />
        </label>
        <label className={styles.editField}>
          <span className={styles.editLabel}>결정 내용</span>
          <input
            className={`${styles.input} ${styles.inputFocus}`}
            value={draft}
            placeholder="정한 내용을 한 줄로 적어 주세요"
            autoFocus
            onChange={(event) => {
              setDraft(event.target.value);
              setError(undefined);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                save();
              } else if (event.key === 'Escape') {
                setDraft(null);
              }
            }}
          />
        </label>
        {error && <p className={styles.error}>{error}</p>}
        <div className={styles.editFooter}>
          <span className={styles.editNote}>수정하면 참석자 화면과 회의록에 바로 반영돼요</span>
          <button type="button" className={styles.textButton} onClick={() => setDraft(null)}>
            취소
          </button>
          <button type="button" className={styles.smallSecondary} onClick={save}>
            저장
          </button>
        </div>
      </li>
    );
  }

  const caption =
    state === 'discussing'
      ? isPaused
        ? '일시정지 중 · 다시 시작하면 이어서 정리해요'
        : ['지금 이야기하고 있어요', discussingMinutes !== undefined ? `${discussingMinutes}분째` : ''].filter(Boolean).join(' · ')
      : state === 'undecided'
        ? ['미결', decision.summary].filter(Boolean).join(' · ')
        : state === 'decisionCheck' || decision.needsCheck
          ? '결정인지 확인해 주세요'
          : state === 'decided'
            ? decision.summary
            : undefined;

  const menuItems = [
    state === 'decided'
      ? { label: '미결로 되돌리기', icon: pauseIcon, onSelect: () => onChangeStatus('UNDECIDED') }
      : { label: '결정으로 확정하기', icon: checkIcon, onSelect: () => onChangeStatus('DECIDED') },
    { label: '결정 내용 수정하기', icon: editIcon, onSelect: () => setDraft(decision.summary ?? '') },
    { label: '근거 발언 보기', icon: transcriptIcon, onSelect: onSelect },
    ...(decision.statusEdited ? [{ label: 'AI 판정으로 되돌리기', icon: refreshIcon, onSelect: () => onChangeStatus('AUTO') }] : []),
  ];

  return (
    <li className={[styles.decision, styles[state], isSelected ? styles.selected : ''].filter(Boolean).join(' ')}>
      <button type="button" className={styles.decisionMain} aria-pressed={isSelected} onClick={onSelect}>
        <span className={styles.statusIcon} aria-hidden="true">
          {state === 'decided' && <Icon src={checkIcon} size={ICON_SIZE} />}
          {(state === 'undecided' || state === 'decisionCheck') && <Icon src={pauseIcon} size={ICON_SIZE - 4} />}
          {state === 'discussing' && <span className={styles.radioDot} />}
        </span>
        <span className={styles.decisionTexts}>
          <span className={styles.decisionTitle}>{decision.title}</span>
          {caption && <span className={styles.decisionCaption}>{caption}</span>}
        </span>
      </button>
      {canEdit && (
        <div className={styles.decisionActions}>
          <button
            ref={menuAnchorRef}
            type="button"
            className={[styles.moreButton, isMenuOpen ? styles.moreButtonActive : ''].filter(Boolean).join(' ')}
            aria-label={`${decision.title} 메뉴`}
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            <Icon src={moreIcon} size={ICON_SIZE} />
          </button>
          {isMenuOpen && (
            <ActionMenu
              label={`${decision.title} 메뉴`}
              anchorRef={menuAnchorRef}
              className={styles.cardMenu}
              items={menuItems.map((item) => ({
                ...item,
                onSelect: () => {
                  closeMenu();
                  item.onSelect();
                },
              }))}
              onClose={closeMenu}
            />
          )}
        </div>
      )}
    </li>
  );
}

interface AgendaFocusProps {
  agenda?: RoomAgenda;
  isCurrent: boolean;
  isPaused: boolean;
  isAiAvailable: boolean;
  timing?: AgendaTiming;
  selectedDecisionId?: string;
  canEdit: boolean;
  /** REQ-172 AI 결과 안내 줄 */
  notice?: ReactNode;
  onSelectDecision: (decisionId: string | undefined) => void;
  onSaveDecision: (decisionId: string, summary: string) => void;
  onChangeDecisionStatus: (decisionId: string, status: DecisionStatusEdit) => void;
  /** 결정할 사항 더하기 (아직 서버 API가 없어 안내만 한다) */
  onAddDecision?: () => void;
  onSaveTodo: (todo: RoomTodo, change: TodoChange) => void;
}

/** 디자인 Version02 Live 가운데: 고른 안건의 결정할 사항, 이 안건 요약(주요 의견·합의되지 않은 부분), 할 일 */
export default function AgendaFocus({
  agenda,
  isCurrent,
  isPaused,
  isAiAvailable,
  timing,
  selectedDecisionId,
  canEdit,
  notice,
  onSelectDecision,
  onSaveDecision,
  onChangeDecisionStatus,
  onAddDecision,
  onSaveTodo,
}: AgendaFocusProps) {
  if (!agenda) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>안건을 골라 주세요</p>
        <p className={styles.emptyText}>왼쪽 목록에서 안건을 누르면 결정할 사항과 요약을 볼 수 있어요</p>
      </div>
    );
  }

  const decided = agenda.decisionPoints.filter(({ status }) => status === 'decided').length;
  const undecided = agenda.decisionPoints.filter(({ status }) => status === 'undecided').length;
  const hasSummary = agenda.summary.length > 0 || agenda.opinions.length > 0 || agenda.openIssues.length > 0;
  // 지금 논의 중인 안건이면 아직 정하지 않은 첫 결정할 사항을 "지금 이야기하고 있어요"로 보여 준다
  const discussingId = isCurrent ? agenda.decisionPoints.find(({ status }) => status === 'notDiscussed')?.id : undefined;

  return (
    <div className={styles.focus}>
      <div className={styles.head}>
        <p className={[styles.state, isCurrent ? styles.stateLive : ''].filter(Boolean).join(' ')}>
          {isCurrent && <span className={styles.liveDot} aria-hidden="true" />}
          {isCurrent ? '지금 논의 중' : AGENDA_STATUS_LABELS[agenda.status]}
          {timing && (
            <span className={styles.timing}>
              · {timing.since}부터 {timing.minutes}분{isCurrent ? '째' : ' 논의'}
            </span>
          )}
        </p>
        <h1 className={styles.title}>{agenda.title}</h1>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>결정할 사항</h2>
          <span className={styles.sectionMeta}>
            {agenda.decisionPoints.length}개 중 {decided}개 결정{undecided > 0 ? ` · ${undecided}개 미결` : ''}
          </span>
          {canEdit && onAddDecision && (
            <button type="button" className={styles.iconButton} aria-label="결정할 사항 추가" onClick={onAddDecision}>
              <Icon src={addIcon} size={ICON_SIZE} />
            </button>
          )}
        </div>
        <ul className={styles.decisions}>
          {agenda.decisionPoints.map((decision) => (
            <DecisionCard
              key={decision.id}
              decision={decision}
              state={decision.id === discussingId ? 'discussing' : decision.status}
              discussingMinutes={timing?.minutes}
              isPaused={isPaused}
              isSelected={decision.id === selectedDecisionId}
              canEdit={canEdit}
              onSelect={() => onSelectDecision(decision.id === selectedDecisionId ? undefined : decision.id)}
              onSave={(summary) => onSaveDecision(decision.id, summary)}
              onChangeStatus={(status) => onChangeDecisionStatus(decision.id, status)}
            />
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2 id="live-summary-title" className={`${styles.sectionTitle} ${styles.summaryTitle}`}>
            이 안건 요약
          </h2>
          {isAiAvailable ? (
            isCurrent && <span className={styles.sectionMeta}>· AI가 정리 중</span>
          ) : (
            <span className={styles.aiPausedChip}>
              <Icon src={refreshIcon} size={ICON_SIZE - 4} />
              AI 일시 중단 · 이전 내용까지 정리됨
            </span>
          )}
        </div>
        {notice}
        {hasSummary ? (
          <>
            {agenda.summary.length > 0 && <p className={styles.summary}>{agenda.summary.join(' ')}</p>}
            {(agenda.opinions.length > 0 || agenda.openIssues.length > 0) && (
              <div className={styles.opinionColumns}>
                <div className={styles.opinionBox}>
                  <p className={`${styles.opinionLabel} ${styles.opinionMain}`}>주요 의견</p>
                  <ul className={styles.opinionList}>
                    {agenda.opinions.map((opinion) => (
                      <li key={opinion}>{opinion}</li>
                    ))}
                  </ul>
                </div>
                <div className={styles.opinionBox}>
                  <p className={`${styles.opinionLabel} ${styles.opinionOpen}`}>아직 합의되지 않은 부분</p>
                  <ul className={styles.opinionList}>
                    {agenda.openIssues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </>
        ) : (
          // MSG-024
          <p className={styles.noSummary}>회의 발언이 시작되면 이곳에서 논의 흐름과 주요 의견을 확인할 수 있어요.</p>
        )}
        <div className={styles.todoCard}>
          <p className={styles.todoHead}>
            <Icon src={todoIcon} size={ICON_SIZE} />
            할 일 <span className={styles.todoCount}>{agenda.todos.length}</span>
          </p>
          {agenda.todos.length > 0 ? (
            <TodoList variant="table" todos={agenda.todos} onSave={canEdit ? onSaveTodo : undefined} />
          ) : (
            <p className={styles.todoEmpty}>회의에서 할 일이 나오면 담당자·기한과 함께 여기에 모여요</p>
          )}
        </div>
      </section>
    </div>
  );
}
