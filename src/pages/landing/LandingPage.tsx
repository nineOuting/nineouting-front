import styles from './LandingPage.module.css';

/**
 * 첫 화면(/) 넵넵 소개. 받은 랜딩 HTML(public/landing.html)을 그대로 띄운다.
 * 랜딩의 전역 CSS와 물리 엔진 스크립트가 앱과 섞이지 않도록 iframe 안에 둔다.
 * 랜딩의 [로그인], [무료로 체험하기]는 바깥 창 주소를 /login, /signup으로 바꾼다
 */
export default function LandingPage() {
  return <iframe className={styles.frame} src="/landing.html" title="넵넵 소개" />;
}
