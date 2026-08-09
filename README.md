# 빌드 메이트 달팽이 🐌

코드로 그린 픽셀아트 데스크탑 달팽이. 화면 구석에 상주하며 내 **빌드·테스트·타입체크·dev 서버** 상태를 대신 지켜봐 줍니다. 터미널을 계속 쳐다보지 않아도, 달팽이 표정만 보면 지금 상태를 알 수 있어요. (Electron)

> FE 개발자용 데일리 메이트 + 컨퍼런스 안내를 겸합니다. 긴 빌드를 돌려놓고 딴짓하다 끝난 줄 모르는 순간, 달팽이가 화면 구석에서 결과를 알려줘요.

🎨 **커스텀하고 싶다면** → 기본 제공 셋(캐릭터 18종·말풍선 3종·폰트)의 포맷 스펙부터 앱 구조 맵·웹훅 API까지, 뜯어고치는 데 필요한 스펙은 [CUSTOMIZING.md](CUSTOMIZING.md)에 정리되어 있어요.

## 특징

- 🐌 **마름모 픽셀 애니메이션 달팽이** — [charactor/](charactor/)의 아트보드 JSON(페이지 = 프레임)을 그대로 재생. 네이밍 기반 감정 매핑(잠-숨/전진/갸웃/인사/신남/놀람/사랑/빼꼼/깸)
- 🔧 **빌드/테스트 메이트** — `vite build`·`vitest`·`tsc`·`eslint` 등의 시작/성공/실패에 반응
  - `npx feconf-2026 npm run build` / `npx feconf-2026 npm run dev` 로 감싸거나, **Vite 플러그인**으로 dev 루프 실시간 연동
- 💯 **Web Vitals 실시간 피드백** — dev 서버 페이지의 LCP·INP·CLS 를 재서, 기준 이내면 사랑 표정, 느려지면 갸웃
- 🪟 투명 · 항상 위 · 드래그 이동 가능한 창 (독/작업표시줄 숨김, 트레이 상주, 빈 영역은 클릭 통과)
- 💗 **마스코트 클릭 → 인사 + FECONF D-day 팝업** (컨퍼런스 안내는 트레이 메뉴에서)
- 🔔 **웹훅**으로 알림 수신 → SVG 말풍선(픽셀 폰트) + OS 알림 + 캐릭터 반응
- 🗓 **세션 스케줄**(shared/conference.js)에 맞춰 자동 알림
- 😴 유휴 시 자동으로 잠자기(숨결 z), 깨울 땐 깸 애니메이션으로 부스스 일어남
- 🔕 방해 금지(DND) 모드
- 📖 **사용 안내** — 처음 켤 때 좌우로 넘겨 보는 안내 카드 (다시 보지 않기 지원, 메뉴에서 언제든 다시)
- ⌨️ 전역 단축키: `Cmd/Ctrl+Shift+M`(숨김/표시), `Cmd/Ctrl+Shift+H`(인사)

## 상태(애니메이션)

캐릭터 프레임은 [charactor/](charactor/)의 `스네일-와이드-*.json` — 파일 네이밍이 곧 감정입니다.

| 상태       | 애니메이션    | 언제                                    |
| ---------- | ------------ | --------------------------------------- |
| `idle`     | 중립 + 바운스 | 평상시 (가끔 갸웃/빼꼼 랜덤 재생)          |
| `working`  | 갸웃-롱 루프  | **빌드/테스트 진행 중** · 반대 모서리 도착  |
| `happy`    | 신남-롱      | **빌드 성공** · 알림 직후                 |
| `notify`   | 놀람-롱      | **빌드 실패** · 알림 수신 (실패는 놀람 유지) |
| `walking`  | 전진 루프     | `/activity`(코딩) 이동 중                |
| `sleeping` | 잠-숨-롱     | 유휴 90초 (z 숨결)                       |
| `greet`    | 인사-롱      | 클릭 · 트레이 인사 · 첫 등장              |
| `love`     | 사랑-롱      | 일회성 감정 (웹훅/개발자 패널)             |
| `curious`  | 갸웃-롱      | idle 중 두리번                           |
| `peek`     | 빼꼼-롱      | idle 중 껍데기 숨기                       |
| `wake`     | 깸-롱        | 잠에서 깨어나는 전환                      |

## 실행

바로 띄워보기 — 클론 없이 한 줄로 실행됩니다. (Electron 바이너리를 내려받으므로 첫 실행은 1~2분 걸려요)

