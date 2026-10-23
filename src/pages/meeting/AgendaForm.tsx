import { useRef, useState } from 'react';
import DropdownMenu from '../../components/DropdownMenu';
import Placeholder from '../../components/Placeholder';
import TextField from '../../components/TextField';
import { cleanDecisionPoints } from '../../constants/meeting';
import type { Agenda, PendingAgenda } from '../../types/meeting';
import DecisionPointFields from './DecisionPointFields';
import styles from './AgendaForm.module.css';

const ICON_SIZE = 20;
// meeting-service AgendaRequest 길이 제한과 같다
const TITLE_MAX_LENGTH = 100;

type AgendaInput = Omit<Agenda, 'id'>;

interface AgendaFormProps {
  initialAgenda?: Agenda;
  /** 폴더의 남은 안건 중 불러올 수 있는 것 */
  pendingAgendas: PendingAgenda[];
  onCancel: () => void;
  onSave: (agenda: AgendaInput, options: { continueWriting: boolean }) => void;
}

/** REQ-065~066, 068 안건 작성·수정. 안건 제목 칸 오른쪽 버튼으로 폴더의 남은 안건을 불러온다 */
export default function AgendaForm({ initialAgenda, pendingAgendas, onCancel, onSave }: AgendaFormProps) {
  const [title, setTitle] = useState(initialAgenda?.title ?? '');
  const [decisionPoints, setDecisionPoints] = useState(initialAgenda?.decisionPoints ?? ['']);
  const [pending, setPending] = useState(() =>
    initialAgenda?.pendingAgendaId === undefined
      ? undefined
      : { id: initialAgenda.pendingAgendaId, carriedOverFrom: initialAgenda.carriedOverFrom },
  );
  const [isPendingMenuOpen, setIsPendingMenuOpen] = useState(false);
  const pendingAnchorRef = useRef<HTMLButtonElement>(null);
  const isEdit = Boolean(initialAgenda);
  const canSave = Boolean(title.trim()) && cleanDecisionPoints(decisionPoints).length > 0;

  const save = (continueWriting: boolean) => {
    if (!canSave) {
      return;
    }
    onSave(
      {
        title: title.trim(),
        decisionPoints: cleanDecisionPoints(decisionPoints),
        pendingAgendaId: pending?.id,
        carriedOverFrom: pending?.carriedOverFrom,
      },
      { continueWriting },
    );
    if (continueWriting) {
      setTitle('');
      setDecisionPoints(['']);
      setPending(undefined);
    }
  };

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <Placeholder size={ICON_SIZE} />
        <p className={styles.headTitle}>{isEdit ? '안건 수정' : '새 안건 작성'}</p>
      </div>
      <div className={styles.menuAnchor}>
        <TextField
          label="안건 제목 *"
          className={styles.field}
          placeholder="예 : 핵심 기능 우선순위 결정"
          maxLength={TITLE_MAX_LENGTH}
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            setPending(undefined);
          }}
          trailing={
            <button
              ref={pendingAnchorRef}
              type="button"
              className={styles.iconButton}
              aria-label="남은 안건 불러오기"
              aria-haspopup="listbox"
              aria-expanded={isPendingMenuOpen}
              onClick={() => setIsPendingMenuOpen((value) => !value)}
            >
              <Placeholder size={ICON_SIZE} />
            </button>
          }
        />
        {isPendingMenuOpen && (
          <DropdownMenu
            label="남은 안건"
            emptyText="폴더에 남은 안건이 없어요"
            anchorRef={pendingAnchorRef}
            items={pendingAgendas.map((item) => ({
              id: String(item.id),
              label: item.title,
              description: `${item.carriedOverFrom} 회의에서 넘어온 안건`,
            }))}
            onSelect={(id) => {
              const selected = pendingAgendas.find((item) => String(item.id) === id);
              if (selected) {
                setTitle(selected.title);
                setDecisionPoints(selected.decisionPoints);
                setPending({ id: selected.id, carriedOverFrom: selected.carriedOverFrom });
              }
              setIsPendingMenuOpen(false);
            }}
            onClose={() => setIsPendingMenuOpen(false)}
          />
        )}
      </div>
      <div className={styles.decisionGroup}>
        <DecisionPointFields values={decisionPoints} onChange={setDecisionPoints} fieldClassName={styles.field} />
        <p className={styles.hint}>예 : 1차 개발에 포함할 기능 3개를 확정한다.</p>
      </div>
      <div className={styles.actions}>
        <button type="button" className={`${styles.pill} ${styles.cancel}`} onClick={onCancel}>
          취소
        </button>
        {!isEdit && (
          <button
            type="button"
            className={`${styles.pill} ${styles.next}`}
            disabled={!canSave}
            onClick={() => save(true)}
          >
            저장 후 다음 안건
          </button>
        )}
        <button type="button" className={`${styles.pill} ${styles.save}`} disabled={!canSave} onClick={() => save(false)}>
          안건 저장
        </button>
      </div>
    </div>
  );
}
