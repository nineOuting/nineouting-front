import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { login } from '../../api/auth';
import { isApiError } from '../../api/client';
import { previewInvite, type InvitePreview } from '../../api/workspace';
import unknownCharacter from '../../assets/characters/unknown.svg';
import EmptyState from '../../components/EmptyState';
import AuthLayout from '../../components/AuthLayout';
import Button from '../../components/Button';
import infoIcon from '../../assets/icons/info.svg';
import Checkbox from '../../components/Checkbox';
import Icon from '../../components/Icon';
import PasswordField from '../../components/PasswordField';
import TextField from '../../components/TextField';
import Toast, { type ToastMessage } from '../../components/Toast';
import { AUTH_ERROR_CODES, EMAIL_MAX_LENGTH, EMAIL_REGEX, LOGIN_LOCK_SECONDS, MESSAGES } from '../../constants/auth';
import { useTimedLock } from '../../hooks/useTimedLock';
import auth from './auth.module.css';
import styles from './LoginPage.module.css';

const INFO_ICON_SIZE = 16;

/** REQ-005~009 로그인 */
export default function LoginPage() {
  // RequireAuth가 보낸 원래 화면. 없으면 홈
  const redirectTo = (useLocation().state as { from?: string } | null)?.from ?? '/home';
  // REQ-015, 127 초대 링크로 들어왔으면 초대 안내를 함께 보여 준다 (디자인 Page 9 InviteLandingPage)
  const inviteMatch = /^\/(invites|invitations)\/([^/?#]+)/.exec(redirectTo);
  const isInvite = inviteMatch !== null;
  // 피그마 프론트 InviteLandingPage: 로그인 전에도 워크스페이스 이름과 초대한 사람을 보여 준다. 만료된 초대면 InviteExpiredPage
  const [invite, setInvite] = useState<InvitePreview | 'expired' | null>(null);
  const inviteKind = inviteMatch?.[1] as 'invites' | 'invitations' | undefined;
  const inviteToken = inviteMatch?.[2];
  const navigate = useNavigate();
  useEffect(() => {
    if (!inviteKind || !inviteToken) {
      return;
    }
    let isCurrent = true;
    previewInvite(inviteKind, decodeURIComponent(inviteToken))
      .then((preview) => isCurrent && setInvite(preview))
      .catch((error: unknown) => {
        // 만료와 잘못된 초대는 같은 코드다. 서버 오류면 이름 없이 일반 문구로 둔다
        if (isCurrent && isApiError(error) && (error.code === 'INVITATION_INVALID' || error.code === 'INVITE_LINK_INVALID')) {
          setInvite('expired');
        }
      });
    return () => {
      isCurrent = false;
    };
  }, [inviteKind, inviteToken]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const closeToast = useCallback(() => setToast(null), []);
  // MSG-010 같은 이메일로 5번 실패하면 서버가 10분 막는다. 그동안 그 이메일로는 로그인 버튼을 끈다
  const [lockedLogin, setLockedLogin] = useState<{ email: string; message: string } | null>(null);
  const loginLock = useTimedLock(() => setLockedLogin(null));
  const isLoginLocked = loginLock.isLocked && lockedLogin?.email === email;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // 피그마 프론트 "빈 칸으로 로그인", "이메일 형식 오류": 토스트 대신 칸 아래 빨간 글씨
    const errors = {
      email: !email ? MESSAGES.emptyEmail : !EMAIL_REGEX.test(email) ? MESSAGES.invalidEmail : undefined,
      password: !password ? MESSAGES.emptyPassword : undefined,
    };
    setFieldErrors(errors);
    if (errors.email || errors.password) {
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
      {invite === 'expired' ? (
        // 피그마 프론트 InviteExpiredPage (MSG-060)
        <EmptyState
          character={unknownCharacter}
          title="초대 링크가 만료됐어요"
          description="초대한 분께 다시 보내 달라고 해 주세요."
          action={
            <Button variant="primary" size="md" onClick={() => navigate('/login', { replace: true })}>
              로그인 화면으로
            </Button>
          }
        />
      ) : (
        <form className={auth.card} onSubmit={handleSubmit} noValidate>
          {isInvite ? (
            <>
              <div className={auth.titleGroup}>
                <h1 className={auth.displayTitle}>
                  {invite ? `${invite.workspaceName}에 초대받았어요` : '워크스페이스에 초대받았어요'}
                </h1>
                <p className={auth.subtitle}>
                  {invite?.inviterName
                    ? `${invite.inviterName} 님이 함께 회의를 기록하자고 초대했어요.`
                    : '함께 회의를 기록하자는 초대예요.'}
                </p>
              </div>
              <div className={styles.inviteNotice}>
                <Icon src={infoIcon} size={INFO_ICON_SIZE} className={styles.inviteIcon} />
                <p>
                  <strong className={styles.inviteStrong}>로그인하면 참여 여부를 한 번 더 확인해요.</strong>
                  <br />
                  계정이 없다면 회원가입해 주세요.
                </p>
              </div>
            </>
          ) : (
            <div className={auth.titleGroup}>
              <h1 className={auth.displayTitle}>로그인</h1>
              <p className={auth.subtitle}>nep!nep!에 다시 오신 걸 환영해요</p>
            </div>
          )}
          <div className={styles.fields}>
            <TextField
              label="이메일"
              type="email"
              placeholder="이메일을 입력해 주세요"
              autoComplete="email"
              maxLength={EMAIL_MAX_LENGTH}
              value={email}
              error={fieldErrors.email}
              onChange={(event) => {
                setEmail(event.target.value.trim());
                setFieldErrors((prev) => ({ ...prev, email: undefined }));
              }}
              // 피그마: 이메일 칸을 벗어날 때 형식이 틀리면 알린다
              onBlur={() =>
                email && !EMAIL_REGEX.test(email) && setFieldErrors((prev) => ({ ...prev, email: MESSAGES.invalidEmail }))
              }
            />
            <PasswordField
              label="비밀번호"
              placeholder="비밀번호를 입력해 주세요"
              autoComplete="current-password"
              value={password}
              error={fieldErrors.password}
              onChange={(event) => {
                setPassword(event.target.value);
                setFieldErrors((prev) => ({ ...prev, password: undefined }));
              }}
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
      )}
      {invite !== 'expired' && (
        <nav className={auth.footer}>
          아직 계정이 없나요?
          <Link to="/signup" className={auth.footerLink}>
            회원가입
          </Link>
        </nav>
      )}
    </AuthLayout>
  );
}
