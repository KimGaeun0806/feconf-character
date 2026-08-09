'use strict';

const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  ipcMain,
  screen,
  globalShortcut,
  nativeImage,
  Notification,
  powerMonitor,
  shell,
} = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

// 트레이에 며칠씩 상주하는 앱이라 예외 하나로 통째로 죽으면 사용자는 이유도 모르고
// 마스코트를 잃는다. 기록만 남기고 버틴다 — Node 는 처리되지 않은 rejection 도
// 프로세스를 종료시키므로 둘 다 잡는다.
process.on('uncaughtException', (e) => {
  console.error('[fatal] 처리되지 않은 예외:', (e && e.stack) || e);
});
process.on('unhandledRejection', (reason) => {
  console.error('[fatal] 처리되지 않은 rejection:', (reason && reason.stack) || reason);
});

// ---------------------------------------------------------------------------
// 설정 (config.json 으로 덮어쓸 수 있음)
// ---------------------------------------------------------------------------
const DEFAULT_CONFIG = {
  port: 7842,          // 웹훅 HTTP 서버 포트
  token: '',           // 설정 시 웹훅 요청에 x-token 헤더 필요 (빈 값이면 인증 없음)
  width: 315, // 달팽이 좌하단 + 말풍선/D-day 팝업 우상단 구성
  height: 260,
  margin: 24,          // 화면 모서리로부터 여백
  corner: 'bottom-right', // bottom-right | bottom-left | top-right | top-left
  idleSleepMs: 90000,  // 이 시간 동안 이벤트 없으면 잠자기
  guideTitle: '컨퍼런스 안내',
  guideSubtitle: '오늘의 세션',
  guideWidth: 320,
  guideHeight: 500, // before/after 화면이 스크롤 없이 들어가는 높이
};

// ---------------------------------------------------------------------------
// 앱 로고 / 아이콘
// ---------------------------------------------------------------------------
const APP_NAME = 'FEConf Mascot';
const APP_ICON_PATH = path.join(__dirname, 'assets', 'icon.png');
// 파일명이 Template 로 끝나면 macOS 가 메뉴바 밝기에 맞춰 자동 반전한다.
const TRAY_ICON_PATH = path.join(__dirname, 'assets', 'trayTemplate.png');

function appIcon() {
  const img = nativeImage.createFromPath(APP_ICON_PATH);
  return img.isEmpty() ? undefined : img;
}

function applyAppBranding() {
  app.setName(APP_NAME);
  if (process.platform !== 'darwin' || !app.dock) return;
  const icon = appIcon();
  if (icon) app.dock.setIcon(icon);
}

function loadConfig() {
  const cfgPath = path.join(__dirname, 'config.json');
  let cfg = { ...DEFAULT_CONFIG };
  try {
    if (fs.existsSync(cfgPath)) {
      Object.assign(cfg, JSON.parse(fs.readFileSync(cfgPath, 'utf8')));
    }
  } catch (e) {
    console.error('[config] 읽기 실패, 기본값 사용:', e.message);
  }
  return cfg;
}

const CONFIG = loadConfig();

let win = null;
let guideWin = null;
let tray = null;
let server = null;
let dnd = false;           // Do Not Disturb
let sleepTimer = null;
let asleep = false;        // 자는 중이면 산책하지 않는다
let overridePhase = null;  // 개발용 phase 강제 (before|dayof|after|null)
let mockNow = null;        // 개발용 모의 시각(ms), null = 실시간
let devWin = null;
const scheduledTimers = [];
const activeNotifications = new Set();

// 코딩 중 걷기(반대 모서리로 이동) 상태
let mover = null;
let walkTarget = null;      // { x, y } 목표 위치
let walkGoal = null;        // 'away'(반대 모서리) | 'home'(제자리)
let lastDir = -1;           // 바라보는 방향(-1 왼쪽, +1 오른쪽)
let workingUntil = 0;       // 이 시각까지 코딩중으로 간주
let returnTimer = null;
const WALK_SPEED = 4;       // 틱당 이동 px
const WALK_TICK = 33;       // ~30fps

// ---------------------------------------------------------------------------
// 창 위치 계산
// ---------------------------------------------------------------------------
function cornerPosition() {
  const display = screen.getPrimaryDisplay();
  const wa = display.workArea; // 메뉴바/독 제외 영역
  const { width: w, height: h, margin, corner } = CONFIG;
  let x = wa.x + wa.width - w - margin;
  let y = wa.y + wa.height - h - margin;
  if (corner.includes('left')) x = wa.x + margin;
  if (corner.includes('top')) y = wa.y + margin;
  return { x: Math.round(x), y: Math.round(y) };
}

// setPosition은 정수만 받는다 — 디스플레이 절전/해상도 전환 순간 workArea에서
// NaN이 흘러들면 메인 프로세스가 통째로 죽으므로, 모든 창 이동은 여기로 거친다.
function safeSetPosition(w, x, y) {
  if (!w || w.isDestroyed()) return;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  w.setPosition(Math.round(x), Math.round(y));
}

// 끌다가 경계에 막혔을 때, 커서가 밖으로 나간 거리를 이만큼까지만 기억한다. 한없이
// 세면 멀리 끌었다 돌아올 때 한참 헛돌고, 아예 세지 않으면 되돌아오는 순간 창이
// 커서에 달라붙어 잡은 지점이 어긋난다.
const DRAG_SLACK = 120;

// 창이 통째로 보이도록 좌표를 화면 안쪽으로 밀어넣는다.
// slack 을 주면 그만큼은 경계 밖을 허용한다 (드래그 의도를 기억할 때 쓴다)
function clampedToWorkArea(x, y, w, h, slack = 0) {
  const wa = screen.getDisplayNearestPoint({ x, y }).workArea;
  return {
    x: Math.max(wa.x - slack, Math.min(x, wa.x + wa.width - w + slack)),
    y: Math.max(wa.y - slack, Math.min(y, wa.y + wa.height - h + slack)),
  };
}

