import { useEffect, useState } from 'react';
import { errorMessage } from '../../api/client';
import { getMyOwnership, withdrawAccount, type Ownership } from '../../api/user';
import infoIcon from '../../assets/icons/info.svg';
import Button from '../../components/Button';
import Checkbox from '../../components/Checkbox';
import Dialog from '../../components/Dialog';
import Icon from '../../components/Icon';
import styles from './WithdrawModal.module.css';

interface WithdrawModalProps {
  onDone: () => void;
  onClose: () => void;
}

/**
 * REQ-207 회원 탈퇴 확인 (MSG-109, 디자인 Card 회원 탈퇴 확인).
 * 안내를 확인하고 동의를 체크해야 [탈퇴하기]가 켜진다. 소유한 워크스페이스나 폴더가 있으면 목록을 보여 주고 막는다
 */
export default function WithdrawModal({ onDone, onClose }: WithdrawModalProps) {
  const [isAgreed, setIsAgreed] = useState(false);
  const [ownership, setOwnership] = useState<Ownership | null>(null);
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const owned = ownership ? [...ownership.workspaces, ...ownership.folders] : [];

  useEffect(() => {
    let isCurrent = true;
    getMyOwnership()
      .then((loaded) => isCurrent && setOwnership(loaded))
      .catch(() => isCurrent && setOwnership({ workspaces: [], folders: [] }));
    return () => {
      isCurrent = false;
    };
  }, []);

  const submit = async () => {
    setIsSubmitting(true);
    setError(undefined);
    try {
      await withdrawAccount();
      onDone();
    } catch (caught) {
      setError(errorMessage(caught));
      // 막힌 이유(소유한 것)를 다시 보여 준다
      getMyOwnership().then(setOwnership).catch(() => undefined);
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      title="정말 탈퇴할까요?"
      description="계정 정보와 내가 만든 회의록이 모두 삭제돼요. 삭제한 정보는 되돌릴 수 없어요."
      width="md"
      onClose={isSubmitting ? () => undefined : onClose}
      hideClose={isSubmitting}
      footer={
        <>
          <Button variant="secondary" size="md" disabled={isSubmitting} onClick={onClose}>
            취소
          </Button>
          <Button
            variant="danger"
            size="md"
            isLoading={isSubmitting}
            disabled={!isAgreed || owned.length > 0 || ownership === null}
            onClick={() => void submit()}
          >
            탈퇴하기
          </Button>
        </>
      }
    >
      <div className={styles.notice}>
        <Icon src={infoIcon} size={18} className={styles.noticeIcon} />
        <div className={styles.noticeText}>
          <p className={styles.noticeTitle}>소유한 워크스페이스가 있다면</p>
          <p className={styles.noticeDescription}>다른 멤버에게 소유권을 넘긴 뒤에 탈퇴할 수 있어요</p>
          {owned.length > 0 && (
            <ul className={styles.ownedList} aria-label="소유권을 넘겨야 하는 곳">
              {owned.map((name) => (
                <li key={name}>{name}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <Checkbox checked={isAgreed} disabled={isSubmitting} onChange={() => setIsAgreed((value) => !value)}>
        안내를 확인했고, 탈퇴에 동의해요
      </Checkbox>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </Dialog>
  );
}
