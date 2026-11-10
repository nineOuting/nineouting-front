import { useState } from 'react';
import { errorMessage } from '../../api/client';
import Button from '../../components/Button';
import Dialog from '../../components/Dialog';
import type { Member } from '../../types/meeting';
import { MemberIdentity } from './MembersModal';
import styles from './MembersModal.module.css';

interface TransferCandidate extends Member {
  email: string;
}

interface TransferOwnerDialogProps {
  /** 워크스페이스 또는 폴더 */
  target: string;
  candidates: TransferCandidate[];
  /** 실패하면 던진다. 메시지를 창 안에 보여 준다 */
  onTransfer: (userId: number) => Promise<void>;
  onClose: () => void;
}

/** REQ-043, 129 소유권을 넘길 멤버를 고른다. 소유자는 1명이라 넘기면 나는 일반 멤버가 된다 (디자인이 없어 멤버 권한 관리 창 모양을 따랐다) */
export default function TransferOwnerDialog({ target, candidates, onTransfer, onClose }: TransferOwnerDialogProps) {
  const [selectedId, setSelectedId] = useState<number>();
  const [isTransferring, setIsTransferring] = useState(false);
  const [error, setError] = useState<string>();

  const transfer = async () => {
    if (selectedId === undefined) {
      return;
    }
    setIsTransferring(true);
    setError(undefined);
    try {
      await onTransfer(selectedId);
    } catch (caught) {
      setError(errorMessage(caught));
      setIsTransferring(false);
    }
  };

  return (
    <Dialog
      title="소유권 양도"
      description={`${target} 소유권을 넘길 멤버를 골라 주세요. 넘기면 나는 일반 멤버가 돼요.`}
      width="md"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            취소
          </Button>
          <Button size="md" disabled={selectedId === undefined} isLoading={isTransferring} onClick={() => void transfer()}>
            양도하기
          </Button>
        </>
      }
    >
      <ul className={styles.list}>
        {candidates.length === 0 && <li className={styles.empty}>소유권을 넘길 수 있는 멤버가 없어요.</li>}
        {candidates.map((member) => (
          <li key={member.userId} className={styles.row}>
            <label className={styles.rowLead}>
              <input
                type="radio"
                name="transfer-owner"
                className={styles.check}
                aria-label={`${member.name} 선택`}
                checked={selectedId === member.userId}
                onChange={() => setSelectedId(member.userId)}
              />
              <MemberIdentity member={member} email={member.email} />
            </label>
          </li>
        ))}
      </ul>
      {error && (
        <p className={`${styles.empty} ${styles.danger}`} role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