// 모니터를 빼거나 해상도가 바뀌면 창이 보이지 않는 좌표에 남는다 — 커서가 닿을 수
// 있는 영역으로 되돌린다. 트레이의 '위치 재정렬' 을 모르면 되찾을 방법이 없다.
function clampWindowToScreen(w) {
  if (!w || w.isDestroyed()) return;
  const [x, y] = w.getPosition();
  const [ww, wh] = w.getSize();
  const p = clampedToWorkArea(x, y, ww, wh);
  if (p.x !== x || p.y !== y) safeSetPosition(w, p.x, p.y);
}

// 마스코트·안내 패널·개발자 창이 모두 같은 브리지를 쓴다
const WEB_PREFS = {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
};

function createWindow() {
  const { x, y } = cornerPosition();
  win = new BrowserWindow({
    width: CONFIG.width,
    height: CONFIG.height,
    x,
    y,
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    focusable: true,
    icon: appIcon(),
    webPreferences: WEB_PREFS,
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // 기본은 클릭 통과 — 렌더러가 캐릭터/말풍선 위에 커서가 올라오면 해제한다.
  // forward: true 로 mousemove 는 계속 렌더러에 전달되어 hover 감지가 가능.
  win.setIgnoreMouseEvents(true, { forward: true });

  win.on('closed', () => {
    win = null;
  });
}

// ---------------------------------------------------------------------------
// 숨긴 창 정리
// 창을 숨겨도 렌더러 프로세스는 통째로 남아 60MB 남짓을 계속 붙잡는다. 안내 패널과
// 개발자 창은 어쩌다 한 번 여는 것이라, 한동안 닫혀 있으면 버리고 다음에 다시 만든다.
// ---------------------------------------------------------------------------
// show/hide 이벤트는 showInactive()·hide() 로 여닫을 때 오지 않아 믿을 수 없다.
// 값이 정확한 isVisible() 을 주기적으로 들여다본다.
const HIDDEN_DESTROY_MS = 5 * 60000;
const HIDDEN_SWEEP_MS = 30000;
const hiddenSince = new Map();
let hiddenSweeper = null;

function sweepHiddenWindows() {
  for (const w of [guideWin, devWin]) {
    if (!w || w.isDestroyed()) continue;
    if (w.isVisible()) {
      hiddenSince.delete(w);
      continue;
    }
    const since = hiddenSince.get(w);
    if (since == null) {
      hiddenSince.set(w, Date.now());
    } else if (Date.now() - since >= HIDDEN_DESTROY_MS) {
      hiddenSince.delete(w);
      w.destroy(); // 참조는 'closed' 에서 비운다
    }
  }
}

// ---------------------------------------------------------------------------
// 안내 패널 창
// ---------------------------------------------------------------------------
function createGuideWindow() {
  guideWin = new BrowserWindow({
    width: CONFIG.guideWidth,
    height: CONFIG.guideHeight,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreenable: false,
    icon: appIcon(),
    webPreferences: WEB_PREFS,
  });
  guideWin.setAlwaysOnTop(true, 'screen-saver');
  guideWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  guideWin.loadFile(path.join(__dirname, 'renderer', 'guide.html'));

  // 창은 지웠다 다시 만들 수 있다 — 핸들러는 모듈 변수 대신 자기 창을 붙잡는다
  const w = guideWin;

  // 닫기 대신 숨김 (앱은 계속 상주)
  w.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      w.hide();
    }
  });

  // 드래그는 guide:drag 가 처리한다 — 그 밖의 경로로(OS 가 옮겼다든지) 창이 움직였다면
  // 화면 안에 남아 있는지만 확인한다
  const onMoved = () => {
    if (w.isDestroyed()) return;
    const [x, y] = w.getPosition();
    if (guideAutoPos && x === guideAutoPos.x && y === guideAutoPos.y) return;
    keepGuideOnScreen();
  };
  w.on('moved', onMoved);
  w.on('move', onMoved);

  w.on('closed', () => {
    hiddenSince.delete(w);
    if (guideWin === w) guideWin = null;
  });
}

// 패널은 열 때 달팽이 옆에 자리를 잡을 뿐, 그 뒤로는 달팽이가 어디로 가든 그 자리에
// 머문다. 사용자가 헤더를 잡고 옮겼다면 다음에 열 때도 옮겨둔 자리에 뜬다 — 우리가
// 옮긴 좌표를 기억해 두고, 그와 다른 곳으로 움직였을 때만 사용자가 끈 것으로 본다.
let guidePinnedPos = null;
let guideAutoPos = null;

function moveGuideTo(x, y) {
  guideAutoPos = { x: Math.round(x), y: Math.round(y) };
  safeSetPosition(guideWin, x, y);
}

// 끌어서 화면 밖으로 내보낼 수 없게 — 놓고 나면 보이는 영역 안으로 되돌린다.
// 끄는 도중에 되돌리면 커서와 싸우므로 움직임이 멎은 뒤에 손본다.
function keepGuideOnScreen() {
  if (!guideWin || guideWin.isDestroyed()) return;
  const [x, y] = guideWin.getPosition();
  const [gw, gh] = guideWin.getSize();
  const p = clampedToWorkArea(x, y, gw, gh);
  guidePinnedPos = p;
  if (p.x !== x || p.y !== y) moveGuideTo(p.x, p.y);
}

