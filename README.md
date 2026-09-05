# feconf-26-mascot

화면 구석에 상주하는 픽셀아트 달팽이입니다.  
**빌드·테스트·타입체크·dev 서버** 상태를 표정과 말풍선으로 알려 주고, FECONF 일정 안내도 겸하는 Electron 데스크탑 앱입니다.

앱이 꺼져 있으면 CLI·웹훅 연동은 조용히 무시합니다. 빌드나 Claude Code 작업을 막지 않습니다.

커스터마이징·웹훅·애셋 스펙 → [CUSTOMIZING.md](CUSTOMIZING.md) · 구성 요약 → [OVERVIEW.md](OVERVIEW.md)

---

## 특징

- 픽셀 마름모 달팽이 — `character/snail-wide-*.json` (파일명이 곧 감정 API)
- 빌드/테스트 메이트 — `feconf-2026` / `mascot-watch` 로 아무 명령이나 감싸기
- Web Vitals 피드백 — `feconf-2026 npm run dev` 또는 Vite 플러그인으로 LCP·INP·CLS 반응
- 투명 · 항상 위 · 드래그 · 트레이 상주 · 빈 영역 클릭 통과
- 클릭 → 인사 + D-day · 트레이 → 컨퍼런스 안내 · 사용 안내 · 방해 금지
- 웹훅 `http://127.0.0.1:7842` — 알림 · 상태 · 활동 · vitals
- 세션 스케줄 자동 알림 — [shared/conference.js](shared/conference.js)
- 유휴 시 잠자기 · 전역 단축키 `⌘⇧M` / `⌘⇧H` (Windows·Linux는 `Ctrl+Shift+…`)

---

## 바로 실행

Node.js 18+ · 첫 실행 시 Electron을 받아 1~2분 걸릴 수 있습니다.

```bash
npx feconf-26-mascot
```

패키지 소스가 있는 폴더 안에서는 로컬 이름과 겹칠 수 있습니다.  
`npx`로 받을 때는 **다른 디렉터리**에서 실행하세요.

클론 후 로컬에서 수정할 때:

```bash
git clone https://github.com/KimGaeun0806/feconf-character.git
cd feconf-character
npm install
npm start
```

---

## 프로젝트에 연결 (빌드 · 성능)

```bash
npm i -D feconf-26-mascot
```

마스코트를 켠 뒤:

```bash
npx feconf-2026 npm run build   # 빌드/테스트 → 시작·성공·실패 반응
npx feconf-2026 npm run dev     # dev 서버 → Web Vitals 피드백
```

| 하고 싶은 일 | 명령 |
| --- | --- |
| 앱만 실행 | `npx feconf-26-mascot` |
| 빌드·테스트 반응 | `npx feconf-2026 npm run build` |
| 성능 피드백 | `npx feconf-2026 npm run dev` |
| 전역 설치 후 | `npm i -g feconf-26-mascot` → `feconf-2026 …` |

동작 규칙:

- 스크립트 이름이 `dev` / `start` / `serve` / `preview` 계열이면 **성능 측정**
- 그 외(`build`, `test`, `lint` …)는 **빌드 감시**
- 강제: `npx feconf-2026 --watch <명령>` · `npx feconf-2026 --dev <명령>`

하위 CLI: `mascot-watch` · `mascot-dev` · `feconf`

### `mascot-watch` — 아무 명령이나 감싸기

```bash
npx mascot-watch npm run build
npx mascot-watch -- vitest run
npx mascot-watch --label "타입체크" tsc --noEmit
```

출력·종료 코드는 그대로 통과합니다. `"build": "mascot-watch vite build"` 처럼 스크립트에 넣어도 됩니다.

### `mascot-dev` — dev 서버 + Web Vitals

프로젝트 파일을 건드리지 않고, HTML에만 측정 스크립트를 끼웁니다.

```bash
npx feconf-2026 npm run dev
# 또는
npx mascot-dev npm run dev
npx mascot-dev --port 5173 -- npm run dev   # 포트 직접 지정
npx mascot-dev --sidecar -- npm run dev     # 옆 포트(7843)에 프록시
```

