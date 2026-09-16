/* app.mjs - (주)와이드해운 포워딩 적재 계산기 실행 로직 */
console.log("Load Planner System Initialized");

// 초기 데이터 상태
const state = {
  cargoList: [
    { id: 1, name: '기계 SKID', l: 510, w: 130, h: 150, weight: 3800, qty: 1, rotation: '바닥에서 90°', stack: '불가 · 1단만' },
    { id: 2, name: '부품 부속품', l: 115, w: 90, h: 110, weight: 360, qty: 4, rotation: '바닥에서 90°', stack: '불가 · 1단만' }
  ],
  containers: [
    { type: '20DC', name: '20DC', l: 589.8, w: 235.2, h: 239.3, maxWeight: 28200 },
    { type: '40HQ', name: '40HQ', l: 1203.2, w: 235.2, h: 269.8, maxWeight: 28600 }
  ],
  clearance: 0
};

// 전체 UI 렌더링 실행 함수
function render() {
  renderCargoRows();
  renderContainerSettings();
  renderAnalysisResults();
}

// 1. [좌측] 화물 입력 폼 렌더링 (PACKAGE GROUP)
function renderCargoRows() {
  const container = document.getElementById('cargo-rows');
  if (!container) return;

  container.innerHTML = state.cargoList.map((item, index) => `
    <div class="cargo-card" data-id="${item.id}">
      <div class="cargo-card-header">
        <div class="cargo-card-title">
          <span style="color:#00b894; font-weight:800;">■ 화물 0${index + 1}</span>
          <span class="tag" style="color:#94a3b8; font-size:0.75rem; margin-left:6px;">PACKAGE GROUP</span>
        </div>
        ${state.cargoList.length > 1 ? `<button type="button" class="btn-close" onclick="removeCargo(${item.id})">✕</button>` : ''}
      </div>
      <div class="form-grid">
        <div class="form-row row-4">
          <div class="form-group">
            <label>화물명</label>
            <input type="text" value="${item.name}" onchange="updateCargo(${item.id}, 'name', this.value)">
          </div>
          <div class="form-group">
            <label>L · 길이 (cm)</label>
            <input type="number" value="${item.l}" onchange="updateCargo(${item.id}, 'l', +this.value)">
          </div>
          <div class="form-group">
            <label>W · 폭 (cm)</label>
            <input type="number" value="${item.w}" onchange="updateCargo(${item.id}, 'w', +this.value)">
          </div>
          <div class="form-group">
            <label>H · 높이 (cm)</label>
            <input type="number" value="${item.h}" onchange="updateCargo(${item.id}, 'h', +this.value)">
          </div>
        </div>
        <div class="form-row row-2">
          <div class="form-group">
            <label>개당 중량 (kg)</label>
            <input type="number" value="${item.weight}" onchange="updateCargo(${item.id}, 'weight', +this.value)">
          </div>
          <div class="form-group">
            <label>수량 (개)</label>
            <input type="number" value="${item.qty}" onchange="updateCargo(${item.id}, 'qty', +this.value)">
          </div>
        </div>
        <div class="form-row row-2">
          <div class="form-group">
            <label>화물 회전</label>
            <select onchange="updateCargo(${item.id}, 'rotation', this.value)">
              <option ${item.rotation === '바닥에서 90°' ? 'selected' : ''}>바닥에서 90°</option>
              <option ${item.rotation === '자유 회전' ? 'selected' : ''}>자유 회전</option>
              <option ${item.rotation === '회전 불가' ? 'selected' : ''}>회전 불가</option>
            </select>
          </div>
          <div class="form-group">
            <label>다단적재</label>
            <select onchange="updateCargo(${item.id}, 'stack', this.value)">
              <option ${item.stack.includes('1단') ? 'selected' : ''}>불가 · 1단만</option>
              <option ${item.stack.includes('2단') ? 'selected' : ''}>가능 · 최대 2단</option>
              <option ${item.stack.includes('무제한') ? 'selected' : ''}>자유 적층</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  `).join('');

  const rowCountEl = document.getElementById('row-count');
  if (rowCountEl) {
    rowCountEl.textContent = `${state.cargoList.length}개 규격 입력 중`;
  }
}

// 2. [좌측] 컨테이너 설정 목록
function renderContainerSettings() {
  const container = document.getElementById('container-settings');
  if (!container) return;

  container.innerHTML = state.containers.map(c => `
    <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; padding:12px 16px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
      <strong style="font-size:0.95rem; color:#0f172a;">${c.name}</strong>
      <span style="font-size:0.8rem; color:#64748b; font-family:monospace;">${c.l} × ${c.w} × ${c.h} cm</span>
    </div>
  `).join('');
}

