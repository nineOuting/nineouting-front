/**
 * 올릴 수 있는 문서 형식 (2026-11-27 기획): PDF, Word, Excel, 텍스트(txt·md·csv).
 * 사전 자료 올리기와 양식 가져오기가 같이 쓴다. CSV는 표가 아니라 글로 읽는다
 */
export const DOCUMENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
};

/** 파일 고르기 창의 accept 값 */
export const DOCUMENT_ACCEPT = Object.keys(DOCUMENT_TYPES)
  .flatMap((extension) => [`.${extension}`, DOCUMENT_TYPES[extension]])
  .join(',');

/** 파일 이름 끝으로 형식을 정한다 (브라우저마다 docx·md·csv의 file.type이 비어 있을 수 있다). 받을 수 없으면 null */
export function documentType(file: File) {
  const extension = file.name.includes('.') ? (file.name.split('.').pop()?.toLowerCase() ?? '') : '';
  return DOCUMENT_TYPES[extension] ?? null;
}
