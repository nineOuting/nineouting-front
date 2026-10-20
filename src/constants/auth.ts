export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// user-service PasswordPolicy와 같은 규칙: 8~64자, 영문과 숫자만, 영문·숫자 각각 1자 이상
export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,64}$/;
export const PASSWORD_MIN_LENGTH = 8;
export const HAS_LETTER_REGEX = /[A-Za-z]/;
export const HAS_DIGIT_REGEX = /\d/;

export const VERIFICATION_CODE_LENGTH = 6;
export const VERIFICATION_CODE_REGEX = /^\d{6}$/;
export const EMAIL_RESEND_COOLDOWN_SECONDS = 60;
export const PASSWORD_RESET_CODE_TTL_SECONDS = 300;

export const NAME_MAX_LENGTH = 50;
export const EMAIL_MAX_LENGTH = 255;

export const MESSAGES = {
  invalidEmail: '올바른 이메일 형식을 입력해 주세요',
  invalidPassword: '비밀번호는 8자리 이상, 영문과 숫자를 각각 1자 이상 포함해 주세요',
  passwordMismatch: '비밀번호가 일치하지 않습니다',
  invalidCode: '6자리 숫자 인증 코드를 입력해 주세요',
  emptyLogin: '이메일과 비밀번호를 입력해 주세요',
  loginUnavailable: '일시적인 오류로 로그인하지 못했습니다. 잠시 후 다시 시도해 주세요',
  codeSent: '인증번호가 발송되었습니다',
  emailVerified: '이메일 인증이 완료되었습니다',
  resetCodeSent: '가입된 이메일이라면 인증 번호가 발송돼요. 메일함을 확인해 주세요.',
} as const;
