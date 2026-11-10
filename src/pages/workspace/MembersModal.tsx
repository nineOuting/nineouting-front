import type { FormEvent, ReactNode } from 'react';
import Button from '../../components/Button';
import Dialog from '../../components/Dialog';
import TextField from '../../components/TextField';
import type { Member } from '../../types/meeting';
import styles from './MembersModal.module.css';

const AVATAR_SIZE = 32;

interface MembersModalProps {
  description: string;
  /** 위에 보여 줄 권한 안내 (디자인 PermissionHelp) */
  help?: ReactNode;
  /** 입력 칸 안내 문구 (워크스페이스: 이메일 초대, 폴더: 이름, 이메일 검색) */
  inputPlaceholder: string;
  inputType?: 'text' | 'email';
  inputValue: string;
  inputError?: string;
  onInputChange: (value: string) => void;
  onAdd: () => void;
  /** 소유자만 초대, 제외, 양도를 할 수 있다 (REQ-033) */
  canManage: boolean;
  /** 소유권 양도 줄을 보여 줄지 (기본: canManage). 폴더는 폴더 소유자가 양도한다 (REQ-043) */
  canTransfer?: boolean;
  ownershipLabel: string;
  onTransferOwnership: () => void;
  onClose: () => void;
  children: ReactNode;
}

/** 워크스페이스, 프로젝트 폴더의 멤버 권한 관리 창 (디자인 MemberManageModal, REQ-033, 041~043, 127~129) */
export default function MembersModal({
  description,
  help,
  inputPlaceholder,
  inputType = 'text',
  inputValue,
  inputError,
  onInputChange,
  onAdd,
  canManage,
  canTransfer = canManage,
  ownershipLabel,
  onTransferOwnership,
  onClose,
  children,
}: MembersModalProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onAdd();
  };

  return (
    <Dialog title="멤버 권한 관리" description={description} width="md" onClose={onClose}>
      {help && <div className={styles.help}>{help}</div>}
      {canManage && (
        <form className={styles.addRow} onSubmit={handleSubmit} noValidate>
          <TextField
            type={inputType}
            aria-label={inputPlaceholder}
            placeholder={inputPlaceholder}
            value={inputValue}
            error={inputError}
            onChange={(event) => onInputChange(event.target.value)}
          />
          <Button type="submit" size="md">
            멤버 추가
          </Button>
        </form>
      )}
      <div className={styles.divider} />
      {children}
      {canTransfer && (
        <>
          <div className={styles.divider} />
          <div className={styles.footer}>
            <span>{ownershipLabel}</span>
            <Button variant="text" onClick={onTransferOwnership}>
              소유권 양도
            </Button>
          </div>
        </>
      )}
    </Dialog>
  );
}

/** 32px 얼굴 + 이름, 이메일 */
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
