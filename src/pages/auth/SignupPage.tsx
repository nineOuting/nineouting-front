import { useCallback, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { confirmEmailVerification, sendEmailVerification, signup } from '../../api/auth';
import { errorMessage, isApiError } from '../../api/client';
import Button from '../../components/Button';
import AuthLayout from '../../components/AuthLayout';
import Checkbox from '../../components/Checkbox';
import PasswordField from '../../components/PasswordField';
import Placeholder from '../../components/Placeholder';
import TermsModal from '../../components/TermsModal';
import TextField from '../../components/TextField';
import Toast, { type ToastMessage } from '../../components/Toast';
import {
  EMAIL_MAX_LENGTH,
  EMAIL_REGEX,
  EMAIL_RESEND_COOLDOWN_SECONDS,
  MESSAGES,
  NAME_MAX_LENGTH,
  PASSWORD_REGEX,
  VERIFICATION_CODE_LENGTH,
  VERIFICATION_CODE_REGEX,
} from '../../constants/auth';
import { TERMS, type TermsKey } from '../../constants/terms';
import { formatSeconds, useCountdown } from '../../hooks/useCountdown';
import auth from './auth.module.css';
import styles from './SignupPage.module.css';

type VerificationStep = 'idle' | 'sent' | 'verified';
type AgreementKey = 'service' | 'privacy' | 'age' | 'marketing';
type Agreements = Record<AgreementKey, boolean>;

interface AgreementItem {
  key: AgreementKey;
  label: string;
  isRequired: boolean;
  termsKey?: TermsKey;
}

const AGREEMENT_ITEMS: AgreementItem[] = [
  { key: 'service', label: '[필수] 서비스 이용약관 동의', isRequired: true, termsKey: 'service' },
  { key: 'privacy', label: '[필수] 개인정보 수집·이용 동의', isRequired: true, termsKey: 'privacy' },
  { key: 'age', label: '[필수] 만 14세 이상입니다', isRequired: true },
  { key: 'marketing', label: '[선택] 마케팅 정보 수신 동의', isRequired: false, termsKey: 'marketing' },
];

const INITIAL_AGREEMENTS: Agreements = { service: false, privacy: false, age: false, marketing: false };
const RESEND_ICON_SIZE = 20;
const EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED';

/** REQ-010~014 회원가입 */
export default function SignupPage() {
  const navigate = useNavigate();
  const resendCountdown = useCountdown();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [verificationStep, setVerificationStep] = useState<VerificationStep>('idle');
  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState<string>();

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isPasswordTouched, setIsPasswordTouched] = useState(false);
  const [isPasswordConfirmTouched, setIsPasswordConfirmTouched] = useState(false);
  const [name, setName] = useState('');

  const [agreements, setAgreements] = useState<Agreements>(INITIAL_AGREEMENTS);
  const [openTerms, setOpenTerms] = useState<TermsKey | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  const isPasswordValid = PASSWORD_REGEX.test(password);
  const isPasswordMatched = password === passwordConfirm;
  const passwordError = isPasswordTouched && !isPasswordValid ? MESSAGES.invalidPassword : undefined;
  const passwordConfirmError =
    isPasswordConfirmTouched && passwordConfirm && !isPasswordMatched ? MESSAGES.passwordMismatch : undefined;

  const isAllAgreed = AGREEMENT_ITEMS.every(({ key }) => agreements[key]);
  const isRequiredAgreed = AGREEMENT_ITEMS.every(({ key, isRequired }) => !isRequired || agreements[key]);
  const canSubmit =
    verificationStep === 'verified' &&
    isPasswordValid &&
    Boolean(passwordConfirm) &&
    isPasswordMatched &&
    Boolean(name.trim()) &&
    isRequiredAgreed;

  const sendVerificationCode = async () => {
    if (!EMAIL_REGEX.test(email)) {
      setEmailError(MESSAGES.invalidEmail);
      return;
    }
    setIsSubmitting(true);
    try {
      await sendEmailVerification(email);
      setEmailError(undefined);
      setVerificationStep('sent');
      setCode('');
      setCodeError(undefined);
      resendCountdown.start(EMAIL_RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      setEmailError(errorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmVerificationCode = async () => {
    if (!VERIFICATION_CODE_REGEX.test(code)) {
      setCodeError(MESSAGES.invalidCode);
      return;
    }
    setIsSubmitting(true);
    try {
      await confirmEmailVerification(email, code);
      setCodeError(undefined);
      setVerificationStep('verified');
    } catch (error) {
      setCodeError(errorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleAll = (checked: boolean) => {
    setAgreements({ service: checked, privacy: checked, age: checked, marketing: checked });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    // 약관 동의는 요구사항이 정해질 때까지 화면에서만 확인한다 (docs/backlog.md)
    setIsSubmitting(true);
    try {
      await signup(email, password, name.trim());
      navigate('/signup/complete', { replace: true });
    } catch (error) {
      // 인증 후 30분이 지나면 서버가 인증 완료 표시를 지우므로 처음부터 다시 인증받게 한다
      if (isApiError(error, EMAIL_NOT_VERIFIED)) {
        setVerificationStep('idle');
        setEmailError(error.message);
      } else {
        setToast({ text: errorMessage(error), variant: 'error' });
      }
      setIsSubmitting(false);
    }
  };

  const emailHelper =
    verificationStep === 'sent' ? MESSAGES.codeSent : verificationStep === 'verified' ? MESSAGES.emailVerified : undefined;

  return (
    <AuthLayout className={styles.page}>
      {toast && <Toast message={toast} onClose={closeToast} />}
      <form className={`${auth.card} ${styles.card}`} onSubmit={handleSubmit} noValidate>
        <div className={styles.emailGroup}>
          <TextField
            label="이메일"
            required
            type="email"
            placeholder="이메일 주소를 입력해주세요"
            autoComplete="email"
            maxLength={EMAIL_MAX_LENGTH}
            value={email}
            disabled={verificationStep !== 'idle'}
            error={emailError}
            helper={emailHelper}
            onChange={(event) => {
              setEmail(event.target.value.trim());
              setEmailError(undefined);
            }}
          />
          {verificationStep === 'idle' && (
            <Button variant="secondary" disabled={isSubmitting} onClick={sendVerificationCode}>
              이메일 인증
            </Button>
          )}
        </div>

        {verificationStep === 'sent' && (
          <div className={styles.codeGroup}>
            <TextField
              label="이메일 인증 코드"
              description={`${email}로 발송된 인증 코드를 입력해 주세요`}
              className={styles.codeField}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6자리 인증 코드를 입력해 주세요"
              maxLength={VERIFICATION_CODE_LENGTH}
              value={code}
              error={codeError}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, ''));
                setCodeError(undefined);
              }}
            />
            <div className={styles.codeActions}>
              <Button
                variant="muted"
                disabled={isSubmitting || resendCountdown.remaining > 0}
                onClick={sendVerificationCode}
              >
                <Placeholder size={RESEND_ICON_SIZE} />
                <span>이메일 재전송</span>
                {resendCountdown.remaining > 0 && <span>{formatSeconds(resendCountdown.remaining)}</span>}
              </Button>
              <Button variant="secondary" disabled={isSubmitting} onClick={confirmVerificationCode}>
                인증 확인
              </Button>
            </div>
          </div>
        )}

        <PasswordField
          label="비밀번호"
          required
          placeholder="8자 이상, 영문+숫자"
          autoComplete="new-password"
          value={password}
          error={passwordError}
          onChange={(event) => setPassword(event.target.value)}
          onBlur={() => setIsPasswordTouched(true)}
        />
        <PasswordField
          label="비밀번호 확인"
          required
          placeholder="동일한 비밀번호 재입력"
          autoComplete="new-password"
          value={passwordConfirm}
          error={passwordConfirmError}
          onChange={(event) => setPasswordConfirm(event.target.value)}
          onBlur={() => setIsPasswordConfirmTouched(true)}
        />
        <TextField
          label="이름"
          required
          placeholder="이름을 입력해주세요"
          autoComplete="name"
          maxLength={NAME_MAX_LENGTH}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <fieldset className={styles.agreements}>
          <legend className={styles.srOnly}>약관 동의</legend>
          <div className={styles.agreeAll}>
            <Checkbox
              className={styles.agreeAllLabel}
              checked={isAllAgreed}
              onChange={(event) => toggleAll(event.target.checked)}
            >
              전체 동의
            </Checkbox>
            <p className={styles.agreeAllDescription}>
              선택 항목에 대한 동의를 포함하며, 선택 항목에 동의하지 않아도 서비스를 이용할 수 있습니다.
            </p>
          </div>
          <ul className={styles.agreementList}>
            {AGREEMENT_ITEMS.map(({ key, label, termsKey }) => (
              <li key={key} className={styles.agreementItem}>
                <Checkbox
                  className={styles.agreementLabel}
                  checked={agreements[key]}
                  onChange={(event) => setAgreements((prev) => ({ ...prev, [key]: event.target.checked }))}
                >
                  {label}
                </Checkbox>
                {termsKey && (
                  <button type="button" className={styles.viewTerms} onClick={() => setOpenTerms(termsKey)}>
                    보기
                  </button>
                )}
              </li>
            ))}
          </ul>
        </fieldset>

        <Button type="submit" disabled={!canSubmit || isSubmitting}>
          회원가입
        </Button>
      </form>
      {openTerms && <TermsModal terms={TERMS[openTerms]} onClose={() => setOpenTerms(null)} />}
    </AuthLayout>
  );
}
