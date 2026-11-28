import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import checkIcon from '../../../assets/icons/check-sm.svg';
import editIcon from '../../../assets/icons/create-sm.svg';
import searchIcon from '../../../assets/icons/search.svg';
import Icon from '../../../components/Icon';
import styles from './AssigneePicker.module.css';
import Avatar from '../../../components/Avatar';

const SEARCH_ICON_SIZE = 20;
const SMALL_ICON_SIZE = 14;
const CHECK_ICON_SIZE = 18;

/** 담당자로 고를 수 있는 사람 */
export interface PickerPerson {
  userId: number;
  name: string;
  email?: string;
  profileImageUrl?: string;
}

interface AssigneePickerProps {
  /** 회의 참석자 (먼저 보인다) */
  attendees: PickerPerson[];
  /** 참석자가 아닌 워크스페이스 멤버 */
  members: PickerPerson[];
  /** 지금 담당자 (AI가 고른 사람 포함). 체크된 채로 열린다 */
  selectedUserId?: number | null;
  anchorRef: RefObject<HTMLElement | null>;
  onSelect: (person: PickerPerson) => void;
  /** 목록에 없는 사람 (외부 담당자, 알림이 가지 않는다) */
  onExternal: (name: string) => void;
  onClose: () => void;
}

function matches(person: PickerPerson, keyword: string) {
  const query = keyword.trim().toLowerCase();
  return !query || person.name.toLowerCase().includes(query) || Boolean(person.email?.toLowerCase().includes(query));
}

/**
 * 디자인 07 상태 모음 "할 일 담당자 고르기" (MemberPicker, REQ-190).
 * 이름·이메일 검색, 회의 참석자 → 워크스페이스 멤버, 고른 사람은 체크, 맨 아래 [목록에 없으면 직접 입력].
 * 1명 고르면 닫히고, 바깥·ESC로도 닫힌다
 */
export default function AssigneePicker({
  attendees,
  members,
  selectedUserId,
  anchorRef,
  onSelect,
  onExternal,
  onClose,
}: AssigneePickerProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [keyword, setKeyword] = useState('');
  // 직접 입력: 검색칸을 이름 입력칸으로 쓴다
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !anchorRef.current?.contains(target)) {
        onClose();
      }
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
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

  const shownAttendees = isTyping ? [] : attendees.filter((person) => matches(person, keyword));
  const shownMembers = isTyping ? [] : members.filter((person) => matches(person, keyword));
  const hasResult = shownAttendees.length + shownMembers.length > 0;
  const name = keyword.trim();

  const startTyping = () => {
    setIsTyping(true);
    inputRef.current?.focus();
  };

  const submitExternal = () => {
    if (name) {
      onExternal(name);
    }
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') {
      return;
    }
    event.preventDefault();
    if (isTyping || !hasResult) {
      submitExternal();
    } else if (shownAttendees.length + shownMembers.length === 1) {
      onSelect([...shownAttendees, ...shownMembers][0]);
    }
  };

  const renderGroup = (label: string, people: PickerPerson[]) =>
    people.length > 0 && (
      <div className={styles.group}>
        <p className={styles.groupLabel}>
          {label} <span className={styles.count}>{people.length}</span>
        </p>
        <ul role="listbox" aria-label={label} className={styles.list}>
          {people.map((person) => {
            const isSelected = person.userId === selectedUserId;
            return (
              <li key={person.userId} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  className={[styles.row, isSelected ? styles.selected : ''].filter(Boolean).join(' ')}
                  onClick={() => onSelect(person)}
                >
                  <Avatar url={person.profileImageUrl} className={styles.avatar} />
                  <span className={styles.texts}>
                    <span className={styles.name}>{person.name}</span>
                    {person.email && <span className={styles.email}>{person.email}</span>}
                  </span>
                  {isSelected && <Icon src={checkIcon} size={CHECK_ICON_SIZE} className={styles.check} />}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );

  return (
    <div ref={menuRef} className={styles.picker}>
      <label className={styles.search}>
        <Icon src={searchIcon} size={SEARCH_ICON_SIZE} className={styles.searchIcon} />
        <input
          ref={inputRef}
          className={styles.input}
          value={keyword}
          autoFocus
          placeholder={isTyping ? '담당자 이름 입력' : '이름 또는 이메일 검색'}
          aria-label={isTyping ? '담당자 이름 직접 입력' : '담당자 검색'}
          onChange={(event) => setKeyword(event.target.value)}
          onKeyDown={handleInputKeyDown}
        />
      </label>
      {!isTyping && (
        <div className={styles.groups}>
          {renderGroup('회의 참석자', shownAttendees)}
          {shownAttendees.length > 0 && shownMembers.length > 0 && <div className={styles.divider} />}
          {renderGroup('워크스페이스 멤버', shownMembers)}
          {/* 디자인 MemberPicker state=no-match: 검색 결과가 없으면 안내와 외부 담당자 줄 */}
          {!hasResult && <p className={styles.noMatch}>{name ? '일치하는 멤버가 없어요' : '고를 수 있는 멤버가 없어요'}</p>}
        </div>
      )}
      {/* 디자인 PickerExternalRow: 검색 결과가 없거나 직접 입력할 때. 누르면 외부 담당자 (알림 없음) */}
      {(isTyping || !hasResult) && name && (
        <button type="button" className={styles.row} onClick={submitExternal}>
          <span className={`${styles.avatar} ${styles.avatarExternal}`} aria-hidden="true">
            ?
          </span>
          <span className={styles.texts}>
            <span className={styles.name}>'{name}' 담당자로 넣기</span>
            <span className={styles.email}>워크스페이스에 없는 사람이에요</span>
          </span>
        </button>
      )}
      {!isTyping && hasResult && (
        <button type="button" className={styles.footer} onClick={startTyping}>
          <Icon src={editIcon} size={SMALL_ICON_SIZE} />
          목록에 없으면 직접 입력
        </button>
      )}
    </div>
  );
}
