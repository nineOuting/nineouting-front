import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import transcriptIcon from '../../../assets/icons/transcript.svg';
import Icon from '../../../components/Icon';
import type { TranscriptLine } from '../../../types/meetingRoom';
import room from './room.module.css';
import TermText from './TermText';
import styles from './SidePanel.module.css';

const EMPTY_ICON_SIZE = 48;

const NO_AGENDA = '';

/** 맨 아래에서 이만큼(px) 안쪽이면 맨 아래를 보고 있는 것으로 본다 */
const STICK_THRESHOLD = 40;

interface TranscriptPanelProps {
  lines: TranscriptLine[];
  canEdit: boolean;
  onEdit: (seq: number, text: string) => void;
  /** REQ-089 줄마다 안건 (seq → 안건 id). 분류 전이면 없다 */
  lineAgendas?: Record<number, string | null>;
  agendaOptions?: { id: string; title: string }[];
  /** REQ-089 줄의 안건 고치기 (회의록 작성자). null = 해당 없음 */
  onChangeAgenda?: (seq: number, agendaId: string | null) => void;
  /** 용어 카드의 [더 묻기] → 내 도우미 */
  onAskTerm?: (term: string) => void;
  /** 인터넷이 끊겼을 때 맨 아래 안내 */
  isOffline?: boolean;
}

/** REQ-079, 083 실시간 전사. 회의록 작성자는 줄에 마우스를 올려 바로 고친다. REQ-089 줄마다 안건을 보여 주고 작성자는 바꿀 수 있다 */
export default function TranscriptPanel({
  lines,
  canEdit,
  onEdit,
  lineAgendas = {},
  agendaOptions = [],
  onChangeAgenda,
  onAskTerm,
  isOffline = false,
}: TranscriptPanelProps) {
  const titleOf = (agendaId: string | null | undefined) =>
    agendaOptions.find(({ id }) => id === agendaId)?.title;
  const [editing, setEditing] = useState<{ seq: number; text: string } | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  // 위로 올려 예전 줄을 읽는 중이면 자동으로 내리지 않는다
  const stickToBottomRef = useRef(true);

  const handleScroll = () => {
    const el = listRef.current;
    if (el) {
      stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight <= STICK_THRESHOLD;
    }
  };

  // 새 전사 줄이 오면 맨 아래로 내린다 (고치는 중에는 그대로 둔다)
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && stickToBottomRef.current && !editing) {
      el.scrollTop = el.scrollHeight;
    }
  }, [lines, editing]);

  const finishEditing = () => {
    if (editing && editing.text.trim()) {
      onEdit(editing.seq, editing.text.trim());
    }
    setEditing(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Shift+Enter는 줄바꿈, Enter는 저장
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      finishEditing();
    } else if (event.key === 'Escape') {
      setEditing(null);
    }
  };

  return (
    <>
      {/* 디자인 Version02: 제목은 위 탭(실시간 전사)이 대신한다 */}
      {lines.length === 0 ? (
        // MSG-025
        <div className={room.empty}>
          <Icon src={transcriptIcon} size={EMPTY_ICON_SIZE} className={room.emptyIcon} />
          <p className={room.emptyTitle}>회의 내용을 듣고 있습니다.</p>
          <p className={room.emptyCaption}>발언이 시작되면 이곳에 전사됩니다.</p>
        </div>
      ) : (
        <ol ref={listRef} className={styles.lines} aria-live="polite" onScroll={handleScroll}>
          {lines.map((line) => {
            const isEditing = editing?.seq === line.seq;
            const className = [styles.line, canEdit ? styles.editable : '', isEditing ? styles.lineActive : '']
              .filter(Boolean)
              .join(' ');
            return (
              <li key={line.seq} className={className}>
                <div className={styles.lineMeta}>
                  <span className={styles.time}>{line.time}</span>
                  {canEdit && onChangeAgenda ? (
                    <select
                      className={styles.agendaSelect}
                      aria-label={`${line.time} 발언의 안건`}
                      value={lineAgendas[line.seq] ?? NO_AGENDA}
                      onChange={(event) => onChangeAgenda(line.seq, event.target.value || null)}
                    >
                      <option value={NO_AGENDA}>안건 없음</option>
                      {agendaOptions.map(({ id, title }) => (
                        <option key={id} value={id}>
                          {title}
                        </option>
                      ))}
                    </select>
                  ) : (
                    titleOf(lineAgendas[line.seq]) && (
                      <span className={styles.agendaTag}>{titleOf(lineAgendas[line.seq])}</span>
                    )
                  )}
                </div>
                {isEditing ? (
                  <textarea
                    className={styles.textarea}
                    aria-label={`${line.time} 발언 수정`}
                    value={editing.text}
                    rows={Math.max(2, editing.text.split('\n').length)}
                    autoFocus
                    onChange={(event) => setEditing({ seq: line.seq, text: event.target.value })}
                    onKeyDown={handleKeyDown}
                    onBlur={finishEditing}
                  />
                ) : canEdit ? (
                  // REQ-083 따로 수정 버튼 없이, 마우스를 올리면 바탕이 바뀌고 누르면 바로 고친다
                  <p
                    className={`${styles.text} ${styles.clickable}`}
                    role="button"
                    tabIndex={0}
                    aria-label={`${line.time} 발언 수정: ${line.text}`}
                    onClick={() => setEditing({ seq: line.seq, text: line.text })}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        setEditing({ seq: line.seq, text: line.text });
                      }
                    }}
                  >
                    <TermText text={line.text} onAsk={onAskTerm} />
                  </p>
                ) : (
                  <p className={styles.text}>
                    <TermText text={line.text} onAsk={onAskTerm} />
                  </p>
                )}
              </li>
            );
          })}
          {isOffline && <li className={styles.offlineNote}>연결되면 그동안의 발언이 이어서 올라와요</li>}
        </ol>
      )}
    </>
  );
}
