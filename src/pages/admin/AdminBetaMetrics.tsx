import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { adminApi, adminErrorMessage, type AdminBetaMetrics as Metrics, type AdminMetricGroups } from '../../api/admin';
import styles from './AdminPage.module.css';

// 베타 테스트 개발팀 집계 (넵넵 베타 테스트 설계서 5장 D1~D9 중 지금 기록으로 셀 수 있는 것). 개수만 본다
// 셀 수 없는 것: D4 근거를 연 카드, D5 되돌리기 10초 기준, D9 가져온 뒤 고친 섹션 수 (docs/beta-test-dev-check.md)

const GROUPS: { id: string; title: string; note: string }[] = [
  { id: 'D1', title: 'D1 회의록 작성 완료 (H2)', note: '취소한 회의는 빼고, 회의 시작 날짜 기준' },
  { id: 'D2', title: 'D2 AI 초안 (H3)', note: '처음 작성 완료한 때(완료 직전 저장 기록)와 초안을 섹션별로 비교. 표 칸은 비교하지 않음' },
  { id: 'D3', title: 'D3 요약 문장 (H4)', note: '회의가 끝난 뒤 오늘 회의 요약 기준' },
  { id: 'D5', title: 'D5 결정 상태, 내용 (H6, 일부)', note: '오늘 회의 요약의 결정할 사항 기준. 되돌리기 10초 기준은 셀 수 없음' },
  { id: 'D6', title: 'D6 할 일 담당자 (H7, 일부)', note: '고친 할 일은 담당자 말고 다른 칸을 고친 것도 포함' },
  { id: 'D7', title: 'D7 넵봇 (H8)', note: '답의 출처: 지금 회의, 지난 회의, 사전 자료' },
  { id: 'D8', title: 'D8 양식 직접 만들기 (H9)', note: '섹션 변경: 마지막 저장 기록의 칸 제목이 양식 항목과 다른 회의록' },
  { id: 'D9', title: 'D9 양식 가져오기 (H10, 일부)', note: '가져온 날 기준. 가져온 뒤 고친 섹션 수는 셀 수 없음' },
];

const LABELS: Record<string, string> = {
  meetings: '회의 수',
  finishedMeetings: '끝난 회의 수',
  completedMinutes: '작성 완료된 회의록 수',
  minutesWithDraft: 'AI 초안이 있는 회의록',
  draftSections: '초안 섹션 수',
  unchangedSections: '그대로 남은 섹션',
  contentChangedSections: '내용이 바뀐 섹션',
  removedSections: '지운 섹션 (양식 변경)',
  addedSections: '새로 넣은 섹션 (양식 변경)',
  tableSectionsNotCompared: '표 섹션 (비교 안 함)',
  meetingsWithSummary: '요약이 있는 회의',
  summarySentences: '요약 문장 수 (AI)',
  editedSummarySentences: '작성자가 고친 문장',
  addedSummarySentences: '작성자가 새로 넣은 문장',
  decisionPoints: '결정할 사항 수',
  decidedPoints: '결정됨',
  undecidedPoints: '미결',
  otherStatusPoints: '그 밖 상태',
  editedDecisionPoints: '상태나 내용을 고친 것',
  todos: '할 일 수 (AI)',
  todosWithAssignee: '담당자가 있는 할 일',
  todosWithoutAssignee: '담당자가 비어 있는 할 일',
  editedTodos: '작성자가 고친 할 일',
  addedTodos: '작성자가 새로 넣은 할 일',
  questions: '질문 수',
  meetingsWithQuestion: '질문이 있었던 회의',
  meetingsWithTwoOrMoreQuestions: '질문이 2개 이상인 회의',
  workspacesUsingChatbot: '넵봇을 쓴 워크스페이스',
  answersFromLive: '답 출처: 지금 회의',
  answersFromPastMinutes: '답 출처: 지난 회의',
  answersFromMaterials: '답 출처: 사전 자료',
  answersWithoutSource: '출처 없는 답',
  customTemplates: '직접 만든 양식 (기간 안)',
  usedCustomTemplates: '그중 회의에 쓰인 양식',
  minutesWithCustomTemplate: '직접 만든 양식을 쓴 회의록',
  minutesWithDefaultTemplate: '기본 양식을 쓴 회의록',
  minutesWithImportedTemplate: '가져온 양식을 쓴 회의록',
  minutesWithSectionChange_custom: '섹션을 바꾼 회의록 (직접 만든 양식)',
  minutesWithSectionChange_default: '섹션을 바꾼 회의록 (기본 양식)',
  minutesWithSectionChange_imported: '섹션을 바꾼 회의록 (가져온 양식)',
  imports: '가져오기 시도',
  succeededImports: '가져오기 성공',
  failedImports: '가져오기 실패',
  importedTemplatesUsed: '가져온 양식 중 쓰인 것',
  importedTemplatesUsedTwiceOrMore: '2번 이상 쓰인 것',
  importedTemplatesDeleted: '가져온 뒤 지운 것',
};

