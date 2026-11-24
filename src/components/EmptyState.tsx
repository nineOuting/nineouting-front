import type { ReactNode } from 'react';
import errorIcon from '../assets/icons/error.svg';
import Icon from './Icon';
import styles from './EmptyState.module.css';

const ICON_SIZE = 24;
// 디자인 설정 창 안 빈 상태의 캐릭터 크기
const CHARACTER_SIZE = 96;

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  /** 가운데 버튼 (새 회의 만들기 등) */
  action?: ReactNode;
  /** 버튼 아래 작은 안내 */
  note?: ReactNode;
  className?: string;
  /** 넵넵 캐릭터 그림 (assets/characters). 있으면 아이콘 대신 보이고 글자는 작게 (디자인 EmptyState showCharacter) */
  character?: string;
}

/** 디자인 EmptyState: 느낌표 아이콘, 제목, 설명, 버튼 (빈 목록, 검색 결과 없음, 오류) */
export default function EmptyState({ title, description, action, note, className, character }: EmptyStateProps) {
  return (
    <div className={[styles.empty, character && styles.withCharacter, className].filter(Boolean).join(' ')}>
      {character ? (
        // 모양만 쓰고 색은 테마의 보라(--primary-default)로 칠한다. 다크 테마에서도 배경에 맞는 보라가 된다 (SCRUM-365)
        <Icon src={character} size={CHARACTER_SIZE} className={styles.character} />
      ) : (
        <Icon src={errorIcon} size={ICON_SIZE} className={styles.icon} />
      )}
      <div className={styles.texts}>
        <p className={styles.title}>{title}</p>
        {description && <p className={styles.description}>{description}</p>}
      </div>
      {action}
      {note && <p className={styles.note}>{note}</p>}
    </div>
  );
}
