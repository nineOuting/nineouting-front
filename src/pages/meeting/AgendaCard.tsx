import type { DragEvent } from 'react';
import dividerAgenda from '../../assets/divider-agenda.svg';
import Placeholder from '../../components/Placeholder';
import type { Agenda } from '../../types/meeting';
import styles from './AgendaCard.module.css';

const ICON_SIZE = 20;

interface AgendaCardProps {
  agenda: Agenda;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDragStart: (event: DragEvent<HTMLLIElement>) => void;
  onDrop: (event: DragEvent<HTMLLIElement>) => void;
}

/** REQ-075 등록된 안건. 펼치면 결정할 사항을 보여 주고, 끌어서 순서를 바꾼다 (REQ-069) */
export default function AgendaCard({ agenda, isExpanded, onToggle, onEdit, onDragStart, onDrop }: AgendaCardProps) {
  return (
    <li
      className={styles.card}
      draggable
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <div className={styles.header}>
        <span className={styles.handle} aria-label="끌어서 순서 변경">
          <Placeholder size={ICON_SIZE} />
        </span>
        <div className={styles.texts}>
          {agenda.carriedOverFrom && <p className={styles.date}>{agenda.carriedOverFrom}</p>}
          <p className={styles.title}>{agenda.title}</p>
          {!isExpanded && <p className={styles.sub}>세부 내용이 등록되어 있습니다.</p>}
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.iconButton} aria-label={`${agenda.title} 수정`} onClick={onEdit}>
            <Placeholder size={ICON_SIZE} />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            aria-label={isExpanded ? '결정할 사항 접기' : '결정할 사항 펼치기'}
            aria-expanded={isExpanded}
            onClick={onToggle}
          >
            <Placeholder size={ICON_SIZE} />
          </button>
        </div>
      </div>
      {isExpanded && (
        <>
          <img src={dividerAgenda} alt="" width={576} height={1} className={styles.divider} />
          <div className={styles.decisionWrap}>
            <div className={styles.decision}>
              <p className={styles.decisionLabel}>결정할 사항</p>
              <p className={styles.decisionValue}>{agenda.decisionPoint}</p>
            </div>
          </div>
        </>
      )}
    </li>
  );
}