function positionGuide() {
  if (!win || !guideWin) return;
  if (guidePinnedPos) {
    // 옮겨둔 자리도 화면 밖일 수 있다 — 모니터가 바뀌었다면 안쪽으로 당긴다
    const [gw, gh] = guideWin.getSize();
    guidePinnedPos = clampedToWorkArea(guidePinnedPos.x, guidePinnedPos.y, gw, gh);
    const [cx, cy] = guideWin.getPosition();
    if (cx !== guidePinnedPos.x || cy !== guidePinnedPos.y) {
      moveGuideTo(guidePinnedPos.x, guidePinnedPos.y); // 다시 만들어진 창을 그 자리로
    }
    return;
  }
  const [mx, my] = win.getPosition();
  const wa = screen.getPrimaryDisplay().workArea;
  const gw = CONFIG.guideWidth;
  const gh = CONFIG.guideHeight;
  const gap = 8;

  // 기본: 마스코트 왼쪽에 배치, 하단 정렬
  let gx = mx - gw + 20; // 살짝 겹치게
  let gy = my + CONFIG.height - gh;

  // 왼쪽 공간 부족하면 오른쪽에
  if (gx < wa.x + 4) gx = mx + CONFIG.width - 20;
  // 화면 경계 클램프
  gx = Math.max(wa.x + 4, Math.min(gx, wa.x + wa.width - gw - 4));
  gy = Math.max(wa.y + 4, Math.min(gy, wa.y + wa.height - gh - 4));

  moveGuideTo(gx, gy);
}

function loadConference() {
  const p = path.join(__dirname, 'conference.json');
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.error('[conference] 읽기 실패:', e.message);
  }
  return {};
}

// 자정 기준 날짜 비교로 phase 결정
function startOfDay(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}
function effNow() {
  return mockNow != null ? mockNow : Date.now();
}
function conferencePhase(conf) {
  if (overridePhase) return overridePhase;
  const start = startOfDay(conf.startDate || conf.date);
  const end = startOfDay(conf.endDate || conf.startDate || conf.date);
  const today = startOfDay(new Date(effNow()));
  if (isNaN(start)) return 'dayof';
  if (today < start) return 'before';
  if (today > end) return 'after';
  return 'dayof';
}

function guideData() {
  const conf = loadConference();
  return {
    items: loadSchedule(),
    conference: conf,
    phase: conferencePhase(conf),
    title: CONFIG.guideTitle || conf.name || '컨퍼런스 안내',
    subtitle: CONFIG.guideSubtitle,
    now: effNow(),
  };
}

function pushGuideData() {
  if (!guideWin || guideWin.isDestroyed()) return;
  const send = () => guideWin.webContents.send('guide:data', guideData());
  if (guideWin.webContents.isLoading()) {
    guideWin.webContents.once('did-finish-load', send);
  } else {
    send();
  }
}

function toggleGuide() {
  if (!guideWin) createGuideWindow();
  if (guideWin.isVisible()) {
    guideWin.hide();
  } else {
    positionGuide();
    pushGuideData();
    guideWin.showInactive(); // 포커스 뺏지 않고 표시
  }
}

function showGuide() {
  if (!guideWin) createGuideWindow();
  positionGuide();
  pushGuideData();
  if (!guideWin.isVisible()) guideWin.showInactive();
}

// ---------------------------------------------------------------------------
// 개발자 미리보기 창 (phase/시간 스크럽)
// ---------------------------------------------------------------------------
// 개발자 창은 phase·시각을 가짜로 바꿔둔다 — 창을 접으면 실시간으로 되돌린다
function resetDevOverrides() {
  overridePhase = null;
  mockNow = null;
  pushGuideData();
}

function createDevWindow() {
  devWin = new BrowserWindow({
    width: 340,
    height: 800,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    icon: appIcon(),
    webPreferences: WEB_PREFS,
  });
  devWin.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  devWin.loadFile(path.join(__dirname, 'renderer', 'dev.html'));
  const w = devWin;

  w.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      w.hide();
      resetDevOverrides();
    }
  });

  w.on('closed', () => {
    hiddenSince.delete(w);
    if (devWin === w) devWin = null;
  });
}

function toggleDev() {
  if (!devWin) createDevWindow();
  if (devWin.isVisible()) {
    devWin.hide();
    resetDevOverrides();
  } else {
    const wa = screen.getPrimaryDisplay().workArea;
    safeSetPosition(devWin, wa.x + 40, wa.y + 60);
    devWin.show(); // 입력 위해 포커스 허용
    showGuide();
  }
}

// ---------------------------------------------------------------------------
// 마스코트로 이벤트 전송
// ---------------------------------------------------------------------------
function sendToMascot(channel, payload) {
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload);
  }
}

function scheduleSleep() {
  if (sleepTimer) clearTimeout(sleepTimer);
  asleep = false;
  sleepTimer = setTimeout(() => {
    asleep = true;
    sendToMascot('mascot:state', { state: 'sleeping' });
  }, CONFIG.idleSleepMs);
}

// ---------------------------------------------------------------------------
// 코딩 중 걷기 — 반대 모서리로 이동, 멈추면 제자리 복귀
// ---------------------------------------------------------------------------
function cornerXY(corner) {
  const wa = screen.getPrimaryDisplay().workArea;
  const { width: w, height: h, margin: m } = CONFIG;
  const x = corner.includes('left') ? wa.x + m : wa.x + wa.width - w - m;
  const y = corner.includes('top') ? wa.y + m : wa.y + wa.height - h - m;
  return { x: Math.round(x), y: Math.round(y) };
}
function oppositeCorner(corner) {
  const lr = corner.includes('left') ? 'right' : 'left';
  const tb = corner.includes('top') ? 'bottom' : 'top';
  return `${tb}-${lr}`;
}

