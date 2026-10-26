import type { Member } from '../types/meeting';
import styles from './AvatarStack.module.css';

const DEFAULT_MAX = 4;

interface AvatarStackProps {
  members: Member[];
  /** 몇 명까지 얼굴을 보여 주고 나머지는 +N으로 줄인다 */
  max?: number;
  /** overlap: 겹쳐서(회의 목록·폴더 멤버), spaced: 띄워서(워크스페이스 멤버) */
  layout?: 'overlap' | 'spaced';
  /** 화면 읽기 프로그램용 설명 (예: "참여자 7명") */
  label: string;
}

/** 멤버 얼굴 동그라미 묶음. 사진이 없으면 디자인의 회색 동그라미로 보인다 */
export default function AvatarStack({ members, max = DEFAULT_MAX, layout = 'overlap', label }: AvatarStackProps) {
  const shown = members.slice(0, max);
  const rest = members.length - shown.length;

  return (
    <div className={styles.stack} role="img" aria-label={label}>
      <span className={`${styles.faces} ${styles[layout]}`}>
        {shown.map((member) =>
          member.profileImageUrl ? (
            <img key={member.userId} src={member.profileImageUrl} alt="" className={styles.face} />
          ) : (
            <span key={member.userId} className={styles.face} />
          ),
        )}
      </span>
      {rest > 0 && <span className={styles.rest}>+{rest}</span>}
    </div>
  );
}
