import type { AdminColumn } from '../../api/admin';
import { kindOf, type FieldState } from './rowField';

// REQ-219 행 추가, 수정 창의 열 형식별 입력칸 (형식 판단, 검사는 rowField.ts)

/** DB 글자(2026-11-27 10:00:00.123) → 날짜 고르기 칸(2026-11-27T10:00:00). 초 아래는 칸에서 보이지 않는다 */
function toDateTimeInput(value: string) {
  return value.replace(' ', 'T').slice(0, 19);
}

interface RowFieldInputProps {
  column: AdminColumn;
  field: FieldState;
  disabled: boolean;
  placeholder: string;
  invalid: boolean;
  /** 글자 칸에 붙일 추천 값 (표에 이미 들어 있는 값) */
  suggestions?: string[];
  onChange: (value: string) => void;
}

export default function RowFieldInput({
  column,
  field,
  disabled,
  placeholder,
  invalid,
  suggestions,
  onChange,
}: RowFieldInputProps) {
  const common = {
    disabled: disabled || field.isNull,
    'aria-invalid': invalid,
  };
  switch (kindOf(column)) {
    case 'choice': {
      // 예전 값이 지금 목록에 없어도 보이게 한다
      const options =
        column.allowedValues.includes(field.value) || field.value === ''
          ? column.allowedValues
          : [field.value, ...column.allowedValues];
      return (
        <select {...common} value={field.value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{placeholder || '고르세요'}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }
    case 'boolean':
      return (
        <select {...common} value={field.value} onChange={(e) => onChange(e.target.value)}>
          <option value="">{placeholder || '고르세요'}</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      );
    case 'integer':
    case 'decimal':
      return (
        <input
          {...common}
          inputMode={kindOf(column) === 'integer' ? 'numeric' : 'decimal'}
          value={field.value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'datetime':
      return (
        <input
          {...common}
          type="datetime-local"
          step={1}
          value={toDateTimeInput(field.value)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'date':
      return <input {...common} type="date" value={field.value} onChange={(e) => onChange(e.target.value)} />;
    case 'json':
    case 'long':
      return (
        <textarea
          {...common}
          rows={3}
          value={field.value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    default: {
      // 추천 값이 있으면 목록에서 고르거나 직접 쓴다
      const listId = suggestions?.length ? `suggest-${column.name}` : undefined;
      return (
        <>
          <input
            {...common}
            list={listId}
            value={field.value}
            placeholder={placeholder || (listId ? '고르거나 직접 입력' : '')}
            onChange={(e) => onChange(e.target.value)}
          />
          {listId && (
            <datalist id={listId}>
              {suggestions?.map((value) => (
                <option key={value} value={value} />
              ))}
            </datalist>
          )}
        </>
      );
    }
  }
}
