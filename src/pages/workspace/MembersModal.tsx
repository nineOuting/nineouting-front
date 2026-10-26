import { useId, type FormEvent, type ReactNode } from 'react';
import dividerModal from '../../assets/divider-modal.svg';
import Modal from '../../components/Modal';
import Placeholder from '../../components/Placeholder';
import type { Member } from '../../types/meeting';
import styles from './MembersModal.module.css';

const CLOSE_ICON_SIZE = 24;
const ICON_SIZE = 16;
const AVATAR_SIZE = 32;
const DIVIDER_WIDTH = 542;

interface MembersModalProps {
  description: string;
  /** 입력 칸 안내 문구 (워크스페이스: 이메일 초대, 폴더: 이름·이메일 검색) */
  inputPlaceholder: string;
  inputType?: 'text' | 'email';
  inputValue: string;
  inputError?: string;
  onInputChange: (value: string) => void;
  onAdd: () => void;
  /** 소유자만 초대·제외·양도를 할 수 있다 (REQ-033) */
  canManage: boolean;
  ownershipLabel: string;
  onTransferOwnership: () => void;
  onClose: () => void;
  children: ReactNode;
}

/** 워크스페이스·프로젝트 폴더의 멤버 권한 관리 창 (REQ-033, 041~043, 127~129) */
export default function MembersModal({
  description,
  inputPlaceholder,
  inputType = 'text',
  inputValue,
  inputError,
  onInputChange,
  onAdd,
  canManage,
  ownershipLabel,
  onTransferOwnership,
  onClose,
  children,
}: MembersModalProps) {
  const titleId = useId();
  const errorId = useId();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onAdd();
  };

  return (
    <Modal labelledBy={titleId} onClose={onClose} className={styles.card}>
      <div className={styles.top}>
        <div className={styles.head}>
          <div className={styles.titleRow}>
            <h2 id={titleId} className={styles.title}>
              멤버 권한 관리
            </h2>
            <button type="button" className={styles.iconButton} aria-label="닫기" onClick={onClose}>
              <Placeholder size={CLOSE_ICON_SIZE} />
            </button>
          </div>
          <p className={styles.description}>{description}</p>
        </div>
        {canManage && (
          <form className={styles.addRow} onSubmit={handleSubmit} noValidate>
            <label className={[styles.inputBox, inputError ? styles.inputBoxError : ''].filter(Boolean).join(' ')}>
              <Placeholder size={ICON_SIZE} />
              <input
                type={inputType}
                className={styles.input}
                placeholder={inputPlaceholder}
                aria-label={inputPlaceholder}
                aria-invalid={Boolean(inputError)}
                aria-describedby={inputError ? errorId : undefined}
                value={inputValue}
                onChange={(event) => onInputChange(event.target.value)}
              />
            </label>
            <button type="submit" className={styles.addButton}>
              <Placeholder size={ICON_SIZE} />
              멤버 추가
            </button>
          </form>
        )}
        {inputError && (
          <p id={errorId} className={styles.error}>
            {inputError}
          </p>
        )}
      </div>
      <img src={dividerModal} alt="" width={DIVIDER_WIDTH} height={1} className={styles.divider} />
      <div className={styles.body}>
        {children}
        {canManage && (
          <>
            <img src={dividerModal} alt="" width={DIVIDER_WIDTH} height={1} className={styles.divider} />
            <div className={styles.footer}>
              <span>{ownershipLabel}</span>
              <button type="button" className={styles.transfer} onClick={onTransferOwnership}>
                소유권 양도
                <Placeholder size={ICON_SIZE} />
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

/** 32px 얼굴 + 이름·이메일 */
export function MemberIdentity({ member, email }: { member: Member; email: string }) {
  return (
    <span className={styles.identity}>
      {member.profileImageUrl ? (
        <img src={member.profileImageUrl} alt="" width={AVATAR_SIZE} height={AVATAR_SIZE} className={styles.avatar} />
      ) : (
        <span className={styles.avatar} aria-hidden="true" />
      )}
      <span className={styles.identityText}>
        <span className={styles.memberName}>{member.name}</span>
        <span className={styles.memberEmail}>{email}</span>
      </span>
    </span>
  );
}
