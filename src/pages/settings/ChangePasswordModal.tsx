import { useState, type FormEvent } from 'react';
import { errorMessage, isApiError } from '../../api/client';
import { changePassword } from '../../api/user';
import Button from '../../components/Button';
import Dialog from '../../components/Dialog';
import PasswordField from '../../components/PasswordField';
import { MESSAGES, PASSWORD_REGEX } from '../../constants/auth';
import useCloseGuard from '../../components/useCloseGuard';

interface ChangePasswordModalProps {
  onDone: () => void;
  onClose: () => void;
}

/** REQ-116 비밀번호 변경. 디자인이 없어 디자인 Modal 틀에 맞췄다 */
export default function ChangePasswordModal({ onDone, onClose }: ChangePasswordModalProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // REQ-179 입력한 내용이 있으면 닫기 전에 묻는다
  const { requestClose, confirmElement } = useCloseGuard(Boolean(current || next || confirm), onClose);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) {
      return;
    }
    if (!PASSWORD_REGEX.test(next)) {
      setErrors({ next: MESSAGES.invalidPassword });
      return;
    }
    if (next !== confirm) {
      setErrors({ confirm: '새 비밀번호가 서로 달라요.' });
      return;
    }
    setIsSubmitting(true);
    try {
      await changePassword(current, next);
      onDone();
    } catch (error) {
      // MSG-107
      setErrors({ current: isApiError(error, 'PASSWORD_MISMATCH') ? '현재 비밀번호가 맞지 않아요. 다시 확인해 주세요.' : errorMessage(error) });
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog
        title="비밀번호 변경"
        width="md"
        onClose={requestClose}
        onSubmit={submit}
        footer={
          <>
            <Button variant="secondary" size="md" onClick={requestClose}>
              취소
            </Button>
            <Button isLoading={isSubmitting} type="submit" size="md" disabled={!current || !next || !confirm || isSubmitting}>
              변경
            </Button>
          </>
        }
      >
        <PasswordField
          label="현재 비밀번호"
          placeholder="현재 비밀번호를 입력해 주세요"
          required
          autoComplete="current-password"
          value={current}
          error={errors.current}
          onChange={(event) => setCurrent(event.target.value)}
        />
        <PasswordField
          label="새 비밀번호"
          placeholder="새 비밀번호를 입력해 주세요"
          required
          autoComplete="new-password"
          value={next}
          error={errors.next}
          helper="8자 이상, 영문과 숫자를 함께 써 주세요"
          onChange={(event) => setNext(event.target.value)}
        />
        <PasswordField
          label="새 비밀번호 확인"
          placeholder="새 비밀번호를 한 번 더 입력해 주세요"
          required
          autoComplete="new-password"
          value={confirm}
          error={errors.confirm}
          onChange={(event) => setConfirm(event.target.value)}
        />
      </Dialog>
      {confirmElement}
    </>
  );
}
