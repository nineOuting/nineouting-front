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
  candidates: TransferCandidate[];
  /** 실패하면 던진다. 메시지를 창 안에 보여 준다 */
  onTransfer: (userId: number) => Promise<void>;
  /** 확인 창(MSG-091) 설명. 없으면 일반 문구. 워크스페이스는 피그마 11/24 문구를 넘긴다 */
  confirmDescription?: (name: string) => string;
  onClose: () => void;
}

/**
 * REQ-043, 129 소유권 넘기기. 멤버를 고르고(MSG-090) [다음]을 누르면 한 번 더 묻는다(MSG-091).
 * 소유자는 1명이라 넘기면 나는 일반 멤버가 된다
 */
export default function TransferOwnerDialog({ candidates, onTransfer, confirmDescription, onClose }: TransferOwnerDialogProps) {
  const [selectedId, setSelectedId] = useState<number>();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [error, setError] = useState<string>();
  const selected = candidates.find(({ userId }) => userId === selectedId);

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

  if (isConfirming && selected) {
    // MSG-091
    return (
      <Dialog
        title={`${selected.name} 님에게 소유권을 넘길까요?`}
        description={
          confirmDescription
            ? confirmDescription(selected.name)
            : `넘기면 관리 권한은 ${selected.name} 님에게 가고, 나는 일반 멤버가 돼요.`
        }
        width="md"
        onClose={onClose}
        footer={
          <>
            <Button variant="secondary" size="md" disabled={isTransferring} onClick={() => setIsConfirming(false)}>
              취소
            </Button>
            <Button size="md" isLoading={isTransferring} onClick={() => void transfer()}>
              넘기기
            </Button>
          </>
        }
      >
        {error && (
          <p className={`${styles.empty} ${styles.danger}`} role="alert">
            {error}
          </p>
        )}
      </Dialog>
    );
  }

  // MSG-090
  return (
    <Dialog
      title="소유권을 넘길 멤버를 골라 주세요"
      // 피그마 WorkspaceOwnershipSelectPage: 400px 창
      description="넘기면 나는 일반 멤버가 돼요"
      width="sm"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={onClose}>
            취소
          </Button>
          <Button size="md" disabled={selectedId === undefined} onClick={() => setIsConfirming(true)}>
            다음
          </Button>
        </>
      }
    >
      <ul className={styles.list}>
        {candidates.length === 0 && <li className={styles.empty}>소유권을 넘길 수 있는 멤버가 없어요.</li>}
        {candidates.map((member) => (
          <li key={member.userId} className={[styles.row, styles.rowPickable, selectedId === member.userId ? styles.rowPicked : ''].filter(Boolean).join(' ')}>
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
    </Dialog>
  );
}
