# 커스텀 가이드 — 기본 제공 셋 스펙 🎨

이 문서는 달팽이를 마음껏 뜯어고치고 싶은 분을 위한 **기본 제공 셋의 스펙 설명서**입니다.
커스텀 대상은 **아트(캐릭터·말풍선)만이 아니라 일렉트론 앱 전체**입니다 — 창 동작, 상태 머신, 웹훅, 컨퍼런스 안내, 트레이까지 전부 열려 있어요. 실행·연동 방법은 [README.md](README.md)를 보세요.

## 기본 제공 셋 한눈에 보기

| 구성 | 내용 | 위치 |
| --- | --- | --- |
| 캐릭터 애니메이션 | 스네일(달팽이) 1종 × 감정 9종 × short/long 2버전 = **JSON 18개** | [character/](character/) `snail-wide-*.json` |
| 미리보기 | 각 애니메이션의 첫 프레임 SVG (앱은 사용 안 함, 눈으로 고를 때용) | [character/](character/) `*-preview.svg` |
| 말풍선 | JSON 픽셀 말풍선 3종(comic/purple/cozy) + 기본 SVG 생각풍선(classic) | [character/](character/) `bubble-*.json` |
| 폰트 | MonaS12(픽셀, 기본) · Pretendard | [renderer/fonts/](renderer/fonts/) |
| 컨퍼런스 정보 | 행사 이름·날짜·장소·링크 + 세션 목록 | [shared/conference.js](shared/conference.js) |
| 시간 상수 | 잠들기·말풍선 유지·산책 간격 등 "얼마나 기다리는가" 전부 | [shared/time.js](shared/time.js) |
| 앱 본체 | 창/트레이/상태 머신/웹훅 서버 (main) + 렌더링 (renderer) | [main.js](main.js) · [renderer/](renderer/) |

모든 아트는 **마름모 아트보드 JSON** 하나의 포맷을 씁니다. 그림 파일이 아니라 색상 그리드라서,
손으로 고쳐도 되고 스크립트로 생성해도 됩니다.

## 앱 구조 맵 — 어디를 고치면 뭐가 바뀌나

| 파일 | 역할 | 이런 커스텀은 여기 |
| --- | --- | --- |
| [main.js](main.js) | 창·트레이·단축키·상태 머신·스케줄러 (오케스트레이션) | 창 크기/위치, 잠들기 시간, 트레이 메뉴, 새 상태 규칙 |
| [lib/](lib/) | `config` · `anims` · `vitals` · `webhook-server` | 설정 기본값, 애셋 로드, Web Vitals 판정, 웹훅 라우팅 |
| [preload.js](preload.js) | main ↔ renderer IPC 브릿지 | renderer에 새 기능 노출할 때 |
| [renderer/mascot.js](renderer/mascot.js) | 캐릭터·말풍선 렌더링, `ANIM`/`BUBBLE_STYLES` 레지스트리 | 애니메이션 fps/매핑, 말풍선 스타일, 바운스 같은 코드 연출 |
| [renderer/style.css](renderer/style.css) | 마스코트 창 스타일 (레벨 색, 흔들림, 폰트) | 말풍선 텍스트 색, urgent 연출, 새 스타일 테마 |
| [renderer/guide.html](renderer/guide.html) / [guide.js](renderer/guide.js) / [guide.css](renderer/guide.css) | 컨퍼런스 안내 (before/dayof/after 3상태) | 스킨, 새 카드/섹션 |
| [renderer/help.html](renderer/help.html) / [help.js](renderer/help.js) / [help.css](renderer/help.css) | 사용 안내 (좌우로 넘기는 카드) | 안내 문구·페이지 추가 (`help.js` 의 `PAGES`) |
| [integrations/](integrations/) | feconf · mascot-watch · mascot-dev CLI · Vite 플러그인 · 재사용 클라이언트 | 다른 툴 연동 (webpack, git hook, CI…) |
| [scripts/send.js](scripts/send.js) | 웹훅 CLI 헬퍼 | – |
| [shared/conference.js](shared/conference.js) | 행사 이름·날짜·장소·링크 + 세션 목록 (main 만 읽고 렌더러엔 IPC 로 전달) | 행사 정보, 세션 추가/수정 |
| [shared/time.js](shared/time.js) | 시간 상수와 날짜 헬퍼 — main 과 렌더러가 같은 값을 본다 | 잠들기·말풍선·딴짓·산책 타이밍, 프레임 상한 |

