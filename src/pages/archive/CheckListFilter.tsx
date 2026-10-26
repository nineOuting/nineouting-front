import { useState } from 'react';
import Checkbox from '../../components/Checkbox';
import Placeholder from '../../components/Placeholder';
import type { Member } from '../../types/meeting';
import styles from './CheckListFilter.module.css';

const SEARCH_ICON_SIZE = 16;

export interface CheckOption {
  id: string;
  label: string;
  /** 참석자 필터는 얼굴을 함께 보여 준다 */
  member?: Member;
}

interface CheckListFilterProps {
  options: CheckOption[];
  selected: string[];
  searchPlaceholder: string;
  emptyText: string;
  /** 참석자 필터: [전체 선택]과 목록 안 스크롤 (디자인 23:1892) */
  withSelectAll?: boolean;
  onApply: (ids: string[]) => void;
  onCancel: () => void;
}

/** REQ-055 장소·참석자 필터 (디자인 23:2606, 23:1892). 여러 개 골라 [적용] */
export default function CheckListFilter({
  options,
  selected,
  searchPlaceholder,
  emptyText,
  withSelectAll = false,
  onApply,
  onCancel,
}: CheckListFilterProps) {
  const [checked, setChecked] = useState<string[]>(selected);
  const [keyword, setKeyword] = useState('');
  const shown = options.filter((option) => option.label.toLowerCase().includes(keyword.trim().toLowerCase()));
  const isAllChecked = shown.length > 0 && shown.every((option) => checked.includes(option.id));

  const toggle = (id: string) =>
    setChecked((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  const toggleAll = () =>
    setChecked((prev) =>
      isAllChecked
        ? prev.filter((id) => !shown.some((option) => option.id === id))
        : [...new Set([...prev, ...shown.map((option) => option.id)])],
    );

  return (
    <div className={styles.filter}>
      <label className={styles.search}>
        <Placeholder size={SEARCH_ICON_SIZE} />
        <input
          className={styles.searchInput}
          placeholder={searchPlaceholder}
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
        />
      </label>
      {withSelectAll && shown.length > 0 && (
        <Checkbox className={styles.option} checked={isAllChecked} onChange={toggleAll}>
          <span className={styles.label}>전체 선택</span>
        </Checkbox>
      )}
      <div className={[styles.list, withSelectAll ? styles.scroll : ''].filter(Boolean).join(' ')}>
        {shown.length === 0 && <p className={styles.empty}>{emptyText}</p>}
        {shown.map((option) => (
          <Checkbox
            key={option.id}
            className={styles.option}
            checked={checked.includes(option.id)}
            onChange={() => toggle(option.id)}
          >
            {option.member &&
              (option.member.profileImageUrl ? (
                <img src={option.member.profileImageUrl} alt="" className={styles.face} />
              ) : (
                <span className={styles.face} />
              ))}
            <span className={styles.label}>{option.label}</span>
          </Checkbox>
        ))}
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.cancel} onClick={onCancel}>
          취소
        </button>
        <button type="button" className={styles.apply} onClick={() => onApply(checked)}>
          적용
        </button>
      </div>
    </div>
  );
}
