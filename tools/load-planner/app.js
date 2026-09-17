import { PRESETS, evaluate, recommend } from './packing.js';
import { mountScene } from './scene3d.js';

const palette = ['#378882', '#d7a257', '#718cab', '#bd7790', '#8c9a63', '#906fc2', '#c77f67'];
const example = () => [
  { name: '기계 SKID', length: 510, width: 130, height: 150, weight: 3800, qty: 1, rotation: 'floor', stackable: false },
  { name: '부품 목상자', length: 115, width: 90, height: 110, weight: 360, qty: 4, rotation: 'floor', stackable: false },
];
let items = example();
let boxes = PRESETS.map(p => ({ ...p }));
let activeBox = '20DC';
let activeLoad = 0;
let pinnedBox = false;
let activeScene = null;
let selectedKey = null;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(n);

function renderItems() {
  $('cargo-rows').innerHTML = items.map((item, i) => `<div class="cargo-card" data-index="${i}">
    <div class="cargo-card-head"><span class="cargo-swatch" style="background:${palette[i % palette.length]}"></span><strong>화물 ${String(i + 1).padStart(2, '0')}</strong><span class="cargo-index">PACKAGE GROUP</span><button class="delete" type="button" data-delete="${i}" aria-label="화물 ${i + 1} 삭제">×</button></div>
    <div class="field-grid"><div class="field"><label for="name-${i}">화물명</label><input id="name-${i}" data-field="name" value="${esc(item.name)}" maxlength="35" placeholder="예: 기계 SKID"></div>
    ${[['length','L · 길이'],['width','W · 폭'],['height','H · 높이']].map(([key,label])=>`<div class="field"><label for="${key}-${i}">${label} (cm)</label><input id="${key}-${i}" data-field="${key}" type="number" min="0.1" max="3000" step="0.1" inputmode="decimal" value="${item[key]}"></div>`).join('')}</div>
    <div class="field-grid second"><div class="field"><label for="weight-${i}">개당 총중량 (kg)</label><input id="weight-${i}" data-field="weight" type="number" min="0.1" max="100000" step="0.1" inputmode="decimal" value="${item.weight}"></div>
    <div class="field"><label for="qty-${i}">수량 (개)</label><input id="qty-${i}" data-field="qty" type="number" min="1" max="300" step="1" inputmode="numeric" value="${item.qty}"></div>
    <div class="field"><label for="rotation-${i}">화물 회전</label><select id="rotation-${i}" data-field="rotation"><option value="none" ${item.rotation==='none'?'selected':''}>회전 불가</option><option value="floor" ${item.rotation==='floor'?'selected':''}>바닥에서 90°</option><option value="any" ${item.rotation==='any'?'selected':''}>눕힘 포함 6면</option></select></div>
    <div class="field"><label for="stackable-${i}">다단적재</label><select id="stackable-${i}" data-field="stackable" aria-label="화물 ${i + 1} 다단적재 가능 여부"><option value="no" ${!item.stackable?'selected':''}>불가 · 1단만</option><option value="yes" ${item.stackable===true?'selected':''}>가능 · 최대 2단</option><option value="height" ${item.stackable==='height'?'selected':''}>단수 제한 없음 · 높이까지</option></select></div></div>
  </div>`).join('');
  $('row-count').textContent = `${items.length}개 규격 입력 중`;
}

function renderBoxes() {
  $('container-settings').innerHTML = boxes.map((b, i) => `<details class="container-setting"><summary class="setting-toggle"><strong>${b.name}</strong><span class="setting-summary">${fmt(b.length)} × ${fmt(b.width)} × ${fmt(b.height)} cm</span><span class="chevron">⌄</span></summary>
    <div class="setting-body" data-box="${i}"><div class="setting-grid">${[['length','내부 길이 cm'],['width','내부 폭 cm'],['height','내부 높이 cm'],['doorWidth','도어 폭 cm'],['doorHeight','도어 높이 cm'],['payload','최대 적재중량 kg']].map(([key,label])=>`<label>${label}<input data-box-field="${key}" type="number" min="0.1" max="100000" step="0.1" value="${b[key]}"></label>`).join('')}</div><p class="setting-note">내부·도어 각 치수는 선사 참고값보다 5 cm 낮게 설정했습니다. 최대 적재중량은 ${b.name==='20DC'?'23,000':'27,000'} kg 기본값이며 실제 장비에 맞게 수정할 수 있습니다.</p></div></details>`).join('');
}

