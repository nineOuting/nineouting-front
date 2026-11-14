import { useRef, useState } from 'react';
import addIcon from '../../assets/icons/add-sm.svg';
import archiveIcon from '../../assets/icons/archive.svg';
import closeIcon from '../../assets/icons/close-sm.svg';
import deleteIcon from '../../assets/icons/delete-sm.svg';
import dragIcon from '../../assets/icons/drag.svg';
import editIcon from '../../assets/icons/edit.svg';
import errorIcon from '../../assets/icons/error.svg';
import Button from '../../components/Button';
import ConfirmDialog from '../../components/ConfirmDialog';
import Icon from '../../components/Icon';
import type { Agenda, PendingAgenda } from '../../types/meeting';
import styles from './AgendaBoard.module.css';

const ICON_SIZE = 20;
const SMALL_ICON_SIZE = 16;
// meeting-service AgendaRequest 제한과 같다
const TITLE_MAX_LENGTH = 100;
const DECISION_MAX_LENGTH = 200;
const DECISION_MAX_COUNT = 5;

type DragTarget = { kind: 'agenda'; index: number } | { kind: 'decision'; agendaIndex: number; index: number };
type DraftErrors = Record<string, { title?: string; decisions?: string }>;

interface AgendaBoardProps {
  agendas: Agenda[];
  /** 폴더의 남은 안건 (다른 회의가 불러간 것은 빼고 넘긴다) */
  pendingAgendas: PendingAgenda[];
  /** REQ-130 참석자만 고친다 */
  canEdit: boolean;
  /** 회의 예정 길이(분). 머리말에 보여 준다 */
  durationMinutes?: number;
  /** 저장에 성공하면 true */
  onSave: (agendas: Agenda[]) => Promise<boolean>;
  /** 남은 안건을 이번 회의로 가져온 뒤 알림 (되돌리기 포함) */
  onCarryOver: (agenda: Agenda, undo: () => void) => void;
}

function totalDecisionPoints(agendas: Agenda[]) {
  return agendas.reduce((sum, agenda) => sum + agenda.decisionPoints.length, 0);
}

function fromPending(pending: PendingAgenda): Agenda {
  return {
    id: crypto.randomUUID(),
    title: pending.title,
    decisionPoints: pending.decisionPoints,
    pendingAgendaId: pending.id,
    carriedOverFrom: pending.carriedOverFrom,
  };
}

