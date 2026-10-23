import { useState, type KeyboardEvent } from 'react';
import dividerTranscript from '../../../assets/divider-transcript.svg';
import Placeholder from '../../../components/Placeholder';
import type { TranscriptLine } from '../../../types/meetingRoom';
import room from './room.module.css';
import styles from './SidePanel.module.css';

const TITLE_ICON_SIZE = 24;
const EDIT_ICON_SIZE = 24;
const EMPTY_ICON_SIZE = 48;

interface TranscriptPanelProps {
  lines: TranscriptLine[];
  canEdit: boolean;
  onEdit: (seq: number, text: string) => void;
}

/** REQ-079, 083 실시간 전사. 회의록 작성자는 줄에 마우스를 올려 바로 고친다 */
export default function TranscriptPanel({ lines, canEdit, onEdit }: TranscriptPanelProps) {
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
                <span className={styles.time}>{line.time}</span>
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