function validate(gap) {
  if (!items.length) return '화물 규격을 한 개 이상 추가해 주세요.';
  if (items.length > 20) return '한 번에 화물 규격은 최대 20개까지 입력할 수 있습니다.';
  let total = 0;
  for (const [i, v] of items.entries()) {
    for (const key of ['length','width','height','weight']) if (!Number.isFinite(v[key]) || v[key] <= 0) return `화물 ${i + 1}의 ${key === 'weight' ? '중량' : '치수'}를 0보다 크게 입력해 주세요.`;
    if (!Number.isInteger(v.qty) || v.qty < 1) return `화물 ${i + 1}의 수량을 1 이상의 정수로 입력해 주세요.`;
    total += v.qty;
  }
  if (total > 300) return '한 번에 계산할 수 있는 총수량은 300개입니다. 수량을 줄여 주세요.';
  if (!Number.isFinite(gap) || gap < 0 || gap > 20) return '작업 여유는 0~20cm로 입력해 주세요.';
  for (const b of boxes) for (const key of ['length','width','height','doorWidth','doorHeight','payload']) if (!Number.isFinite(b[key]) || b[key] <= 0) return `${b.name}의 치수와 중량을 0보다 크게 입력해 주세요.`;
  return null;
}

function mapSvg(box, placements, gap) {
  const L = box.length, W = box.width;
  const viewWidth = 900, scale = viewWidth / L, viewHeight = W * scale;
  const topByColumn = new Map();
  placements.forEach(p => topByColumn.set(p.columnKey, p));
  const selectedColumn = placements.find(p => p.key === selectedKey)?.columnKey;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" viewBox="-25 -30 ${viewWidth + 50} ${viewHeight + 74}" role="img" aria-label="${esc(box.name)} 바닥 배치 평면도. 총 ${placements.length}개 화물, ${topByColumn.size}개 바닥 자리"><rect x="0" y="0" width="${viewWidth}" height="${viewHeight}" fill="#f0f4f0" stroke="#305e5c" stroke-width="3"/>`];
  if (gap) parts.push(`<rect x="${gap*scale}" y="${gap*scale}" width="${(L-2*gap)*scale}" height="${(W-2*gap)*scale}" fill="none" stroke="#95bbb5" stroke-dasharray="5 4"/>`);
  for (const p of topByColumn.values()) {
    const x=p.x*scale,y=p.y*scale,w=p.w*scale,h=p.d*scale;
    parts.push(`<rect data-package="${esc(p.key)}" data-column="${esc(p.columnKey)}" tabindex="0" class="map-package ${p.columnKey===selectedColumn?'selected':''}" x="${x}" y="${y}" width="${w}" height="${h}" fill="${p.color}" stroke="#ffffff" stroke-width="2" rx="2"><title>${esc(p.label)}: ${fmt(p.w)}×${fmt(p.d)}×${fmt(p.h)} cm, ${fmt(p.weight)} kg${p.stackSize>1?` · 같은 규격 화물과 ${p.stackSize}단 적재`:''}</title></rect>`);
    if (w > 38 && h > 24) parts.push(`<text x="${x+w/2}" y="${y+h/2+4}" text-anchor="middle" font-size="${Math.min(15, Math.max(9,h*.27))}" fill="white" font-weight="700" pointer-events="none">${p.stackSize>1?`${p.stackSize}단`:esc((p.sku+1)+'-'+(Number(p.key.split('-')[1])+1))}</text>`);
  }
  parts.push(`<path d="M ${viewWidth+5} ${viewHeight*.25} L ${viewWidth+17} ${viewHeight*.25} L ${viewWidth+17} ${viewHeight*.75} L ${viewWidth+5} ${viewHeight*.75}" fill="none" stroke="#cc9652" stroke-width="3"/><text x="${viewWidth-1}" y="${viewHeight+27}" text-anchor="end" font-size="14" fill="#7b9594" letter-spacing="2">DOOR →</text><text x="0" y="-12" font-size="12" fill="#849d9a">안쪽 끝</text></svg>`);
  return parts.join('');
}

