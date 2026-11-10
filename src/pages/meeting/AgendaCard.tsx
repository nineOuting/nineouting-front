import type { DragEvent } from 'react';
import arrowDownIcon from '../../assets/icons/arrow-down.svg';
import arrowUpIcon from '../../assets/icons/arrow-up.svg';
import createIcon from '../../assets/icons/create.svg';
import deleteIcon from '../../assets/icons/delete.svg';
import dragIcon from '../../assets/icons/drag.svg';
import Icon from '../../components/Icon';
import type { Agenda } from '../../types/meeting';
import styles from './AgendaCard.module.css';

const ICON_SIZE = 20;
const ARROW_ICON_SIZE = 24;

interface AgendaCardProps {
  agenda: Agenda;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  /** REQ-170 안건 삭제. 없으면 휴지통을 숨긴다 (안건은 1개 이상 남긴다) */
  onDelete?: () => void;
  onDragStart: (event: DragEvent<HTMLLIElement>) => void;
  onDrop: (event: DragEvent<HTMLLIElement>) => void;
}

/** REQ-075 등록된 안건. 펼치면 결정할 사항을 보여 주고, 끌어서 순서를 바꾼다 (REQ-069) */
export default function AgendaCard({ agenda, isExpanded, onToggle, onEdit, onDelete, onDragStart, onDrop }: AgendaCardProps) {
  return (
    <li
      className={[styles.card, isExpanded ? styles.expanded : ''].filter(Boolean).join(' ')}
      draggable
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
    >
      <div className={styles.header}>
        <span className={styles.handle} aria-label="끌어서 순서 변경">
          <Icon src={dragIcon} size={ICON_SIZE} />
        </span>
        <div className={styles.texts}>
          {agenda.carriedOverFrom && <p className={styles.date}>지난 회의에서 넘어온 안건 · {agenda.carriedOverFrom}</p>}
          <p className={styles.title}>{agenda.title}</p>
          {!isExpanded && <p className={styles.sub}>세부 내용이 등록되어 있어요</p>}
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.iconButton} aria-label={`${agenda.title} 수정`} onClick={onEdit}>
            <Icon src={createIcon} size={ICON_SIZE} />
          </button>
          {onDelete && (
            <button type="button" className={styles.iconButton} aria-label={`${agenda.title} 삭제`} onClick={onDelete}>
              <Icon src={deleteIcon} size={ICON_SIZE} />
            </button>
          )}
          <button
            type="button"
            className={styles.iconButton}
            aria-label={isExpanded ? '결정할 사항 접기' : '결정할 사항 펼치기'}
            aria-expanded={isExpanded}
            onClick={onToggle}
          >
            <Icon src={isExpanded ? arrowUpIcon : arrowDownIcon} size={ARROW_ICON_SIZE} />
          </button>
        </div>
      </div>
      {isExpanded && (
        <div className={styles.decision}>
          <p className={styles.decisionLabel}>결정할 사항</p>
          <ul className={styles.decisionList}>
            {agenda.decisionPoints.map((decisionPoint, index) => (
              <li key={index} className={styles.decisionValue}>
                {decisionPoint}
              </li>
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}
