import { useState, type KeyboardEvent } from 'react';
import editIcon from '../../../assets/icons/create-sm.svg';
import Icon from '../../../components/Icon';
import type { RoomTodo } from '../../../types/meetingRoom';
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
}

interface TodoListProps {
  todos: RoomTodo[];
  /** 넘기면 회의록 작성자가 할 일, 담당자, 기한을 고친다 */
  onSave?: (todo: RoomTodo, change: TodoChange) => void;
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
export default function TodoList({ todos, onSave }: TodoListProps) {
  const [editing, setEditing] = useState<{ id: string; change: TodoChange } | null>(null);

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

  return (
    <ul className={styles.list}>
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
                onClick={() =>
                  setEditing({ id: todo.id, change: { task: todo.task, assignee: todo.assignee ?? '', due: todo.due ?? '' } })
                }
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
