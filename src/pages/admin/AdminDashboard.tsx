import { useCallback, useEffect, useState } from 'react';
import {
  adminApi,
  adminErrorMessage,
  type AdminDashboard as Dashboard,
  type AdminFailure,
  type AdminFailureKind,
  type AdminOperation,
} from '../../api/admin';
import styles from './AdminPage.module.css';

// REQ-215 관리자 현황 + REQ-217 운영 조치 (멈춘 회의 마무리, 실패한 작업 다시 하기)

const COUNTS: { key: keyof Dashboard['counts']; label: string }[] = [
  { key: 'users', label: '전체 사용자' },
  { key: 'usersToday', label: '오늘 가입' },
  { key: 'workspaces', label: '워크스페이스' },
  { key: 'meetingsToday', label: '오늘 회의' },
  { key: 'meetingsInProgress', label: '진행 중 회의' },
];

const JOBS: { key: keyof Dashboard['jobs']; label: string }[] = [
  { key: 'draft', label: 'AI 회의록 초안' },
  { key: 'minutesRag', label: '회의록 검색 반영' },
  { key: 'materialRag', label: '사전 자료 검색 반영' },
  { key: 'mail', label: '메일 발송' },
];

const STATUS_LABELS: Record<string, string> = {
  WAITING_SOURCE: '요약 기다림',
  REQUESTED: '만드는 중',
  SUCCEEDED: '완료',
  PENDING: '보낼 차례',
  ACCEPTED: '처리 중',
  READY: '완료',
  SENT: '보냄',
  FAILED: '실패',
};

const FAILURE_KINDS: Record<AdminFailureKind, { label: string; operation?: AdminOperation; action?: string }> = {
  draft: { label: 'AI 초안', operation: 'draftRetry', action: '다시 요청' },
  minutesRag: { label: '회의록 검색 반영', operation: 'minutesRagRetry', action: '다시 보내기' },
  materialRag: { label: '사전 자료 검색 반영', operation: 'materialRagRetry', action: '다시 보내기' },
  mail: { label: '메일' },
};

/** DB 이름 → 화면에 보일 서비스 이름 */
const DB_LABELS: Record<string, string> = {
  user: '사용자',
  workspace: '워크스페이스',
  meeting: '회의',
  minutes: '회의록',
  notification: '알림',
};

