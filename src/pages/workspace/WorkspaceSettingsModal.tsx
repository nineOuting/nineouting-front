import { useState, type FormEvent } from 'react';
import { errorMessage } from '../../api/client';
import Button from '../../components/Button';
import Dialog from '../../components/Dialog';
import TextField from '../../components/TextField';
import useCloseGuard from '../../components/useCloseGuard';
import styles from './WorkspaceSettingsModal.module.css';

const MAX_NAME_LENGTH = 50;
const MAX_DESCRIPTION_LENGTH = 100;

interface WorkspaceSettingsModalProps {
  name: string;
  description: string;
  isOwner: boolean;
  /** REQ-163 이름, 설명 저장. 실패하면 던진다 (창 안에 오류를 보인다) */
  onSave: (name: string, description: string) => Promise<void>;
  onLeave: () => void;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * 워크스페이스 설정 (디자인 WorkspaceSettingsModal).
 * REQ-163 이름, 설명 수정(소유자만), 나가기(REQ-032), 삭제(REQ-138, 소유자만)
 */
export default function WorkspaceSettingsModal({
  name,
  description,
  isOwner,
  onSave,
  onLeave,
  onDelete,
  onClose,
}: WorkspaceSettingsModalProps) {
  const [draft, setDraft] = useState(name);
  const [descriptionDraft, setDescriptionDraft] = useState(description);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const trimmed = draft.trim();
  const isChanged = trimmed !== name || descriptionDraft.trim() !== description;
  const canSave = isOwner && !isSaving && trimmed.length > 0 && isChanged;
  // REQ-179 입력한 내용이 있으면 닫기 전에 묻는다
  const { requestClose, confirmElement } = useCloseGuard(isOwner && isChanged, onClose);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSave) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSave(trimmed, descriptionDraft.trim());
    } catch (caught) {
      setError(errorMessage(caught));
      setIsSaving(false);
    }
  };

  return (
    <>
      <Dialog
        title="워크스페이스 설정"
        description={isOwner ? '이름과 설명을 바꾸거나 워크스페이스를 나가고 삭제할 수 있어요.' : '워크스페이스를 나갈 수 있어요.'}
        width="md"
        onClose={requestClose}
        onSubmit={save}
        footer={
          <>
            <Button type="button" variant="secondary" size="md" onClick={requestClose}>
              {isOwner ? '취소' : '닫기'}
            </Button>
            {isOwner && (
              <Button type="submit" variant="primary" size="md" disabled={!canSave}>
                {isSaving ? '저장 중' : '저장'}
              </Button>
            )}
          </>
        }
      >
        <TextField
          label="워크스페이스 이름"
          value={draft}
          maxLength={MAX_NAME_LENGTH}
          disabled={!isOwner || isSaving}
          error={error ?? (isOwner && draft.length > 0 && trimmed.length === 0 ? '워크스페이스 이름을 입력해 주세요' : undefined)}
          helper={isOwner ? `${draft.length} / ${MAX_NAME_LENGTH}` : '이름은 소유자만 바꿀 수 있어요'}
          onChange={(event) => setDraft(event.target.value)}
        />
        <TextField
          label="설명"
          value={descriptionDraft}
          maxLength={MAX_DESCRIPTION_LENGTH}
          disabled={!isOwner || isSaving}
          placeholder={isOwner ? '어떤 팀의 워크스페이스인지 적어 주세요' : '설명이 없어요'}
          helper={isOwner ? `${descriptionDraft.length} / ${MAX_DESCRIPTION_LENGTH}` : undefined}
          onChange={(event) => setDescriptionDraft(event.target.value)}
        />
        <div className={styles.zone}>
          <div className={styles.zoneRow}>
            <div className={styles.texts}>
              <p className={styles.zoneTitle}>워크스페이스 나가기</p>
              <p className={styles.zoneDescription}>나가면 이 워크스페이스의 폴더와 회의록을 볼 수 없어요</p>
            </div>
            <button type="button" className={`${styles.zoneButton} ${styles.leave}`} onClick={onLeave}>
              나가기
            </button>
          </div>
          {isOwner && (
            <>
              <div className={styles.divider} />
              <div className={styles.zoneRow}>
                <div className={styles.texts}>
                  <p className={styles.zoneTitle}>워크스페이스 삭제</p>
                  <p className={styles.zoneDescription}>모든 폴더와 회의록이 삭제돼요. 소유자만 할 수 있어요</p>
                </div>
                <button type="button" className={`${styles.zoneButton} ${styles.delete}`} onClick={onDelete}>
                  삭제
                </button>
              </div>
            </>
          )}
        </div>
      </Dialog>
      {confirmElement}
    </>
  );
}