function startMover() {
  if (!mover) mover = setInterval(stepWalk, WALK_TICK);
}
function stopMover() {
  if (mover) {
    clearInterval(mover);
    mover = null;
  }
}
function stepWalk() {
  if (!win || win.isDestroyed() || !walkTarget) {
    stopMover();
    return;
  }
  const [x, y] = win.getPosition();
  const dx = walkTarget.x - x;
  const dy = walkTarget.y - y;
  const dist = Math.hypot(dx, dy);
  if (dist <= WALK_SPEED) {
    safeSetPosition(win, walkTarget.x, walkTarget.y);
    stopMover();
    onArrive();
    return;
  }
  safeSetPosition(win, x + (dx / dist) * WALK_SPEED, y + (dy / dist) * WALK_SPEED);
  const dir = dx < 0 ? -1 : 1;
  if (dir !== lastDir) {
    lastDir = dir;
    sendToMascot('mascot:state', { state: 'walking', dir });
  }
}
function onArrive() {
  walkTarget = null;
  if (walkGoal === 'home') {
    walkGoal = null;
    sendToMascot('mascot:state', { state: 'idle' });
    scheduleSleep();
  } else {
    // 반대 모서리 도착 → 그 자리에서 집중
    sendToMascot('mascot:state', { state: 'working' });
  }
}
function startCodingWalk(data = {}) {
  const linger = Number(data.lingerMs || data.ttl) || 6000; // 웹훅이 문자열을 보내도 숫자로
  workingUntil = Date.now() + linger;
  if (walkGoal !== 'away') {
    walkGoal = 'away';
    walkTarget = cornerXY(oppositeCorner(CONFIG.corner));
    sendToMascot('mascot:state', { state: 'walking', dir: lastDir });
    startMover();
  }
  if (returnTimer) clearTimeout(returnTimer);
  returnTimer = setTimeout(() => {
    if (Date.now() >= workingUntil) returnHome();
  }, linger + 60);
}
function returnHome() {
  walkGoal = 'home';
  walkTarget = cornerXY(CONFIG.corner);
  sendToMascot('mascot:state', { state: 'walking', dir: lastDir });
  startMover();
}

// ---------------------------------------------------------------------------
// 가끔 몇 걸음 — 쉬는 중에만 좌우로 살짝 움직인다 (약 5초에 3걸음)
// 코딩 중 걷기와 달리 목적지가 없고, 기준점 주변을 조금씩 오갈 뿐이다.
// ---------------------------------------------------------------------------
const WANDER_STEPS = 3; // 한 번 나설 때 걷는 걸음 수
const WANDER_STEP_PX = 14; // 한 걸음에 이동하는 거리
const WANDER_STEP_MS = 600; // 한 걸음을 걷는 시간
const WANDER_GAP_MS = 1670; // 걸음 시작 간격 — 3걸음이 약 5초
const WANDER_MIN_MS = 25000; // 다음 산책까지 대기(최소~최대)
const WANDER_MAX_MS = 50000;
const WANDER_RANGE_PX = 90; // 기준점에서 벗어날 수 있는 최대 거리

let wanderTimer = null; // 다음 산책 예약
let wanderStepTimer = null; // 다음 걸음 예약
let wanderMover = null; // 걸음 진행 인터벌
let wanderHomeX = null; // 산책 기준 x (드래그하면 그 자리로 다시 잡는다)

function stopWander() {
  if (wanderMover) {
    clearInterval(wanderMover);
    wanderMover = null;
  }
  if (wanderStepTimer) {
    clearTimeout(wanderStepTimer);
    wanderStepTimer = null;
  }
}
// 코딩 중 걷기·작업중이면 산책은 양보한다
function wanderBusy() {
  return !!mover || !!walkTarget || Date.now() < workingUntil;
}
function scheduleWander() {
  if (wanderTimer) clearTimeout(wanderTimer);
  wanderTimer = setTimeout(
    startWander,
    WANDER_MIN_MS + Math.random() * (WANDER_MAX_MS - WANDER_MIN_MS)
  );
}
// 오갈 수 있는 x 범위 — 화면 여백과 기준점 반경 중 좁은 쪽
function wanderBounds() {
  const wa = screen.getPrimaryDisplay().workArea;
  return {
    min: Math.max(wa.x + CONFIG.margin, wanderHomeX - WANDER_RANGE_PX),
    max: Math.min(wa.x + wa.width - CONFIG.width - CONFIG.margin, wanderHomeX + WANDER_RANGE_PX),
  };
}
function startWander() {
  scheduleWander(); // 이번을 건너뛰더라도 다음 산책은 예약해둔다
  if (!win || win.isDestroyed() || asleep || wanderBusy()) return;
  const [x] = win.getPosition();
  if (wanderHomeX == null) wanderHomeX = x;
  const b = wanderBounds();
  if (!Number.isFinite(b.min) || !Number.isFinite(b.max)) return; // 디스플레이 전환 중 — 이번 산책은 쉰다
  // 기본 위치가 화면 모서리라 한쪽은 이미 막혀 있다 — 갈 수 있는 쪽을 고른다
  const blocked = (d) => x + d * WANDER_STEP_PX > b.max || x + d * WANDER_STEP_PX < b.min;
  let dir = Math.random() < 0.5 ? -1 : 1;
  if (blocked(dir)) dir = -dir;
  if (blocked(dir)) return; // 양쪽 다 막혔으면 이번엔 쉰다
  scheduleSleep(); // 산책은 활동 — 잠들기 타이머를 미뤄서 멈추지 않고 계속 돌아다닌다
  takeStep(dir, WANDER_STEPS, b);
}
function takeStep(dir, left, b) {
  if (left <= 0 || !win || win.isDestroyed() || asleep || wanderBusy()) {
    stopWander();
    return;
  }
  const [sx, sy] = win.getPosition();
  const target = Math.min(b.max, Math.max(b.min, sx + dir * WANDER_STEP_PX));
  if (target === sx) {
    sendToMascot('mascot:state', { state: 'idle' }); // 벽에 닿았으면 거기서 멈춘다
    return;
  }
  lastDir = dir;
  sendToMascot('mascot:state', { state: 'walking', dir });

  const ticks = Math.max(1, Math.round(WANDER_STEP_MS / WALK_TICK));
  let n = 0;
  wanderMover = setInterval(() => {
    if (!win || win.isDestroyed() || wanderBusy()) {
      stopWander();
      return;
    }
    n++;
    // 시작점→목표를 보간해야 한 틱 이동량이 1px 미만이어도 반올림에 먹히지 않는다
    safeSetPosition(win, sx + (target - sx) * (n / ticks), sy);
    if (n >= ticks) {
      clearInterval(wanderMover);
      wanderMover = null;
      sendToMascot('mascot:state', { state: 'idle' });
      if (left > 1) {
        wanderStepTimer = setTimeout(
          () => takeStep(dir, left - 1, b),
          WANDER_GAP_MS - WANDER_STEP_MS
        );
      }
    }
  }, WALK_TICK);
}