### 창/동작 스펙 (main.js 기본값)

- 마스코트 창 **315×260**, 투명 · 항상 위 · 프레임 없음 · 독/작업표시줄 숨김 · 전체화면 위에도 표시. 빈 영역은 **클릭 통과**(캐릭터/말풍선 위에서만 마우스 활성).
- 위치는 `corner` 설정(`bottom-right` 기본, 4모서리) + 걷기 시 반대 모서리로 왕복.
- 유휴 `idleSleepMs`(기본 90초) 경과 시 잠들기. 전역 단축키 `Cmd/Ctrl+Shift+M`(숨김/표시), `Cmd/Ctrl+Shift+H`(인사).
- 이 값들은 `config.json`으로 덮어쓸 수 있어요 (README "설정" 참고).

### 시간·날짜는 한 곳에서만 정한다

숫자가 여러 파일에 흩어지면 하나만 고쳤을 때 조용히 어긋나기 때문에, 출처를 나눠두었습니다.

| 무엇 | 어디 |
| --- | --- |
| 행사 날짜·장소 | [shared/conference.js](shared/conference.js) 의 `startDate`·`endDate`·`venue` — D-day, 컨퍼런스 안내, 세션 알림 시각이 모두 여기서 나온다 |
| 세션 시각 | 같은 파일의 `sessions` 에 **시:분만** 적고 날짜는 행사 날짜에서 물려받는다 |
| 기다리는 시간 | [shared/time.js](shared/time.js) — 잠들기, 말풍선 유지, 딴짓 간격, 프레임 상한, Web Vitals 억제 간격 등 |

`shared/time.js` 는 `require` 와 `<script>` 양쪽으로 읽히도록 만들어져 있어서, main 프로세스와 렌더러가 같은 값을 봅니다. 렌더러에서는 전역 `TIME` 으로 쓰세요.

```js
setTimeout(hideBubble, TIME.BUBBLE_MS); // 6.5초
```

날짜 비교는 `TIME.startOfDay` · `TIME.daysUntil` 을 쓰면 시:분 때문에 D-day 가 하루 틀어지는 일이 없습니다.

### 웹훅 API 스펙 (`http://127.0.0.1:7842`)

| 메서드/경로 | 바디 | 동작 |
| --- | --- | --- |
| `POST /notify` | `{title, message, level, reaction}` | 말풍선 + OS 알림 + 캐릭터 반응. level: `info`·`success`·`warn`·`urgent`(흔들림+오래 표시). `reaction`으로 반응 표정 직접 지정 (`love`·`curious` 등) |
| `POST /activity` | `{state}` | 사용자 활동 신호 → 작업중/걷기 |
| `POST /state` | `{state, ttl}` | 임의 상태 강제 (ttl ms 후 복귀) — **`ANIM`에 등록한 커스텀 상태도 이걸로 트리거** |
| `POST /vitals` | `{url, metrics:{LCP, INP, CLS, FCP, TTFB}}` | Core Web Vitals 판정 → 기준 이내면 사랑, 넘기면 갸웃. 임계값은 [lib/vitals.js](lib/vitals.js) |
| `GET /health` | – | 상태 확인 |

`config.json`에 `token`을 넣으면 `x-token` 헤더 필요. 새 엔드포인트는 [lib/webhook-server.js](lib/webhook-server.js) 라우팅에 추가하면 됩니다.

## 마름모 아트보드 JSON 포맷

