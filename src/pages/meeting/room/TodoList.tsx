import { useRef, useState, type KeyboardEvent } from 'react';
import chevronDownIcon from '../../../assets/icons/chevron-down.svg';
import chevronUpIcon from '../../../assets/icons/chevron-up-sm.svg';
import editIcon from '../../../assets/icons/create-sm.svg';
import personIcon from '../../../assets/icons/person-sm.svg';
import dueDateIcon from '../../../assets/icons/due-date.svg';
import Icon from '../../../components/Icon';
import type { RoomTodo } from '../../../types/meetingRoom';
import AssigneePicker, { type PickerPerson } from './AssigneePicker';
import DueDatePicker from './DueDatePicker';
import room from './room.module.css';
import styles from './TodoList.module.css';

const NO_ASSIGNEE = '담당자 미정';
const EDIT_ICON_SIZE = 16;

/** 담당자를 참석자 명단과 맞춘 결과를 이름 옆에 붙인다 (명단과 맞으면 이름만) */
const ASSIGNEE_NOTES: Partial<Record<string, string>> = {
  NOT_IN_ROSTER: '참석자 아님',
  AMBIGUOUS: '동명이인 확인',
};

export interface TodoChange {
  task: string;
  assignee: string;
  due: string;
  /** 담당자 선택 창에서 정한 사람 번호 (외부 담당자는 null). 없으면 이름으로 맞춘다 */
  assigneeUserId?: number | null;
}

/** 담당자 선택 창에 보일 사람 (회의 참석자 → 워크스페이스 멤버) */
export interface AssigneePeople {
  attendees: PickerPerson[];
  members: PickerPerson[];
}

interface TodoListProps {
  todos: RoomTodo[];
  /** 넘기면 회의록 작성자가 할 일, 담당자, 기한을 고친다 */
  onSave?: (todo: RoomTodo, change: TodoChange) => void;
  /** table: 디자인 Version02 회의 중 할 일 표 (체크박스 · 할 일 · 담당자 칩 · 기한 칩) */
  variant?: 'list' | 'table';
  /** 완료로 체크한 할 일 항목 번호 (회의방이 서버와 맞춘다) */
  doneIds?: string[];
  /** 넘기면 회의록 작성자가 완료를 체크하고 푼다 */
  onToggleDone?: (todo: RoomTodo, done: boolean) => void;
  /** table에서 담당자 칩의 얼굴과 선택 창 목록 */
  people?: AssigneePeople;
}

function assigneeLabel(todo: RoomTodo) {
  if (!todo.assignee || todo.assigneeStatus === 'UNASSIGNED') {
    return { text: NO_ASSIGNEE, className: styles.unassigned };
  }
  const note = todo.assigneeStatus ? ASSIGNEE_NOTES[todo.assigneeStatus] : undefined;
  if (note) {
    return { text: `${todo.assignee} (${note})`, className: styles.assigneeWarning };
  }
  return { text: todo.assignee, className: styles.assignee };
}