// 외부에서 들어온 활동/알림을 처리하는 공통 함수
function showSystemNotification(data = {}) {
  if (dnd) return;
  if (!Notification.isSupported()) {
    console.warn('[notification] 이 환경에서는 시스템 알림을 지원하지 않습니다.');
    return;
  }

  const note = new Notification({
    title: data.title || '알림',
    body: data.message || '',
    silent: false,
    icon: appIcon(),
  });
  // 표시 전에 GC 되지 않도록 붙잡아 두는 용도 — 닫힘/실패를 못 받는 경우가 있어
  // 시간이 지나면 놓아준다. 안 그러면 며칠 동안 알림 객체가 계속 쌓인다.
  activeNotifications.add(note);
  const release = () => activeNotifications.delete(note);
  note.once('show', () => console.log('[notification] 표시됨:', data.title || '알림'));
  note.once('failed', (_event, error) => {
    console.error('[notification] 표시 실패:', error || 'unknown error');
    release();
  });
  note.once('close', release);
  setTimeout(release, 60000);
  note.show();
}

function handleEvent(kind, data = {}) {
  scheduleSleep();
  if (kind === 'notify') {
    sendToMascot('mascot:notify', {
      title: data.title || '알림',
      message: data.message || '',
      level: data.level || 'info', // info | success | warn | urgent
      reaction: data.reaction, // 지정하면 기본 반응 대신 이 표정 (ANIM 등록된 이름)
    });
    if (!dnd) {
      try {
        showSystemNotification(data);
      } catch (e) {
        console.error('[notification] 예외:', e.message);
      }
    }
  } else if (kind === 'activity') {
    // 타이핑/코딩 등 사용자 활동 → 반대 모서리로 걸어감 (멈추면 복귀)
    startCodingWalk(data);
  } else if (kind === 'state') {
    sendToMascot('mascot:state', { state: data.state, ttl: data.ttl });
  }
}

// ---------------------------------------------------------------------------
// Web Vitals 피드백 — dev 서버에서 띄운 페이지의 실측 지표에 마스코트가 반응한다
// ---------------------------------------------------------------------------
// 임계값은 web.dev 의 Core Web Vitals 기준. good 이하 / poor 초과 사이가 '개선 필요'.
const VITALS = {
  LCP: { good: 2500, poor: 4000 },
  INP: { good: 200, poor: 500 },
  CLS: { good: 0.1, poor: 0.25 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
};
const VITAL_ORDER = ['LCP', 'INP', 'CLS', 'FCP', 'TTFB'];
const GRADE_RANK = { good: 0, ni: 1, poor: 2 };

// 같은 평가가 반복될 땐 조용히, 평가가 바뀌었을 땐 빠르게 알려준다.
// 저장할 때마다 페이지가 새로고침되는 dev 환경에선 이 간격이 없으면 말풍선만 뜬다.
const VITALS_GAP_SAME_MS = 60000;
const VITALS_GAP_CHANGED_MS = 6000;
let lastVitalsGrade = null;
let lastVitalsAt = 0;

function formatVital(name, value) {
  if (name === 'CLS') return value.toFixed(3);
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
}

function gradeVitals(metrics = {}) {
  const graded = [];
  for (const name of VITAL_ORDER) {
    // 브라우저가 보내는 키 대소문자를 가리지 않는다
    const raw = metrics[name] != null ? metrics[name] : metrics[name.toLowerCase()];
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) continue;
    const t = VITALS[name];
    graded.push({
      name,
      value,
      grade: value <= t.good ? 'good' : value > t.poor ? 'poor' : 'ni',
    });
  }
  return graded;
}

function handleVitals(payload = {}) {
  const metrics = payload.metrics && typeof payload.metrics === 'object' ? payload.metrics : payload;
  const graded = gradeVitals(metrics);
  if (!graded.length) return { ok: false, error: 'no known metrics' };

  const worst = graded.reduce((a, b) => (GRADE_RANK[b.grade] > GRADE_RANK[a.grade] ? b : a));
  const overall = worst.grade;
  const summary = graded.map((g) => `${g.name} ${formatVital(g.name, g.value)}`).join(' · ');
  console.log(`[vitals] ${overall} — ${summary}${payload.url ? ` (${payload.url})` : ''}`);

  if (dnd) return { ok: true, grade: overall, summary, skipped: 'dnd' };

  // 평가가 그대로면 한동안 다시 말 걸지 않는다
  const changed = overall !== lastVitalsGrade;
  const gap = Date.now() - lastVitalsAt;
  if (gap < (changed ? VITALS_GAP_CHANGED_MS : VITALS_GAP_SAME_MS)) {
    return { ok: true, grade: overall, summary, skipped: 'throttled' };
  }
  lastVitalsGrade = overall;
  lastVitalsAt = Date.now();

  // 루트 경로는 알려줘봤자 정보가 없다 — 여러 페이지를 오갈 때만 어디였는지 밝힌다
  const where = payload.url && payload.url !== '/' ? String(payload.url).slice(0, 40) : '';
  let title;
  let message;
  let level;
  let reaction;
  if (overall === 'good') {
    title = '💯 Web Vitals 완벽!';
    message = summary;
    level = 'success';
    reaction = 'love';
  } else {
    const others = graded.filter((g) => g.grade !== 'good' && g !== worst).length;
    const limit = formatVital(worst.name, VITALS[worst.name].good);
    title = overall === 'poor' ? '🐌 많이 느려졌어요' : '🤔 조금 아쉬워요';
    message =
      `${worst.name} ${formatVital(worst.name, worst.value)} · 기준 ${limit} 이하` +
      (others ? ` 외 ${others}개` : '') +
      (where ? ` · ${where}` : '');
    level = overall === 'poor' ? 'warn' : 'info';
    reaction = 'curious';
  }

  // 저장할 때마다 시스템 알림이 쌓이면 성가시다 — 말풍선으로만 알려준다
  scheduleSleep();
  sendToMascot('mascot:notify', { title, message, level, reaction });
  return { ok: true, grade: overall, summary };
}

