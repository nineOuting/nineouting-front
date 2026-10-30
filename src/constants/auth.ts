export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// user-service PasswordPolicy와 같은 규칙: 8~64자, 영문·숫자 각각 1자 이상.
// 키보드 특수문자(ASCII)도 쓸 수 있고 공백·한글은 안 된다 (REQ-012, 2026-10-28)
export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[\x21-\x7E]{8,64}$/;
export const PASSWORD_MIN_LENGTH = 8;
export const HAS_LETTER_REGEX = /[A-Za-z]/;
export const HAS_DIGIT_REGEX = /\d/;

export const VERIFICATION_CODE_LENGTH = 6;
export const VERIFICATION_CODE_REGEX = /^\d{6}$/;
export const EMAIL_RESEND_COOLDOWN_SECONDS = 60;
export const PASSWORD_RESET_CODE_TTL_SECONDS = 300;

// user-service 제한 시간과 같다 (LoginFailureStore 10분, 인증 5회 실패 5분)
export const LOGIN_LOCK_SECONDS = 600;
export const VERIFICATION_LOCK_SECONDS = 300;

/** 화면에서 따로 처리하는 user-service 에러 코드 (docs/services/user-service.md 4.4) */
export const AUTH_ERROR_CODES = {
  loginFailed: 'LOGIN_FAILED',
  loginLocked: 'LOGIN_LOCKED',
  verificationLocked: 'VERIFICATION_LOCKED',
  sameAsOldPassword: 'SAME_AS_OLD_PASSWORD',
  emailNotVerified: 'EMAIL_NOT_VERIFIED',
} as const;

export const NAME_MAX_LENGTH = 50;
export const EMAIL_MAX_LENGTH = 255;

// 안내 문구는 docs의 메시지 정의서(MSG-xxx)와 같게 맞춘다
export const MESSAGES = {
  invalidEmail: '올바른 이메일 형식을 입력해 주세요.',
  invalidPassword: '비밀번호는 8자 이상, 영문과 숫자를 각각 1자 이상 포함해 주세요.',
  passwordMismatch: '비밀번호가 일치하지 않습니다.',
  invalidCode: '6자리 숫자 인증 코드를 입력해 주세요',
  emptyEmail: '이메일을 입력해 주세요.',
  emptyPassword: '비밀번호를 입력해 주세요.',
  loginUnavailable: '일시적인 오류로 로그인하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  codeSent: '인증번호가 발송되었습니다',
  emailVerified: '이메일 인증이 완료되었습니다',
  resetCodeSent: '가입된 이메일이라면 인증 번호가 발송됩니다. 메일함을 확인해 주세요.',
  codeExpired: '인증 시간이 지났습니다. 인증 번호를 다시 받아 주세요.',
} as const;
