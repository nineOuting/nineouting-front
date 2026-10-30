import { useCallback, useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { requestPasswordReset, verifyPasswordReset } from '../../api/auth';
import { errorMessage, isApiError } from '../../api/client';
import AuthLayout from '../../components/AuthLayout';
import Button from '../../components/Button';
import Placeholder from '../../components/Placeholder';
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
const TIMER_ICON_SIZE = 20;
const EMPTY_CODE = Array<string>(VERIFICATION_CODE_LENGTH).fill('');
const CODE_SENT_TOAST: ToastMessage = { text: MESSAGES.resetCodeSent, variant: 'info' };

/** REQ-009 비밀번호 찾기 - 인증 번호 입력 */
export default function PasswordVerifyPage() {
  const navigate = useNavigate();
  const email = (useLocation().state as { email?: string } | null)?.email;
  const countdown = useCountdown();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
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

  const focusInput = (index: number) => inputRefs.current[index]?.focus();

  const handleChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    setDigits((prev) => prev.map((current, i) => (i === index ? digit : current)));
    if (digit && index < VERIFICATION_CODE_LENGTH - 1) {
      focusInput(index + 1);
    }
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      focusInput(index - 1);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, VERIFICATION_CODE_LENGTH);
    if (!pasted) {
      return;
    }
    event.preventDefault();
    setDigits(EMPTY_CODE.map((_, i) => pasted[i] ?? ''));
    focusInput(Math.min(pasted.length, VERIFICATION_CODE_LENGTH - 1));
  };

  const resetDigits = () => {
    setDigits(EMPTY_CODE);
    focusInput(0);
  };

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
              <Placeholder size={BACK_ICON_SIZE} />
            </button>
            <div className={auth.titleGroup}>
              <h1 className={auth.displayTitle}>인증 번호 입력</h1>
              <p className={auth.subtitle}>{`${email}로 발송된 인증 코드를 입력해 주세요`}</p>
            </div>
          </div>
          <div className={styles.codeGroup}>
            <div className={styles.codeInputs}>
              {digits.map((digit, index) => (
                <input
                  // 자리 순서가 바뀌지 않으므로 index를 key로 쓴다
                  key={index}
                  ref={(element) => {
                    inputRefs.current[index] = element;
                  }}
                  className={styles.codeInput}
                  inputMode="numeric"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  maxLength={1}
                  aria-label={`인증 번호 ${index + 1}번째 자리`}
                  value={digit}
                  disabled={codeLock.isLocked}
                  onChange={(event) => handleChange(index, event.target.value)}
                  onKeyDown={(event) => handleKeyDown(index, event)}
                  onPaste={handlePaste}
                />
              ))}
            </div>
            {lockMessage && (
              <p role="alert" className={styles.error}>
                {lockMessage}
              </p>
            )}
            <div className={styles.timer} aria-live="polite">
              <Placeholder size={TIMER_ICON_SIZE} />
              <span>{formatSeconds(countdown.remaining, true)}</span>
            </div>
          </div>
          <div className={styles.actions}>
            <Button type="submit" disabled={!isComplete}>
              확인
            </Button>
            {/* 막힌 동안에는 서버가 인증 번호를 보내지 않으므로 다시 받기도 끈다 */}
            <Button variant="underline" disabled={isSubmitting || codeLock.isLocked} onClick={resendCode}>
              인증 번호 다시 받기
            </Button>
          </div>
        </div>
      </form>
    </AuthLayout>
  );
}
