import { useState, type ComponentProps } from 'react';
import Placeholder from './Placeholder';
import TextField from './TextField';
import styles from './PasswordField.module.css';

const TOGGLE_ICON_SIZE = 20;

type PasswordFieldProps = Omit<ComponentProps<typeof TextField>, 'type' | 'trailing'>;

/** REQ-006 비밀번호 마스킹. 오른쪽 아이콘으로 보이기/숨기기를 바꾼다 */
export default function PasswordField(props: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <TextField
      {...props}
      type={isVisible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          className={styles.toggle}
          aria-label={isVisible ? '비밀번호 숨기기' : '비밀번호 보기'}
          aria-pressed={isVisible}
          onClick={() => setIsVisible((value) => !value)}
        >
          <Placeholder size={TOGGLE_ICON_SIZE} />
        </button>
      }
    />
  );
}