function updateSelection(packageInfo) {
  if (!packageInfo) return;
  selectedKey = packageInfo.key;
  const detail = document.querySelector?.('#selection-detail');
  if (detail) detail.innerHTML = `<span class="detail-eyebrow">SELECTED CARGO / ${packageInfo.sku + 1}-${Number(packageInfo.key.split('-')[1]) + 1}${packageInfo.stackSize>1?` · ${packageInfo.stackSize}단 중 ${packageInfo.layer}단`:' · 단독 1단'}</span><strong>${esc(packageInfo.label)}</strong><span>${fmt(packageInfo.w)} × ${fmt(packageInfo.d)} × ${fmt(packageInfo.h)} cm <b>·</b> ${fmt(packageInfo.weight)} kg</span><small>${esc(packageInfo.axes)}</small>`;
  document.querySelectorAll?.('[data-package]').forEach(node => node.classList.toggle('selected', node.dataset.package === selectedKey || node.dataset.column === packageInfo.columnKey));
}

function renderResults() {
  activeScene?.destroy(); activeScene = null;
  
  // [수정] clearance 요소가 없을 때 발생하는 에러 방지용 안전 처리
  const clearanceEl = $('clearance');
  const gap = clearanceEl ? Number(clearanceEl.value) : 0;

  const error = validate(gap);
  $('validation').innerHTML = error ? `<div class="error" role="alert">${esc(error)}</div>` : '';
  if (error) { $('result-content').innerHTML = ''; return; }
  const coloredItems = items.map((v,i) => ({ ...v, color: palette[i % palette.length] }));
  const results = boxes.map(box => ({ ...evaluate(coloredItems, box, gap), box }));
  const rec = recommend(results);
  const recBoxId = rec?.box?.id || rec?.box?.name;
  
  if (rec && !pinnedBox && activeBox !== recBoxId) { activeBox = recBoxId; activeLoad = 0; selectedKey = null; }
  if (!results.some(r => (r.box.id || r.box.name) === activeBox)) activeBox = (boxes[0].id || boxes[0].name);
  const chosen = results.find(r => (r.box.id || r.box.name) === activeBox);
  activeLoad = Math.min(activeLoad, Math.max(0, chosen.loads.length - 1));
  const load = chosen.loads[activeLoad];
  if (!load?.placements.some(p => p.key === selectedKey)) selectedKey = load?.placements[0]?.key || null;
  const total = results[0].total, weight = results[0].totalWeight, volume = results[0].totalVolume;
  
  const recommendation = rec ? `<div class="recommendation" aria-live="polite"><div class="rec-head"><span class="rec-icon">✦</span><span>RECOMMENDED LOAD PLAN</span><button type="button" data-recommended="${recBoxId}" class="rec-status">추천안 보기 ↗</button></div><div class="rec-body"><div><h3>${rec.box.name} <span>${rec.containers > 1 ? `× ${rec.containers}대` : '1대'}</span></h3><p>${rec.containers === 1 ? '전량을 한 대에 배치했습니다.' : '전량을 같은 규격의 컨테이너로 분할 배치했습니다.'} ${rec.usedStacking ? `동일 규격 화물 ${rec.usedStacking}곳에 최대 ${rec.maxLayer}단 적재를 적용했습니다.` : '다단적재 없이 바닥 한 층에 배치했습니다.'} 장비 대수가 같으면 총 내부 용적이 작은 안을 추천합니다.</p></div><div class="rec-orb"><strong>${rec.containers}</strong><span>UNIT${rec.containers>1?'S':''}</span></div></div></div>` : `<div class="recommendation alert-rec" aria-live="polite"><div class="rec-head"><span class="rec-icon">!</span><span>REVIEW REQUIRED</span></div><div class="rec-body"><div><h3>조건 확인 필요</h3><p>현재 입력으로는 10대 이내의 완전 배치안을 찾지 못했습니다. 개별 규격·도어·중량을 확인해 주세요.</p></div></div></div>`;
  
  const cards = results.map((r,i) => {
    const boxId = r.box.id || r.box.name;
    const status = r.status === 'fits' ? '1대 가능' : r.status === 'split' ? `${r.containers}대 분할` : r.status === 'impossible' ? '개별 화물 불가' : '10대 내 미확인';
    const detail = r.status === 'impossible' ? r.impossible.map(v=>`${items[v.sku].name || `화물 ${v.sku+1}`}: ${v.reason}`).join(' · ') : `첫 장비 ${r.loads[0]?.placements.length || 0}/${r.total}개 · ${fmt(r.loads[0]?.weight || 0)} kg · ${r.usedStacking?`다단 ${r.usedStacking}곳 · 최대 ${r.maxLayer}단`:'1단 배치'}`;
    const floorPct = r.loads[0] ? Math.min(100, r.loads[0].floorArea / (r.box.length * r.box.width) * 100) : 0;
    return `<button type="button" data-select="${boxId}" class="compare-card ${boxId === activeBox ? 'active' : ''}" aria-pressed="${boxId === activeBox}"><span class="compare-top"><span class="number">0${i+1} / EQUIPMENT ${recBoxId===boxId?'<b>· BEST FIT</b>':''}</span><span class="status ${r.status}">${status}</span></span><strong>${r.box.name}</strong><span class="compare-spec">${fmt(r.box.length)} × ${fmt(r.box.width)} × ${fmt(r.box.height)} cm <b>·</b> ${fmt(r.box.payload/1000)}t</span><span class="mini" title="${esc(detail)}">${esc(detail)}</span><span class="usage-track"><span style="width:${floorPct}%"></span></span><span class="usage-label">첫 장비 바닥 점유 ${fmt(floorPct)}%</span></button>`;
  }).join('');
  
  const breakdown = load ? items.map((item,i)=>({ name:item.name || `화물 ${i+1}`, color:palette[i%palette.length], count:load.placements.filter(p=>p.sku===i).length, total:item.qty })).filter(v=>v.count>0).map(v=>`<span><i style="background:${v.color}"></i>${esc(v.name)} <strong>${v.count}/${v.total}</strong></span>`).join('') : '';
  const loadTabs = chosen.loads.length > 1 ? `<div class="load-tabs" aria-label="컨테이너별 배치">${chosen.loads.map((_,i)=>`<button type="button" data-load="${i}" aria-pressed="${i===activeLoad}" class="${i===activeLoad?'active':''}">${String(i+1).padStart(2,'0')}번 장비</button>`).join('')}</div>` : '';
  const reason = chosen.status === 'impossible' ? chosen.impossible.map(v=>`<div><b>${esc(items[v.sku].name || `화물 ${v.sku+1}`)}</b> — ${esc(v.reason)}</div>`).join('') : '현재 조건에서는 완성된 배치안이 없습니다. 작업 여유와 개별 화물 조건을 재확인하세요.';
  const plan = `<section class="plan-panel" aria-label="적재 시각화"><div class="plan-title"><div><span class="section-number">SPATIAL VIEW / ${chosen.box.name}</span><h3>적재 배치 살펴보기</h3></div><small>${load?.stackCount ? `동일 규격 ${load.stackCount}곳 다단 · 최대 ${load.maxLayer}단` : '바닥 한 층 · 상부 적층 없음'}</small></div>${loadTabs}${load ? `<div class="viewer-grid"><div class="scene-panel"><div class="viewer-topline"><span><i></i> INTERACTIVE 3D</span><span>DRAG TO ROTATE</span></div><div class="scene-area"><canvas id="scene-canvas" tabindex="0" role="group" aria-label="${chosen.box.name} 적재 3D 모델. 드래그로 회전, 휠로 확대, 클릭으로 화물 선택" data-scene-canvas></canvas><div class="axis-label">X · Y · Z <span>cm</span></div></div><div class="scene-toolbar"><span>드래그 회전 · 스크롤 확대 · 화물 클릭</span><div><button type="button" data-scene-action="zoom-out" aria-label="축소">−</button><button type="button" data-scene-action="zoom-in" aria-label="확대">＋</button><button type="button" data-scene-action="top">상부</button><button type="button" data-scene-action="reset">초기화</button></div></div><div class="selected-detail" id="selection-detail"></div></div><div class="blueprint-panel"><div class="blueprint-head"><span><i></i> TOP VIEW / PLAN</span><small>문은 오른쪽</small></div><div class="map-wrap">${mapSvg(chosen.box,load.placements,gap)}</div><p class="map-caption">상자나 3D 모델을 선택하면 크기와 방향을 확인할 수 있습니다. ‘3단’ 같은 표시는 해당 바닥 자리에 쌓인 화물 수입니다.</p><div class="blueprint-metrics"><div><span>배치 수량</span><strong>${load.placements.length} <small>개 · 다단 ${load.stackCount}곳 / 최대 ${load.maxLayer}단</small></strong></div><div><span>화물 중량</span><strong>${fmt(load.weight)} <small>/ ${fmt(chosen.box.payload)} kg</small></strong></div><div><span>바닥 점유</span><strong>${fmt(load.floorArea/(chosen.box.length*chosen.box.width)*100)} <small>%</small></strong></div></div></div></div><div class="legend">${breakdown}</div><details class="orientation-list"><summary>모든 화물의 배치 방향 <span>↗</span></summary><div>${load.placements.map(p=>`<p><b>${esc(p.label)}</b> — ${fmt(p.w)} × ${fmt(p.d)} × ${fmt(p.h)} cm · ${esc(p.axes)}${p.stackSize>1?` · ${p.stackSize}단 중 ${p.layer}단`:''}</p>`).join('')}</div></details>` : `<div class="empty-map"><span>NO VALID LOAD PLAN</span><strong>배치 조건을 확인해 주세요.</strong>${reason}</div>`}</section>`;
  const caution = `<details class="warnings"><summary><span>ⓘ</span> 계산 범위 및 적입 전 확인사항 <b>펼쳐보기 ↗</b></summary><ul><li>‘불가’ 화물은 항상 바닥 1단에 놓이고, ‘최대 2단’ 화물은 그 이상 쌓지 않습니다. ‘단수 제한 없음’은 같은 규격끼리 내부 높이·컨테이너 총중량·입력 수량이 허용하는 단수까지 제안합니다.</li><li>종이 박스라도 상부 허용하중·압궤 강도·포장 상태·적층 작업 가능 여부는 자동 검증하지 않습니다. 다단적재안은 현장 및 포장업체에 확인하세요.</li><li>도어 통과는 각 화물이 놓이는 방향의 폭·높이로 확인합니다. 회전 중 간섭, 지게차 접근과 실제 투입 동선은 별도 검토가 필요합니다.</li><li>고박·바닥 집중하중·축중·도로 중량 제한은 계산에 포함되지 않습니다. 입력 중량은 포장재를 포함한 총중량이어야 합니다.</li><li>선사·장비마다 내부 및 도어 치수와 페이로드가 다릅니다. 배치 실패는 탐색 알고리즘의 한계일 수 있어 불가능의 증명은 아닙니다.</li></ul><p class="source">치수 기준: <a href="https://www.maersk.com/~/media_sc9/maersk/local-information/files/africa/south-africa/important-information/container-type-and-sizes/dry-equipment-specifications-updated.pdf" target="_blank" rel="noopener noreferrer">Maersk dry equipment specifications ↗</a>의 내부·도어 각 치수에서 5 cm를 뺀 기본값입니다. 적재중량은 별도 설정값이며 실제 공급 장비를 확인하세요.</p></details>`;
  
  $('result-content').innerHTML = `${recommendation}<div class="metric-strip"><div><span>01 / 총 화물 수량</span><strong>${fmt(total)}<small>개</small></strong></div><div><span>02 / 포장 포함 총중량</span><strong>${fmt(weight)}<small>kg</small></strong></div><div><span>03 / 화물 체적</span><strong>${fmt(volume)}<small>CBM</small></strong></div></div><div class="compare-title"><div><span class="section-number">EQUIPMENT COMPARISON</span><h3>장비별 비교</h3></div><span>선택하면 배치도가 변경됩니다 <b>↘</b></span></div><div class="compare-grid">${cards}</div>${plan}${caution}`;
  
  const canvas = $('result-content').querySelector?.('[data-scene-canvas]');
  if (canvas && load) { activeScene = mountScene(canvas, chosen.box, load.placements, updateSelection); updateSelection(load.placements.find(p=>p.key===selectedKey) || load.placements[0]); }
}

