import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { track } from '../../utils/track';
import styles from './LandingPage.module.css';

/** 랜딩(iframe)이 보내는 버튼 알림. 같은 출처에서 온 것만 받는다 */
type LandingMessage = { type: 'nepnep-landing'; path: string; event: string };

const isLandingMessage = (data: unknown): data is LandingMessage =>
  typeof data === 'object' && data !== null && (data as LandingMessage).type === 'nepnep-landing'
  && typeof (data as LandingMessage).path === 'string' && (data as LandingMessage).path.startsWith('/')
  && typeof (data as LandingMessage).event === 'string' && (data as LandingMessage).event.startsWith('nn_landing_');

/**
 * 첫 화면(/) 넵넵 소개. 받은 랜딩 HTML(public/landing.html)을 그대로 띄운다.
 * 랜딩의 전역 CSS와 물리 엔진 스크립트가 앱과 섞이지 않도록 iframe 안에 둔다.
 * 랜딩의 [로그인], [무료로 체험하기]는 이 창에 알리고, 여기서 클릭 이벤트를 기록한 뒤 로그인 화면으로 간다 (베타 테스트 G1)
 */
export default function LandingPage() {
  const navigate = useNavigate();

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || !isLandingMessage(event.data)) {
        return;
      }
      track(event.data.event);
      navigate(event.data.path);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [navigate]);

  return <iframe className={styles.frame} src="/landing.html" title="넵넵 소개" />;
}