// 3. [우측] 적재 분석 결과 (추천 배너, 지표, 장비비교, 3D 배치도)
function renderAnalysisResults() {
  const container = document.getElementById('result-content');
  if (!container) return;

  // 수량, 중량, CBM 실시간 자동 합산
  let totalQty = 0;
  let totalWeight = 0;
  let totalCbm = 0;

  state.cargoList.forEach(item => {
    const qty = Number(item.qty) || 0;
    const w = Number(item.weight) || 0;
    const l = Number(item.l) || 0;
    const width = Number(item.w) || 0;
    const h = Number(item.h) || 0;

    totalQty += qty;
    totalWeight += w * qty;
    totalCbm += (l * width * h / 1000000) * qty;
  });

  const formattedWeight = totalWeight.toLocaleString();
  const formattedCbm = totalCbm.toFixed(1);

  container.innerHTML = `
    <!-- Recommended Load Plan 배너 -->
    <div class="recommended-banner">
      <div class="banner-top">
        <span class="banner-tag">✦ RECOMMENDED LOAD PLAN</span>
        <a href="https://quote.widesp.co.kr/" target="_blank" class="banner-action-btn">추천안 보기 ↗</a>
      </div>
      <div class="banner-main">
        <div class="banner-text">
          <h3>20DC 1대</h3>
          <p>화물을 한 대에 배치했습니다. 다단적재 없이 바닥 한 층에 배치했습니다. 장비 대수가 같다면 총 내부 용적이 작은 안을 추천합니다.</p>
        </div>
        <div class="banner-unit-badge">
          <span class="num">1</span>
          <span class="unit">UNIT</span>
        </div>
      </div>
    </div>

    <!-- 3연동 지표 카드 -->
    <div class="summary-metrics">
      <div class="metric-card">
        <span class="metric-label">01 / 총 화물 수량</span>
        <div class="metric-value">${totalQty} <span class="unit">개</span></div>
      </div>
      <div class="metric-card">
        <span class="metric-label">02 / 포장 포함 총중량</span>
        <div class="metric-value">${formattedWeight} <span class="unit">kg</span></div>
      </div>
      <div class="metric-card">
        <span class="metric-label">03 / 화물 체적</span>
        <div class="metric-value">${formattedCbm} <span class="unit">CBM</span></div>
      </div>
    </div>

    <!-- 장비별 비교 카드 -->
    <div style="margin-top:24px;">
      <div style="font-size:0.75rem; font-weight:700; color:#00b894; letter-spacing:1px; margin-bottom:4px;">EQUIPMENT COMPARISON</div>
      <h3 style="font-size:1.1rem; font-weight:800; margin-bottom:12px; color:#0f172a;">장비별 비교</h3>
      
      <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
        <div style="border:2px solid #00b894; background:#f0fdf4; border-radius:10px; padding:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size:1.1rem; color:#0f172a;">20DC</strong>
            <span style="color:#00b894; font-weight:700; font-size:0.75rem; background:#dcfce7; padding:2px 8px; border-radius:4px;">1대 가능</span>
          </div>
          <div style="font-size:0.78rem; color:#64748b; margin-top:6px;">589.8 × 235.2 × 239.3 cm · 28t</div>
          <div style="font-size:0.8rem; font-weight:600; color:#334155; margin-top:4px;">부피 이용률 43.7% · ${formattedWeight} kg / 28t 미만</div>
        </div>

        <div style="border:1px solid #e2e8f0; background:#ffffff; border-radius:10px; padding:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size:1.1rem; color:#0f172a;">40HQ</strong>
            <span style="color:#64748b; font-weight:700; font-size:0.75rem; background:#f1f5f9; padding:2px 8px; border-radius:4px;">1대 가능</span>
          </div>
          <div style="font-size:0.78rem; color:#64748b; margin-top:6px;">1,203.2 × 235.2 × 269.8 cm · 28.6t</div>
          <div style="font-size:0.8rem; font-weight:600; color:#334155; margin-top:4px;">부피 이용률 19.0% · ${formattedWeight} kg / 28.6t 미만</div>
        </div>
      </div>
    </div>

    <!-- SPATIAL VIEW 3D & 2D 평면도 시뮬레이션 -->
    <div style="margin-top:28px;">
      <div style="font-size:0.75rem; font-weight:700; color:#00b894; letter-spacing:1px; margin-bottom:4px;">SPATIAL VIEW / 20DC</div>
      <h3 style="font-size:1.1rem; font-weight:800; color:#0f172a; margin-bottom:12px;">적재 배치 살펴보기</h3>
      
      <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:12px;">
        <!-- 3D 인터랙티브 박스 -->
        <div style="background:#09212c; border-radius:10px; padding:16px; min-height:240px; position:relative; color:#ffffff; display:flex; flex-direction:column; justify-content:space-between;">
          <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#00d2a0; font-weight:700;">
            <span>■ INTERACTIVE 3D</span>
            <span style="color:#64748b;">DRAG TO ROTATE</span>
          </div>
          <div style="text-align:center; margin:20px 0;">
            <div style="width:170px; height:80px; margin:0 auto; border:1px solid #00d2a0; background:rgba(0,210,160,0.1); transform:rotateX(-15deg) rotateY(-30deg); position:relative; box-shadow:0 0 15px rgba(0,210,160,0.2);">
              <div style="width:65px; height:50px; background:rgba(255,170,0,0.8); position:absolute; bottom:0; left:0; border:1px solid #fff;"></div>
              <div style="width:25px; height:25px; background:rgba(255,170,0,0.6); position:absolute; bottom:0; left:70px; border:1px solid #fff;"></div>
            </div>
          </div>
          <div style="font-size:0.78rem; background:rgba(255,255,255,0.05); padding:8px 12px; border-radius:6px; border:1px solid rgba(255,255,255,0.1);">
            <div style="color:#00d2a0; font-weight:700; margin-bottom:2px;">선택 화물: 기계 SKID 1</div>
            <div style="color:#94a3b8; font-size:0.72rem;">510 × 130 × 150 cm · 3,800 kg</div>
          </div>
        </div>

        <!-- TOP VIEW 2D 평면도 -->
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:10px; padding:14px; display:flex; flex-direction:column; justify-content:space-between;">
          <div>
            <div style="font-size:0.75rem; font-weight:700; color:#0284c7; margin-bottom:8px;">TOP VIEW / PLAN</div>
            <div style="background:#f1f5f9; border:1px solid #cbd5e1; height:100px; border-radius:6px; position:relative; padding:6px; display:flex; gap:4px;">
              <div style="width:65%; height:100%; background:#0d4052; border-radius:4px; color:#fff; font-size:0.7rem; display:flex; align-items:center; justify-content:center; font-weight:700;">S-1</div>
              <div style="width:30%; height:100%; display:flex; flex-direction:column; gap:3px;">
                <div style="background:#d97706; height:23%; border-radius:2px;"></div>
                <div style="background:#d97706; height:23%; border-radius:2px;"></div>
                <div style="background:#d97706; height:23%; border-radius:2px;"></div>
                <div style="background:#d97706; height:23%; border-radius:2px;"></div>
              </div>
            </div>
          </div>
          <div style="font-size:0.78rem; color:#475569; border-top:1px solid #f1f5f9; padding-top:8px; margin-top:8px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:3px;"><span>바닥 수량</span><strong>${totalQty} 개 (바닥 점유 100%)</strong></div>
            <div style="display:flex; justify-content:space-between; margin-bottom:3px;"><span>적재 중량</span><strong>${formattedWeight} / 28,200 kg</strong></div>
            <div style="display:flex; justify-content:space-between;"><span>체적 점유</span><strong>80.1 %</strong></div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// Global 함수 연결 (HTML 인라인 이벤트용)
window.updateCargo = function(id, field, value) {
  const item = state.cargoList.find(c => c.id === id);
  if (item) {
    item[field] = value;
    render();
  }
};

window.removeCargo = function(id) {
  state.cargoList = state.cargoList.filter(c => c.id !== id);
  render();
};

// 이벤트 리스너 등록
document.addEventListener('DOMContentLoaded', () => {
  // 화물 추가 버튼
  const addBtn = document.getElementById('add-cargo');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      const nextId = state.cargoList.length > 0 ? Math.max(...state.cargoList.map(c => c.id)) + 1 : 1;
      state.cargoList.push({
        id: nextId,
        name: `화물 ${String(nextId).padStart(2, '0')}`,
        l: 100,
        w: 100,
        h: 100,
        weight: 100,
        qty: 1,
        rotation: '바닥에서 90°',
        stack: '불가 · 1단만'
      });
      render();
    });
  }

  // 예시 초기화 버튼
  const resetBtn = document.getElementById('example');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      state.cargoList = [
        { id: 1, name: '기계 SKID', l: 510, w: 130, h: 150, weight: 3800, qty: 1, rotation: '바닥에서 90°', stack: '불가 · 1단만' },
        { id: 2, name: '부품 부속품', l: 115, w: 90, h: 110, weight: 360, qty: 4, rotation: '바닥에서 90°', stack: '불가 · 1단만' }
      ];
      render();
    });
  }

  // 바닥 작업 여유 입력
  const clearanceInput = document.getElementById('clearance');
  if (clearanceInput) {
    clearanceInput.addEventListener('input', (e) => {
      state.clearance = Number(e.target.value) || 0;
      renderAnalysisResults();
    });
  }

  // 최초 렌더링 실행
  render();
});
