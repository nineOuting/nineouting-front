import { useEffect, useRef, type RefObject } from 'react';
import checkIcon from '../../assets/icons/check-sm.svg';
import infoIcon from '../../assets/icons/info.svg';
import Icon from '../../components/Icon';
import type { Member } from '../../types/meeting';
import styles from './MemberPickerMenu.module.css';

const ICON_SIZE = 16;

interface MemberPickerMenuProps {
  title: string;
  members: Member[];
  selectedIds: number[];
  /** userId → 이메일 (없으면 이름만) */
  emails?: Record<number, string>;
  footnote?: string;
  emptyText: string;
  anchorRef: RefObject<HTMLElement | null>;
  onSelect: (member: Member) => void;
  onClose: () => void;
  className?: string;
}

/** 디자인 Version02 MemberSelectMenu: 제목·인원, 얼굴·이름·이메일 줄, 고른 사람은 체크, 아래 안내 */
export default function MemberPickerMenu({
  title,
  members,
  selectedIds,
  emails = {},
  footnote,
  emptyText,
  anchorRef,
  onSelect,
  onClose,
  className,
}: MemberPickerMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !anchorRef.current?.contains(target)) {
        onClose();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [anchorRef, onClose]);

  return (
    <div ref={menuRef} className={[styles.menu, className].filter(Boolean).join(' ')}>
      <p className={styles.title}>
        {title} <span className={styles.count}>{members.length}</span>
      </p>
      {members.length === 0 ? (
        <p className={styles.empty}>{emptyText}</p>
      ) : (
        <ul role="listbox" aria-label={title} className={styles.list}>
          {members.map((member) => {
            const isSelected = selectedIds.includes(member.userId);
            return (
              <li key={member.userId} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  className={[styles.item, isSelected ? styles.selected : ''].filter(Boolean).join(' ')}
                  onClick={() => onSelect(member)}
                >
                  {member.profileImageUrl ? (
                    <img src={member.profileImageUrl} alt="" className={styles.avatar} />
                  ) : (
                    <span className={styles.avatar} aria-hidden="true">
                      {member.name.slice(0, 1)}
                    </span>
                  )}
                  <span className={styles.texts}>
                    <span className={styles.name}>{member.name}</span>
                    {emails[member.userId] && <span className={styles.email}>{emails[member.userId]}</span>}
                  </span>
                  {isSelected && <Icon src={checkIcon} size={ICON_SIZE} className={styles.check} />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {footnote && (
        <p className={styles.footnote}>
          <Icon src={infoIcon} size={ICON_SIZE - 4} />
          {footnote}
        </p>
      )}
    </div>
  );
}
