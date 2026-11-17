import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { MyTodo } from '../../api/meeting';
import Button from '../../components/Button';
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
 * REQ-196 홈 내 할 일: 회의에서 나에게 배정된 할 일과 회의명, 프로젝트.
 * 체크한 뒤 [완료]를 누르면 목록에서 사라지고, 할 일을 누르면 그 회의록으로 간다
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
    <section className={card.card} aria-labelledby="my-todos-title">
      <div className={card.head}>
        <div className={card.titleGroup}>
          <h2 id="my-todos-title" className={card.title}>
            내 할 일
          </h2>
          {items.length > 0 && <p className={card.subtitle}>회의에서 나에게 배정된 할 일 {items.length}개</p>}
        </div>
        {items.length > 0 && (
          <Button
            type="button"
            variant="secondary"
            size="md"
            isLoading={isSaving}
            disabled={selected.length === 0 || isSaving}
            onClick={() => void complete()}
          >
            완료
          </Button>
        )}
      </div>
      {items.length === 0 ? (
        <div className={card.empty}>
          <p className={card.emptyTitle}>남은 할 일이 없어요</p>
          <p className={card.emptyCaption}>회의에서 나에게 배정된 할 일이 생기면 이곳에 모여요.</p>
        </div>
      ) : (
        <ul className={styles.list}>
          {items.map((todo) => {
            const key = keyOf(todo);
            return (
              <li key={key} className={styles.item}>
                <Checkbox
                  aria-label={`${todo.task} 완료로 고르기`}
                  checked={selected.includes(key)}
                  disabled={isSaving}
                  onChange={() => toggle(key)}
                >
                  {null}
                </Checkbox>
                <Link to={`/meetings/${todo.meetingId}/minutes`} className={styles.link}>
                  <span className={styles.task}>{todo.task}</span>
                  <span className={card.caption}>
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
