import Placeholder from '../../components/Placeholder';
import TextField from '../../components/TextField';
import { DECISION_POINT_MAX_COUNT, DECISION_POINT_MAX_LENGTH } from '../../constants/meeting';
import styles from './DecisionPointFields.module.css';

const ICON_SIZE = 16;
const TRAILING_ICON_SIZE = 20;
const LABEL = '결정할 내용';

interface DecisionPointFieldsProps {
  values: string[];
  onChange: (values: string[]) => void;
  /** 라벨에 * 를 붙인다 */
  isRequired?: boolean;
  /** 칸 모양은 쓰는 화면의 TextField 스타일을 따른다 */
  fieldClassName?: string;
}

/** REQ-066 결정할 사항 목록. 아래 버튼으로 칸을 늘린다 (최대 5개). 비운 칸은 저장할 때 뺀다 */
export default function DecisionPointFields({ values, onChange, isRequired, fieldClassName }: DecisionPointFieldsProps) {
  const change = (index: number, value: string) => onChange(values.map((item, i) => (i === index ? value : item)));

  return (
    <div className={styles.group}>
      {values.map((value, index) => (
        <TextField
          // 칸은 뒤에만 붙고 지우지 않아 순서가 바뀌지 않는다
          key={index}
          label={index === 0 ? `${LABEL}${isRequired ? ' *' : ''}` : undefined}
          aria-label={index === 0 ? undefined : `${LABEL} ${index + 1}`}
          className={fieldClassName}
          placeholder="이 안건에서 무엇을 결정해야 하나요?"
          maxLength={DECISION_POINT_MAX_LENGTH}
          value={value}
          onChange={(event) => change(index, event.target.value)}
          trailing={<Placeholder size={TRAILING_ICON_SIZE} />}
        />
      ))}
      {values.length < DECISION_POINT_MAX_COUNT && (
        <button type="button" className={styles.add} onClick={() => onChange([...values, ''])}>
          <Placeholder size={ICON_SIZE} />
          {LABEL} 추가
        </button>
      )}
    </div>
  );
}
