const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function shade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(Math.round(((n >> 16) & 255) * factor), 0, 255);
  const g = clamp(Math.round(((n >> 8) & 255) * factor), 0, 255);
  const b = clamp(Math.round((n & 255) * factor), 0, 255);
  return `rgb(${r},${g},${b})`;
}

function inPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

// A lightweight orthographic renderer. Dimensions and placement positions remain in cm.
export function mountScene(canvas, box, placements, onSelect) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return { destroy() {}, control() {}, select() {} };
  let yaw = -0.62, pitch = 0.61, zoom = 1, selected = placements[0]?.key;
  let frame = 0, width = 1, height = 1, regions = [], pointer = null;
  const dpr = clamp(window.devicePixelRatio || 1, 1, 2);

  function raw(x, y, z) {
    const X = x - box.length / 2, Y = y - box.width / 2;
    const side = X * Math.sin(yaw) + Y * Math.cos(yaw);
    return { u: X * Math.cos(yaw) - Y * Math.sin(yaw), v: side * Math.sin(pitch) - z * Math.cos(pitch), depth: side * Math.cos(pitch) + z * Math.sin(pitch) };
  }

  function projectFactory() {
    const corners = [];
    for (const x of [0, box.length]) for (const y of [0, box.width]) for (const z of [0, box.height]) corners.push(raw(x, y, z));
    const minU = Math.min(...corners.map(c => c.u)), maxU = Math.max(...corners.map(c => c.u));
    const minV = Math.min(...corners.map(c => c.v)), maxV = Math.max(...corners.map(c => c.v));
    const scale = Math.min((width - 54) / Math.max(1, maxU - minU), (height - 62) / Math.max(1, maxV - minV)) * zoom;
    const cx = width / 2 - (minU + maxU) * scale / 2, cy = height / 2 - (minV + maxV) * scale / 2 + 12;
    return (x, y, z) => { const p = raw(x, y, z); return { x: cx + p.u * scale, y: cy + p.v * scale, depth: p.depth }; };
  }

  function polygon(points, fill, stroke, lineWidth = 1) {
    ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.lineWidth = lineWidth; ctx.strokeStyle = stroke; ctx.stroke(); }
  }

  function line(a, b, stroke = 'rgba(137,223,225,.26)', weight = 1) {
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    ctx.strokeStyle = stroke; ctx.lineWidth = weight; ctx.stroke();
  }

  function draw() {
    frame = 0;
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, '#061c2b'); bg.addColorStop(.55, '#0b2c3c'); bg.addColorStop(1, '#103d48');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
    const halo = ctx.createRadialGradient(width * .48, height * .5, 10, width * .48, height * .5, width * .75);
    halo.addColorStop(0, 'rgba(30,200,206,.17)'); halo.addColorStop(1, 'rgba(30,200,206,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, width, height);
    const P = projectFactory();
    const floor = [P(0,0,0),P(box.length,0,0),P(box.length,box.width,0),P(0,box.width,0)];
    polygon(floor, 'rgba(47,112,129,.15)', 'rgba(110,216,221,.78)', 1.5);
    const xStep = box.length > 800 ? 200 : 100;
    for (let x = xStep; x < box.length; x += xStep) line(P(x,0,0),P(x,box.width,0),'rgba(80,168,177,.18)');
    for (let y = 50; y < box.width; y += 50) line(P(0,y,0),P(box.length,y,0),'rgba(80,168,177,.18)');

    const faces = [];
    for (const cargo of placements) {
      const x=cargo.x, y=cargo.y, base=cargo.z || 0, z=base+cargo.h, X=x+cargo.w, Y=y+cargo.d;
      const A=P(x,y,base),B=P(X,y,base),C=P(X,Y,base),D=P(x,Y,base);
      const a=P(x,y,z),b=P(X,y,z),c=P(X,Y,z),d=P(x,Y,z);
      const sides = [[A,B,b,a],[B,C,c,b],[C,D,d,c],[D,A,a,d]];
      sides.forEach((poly,i) => faces.push({ cargo, poly, fill: shade(cargo.color,i%2===0?.62:.74), depth: poly.reduce((v,p)=>v+p.depth,0)/4 }));
      faces.push({ cargo, poly:[a,b,c,d], fill:shade(cargo.color,1.27), depth:(a.depth+b.depth+c.depth+d.depth)/4, top:true });
    }
    faces.sort((a,b)=>a.depth-b.depth);
    regions=[];
    for (const face of faces) {
      const selectedFace = face.cargo.key === selected;
      ctx.shadowBlur = selectedFace ? 16 : 0;
      ctx.shadowColor = selectedFace ? '#9dfaff' : 'transparent';
      polygon(face.poly, face.fill, selectedFace ? '#dcffff' : 'rgba(188,241,240,.55)', selectedFace ? 1.8 : .7);
      ctx.shadowBlur = 0;
      regions.push({ key:face.cargo.key, poly:face.poly });
      if (face.top && selectedFace) {
        const center = face.poly.reduce((acc,p)=>({x:acc.x+p.x/4,y:acc.y+p.y/4}),{x:0,y:0});
        ctx.fillStyle='#ffffff';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='700 11px system-ui';
        if (Math.max(...face.poly.map(p=>p.x))-Math.min(...face.poly.map(p=>p.x))>35) ctx.fillText(`${face.cargo.sku+1}-${Number(face.cargo.key.split('-')[1])+1}`,center.x,center.y);
      }
    }
    const a=P(0,0,box.height), b=P(box.length,0,box.height), c=P(box.length,box.width,box.height), d=P(0,box.width,box.height);
    line(a,b,'rgba(134,229,231,.58)',1.2);line(b,c,'rgba(134,229,231,.58)',1.2);line(c,d,'rgba(134,229,231,.58)',1.2);line(d,a,'rgba(134,229,231,.58)',1.2);
    [[P(0,0,0),a],[P(box.length,0,0),b],[P(box.length,box.width,0),c],[P(0,box.width,0),d]].forEach(([p,q])=>line(p,q,'rgba(134,229,231,.42)',1));
    line(P(box.length,0,0),b,'#eab974',2);line(b,c,'#eab974',2);line(c,P(box.length,box.width,0),'#eab974',2);
    ctx.fillStyle='#f1c987';ctx.font='700 10px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
    const door=P(box.length,box.width/2,0);ctx.fillText('DOOR',door.x,door.y+18);
  }

  function schedule() { if (!frame) frame=requestAnimationFrame(draw); }
  function resize() {
    const rect=canvas.getBoundingClientRect();
    width=Math.max(100,rect.width);height=Math.max(100,rect.height);
    canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);schedule();
  }
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  if (observer) observer.observe(canvas); else { window.addEventListener('resize',resize); resize(); }

  function down(e) { pointer={ x:e.clientX,y:e.clientY,moved:false }; canvas.setPointerCapture?.(e.pointerId); }
  function move(e) {
    if (!pointer) return;
    const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;
    if (Math.abs(dx)+Math.abs(dy)>2) pointer.moved=true;
    if (pointer.moved) { yaw+=dx*.008;pitch=clamp(pitch-dy*.006,.2,1.5);schedule(); }
    pointer.x=e.clientX;pointer.y=e.clientY;
  }
  function up(e) {
    if (!pointer) return;
    if (!pointer.moved) {
      const rect=canvas.getBoundingClientRect(),point={x:e.clientX-rect.left,y:e.clientY-rect.top};
      const hit=regions.slice().reverse().find(region=>inPolygon(point,region.poly));
      if (hit) select(hit.key);
    }
    pointer=null;
  }
  function wheel(e) { e.preventDefault();zoom=clamp(zoom*(e.deltaY<0?1.08:.92),.66,1.85);schedule(); }
  function select(key) { selected=key; schedule();onSelect?.(placements.find(p=>p.key===key)); }
  function control(action) {
    if (action==='reset') {yaw=-.62;pitch=.61;zoom=1;}
    if (action==='top') {yaw=0;pitch=1.49;zoom=1;}
    if (action==='zoom-in') zoom=clamp(zoom*1.17,.66,1.85);
    if (action==='zoom-out') zoom=clamp(zoom/1.17,.66,1.85);
    schedule();
  }
  canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);
  canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);
  canvas.addEventListener('wheel',wheel,{passive:false});
  function keydown(e) {
    const mapping={ArrowLeft:()=>yaw-=.12,ArrowRight:()=>yaw+=.12,ArrowUp:()=>pitch=clamp(pitch+.1,.2,1.5),ArrowDown:()=>pitch=clamp(pitch-.1,.2,1.5),'+':()=>zoom=clamp(zoom*1.15,.66,1.85),'-':()=>zoom=clamp(zoom/1.15,.66,1.85)};
    if (mapping[e.key]){e.preventDefault();mapping[e.key]();schedule();}if(e.key.toLowerCase()==='r')control('reset');
  }
  canvas.addEventListener('keydown',keydown);
  return { select, control, destroy(){if(frame)cancelAnimationFrame(frame);observer?.disconnect();if(!observer)window.removeEventListener('resize',resize);canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('keydown',keydown);} };
}
