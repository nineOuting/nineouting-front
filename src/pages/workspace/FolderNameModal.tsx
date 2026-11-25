import { useState, type FormEvent } from 'react';
import Button from '../../components/Button';
import Dialog from '../../components/Dialog';
import TextField from '../../components/TextField';
import useCloseGuard from '../../components/useCloseGuard';

// workspace-service CreateFolderRequest 길이 제한과 같다
const NAME_MAX_LENGTH = 50;
// MSG-031
const DUPLICATE_MESSAGE = '같은 이름의 폴더가 이미 있어요. 다른 이름을 입력해 주세요.';

interface FolderNameModalProps {
  title: string;
  /** 없으면 제목만 (피그마 "폴더 이름 바꾸기") */
  description?: string;
  submitLabel: string;
  initialName?: string;
  /** 입력 칸 이름. 워크스페이스 만들기(REQ-031)에도 이 창을 쓴다 */
  fieldLabel?: string;
  /** 같은 위치의 다른 폴더 이름 (이름 중복 확인, REQ-039) */
  siblingNames: string[];
  /** 실패하면 던진다. 서버 오류를 칸 아래 문구로 바꾼다 */
  onSubmit: (name: string) => Promise<void>;
  toErrorMessage: (error: unknown) => string;
  onClose: () => void;
}

/** REQ-039~040, 046~047 새 폴더 만들기 (디자인 NewFolderModal). 이름 바꾸기에도 같은 창을 쓴다 */
export default function FolderNameModal({
  title,
  description,
  submitLabel,
  initialName = '',
  fieldLabel = '폴더명',
  siblingNames,
  onSubmit,
  toErrorMessage,
  onClose,
}: FolderNameModalProps) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  // REQ-179 입력한 내용이 있으면 닫기 전에 묻는다
  const { requestClose, confirmElement } = useCloseGuard(name.trim() !== initialName.trim(), onClose);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (isSubmitting) {
      return;
    }
    if (!trimmed) {
      setError('폴더명을 입력해 주세요.');
      return;
    }
    // 대소문자는 구분하지 않는다 (workspace-service 결정 사항)
    if (siblingNames.some((sibling) => sibling.toLowerCase() === trimmed.toLowerCase())) {
      setError(DUPLICATE_MESSAGE);
      return;
    }
    setIsSubmitting(true);
    try {
      await onSubmit(trimmed);
    } catch (submitError) {
      setError(toErrorMessage(submitError));
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog
        title={title}
        description={description}
        onClose={requestClose}
        onSubmit={handleSubmit}
        footer={
          <>
            <Button variant="secondary" size="md" onClick={requestClose}>
              취소
            </Button>
            {/* REQ-040 레거시 (2026-11-22, 피그마 프론트는 입력 전에도 버튼이 활성이고 누르면 칸 아래 오류): disabled={!name.trim() || isSubmitting} */}
            {/* 피그마 "폴더 이름 겹침": 칸 아래 오류가 있으면 고치기 전까지 비활성 */}
            <Button isLoading={isSubmitting} type="submit" size="md" disabled={isSubmitting || Boolean(error)}>
              {submitLabel}
            </Button>
          </>
        }
      >
        <TextField
          label={fieldLabel}
          required
          placeholder={`${fieldLabel}을 입력해 주세요`}
          maxLength={NAME_MAX_LENGTH}
          value={name}
          autoFocus
          error={error}
          onChange={(event) => {
            setName(event.target.value);
            setError(undefined);
          }}
        />
      </Dialog>
      {confirmElement}
    </>
  );
}