function move<T>(list: T[], from: number, to: number) {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/** 저장 전에 빈 칸을 정리하고 meeting-service 검증과 같은 규칙으로 확인한다 */
function cleanDraft(draft: Agenda[]) {
  const cleaned = draft
    .map((agenda) => ({
      ...agenda,
      title: agenda.title.trim(),
      decisionPoints: agenda.decisionPoints.map((point) => point.trim()).filter(Boolean),
    }))
    // 아무것도 쓰지 않은 새 안건 칸은 조용히 뺀다
    .filter((agenda) => agenda.title || agenda.decisionPoints.length > 0);
  const errors: DraftErrors = {};
  for (const agenda of cleaned) {
    if (!agenda.title) {
      errors[agenda.id] = { ...errors[agenda.id], title: '안건을 입력해 주세요' };
    }
    if (agenda.decisionPoints.length === 0) {
      errors[agenda.id] = { ...errors[agenda.id], decisions: '결정할 사항을 1개 이상 입력해 주세요' };
    }
  }
  return { cleaned, errors };
}

/**
 * 디자인 Version02 회의 대기 "논의할 안건" 카드. 평소에는 읽기 전용 목록이고 [안건 수정]을 누르면 그 자리에서 바로 고친다.
 * 아래 "이전 회의에서 남은 안건"은 체크하면 이번 회의 안건에 들어간다 (REQ-065~069, 170)
 */
export default function AgendaBoard({
  agendas,
  pendingAgendas,
  canEdit,
  durationMinutes,
  onSave,
  onCarryOver,
}: AgendaBoardProps) {
  const [draft, setDraft] = useState<Agenda[] | null>(null);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);
  const [focusId, setFocusId] = useState<string>();
  // 남은 안건 지우기는 아직 서버 API가 없어 이 화면에서만 숨긴다
  const [hiddenPendingIds, setHiddenPendingIds] = useState<number[]>([]);
  const dragRef = useRef<DragTarget | null>(null);
  const isEditing = draft !== null;
  const shown = draft ?? agendas;
  const isDirty = isEditing && JSON.stringify(draft) !== JSON.stringify(agendas);
  // 같은 남은 안건을 두 번 불러오지 않게 이미 들어간 것은 뺀다
  const availablePending = pendingAgendas.filter(
    ({ id }) => !hiddenPendingIds.includes(id) && !shown.some((agenda) => agenda.pendingAgendaId === id),
  );

  const updateDraft = (updater: (prev: Agenda[]) => Agenda[]) => setDraft((prev) => (prev ? updater(prev) : prev));

  const updateAgenda = (agendaId: string, patch: Partial<Agenda>) => {
    updateDraft((prev) => prev.map((agenda) => (agenda.id === agendaId ? { ...agenda, ...patch } : agenda)));
    setErrors((prev) => {
      if (!prev[agendaId]) {
        return prev;
      }
      const next = { ...prev };
      delete next[agendaId];
      return next;
    });
  };

  const startEditing = () => {
    setErrors({});
    setDraft(agendas.length > 0 ? agendas : [{ id: crypto.randomUUID(), title: '', decisionPoints: [''] }]);
  };

  const addAgenda = () => {
    const id = crypto.randomUUID();
    updateDraft((prev) => [...prev, { id, title: '', decisionPoints: [''] }]);
    setFocusId(id);
  };

  const save = async () => {
    if (!draft) {
      return;
    }
    const { cleaned, errors: nextErrors } = cleanDraft(draft);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setIsSaving(true);
    const isSaved = await onSave(cleaned);
    setIsSaving(false);
    if (isSaved) {
      setDraft(null);
    }
  };

  const cancel = () => {
    if (isDirty) {
      setIsDiscardOpen(true);
    } else {
      setDraft(null);
    }
  };

  const carryOver = (pending: PendingAgenda) => {
    const agenda = fromPending(pending);
    if (isEditing) {
      updateDraft((prev) => [...prev, agenda]);
      return;
    }
    const before = agendas;
    void onSave([...agendas, agenda]).then((isSaved) => {
      if (isSaved) {
        onCarryOver(agenda, () => void onSave(before));
      }
    });
  };

  const handleDrop = (target: DragTarget) => {
    const source = dragRef.current;
    dragRef.current = null;
    if (!source || source.kind !== target.kind) {
      return;
    }
    if (source.kind === 'agenda' && target.kind === 'agenda' && source.index !== target.index) {
      updateDraft((prev) => move(prev, source.index, target.index));
    }
    if (
      source.kind === 'decision' &&
      target.kind === 'decision' &&
      source.agendaIndex === target.agendaIndex &&
      source.index !== target.index
    ) {
      updateDraft((prev) =>
        prev.map((agenda, index) =>
          index === target.agendaIndex
            ? { ...agenda, decisionPoints: move(agenda.decisionPoints, source.index, target.index) }
            : agenda,
        ),
      );
    }
  };

  const subtitle = isEditing
    ? '제목·결정할 사항을 바로 고치고, 끌어서 순서를 바꿀 수 있어요'
    : agendas.length === 0
      ? '안건을 1개 이상 추가해야 회의를 시작할 수 있어요'
      : [`결정할 사항 ${totalDecisionPoints(agendas)}개`, durationMinutes ? `전체 회의 ${durationMinutes}분` : '']
          .filter(Boolean)
          .join(' · ');

  return (
    <section className={[styles.card, isEditing ? styles.editing : ''].filter(Boolean).join(' ')}>
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.titleRow}>
            <h2 className={styles.title}>{isEditing ? '논의할 안건 수정' : '논의할 안건'}</h2>
            <span className={styles.countBadge}>{shown.length}개</span>
          </div>
          <p className={styles.subtitle}>{subtitle}</p>
        </div>
        {isEditing ? (
          <div className={styles.headerActions}>
            <Button variant="secondary" size="md" className={styles.smallButton} onClick={cancel}>
              취소
            </Button>
            <Button size="md" className={styles.smallButton} isLoading={isSaving} onClick={() => void save()}>
              저장
            </Button>
          </div>
        ) : (
          canEdit && (
            <Button variant="secondary" size="md" className={styles.smallButton} onClick={startEditing}>
              <Icon src={editIcon} size={SMALL_ICON_SIZE} />
              안건 수정
            </Button>
          )
        )}
      </div>

      {!isEditing && agendas.length === 0 && (
        <div className={styles.empty}>
          <Icon src={errorIcon} size={ICON_SIZE} className={styles.emptyIcon} />
          <p className={styles.emptyTitle}>아직 안건이 없어요</p>
          <p className={styles.emptyText}>
            {canEdit ? '[안건 수정]에서 추가하거나 아래 남은 안건을 체크해 가져와요' : '회의 참석자가 안건을 추가하면 여기에 보여요'}
          </p>
        </div>
      )}

      {!isEditing && agendas.length > 0 && (
        <ol className={styles.viewList}>
          {agendas.map((agenda) => (
            <li key={agenda.id} className={styles.viewItem}>
              <div className={styles.viewTitleRow}>
                <h3 className={styles.viewTitle}>{agenda.title}</h3>
                {agenda.carriedOverFrom && (
                  <span className={styles.carriedChip}>
                    <Icon src={archiveIcon} size={SMALL_ICON_SIZE} />
                    지난 회의에서 넘어옴 · {agenda.carriedOverFrom}
                  </span>
                )}
              </div>
              <div className={styles.decisionBlock}>
                <p className={styles.decisionLabel}>결정할 사항</p>
                {agenda.decisionPoints.length === 0 ? (
                  <p className={styles.noDecision}>아직 결정할 사항이 없어요</p>
                ) : (
                  <ul className={styles.decisionList}>
                    {agenda.decisionPoints.map((point, index) => (
                      <li key={index} className={styles.decisionItem}>
                        <span className={styles.pendingDot} aria-hidden="true" />
                        {point}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {isEditing && draft && (
        <>
          <ol className={styles.editList}>
            {draft.map((agenda, agendaIndex) => {
              const agendaErrors = errors[agenda.id];
              const isNew = !agendas.some(({ id }) => id === agenda.id) && !agenda.pendingAgendaId;
              return (
                <li
                  key={agenda.id}
                  className={[styles.editItem, isNew ? styles.newItem : ''].filter(Boolean).join(' ')}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleDrop({ kind: 'agenda', index: agendaIndex })}
                >
                  <div className={styles.editTitleRow}>
                    <span
                      className={styles.handle}
                      draggable
                      aria-label="끌어서 안건 순서 바꾸기"
                      onDragStart={() => {
                        dragRef.current = { kind: 'agenda', index: agendaIndex };
                      }}
                    >
                      <Icon src={dragIcon} size={ICON_SIZE} />
                    </span>
                    <input
                      className={[styles.titleInput, agendaErrors?.title ? styles.inputError : ''].filter(Boolean).join(' ')}
                      value={agenda.title}
                      maxLength={TITLE_MAX_LENGTH}
                      placeholder="안건을 입력하세요"
                      aria-label="안건 제목"
                      aria-invalid={Boolean(agendaErrors?.title)}
                      // 새로 추가한 칸에 바로 쓸 수 있게
                      ref={(element) => {
                        if (element && focusId === agenda.id) {
                          element.focus();
                          setFocusId(undefined);
                        }
                      }}
                      onChange={(event) => updateAgenda(agenda.id, { title: event.target.value })}
                    />
                    <button
                      type="button"
                      className={styles.iconButton}
                      aria-label={`${agenda.title || '새 안건'} 삭제`}
                      onClick={() => updateDraft((prev) => prev.filter(({ id }) => id !== agenda.id))}
                    >
                      <Icon src={deleteIcon} size={SMALL_ICON_SIZE} />
                    </button>
                  </div>
                  {agendaErrors?.title && <p className={styles.fieldError}>{agendaErrors.title}</p>}
                  {agenda.carriedOverFrom && (
                    <p className={styles.carriedNote}>
                      <Icon src={archiveIcon} size={SMALL_ICON_SIZE - 4} />
                      지난 회의에서 넘어옴 · {agenda.carriedOverFrom}
                    </p>
                  )}
                  <div className={styles.decisionEdit}>
                    <p className={styles.decisionLabel}>결정할 사항</p>
                    {agenda.decisionPoints.map((point, index) => (
                      <div
                        key={index}
                        className={styles.decisionRow}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={(event) => {
                          event.stopPropagation();
                          handleDrop({ kind: 'decision', agendaIndex, index });
                        }}
                      >
                        <span
                          className={styles.smallHandle}
                          draggable
                          aria-label="끌어서 결정할 사항 순서 바꾸기"
                          onDragStart={(event) => {
                            event.stopPropagation();
                            dragRef.current = { kind: 'decision', agendaIndex, index };
                          }}
                        >
                          <Icon src={dragIcon} size={SMALL_ICON_SIZE} />
                        </span>
                        <input
                          className={styles.decisionInput}
                          value={point}
                          maxLength={DECISION_MAX_LENGTH}
                          placeholder="결정할 사항을 입력하세요"
                          aria-label={`결정할 사항 ${index + 1}`}
                          onChange={(event) =>
                            updateAgenda(agenda.id, {
                              decisionPoints: agenda.decisionPoints.map((value, pointIndex) =>
                                pointIndex === index ? event.target.value : value,
                              ),
                            })
                          }
                        />
                        <button
                          type="button"
                          className={styles.iconButton}
                          aria-label={`결정할 사항 ${index + 1} 지우기`}
                          onClick={() =>
                            updateAgenda(agenda.id, {
                              decisionPoints: agenda.decisionPoints.filter((_, pointIndex) => pointIndex !== index),
                            })
                          }
                        >
                          <Icon src={closeIcon} size={SMALL_ICON_SIZE} />
                        </button>
                      </div>
                    ))}
                    {agendaErrors?.decisions && <p className={styles.fieldError}>{agendaErrors.decisions}</p>}
                    <button
                      type="button"
                      className={styles.addDecision}
                      disabled={agenda.decisionPoints.length >= DECISION_MAX_COUNT}
                      onClick={() => updateAgenda(agenda.id, { decisionPoints: [...agenda.decisionPoints, ''] })}
                    >
                      <Icon src={addIcon} size={SMALL_ICON_SIZE} />
                      {agenda.decisionPoints.length >= DECISION_MAX_COUNT ? '결정할 사항은 5개까지 넣을 수 있어요' : '결정할 사항 추가'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
          <button type="button" className={styles.addAgenda} onClick={addAgenda}>
            <Icon src={addIcon} size={ICON_SIZE} />
            안건 추가
          </button>
        </>
      )}

      {canEdit && availablePending.length > 0 && (
        <div className={styles.pending}>
          <div className={styles.pendingHead}>
            <h3 className={styles.pendingTitle}>
              이전 회의에서 남은 안건 <span className={styles.pendingCount}>{availablePending.length}개</span>
            </h3>
            <p className={styles.pendingHint}>체크하면 이번 회의 안건에 추가돼요</p>
          </div>
          <ul className={styles.pendingList}>
            {availablePending.map((pending) => (
              <li key={pending.id}>
                <label className={styles.pendingItem}>
                  <input type="checkbox" className={styles.pendingCheck} checked={false} onChange={() => carryOver(pending)} />
                  <span className={styles.pendingTexts}>
                    <span className={styles.pendingName}>{pending.title}</span>
                    <span className={styles.pendingMeta}>지난 회의 · {pending.carriedOverFrom}</span>
                  </span>
                </label>
                <button
                  type="button"
                  className={`${styles.iconButton} ${styles.pendingDelete}`}
                  aria-label={`${pending.title} 남은 안건에서 지우기`}
                  onClick={() => setHiddenPendingIds((prev) => [...prev, pending.id])}
                >
                  <Icon src={deleteIcon} size={SMALL_ICON_SIZE} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isDiscardOpen && (
        <ConfirmDialog
          title="수정한 내용을 저장하지 않을까요?"
          message="나가면 고친 안건과 결정할 사항이 사라져요"
          cancelLabel="계속 수정하기"
          confirmLabel="저장하지 않고 나가기"
          onCancel={() => setIsDiscardOpen(false)}
          onConfirm={() => {
            setIsDiscardOpen(false);
            setDraft(null);
            setErrors({});
          }}
        />
      )}
    </section>
  );
}
