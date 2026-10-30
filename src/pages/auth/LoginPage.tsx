import { useCallback, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { login } from '../../api/auth';
import { isApiError } from '../../api/client';
import dividerLine from '../../assets/divider-line.svg';
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
    // keepLoggedIn은 요구사항이 정해질 때까지 화면에만 둔다 (docs/backlog.md)
    setIsSubmitting(true);
    try {
      await login(email, password);
      navigate(redirectTo, { replace: true });
    } catch (error) {
      if (isApiError(error, AUTH_ERROR_CODES.loginLocked)) {
        setLockedLogin({ email, message: error.message });
        loginLock.lock(LOGIN_LOCK_SECONDS);
      } else {
        const text = isApiError(error, AUTH_ERROR_CODES.loginFailed) ? error.message : MESSAGES.loginUnavailable;
        setToast({ text, variant: 'error' });
      }
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout className={styles.page}>
      {toast && <Toast message={toast} onClose={closeToast} />}
      <h1 className={styles.brand}>SYNC</h1>
      <form className={auth.card} onSubmit={handleSubmit} noValidate>
        <div className={`${auth.cardBody} ${styles.body}`}>
          <div className={styles.fields}>
            <TextField
              type="email"
              placeholder="이메일"
              aria-label="이메일"
              autoComplete="email"
              maxLength={EMAIL_MAX_LENGTH}
              value={email}
              onChange={(event) => setEmail(event.target.value.trim())}
            />
            <PasswordField
              placeholder="비밀번호"
              aria-label="비밀번호"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className={styles.actions}>
            <Checkbox
              tone="muted"
              className={styles.keepLoggedIn}
              checked={keepLoggedIn}
              onChange={(event) => setKeepLoggedIn(event.target.checked)}
            >
              로그인 상태 유지
            </Checkbox>
            {isLoginLocked && (
              <p role="alert" className={styles.lockMessage}>
                {lockedLogin?.message}
              </p>
            )}
            <Button type="submit" disabled={isSubmitting || isLoginLocked}>
              로그인
            </Button>
          </div>
        </div>
      </form>
      <nav className={auth.footer}>
        <Link to="/password/find" className={styles.findPassword}>
          비밀번호를 잊으셨나요?
        </Link>
        <span className={styles.divider} aria-hidden="true">
          <img src={dividerLine} alt="" width={21} height={1} />
        </span>
        <Link to="/signup" className={styles.signup}>
          회원가입
        </Link>
      </nav>
    </AuthLayout>
  );
}
