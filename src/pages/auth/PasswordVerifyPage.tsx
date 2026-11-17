import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { requestPasswordReset, verifyPasswordReset } from '../../api/auth';
import { errorMessage, isApiError } from '../../api/client';
import AuthLayout from '../../components/AuthLayout';
import Button from '../../components/Button';
import CodeInput from '../../components/CodeInput';
import chevronLeftIcon from '../../assets/icons/chevron-left.svg';
import Icon from '../../components/Icon';
import timerIcon from '../../assets/icons/timer.svg';
import Toast, { type ToastMessage } from '../../components/Toast';
import {
  AUTH_ERROR_CODES,
  MESSAGES,
  PASSWORD_RESET_CODE_TTL_SECONDS,
  VERIFICATION_CODE_LENGTH,
  VERIFICATION_LOCK_SECONDS,
} from '../../constants/auth';
import { formatSeconds, useCountdown } from '../../hooks/useCountdown';
import { useTimedLock } from '../../hooks/useTimedLock';
import auth from './auth.module.css';
import styles from './PasswordVerifyPage.module.css';

const BACK_ICON_SIZE = 24;
const TIMER_ICON_SIZE = 16;
const EMPTY_CODE = Array<string>(VERIFICATION_CODE_LENGTH).fill('');
const CODE_SENT_TOAST: ToastMessage = { text: MESSAGES.resetCodeSent, variant: 'info' };

/** REQ-009 비밀번호 찾기 - 인증 번호 입력 */
export default function PasswordVerifyPage() {
  const navigate = useNavigate();
  const email = (useLocation().state as { email?: string } | null)?.email;
  const countdown = useCountdown();
  const [digits, setDigits] = useState<string[]>(EMPTY_CODE);
  const [toast, setToast] = useState<ToastMessage | null>(CODE_SENT_TOAST);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const closeToast = useCallback(() => setToast(null), []);
  // MSG-006 인증 5회 실패 시 서버가 5분 막는다. 그동안 입력 칸과 버튼을 끄고 칸 아래에 안내한다
  const [lockMessage, setLockMessage] = useState<string>();
  const codeLock = useTimedLock(() => setLockMessage(undefined));

  const { start, remaining } = countdown;
  useEffect(() => {
    start(PASSWORD_RESET_CODE_TTL_SECONDS);
  }, [start]);

  // MSG-013 발송 후 5분이 지나면 알린다. 타이머가 돌다가 0이 된 순간에만 띄운다
  const wasCountingRef = useRef(false);
  useEffect(() => {
    if (remaining > 0) {
      wasCountingRef.current = true;
      return;
    }
    if (wasCountingRef.current) {
      wasCountingRef.current = false;
      setToast({ text: MESSAGES.codeExpired, variant: 'error' });
    }
  }, [remaining]);

  if (!email) {
    return <Navigate to="/password/find" replace />;
  }

  const isComplete = digits.every(Boolean) && countdown.remaining > 0 && !isSubmitting && !codeLock.isLocked;

  // 칸이 모두 비면 CodeInput이 첫 칸에 커서를 둔다
  const resetDigits = () => setDigits(EMPTY_CODE);

  const resendCode = async () => {
    setIsSubmitting(true);
    try {
      await requestPasswordReset(email);
      countdown.start(PASSWORD_RESET_CODE_TTL_SECONDS);
      setToast(CODE_SENT_TOAST);
      resetDigits();
    } catch (error) {
      setToast({ text: errorMessage(error), variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isComplete) {
      return;
    }
    setIsSubmitting(true);
    try {
      const resetToken = await verifyPasswordReset(email, digits.join(''));
      navigate('/password/reset', { state: { resetToken }, replace: true });
    } catch (error) {
      if (isApiError(error, AUTH_ERROR_CODES.verificationLocked)) {
        setLockMessage(error.message);
        codeLock.lock(VERIFICATION_LOCK_SECONDS);
        setDigits(EMPTY_CODE);
      } else {
        setToast({ text: errorMessage(error), variant: 'error' });
        resetDigits();
      }
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout className={styles.page}>
      {toast && <Toast message={toast} onClose={closeToast} />}
      <form className={auth.card} onSubmit={handleSubmit} noValidate>
        <div className={`${auth.cardBody} ${styles.body}`}>
          <div className={auth.intro}>
            <button type="button" className={auth.backButton} aria-label="뒤로 가기" onClick={() => navigate(-1)}>
              <Icon src={chevronLeftIcon} size={BACK_ICON_SIZE} />
            </button>
            <div className={auth.titleGroup}>
              <h1 className={auth.displayTitle}>인증 번호 입력</h1>
              <p className={auth.subtitle}>{`${email}으로 보낸\n6자리 인증 번호를 입력해 주세요`}</p>
            </div>
          </div>
          <div className={styles.codeGroup}>
            <CodeInput digits={digits} disabled={codeLock.isLocked} onChange={setDigits} />
            {lockMessage && (
              <p role="alert" className={styles.error}>
                {lockMessage}
              </p>
            )}
            <div className={styles.timer} aria-live="polite">
              <Icon src={timerIcon} size={TIMER_ICON_SIZE} />
              <span>남은 시간 {formatSeconds(countdown.remaining, true)}</span>
            </div>
          </div>
          <div className={styles.actions}>
            <Button type="submit" disabled={!isComplete}>
              확인
            </Button>
            {/* 막힌 동안에는 서버가 인증 번호를 보내지 않으므로 다시 받기도 끈다 */}
            <Button isLoading={isSubmitting} variant="text" disabled={isSubmitting || codeLock.isLocked} onClick={resendCode}>
              인증 번호 다시 받기
            </Button>
            {/* REQ-009 이메일을 잘못 넣었으면 다시 입력한다 */}
            <Button variant="text" onClick={() => navigate('/password/find', { replace: true, state: { email } })}>
              이메일 다시 입력하기
            </Button>
          </div>
        </div>
      </form>
    </AuthLayout>
  );
}