기준은 [web.dev Core Web Vitals](https://web.dev/articles/vitals)를 따릅니다. 전부 기준 이내면 사랑(`love`), 넘기면 갸웃(`curious`).

### Vite 플러그인

클론한 레포 또는 패키지 안의 플러그인을 쓸 수 있습니다.

```js
// vite.config.js (클론한 레포 기준)
import mascot from './integrations/vite-plugin-mascot.js';

export default {
  plugins: [mascot()], // { hmr: false } · { vitals: false } 가능
};
```

npm으로 설치했다면:

```js
import mascot from 'feconf-26-mascot/integrations/vite-plugin-mascot.js';
```

- dev 준비됨 / HMR 저장 / `vite build` 성공·실패에 반응
- Web Vitals 실측 (끄려면 `vitals: false`)

### 환경변수

| 변수 | 기본값 | 설명 |
| --- | --- | --- |
| `MASCOT_PORT` | `7842` | 앱 웹훅 포트 |
| `MASCOT_HOST` | `127.0.0.1` | 앱 호스트 |
| `MASCOT_TOKEN` | (없음) | 앱에 `token` 설정 시 함께 지정 |
| `MASCOT_DISABLE` | (없음) | `1`이면 전송 끔 (CI 등) |

---

## 웹훅

앱은 `http://127.0.0.1:7842`에서 대기합니다.

```bash
curl -X POST localhost:7842/notify \
  -H 'Content-Type: application/json' \
  -d '{"title":"세션 시작","message":"키노트가 곧 시작됩니다","level":"success"}'

curl -X POST localhost:7842/activity -d '{"state":"working"}'
curl -X POST localhost:7842/state -d '{"state":"happy","ttl":3000}'
curl localhost:7842/health
```

| 경로 | 용도 |
| --- | --- |
| `POST /notify` | 말풍선 + OS 알림 + 표정 (`level`: `info`·`success`·`warn`·`urgent`) |
| `POST /activity` | 코딩 활동 → 걷기/집중 |
| `POST /state` | 임의 상태 (`greet`·`happy`·`notify`·`love` …) |
| `POST /vitals` | Core Web Vitals 판정 |
| `GET /vitals-client.js` | 브라우저 측정 스크립트 |
| `GET /health` | 상태 확인 |

편의 스크립트 (클론 후):

```bash
node scripts/send.js notify "제목" "메시지" success
node scripts/send.js activity working
node scripts/send.js state sleeping
```

---

## Claude Code 연동

[Claude Code](https://claude.com/claude-code) 훅에 연결하면 작업 완료·입력 대기 때 달팽이가 알려 줍니다.

`~/.claude/settings.json`(전역) 또는 프로젝트 `.claude/settings.json`에 `hooks`만 병합하세요.

```jsonc
{
  "hooks": {
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

- 앱이 꺼져 있으면 `|| true`로 무시 → Claude Code를 막지 않습니다
- 포트·토큰을 바꿨으면 URL/`x-token`을 맞추세요
- 적용이 안 되면 Claude Code에서 `/hooks`를 열거나 재시작하세요

다른 CLI·CI·git hook도 똑같이 `POST /notify` 한 줄이면 됩니다.

---

## 앱 UI · 단축키

| 조작 | 동작 |
| --- | --- |
| 클릭 | 인사 + 한마디 |
| 두 번 클릭 | D-day 팝업 |
| 드래그 | 위치 이동 |
| 트레이 | 컨퍼런스 안내 · 방해 금지 · 사용 안내 · 종료 |
| `⌘⇧M` / `Ctrl+Shift+M` | 숨김 / 표시 |
| `⌘⇧H` / `Ctrl+Shift+H` | 인사 |

### 컨퍼런스 안내

트레이 → **컨퍼런스 안내**. 날짜에 따라 자동 전환됩니다.

| 상태 | 시점 | 내용 |
| --- | --- | --- |
| before | 행사 전 | D-day · 날짜 · 장소 · Discord |
| dayof | 당일 | 다음 세션 카운트다운 + 타임라인 |
| after | 행사 후 | 감사 + 후기 링크 + Discord |

행사·세션은 [shared/conference.js](shared/conference.js) 한곳에서 수정합니다. `time`에는 시:분만 적고, 날짜는 `startDate`를 따릅니다.

### 상태(애니메이션)

| 상태 | 애니 파일 (`snail-wide-` 생략) | 언제 |
| --- | --- | --- |
| `idle` | curious-long | 평상시 |
| `working` | curious-long | 빌드/테스트 중 |
| `happy` | happy-long | 빌드 성공 |
| `notify` | surprise-long | 빌드 실패 · 알림 |
| `walking` | walk-long | `/activity` 이동 |
| `sleeping` | sleep-long | 유휴 |
| `greet` / `love` / `curious` / `peek` / `wake` | 각 `*-long` | 클릭·웹훅·랜덤 등 |

---

## 커스터마이징

`npx` / `npm i`만으로는 애셋이 프로젝트 폴더에 복사되지 않습니다. 캐릭터·UI를 수정하려면 저장소를 클론하세요.

- 애셋: `character/` — `snail-wide-*.json`, `bubble-*.json`
- 규칙: `snail-wide-<emotion>[-long].json`
- 포맷·웹훅·구조: [CUSTOMIZING.md](CUSTOMIZING.md)

선택: 프로젝트 루트에 `config.json`을 두면 기본값을 덮어씁니다.

```json
{
  "port": 7842,
  "token": "",
  "corner": "bottom-right",
  "idleSleepMs": 90000,
  "guideTitle": "컨퍼런스 안내",
  "guideSubtitle": "오늘의 세션"
}
```

---

## 요구 사항 · 참고

- Node.js **≥ 18**
- macOS에서 주로 검증 (Electron)
- 웹훅 기본 포트 **7842**
- CI에서는 `MASCOT_DISABLE=1` 권장

---

## 라이선스

MIT  
말풍선 픽셀 폰트: **Mona (MonaS12)** by [Monad ABXY](https://github.com/MonadABXY/mona-font) — SIL OFL 1.1
