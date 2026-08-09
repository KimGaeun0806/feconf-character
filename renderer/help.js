'use strict';

// 사용 안내 — 좌우 화살표로 넘기는 몇 장짜리 안내. 처음 실행할 때 저절로 뜨고,
// "다시 보지 않기" 를 켜고 닫으면 다음부터는 트레이 메뉴로만 열린다.

const PAGES = [
  {
    emoji: '🐌',
    title: '달팽이가 왔어요',
    lead: '화면 위에 머물면서 작업에 따라 표정이 바뀌어요.',
    rows: [
      ['클릭', '인사 + 한마디'],
      ['두 번 클릭', 'D-day 팝업'],
      ['끌기', '원하는 자리로'],
    ],
    note: '컨퍼런스 안내는 메뉴 막대에서 열어요.',
  },
  {
    emoji: '📋',
    title: '컨퍼런스 안내',
    lead: '날짜에 따라 세 가지로 바뀌어요.',
    rows: [
      ['행사 전', 'D-day · 날짜 · 장소'],
      ['당일', '다음 세션까지 남은 시간'],
      ['행사 후', '후기 남기기'],
    ],
  },
  {
    emoji: '🔔',
    title: '세션 알림',
    lead: '세션이 시작하기 전에 미리 알려줘요.',
    rows: [
      ['방해 금지', '잠시 조용히'],
      ['⌘⇧M', '숨기기 / 보이기'],
      ['⌘⇧H', '인사시키기'],
    ],
  },
  {
    emoji: '🔌',
    title: '프로젝트에 연결하기',
    lead: '빌드·성능 반응을 쓰려면 프로젝트에 한 번 설치해요.',
    code: 'npm i -D feconf-2026-mascot',
    codeLabel: '설치',
    rows: [
      ['앱', 'npx feconf-2026-mascot'],
      ['빌드', 'npx feconf-2026 npm run build'],
      ['dev', 'npx feconf-2026 npm run dev'],
    ],
  },
  {
    emoji: '🔧',
    title: '빌드에 반응해요',
    lead: '설치 후 명령을 감싸면 표정이 바뀌어요.',
    code: 'npx feconf-2026 npm run build',
    codeLabel: '명령',
  },
  {
    emoji: '💯',
    title: '성능도 봐줘요',
    lead: 'dev 서버를 감싸면 LCP · INP · CLS 를 재요.',
    code: 'npx feconf-2026 npm run dev',
    codeLabel: '명령',
  },
];

const $ = (id) => document.getElementById(id);
const pageEl = $('page');
const dotsEl = $('dots');
const prevBtn = $('prev');
const nextBtn = $('next');

let idx = 0;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function renderPage(dir) {
  const p = PAGES[idx];
  pageEl.innerHTML = '';

  const stack = el('div', 'p-stack');

  const hero = el('div', 'p-hero');
  hero.appendChild(el('div', 'p-emoji', p.emoji));
  stack.appendChild(hero);

  stack.appendChild(el('div', 'p-title', p.title));
  if (p.lead) stack.appendChild(el('p', 'p-lead', p.lead));

  if (p.code) {
    const wrap = el('div', 'p-code-wrap');
    wrap.appendChild(el('div', 'p-code-label', p.codeLabel || '명령'));
    wrap.appendChild(el('div', 'p-code', p.code));
    stack.appendChild(wrap);
  }

  if (p.rows && p.rows.length) {
    const ul = el('ul', 'p-list');
    for (const [key, val] of p.rows) {
      const li = el('li', 'p-row');
      li.appendChild(el('span', 'p-key', key));
      li.appendChild(el('span', 'p-val', val));
      ul.appendChild(li);
    }
    stack.appendChild(ul);
  }

  if (p.note) stack.appendChild(el('p', 'p-note', p.note));

  pageEl.appendChild(stack);

  // 넘긴 방향으로 밀려 들어오게
  if (dir) {
    pageEl.style.setProperty('--from', dir > 0 ? '12px' : '-12px');
    pageEl.classList.remove('turn');
    void pageEl.offsetWidth;
    pageEl.classList.add('turn');
  }

  pageEl.scrollTop = 0;
  prevBtn.disabled = idx === 0;
  nextBtn.disabled = idx === PAGES.length - 1;
  syncDots();
}

function syncDots() {
  const dots = dotsEl.children;
  for (let i = 0; i < dots.length; i++) {
    const on = i === idx;
    dots[i].classList.toggle('on', on);
    dots[i].setAttribute('aria-selected', on ? 'true' : 'false');
  }
}

function buildDots() {
  dotsEl.innerHTML = '';
  PAGES.forEach((_, i) => {
    const b = el('button', 'dot');
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-label', `${i + 1}번째 페이지`);
    b.addEventListener('click', () => go(i));
    dotsEl.appendChild(b);
  });
}

function go(next) {
  const target = Math.max(0, Math.min(PAGES.length - 1, next));
  if (target === idx) return;
  const dir = target > idx ? 1 : -1;
  idx = target;
  renderPage(dir);
}

prevBtn.addEventListener('click', () => go(idx - 1));
nextBtn.addEventListener('click', () => go(idx + 1));

function close() {
  if (window.help) window.help.close({ dontShowAgain: $('never-box').checked });
}
$('close').addEventListener('click', close);

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') go(idx + 1);
  else if (e.key === 'ArrowLeft') go(idx - 1);
  else if (e.key === 'Escape') close();
});

// 헤더를 잡고 창 옮기기 — 마스코트·컨퍼런스 안내와 같은 방식(직접 좌표 이동)
if (window.bindPanelDrag && window.help) {
  window.bindPanelDrag(document.querySelector('header'), {
    ignore: 'button',
    onStart: () => window.help.dragStart(),
    onMove: (dx, dy) => window.help.drag(dx, dy),
  });
}
// 다시 열 때는 늘 첫 장부터
if (window.help && window.help.onShow) {
  window.help.onShow(() => {
    idx = 0;
    renderPage(0);
  });
}

buildDots();
renderPage(0);
