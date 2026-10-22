/*
 * WIDE SHIPPING | Load Planner Spatial View Pop-out Extension
 * 2026-10-22 — Standalone, framework-independent enhancement.
 * Install AFTER existing planner scripts (or with defer):
 * <script src="/tools/load-planner/wide-load-planner-zoom.js" defer></script>
 * No external dependencies, no change to original CLP logic.
 */
(function () {
  'use strict';
  if (window.__WIDE_SPATIAL_ZOOM_INSTALLED__) return;
  window.__WIDE_SPATIAL_ZOOM_INSTALLED__ = true;

  const FLAG = 'wide_spatial_popup';
  const POPUP_MODE = new URLSearchParams(location.search).get(FLAG) === '1';
  const CLASS = 'wlpz';
  const PLANNER_TAG = 'WIDE_PLANNER_ZOOM_SYNC';
  const RX_TITLE = /적재\s*배치\s*살펴보기/;
  const RX_3D = /INTERACTIVE\s*3D/i;
  const RX_PLAN = /TOP\s*VIEW(?:\s*\/\s*PLAN)?/i;
  let currentRoot = null;
  let currentPopup = null;
  let syncTimer = 0;
  let transferBusy = false;
  let fullscreen = false;
  let activeFullscreenNodes = [];

  const css = `
    .wlpz-actions { display:inline-flex !important; flex-wrap:wrap; align-items:center;
      gap:8px; margin-left:auto; position:relative; z-index:5; }
    .wlpz-btn { appearance:none; border:1px solid #19b8c6; color:#02636e;
      background:#e9fbfc; border-radius:7px; padding:9px 13px; font-size:12px;
      font-family:inherit; font-weight:750; line-height:1.3; cursor:pointer;
      white-space:nowrap; box-shadow:0 2px 8px rgba(0,0,0,.05); }
    .wlpz-btn:hover { background:#c9f5f8; }
    .wlpz-btn:focus-visible { outline:3px solid #36d3de; outline-offset:2px; }
    .wlpz-btn.wlpz-primary { color:#fff; background:#007e91; border-color:#007e91; }
    .wlpz-btn.wlpz-primary:hover { background:#006271; }
    .wlpz-btn.wlpz-dark { color:#fff; background:#063441; border-color:#31b8c5; }
    .wlpz-zoom-toolbar { display:flex !important; gap:8px; align-items:center;
      justify-content:flex-end; width:100%; padding:6px 2px 11px;
      box-sizing:border-box; flex-shrink:0; }
    .wlpz-plan-toolbar { display:flex; justify-content:flex-end; align-items:center;
      gap:6px; padding:8px !important; background:#f0f9fa; flex-wrap:wrap; }
    .wlpz-plan-toolbar .wlpz-btn { padding:5px 10px; font-size:12px; }
    .wlpz-plan-toolbar .wlpz-scale { color:#0d5360; font-size:12px; font-weight:800; }
    .wlpz-zoom-toolbar .wlpz-title { color:#1e4353; font-size:14px;
      font-weight:800; margin-right:auto; padding:0 6px; }
    .wlpz-expanded {
      position:fixed !important; inset:0 !important; width:100vw !important;
      max-width:none !important; min-width:0 !important;
      height:100dvh !important; max-height:none !important;
      box-sizing:border-box !important; z-index:2147483000 !important;
      background:#f5f9fb !important; overflow:auto !important;
      padding:16px 22px 24px !important; border-radius:0 !important;
      margin:0 !important; transform:none !important; isolation:isolate;
      display:flex !important; flex-direction:column !important;
    }
    .wlpz-expanded .wlpz-expanded-layout { width:100% !important;
      max-width:none !important; min-width:0 !important;
      display:grid !important; grid-template-columns:minmax(0,1.8fr) minmax(0,1fr) !important;
      gap:12px !important; flex:1 1 auto; align-items:stretch;
    }
    .wlpz-expanded .wlpz-3d-panel,
    .wlpz-expanded .wlpz-plan-panel { min-width:0 !important;
      width:100% !important; max-width:none !important; box-sizing:border-box;
      height:100% !important; }
    .wlpz-expanded .wlpz-3d-canvas-wrap { min-height:390px !important;
      height:min(66vh,780px) !important; max-height:none !important; }
    .wlpz-expanded .wlpz-3d-canvas-wrap > canvas { display:block;
      width:100% !important; height:100% !important; }
    .wlpz-expanded .wlpz-plan-svg { width:100% !important; height:auto !important;
      max-height:min(58vh,700px) !important; }
    html.wlpz-page-zoom, body.wlpz-page-zoom { overflow:hidden !important; }
    html.wlpz-popup, body.wlpz-popup { width:100% !important; min-width:0 !important;
      min-height:100% !important; margin:0 !important; padding:0 !important;
      background:#f5f9fb !important; overflow:hidden !important; }
    .wlpz-popup .wlpz-expanded { z-index:99999999 !important; }
    @media(max-width:800px) {
      .wlpz-expanded { padding:10px !important; }
      .wlpz-expanded .wlpz-expanded-layout { grid-template-columns:1fr !important; }
      .wlpz-expanded .wlpz-3d-canvas-wrap { height:52vh !important;
        min-height:290px !important; }
      .wlpz-zoom-toolbar { flex-wrap:wrap; }
      .wlpz-zoom-toolbar .wlpz-title { width:100%; }
    }
  `;
  function addStyles() {
    if (document.getElementById('wlpz-css')) return;
    const st = document.createElement('style');
    st.id = 'wlpz-css';
    st.textContent = css;
    (document.head || document.documentElement).appendChild(st);
  }
  function ownTextNode(rx, scope = document.body) {
    if (!scope) return null;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.parentElement || /^(SCRIPT|STYLE|NOSCRIPT|SVG|BUTTON)$/i.test(node.parentElement.tagName))
          return NodeFilter.FILTER_REJECT;
        const txt = (node.nodeValue || '').replace(/\s+/g, ' ').trim();
        return txt.length && txt.length < 180 && rx.test(txt)
          ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const match = walker.nextNode();
    return match ? match.parentElement : null;
  }
  function locateRoot() {
    const title = ownTextNode(RX_TITLE);
    if (!title) return null;
    let cur = title;
    while (cur && cur !== document.body) {
      const t = cur.textContent || '';
      if (RX_3D.test(t) && RX_PLAN.test(t)) return { root: cur, title };
      cur = cur.parentElement;
    }
    return null;
  }
  function makeBtn(label, primary, onClick) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wlpz-btn' + (primary ? ' wlpz-primary' : '');
    btn.textContent = label;
    btn.addEventListener('click', onClick);
    return btn;
  }
  function injectActions(found) {
    if (!found || !found.root || !found.title) return;
    currentRoot = found.root;
    if (POPUP_MODE || currentRoot.querySelector('.wlpz-actions')) return;
    const row = document.createElement('div');
    row.className = 'wlpz-actions';
    row.appendChild(makeBtn('↗ 새 창에서 크게 보기', true, openPopout));
    row.appendChild(makeBtn('⛶ 화면 전체 확대', false, enterFullscreen));
    const title = found.title;
    const container = title.parentElement;
    if (container) {
      container.style.display = 'flex';
      container.style.alignItems = 'center';
      container.style.flexWrap = 'wrap';
      container.style.gap = '8px';
      container.appendChild(row);
    }
  }
  function modelLabel(root) {
    const value = (root.textContent || '').match(/SPATIAL\s*VIEW\s*\/\s*(20DC|40DC|40HQ|45HQ)/i);
    return value ? value[1].toUpperCase() : '';
  }
  function getInputList(doc) {
    return Array.from(doc.querySelectorAll('input,select,textarea')).filter(e =>
      !e.closest('.wlpz-zoom-toolbar, .wlpz-actions') && !e.disabled);
  }
  function sourceSnapshot() {
    return {
      model: currentRoot ? modelLabel(currentRoot) : '',
      inputs: getInputList(document).map(e => ({
        tag: e.tagName, type: (e.type || '').toLowerCase(),
        id: e.id || '', name: e.name || '', value: e.value,
        checked: Boolean(e.checked)
      }))
    };
  }
  function requestResize() {
    // Give the original 3D renderer and any ResizeObserver a chance to resize.
    window.dispatchEvent(new Event('resize'));
    if (typeof ResizeObserver !== 'undefined' && currentRoot) {
      // Original app owns its rendering; do not create/replace its canvas/context.
      currentRoot.getBoundingClientRect();
    }
    setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
    setTimeout(() => window.dispatchEvent(new Event('resize')), 480);
  }
  function findPanel(scope, rx, visualSelector) {
    const marker = ownTextNode(rx, scope);
    if (!marker) return null;
    let cur = marker;
    while (cur && cur !== scope) {
      const visual = cur.querySelector && cur.querySelector(visualSelector);
      if (visual && (cur.textContent || '').length < (scope.textContent || '').length) return cur;
      cur = cur.parentElement;
    }
    return null;
  }
  function commonAncestor(a, b, root) {
    if (!a || !b) return null;
    let cur = a;
    while (cur && cur !== root.parentElement) {
      if (cur.contains(b)) return cur;
      cur = cur.parentElement;
    }
    return null;
  }
  function markViewerNodes(root) {
    const panel3d = findPanel(root, RX_3D, 'canvas');
    const panelPlan = findPanel(root, RX_PLAN, 'svg,canvas');
    const pair = commonAncestor(panel3d, panelPlan, root);
    if (pair && pair !== root) pair.classList.add('wlpz-expanded-layout');
    if (panel3d && panel3d !== pair) {
      panel3d.classList.add('wlpz-3d-panel');
      const canvas = panel3d.querySelector('canvas');
      if (canvas && canvas.parentElement) canvas.parentElement.classList.add('wlpz-3d-canvas-wrap');
    }
    if (panelPlan && panelPlan !== pair) {
      panelPlan.classList.add('wlpz-plan-panel');
      const svg = panelPlan.querySelector('svg');
      if (svg) svg.classList.add('wlpz-plan-svg');
    }
    // Fallback for sites where the 3D view is not rendered in <canvas>.
    if (!pair) {
      const a = ownTextNode(RX_3D, root);
      const b = ownTextNode(RX_PLAN, root);
      if (a && b) {
        const fallback = commonAncestor(a.parentElement, b.parentElement, root);
        if (fallback && fallback !== root) fallback.classList.add('wlpz-expanded-layout');
      }
    }
  }
  function addPlanZoomControls(root) {
    const panel = findPanel(root, RX_PLAN, 'svg');
    if (!panel || panel.querySelector('.wlpz-plan-toolbar')) return;
    const svg = panel.querySelector('svg');
    if (!svg || !svg.parentElement) return;
    const viewport = svg.parentElement;
    const originalTransform = svg.style.transform;
    const originalOrigin = svg.style.transformOrigin;
    const originalOverflow = viewport.style.overflow;
    let scale = 1;
    const bar = document.createElement('div');
    bar.className = 'wlpz-plan-toolbar';
    const status = document.createElement('span');
    status.className = 'wlpz-scale';
    status.textContent = '평면도 100%';
    const paint = () => {
      svg.style.transform = scale === 1 ? originalTransform : `scale(${scale})`;
      svg.style.transformOrigin = 'left top';
      viewport.style.overflow = 'auto';
      status.textContent = `평면도 ${Math.round(scale * 100)}%`;
    };
    bar.appendChild(status);
    bar.appendChild(makeBtn('−', false, () => { scale = Math.max(1, +(scale - .25).toFixed(2)); paint(); }));
    bar.appendChild(makeBtn('+', false, () => { scale = Math.min(3, +(scale + .25).toFixed(2)); paint(); }));
    bar.appendChild(makeBtn('초기화', false, () => { scale = 1; paint(); }));
    // Restore the SVG's exact styles when same-page fullscreen is closed.
    bar.restoreStyles = () => {
      svg.style.transform = originalTransform;
      svg.style.transformOrigin = originalOrigin;
      viewport.style.overflow = originalOverflow;
    };
    panel.insertBefore(bar, panel.firstChild);
  }
  function addToolbar(root, isPopup) {
    const previous = root.querySelector('.wlpz-zoom-toolbar');
    if (previous) previous.remove();
    const bar = document.createElement('div');
    bar.className = 'wlpz-zoom-toolbar';
    const title = document.createElement('span');
    title.className = 'wlpz-title';
    title.textContent = 'WIDE SHIPPING  /  적재 배치 확대 보기';
    bar.appendChild(title);
    if (isPopup) {
      bar.appendChild(makeBtn('↻ 현재 적재 정보 다시 가져오기', false, () => {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: PLANNER_TAG, action: 'request' }, location.origin);
        }
      }));
      bar.appendChild(makeBtn('✕ 창 닫기', true, () => window.close()));
    } else {
      bar.appendChild(makeBtn('↗ 새 창으로 열기', false, openPopout));
      bar.appendChild(makeBtn('✕ 확대 종료', true, exitFullscreen));
    }
    root.insertBefore(bar, root.firstChild);
  }
  function expand(root, isPopup) {
    if (!root) return;
    root.classList.add('wlpz-expanded');
    document.documentElement.classList.add('wlpz-page-zoom');
    document.body.classList.add('wlpz-page-zoom');
    markViewerNodes(root);
    addToolbar(root, isPopup);
    addPlanZoomControls(root);
    requestResize();
  }
  function enterFullscreen() {
    if (fullscreen) return;
    const found = locateRoot();
    if (!found) return window.alert('3D 적재 배치 화면을 찾을 수 없습니다. 분석 결과를 먼저 표시해 주세요.');
    currentRoot = found.root;
    fullscreen = true;
    expand(currentRoot, false);
    activeFullscreenNodes = [currentRoot];
  }
  function exitFullscreen() {
    fullscreen = false;
    activeFullscreenNodes.forEach(root => {
      root.classList.remove('wlpz-expanded');
      root.querySelectorAll('.wlpz-expanded-layout,.wlpz-3d-panel,.wlpz-plan-panel,.wlpz-3d-canvas-wrap,.wlpz-plan-svg').forEach(el => {
        el.classList.remove('wlpz-expanded-layout','wlpz-3d-panel','wlpz-plan-panel','wlpz-3d-canvas-wrap','wlpz-plan-svg');
      });
      const planBar = root.querySelector('.wlpz-plan-toolbar');
      if (planBar) { if (planBar.restoreStyles) planBar.restoreStyles(); planBar.remove(); }
      const bar = root.querySelector('.wlpz-zoom-toolbar');
      if (bar) bar.remove();
    });
    activeFullscreenNodes = [];
    document.documentElement.classList.remove('wlpz-page-zoom');
    document.body.classList.remove('wlpz-page-zoom');
    requestResize();
  }
  function openPopout() {
    const url = new URL(location.href);
    url.searchParams.set(FLAG, '1');
    const width = Math.min(1640, Math.max(1000, Math.round(screen.availWidth * .94)));
    const height = Math.min(1050, Math.max(700, Math.round(screen.availHeight * .90)));
    const left = Math.max(0, Math.round((screen.availWidth - width) / 2));
    const top = Math.max(0, Math.round((screen.availHeight - height) / 2));
    currentPopup = window.open(url.toString(), 'WIDE_SHIPPING_LOAD_PLANNER_POPUP',
      `popup=yes,resizable=yes,scrollbars=yes,width=${width},height=${height},left=${left},top=${top}`);
    if (!currentPopup) {
      // The in-page full-view fallback is still interactive and retains camera state.
      enterFullscreen();
      window.alert('브라우저에서 새 창이 차단되어 현재 화면을 전체 확대했습니다. 새 창을 허용하면 별도 창으로 볼 수 있습니다.');
      return;
    }
    currentPopup.focus();
    setTimeout(sendSnapshot, 600);
    setTimeout(sendSnapshot, 1700);
  }
  function sendSnapshot() {
    if (!currentPopup || currentPopup.closed || !currentRoot) return;
    currentPopup.postMessage({type: PLANNER_TAG, action: 'snapshot', data: sourceSnapshot()}, location.origin);
  }
  async function applySnapshot(data) {
    if (!POPUP_MODE || transferBusy || !data || !Array.isArray(data.inputs)) return;
    transferBusy = true;
    try {
      const source = data.inputs;
      let target = getInputList(document);
      // Recreate additional cargo rows using the site's own Add Cargo button.
      const addButton = Array.from(document.querySelectorAll('button')).find(btn =>
        /화물\s*규격\s*추가|화물\s*추가|ADD\s*CARGO/i.test(btn.textContent || ''));
      for (let i = 0; addButton && i < 24 && target.length < source.length; i++) {
        const before = target.length;
        addButton.click();
        await new Promise(resolve => setTimeout(resolve, 90));
        target = getInputList(document);
        if (target.length <= before) break;
      }
      const byId = new Map(target.filter(e => e.id).map(e => [e.id, e]));
      const named = new Map();
      target.forEach(e => { if (e.name) (named.get(e.name) || (named.set(e.name, []), named.get(e.name))).push(e); });
      const namedIx = new Map();
      let changed = false;
      for (let i = 0; i < source.length; i++) {
        const item = source[i];
        let element = item.id && byId.get(item.id);
        if (!element && item.name && named.has(item.name)) {
          const ix = namedIx.get(item.name) || 0;
          element = named.get(item.name)[ix];
          namedIx.set(item.name, ix + 1);
        }
        if (!element) element = target[i];
        if (!element || element.tagName !== item.tag) continue;
        if (item.type === 'checkbox' || item.type === 'radio') {
          if (element.checked !== item.checked) {
            element.checked = item.checked;
            element.dispatchEvent(new Event('change', {bubbles: true}));
            changed = true;
          }
        } else if (element.value !== item.value) {
          // Browser-native setter also notifies frameworks using controlled inputs.
          const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
            : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value');
          if (setter && setter.set) setter.set.call(element, item.value);
          else element.value = item.value;
          element.dispatchEvent(new Event('input', {bubbles:true}));
          element.dispatchEvent(new Event('change', {bubbles:true}));
          changed = true;
        }
      }
      // Select the equipment selected in the opener when controls are buttons.
      if (data.model) {
        const choices = Array.from(document.querySelectorAll('button,[role="tab"]'));
        const eqButton = choices.find(b => (b.textContent || '').trim().toUpperCase() === data.model);
        if (eqButton) { eqButton.click(); changed = true; }
      }
      if (changed) {
        // Prefer the site's own analyze/apply action when one is present.
        const run = Array.from(document.querySelectorAll('button')).find(b =>
          /적재\s*분석|배치\s*계산|분석\s*시작|적재\s*계산/i.test(b.textContent || ''));
        if (run) run.click();
      }
      requestResize();
    } catch (error) {
      console.warn('[WIDE LOAD PLANNER] Popout values could not all be synced:', error);
    } finally {
      transferBusy = false;
    }
  }
  function hideNonViewer(root) {
    // Only in the separate popup page. Preserve source website and source DOM.
    let child = root;
    let parent = child.parentElement;
    while (parent && parent !== document.documentElement) {
      for (const sibling of Array.from(parent.children)) {
        if (sibling !== child && !/^(SCRIPT|STYLE|LINK)$/i.test(sibling.tagName))
          sibling.style.setProperty('display', 'none', 'important');
      }
      if (parent !== document.body) {
        parent.style.setProperty('max-width', 'none', 'important');
        parent.style.setProperty('width', '100%', 'important');
        parent.style.setProperty('padding', '0', 'important');
        parent.style.setProperty('margin', '0', 'important');
        parent.style.setProperty('overflow', 'visible', 'important');
        parent.style.setProperty('transform', 'none', 'important');
      }
      child = parent;
      parent = parent.parentElement;
    }
    document.documentElement.classList.add('wlpz-popup');
    document.body.classList.add('wlpz-popup');
  }
  function setUpPopup(root) {
    currentRoot = root;
    hideNonViewer(root);
    expand(root, true);
    // Grab values once the original planner application has completed initial render.
    if (window.opener && !window.opener.closed) {
      setTimeout(() => window.opener.postMessage({type:PLANNER_TAG,action:'request'}, location.origin), 180);
      setTimeout(() => window.opener.postMessage({type:PLANNER_TAG,action:'request'}, location.origin), 950);
    }
  }
  window.addEventListener('message', evt => {
    if (evt.origin !== location.origin || !evt.data || evt.data.type !== PLANNER_TAG) return;
    if (POPUP_MODE && evt.data.action === 'snapshot') applySnapshot(evt.data.data);
    if (!POPUP_MODE && evt.data.action === 'request') {
      if (evt.source && currentRoot) evt.source.postMessage(
        {type:PLANNER_TAG,action:'snapshot',data:sourceSnapshot()}, location.origin);
    }
  });
  document.addEventListener('keydown', evt => {
    if (evt.key === 'Escape' && fullscreen && !POPUP_MODE) exitFullscreen();
  });
  function initialize() {
    const found = locateRoot();
    if (!found) return false;
    currentRoot = found.root;
    if (POPUP_MODE) {
      if (!found.root.classList.contains('wlpz-expanded')) setUpPopup(found.root);
    } else {
      injectActions(found);
    }
    return true;
  }
  function start() {
    addStyles();
    if (!initialize()) {
      let tries = 0;
      const observer = new MutationObserver(() => {
        if (initialize() || ++tries > 250) observer.disconnect();
      });
      observer.observe(document.body, {childList: true, subtree: true});
      setTimeout(() => observer.disconnect(), 20000);
    }
    if (!POPUP_MODE) {
      document.addEventListener('input', () => {
        clearTimeout(syncTimer); syncTimer = setTimeout(sendSnapshot, 450);
      }, true);
      document.addEventListener('change', () => {
        clearTimeout(syncTimer); syncTimer = setTimeout(sendSnapshot, 450);
      }, true);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
