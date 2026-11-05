# DEV 프론트 배포

- 대상 브랜치: `dev`
- 빌드: `npm ci` → `npm run build` (Node.js 22)
- 계정/리전: `443845329525` / `ap-northeast-2`
- S3: `nineouting-dev-frontend-443845329525`
- CloudFront: `E3RZL25K92AORQ`
- URL: https://dev.nepnep.app

PR은 AWS 인증 없이 빌드만 검증한다. dev 병합 또는 dev에서 수동 실행하면 OIDC로 DEV 전용 역할을 사용해 배포한다. 장기 AWS 키/PAT는 필요 없다.
동시 배포는 직렬화하고 최신 dev 커밋과 다른 실행은 업로드 전에 중단한다. assets를 먼저 올리고 index.html을 마지막에 교체한다. 이전 assets는 삭제하지 않아 캐시된 페이지를 보호한다.
캐시 갱신 완료 후 HTML/JS/CSS/SVG 응답과 로컬 빌드의 SHA-256을 비교한다.

배포 전 IAM 역할 `nineouting-dev-frontend-deploy`가 필요하다. 이 역할은 이 저장소 dev 브랜치에 한정되며, 해당 S3의 List/Put 및 해당 CloudFront 캐시 갱신/조회만 허용한다.
복구는 정상 dev 커밋을 revert PR로 되돌려 검토·병합하고 해당 빌드를 다시 배포한다. dev 외 브랜치의 수동 실행은 배포하지 않는다.

이 workflow는 화면 정적파일 배포만 담당한다. API/WebSocket 전달은 인프라 저장소의 DEV CloudFront 설정으로 관리한다. 로그인 등 기능 테스트는 포함하지 않는다.