// ---------------------------------------------------------------------------
// HTTP 웹훅 서버
// ---------------------------------------------------------------------------
function startServer() {
  server = http.createServer((req, res) => {
    // CORS (로컬 웹훅/브라우저에서 편하게 호출)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-token');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    const url = new URL(req.url, `http://localhost:${CONFIG.port}`);

    if (req.method === 'GET' && url.pathname === '/debug/capture') {
      // 개발용: 창 내용을 PNG로 캡처 (?win=guide 로 안내 패널)
      const which = url.searchParams.get('win');
      const doCapture = (target) => {
        if (target && !target.isDestroyed()) {
          target.webContents
            .capturePage()
            .then((img) => {
              res.writeHead(200, { 'Content-Type': 'image/png' });
              res.end(img.toPNG());
            })
            .catch((e) => {
              console.error('[capture] 실패:', e.message);
              res.writeHead(500);
              res.end();
            });
        } else {
          res.writeHead(503);
          res.end();
        }
      };
      if (which === 'guide') {
        overridePhase = url.searchParams.get('phase') || null; // 개발용 phase 강제
        const mk = url.searchParams.get('mock');
        mockNow = mk ? (/^\d+$/.test(mk) ? Number(mk) : new Date(mk).getTime()) : null;
        if (!guideWin) createGuideWindow();
        positionGuide();
        pushGuideData();
        guideWin.showInactive();
        setTimeout(() => {
          doCapture(guideWin);
          overridePhase = null; // 실제 클릭 시엔 날짜 기반 phase로 복귀
          mockNow = null;
        }, 550);
      } else if (which === 'dev') {
        if (!devWin) createDevWindow();
        const wa = screen.getPrimaryDisplay().workArea;
        safeSetPosition(devWin, wa.x + 40, wa.y + 60);
        devWin.showInactive();
        setTimeout(() => doCapture(devWin), 750);
      } else {
        doCapture(win);
      }
      return;
    }

    if (req.method === 'GET' && url.pathname === '/debug/dday') {
      // 개발용: 클릭 팝업(D-day)을 강제로 띄운다 (실제 더블클릭 대신)
      sendToMascot('mascot:dday', {});
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true }));
    }

    if (req.method === 'GET' && url.pathname === '/debug/pos') {
      const pos = win && !win.isDestroyed() ? win.getPosition() : null;
      const guidePos = guideWin && !guideWin.isDestroyed() ? guideWin.getPosition() : null;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(
        JSON.stringify({
          pos,
          walkGoal,
          walkTarget,
          guidePos,
          guidePinned: !!guidePinnedPos,
          charBox,
          workArea: screen.getPrimaryDisplay().workArea,
        })
      );
    }

    if (req.method === 'GET' && url.pathname === '/debug/drag') {
      // 개발용: 마우스 없이 드래그를 흉내내 경계 동작을 확인한다
      if (url.searchParams.get('start')) mascotDragIntent = null;
      dragMascot(Number(url.searchParams.get('dx') || 0), Number(url.searchParams.get('dy') || 0));
      const pos = win && !win.isDestroyed() ? win.getPosition() : null;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ pos }));
    }

    if (req.method === 'GET' && url.pathname === '/debug/vitals') {
      // 개발용: 브라우저 없이 지표를 흉내낸다 (?lcp=5200&cls=0.3)
      const metrics = {};
      for (const [k, v] of url.searchParams) metrics[k] = v;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(handleVitals({ metrics })));
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, dnd, version: app.getVersion() }));
    }

    // 토큰 인증 (설정된 경우)
    if (CONFIG.token) {
      const tok = req.headers['x-token'] || url.searchParams.get('token');
      if (tok !== CONFIG.token) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
      }
    }

    if (req.method !== 'POST') {
      res.writeHead(404);
      return res.end();
    }

    let body = '';
    req.on('data', (c) => {
      body += c;
      if (body.length > 1e6) req.destroy(); // 1MB 초과 차단
    });
    req.on('end', () => {
      let data = {};
      try {
        data = body ? JSON.parse(body) : {};
      } catch (_) {
        // form/query 로도 받아줌
        for (const [k, v] of url.searchParams) data[k] = v;
      }

      if (url.pathname === '/notify') {
        if (dnd) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ ok: true, suppressed: 'dnd' }));
        }
        handleEvent('notify', data);
      } else if (url.pathname === '/activity') {
        handleEvent('activity', data);
      } else if (url.pathname === '/state') {
        handleEvent('state', data);
      } else if (url.pathname === '/vitals') {
        const result = handleVitals(data);
        res.writeHead(result.ok ? 200 : 400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(result));
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'unknown endpoint' }));
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    });
  });

  server.on('error', (e) => {
    console.error('[server] 오류:', e.message);
  });
  server.listen(CONFIG.port, '127.0.0.1', () => {
    console.log(`[server] http://127.0.0.1:${CONFIG.port} 대기중`);
  });
}

// ---------------------------------------------------------------------------
// 컨퍼런스 세션 스케줄
// ---------------------------------------------------------------------------
function loadSchedule() {
  const p = path.join(__dirname, 'schedule.json');
  try {
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    console.error('[schedule] 읽기 실패:', e.message);
  }
  return [];
}

// setTimeout 은 약 24.8일(2^31-1 ms)이 넘는 지연을 받으면 오버플로로 즉시 실행된다.
// 컨퍼런스 일정은 몇 주 뒤가 흔해서 그대로 두면 앱을 켜자마자 알림이 쏟아진다.
const MAX_TIMEOUT_MS = 2147483647;

