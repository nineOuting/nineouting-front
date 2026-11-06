import { useState, type KeyboardEvent } from 'react';
import dividerTranscript from '../../../assets/divider-transcript.svg';
import Placeholder from '../../../components/Placeholder';
import type { TranscriptLine } from '../../../types/meetingRoom';
import room from './room.module.css';
import styles from './SidePanel.module.css';

const TITLE_ICON_SIZE = 24;
const EDIT_ICON_SIZE = 24;
const EMPTY_ICON_SIZE = 48;

const NO_AGENDA = '';

interface TranscriptPanelProps {
  lines: TranscriptLine[];
  canEdit: boolean;
  onEdit: (seq: number, text: string) => void;
  /** REQ-089 줄마다 안건 (seq → 안건 id). 분류 전이면 없다 */
  lineAgendas?: Record<number, string | null>;
  agendaOptions?: { id: string; title: string }[];
  /** REQ-089 줄의 안건 고치기 (회의록 작성자). null = 해당 없음 */
  onChangeAgenda?: (seq: number, agendaId: string | null) => void;
}

/** REQ-079, 083 실시간 전사. 회의록 작성자는 줄에 마우스를 올려 바로 고친다. REQ-089 줄마다 안건을 보여 주고 작성자는 바꿀 수 있다 */
export default function TranscriptPanel({
  lines,
  canEdit,
  onEdit,
  lineAgendas = {},
  agendaOptions = [],
  onChangeAgenda,
}: TranscriptPanelProps) {
  const titleOf = (agendaId: string | null | undefined) =>
    agendaOptions.find(({ id }) => id === agendaId)?.title;
  const [editing, setEditing] = useState<{ seq: number; text: string } | null>(null);

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
      <div className={styles.head}>
        <div className={room.titleRow}>
          <Placeholder size={TITLE_ICON_SIZE} />
          <h2 className={room.title}>실시간 전사</h2>
        </div>
        <p className={room.caption}>실시간으로 전사 내용을 수정해보세요</p>
      </div>
      <img src={dividerTranscript} alt="" width={429} height={1} className={`${room.divider} ${styles.divider}`} />

      {lines.length === 0 ? (
        // MSG-025
        <div className={room.empty}>
          <Placeholder size={EMPTY_ICON_SIZE} />
          <p className={room.emptyTitle}>회의 내용을 듣고 있습니다.</p>
          <p className={room.emptyCaption}>발언이 시작되면 이곳에 전사됩니다.</p>
        </div>
      ) : (
        <ol className={styles.lines} aria-live="polite">
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
                ) : (
                  <p className={styles.text}>{line.text}</p>
                )}
                {canEdit && !isEditing && (
                  <button
                    type="button"
                    className={`${room.iconButton} ${styles.edit}`}
                    aria-label={`${line.time} 발언 수정`}
                    onClick={() => setEditing({ seq: line.seq, text: line.text })}
                  >
                    <Placeholder size={EDIT_ICON_SIZE} />
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