$('cargo-rows').addEventListener('input', e => {
  const field = e.target.dataset.field;
  if (!field) return;
  const row = Number(e.target.closest('[data-index]').dataset.index);
  items[row][field] = field === 'stackable' ? (e.target.value === 'height' ? 'height' : e.target.value === 'yes') : ['name','rotation'].includes(field) ? e.target.value : Number(e.target.value);
  renderResults();
});

$('cargo-rows').addEventListener('change', e => { if (e.target.dataset.field) renderResults(); });

$('cargo-rows').addEventListener('click', e => {
  const button = e.target.closest('[data-delete]');
  if (!button) return;
  items.splice(Number(button.dataset.delete),1); renderItems(); renderResults();
});

$('container-settings').addEventListener('input', e => {
  const field = e.target.dataset.boxField;
  if (!field) return;
  const idx = Number(e.target.closest('[data-box]').dataset.box);
  boxes[idx][field] = Number(e.target.value);
  const summary = e.target.closest('.container-setting').querySelector('.setting-summary');
  summary.textContent = `${fmt(boxes[idx].length)} × ${fmt(boxes[idx].width)} × ${fmt(boxes[idx].height)} cm`;
  renderResults();
});

// [수정] clearance 요소가 존재하는 경우에만 이벤트 리스너 안전 등록
const clearanceInput = $('clearance');
if (clearanceInput) {
  clearanceInput.addEventListener('input', renderResults);
}