function scheduleAt(delay, fn) {
  const ref = { handle: null };
  const arm = (remaining) => {
    if (remaining <= MAX_TIMEOUT_MS) {
      ref.handle = setTimeout(fn, remaining);
    } else {
      ref.handle = setTimeout(() => arm(remaining - MAX_TIMEOUT_MS), MAX_TIMEOUT_MS);
    }
  };
  arm(delay);
  return ref;
}

function cancelScheduled(ref) {
  if (ref && ref.handle) clearTimeout(ref.handle);
}

function armSchedule() {
  scheduledTimers.forEach(cancelScheduled);
  scheduledTimers.length = 0;

  const items = loadSchedule();
  const now = Date.now();
  for (const it of items) {
    const t = new Date(it.time).getTime();
    if (isNaN(t)) continue;
    // 세션 시작 leadMinutes(기본 5분) 전에 알림
    const lead = (it.leadMinutes != null ? it.leadMinutes : 5) * 60000;
    const fireAt = t - lead;
    const delay = fireAt - now;
    if (delay <= 0) continue; // 이미 지난 건 무시
    scheduledTimers.push(
      scheduleAt(delay, () => {
        handleEvent('notify', {
          title: it.title || '세션 안내',
          message: it.message || `곧 시작합니다: ${it.title || ''}`,
          level: it.level || 'info',
        });
      })
    );
  }
  console.log(`[schedule] 예약된 알림 ${scheduledTimers.length}개`);
}

// ---------------------------------------------------------------------------
// 트레이
// ---------------------------------------------------------------------------
function trayIcon() {
  // 앱 로고(FE 마크)를 메뉴바용 템플릿 이미지로 사용.
  const img = nativeImage.createFromPath(TRAY_ICON_PATH);
  if (img.isEmpty()) return nativeImage.createEmpty();
  if (process.platform === 'darwin') img.setTemplateImage(true);
  return img;
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    { label: '👋 인사시키기', click: () => handleEvent('state', { state: 'greet' }) },
    { label: '📋 안내 패널 열기/닫기', click: () => toggleGuide() },
    {
      label: '🔔 테스트 알림',
      click: () =>
        handleEvent('notify', {
          title: '테스트 알림',
          message: '마스코트가 잘 반응하는지 확인!',
          level: 'success',
        }),
    },
    { type: 'separator' },
    {
      label: dnd ? '🔕 방해 금지: 켜짐' : '🔔 방해 금지: 꺼짐',
      click: () => {
        dnd = !dnd;
        sendToMascot('mascot:dnd', { dnd });
        rebuildTray();
      },
    },
    {
      label: '📍 위치 재정렬',
      click: () => {
        if (!win) return;
        stopWander();
        const { x, y } = cornerPosition();
        safeSetPosition(win, x, y);
        wanderHomeX = x;
        guidePinnedPos = null; // 옮겨둔 안내 패널도 제자리로 — 다시 따라다닌다
        if (guideWin && guideWin.isVisible()) positionGuide();
      },
    },
    { label: '🗓 스케줄 다시 로드', click: () => armSchedule() },
    { label: '🛠 개발자 미리보기 (phase/시간)', click: () => toggleDev() },
    { type: 'separator' },
    { label: `🌐 웹훅: http://127.0.0.1:${CONFIG.port}`, enabled: false },
    { label: '종료', click: () => app.quit() },
  ]);
}

function rebuildTray() {
  if (tray) tray.setContextMenu(buildTrayMenu());
}

function createTray() {
  tray = new Tray(trayIcon());
  tray.setToolTip('컨퍼런스 마스코트');
  tray.setContextMenu(buildTrayMenu());
  tray.on('click', () => handleEvent('state', { state: 'greet' }));
}

// ---------------------------------------------------------------------------
// IPC (렌더러 → 메인)
// ---------------------------------------------------------------------------
// 캐릭터 애니메이션 (charactor/*.json — 마름모 아트보드 포맷)
ipcMain.handle('mascot:getAnims', () => {
  const dir = path.join(__dirname, 'charactor');
  const out = {};
  try {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith('.json')) continue;
      try {
        out[path.basename(f, '.json').normalize('NFC')] = JSON.parse(
          fs.readFileSync(path.join(dir, f), 'utf8')
        );
      } catch (e) {
        console.error('[anims] 파싱 실패:', f, e.message);
      }
    }
  } catch (e) {
    console.error('[anims] 읽기 실패:', e.message);
  }
  return out;
});
ipcMain.on('mascot:setIgnoreMouse', (_e, ignore) => {
  if (win && !win.isDestroyed()) {
    win.setIgnoreMouseEvents(!!ignore, { forward: true });
  }
});
// 창 안에서 캐릭터가 그려지는 칸 (렌더러가 알려준다). 못 받았으면 창 전체로 본다.
let charBox = null;
ipcMain.on('mascot:charBox', (_e, box = {}) => {
  const ok = ['left', 'top', 'right', 'bottom'].every((k) => Number.isFinite(box[k]));
  if (ok) charBox = box;
});

// 달팽이가 화면 밖으로 나가지 못하게 — 창은 말풍선 자리까지 포함해 캐릭터보다 훨씬
// 크므로, 창이 아니라 캐릭터가 그려지는 칸이 화면 안에 남도록 잡는다. 창 모서리는
// 투명하니 화면 밖으로 나가도 보이지 않는다.
function clampMascotPos(x, y) {
  const b = charBox || { left: 0, top: 0, right: CONFIG.width, bottom: CONFIG.height };
  const wa = screen.getDisplayNearestPoint({ x: x + b.left, y: y + b.top }).workArea;
  const minX = wa.x - b.left;
  const maxX = wa.x + wa.width - b.right;
  const minY = wa.y - b.top;
  const maxY = wa.y + wa.height - b.bottom;
  return {
    x: Math.min(Math.max(x, Math.min(minX, maxX)), Math.max(minX, maxX)),
    y: Math.min(Math.max(y, Math.min(minY, maxY)), Math.max(minY, maxY)),
  };
}

