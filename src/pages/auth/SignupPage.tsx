import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { confirmEmailVerification, sendEmailVerification, signup } from '../../api/auth';
import { errorMessage, isApiError } from '../../api/client';
import checkIcon from '../../assets/icons/check-sm.svg';
import timerIcon from '../../assets/icons/timer.svg';
import AuthLayout from '../../components/AuthLayout';
import Button from '../../components/Button';
import Checkbox from '../../components/Checkbox';
import CodeInput from '../../components/CodeInput';
import Icon from '../../components/Icon';
import PasswordField from '../../components/PasswordField';
import TermsModal from '../../components/TermsModal';
import TextField from '../../components/TextField';
import Toast, { type ToastMessage } from '../../components/Toast';
import {
  AUTH_ERROR_CODES,
  EMAIL_MAX_LENGTH,
  EMAIL_REGEX,
  EMAIL_RESEND_COOLDOWN_SECONDS,
  MESSAGES,
  NAME_MAX_LENGTH,
  PASSWORD_REGEX,
  VERIFICATION_CODE_LENGTH,
  VERIFICATION_LOCK_SECONDS,
} from '../../constants/auth';
import { TERMS, type TermsKey } from '../../constants/terms';
import { formatSeconds, useCountdown } from '../../hooks/useCountdown';
import { useTimedLock } from '../../hooks/useTimedLock';
import auth from './auth.module.css';
import styles from './SignupPage.module.css';

type Step = 'email' | 'code' | 'info';
type AgreementKey = 'service' | 'privacy' | 'age' | 'marketing';
type Agreements = Record<AgreementKey, boolean>;

interface AgreementItem {
  key: AgreementKey;
  label: string;
  isRequired: boolean;
  termsKey?: TermsKey;
}

const STEPS: Step[] = ['email', 'code', 'info'];
const ICON_SIZE = 16;
// user-service EmailVerificationService.CODE_TTL (10분)
const SIGNUP_CODE_TTL_SECONDS = 600;
const EMPTY_CODE = Array<string>(VERIFICATION_CODE_LENGTH).fill('');

const AGREEMENT_ITEMS: AgreementItem[] = [
  { key: 'service', label: '[필수] 서비스 이용약관 동의', isRequired: true, termsKey: 'service' },
  { key: 'privacy', label: '[필수] 개인정보 수집·이용 동의', isRequired: true, termsKey: 'privacy' },
  { key: 'age', label: '[필수] 만 14세 이상이에요', isRequired: true },
  { key: 'marketing', label: '[선택] 마케팅 정보 수신 동의', isRequired: false, termsKey: 'marketing' },
];

const INITIAL_AGREEMENTS: Agreements = { service: false, privacy: false, age: false, marketing: false };

// REQ-012 비밀번호 조건을 하나씩 보여 준다 (맞으면 초록 체크)
const PASSWORD_RULES = [
  { label: '8자 이상', test: (value: string) => value.length >= 8 },
  { label: '영문 포함', test: (value: string) => /[A-Za-z]/.test(value) },
  { label: '숫자 포함', test: (value: string) => /\d/.test(value) },
];

/** 디자인 단계 막대: 지난 단계와 지금 단계는 보라, 남은 단계는 회색 + "1 / 3" */
function Progress({ step }: { step: Step }) {
  const current = STEPS.indexOf(step) + 1;
  return (
    <div className={styles.progress} aria-label={`${STEPS.length}단계 중 ${current}단계`}>
      {STEPS.map((item, index) => (
        <span key={item} className={index < current ? `${styles.bar} ${styles.barDone}` : styles.bar} />
      ))}
      <span className={styles.progressText}>
        {current} / {STEPS.length}
      </span>
    </div>
  );
}

