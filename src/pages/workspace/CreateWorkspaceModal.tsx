import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '../../api/client';
import { createWorkspace, inviteByEmail, issueInviteLink } from '../../api/workspace';
import chipRemoveIcon from '../../assets/icons/chip-remove.svg';
import copyIcon from '../../assets/icons/copy.svg';
import Button from '../../components/Button';
import Dialog from '../../components/Dialog';
import Icon from '../../components/Icon';
import TextField from '../../components/TextField';
import type { WorkspaceSummary } from '../../types/workspace';
import styles from './CreateWorkspaceModal.module.css';

// workspace-service CreateWorkspaceRequest 길이 제한과 같다
const NAME_MAX_LENGTH = 50;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CHIP_ICON_SIZE = 12;
const COPY_ICON_SIZE = 16;

interface CreateWorkspaceModalProps {
  onClose: () => void;
}

/**
 * REQ-031 새 워크스페이스 만들기 (디자인 CreateWorkspaceModal 1/2 이름, 2/2 멤버 초대).
 * 초대 링크를 바로 복사할 수 있게 1단계 [다음]에서 워크스페이스를 만든다. 설명 칸은 서버에 자리가 없어 넣지 않았다
 */
export default function CreateWorkspaceModal({ onClose }: CreateWorkspaceModalProps) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [created, setCreated] = useState<WorkspaceSummary>();
  const [email, setEmail] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [isBusy, setIsBusy] = useState(false);

  // notice는 워크스페이스 화면에 도착해서 토스트로 보여 준다
  const goToWorkspace = (workspace: WorkspaceSummary, notice?: string) => {
    onClose();
    navigate(`/workspaces/${workspace.workspaceId}`, { state: notice ? { notice } : undefined });
  };

  const submitName = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || isBusy) {
      return;
    }
    setIsBusy(true);
    try {
      setCreated(await createWorkspace(trimmed));
      setError(undefined);
    } catch (createError) {
      setError(errorMessage(createError));
    } finally {
      setIsBusy(false);
    }
  };

  const addEmail = () => {
    const trimmed = email.trim();
    if (!EMAIL_PATTERN.test(trimmed)) {
      setError('이메일 형식을 확인해 주세요.');
      return;
    }
    setEmails((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
    setEmail('');
    setError(undefined);
  };

  // REQ-034 발급할 때마다 이전 링크는 무효가 된다
  const copyLink = async (workspace: WorkspaceSummary) => {
    try {
      const url = await issueInviteLink(workspace.workspaceId);
      await navigator.clipboard.writeText(url);
      setNotice('초대 링크를 복사했어요. 1일 동안 쓸 수 있어요.');
    } catch (copyError) {
      setError(errorMessage(copyError));
    }
  };

  const sendInvites = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!created || isBusy) {
      return;
    }
    setIsBusy(true);
    const failed: string[] = [];
    for (const address of emails) {
      try {
        await inviteByEmail(created.workspaceId, address);
      } catch {
        failed.push(address);
      }
    }
    setIsBusy(false);
    if (failed.length > 0) {
      setEmails(failed);
      setError(`${failed.join(', ')} 초대를 보내지 못했어요. 다시 시도해 주세요.`);
      return;
    }
    // MSG-061
    goToWorkspace(created, emails.length > 0 ? `초대 메일을 ${emails.length}명에게 보냈어요.` : undefined);
  };

  if (!created) {
    return (
      <Dialog
        title="새 워크스페이스 만들기"
        description="1 / 2 · 이름을 정해 주세요"
        width="md"
        onClose={onClose}
        onSubmit={submitName}
        footer={
          <>
            <Button variant="secondary" size="md" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" size="md" disabled={!name.trim() || isBusy}>
              다음
            </Button>
          </>
        }
      >
        <TextField
          label="워크스페이스 이름"
          required
          placeholder="워크스페이스 이름을 입력해 주세요"
          maxLength={NAME_MAX_LENGTH}
          value={name}
          autoFocus
          error={error}
          helper="나중에 설정에서 바꿀 수 있어요"
          onChange={(event) => setName(event.target.value)}
        />
      </Dialog>
    );
  }

  return (
    <Dialog
      title="멤버 초대"
      description="2 / 2 · 함께 쓸 멤버를 초대해요. 나중에 초대해도 돼요"
      width="md"
      onClose={() => goToWorkspace(created)}
      onSubmit={sendInvites}
      footer={
        <>
          <Button variant="secondary" size="md" onClick={() => goToWorkspace(created)}>
            건너뛰기
          </Button>
          <Button type="submit" size="md" disabled={emails.length === 0 || isBusy}>
            초대하기
          </Button>
        </>
      }
    >
      <div className={styles.inviteRow}>
        <TextField
          type="email"
          aria-label="초대할 이메일"
          placeholder="이메일을 입력해 주세요"
          value={email}
          error={error}
          onChange={(event) => setEmail(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addEmail();
            }
          }}
        />
        <Button variant="secondary" size="md" onClick={addEmail} disabled={!email.trim()}>
          추가
        </Button>
      </div>
      {emails.length > 0 && (
        <div className={styles.invited}>
          <p className={styles.invitedLabel}>초대할 멤버 {emails.length}명</p>
          <ul className={styles.chips}>
            {emails.map((address) => (
              <li key={address} className={styles.chip}>
                {address}
                <button
                  type="button"
                  className={styles.chipRemove}
                  aria-label={`${address} 빼기`}
                  onClick={() => setEmails((prev) => prev.filter((value) => value !== address))}
                >
                  <Icon src={chipRemoveIcon} size={CHIP_ICON_SIZE} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className={styles.divider} />
      <div className={styles.linkRow}>
        <p className={styles.linkText}>{notice ?? '초대 링크로도 멤버를 부를 수 있어요'}</p>
        <Button variant="text" onClick={() => void copyLink(created)}>
          <Icon src={copyIcon} size={COPY_ICON_SIZE} />
          초대 링크 복사
        </Button>
      </div>
    </Dialog>
  );
}
