# feconf-26-mascot

화면 구석에 상주하는 픽셀아트 달팽이입니다.  
**빌드·테스트·dev 서버** 상태를 표정과 말풍선으로 알려 주고, FECONF 일정 안내에 쓰는 Electron 데스크탑 앱입니다.

앱이 꺼져 있으면 CLI는 조용히 무시합니다. 빌드·dev 흐름을 막지 않습니다.

---

## 바로 실행

Node.js 18+ · 첫 실행 시 Electron 바이너리를 받아 1~2분 걸릴 수 있습니다.

```bash
npx feconf-26-mascot
```

패키지 소스가 있는 폴더 안에서는 로컬 패키지와 이름이 겹칠 수 있습니다.  
`npx`로 받을 때는 **다른 디렉터리**에서 실행하세요.

---

## 내 프로젝트에 연결

```bash
npm i -D feconf-26-mascot
```

마스코트를 켠 뒤, 평소 명령을 감싸면 됩니다.

```bash
# 빌드 / 테스트 / lint / tsc …
npx feconf-2026 npm run build

# Vite · Next · CRA 등 HTML을 주는 dev 서버 → LCP · INP · CLS 피드백
npx feconf-2026 npm run dev
```

| 하고 싶은 일 | 명령 |
| --- | --- |
| 앱만 실행 | `npx feconf-26-mascot` |
| 빌드·테스트 반응 | `npx feconf-2026 npm run build` |
| 성능 피드백 | `npx feconf-2026 npm run dev` |
| 전역 설치 후 | `npm i -g feconf-26-mascot` → `feconf-2026 …` |

동작 규칙:

- 스크립트 이름이 `dev` / `start` / `serve` / `preview` 이거나 그 계열이면 **성능 측정**
- 그 외(`build`, `test`, `lint` …)는 **빌드 감시**
- 강제: `npx feconf-2026 --watch <명령>` · `npx feconf-2026 --dev <명령>`

같은 패키지의 하위 CLI: `mascot-watch` · `mascot-dev` · `feconf`

포트가 안 잡히는 정적 서버 등은 이렇게 지정할 수 있습니다.

```bash
npx mascot-dev --port 5173 -- npm run dev
```

---

## 앱에서 할 수 있는 것

- 투명 · 항상 위 · 드래그 이동 · 트레이 상주
- 클릭 → 인사 · 두 번 클릭 → D-day
- 트레이 → 컨퍼런스 안내 · 방해 금지 · 사용 안내
- 단축키: `⌘⇧M` / `Ctrl+Shift+M` 숨김·표시 · `⌘⇧H` / `Ctrl+Shift+H` 인사
- 로컬 웹훅: `http://127.0.0.1:7842`

```bash
curl -s -X POST http://127.0.0.1:7842/notify \
  -H 'Content-Type: application/json' \
  -d '{"title":"완료","message":"배포 끝","level":"success"}'
```

주요 경로: `/notify` · `/state` · `/activity` · `/vitals` · `/health` · `/vitals-client.js`  
자세한 스펙은 [CUSTOMIZING.md](CUSTOMIZING.md)를 보세요.

행사 날짜·세션은 [shared/conference.js](shared/conference.js) 한곳에서 바꿉니다.

---

## 뜯어고치기

`npx` / `npm i`만으로는 애셋이 내 폴더에 남지 않습니다.  
캐릭터·말풍선·안내 UI를 바꾸려면 클론하세요.

```bash
git clone https://github.com/KimGaeun0806/feconf-character.git
cd feconf-character
npm install
npm start
```

- 애셋: `character/` — `snail-wide-*.json`, `bubble-*.json`
- 구조·웹훅·포맷: [CUSTOMIZING.md](CUSTOMIZING.md)
- 구성 요약: [OVERVIEW.md](OVERVIEW.md)

파일 이름 규칙만 맞추면 캐릭터 JSON을 갈아끼울 수 있습니다.

```text
snail-wide-<emotion>[-long].json
```

---

## 요구 사항 · 참고

- Node.js **≥ 18**
- macOS에서 주로 검증했습니다. (Electron)
- 웹훅 기본 포트 **7842** — 이미 쓰 중이면 앱/연동이 겹칠 수 있습니다
- CI에서는 보통 앱을 켜지 않아도 됩니다. 필요하면 `MASCOT_DISABLE=1`

---

## 라이선스

MIT  
말풍선 픽셀 폰트: **Mona (MonaS12)** by [Monad ABXY](https://github.com/MonadABXY/mona-font) — SIL OFL 1.1