/** REQ-010~014, 162 회원가입 (디자인 Page 9 01: 이메일 → 인증 번호 → 계정 정보, 3단계) */
export default function SignupPage() {
  const navigate = useNavigate();
  const resendCountdown = useCountdown();
  const codeCountdown = useCountdown();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [digits, setDigits] = useState<string[]>(EMPTY_CODE);
  const [codeError, setCodeError] = useState<string>();
  // MSG-006 인증 5회 실패 시 서버가 막는다. 그동안 인증 번호 칸과 버튼을 끄고, 풀리면 안내를 지운다
  const codeLock = useTimedLock(() => setCodeError(undefined));

  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [isPasswordConfirmTouched, setIsPasswordConfirmTouched] = useState(false);
  const [name, setName] = useState('');

  const [agreements, setAgreements] = useState<Agreements>(INITIAL_AGREEMENTS);
  const [openTerms, setOpenTerms] = useState<TermsKey | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  // MSG-013 인증 번호 시간이 지나면 알린다. 타이머가 돌다가 0이 된 순간에만 띄운다
  const wasCountingRef = useRef(false);
  useEffect(() => {
    if (codeCountdown.remaining > 0) {
      wasCountingRef.current = true;
      return;
    }
    if (wasCountingRef.current) {
      wasCountingRef.current = false;
      setCodeError(MESSAGES.codeExpired);
    }
  }, [codeCountdown.remaining]);

  const isPasswordValid = PASSWORD_REGEX.test(password);
  const isPasswordMatched = password === passwordConfirm;
  const passwordConfirmError =
    isPasswordConfirmTouched && passwordConfirm && !isPasswordMatched ? MESSAGES.passwordMismatch : undefined;

  const isAllAgreed = AGREEMENT_ITEMS.every(({ key }) => agreements[key]);
  const isRequiredAgreed = AGREEMENT_ITEMS.every(({ key, isRequired }) => !isRequired || agreements[key]);
  const canSubmit = isPasswordValid && Boolean(passwordConfirm) && isPasswordMatched && Boolean(name.trim()) && isRequiredAgreed;
  const isCodeComplete = digits.every(Boolean) && codeCountdown.remaining > 0 && !codeLock.isLocked;

  /** 1단계 [인증 번호 받기], 2단계 [인증 번호 다시 받기] */
  const sendCode = async () => {
    if (!EMAIL_REGEX.test(email)) {
      setEmailError(MESSAGES.invalidEmail);
      return;
    }
    setIsSubmitting(true);
    try {
      await sendEmailVerification(email);
      setEmailError(undefined);
      setDigits(EMPTY_CODE);
      setCodeError(undefined);
      resendCountdown.start(EMAIL_RESEND_COOLDOWN_SECONDS);
      codeCountdown.start(SIGNUP_CODE_TTL_SECONDS);
      if (step === 'code') {
        setToast({ text: MESSAGES.codeSent, variant: 'info' });
      }
      setStep('code');
    } catch (error) {
      if (isApiError(error, AUTH_ERROR_CODES.verificationLocked)) {
        codeLock.lock(VERIFICATION_LOCK_SECONDS);
      }
      if (step === 'code') {
        setCodeError(errorMessage(error));
      } else {
        setEmailError(errorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /** 2단계 [확인] */
  const confirmCode = async () => {
    if (!isCodeComplete) {
      return;
    }
    setIsSubmitting(true);
    try {
      await confirmEmailVerification(email, digits.join(''));
      setCodeError(undefined);
      setStep('info');
    } catch (error) {
      if (isApiError(error, AUTH_ERROR_CODES.verificationLocked)) {
        codeLock.lock(VERIFICATION_LOCK_SECONDS);
      }
      setCodeError(errorMessage(error));
      setDigits(EMPTY_CODE);
    } finally {
      setIsSubmitting(false);
    }
  };

  /** 3단계 [가입하기] */
  const submit = async () => {
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
      if (isApiError(error, AUTH_ERROR_CODES.emailNotVerified)) {
        setStep('email');
        setEmailError(error.message);
      } else {
        setToast({ text: errorMessage(error), variant: 'error' });
      }
      setIsSubmitting(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step === 'email') {
      void sendCode();
    } else if (step === 'code') {
      void confirmCode();
    } else {
      void submit();
    }
  };

  return (
    <AuthLayout className={styles.page}>
      {toast && <Toast message={toast} onClose={closeToast} />}
      <form className={auth.card} onSubmit={handleSubmit} noValidate>
        <Progress step={step} />

        {step === 'email' && (
          <>
            <div className={auth.titleGroup}>
              <h1 className={auth.displayTitle}>회원가입</h1>
              <p className={auth.subtitle}>가입할 이메일을 입력하면 인증 번호를 보내 드려요</p>
            </div>
            <TextField
              label="이메일"
              type="email"
              placeholder="이메일을 입력해 주세요"
              autoComplete="email"
              maxLength={EMAIL_MAX_LENGTH}
              value={email}
              error={emailError}
              onChange={(event) => {
                setEmail(event.target.value.trim());
                setEmailError(undefined);
              }}
            />
            <Button isLoading={isSubmitting} type="submit" disabled={isSubmitting || !email}>
              인증 번호 받기
            </Button>
          </>
        )}

        {step === 'code' && (
          <>
            <div className={auth.titleGroup}>
              <h1 className={auth.displayTitle}>이메일 인증</h1>
              <p className={auth.subtitle}>{`${email}으로 보낸\n6자리 인증 번호를 입력해 주세요`}</p>
            </div>
            <div className={styles.codeGroup}>
              <CodeInput
                digits={digits}
                disabled={codeLock.isLocked}
                isInvalid={Boolean(codeError)}
                onChange={(next) => {
                  setDigits(next);
                  setCodeError(undefined);
                }}
              />
              {codeError && (
                <p role="alert" className={styles.error}>
                  {codeError}
                </p>
              )}
              <p className={styles.timer} aria-live="polite">
                <Icon src={timerIcon} size={ICON_SIZE} />
                남은 시간 {formatSeconds(codeCountdown.remaining, true)}
              </p>
            </div>
            <div className={styles.codeActions}>
              <Button isLoading={isSubmitting} type="submit" disabled={!isCodeComplete || isSubmitting}>
                확인
              </Button>
              {/* 막힌 동안이나 다시 보낸 지 1분이 안 됐으면 다시 받기를 끈다 */}
              <Button
                variant="text"
                disabled={isSubmitting || codeLock.isLocked || resendCountdown.remaining > 0}
                onClick={() => void sendCode()}
              >
                인증 번호 다시 받기
                {resendCountdown.remaining > 0 && ` (${formatSeconds(resendCountdown.remaining)})`}
              </Button>
              {/* REQ-011 인증 번호를 보낸 뒤에도 이메일을 고칠 수 있다 */}
              <Button
                variant="text"
                onClick={() => {
                  setStep('email');
                  setCodeError(undefined);
                }}
              >
                이메일 다시 입력하기
              </Button>
            </div>
          </>
        )}

        {step === 'info' && (
          <>
            <div className={auth.titleGroup}>
              <h1 className={auth.displayTitle}>계정 정보 입력</h1>
              <p className={auth.subtitle}>비밀번호와 이름을 입력하고 약관에 동의해 주세요</p>
            </div>
            <div className={styles.fields}>
              <div className={styles.passwordGroup}>
                <PasswordField
                  label="비밀번호"
                  required
                  placeholder="8자 이상, 영문과 숫자를 섞어 주세요"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <ul className={styles.rules} aria-label="비밀번호 조건">
                  {PASSWORD_RULES.map((rule) => (
                    <li key={rule.label} className={rule.test(password) ? `${styles.rule} ${styles.ruleMet}` : styles.rule}>
                      <Icon src={checkIcon} size={ICON_SIZE} />
                      {rule.label}
                    </li>
                  ))}
                </ul>
              </div>
              <PasswordField
                label="비밀번호 확인"
                required
                placeholder="비밀번호를 한 번 더 입력해 주세요"
                autoComplete="new-password"
                value={passwordConfirm}
                error={passwordConfirmError}
                onChange={(event) => setPasswordConfirm(event.target.value)}
                onBlur={() => setIsPasswordConfirmTouched(true)}
              />
              <TextField
                label="이름"
                required
                placeholder="이름을 입력해 주세요"
                autoComplete="name"
                maxLength={NAME_MAX_LENGTH}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </div>

            <fieldset className={styles.agreements}>
              <legend className={styles.srOnly}>약관 동의</legend>
              <Checkbox
                className={styles.agreeAll}
                checked={isAllAgreed}
                onChange={(event) =>
                  setAgreements({
                    service: event.target.checked,
                    privacy: event.target.checked,
                    age: event.target.checked,
                    marketing: event.target.checked,
                  })
                }
              >
                전체 동의
              </Checkbox>
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

            <Button isLoading={isSubmitting} type="submit" disabled={!canSubmit || isSubmitting}>
              가입하기
            </Button>
          </>
        )}
      </form>
      {/* REQ-162 이미 계정이 있으면 로그인으로 (첫 단계에서만) */}
      {step === 'email' && (
        <nav className={auth.footer}>
          이미 계정이 있나요?
          <Link to="/login" className={auth.footerLink}>
            로그인
          </Link>
        </nav>
      )}
      {openTerms && <TermsModal terms={TERMS[openTerms]} onClose={() => setOpenTerms(null)} />}
    </AuthLayout>
  );
}