```bash
npx feconf-2026-mascot
```

아직 npm 에 올라가기 전이거나 최신 커밋을 바로 써보고 싶다면 GitHub 에서 직접 받아도 됩니다.

```bash
npx github:KimGaeun0806/feconf-character
```

**캐릭터·말풍선을 직접 뜯어고칠 거라면 클론을 권합니다.** 앱이 애셋과 설정을 프로젝트 폴더에서 읽기 때문에, 클론한 디렉터리가 그대로 작업 공간이 돼요.

```bash
git clone https://github.com/KimGaeun0806/feconf-character.git
cd feconf-character
npm install      # electron 설치
npm start        # 마스코트 실행
```

`charactor/` 의 JSON 을 고치고 앱을 다시 띄우면 바로 반영됩니다 → [CUSTOMIZING.md](CUSTOMIZING.md)

## 알림 보내기 (웹훅)

앱은 `http://127.0.0.1:7842` 에서 대기합니다.

```bash
# 알림 (제목/메시지/레벨)
curl -X POST localhost:7842/notify \
  -H 'Content-Type: application/json' \
  -d '{"title":"세션 시작","message":"메인홀 키노트가 시작됩니다","level":"success"}'

# 사용자 활동 → 작업중 상태
curl -X POST localhost:7842/activity -d '{"state":"working"}'

# 임의 상태 지정
curl -X POST localhost:7842/state -d '{"state":"happy","ttl":3000}'

# 상태 확인
curl localhost:7842/health
```

편의 스크립트:

```bash
node scripts/send.js notify "제목" "메시지" success
node scripts/send.js activity working
node scripts/send.js state sleeping
```

레벨: `info` · `success` · `warn` · `urgent`(흔들림 + 오래 표시)

## 🔧 빌드 메이트로 쓰기 (FE 개발 연동)

빌드/테스트/타입체크의 **시작 → 성공/실패**를 달팽이가 대신 지켜봐 줍니다.
빌드 시작 → 집중(`working`), 성공 → 기뻐함(`happy`), 실패 → 놀람(`notify`).
**앱이 꺼져 있으면 조용히 무시**되므로 빌드에 전혀 영향을 주지 않아요.

> **npm 에 `feconf-2026-mascot` 을 올린 뒤 기준**
>
> | 하고 싶은 일 | 명령 |
> | --- | --- |
> | 앱 실행 | `npx feconf-2026-mascot` |
> | 프로젝트에 설치 후 빌드/dev | `npm i -D feconf-2026-mascot` 한 다음 `npx feconf-2026 npm run build` · `npx feconf-2026 npm run dev` |
> | 전역 설치 후 | `npm i -g feconf-2026-mascot` 한 다음 `feconf-2026 npm run build` · `feconf-2026 npm run dev` |
>
> 앞에 붙는 `feconf-2026` 은 달팽이에게 알려 주는 **래퍼**입니다. 빼면 평소 `npm run build` 만 돌고 마스코트는 반응하지 않습니다.
> (`npx feconf-2026` 은 이 패키지를 dependency 또는 전역으로 설치한 뒤에 됩니다. 레지스트리 패키지 이름 자체는 `feconf-2026-mascot` 입니다.)

### 1) `feconf-2026` — 한 줄로 고르기 (권장)

```bash
npx feconf-2026 npm run build    # 빌드·테스트 → 성공/실패 반응
npx feconf-2026 npm run dev      # dev 서버 → Web Vitals 측정
npx feconf-2026 --watch vitest run
npx feconf-2026 --dev -- npm run start
```

스크립트 이름·내용이 `dev` / `start` / `serve` / `preview` 이면 성능 측정으로, 그 외(빌드·테스트·lint 등)는 감시로 보냅니다.

하위 명령이 그대로 남아 있어요 (`mascot-watch` · `mascot-dev` · `feconf`).

### 2) `mascot-watch` — 아무 명령이나 감싸기 (프레임워크 무관)

```bash
mascot-watch npm run build         # 빌드
mascot-watch -- vitest run         # 테스트
mascot-watch --label "타입체크" tsc --noEmit
```

- 명령의 출력·종료코드를 **그대로 통과**시켜요 (CI/기존 스크립트에 무해)
- `package.json` 스크립트에 그대로 넣어도 됩니다: `"build": "mascot-watch vite build"`

### 3) `mascot-dev` — dev 서버 감싸기 (프레임워크 무관, 설정 파일 안 건드림)

