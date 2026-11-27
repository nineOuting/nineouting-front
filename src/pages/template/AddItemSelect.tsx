import { useEffect, useRef, useState } from 'react';
import addIcon from '../../assets/icons/add-plain.svg';
import checkIcon from '../../assets/icons/check-sm.svg';
import chevronDownIcon from '../../assets/icons/chevron-down.svg';
import chevronUpIcon from '../../assets/icons/chevron-up-sm.svg';
import Icon from '../../components/Icon';
import styles from './AddItemSelect.module.css';

const ICON_SIZE = 20;
const ADDED_ICON_SIZE = 16;

export interface AddItemOption {
  key: string;
  title: string;
  summary: string;
  /** 이미 문서에 있는 항목: "✓ 추가됨"으로 보이고 고를 수 없다 */
  isAdded: boolean;
}

interface AddItemSelectProps {
  options: AddItemOption[];
  onAdd: (key: string) => void;
  onAddCustom: () => void;
}

/**
 * 디자인 09 "회의록 항목 추가하기" (REQ-155, 11/27). 항목 목록 대신 드롭다운 하나로 추가한다.
 * 기본 항목은 이름 + 짧은 설명, 맨 아래 "+ 커스텀 항목 추가". 고르면 문서 끝에 넣고 닫힌다. 바깥·ESC로도 닫힌다.
 * 이미 넣은 항목은 디자인에 상태가 없어 "✓ 추가됨"으로 보이고 누를 수 없게 했다 (SCRUM-430)
 */
export default function AddItemSelect({ options, onAdd, onAddCustom }: AddItemSelectProps) {
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

  const pick = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div ref={rootRef} className={styles.root}>
      <button
        type="button"
        className={[styles.box, isOpen ? styles.open : ''].filter(Boolean).join(' ')}
        aria-label="추가할 항목 고르기"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className={isOpen ? styles.value : styles.placeholder}>추가할 항목 고르기</span>
        <Icon src={isOpen ? chevronUpIcon : chevronDownIcon} size={ICON_SIZE} className={styles.icon} />
      </button>
      {isOpen && (
        <div role="menu" aria-label="추가할 항목" className={styles.menu}>
          {options.map((option) => (
            <button
              key={option.key}
              type="button"
              role="menuitem"
              className={styles.item}
              disabled={option.isAdded}
              onClick={() => pick(() => onAdd(option.key))}
            >
              <span className={styles.itemText}>
                {/* 설명이 두 줄로 밀리지 않게 "✓ 추가됨"은 이름 줄 오른쪽에 둔다 (디자인 높이 60px 유지) */}
                <span className={styles.itemHead}>
                  <span className={styles.itemTitle}>{option.title}</span>
                  {option.isAdded && (
                    <span className={styles.added}>
                      <Icon src={checkIcon} size={ADDED_ICON_SIZE} />
                      추가됨
                    </span>
                  )}
                </span>
                <span className={styles.itemSummary}>{option.summary}</span>
              </span>
            </button>
          ))}
          <button type="button" role="menuitem" className={styles.custom} onClick={() => pick(onAddCustom)}>
            <Icon src={addIcon} size={ICON_SIZE} className={styles.customIcon} />
            커스텀 항목 추가
          </button>
        </div>
      )}
    </div>
  );
}
