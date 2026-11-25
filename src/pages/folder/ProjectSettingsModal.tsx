import { useState, type FormEvent } from 'react';
import { errorMessage } from '../../api/client';
import Button from '../../components/Button';
import Dialog from '../../components/Dialog';
import TextField from '../../components/TextField';
import useCloseGuard from '../../components/useCloseGuard';
import { FOLDER_COLORS, folderColor } from '../../utils/folderColor';
import settingsStyles from '../workspace/WorkspaceSettingsModal.module.css';
import pickerStyles from './ProjectColorPicker.module.css';
import styles from './ProjectSettingsModal.module.css';

// workspace-service CreateFolderRequest 길이 제한과 같다
const NAME_MAX_LENGTH = 50;

interface ProjectSettingsModalProps {
  name: string;
  color: number;
  /** REQ-165 이름 바꾸기 (서버: 프로젝트 소유자, 기본 폴더는 워크스페이스 소유자) */
  canRename: boolean;
  /** REQ-043 소유권 양도는 프로젝트 소유자만 */
  canTransfer: boolean;
  /** 바뀐 것만 저장한다. 실패하면 던진다 (창 안에 오류를 보인다) */
  onSave: (next: { name?: string; color?: number }) => Promise<void>;
  onTransfer: () => void;
  onClose: () => void;
}

/**
 * REQ-165, 202, 043 프로젝트 설정 (피그마 04 프로젝트 ProjectSettingsPage, 11/24 신규).
 * 폴더 이름, 프로젝트 색, 소유권 양도. ⋮ [프로젝트 설정]으로 연다
 */
export default function ProjectSettingsModal({
  name,
  color,
  canRename,
  canTransfer,
  onSave,
  onTransfer,
  onClose,
}: ProjectSettingsModalProps) {
  const [draft, setDraft] = useState(name);
  const [pickedColor, setPickedColor] = useState(color);
  const [error, setError] = useState<string>();
  const [isSaving, setIsSaving] = useState(false);
  const trimmed = draft.trim();
  const isChanged = trimmed !== name || pickedColor !== color;
  // REQ-179 입력한 내용이 있으면 닫기 전에 묻는다
  const { requestClose, confirmElement } = useCloseGuard(isChanged, onClose);

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) {
      return;
    }
    if (!trimmed) {
      setError('폴더명을 입력해 주세요.');
      return;
    }
    if (!isChanged) {
      onClose();
      return;
    }
    setIsSaving(true);
    try {
      await onSave({
        name: trimmed !== name ? trimmed : undefined,
        color: pickedColor !== color ? pickedColor : undefined,
      });
    } catch (caught) {
      setError(errorMessage(caught));
      setIsSaving(false);
    }
  };

  return (
    <>
      <Dialog
        title="프로젝트 설정"
        description="폴더 이름과 색을 바꾸거나, 소유권을 다른 멤버에게 넘길 수 있어요."
        width="md"
        onClose={requestClose}
        onSubmit={save}
        footer={
          <>
            <Button type="button" variant="secondary" size="md" onClick={requestClose}>
              취소
            </Button>
            <Button type="submit" size="md" isLoading={isSaving} disabled={isSaving || Boolean(error)}>
              저장
            </Button>
          </>
        }
      >
        <TextField
          label="폴더 이름"
          required
          value={draft}
          maxLength={NAME_MAX_LENGTH}
          disabled={!canRename || isSaving}
          error={error}
          helper={canRename ? undefined : '폴더 이름은 프로젝트 소유자만 바꿀 수 있어요'}
          onChange={(event) => {
            setDraft(event.target.value);
            setError(undefined);
          }}
        />
        {/* 피그마 ProjectColorPicker를 창 안에 넣었다 (고른 색은 [저장]할 때 바뀐다) */}
        <div className={styles.colorField}>
          <p className={styles.colorLabel}>프로젝트 색</p>
          <div className={`${pickerStyles.swatches} ${styles.swatchRow}`} role="radiogroup" aria-label="프로젝트 색">
            {FOLDER_COLORS.map(({ key, label }, index) => (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={pickedColor === index}
                aria-label={label}
                className={[pickerStyles.swatch, pickedColor === index ? pickerStyles.selected : ''].filter(Boolean).join(' ')}
                style={{ background: folderColor(index) }}
                onClick={() => setPickedColor(index)}
              />
            ))}
          </div>
          <p className={pickerStyles.caption}>사이드바, 폴더 카드, 달력에 같이 적용돼요</p>
        </div>
        {canTransfer && (
          <div className={settingsStyles.ownership}>
            <div className={settingsStyles.texts}>
              <p className={settingsStyles.zoneTitle}>프로젝트 소유권</p>
              <p className={settingsStyles.zoneDescription}>넘기면 나는 일반 멤버가 되고, 설정은 새 소유자가 관리해요</p>
            </div>
            <button type="button" className={settingsStyles.transferButton} onClick={onTransfer}>
              소유권 양도
            </button>
          </div>
        )}
      </Dialog>
      {confirmElement}
    </>
  );
}
