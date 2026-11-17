import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { MyTodo } from '../../api/meeting';
import Checkbox from '../../components/Checkbox';
import card from './HomeCard.module.css';
import styles from './MyTodosCard.module.css';

interface MyTodosCardProps {
  items: MyTodo[];
  /** 고른 할 일을 완료한다. 끝나면 목록에서 빠진다 */
  onComplete: (todos: MyTodo[]) => Promise<void>;
}

const keyOf = (todo: MyTodo) => `${todo.meetingId}:${todo.itemId}`;

/**
 * REQ-196 홈 내 할 일 (피그마 Page 8 MyTasksSection): 할 일과 회의명, 프로젝트.
 * 체크하면 흐리게 바뀌고 [완료]를 누르면 목록에서 사라진다. 할 일을 누르면 그 회의록으로 간다
 */
export default function MyTodosCard({ items, onComplete }: MyTodosCardProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const toggle = (key: string) =>
    setSelected((prev) => (prev.includes(key) ? prev.filter((one) => one !== key) : [...prev, key]));

  const complete = async () => {
    setIsSaving(true);
    try {
      await onComplete(items.filter((todo) => selected.includes(keyOf(todo))));
      setSelected([]);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className={card.section} aria-labelledby="my-todos-title">
      <div className={card.sectionHead}>
        <div className={card.sectionTitleGroup}>
          <h2 id="my-todos-title" className={card.title}>
            내 할 일
          </h2>
          <span className={card.count}>총 {items.length}개</span>
        </div>
        <button
          type="button"
          className={card.textButton}
          disabled={selected.length === 0 || isSaving}
          onClick={() => void complete()}
        >
          완료
        </button>
      </div>
      {items.length === 0 ? (
        <p className={`${card.listBox} ${card.boxEmpty}`}>회의에서 나에게 배정된 할 일이 없어요.</p>
      ) : (
        <ul className={`${card.listBox} ${styles.list}`}>
          {items.map((todo) => {
            const key = keyOf(todo);
            const isChecked = selected.includes(key);
            return (
              <li key={key} className={[styles.item, isChecked ? styles.checked : ''].filter(Boolean).join(' ')}>
                <Checkbox
                  aria-label={`${todo.task} 완료로 고르기`}
                  checked={isChecked}
                  disabled={isSaving}
                  onChange={() => toggle(key)}
                >
                  {null}
                </Checkbox>
                <Link to={`/meetings/${todo.meetingId}/minutes`} className={styles.link}>
                  <span className={card.rowTitle}>{todo.task}</span>
                  <span className={card.rowCaption}>
                    {todo.meetingTitle} · {todo.folderName}
                    {todo.dueText && ` · ${todo.dueText}`}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
