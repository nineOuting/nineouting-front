import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { requestPasswordReset } from '../../api/auth';
import { errorMessage } from '../../api/client';
import AuthLayout from '../../components/AuthLayout';
import Button from '../../components/Button';
import Placeholder from '../../components/Placeholder';
import TextField from '../../components/TextField';
import { EMAIL_MAX_LENGTH, EMAIL_REGEX, MESSAGES } from '../../constants/auth';
import auth from './auth.module.css';
import styles from './PasswordFindPage.module.css';

const BACK_ICON_SIZE = 24;

/** REQ-009 비밀번호 찾기 - 이메일 입력 */
export default function PasswordFindPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!EMAIL_REGEX.test(email)) {
      setEmailError(MESSAGES.invalidEmail);
      return;
    }
    setIsSubmitting(true);
    try {
      await requestPasswordReset(email);
      navigate('/password/verify', { state: { email } });
    } catch (error) {
      setEmailError(errorMessage(error));
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout className={styles.page}>
      <form className={auth.card} onSubmit={handleSubmit} noValidate>
        <div className={`${auth.cardBody} ${styles.body}`}>
          <div className={auth.intro}>
            <button type="button" className={auth.backButton} aria-label="뒤로 가기" onClick={() => navigate('/login')}>
              <Placeholder size={BACK_ICON_SIZE} />
            </button>
            <div className={auth.titleGroup}>
              <h1 className={auth.displayTitle}>비밀번호 찾기</h1>
              <p className={auth.subtitle}>{'가입한 이메일을 입력하면\n인증 번호를 보내드려요.'}</p>
            </div>
          </div>
          <div className={styles.form}>
            <TextField
              label="이메일"
              className={styles.emailField}
              type="email"
              placeholder="test@naver.com"
              autoComplete="email"
              maxLength={EMAIL_MAX_LENGTH}
              value={email}
              error={emailError}
              onChange={(event) => {
                setEmail(event.target.value.trim());
                setEmailError(undefined);
              }}
            />
            <Button type="submit" disabled={isSubmitting}>
              인증 번호 받기
            </Button>
          </div>
        </div>
      </form>
      <nav className={auth.footer}>
        <Link to="/login" className={auth.footerLink}>
          로그인으로 돌아가기
        </Link>
      </nav>
    </AuthLayout>
  );
}
