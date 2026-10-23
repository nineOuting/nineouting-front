import { useRef, useState } from 'react';
import Placeholder from '../../components/Placeholder';
import type { Agenda, PendingAgenda } from '../../types/meeting';
import AgendaCard from './AgendaCard';
import AgendaForm from './AgendaForm';
import styles from './AgendaEditor.module.css';

const ICON_SIZE = 20;

type AgendaFormState = { mode: 'new' } | { mode: 'edit'; agendaId: string };

interface AgendaEditorProps {
  agendas: Agenda[];
  /** 폴더의 남은 안건 (다른 회의가 불러간 것은 빼고 넘긴다) */
  pendingAgendas: PendingAgenda[];
  onChange: (agendas: Agenda[]) => void;
}

/** REQ-065~066, 068~069 안건 목록. 카드를 펼쳐 결정할 사항을 보고, 고치고, 끌어서 순서를 바꾼다 */
export default function AgendaEditor({ agendas, pendingAgendas, onChange }: AgendaEditorProps) {
  const [expandedAgendaId, setExpandedAgendaId] = useState<string | undefined>(agendas[0]?.id);
  const [agendaForm, setAgendaForm] = useState<AgendaFormState | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  // 같은 남은 안건을 두 번 불러오지 않게, 이미 목록에 있는 것은 뺀다 (고치는 안건 자신은 남긴다)
  const editingId = agendaForm?.mode === 'edit' ? agendaForm.agendaId : undefined;
  const availablePending = pendingAgendas.filter(
    ({ id }) => !agendas.some((agenda) => agenda.pendingAgendaId === id && agenda.id !== editingId),
  );

  const saveAgenda = (input: Omit<Agenda, 'id'>, { continueWriting }: { continueWriting: boolean }) => {
    if (agendaForm?.mode === 'edit') {
      onChange(agendas.map((agenda) => (agenda.id === agendaForm.agendaId ? { ...agenda, ...input } : agenda)));
    } else {
      onChange([...agendas, { ...input, id: crypto.randomUUID() }]);
    }
    if (!continueWriting) {
      setAgendaForm(null);
    }
  };

  const moveAgenda = (toIndex: number) => {
    const fromIndex = dragIndexRef.current;
    dragIndexRef.current = null;
    if (fromIndex === null || fromIndex === toIndex) {
      return;
    }
    const next = [...agendas];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChange(next);
  };

  return (
    <>
      <ul className={styles.agendaList}>
        {agendas.map((agenda, index) =>
          editingId === agenda.id ? (
            <li key={agenda.id}>
              <AgendaForm
                initialAgenda={agenda}
                pendingAgendas={availablePending}
                onCancel={() => setAgendaForm(null)}
                onSave={saveAgenda}
              />
            </li>
          ) : (
            <AgendaCard
              key={agenda.id}
              agenda={agenda}
              isExpanded={expandedAgendaId === agenda.id}
              onToggle={() => setExpandedAgendaId((current) => (current === agenda.id ? undefined : agenda.id))}
              onEdit={() => setAgendaForm({ mode: 'edit', agendaId: agenda.id })}
              onDragStart={() => {
                dragIndexRef.current = index;
              }}
              onDrop={() => moveAgenda(index)}
            />
          ),
        )}
        {agendaForm?.mode === 'new' && (
          <li>
            <AgendaForm pendingAgendas={availablePending} onCancel={() => setAgendaForm(null)} onSave={saveAgenda} />
          </li>
        )}
      </ul>
      <button type="button" className={styles.addAgenda} onClick={() => setAgendaForm({ mode: 'new' })}>
        <Placeholder size={ICON_SIZE} />
        안건 추가하기
      </button>
    </>
  );
}
