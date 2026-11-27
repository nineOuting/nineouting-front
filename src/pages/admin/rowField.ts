import type { AdminColumn } from '../../api/admin';

// REQ-219 행 추가, 수정 창의 열 형식별 입력칸과 저장 전 검사.
// 값은 DB가 글자로 준 그대로 들고 있고 (손대지 않으면 그대로라 다시 보내지 않는다), 입력칸에 보일 때만 모양을 바꾼다.
// 최종 확인은 DB가 한다 (여기 검사는 흔한 실수를 저장 전에 알려 주는 것)

export interface FieldState {
  value: string;
  isNull: boolean;
  touched: boolean;
}

export type Kind = 'choice' | 'boolean' | 'integer' | 'decimal' | 'datetime' | 'date' | 'json' | 'long' | 'text';

const INTEGER = /^-?\d+$/;
const DECIMAL = /^-?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/;
// 시간대 없는 timestamp만 날짜 고르기로 (timestamptz는 +09 같은 시간대가 붙어 글자 칸으로 둔다)
const DATETIME_TYPE = /^timestamp(\(\d\))? without time zone$/;

export function kindOf(column: AdminColumn): Kind {
  const type = column.type;
  if (column.allowedValues.length > 0) return 'choice';
  if (type === 'boolean') return 'boolean';
  if (/^(smallint|integer|bigint)$/.test(type)) return 'integer';
  if (/^(numeric|real|double precision)/.test(type)) return 'decimal';
  if (DATETIME_TYPE.test(type)) return 'datetime';
  if (type === 'date') return 'date';
  if (/^jsonb?$/.test(type)) return 'json';
  if (type === 'text' || type.endsWith('[]')) return 'long';
  return 'text';
}

/** 값을 넣어야 하는 열: NULL 불가이고 DB 기본값이 없다 (추가할 때만 본다) */
export function isRequired(column: AdminColumn) {
  return !column.nullable && !column.defaultValue;
}

/** 저장 전 검사. 문제가 없으면 빈 글자 */
export function validate(column: AdminColumn, field: FieldState, isInsert: boolean): string {
  if (field.isNull) return '';
  const value = field.value;
  const kind = kindOf(column);
  if (value === '') {
    if (isInsert && isRequired(column)) return '값을 넣어야 하는 열입니다';
    // 글자 열의 빈 값은 그대로 저장된다. 그 밖의 형식은 빈 값이 맞지 않는다
    if (!isInsert || field.touched) {
      return kind === 'text' || kind === 'long' ? '' : '값을 넣거나 NULL을 고르세요';
    }
    return '';
  }
  switch (kind) {
    case 'integer':
      return INTEGER.test(value.trim()) ? '' : '정수를 넣어 주세요';
    case 'decimal':
      return DECIMAL.test(value.trim()) ? '' : '숫자를 넣어 주세요';
    case 'boolean':
      return value === 'true' || value === 'false' ? '' : 'true나 false를 골라 주세요';
    case 'choice':
      return column.allowedValues.includes(value) ? '' : '목록에 있는 값을 골라 주세요';
    case 'json':
      try {
        JSON.parse(value);
        return '';
      } catch {
        return 'JSON 형식이 아닙니다';
      }
    default:
      return '';
  }
}
