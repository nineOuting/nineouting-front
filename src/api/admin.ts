// REQ-214 관리자 페이지 API (admin-service). 일반 로그인과 따로, 관리자 쿠키로 부른다
// 읽기가 아닌 요청에는 관리자 화면 머리글을 붙인다 (admin-service가 다른 사이트에서 온 요청을 막는 데 쓴다)

const BASE = '/api/admin';
const REQUEST_HEADER = { 'X-Requested-With': 'nineouting-admin' };

export class AdminApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function call<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(BASE + path, {
      method,
      credentials: 'same-origin',
      headers: {
        ...(method === 'GET' ? {} : REQUEST_HEADER),
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new AdminApiError('NETWORK_ERROR', '서버에 연결할 수 없습니다', 0);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new AdminApiError(data?.code ?? 'ERROR', data?.message ?? `요청이 실패했습니다 (${response.status})`, response.status);
  }
  return data as T;
}

export interface AdminSession {
  username: string;
  expiresAt: string;
}

export interface AdminDatabase {
  name: string;
  database: string;
}

export interface AdminTableSummary {
  name: string;
  estimatedRows: number;
}

export interface AdminColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  primaryKey: boolean;
  writable: boolean;
}

export interface AdminTable {
  name: string;
  columns: AdminColumn[];
  primaryKey: string[];
  readOnly: boolean;
  readOnlyReason: string | null;
}

export type AdminRow = Record<string, string | null>;

export interface AdminRowPage {
  rows: AdminRow[];
  total: number;
  page: number;
  size: number;
}

export interface AdminRowQuery {
  page: number;
  size: number;
  sort?: string;
  direction?: 'asc' | 'desc';
  column?: string;
  q?: string;
}

const tablePath = (db: string, table: string) =>
  `/databases/${encodeURIComponent(db)}/tables/${encodeURIComponent(table)}`;

export const adminApi = {
  session: () => call<AdminSession>('GET', '/session'),
  login: (username: string, password: string) => call<{ username: string }>('POST', '/session', { username, password }),
  logout: () => call<void>('DELETE', '/session'),
  databases: () => call<AdminDatabase[]>('GET', '/databases'),
  tables: (db: string) => call<AdminTableSummary[]>('GET', `/databases/${encodeURIComponent(db)}/tables`),
  table: (db: string, table: string) => call<AdminTable>('GET', tablePath(db, table)),
  rows: (db: string, table: string, query: AdminRowQuery) => {
    const params = new URLSearchParams({ page: String(query.page), size: String(query.size) });
    if (query.sort) params.set('sort', query.sort);
    if (query.direction) params.set('direction', query.direction);
    if (query.column) params.set('column', query.column);
    if (query.q) params.set('q', query.q);
    return call<AdminRowPage>('GET', `${tablePath(db, table)}/rows?${params}`);
  },
  insert: (db: string, table: string, values: AdminRow) => call<AdminRow>('POST', `${tablePath(db, table)}/rows`, { values }),
  update: (db: string, table: string, key: AdminRow, values: AdminRow) =>
    call<AdminRow>('PUT', `${tablePath(db, table)}/rows`, { key, values }),
  remove: (db: string, table: string, key: AdminRow) => call<AdminRow>('POST', `${tablePath(db, table)}/rows/delete`, { key }),
};