const ASSIGNEE_STATUS: Record<string, string> = {
  MATCHED: '참석자와 맞음',
  UNASSIGNED: '정하지 않음',
  NOT_IN_ROSTER: '참석자에 없음',
  AMBIGUOUS: '누구인지 모호',
};

function label(name: string) {
  if (name.startsWith('assigneeStatus_')) {
    const status = name.slice('assigneeStatus_'.length);
    return `담당자 판정: ${ASSIGNEE_STATUS[status] ?? status}`;
  }
  return LABELS[name] ?? name;
}

function GroupTables({ groups }: { groups: AdminMetricGroups }) {
  return (
    <div className={styles.metricGroups}>
      {GROUPS.filter((g) => groups[g.id]).map((g) => (
        <section key={g.id} className={styles.section}>
          <h3 className={styles.sectionTitle}>
            {g.title} <span className={styles.muted}>{g.note}</span>
          </h3>
          <div className={styles.gridWrap}>
            <table className={styles.grid}>
              <tbody>
                {Object.entries(groups[g.id]).map(([name, value]) => (
                  <tr key={name}>
                    <td>{label(name)}</td>
                    <td className={styles.metricValue}>{value.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

export default function AdminBetaMetrics({ onUnauthorized }: { onUnauthorized: (e: unknown) => boolean }) {
  const [form, setForm] = useState({ from: '', to: '', exclude: '' });
  const [query, setQuery] = useState(form);
  const [data, setData] = useState<Metrics | null>(null);
  const [workspace, setWorkspace] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await adminApi.betaMetrics(query.from, query.to, query.exclude));
    } catch (e) {
      if (!onUnauthorized(e)) setError(adminErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [query, onUnauthorized]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setQuery(form);
  };

  const workspaces = data ? Object.keys(data.byWorkspace) : [];

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <h2 className={styles.tableTitle}>베타 집계</h2>
        <span className={styles.muted}>개수만 본다. 회의 내용은 보지 않는다</span>
        <span className={styles.spacer} />
        <form className={styles.search} onSubmit={submit}>
          <input
            type="date"
            className={styles.select}
            aria-label="시작 날짜"
            value={form.from}
            onChange={(e) => setForm((f) => ({ ...f, from: e.target.value }))}
          />
          <input
            type="date"
            className={styles.select}
            aria-label="끝 날짜"
            value={form.to}
            onChange={(e) => setForm((f) => ({ ...f, to: e.target.value }))}
          />
          <input
            className={styles.select}
            placeholder="뺄 워크스페이스 번호 (쉼표로)"
            value={form.exclude}
            onChange={(e) => setForm((f) => ({ ...f, exclude: e.target.value }))}
          />
          <button type="submit" className={styles.secondary} disabled={loading}>
            {loading ? '불러오는 중…' : '보기'}
          </button>
        </form>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {data && (
        <>
          <p className={styles.muted}>
            기간 {data.query.from} ~ {data.query.to} (회의 시작 날짜, 한국 시간)
            {data.query.excludedWorkspaces.length > 0 && `, 뺀 워크스페이스 ${data.query.excludedWorkspaces.join(', ')}`}
          </p>
          {data.unavailable.length > 0 && <p className={styles.warning}>읽지 못한 DB: {data.unavailable.join(', ')}</p>}
          <div className={styles.toolbar}>
            <select className={styles.select} value={workspace} onChange={(e) => setWorkspace(e.target.value)}>
              <option value="">전체</option>
              {workspaces.map((id) => (
                <option key={id} value={id}>
                  워크스페이스 {id}
                </option>
              ))}
            </select>
          </div>
          <GroupTables groups={workspace ? (data.byWorkspace[workspace] ?? {}) : data.total} />
        </>
      )}
    </div>
  );
}