Next.js·webpack·CRA·Astro·정적 서버까지, **HTTP 로 HTML 을 내려주는 서버라면** 다 됩니다.
명령을 감싸 실행하고 그 앞에 얇은 프록시를 세워, 내려가는 HTML 에만 측정 스크립트를 끼워 넣어요.
포트는 명령·설정·환경변수에서 **알아서 잡습니다.** 평소 주소를 그대로 열면 됩니다.

```bash
npx feconf-2026 npm run dev
# 또는: npx mascot-dev npm run dev
```

프록시가 알아낸 포트(예: Vite 5173, Next 3000)를 **먼저 차지**하고, dev 서버는 자리가 없으니
옆 포트로 스스로 옮겨갑니다 (Vite·Next.js·CRA·Nuxt 모두 그렇게 동작해요). 브라우저는
평소와 똑같이 열면 되고, 프록시가 옮겨간 서버로 넘겨줍니다.

```
  🐌 http://localhost:5173 — 늘 열던 주소를 그대로 열면 됩니다
     (dev 서버는 옆 포트 5174 에서 돌고 있고, 프록시가 넘겨줍니다)
```

포트를 직접 정하거나, 자리를 비키지 않는 서버를 쓸 때만 옵션이 필요합니다.

```bash
mascot-dev --port 8080 -- npm run dev   # 포트 직접 지정
mascot-dev --sidecar -- npm run dev     # 옆 포트(7843)에 따로 세움
```

`app.listen(3000)` 처럼 포트가 고정돼 자리를 비켜주지 못하는 서버는 `--sidecar` 로 실행하고
**7843 을 열어야** 측정됩니다. 포트를 알아내지 못했을 때도 같은 방식으로 물러납니다.

- 프로젝트 파일을 **하나도 고치지 않아요.** 명령이 끝나면 프록시도 함께 사라집니다
- HMR 웹소켓도 그대로 통과시키므로 저장하면 평소처럼 갱신돼요
- HTML 은 **모아두지 않고 흘려보내면서** 스크립트만 끼웁니다. Next.js·Remix 처럼 HTML 을
  스트리밍하는 프레임워크에서도 첫 바이트가 늦어지지 않아요 (그러면 TTFB·FCP 가 왜곡됩니다)
- 압축된 HTML 이나 HTML 아닌 응답은 손대지 않고 그대로 통과시킵니다
- 자리를 비켜달라는 뜻으로 자식 프로세스에 `PORT` 를 넘깁니다. 이 값을 보는 서버는 곧장
  옆 포트로 가고, 보지 않는 서버는 원래 포트가 막힌 것을 알고 스스로 옮겨갑니다

### 4) Vite 플러그인 — dev 루프 실시간 연동

```js
// vite.config.js
import mascot from './integrations/vite-plugin-mascot.js';

export default {
  plugins: [mascot()], // { hmr: false } 로 저장 시 반응 끄기
};
```

- **dev 서버 준비됨** → `🚀 준비 완료` + 로컬 주소
- **파일 저장(HMR)** → 집중 → 잠시 뒤 `✅ 적용됨`
- **`vite build` 성공/실패** → `✅ 빌드 완료 · N.Ns` / `🚨 빌드 실패`
- **Web Vitals 실측** → 아래 참고

### 5) 💯 Web Vitals 실시간 피드백

`mascot-dev` 나 Vite 플러그인으로 띄운 페이지의 **실제 성능 지표**를 달팽이가 지켜봅니다.
새로고침할 때마다 브라우저가 잰 값을 받아, 기준을 넘겼는지 알려줘요.

| 결과                         | 달팽이           | 말풍선                             |
| ---------------------------- | ---------------- | ---------------------------------- |
| 전부 기준 이내               | 사랑(`love`)     | `💯 Web Vitals 완벽!` + 지표 요약   |
| 하나라도 애매                | 갸웃(`curious`)  | `🤔 조금 아쉬워요` + 가장 나쁜 지표 |
| 하나라도 기준 초과           | 갸웃(`curious`)  | `🐌 많이 느려졌어요` + 가장 나쁜 지표 |

