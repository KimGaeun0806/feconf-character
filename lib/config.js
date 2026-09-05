'use strict';

const path = require('path');
const fs = require('fs');
const { app, nativeImage } = require('electron');
const TIME = require('../shared/time');

const ROOT = path.join(__dirname, '..');

const DEFAULT_CONFIG = {
  port: 7842, // 웹훅 HTTP 서버 포트
  token: '', // 설정 시 웹훅 요청에 x-token 헤더 필요 (빈 값이면 인증 없음)
  width: 315, // 달팽이 좌하단 + 말풍선/D-day 팝업 우상단 구성
  height: 260,
  margin: 24, // 화면 모서리로부터 여백
  corner: 'bottom-right', // bottom-right | bottom-left | top-right | top-left
  idleSleepMs: 90 * TIME.SEC, // 이 시간 동안 이벤트 없으면 잠자기
  guideTitle: '컨퍼런스 안내',
  guideSubtitle: '오늘의 세션',
  guideWidth: 320,
  guideHeight: 500, // before/after 화면이 스크롤 없이 들어가는 높이
};

const APP_NAME = 'FEConf Mascot';
const APP_ICON_PATH = path.join(ROOT, 'assets', 'icon.png');
// 파일명이 Template 로 끝나면 macOS 가 메뉴바 밝기에 맞춰 자동 반전한다.
const TRAY_ICON_PATH = path.join(ROOT, 'assets', 'trayTemplate.png');

function loadConfig() {
  const cfgPath = path.join(ROOT, 'config.json');
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

module.exports = {
  ROOT,
  DEFAULT_CONFIG,
  APP_NAME,
  APP_ICON_PATH,
  TRAY_ICON_PATH,
  loadConfig,
  appIcon,
  applyAppBranding,
};
