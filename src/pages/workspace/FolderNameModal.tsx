import { useId, useState, type FormEvent } from 'react';
import Modal from '../../components/Modal';
import Placeholder from '../../components/Placeholder';
import styles from './FolderNameModal.module.css';

const CLOSE_ICON_SIZE = 24;
// workspace-service CreateFolderRequest 길이 제한과 같다
const NAME_MAX_LENGTH = 50;
// MSG-031
const DUPLICATE_MESSAGE = '같은 이름의 폴더가 이미 있습니다. 다른 이름을 입력해 주세요.';

interface FolderNameModalProps {
  title: string;
  description: string;
  submitLabel: string;
  initialName?: string;
  /** 같은 위치의 다른 폴더 이름 (이름 중복 확인, REQ-039) */
  siblingNames: string[];
  onSubmit: (name: string) => void;
  onClose: () => void;
}

/** REQ-039~040, 046~047 새 폴더 만들기. 이름 바꾸기에도 같은 창을 쓴다 */
export default function FolderNameModal({
  title,
  description,
  submitLabel,
  initialName = '',
  siblingNames,
  onSubmit,
  onClose,
}: FolderNameModalProps) {
  const titleId = useId();
  const inputId = useId();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string>();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      return;
    }
    if (siblingNames.includes(trimmed)) {
      setError(DUPLICATE_MESSAGE);
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <Modal labelledBy={titleId} onClose={onClose} closeOnDimClick className={styles.card}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.head}>
          <div className={styles.texts}>
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
            <p className={styles.description}>{description}</p>
          </div>
          <button type="button" className={styles.iconButton} aria-label="닫기" onClick={onClose}>
            <Placeholder size={CLOSE_ICON_SIZE} />
          </button>
        </div>
        <div className={styles.field}>
          <label htmlFor={inputId} className={styles.label}>
            폴더명 *
          </label>
          <input
            id={inputId}
            className={[styles.input, error ? styles.inputError : ''].filter(Boolean).join(' ')}
            placeholder="폴더명을 입력해 주세요"
            maxLength={NAME_MAX_LENGTH}
            value={name}
            autoFocus
            aria-invalid={Boolean(error)}
            onChange={(event) => {
              setName(event.target.value);
              setError(undefined);
            }}
          />
          {error && <p className={styles.error}>{error}</p>}
        </div>
        <div className={styles.actions}>
          {/* REQ-040 폴더명을 입력하기 전에는 누를 수 없다 */}
          <button type="submit" className={styles.submit} disabled={!name.trim()}>
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
