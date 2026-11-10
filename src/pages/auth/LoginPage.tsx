import { useCallback, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { login } from '../../api/auth';
import { isApiError } from '../../api/client';
import AuthLayout from '../../components/AuthLayout';
import Button from '../../components/Button';
import Checkbox from '../../components/Checkbox';
import PasswordField from '../../components/PasswordField';
import TextField from '../../components/TextField';
import Toast, { type ToastMessage } from '../../components/Toast';
import { AUTH_ERROR_CODES, EMAIL_MAX_LENGTH, EMAIL_REGEX, LOGIN_LOCK_SECONDS, MESSAGES } from '../../constants/auth';
import { useTimedLock } from '../../hooks/useTimedLock';
import auth from './auth.module.css';
import styles from './LoginPage.module.css';

/** REQ-005~009 로그인 */
export default function LoginPage() {
  // RequireAuth가 보낸 원래 화면. 없으면 홈
  const redirectTo = (useLocation().state as { from?: string } | null)?.from ?? '/home';
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const closeToast = useCallback(() => setToast(null), []);
  // MSG-010 같은 이메일로 5번 실패하면 서버가 10분 막는다. 그동안 그 이메일로는 로그인 버튼을 끈다
  const [lockedLogin, setLockedLogin] = useState<{ email: string; message: string } | null>(null);
  const loginLock = useTimedLock(() => setLockedLogin(null));
  const isLoginLocked = loginLock.isLocked && lockedLogin?.email === email;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email) {
      setToast({ text: MESSAGES.emptyEmail, variant: 'error' });
      return;
    }
    if (!password) {
      setToast({ text: MESSAGES.emptyPassword, variant: 'error' });
      return;
    }
    if (!EMAIL_REGEX.test(email)) {
      setToast({ text: MESSAGES.invalidEmail, variant: 'error' });
      return;
    }
    setIsSubmitting(true);
    try {
      await login(email, password, keepLoggedIn);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      if (isApiError(error, AUTH_ERROR_CODES.loginLocked)) {
        setLockedLogin({ email, message: error.message });
        loginLock.lock(LOGIN_LOCK_SECONDS);
      } else {
        // 서버가 입력값을 거절하면(형식 등) 그 이유를 보여 준다. 그 밖의 오류만 "일시적인 오류"
        const fieldReason = isApiError(error) && error.status === 400 ? error.fieldErrors[0]?.reason : undefined;
        const text = isApiError(error, AUTH_ERROR_CODES.loginFailed)
          ? error.message
          : (fieldReason ?? MESSAGES.loginUnavailable);
        setToast({ text, variant: 'error' });
      }
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout>
      {toast && <Toast message={toast} onClose={closeToast} />}
      <form className={auth.card} onSubmit={handleSubmit} noValidate>
        <div className={auth.titleGroup}>
          <h1 className={auth.displayTitle}>로그인</h1>
          <p className={auth.subtitle}>nep!nep!에 다시 오신 걸 환영해요</p>
        </div>
        <div className={styles.fields}>
          <TextField
            label="이메일"
            type="email"
            placeholder="이메일을 입력해 주세요"
            autoComplete="email"
            maxLength={EMAIL_MAX_LENGTH}
            value={email}
            onChange={(event) => setEmail(event.target.value.trim())}
          />
          <PasswordField
            label="비밀번호"
            placeholder="비밀번호를 입력해 주세요"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <div className={styles.options}>
            <Checkbox checked={keepLoggedIn} onChange={(event) => setKeepLoggedIn(event.target.checked)}>
              로그인 상태 유지
            </Checkbox>
            <Link to="/password/find" className={auth.footerLink}>
              비밀번호를 잊으셨나요?
            </Link>
          </div>
        </div>
        <div className={styles.actions}>
          {isLoginLocked && (
            <p role="alert" className={styles.lockMessage}>
              {lockedLogin?.message}
            </p>
          )}
          <Button isLoading={isSubmitting} type="submit" disabled={isSubmitting || isLoginLocked}>
            로그인
          </Button>
        </div>
      </form>
      <nav className={auth.footer}>
        아직 계정이 없나요?
        <Link to="/signup" className={auth.footerLink}>
          회원가입
        </Link>
      </nav>
    </AuthLayout>
  );
}