/** REQ-097 할 일·담당자·기한 (임시 디자인). 담당자가 참석자가 아니거나 동명이인이면 주황 표시 */
export default function TodoList({
  todos,
  onSave,
  variant = 'list',
  doneIds = [],
  onToggleDone,
  people = { attendees: [], members: [] },
}: TodoListProps) {
  const [editing, setEditing] = useState<{ id: string; change: TodoChange } | null>(null);
  // 담당자 선택 창이 열린 할 일
  const [pickingId, setPickingId] = useState<string | null>(null);
  const pickerAnchorRef = useRef<HTMLSpanElement>(null);
  // 기한 달력이 열린 할 일
  const [datingId, setDatingId] = useState<string | null>(null);
  const dueAnchorRef = useRef<HTMLSpanElement>(null);
  const everyone = [...people.attendees, ...people.members];

  /** 담당자만 바꿔 저장한다 (할 일·기한은 그대로) */
  const saveAssignee = (todo: RoomTodo, assignee: string, assigneeUserId: number | null) => {
    setPickingId(null);
    onSave?.(todo, { task: todo.task, assignee, due: todo.due ?? '', assigneeUserId });
  };
  const startEditing = (todo: RoomTodo) =>
    setEditing({ id: todo.id, change: { task: todo.task, assignee: todo.assignee ?? '', due: todo.due ?? '' } });

  const finish = (todo: RoomTodo) => {
    if (editing && editing.change.task.trim()) {
      onSave?.(todo, {
        task: editing.change.task.trim(),
        assignee: editing.change.assignee.trim(),
        due: editing.change.due.trim(),
      });
    }
    setEditing(null);
  };

  const keyDown = (event: KeyboardEvent<HTMLInputElement>, todo: RoomTodo) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      finish(todo);
    } else if (event.key === 'Escape') {
      setEditing(null);
    }
  };

  /**
   * 디자인 07 AssigneeChip (REQ-190, 11/25): 비어 있음 · AI 추정(점선, 확정 전) · 확정 · 외부(? 얼굴) · 열림.
   * AI 추정 칩은 누르면 바로 확정되고(마우스를 올리면 "확정" 툴팁), ⌄로 선택 창을 연다
   */
  const renderAssigneeChip = (todo: RoomTodo, text: string, hasAssignee: boolean) => {
    const isExternal = hasAssignee && todo.assigneeStatus === 'NOT_IN_ROSTER';
    const isSuggested = hasAssignee && !todo.edited;
    const isOpen = pickingId === todo.id;
    const person = everyone.find(({ userId }) => userId === todo.assigneeUserId);
    const canEdit = Boolean(onSave);
    const avatar = !hasAssignee ? (
      <Icon src={personIcon} size={EDIT_ICON_SIZE - 2} />
    ) : isExternal ? (
      <span className={`${styles.chipAvatar} ${styles.chipAvatarExternal}`} aria-hidden="true">
        ?
      </span>
    ) : person?.profileImageUrl ? (
      <img src={person.profileImageUrl} alt="" className={styles.chipAvatar} />
    ) : (
      <span className={styles.chipAvatar} aria-hidden="true">
        {todo.assignee?.slice(0, 1)}
      </span>
    );
    const chipClass = [
      styles.chip,
      !hasAssignee ? styles.chipEmpty : '',
      isSuggested ? styles.chipSuggested : '',
      isOpen ? styles.chipOpen : '',
    ]
      .filter(Boolean)
      .join(' ');
    const name = hasAssignee ? (isExternal ? todo.assignee : text) : '담당자';
    const togglePicker = () => {
      setDatingId(null);
      setPickingId((id) => (id === todo.id ? null : todo.id));
    };

    return (
      <span ref={isOpen ? pickerAnchorRef : undefined} className={styles.chipAnchor}>
        {isSuggested && canEdit && !isOpen ? (
          // AI 추정: 이름 쪽을 누르면 확정, ⌄는 다시 고르기
          <span className={chipClass}>
            <button
              type="button"
              className={styles.chipConfirm}
              aria-label={`${todo.task} 담당자 ${name} 확정`}
              onClick={() => saveAssignee(todo, todo.assignee ?? '', todo.assigneeUserId ?? null)}
            >
              {avatar}
              {name}
              <span className={styles.confirmTip} role="tooltip">
                확정
              </span>
            </button>
            <button type="button" className={styles.chipChevron} aria-label={`${todo.task} 담당자 다시 고르기`} onClick={togglePicker}>
              <Icon src={chevronDownIcon} size={EDIT_ICON_SIZE - 2} />
            </button>
          </span>
        ) : (
          <button
            type="button"
            className={chipClass}
            disabled={!canEdit}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-label={`${todo.task} 담당자 ${hasAssignee ? name : '선택'}`}
            onClick={togglePicker}
          >
            {avatar}
            {name}
            {isOpen && <Icon src={chevronUpIcon} size={EDIT_ICON_SIZE - 2} />}
            {isSuggested && !isOpen && <Icon src={chevronDownIcon} size={EDIT_ICON_SIZE - 2} />}
          </button>
        )}
        {isOpen && (
          <AssigneePicker
            attendees={people.attendees}
            members={people.members}
            selectedUserId={todo.assigneeUserId}
            anchorRef={pickerAnchorRef}
            onSelect={(picked) => saveAssignee(todo, picked.name, picked.userId)}
            onExternal={(external) => saveAssignee(todo, external, null)}
            onClose={() => setPickingId(null)}
          />
        )}
      </span>
    );
  };

  /** 디자인 07 "할 일 기한 고르기" (11/25): [기한] 칩 → 달력, 날짜를 누르면 11/14(금)이 들어가고 닫힌다 */
  const renderDueChip = (todo: RoomTodo) => {
    const isOpen = datingId === todo.id;
    return (
      <span ref={isOpen ? dueAnchorRef : undefined} className={styles.chipAnchor}>
        <button
          type="button"
          className={[styles.chip, todo.due ? '' : styles.chipEmpty, isOpen ? styles.chipOpen : ''].filter(Boolean).join(' ')}
          disabled={!onSave}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          aria-label={`${todo.task} 기한 ${todo.due ?? '선택'}`}
          onClick={() => {
            setPickingId(null);
            setDatingId((id) => (id === todo.id ? null : todo.id));
          }}
        >
          <Icon src={dueDateIcon} size={EDIT_ICON_SIZE - 2} />
          {todo.due ?? '기한'}
        </button>
        {isOpen && (
          <DueDatePicker
            value={todo.due}
            anchorRef={dueAnchorRef}
            onSelect={(dueText) => {
              setDatingId(null);
              // 할 일·담당자는 그대로 (같은 담당자면 번호와 명단 맞춤 결과도 그대로 남는다)
              onSave?.(todo, { task: todo.task, assignee: todo.assignee ?? '', due: dueText });
            }}
            onClose={() => setDatingId(null)}
          />
        )}
      </span>
    );
  };

  return (
    <ul className={variant === 'table' ? styles.table : styles.list}>
      {todos.map((todo) => {
        if (editing?.id === todo.id) {
          const change = editing.change;
          const update = (patch: Partial<TodoChange>) => setEditing({ id: todo.id, change: { ...change, ...patch } });
          return (
            <li key={todo.id} className={styles.editRow}>
              <input
                className={styles.input}
                aria-label="할 일"
                value={change.task}
                autoFocus
                onChange={(event) => update({ task: event.target.value })}
                onKeyDown={(event) => keyDown(event, todo)}
              />
              <input
                className={`${styles.input} ${styles.short}`}
                aria-label="담당자"
                placeholder={NO_ASSIGNEE}
                value={change.assignee}
                onChange={(event) => update({ assignee: event.target.value })}
                onKeyDown={(event) => keyDown(event, todo)}
              />
              <input
                className={`${styles.input} ${styles.short}`}
                aria-label="기한"
                placeholder="기한 미정"
                value={change.due}
                onChange={(event) => update({ due: event.target.value })}
                onKeyDown={(event) => keyDown(event, todo)}
              />
              <button type="button" className={styles.save} onClick={() => finish(todo)}>
                저장
              </button>
              <button type="button" className={styles.cancel} onClick={() => setEditing(null)}>
                취소
              </button>
            </li>
          );
        }
        const label = assigneeLabel(todo);
        if (variant === 'table') {
          const isDone = doneIds.includes(todo.id);
          const hasAssignee = Boolean(todo.assignee) && todo.assigneeStatus !== 'UNASSIGNED';
          return (
            <li key={todo.id} className={styles.tableRow}>
              <input
                type="checkbox"
                className={styles.check}
                aria-label={`${todo.task} 완료`}
                checked={isDone}
                disabled={!onToggleDone}
                onChange={() => onToggleDone?.(todo, !isDone)}
              />
              <span className={[styles.tableTask, isDone ? styles.done : ''].filter(Boolean).join(' ')}>{todo.task}</span>
              {renderAssigneeChip(todo, label.text, hasAssignee)}
              {renderDueChip(todo)}
            </li>
          );
        }
        return (
          <li key={todo.id} className={styles.item}>
            <span className={styles.task}>{todo.task}</span>
            <span className={label.className}>{label.text}</span>
            {todo.due && <span className={styles.due}>{todo.due}</span>}
            {onSave && (
              <button
                type="button"
                className={room.iconButton}
                aria-label={`${todo.task} 고치기`}
                onClick={() => startEditing(todo)}
              >
                <Icon src={editIcon} size={EDIT_ICON_SIZE} />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