export default function AdminDashboard({ onUnauthorized }: { onUnauthorized: (e: unknown) => boolean }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [running, setRunning] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await adminApi.dashboard());
    } catch (e) {
      if (!onUnauthorized(e)) setError(adminErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [onUnauthorized]);

  useEffect(() => {
    void load();
  }, [load]);

  /** 실행 전에 한 번 더 묻고, 끝나면 현황을 다시 읽는다 */
  const operate = async (operation: AdminOperation, id: number, question: string, done: string) => {
    if (!window.confirm(question)) return;
    const key = `${operation}-${id}`;
    setRunning(key);
    setError('');
    setNotice('');
    try {
      await adminApi.operate(operation, id);
      setNotice(done);
      await load();
    } catch (e) {
      if (!onUnauthorized(e)) setError(adminErrorMessage(e));
    } finally {
      setRunning('');
    }
  };

  const retry = (failure: AdminFailure) => {
    const kind = FAILURE_KINDS[failure.kind];
    if (!kind.operation) return;
    const name = failure.title ? `"${failure.title}"` : `#${failure.id}`;
    void operate(
      kind.operation,
      failure.id,
      `${kind.label} ${name}을(를) ${kind.action}할까요?`,
      `${kind.label} ${name}을(를) ${kind.action}했습니다`,
    );
  };

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <h2 className={styles.tableTitle}>현황</h2>
        <span className={styles.muted}>한국 시간 기준</span>
        <span className={styles.spacer} />
        <button type="button" className={styles.secondary} onClick={() => void load()} disabled={loading}>
          {loading ? '불러오는 중…' : '새로 고침'}
        </button>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {notice && !error && <p className={styles.notice}>{notice}</p>}
      {data && data.unavailable.length > 0 && (
        <p className={styles.warning}>
          읽지 못한 DB: {data.unavailable.map((name) => DB_LABELS[name] ?? name).join(', ')}
        </p>
      )}
      {data && (
        <>
          <div className={styles.cards}>
            {COUNTS.map((c) => (
              <div key={c.key} className={styles.card}>
                <span className={styles.cardLabel}>{c.label}</span>
                <strong className={styles.cardValue}>{data.counts[c.key]?.toLocaleString() ?? '-'}</strong>
              </div>
            ))}
          </div>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>처리 상태</h3>
            <div className={styles.cards}>
              {JOBS.map((job) => {
                const statuses = data.jobs[job.key];
                return (
                  <div key={job.key} className={styles.card}>
                    <span className={styles.cardLabel}>{job.label}</span>
                    {statuses === undefined ? (
                      <span className={styles.muted}>읽지 못함</span>
                    ) : Object.keys(statuses).length === 0 ? (
                      <span className={styles.muted}>없음</span>
                    ) : (
                      <ul className={styles.statusList}>
                        {Object.entries(statuses).map(([status, count]) => (
                          <li key={status} className={status === 'FAILED' && count > 0 ? styles.statusFailed : undefined}>
                            <span>{STATUS_LABELS[status] ?? status}</span>
                            <strong>{count.toLocaleString()}</strong>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>
              멈춘 회의 <span className={styles.muted}>(진행 중으로 {data.stuckHours}시간 넘게 남은 회의)</span>
            </h3>
            {data.stuckMeetings.length === 0 ? (
              <p className={styles.muted}>없습니다.</p>
            ) : (
              <div className={styles.gridWrap}>
                <table className={styles.grid}>
                  <thead>
                    <tr>
                      <th>회의</th>
                      <th>제목</th>
                      <th>워크스페이스</th>
                      <th>작성자</th>
                      <th>시작</th>
                      <th>지난 시간</th>
                      <th className={styles.actionsHead} />
                    </tr>
                  </thead>
                  <tbody>
                    {data.stuckMeetings.map((m) => (
                      <tr key={m.id}>
                        <td>{m.id}</td>
                        <td title={m.title}>{m.title}</td>
                        <td>{m.workspace_id}</td>
                        <td>{m.writer_user_id ?? '-'}</td>
                        <td>{m.started_at}</td>
                        <td>{m.hours}시간</td>
                        <td className={styles.actions}>
                          <button
                            type="button"
                            className={styles.dangerLink}
                            disabled={running !== ''}
                            onClick={() =>
                              void operate(
                                'meetingFinish',
                                m.id,
                                `회의 "${m.title}"(#${m.id})을 마무리할까요? 작성자가 마무리한 것처럼 회의록이 만들어지고 회의방이 닫힙니다. 되돌릴 수 없습니다.`,
                                `회의 "${m.title}"을 마무리했습니다`,
                              )
                            }
                          >
                            {running === `meetingFinish-${m.id}` ? '마무리하는 중…' : '강제 마무리'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>
              최근 실패 <span className={styles.muted}>(종류마다 최근 20개)</span>
            </h3>
            {data.failures.length === 0 ? (
              <p className={styles.muted}>없습니다.</p>
            ) : (
              <div className={styles.gridWrap}>
                <table className={styles.grid}>
                  <thead>
                    <tr>
                      <th>종류</th>
                      <th>번호</th>
                      <th>제목</th>
                      <th>오류</th>
                      <th>시각</th>
                      <th className={styles.actionsHead} />
                    </tr>
                  </thead>
                  <tbody>
                    {data.failures.map((f) => {
                      const kind = FAILURE_KINDS[f.kind];
                      return (
                        <tr key={`${f.kind}-${f.id}`}>
                          <td>{kind.label}</td>
                          <td>{f.id}</td>
                          <td title={f.title ?? ''}>{f.title ?? '-'}</td>
                          <td title={f.error ?? ''}>{f.error ?? '-'}</td>
                          <td>{f.at ?? '-'}</td>
                          <td className={styles.actions}>
                            {kind.operation && (
                              <button
                                type="button"
                                className={styles.link}
                                disabled={running !== ''}
                                onClick={() => retry(f)}
                              >
                                {running === `${kind.operation}-${f.id}` ? '보내는 중…' : kind.action}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
