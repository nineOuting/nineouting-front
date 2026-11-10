import { useState, type FormEvent } from 'react';
import Button from '../../components/Button';
import Dialog from '../../components/Dialog';
import TextField from '../../components/TextField';
import useCloseGuard from '../../components/useCloseGuard';

// workspace-service CreateFolderRequest 길이 제한과 같다
const NAME_MAX_LENGTH = 50;
// MSG-031
const DUPLICATE_MESSAGE = '같은 이름의 폴더가 이미 있습니다. 다른 이름을 입력해 주세요.';

interface FolderNameModalProps {
  title: string;
  description: string;
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
    if (!trimmed || isSubmitting) {
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
            {/* REQ-040 폴더명을 입력하기 전에는 누를 수 없다 */}
            <Button type="submit" size="md" disabled={!name.trim() || isSubmitting}>
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