재는 지표와 기준은 [web.dev 의 Core Web Vitals](https://web.dev/articles/vitals) 를 따릅니다.

| 지표   | 좋음     | 나쁨      | 의미                       |
| ------ | -------- | --------- | -------------------------- |
| `LCP`  | ≤ 2.5s   | > 4s      | 큰 콘텐츠가 다 그려지기까지 |
| `INP`  | ≤ 200ms  | > 500ms   | 상호작용 반응 (가장 느렸던 것) |
| `CLS`  | ≤ 0.1    | > 0.25    | 레이아웃이 흔들린 정도      |
| `FCP`  | ≤ 1.8s   | > 3s      | 첫 콘텐츠가 보이기까지      |
| `TTFB` | ≤ 800ms  | > 1.8s    | 서버 첫 바이트까지          |

- 라이브러리를 설치하지 않아요. `PerformanceObserver` 만 쓰는
  [integrations/vitals-client.js](integrations/vitals-client.js) 를 dev 서버에서만 끼워 넣습니다.
- **빌드 결과물에는 들어가지 않습니다.** `vite build` 산출물엔 흔적이 없어요.
- 저장할 때마다 잔소리하지 않도록, 평가가 그대로면 1분간 조용히 있습니다.
  시스템 알림도 띄우지 않고 말풍선으로만 알려줘요.
- 끄려면 `mascot({ vitals: false })` (Vite 플러그인) — `mascot-dev` 는 감싸지 않으면 됩니다.
- 브라우저 콘솔에서 `window.__mascotVitals` 로 잡힌 값과 보내는 주소를 볼 수 있어요.
- **LCP 는 화면에 보이는 탭에서만 기록됩니다.** 백그라운드 탭이나 headless 브라우저로는 값이 안 잡혀요.
- LCP 는 늦게 그려지는 이미지·폰트 때문에 한참 뒤에 확정돼서, **첫 보고는 로드 후 5초쯤 뒤에** 옵니다.
  그 뒤에 값이 나빠지면 곧바로 판정을 고쳐서 다시 알려줘요.
- **dev 서버 숫자는 배포 성능이 아닙니다.** 번들되지 않은 모듈·소스맵·HMR 때문에 실제보다 나쁘게 나와요.
  절대값을 믿기보다 "내가 방금 고친 게 더 느려졌나" 같은 상대 비교로 쓰는 게 맞습니다.

프록시도 플러그인도 싫다면, 페이지에 이 한 줄만 넣어도 됩니다.

```html
<script src="http://127.0.0.1:7842/vitals-client.js" defer></script>
```

값을 직접 보내는 것도 됩니다.

```bash
curl -X POST localhost:7842/vitals \
  -H 'Content-Type: application/json' \
  -d '{"url":"/checkout","metrics":{"LCP":5200,"CLS":0.31,"INP":620}}'
```

### 환경변수

| 변수             | 기본값      | 설명                                  |
| ---------------- | ----------- | ------------------------------------- |
| `MASCOT_PORT`    | `7842`      | 앱 웹훅 포트                          |
| `MASCOT_TOKEN`   | (없음)      | 앱에 `token` 설정 시 함께 지정        |
| `MASCOT_HOST`    | `127.0.0.1` | 앱 호스트                             |
| `MASCOT_DISABLE` | (없음)      | `1` 이면 전송 완전히 끔 (CI 등에서)   |

> 직접 연동도 간단해요 — 무엇이든 `POST localhost:7842/state {"state":"working"}` 로 집중,
> `POST /notify {"level":"success"}` 로 성공, `{"level":"urgent"}` 로 실패를 보내면 됩니다.
> 재사용 헬퍼는 [integrations/mascot-client.js](integrations/mascot-client.js) 참고.

## 🤖 Claude Code 연동 — 작업 끝나면 달팽이가 알려줌

[Claude Code](https://claude.com/claude-code)의 **훅**에 마스코트를 연결하면, Claude Code가 작업을 마치거나 확인을 기다릴 때 달팽이가 대신 알려줘요. (긴 작업 돌려놓고 딴짓하다 놓치는 걸 방지)

**설정 방법** — `~/.claude/settings.json`(전역) 또는 프로젝트의 `.claude/settings.json` 에 `hooks` 를 추가하세요. 이미 다른 설정이 있으면 **`hooks` 키만 병합**하면 됩니다.

```jsonc
{
  "hooks": {
    // 작업 완료 → 달팽이 팔짝 (초록 말풍선)
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST localhost:7842/notify -H 'Content-Type: application/json' -d '{\"title\":\"⭐️ 야호~작업 완료~🎵⭐️\",\"message\":\"Claude Code가 작업을 마쳤어요\",\"level\":\"success\"}' >/dev/null 2>&1 || true"
          }
        ]
      }
    ],
    // 권한/입력 대기 → 달팽이 놀람 (노란 말풍선)
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST localhost:7842/notify -H 'Content-Type: application/json' -d '{\"title\":\"확인이 필요해요\",\"message\":\"Claude Code가 입력을 기다리고 있어요\",\"level\":\"warn\"}' >/dev/null 2>&1 || true"
          }
        ]
      }
    ]
  }
}
```

- 앱이 꺼져 있으면 `|| true` 로 조용히 무시돼요 → **Claude Code 작업을 절대 막지 않아요.**
- 포트를 바꿨거나 토큰을 쓰면 URL·헤더를 맞춰주세요 (`-H "x-token: 토큰"`).
- 설정 후 바로 적용 안 되면 Claude Code에서 `/hooks` 를 한 번 열거나 재시작하세요. 훅 관리·삭제도 `/hooks` 에서 할 수 있어요.
- 다른 CLI·CI·스크립트도 똑같이 `POST /notify` 한 줄이면 연동됩니다.

## 타이핑/코딩에 반응시키기

에디터/터미널에서 활동이 감지될 때 `/activity`를 호출하면 됩니다. 예:

- **VS Code**: 확장/태스크에서 저장·타이핑 시 `curl localhost:7842/activity` 호출
- **Claude Code / CLI 훅**: 작업 시작 시 `node scripts/send.js activity working`, 완료 시 `notify`
- **git hook**: `pre-commit` 에서 `node scripts/send.js state happy`

## 메뉴 막대 메뉴

메뉴 막대의 FE 아이콘을 누르면 세 가지만 있습니다. 그 밖의 조작은 달팽이에게 직접 합니다.

| 메뉴             | 하는 일                          |
| ---------------- | -------------------------------- |
| 📋 컨퍼런스 안내 | 컨퍼런스 안내 열기/닫기          |
| 🔕 방해 금지 모드 | 말풍선과 OS 알림을 잠시 멈춤    |
| 📖 사용 안내     | 처음 켰을 때 뜨는 사용법 다시 보기 |
| ❌ 종료          | 앱 종료                          |

아이콘을 **왼쪽 클릭**하면 달팽이가 인사하고, 달팽이를 **우클릭**하면 개발자 미리보기가 열립니다.

## 사용 안내 — 처음 켤 때 뜨는 카드

처음 실행하면 무엇을 할 수 있는 앱인지 알려주는 카드가 화면 가운데에 뜹니다. 양옆 화살표(또는 ←/→ 키)로 넘기고, 아래 동그라미로 현재 페이지를 확인합니다.

- **다시 보지 않기**를 켜고 닫으면 다음 실행부터 저절로 뜨지 않습니다 (메뉴에는 그대로 남습니다)
- 켜둔 기록은 앱 폴더가 아니라 사용자 폴더(`~/Library/Application Support/feconf-2026-mascot/ui-state.json`)에 저장되므로, 설치 방식과 무관하게 유지됩니다
- 안내 문구는 [renderer/help.js](renderer/help.js) 의 `PAGES` 배열이라 페이지를 늘리거나 고치기 쉽습니다

## 컨퍼런스 안내 — 날짜별 3가지 상태

트레이 메뉴 → "📋 컨퍼런스 안내"로 여는 창은 **오늘 날짜와 행사 날짜([shared/conference.js](shared/conference.js)의 `startDate`~`endDate`)를 비교**해 자동으로 바뀝니다. (마스코트 클릭은 D-day 팝업)

| 상태             | 시점               | 내용                                             |
| ---------------- | ------------------ | ------------------------------------------------ |
| 🗓 **before**    | 행사 전            | D-day 카운트다운 · 날짜 · 장소 · 주소 · Discord   |
| 🎤 **dayof**     | 행사 당일          | 다음 세션 카운트다운 + 오늘의 세션 타임라인       |
| 🎉 **after**     | 행사 후            | 감사 인사 + **후기 남기기** 버튼 + Discord        |

**장소·날짜·시간을 포함한 컨퍼런스 정보는 [shared/conference.js](shared/conference.js) 한 파일에 모여 있습니다.**

```js
module.exports = {
  shortName: 'FECONF', // D-day 팝업 문구: "FECONF까지 D-62"
  startDate: '2026-10-10',
  endDate: '2026-10-10',
  venue: '코엑스 그랜드볼룸 (3층)',
  address: '서울 강남구 영동대로 513',
  discord: { url: 'https://discord.gg/...', note: '공지·네트워킹 채널' },
  reviewUrl: 'https://forms.gle/...',
  reviewNote: '1분이면 끝나요 🙌',
  sessions: [{ time: '13:00', leadMinutes: 5, title: '키노트', message: '곧 시작!', level: 'info' }],
};
```

**행사 날짜는 여기가 유일한 출처입니다.** `startDate` 한 줄만 고치면 D-day·컨퍼런스 안내·세션 알림 시각이 모두 따라옵니다. `shortName` 은 마스코트 클릭 시 뜨는 D-day 팝업 문구(`FECONF까지 D-62`)에 쓰입니다. 컨퍼런스 안내 헤더 문구는 행사 이름과 무관하게 `config.json` 의 `guideTitle` 로 정합니다.

`before`/`after`에서 Discord 카드와 후기 버튼을 누르면 기본 브라우저로 링크가 열립니다.

## 🛠 개발자 미리보기 (phase/시간 스크럽)

실제 날짜를 기다리지 않고 컨퍼런스 안내의 **행사 전/당일/이후** 상태와 **시간대별 세션 상태**를 바로 확인할 수 있어요.

**달팽이를 우클릭**하면 어두운 컨트롤 패널이 뜹니다:

- **Phase 세그먼트** — `자동`(날짜 기반) / `행사 전` / `당일` / `이후` 강제 전환
- **모의 시각** — 날짜·시간 직접 입력 또는 슬라이더로 하루를 스크럽
- **프리셋** — `3일 전` · `당일 09:00` · `첫 세션 직전` · `세션 진행 중` · `마지막 일정` · `다음날` 로 시간 점프
- **달팽이 상태** — 지속 상태(기본/작업/걷기/잠) 세그먼트 + 일회성 감정 칩(인사·신남·놀람·사랑·갸웃·빼꼼·깸)으로 애니메이션 즉시 확인
- **결과 readout** — 지금 적용된 phase와 시각 표시

바꾸는 즉시 컨퍼런스 안내가 그 시각 기준으로 다시 그려집니다. (시계·`N분 후` 카운트다운·`곧 시작`/`종료` 뱃지 모두 반영) 창을 닫으면 자동으로 실시간으로 복귀해요.

> 내부적으로 main 이 넘겨준 `now` 기준으로 렌더러가 시간을 흘려보내기 때문에(`simNow`), 모의 시각을 12:58로 맞추면 13:00 세션이 "곧 시작 → 종료"로 바뀌는 것까지 그대로 지켜볼 수 있어요.

## 스케줄 편집

[shared/conference.js](shared/conference.js) 의 `sessions` 에 세션을 넣으면 `leadMinutes` 전에 자동 알림이 뜹니다. **파일을 저장하면 앱이 알아서 다시 읽으므로** 껐다 켤 필요가 없습니다.

`time` 에는 **시:분만** 적습니다. 날짜는 같은 파일의 행사 날짜에서 물려받으므로, 행사가 미뤄져도 세션은 손대지 않아도 됩니다.

```js
{ time: '14:30', leadMinutes: 10, title: 'AI 세션', message: '곧 시작!', level: 'success' }
```

| 필드 | 뜻 |
| --- | --- |
| `time` | 세션 시작 시각 `"14:30"`. 전체 날짜(`"2026-10-10T14:30:00"`)를 적으면 그 날짜를 그대로 씁니다 |
| `day` | 여러 날 행사에서 며칠째인지 (생략하면 1일차) |
| `leadMinutes` | 몇 분 전에 알릴지 (생략하면 5분) |

이미 지난 세션은 예약하지 않습니다.

## 설정 (선택)

`config.json` 을 만들면 기본값을 덮어씁니다.

```json
{
  "port": 7842,
  "token": "비밀토큰",
  "corner": "bottom-right",
  "idleSleepMs": 90000,
  "guideTitle": "우리 컨퍼런스 2026",
  "guideSubtitle": "오늘의 세션"
}
```

컨퍼런스 안내 헤더 제목/부제는 `guideTitle` · `guideSubtitle` 로 바꿀 수 있어요.

`token` 을 넣으면 웹훅 요청에 `x-token` 헤더(또는 `?token=`)가 필요합니다.

## 크레딧

- 말풍선 텍스트 폰트: **Mona (MonaS12)** by [Monad ABXY](https://github.com/MonadABXY/mona-font) — SIL Open Font License 1.1 ([라이선스](renderer/fonts/MonaS-OFL-LICENSE.txt), 앱에 번들)
