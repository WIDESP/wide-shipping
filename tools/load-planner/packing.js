export const PRESETS = [
  { id: '20DC', name: '20DC', length: 584.6, width: 230, height: 234.3, doorWidth: 230, doorHeight: 222.4, payload: 23000 },
  { id: '40HQ', name: '40HQ', length: 1198.2, width: 230, height: 264.7, doorWidth: 229, doorHeight: 252.7, payload: 27000 },
];

const EPS = 0.000001;
const contained = (a, b) => a.x + EPS >= b.x && a.y + EPS >= b.y && a.x + a.w <= b.x + b.w + EPS && a.y + a.h <= b.y + b.h + EPS;
const intersects = (a, b) => a.x < b.x + b.w - EPS && a.x + a.w > b.x + EPS && a.y < b.y + b.h - EPS && a.y + a.h > b.y + EPS;

function orientations(item) {
  const dims = [item.length, item.width, item.height];
  const indices = item.rotation === 'any'
    ? [[0, 1, 2], [1, 0, 2], [0, 2, 1], [2, 0, 1], [1, 2, 0], [2, 1, 0]]
    : item.rotation === 'floor' ? [[0, 1, 2], [1, 0, 2]] : [[0, 1, 2]];
  const seen = new Set();
  return indices.map(([a, b, c]) => ({ l: dims[a], w: dims[b], h: dims[c], axes: `${'LWH'[a]}→길이 · ${'LWH'[b]}→폭 · ${'LWH'[c]}→높이` }))
    .filter(o => { const key = `${o.l}/${o.w}/${o.h}`; if (seen.has(key)) return false; seen.add(key); return true; });
}

export function allowedOrientations(item, box) {
  return orientations(item).filter(o =>
    o.l <= box.length + EPS && o.w <= box.width + EPS && o.h <= box.height + EPS &&
    o.w <= box.doorWidth + EPS && o.h <= box.doorHeight + EPS);
}

function splitFree(free, used) {
  const next = [];
  for (const r of free) {
    if (!intersects(r, used)) { next.push(r); continue; }
    if (used.x > r.x + EPS) next.push({ x: r.x, y: r.y, w: used.x - r.x, h: r.h });
    if (used.x + used.w < r.x + r.w - EPS) next.push({ x: used.x + used.w, y: r.y, w: r.x + r.w - used.x - used.w, h: r.h });
    if (used.y > r.y + EPS) next.push({ x: r.x, y: r.y, w: r.w, h: used.y - r.y });
    if (used.y + used.h < r.y + r.h - EPS) next.push({ x: r.x, y: used.y + used.h, w: r.w, h: r.y + r.h - used.y - used.h });
  }
  return next.filter((r, i) => r.w > EPS && r.h > EPS && !next.some((other, j) => i !== j && contained(r, other) && (j < i || !contained(other, r))));
}

function packOnce(units, box, gap, order) {
  const sorted = [...units].sort((a, b) => {
    const va = order === 'edge' ? Math.max(a.length, a.width) : order === 'weight' ? a.weight : order === 'input' ? -a.order : a.length * a.width;
    const vb = order === 'edge' ? Math.max(b.length, b.width) : order === 'weight' ? b.weight : order === 'input' ? -b.order : b.length * b.width;
    return vb - va || b.length * b.width - a.length * a.width || a.order - b.order;
  });
  // Reserve one gap after each item; the final reserved gap is the far wall margin.
  let free = [{ x: gap, y: gap, w: box.length - gap, h: box.width - gap }];
  const placements = [];
  let weight = 0;
  for (const unit of sorted) {
    if (weight + unit.weight > box.payload + EPS) continue;
    let best = null;
    for (const o of unit.options) {
      const rw = o.l + gap, rh = o.w + gap;
      for (const r of free) {
        if (rw > r.w + EPS || rh > r.h + EPS) continue;
        const short = Math.min(r.w - rw, r.h - rh), long = Math.max(r.w - rw, r.h - rh);
        const score = short * 100000 + long + (r.x + r.y) * 0.00001;
        if (!best || score < best.score) best = { x: r.x, y: r.y, w: o.l, d: o.w, h: o.h, memberHeight: o.memberH, axes: o.axes, score };
      }
    }
    if (!best) continue;
    const used = { x: best.x, y: best.y, w: best.w + gap, h: best.d + gap };
    free = splitFree(free, used);
    placements.push({ ...best, sku: unit.sku, color: unit.color, weight: unit.weight, key: unit.key, members: unit.members });
    weight += unit.weight;
  }
  return { placements, weight, placedKeys: new Set(placements.map(p => p.key)), floorArea: placements.reduce((sum, p) => sum + p.w * p.d, 0) };
}

function bestPack(units, box, gap) {
  const attempts = [];
  for (const order of ['area', 'edge', 'weight', 'input']) {
    const candidate = packOnce(units, box, gap, order);
    if (candidate.placements.length === units.length) return candidate;
    attempts.push(candidate);
  }
  return attempts.sort((a, b) => b.placements.length - a.placements.length || b.floorArea - a.floorArea)[0];
}

