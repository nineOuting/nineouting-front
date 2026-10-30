import { Fragment, useCallback, useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { confirmPasswordReset } from '../../api/auth';
import { errorMessage, isApiError } from '../../api/client';
import dot from '../../assets/dot.svg';
import AuthLayout from '../../components/AuthLayout';
import Button from '../../components/Button';
import PasswordField from '../../components/PasswordField';
import Placeholder from '../../components/Placeholder';
import Toast, { type ToastMessage } from '../../components/Toast';
import {
  AUTH_ERROR_CODES,
  HAS_DIGIT_REGEX,
  HAS_LETTER_REGEX,
  MESSAGES,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REGEX,
} from '../../constants/auth';
import auth from './auth.module.css';
import styles from './PasswordResetPage.module.css';

const BACK_ICON_SIZE = 24;
const RULE_ICON_SIZE = 20;

const PASSWORD_RULES = [
  { label: '8자 이상', test: (value: string) => value.length >= PASSWORD_MIN_LENGTH },
  { label: '영문 포함', test: (value: string) => HAS_LETTER_REGEX.test(value) },
  { label: '숫자 포함', test: (value: string) => HAS_DIGIT_REGEX.test(value) },
];

/** REQ-009 비밀번호 찾기 - 새 비밀번호 설정 */
export default function PasswordResetPage() {
  const navigate = useNavigate();
  const resetToken = (useLocation().state as { resetToken?: string } | null)?.resetToken;
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isPasswordTouched, setIsPasswordTouched] = useState(false);
  // MSG-014 이전 비밀번호와 같으면 새 비밀번호 칸 아래에 안내하고, 비밀번호를 고치면 지운다
  const [sameAsOldError, setSameAsOldError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  if (!resetToken) {
    return <Navigate to="/password/find" replace />;
  }

  const isPasswordValid = PASSWORD_REGEX.test(password);
  const isPasswordMatched = password === passwordConfirm;
  const canSubmit = isPasswordValid && Boolean(passwordConfirm) && isPasswordMatched;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    setIsSubmitting(true);
    try {
      await confirmPasswordReset(resetToken, password);
      navigate('/password/complete', { replace: true });
    } catch (error) {
      if (isApiError(error, AUTH_ERROR_CODES.sameAsOldPassword)) {
        setSameAsOldError(error.message);
      } else {
        setToast({ text: errorMessage(error), variant: 'error' });
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
              <h1 className={auth.displayTitle}>새 비밀번호 설정</h1>
              <p className={auth.subtitle}>{'8자리 이상, 영문과 숫자를 각각 1자 이상\n포함해 주세요.'}</p>
            </div>
          </div>
          <div className={styles.form}>
            <div className={styles.fields}>
              <div className={styles.passwordGroup}>
                <PasswordField
                  label="새 비밀번호"
                  placeholder="비밀번호를 입력해 주세요."
                  autoComplete="new-password"
                  value={password}
                  error={
                    sameAsOldError ??
                    (isPasswordTouched && password && !isPasswordValid ? MESSAGES.invalidPassword : undefined)
                  }
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setSameAsOldError(undefined);
                  }}
                  onBlur={() => setIsPasswordTouched(true)}
                />
                <ul className={styles.rules}>
                  {PASSWORD_RULES.map((rule, index) => (
                    <Fragment key={rule.label}>
                      {index > 0 && (
                        <li aria-hidden="true" className={styles.dot}>
                          <img src={dot} alt="" width={4} height={4} />
                        </li>
                      )}
                      <li className={rule.test(password) ? styles.rulePassed : styles.rule}>
                        <Placeholder size={RULE_ICON_SIZE} />
                        {rule.label}
                      </li>
                    </Fragment>
                  ))}
                </ul>
              </div>
              <PasswordField
                label="새 비밀번호 확인"
                placeholder="비밀번호를 다시 입력해 주세요."
                autoComplete="new-password"
                value={passwordConfirm}
                error={passwordConfirm && !isPasswordMatched ? MESSAGES.passwordMismatch : undefined}
                onChange={(event) => setPasswordConfirm(event.target.value)}
              />
            </div>
            <Button type="submit" disabled={!canSubmit || isSubmitting}>
              비밀번호 변경
            </Button>
          </div>
        </div>
      </form>
    </AuthLayout>
  );
}
