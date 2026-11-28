/**
 * 베타 테스트 행동 기록 (넵넵 베타 테스트 설계서 5장 G 이벤트).
 * 이벤트는 값 없이 이름만 GTM dataLayer로 보낸다. 이름은 모두 nn_로 시작해서 GTM에서 한 번에 거른다.
 * 버튼은 data-gtm="이벤트이름"을 붙이면 아래 클릭 수집이 보낸다. 버튼이 아닌 행동(엔터 전송, 스크롤, 화면 열람)은 track()을 직접 부른다.
 * 회의 내용, 사용자 정보는 싣지 않는다.
 */

type DataLayerWindow = Window & { dataLayer?: Record<string, unknown>[] };

export function track(name: string) {
  const w = window as DataLayerWindow;
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push({ event: name });
}

/** 앱 전체 클릭에서 가장 가까운 data-gtm 요소를 찾아 보낸다 (버튼 안 아이콘을 눌러도 잡힌다). 막힌 버튼은 클릭이 오지 않는다 */
export function installClickTracking() {
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target instanceof Element ? event.target.closest('[data-gtm]') : null;
      const name = target?.getAttribute('data-gtm');
      if (name) {
        track(name);
      }
    },
    { capture: true },
  );
}
