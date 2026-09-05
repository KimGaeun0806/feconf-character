'use strict';

const fs = require('fs');
const path = require('path');

// character/*.json — 마름모 아트보드 포맷
// 짧은 버전·미리보기 SVG 는 쓰지 않는다 — *-long 애니와 bubble-* 만 읽어 시작을 가볍게
function loadAnims(characterDir) {
  const out = {};
  try {
    for (const f of fs.readdirSync(characterDir)) {
      if (!f.endsWith('.json')) continue;
      const base = path.basename(f, '.json');
      if (!base.endsWith('-long') && !base.startsWith('bubble-')) continue;
      try {
        out[base] = JSON.parse(fs.readFileSync(path.join(characterDir, f), 'utf8'));
      } catch (e) {
        console.error('[anims] 파싱 실패:', f, e.message);
      }
    }
  } catch (e) {
    console.error('[anims] 읽기 실패:', e.message);
  }
  return out;
}

module.exports = { loadAnims };
