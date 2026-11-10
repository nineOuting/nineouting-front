import type { ReactNode } from 'react';
import errorIcon from '../assets/icons/error.svg';
import Icon from './Icon';
import styles from './EmptyState.module.css';

const ICON_SIZE = 24;

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  /** 가운데 버튼 (새 회의 만들기 등) */
  action?: ReactNode;
  /** 버튼 아래 작은 안내 */
  note?: ReactNode;
  className?: string;
}

/** 디자인 EmptyState: 느낌표 아이콘, 제목, 설명, 버튼 (빈 목록, 검색 결과 없음, 오류) */
export default function EmptyState({ title, description, action, note, className }: EmptyStateProps) {
  return (
    <div className={[styles.empty, className].filter(Boolean).join(' ')}>
      <Icon src={errorIcon} size={ICON_SIZE} className={styles.icon} />
      <div className={styles.texts}>
        <p className={styles.title}>{title}</p>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {action}
      {note && <p className={styles.note}>{note}</p>}
    </div>
  );
}