// 안내 패널과 같은 방식 — 커서가 경계 밖으로 나간 만큼을 따로 기억해야 되돌아올 때
// 잡은 지점이 어긋나지 않는다.
let mascotDragIntent = null;

function dragMascot(dx, dy) {
  if (!win || win.isDestroyed()) return;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
  stopWander(); // 끌고 가는 중엔 산책이 위치를 건드리지 않게
  if (!mascotDragIntent) {
    const [x, y] = win.getPosition();
    mascotDragIntent = { x, y };
  }
  const wanted = { x: mascotDragIntent.x + dx, y: mascotDragIntent.y + dy };
  const limit = clampMascotPos(wanted.x, wanted.y);
  mascotDragIntent = {
    x: Math.min(Math.max(wanted.x, limit.x - DRAG_SLACK), limit.x + DRAG_SLACK),
    y: Math.min(Math.max(wanted.y, limit.y - DRAG_SLACK), limit.y + DRAG_SLACK),
  };
  safeSetPosition(win, limit.x, limit.y);
  wanderHomeX = null; // 놓은 자리를 새 기준점으로
}

ipcMain.on('mascot:dragStart', () => {
  mascotDragIntent = null;
});
ipcMain.on('mascot:drag', (_e, { dx, dy } = {}) => dragMascot(dx, dy));
ipcMain.on('mascot:click', () => {
  // 인사 + D-day 팝업은 렌더러가 창 안 오버레이로 처리 (안내 패널은 트레이에서)
  scheduleSleep();
});
ipcMain.on('mascot:rightclick', () => {
  toggleDev();
});

ipcMain.handle('guide:getData', () => guideData());
ipcMain.on('guide:close', () => {
  if (guideWin && guideWin.isVisible()) guideWin.hide();
});

// 패널 드래그 — 커서가 화면 밖으로 나가도 창은 경계에서 멈춘다
let guideDragIntent = null;

ipcMain.on('guide:dragStart', () => {
  guideDragIntent = null;
});
ipcMain.on('guide:drag', (_e, { dx, dy } = {}) => {
  if (!guideWin || guideWin.isDestroyed()) return;
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
  const [gw, gh] = guideWin.getSize();
  if (!guideDragIntent) {
    const [x, y] = guideWin.getPosition();
    guideDragIntent = { x, y };
  }
  guideDragIntent = clampedToWorkArea(
    guideDragIntent.x + dx,
    guideDragIntent.y + dy,
    gw,
    gh,
    DRAG_SLACK
  );
  const p = clampedToWorkArea(guideDragIntent.x, guideDragIntent.y, gw, gh);
  guidePinnedPos = p;
  moveGuideTo(p.x, p.y);
});
ipcMain.on('open:external', (_e, url) => {
  if (typeof url === 'string' && /^https?:\/\//.test(url)) shell.openExternal(url);
});

// 개발자 미리보기
ipcMain.handle('dev:getInit', () => ({
  conference: loadConference(),
  items: loadSchedule(),
}));
ipcMain.handle('dev:apply', (_e, opts = {}) => {
  overridePhase = opts.phase || null;
  mockNow = opts.mockNow != null ? opts.mockNow : null;
  showGuide();
  return { now: effNow(), phase: conferencePhase(loadConference()) };
});
// 달팽이 상태/감정 전환 (dev 패널)
ipcMain.on('dev:state', (_e, opts = {}) => {
  handleEvent('state', { state: opts.state, ttl: opts.ttl });
});
// 말풍선 스타일 전환 (dev 패널)
ipcMain.on('dev:bubble', (_e, opts = {}) => {
  sendToMascot('mascot:bubble', { style: opts.style });
});
// 말풍선 폰트 전환 (dev 패널)
ipcMain.on('dev:font', (_e, opts = {}) => {
  sendToMascot('mascot:font', { font: opts.font });
});
ipcMain.on('dev:hide', () => {
  if (devWin && devWin.isVisible()) devWin.hide();
  resetDevOverrides();
});

// ---------------------------------------------------------------------------
// 앱 라이프사이클
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  applyAppBranding();
  if (process.platform === 'darwin' && app.dock) app.dock.hide(); // 독 아이콘 숨김
  createWindow();
  createTray();
  startServer();
  armSchedule();
  scheduleSleep();
  scheduleWander();
  hiddenSweeper = setInterval(sweepHiddenWindows, HIDDEN_SWEEP_MS);

  // 전역 단축키
  globalShortcut.register('CommandOrControl+Shift+M', () => {
    if (!win) return;
    if (win.isVisible()) win.hide();
    else win.show();
  });
  globalShortcut.register('CommandOrControl+Shift+H', () =>
    handleEvent('state', { state: 'greet' })
  );

  const onDisplayChange = () => {
    stopWander();
    clampWindowToScreen(win);
    wanderHomeX = null; // 옮겨진 자리를 새 기준점으로
    if (guideWin && guideWin.isVisible()) positionGuide();
  };
  screen.on('display-metrics-changed', onDisplayChange);
  screen.on('display-added', onDisplayChange);
  screen.on('display-removed', onDisplayChange);

  // 맥이 몇 시간 자고 일어나면 예약은 이미 지나 있고 창은 엉뚱한 곳에 있을 수 있다
  powerMonitor.on('resume', () => {
    armSchedule();
    scheduleSleep();
    clampWindowToScreen(win);
  });

  // 첫 인사
  setTimeout(() => handleEvent('state', { state: 'greet' }), 800);
});

app.on('window-all-closed', () => {
  // 트레이 상주 앱 — 창 닫혀도 종료하지 않음
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopMover();
  stopWander();
  if (wanderTimer) clearTimeout(wanderTimer);
  if (returnTimer) clearTimeout(returnTimer);
  if (sleepTimer) clearTimeout(sleepTimer);
  if (hiddenSweeper) clearInterval(hiddenSweeper);
  scheduledTimers.forEach(cancelScheduled);
  if (server) server.close();
});
