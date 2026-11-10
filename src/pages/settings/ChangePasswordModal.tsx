import { useState, type FormEvent } from 'react';
import { errorMessage } from '../../api/client';
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
      setErrors({ current: errorMessage(error) });
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Dialog
        title="비밀번호 변경"
        description="지금 비밀번호를 확인한 뒤 새 비밀번호로 바꿔요"
        onClose={requestClose}
        onSubmit={submit}
        footer={
          <>
            <Button variant="secondary" size="md" onClick={requestClose}>
              취소
            </Button>
            <Button isLoading={isSubmitting} type="submit" size="md" disabled={!current || !next || !confirm || isSubmitting}>
              변경하기
            </Button>
          </>
        }
      >
        <PasswordField
          label="지금 비밀번호"
          autoComplete="current-password"
          value={current}
          error={errors.current}
          onChange={(event) => setCurrent(event.target.value)}
        />
        <PasswordField
          label="새 비밀번호"
          autoComplete="new-password"
          value={next}
          error={errors.next}
          helper="8자 이상, 영문과 숫자를 각각 1자 이상 넣어 주세요"
          onChange={(event) => setNext(event.target.value)}
        />
        <PasswordField
          label="새 비밀번호 확인"
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
