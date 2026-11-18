import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import styles from './CodeInput.module.css';

interface CodeInputProps {
  /** 자리마다 한 글자 (빈 자리는 빈 글자) */
  digits: string[];
  disabled?: boolean;
  /** 틀렸을 때 빨간 테두리 */
  isInvalid?: boolean;
  onChange: (digits: string[]) => void;
}

/**
 * 인증 번호 6칸 (디자인 Page 9 SignupCodePage, PasswordCodePage). 숫자를 넣으면 다음 칸으로, 지우면 앞 칸으로 가고
 * 붙여 넣으면 한 번에 채운다. 칸이 모두 비면(처음, 다시 받기) 첫 칸에 커서를 둔다
 */
export default function CodeInput({ digits, disabled, isInvalid, onChange }: CodeInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const isEmpty = digits.every((digit) => !digit);

  useEffect(() => {
    if (isEmpty && !disabled) {
      inputRefs.current[0]?.focus();
    }
  }, [isEmpty, disabled]);

  const focusInput = (index: number) => inputRefs.current[index]?.focus();

  const handleChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    onChange(digits.map((current, i) => (i === index ? digit : current)));
    if (digit && index < digits.length - 1) {
      focusInput(index + 1);
    }
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      focusInput(index - 1);
    }
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, digits.length);
    if (!pasted) {
      return;
    }
    event.preventDefault();
    onChange(digits.map((_, i) => pasted[i] ?? ''));
    focusInput(Math.min(pasted.length, digits.length - 1));
  };

  return (
    <div className={styles.inputs}>
      {digits.map((digit, index) => (
        <input
          // 자리 순서가 바뀌지 않으므로 index를 key로 쓴다
          key={index}
          ref={(element) => {
            inputRefs.current[index] = element;
          }}
          className={isInvalid ? `${styles.input} ${styles.invalid}` : styles.input}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          aria-label={`인증 번호 ${index + 1}번째 자리`}
          aria-invalid={isInvalid || undefined}
          value={digit}
          disabled={disabled}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
        />
      ))}
    </div>
  );
}