$('add-cargo').addEventListener('click', () => { if (items.length>=20) return; items.push({ name:'',length:100,width:100,height:100,weight:100,qty:1,rotation:'floor',stackable:false }); renderItems(); renderResults(); $('cargo-rows').lastElementChild.querySelector('input').focus(); });

$('example').addEventListener('click', () => { 
  items = example(); 
  boxes = PRESETS.map(p => ({...p})); 
  if ($('clearance')) $('clearance').value = 0; 
  activeBox = '20DC'; 
  activeLoad = 0; 
  pinnedBox = false; 
  selectedKey = null; 
  renderItems(); 
  renderBoxes(); 
  renderResults(); 
});

$('result-content').addEventListener('click', e => {
  const b = e.target.closest('[data-select]');
  if (b) { activeBox = b.dataset.select; activeLoad = 0; selectedKey = null; pinnedBox = true; renderResults(); return; }
  const best = e.target.closest('[data-recommended]');
  if (best) { activeBox = best.dataset.recommended; activeLoad = 0; selectedKey = null; pinnedBox = false; renderResults(); return; }
  const l = e.target.closest('[data-load]');
  if (l) { activeLoad = Number(l.dataset.load); selectedKey = null; renderResults(); return; }
  const action = e.target.closest('[data-scene-action]');
  if (action) { activeScene?.control(action.dataset.sceneAction); return; }
  const packageNode = e.target.closest('[data-package]');
  if (packageNode) activeScene?.select(packageNode.dataset.package);
});

$('result-content').addEventListener('keydown', e => {
  if (['Enter',' '].includes(e.key) && e.target.matches?.('[data-package]')) { e.preventDefault(); activeScene?.select(e.target.dataset.package); }
});

$('show-results')?.addEventListener('click', () => $('results')?.scrollIntoView({behavior:'smooth',block:'start'}));

renderItems(); 
renderBoxes(); 
renderResults();
