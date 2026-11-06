import type { RoomTodo } from '../../../types/meetingRoom';
import styles from './TodoList.module.css';

const NO_ASSIGNEE = '담당자 미정';

interface TodoListProps {
  todos: RoomTodo[];
}

/** REQ-097 할 일·담당자·기한 (임시 디자인) */
export default function TodoList({ todos }: TodoListProps) {
  return (
    <ul className={styles.list}>
      {todos.map((todo) => (
        <li key={todo.id} className={styles.item}>
          <span className={styles.task}>{todo.task}</span>
          <span className={todo.assignee ? styles.assignee : styles.unassigned}>{todo.assignee ?? NO_ASSIGNEE}</span>
          {todo.due && <span className={styles.due}>{todo.due}</span>}
        </li>
      ))}
    </ul>
  );
}