function packAll(columns, box, gap, total, totalWeight, totalVolume) {
  let remaining = columns, rawLoads = [];
  while (remaining.length && rawLoads.length < 10) {
    const load = bestPack(remaining, box, gap);
    if (!load.placements.length) break;
    rawLoads.push(load);
    remaining = remaining.filter(u => !load.placedKeys.has(u.key));
  }
  const loads = rawLoads.map(load => ({
    ...load,
    placements: load.placements.flatMap(column => column.members.map((member, index) => ({
      x: column.x, y: column.y, z: index * column.memberHeight,
      w: column.w, d: column.d, h: column.memberHeight, axes: column.axes,
      key: member.key, label: member.label, sku: member.sku,
      color: member.color, weight: member.weight,
      layer: index + 1, stackSize: column.members.length, columnKey: column.key,
    }))),
    stackCount: load.placements.filter(p => p.members.length > 1).length,
    maxLayer: Math.max(1, ...load.placements.map(p => p.members.length)),
  }));
  const placed = loads.reduce((n, load) => n + load.placements.length, 0);
  return { status: remaining.length ? 'limited' : loads.length === 1 ? 'fits' : 'split', loads, total, placed, totalWeight, totalVolume,
    remaining: total - placed, containers: loads.length, usedStacking: loads.reduce((n, load) => n + load.stackCount, 0),
    maxLayer: Math.max(1, ...loads.map(load => load.maxLayer)),
    floorArea: loads.reduce((n, load) => n + load.floorArea, 0) };
}

function stackedColumns(items, singles, box, gap, tierLimit) {
  const columns = [];
  for (const [sku, item] of items.entries()) {
    const row = singles.filter(unit => unit.sku === sku);
    const orientations = allowedOrientations(item, box).filter(o => o.l + 2 * gap <= box.length + EPS && o.w + 2 * gap <= box.width + EPS);
    const allowed = item.stackable === 'height' ? row.length : item.stackable === true ? 2 : 1;
    const heightLimit = Math.max(...orientations.map(o => Math.floor((box.height + EPS) / o.h)));
    const weightLimit = Math.floor((box.payload + EPS) / item.weight);
    const size = Math.min(tierLimit, allowed, heightLimit, weightLimit);
    if (size < 2) { columns.push(...row); continue; }
    for (let i = 0; i < row.length; i += size) {
      const members = row.slice(i, i + size);
      if (members.length === 1) { columns.push(members[0]); continue; }
      const options = orientations.filter(o => o.h * members.length <= box.height + EPS)
        .map(o => ({ ...o, h: o.h * members.length, memberH: o.h }));
      columns.push({ ...members[0], key: `stack-${members[0].key}`, weight: item.weight * members.length,
        members: members.map(unit => unit.members[0]), options });
    }
  }
  return columns;
}

export function evaluate(items, box, gap = 0) {
  const units = items.flatMap((item, sku) => Array.from({ length: item.qty }, (_, i) => ({ ...item, sku, key: `${sku}-${i}`, label: `${item.name || `화물 ${sku + 1}`} ${i + 1}`, order: sku * 1000 + i })));
  const totalWeight = units.reduce((n, u) => n + u.weight, 0);
  const totalVolume = units.reduce((n, u) => n + u.length * u.width * u.height / 1000000, 0);
  const impossible = items.flatMap((item, sku) => {
    if (item.weight > box.payload + EPS) return [{ sku, reason: '개별 중량이 허용 적재중량 초과' }];
    if (!allowedOrientations(item, box).length) return [{ sku, reason: '내부 치수 또는 도어 개구부 통과 불가' }];
    if (!allowedOrientations(item, box).some(o => o.l + 2 * gap <= box.length + EPS && o.w + 2 * gap <= box.width + EPS)) return [{ sku, reason: '설정한 작업 여유를 포함하면 바닥면에 배치 불가' }];
    return [];
  });
  if (impossible.length) return { status: 'impossible', impossible, loads: [], total: units.length, totalWeight, totalVolume, placed: 0, usedStacking: 0 };
  const singles = units.map(unit => ({ ...unit, members: [unit], options: allowedOrientations(unit, box).map(o => ({ ...o, memberH: o.h })) }));
  const baseline = packAll(singles, box, gap, units.length, totalWeight, totalVolume);
  const unlimited = items.some(item => item.stackable === 'height');
  const maxTier = unlimited ? Math.max(...items.filter(item => item.stackable === 'height').map(item =>
    Math.min(item.qty, Math.floor((box.payload + EPS) / item.weight),
      Math.max(...allowedOrientations(item, box).filter(o => o.l + 2 * gap <= box.length + EPS && o.w + 2 * gap <= box.width + EPS)
        .map(o => Math.floor((box.height + EPS) / o.h)))))) : 2;
  const tiers = unlimited ? [2, ...new Set([3, 4, 6, 8, maxTier].filter(n => n <= maxTier))] : [2];
  const candidates = [baseline];
  for (const tier of tiers) {
    const columns = stackedColumns(items, singles, box, gap, tier);
    if (columns.length === singles.length) continue;
    candidates.push(packAll(columns, box, gap, units.length, totalWeight, totalVolume));
  }
  const complete = candidates.filter(result => result.status !== 'limited');
  if (complete.length) return complete.sort((a, b) => a.containers - b.containers ||
    (unlimited ? a.floorArea - b.floorArea || b.maxLayer - a.maxLayer : a.usedStacking - b.usedStacking))[0];
  return candidates.sort((a, b) => b.placed - a.placed || a.containers - b.containers)[0];
}

export function recommend(results) {
  return results.filter(r => ['fits', 'split'].includes(r.status)).sort((a, b) => a.containers - b.containers || a.containers * a.box.length * a.box.width * a.box.height - b.containers * b.box.length * b.box.width * b.box.height)[0] || null;
}