```jsonc
{
  "version": 1,
  "active": 0,            // 에디터용 — 앱은 무시
  "pages": [              // 페이지 1장 = 애니메이션 프레임 1장
    {
      "name": "인사 1",
      "cfg": {
        "cols": 36,       // 그리드 가로 칸 수
        "rows": 22,       // 그리드 세로 칸 수
        "cell": 32,       // 원본 셀 크기(px) — radius/overlap의 기준 단위
        "angleDeg": -20,  // 스큐 각도. 위로 갈수록 오른쪽으로 기움
        "line": 0,        // (미사용)
        "merge": true,    // 같은 색 연속 칸 캡슐 병합
        "radius": 9,      // 블록 모서리 라운드 (cell 기준 px)
        "overlap": 2      // 블록끼리 살짝 겹치는 양 — 이음새 제거용
      },
      "grid": [           // rows × cols 2차원 배열
        [null, null, "#0f5bdd", ...]   // hex 색상 = 픽셀, null = 빈 칸
      ]
    }
  ]
}
```

### 렌더링 규칙 (renderer/mascot.js `buildFrame`)

1. **셀 1칸 = 기울어진(-20°) 둥근 마름모 블록.** 위로 갈수록 오른쪽으로 밀리는 스큐가 걸립니다.
2. **가로로 같은 색이 이어지면 캡슐 하나로 병합**해서 그립니다. 외따로 있는 1칸짜리는 세로 방향으로 다시 병합을 시도합니다(더듬이 줄기 같은 세로선용).
3. Zzz·하트·`!` 같은 **이펙트도 별도 레이어가 아니라 프레임 그리드 안의 픽셀**입니다.
4. 캐릭터의 표시 크기/위치는 **전체 프레임의 점유 영역(bbox)을 재서 자동 매핑**됩니다. 모든 상태가 같은 매핑을 공유하므로, **프레임끼리 그리드 크기(36×22)와 몸통 위치를 맞춰야** 상태 전환 시 캐릭터가 튀지 않습니다.

## 캐릭터: 파일 네이밍이 곧 API

앱은 시작 시 `character/*.json`을 읽고, **`snail-wide-<emotion>[-long].json` 이름으로 찾아 씁니다.**
같은 이름으로 파일만 갈아끼우면 **코드 수정 0줄로 캐릭터가 바뀝니다.** (프리픽스 `snail-wide-`는 renderer/mascot.js의 `FILE_PREFIX`)

앱이 실제 재생하는 파일과 스펙:

| 상태 | 파일 (`snail-wide-` 생략) | 프레임 | fps | loop | 트리거 |
| --- | --- | --- | --- | --- | --- |
| `idle` | curious-long | 1프레임만 사용 | – | – | 평상시 (중립 포즈 + 코드 바운스) |
| `working` | curious-long | 14 | 6 | ✅ | 빌드/테스트 진행 중 |
| `happy` | happy-long | 14 | 9 | ✅ | 빌드 성공 |
| `notify` | surprise-long | 12 | 8 | ✅ | 빌드 실패 · 알림 수신 |
| `walking` | walk-long | 8 | 10 | ✅ | 코딩 활동 이동 중 |
| `sleeping` | sleep-long | 12 | 4 | ✅ | 유휴 90초 |
| `greet` | greet-long | 12 | 8 | 1회 | 클릭 · 첫 등장 |
| `love` | love-long | 12 | 8 | 1회 | 웹훅 |
| `curious` | curious-long | 14 | 8 | 1회 | idle 중 랜덤 |
| `peek` | peek-long | 23 | 7 | 1회 | idle 중 랜덤 |
| `wake` | wake-long | 18 | 8 | 1회 | 잠 → 깨어남 |

- short 버전(`-long` 없는 파일)은 프레임 절반짜리 축약판 — 현재 앱은 long 위주로 재생합니다. 상태별 파일/fps는 renderer/mascot.js 상단 `ANIM` 레지스트리에서 바꿉니다.
- 모든 캐릭터 프레임 공통 cfg: **36×22 그리드, cell 32, angle -20°, radius 9, overlap 2.** 새로 그릴 때 이 값을 유지하는 게 안전합니다.
- ⚠️ **파일명 오타 = 그 상태만 조용히 미표시** — `node scripts/send.js state happy` 등으로 확인하세요.

