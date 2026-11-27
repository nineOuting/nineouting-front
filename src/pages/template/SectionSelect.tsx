import { useEffect, useRef, useState } from 'react';
import chevronDownIcon from '../../assets/icons/chevron-down.svg';
import chevronUpIcon from '../../assets/icons/chevron-up-sm.svg';
import Icon from '../../components/Icon';
import styles from './SectionSelect.module.css';

const ICON_SIZE = 20;

interface SectionSelectProps {
  /** 섹션 이름 (문서 순서) */
  titles: string[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

/**
 * 디자인 09 상태 모음 "선택한 섹션 고르기" (REQ-155, 11/25).
 * 누르면 아래로 섹션 목록(문서 순서), 지금 섹션은 파란색. 고르면 그 섹션으로 바뀌고 닫힌다. 바깥·ESC로도 닫힌다.
 * 섹션 아이콘은 모두 같아 구분이 안 되므로 칸과 목록 모두 뺀다
 */
export default function SectionSelect({ titles, selectedIndex, onSelect }: SectionSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const current = selectedIndex === null ? undefined : titles[selectedIndex];

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        type="button"
        className={[styles.box, isOpen ? styles.open : ''].filter(Boolean).join(' ')}
        aria-label="선택한 항목"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className={current === undefined ? styles.placeholder : styles.value}>
          {current === undefined ? '항목을 골라 주세요' : current || '제목 없음'}
        </span>
        <Icon src={isOpen ? chevronUpIcon : chevronDownIcon} size={ICON_SIZE} className={styles.icon} />
      </button>
      {isOpen && (
        <ul role="listbox" aria-label="섹션" className={styles.menu}>
          {titles.map((title, index) => {
            const isSelected = index === selectedIndex;
            return (
              <li key={`${title}-${index}`} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  className={[styles.item, isSelected ? styles.selected : ''].filter(Boolean).join(' ')}
                  onClick={() => {
                    onSelect(index);
                    setIsOpen(false);
                  }}
                >
                  {title || '제목 없음'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
