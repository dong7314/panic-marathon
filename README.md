# Panic Marathon

2~6명의 플레이어가 함정이 있는 픽셀 트랙을 달리며 총과 랜덤 스킬로 서로 방해하는 탑다운 멀티플레이 레이싱 게임입니다.

## 실행

```bash
npm install
npm run dev
```

- 게임: <http://127.0.0.1:5174>
- Socket.IO 서버: `http://127.0.0.1:5175`
- 개발 서버 주소 재정의: `VITE_MULTIPLAYER_URL`

타이틀 화면에서 방을 생성한 뒤 다른 브라우저나 시크릿 창에서 초대 코드로 참가할 수 있습니다.

- `test`: 최대 6명이 바로 입장하는 공유 멀티플레이 테스트 방
- `test-skill`: 네트워크 없이 7개 스킬을 확인하는 로컬 연습장

## 현재 구현

- 방 생성·참가·방장 시작·퇴장·재대결과 자동 방장 위임
- 경기 시작과 재대결 전에 모든 참가자에게 동기화되는 `3 → 2 → 1 → START` 카운트다운
- 2~6인, 1~999랩, 최소 3개 이상의 활성 스킬 설정
- 체크포인트 3개와 시작선을 순서대로 통과하는 서버 판정 레이스
- 서버 판정 기본 총, 라이프·탄창, 최초 완주자와 전체 최종 순위 결정
- 밀치기·돌진·질주·그랩·분신·슬로우탄·수면총
- 회전봉·랜덤 구덩이·역방향 점프대와 원격 상태 애니메이션
- 낙하·체공·그랩·밀치기·수면 상태의 공통 서버 우선순위와 행동 잠금
- 원격 플레이어 보간, 레이스 현황판, 스킬·쿨타임·상태 표시
- 경기 결과 화면, 1시간 제한 시점의 진행도 순위, 같은 방 방장 재대결
- 고정 플레이어 ID와 재접속 토큰, 연결 종료 후 30초 경기 상태 보존과 방장 권한 복구
- 단일 Node 프로세스의 정적 빌드·Socket.IO 제공, 상태 확인과 정상 종료

상세 규칙과 남은 작업은 [plan.md](./plan.md)를 기준으로 관리합니다.

## 조작

| 입력 | 동작 |
| --- | --- |
| `WASD` 또는 방향키 | 이동 |
| 마우스 | 조준 |
| 좌클릭 | 기본 총 |
| 우클릭 | 현재 보유 스킬 |
| `Esc` | 메인 화면으로 복귀 |

`test-skill` 연습장에서는 숫자 키 `1`~`7`로 스킬을 직접 선택하고 `R`로 무작위 스킬을 사용할 수 있습니다.

## 구조

```text
src/main.ts                 Canvas 렌더링, 입력, 화면·네트워크 연결
src/game/types.ts           클라이언트 게임·네트워크 타입
src/game/network-session.ts 재접속 세션 저장과 배포 서버 주소 선택
src/game/match-countdown.ts 서버 기준 경기 시작 카운트다운
server/index.mjs            Socket.IO 방, 전투, 레이스·함정 판정
server/config.mjs           실행 환경과 배포 설정
server/http-handler.mjs     정적 SPA, health/readiness 응답
server/player-session.mjs   고정 ID·재접속 토큰·방장 선택
shared/game-rules.mjs       클라이언트·서버 공통 규칙과 맵 데이터
shared/geometry.mjs         공통 트랙·충돌 계산
shared/movement-validation.mjs  서버 이동 검증
shared/player-state.mjs     공통 상태 우선순위·행동 허용·전환 규칙
test/                       Node 내장 테스트
```

방과 플레이어 상태는 현재 서버 메모리에만 저장되므로 서버를 재시작하면 초기화되며, 재접속 세션도 함께 만료됩니다.

## 프로덕션 실행

```bash
npm run serve
```

`npm run serve`는 Vite 빌드를 생성한 뒤 Node 서버 하나에서 빌드 결과와 Socket.IO를 함께 제공합니다. 기본 주소는 <http://127.0.0.1:5175>이며, 프로덕션 클라이언트는 별도 설정이 없으면 현재 페이지와 같은 출처에 연결합니다.

| 환경 변수 | 기본값 | 용도 |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | Node 서버 바인딩 주소 |
| `PORT` | `5175` | HTTP·Socket.IO 공용 포트 |
| `STATIC_DIR` | `dist` | 정적 빌드 디렉터리 |
| `CLIENT_ORIGIN(S)` | 모든 출처 | 필요할 때 CORS 허용 출처를 쉼표로 제한 |

- `GET /healthz`: 방·플레이어·소켓 연결 수와 경기 단계 확인
- `GET /readyz`: 정적 빌드가 준비됐는지 확인

## 검증

```bash
npm run check
npm test
npm run build
npm run check:server
```

전체 검증은 `npm run verify`로 한 번에 실행할 수 있습니다.

- `npm run test:load`: 2·4·6인 방을 동시에 실행하는 지속 위치 패킷 부하 검증
- `npm run test:deployment`: 정적 SPA·상태 확인·Socket.IO·정상 종료 검증
