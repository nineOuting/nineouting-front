import Placeholder from '../../components/Placeholder';
import type { Member } from '../../types/meeting';
import styles from './MemberChips.module.css';

const REMOVE_ICON_SIZE = 16;

interface MemberChipsProps {
  members: Member[];
  onRemove: (member: Member) => void;
}

/** 선택한 참석자 이름표. 오른쪽 아이콘을 누르면 뺀다 */
export default function MemberChips({ members, onRemove }: MemberChipsProps) {
  if (members.length === 0) {
    return null;
  }
  return (
    <ul className={styles.chips}>
      {members.map((member) => (
        <li key={member.userId} className={styles.chip}>
          {member.name}
          <button
            type="button"
            className={styles.remove}
            aria-label={`${member.name} 빼기`}
            onClick={() => onRemove(member)}
          >
            <Placeholder size={REMOVE_ICON_SIZE} />
          </button>
        </li>
      ))}
    </ul>
  );
}
