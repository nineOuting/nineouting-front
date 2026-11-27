import { useCallback, useEffect, useState } from 'react';
import { adminApi, adminErrorMessage, type AdminAuditPage } from '../../api/admin';
import styles from './AdminPage.module.css';

// REQ-216 감사 기록: 관리자가 한 일을 최신순으로 본다. 고치거나 지우지 않는다

const PAGE_SIZE = 50;

const ACTIONS: { value: string; label: string }[] = [
  { value: '', label: '모든 일' },
  { value: 'login', label: '로그인' },
  { value: 'logout', label: '로그아웃' },
  { value: 'row.insert', label: '행 추가' },
  { value: 'row.update', label: '행 수정' },
  { value: 'row.delete', label: '행 삭제' },
  { value: 'meeting.finish', label: '회의 강제 마무리' },
  { value: 'minutes.draftRetry', label: 'AI 초안 다시 요청' },
  { value: 'minutes.ragRetry', label: '회의록 검색 반영 다시 보내기' },
  { value: 'material.ragRetry', label: '사전 자료 검색 반영 다시 보내기' },
];

const ACTION_LABELS = Object.fromEntries(ACTIONS.filter((a) => a.value).map((a) => [a.value, a.label]));

/** detail JSON을 읽기 쉽게 (못 읽으면 그대로) */
function pretty(detail: string | null) {
  if (!detail) return '';
  try {
    return JSON.stringify(JSON.parse(detail), null, 2);
  } catch {
    return detail;
  }
}

export default function AdminAudit({ onUnauthorized }: { onUnauthorized: (e: unknown) => boolean }) {
  const [action, setAction] = useState('');
  const [pageNumber, setPageNumber] = useState(0);
  const [data, setData] = useState<AdminAuditPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await adminApi.audit(pageNumber, PAGE_SIZE, action || undefined));
    } catch (e) {
      if (!onUnauthorized(e)) setError(adminErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [pageNumber, action, onUnauthorized]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        <h2 className={styles.tableTitle}>감사 기록</h2>
        <span className={styles.muted}>한국 시간, 최신순</span>
        <span className={styles.spacer} />
        <select
          className={styles.select}
          value={action}
          onChange={(e) => {
            setAction(e.target.value);
            setPageNumber(0);
          }}
        >
          {ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>
        <button type="button" className={styles.secondary} onClick={() => void load()} disabled={loading}>
          {loading ? '불러오는 중…' : '새로 고침'}
        </button>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {data && !data.enabled && (
        <p className={styles.warning}>감사 기록 DB가 설정되지 않아 서버 로그로만 남고 있습니다.</p>
      )}
      {data && (
        <div className={styles.gridWrap}>
          <table className={styles.grid}>
            <thead>
              <tr>
                <th>시각</th>
                <th>한 일</th>
                <th>대상</th>
                <th>결과</th>
                <th>관리자</th>
                <th>IP</th>
                <th>내용</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{entry.occurredAt}</td>
                  <td>{ACTION_LABELS[entry.action] ?? entry.action}</td>
                  <td title={entry.target ?? ''}>{entry.target ?? '-'}</td>
                  <td className={entry.succeeded ? undefined : styles.statusFailed}>{entry.succeeded ? '성공' : '실패'}</td>
                  <td>{entry.actor ?? '-'}</td>
                  <td>{entry.clientIp ?? '-'}</td>
                  <td className={styles.detailCell}>
                    {entry.detail &&
                      (open === entry.id ? (
                        <>
                          <pre className={styles.detail}>{pretty(entry.detail)}</pre>
                          <button type="button" className={styles.link} onClick={() => setOpen(null)}>
                            접기
                          </button>
                        </>
                      ) : (
                        <button type="button" className={styles.link} onClick={() => setOpen(entry.id)}>
                          보기
                        </button>
                      ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.entries.length === 0 && <p className={styles.muted}>기록이 없습니다.</p>}
        </div>
      )}
      <div className={styles.pager}>
        <span className={styles.muted}>전체 {data?.total.toLocaleString() ?? 0}건</span>
        <span className={styles.spacer} />
        <button
          type="button"
          className={styles.secondary}
          disabled={pageNumber === 0}
          onClick={() => setPageNumber((p) => p - 1)}
        >
          이전
        </button>
        <span>
          {pageNumber + 1} / {totalPages}
        </span>
        <button
          type="button"
          className={styles.secondary}
          disabled={pageNumber + 1 >= totalPages}
          onClick={() => setPageNumber((p) => p + 1)}
        >
          다음
        </button>
      </div>
    </div>
  );
}