## 말풍선: 3종 + 가로 스트레치

말풍선 JSON도 같은 포맷이며 **1페이지(정적)**입니다. 텍스트가 길어지면 이미지를 늘리는 게 아니라, **지정한 중앙 컬럼을 그리드 규칙대로 복제**해서 픽셀이 깨지지 않게 넓힙니다 (최대 300px).

renderer/mascot.js의 `BUBBLE_STYLES` 스펙:

| 스타일 | 파일 | 그리드 | baseW | cellCss | insL / insR | padL / padR |
| --- | --- | --- | --- | --- | --- | --- |
| `classic` | (SVG 내장, 고정 크기) | – | – | – | – | – |
| `comic` | bubble-comic | 30×12 | 208 | 6.05 | 6 / 20 | 32 / 24 |
| `purple` | bubble-purple | 24×7 | 196 | 7.38 | 6 / 16 | 26 / 18 |
| `cozy` | bubble-cozy | 32×12 | 212 | 5.83 | 9 / 24 | 28 / 18 |

- `baseW`: 스트레치 0일 때 표시 폭(px) · `cellCss`: 셀 1칸의 CSS px
- `insL`/`insR`: 복제 삽입 지점 컬럼 인덱스 — **꼬리 양옆의 "세로로 균일한" 컬럼**을 골라야 늘려도 티가 안 납니다
- `padL`/`padR`: 텍스트 여백(px) — 모서리·꼬리 캡 폭에 맞춤

**새 말풍선 추가하기**: ① 말풍선 JSON을 그려서 `character/`에 넣고 ② `BUBBLE_STYLES`에 한 줄 추가 ③ 텍스트 색이 필요하면 [renderer/style.css](renderer/style.css)에 `#bubble.style-<이름>` 블록 추가 (기존 3종 참고). 레벨별 연출(`urgent` 흔들림 등)은 스타일과 무관하게 공통 적용됩니다.

## 확인 루프 (수정 → 눈으로 보기)

1. `npm start`로 실행
2. 트레이에서 **사용 안내** / **컨퍼런스 안내**로 UI 확인
3. 애니메이션·말풍선은 웹훅으로 확인:

```bash
node scripts/send.js notify "제목" "메시지가 길면 말풍선이 옆으로 늘어나요" success
node scripts/send.js state happy
```

4. JSON을 바꿨으면 앱 재시작 (애니메이션은 시작 시 1회 로드)

## 커스텀 아이디어

아트만 바꿔도 되고, 앱을 통째로 뜯어도 됩니다:

**아트 쪽**

- **캐릭터 갈아끼우기** — 감정 9종 파일명만 지키면 고양이든 문어든 코드 수정 없이 교체
- **프레임 추가/속도 조절** — pages 배열에 페이지 추가, `ANIM`에서 fps 조절
- **말풍선 4번째 스타일** — JSON 1개 + `BUBBLE_STYLES` 1줄
- **팔레트 스왑** — grid는 hex 문자열 배열이라 스크립트로 일괄 치환하면 컬러 바리에이션 순삭

**앱 쪽**

- **새 상태/행동 추가** — `ANIM`에 상태 등록 후 `POST /state {"state":"내상태"}`로 트리거, main.js 상태 머신에 규칙 추가
- **새 연동** — [integrations/mascot-client.js](integrations/mascot-client.js) 재사용해서 webpack/git hook/CI/슬랙 무엇이든 웹훅으로 연결
- **새 웹훅 엔드포인트** — main.js 라우팅에 추가 (예: `POST /pomodoro`로 뽀모도로 타이머)
- **컨퍼런스 안내 리스킨** — guide.\* 3파일이 독립적이라 통째로 다른 UI로 교체 가능
- **창 동작 실험** — 여러 마리 소환, 화면 가장자리 따라 걷기, 다른 모니터 이주 등 main.js에서 자유롭게
