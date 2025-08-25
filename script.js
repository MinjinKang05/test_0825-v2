// ==== Canvas setup ====
const cvs = document.getElementById('sky');
const ctx = cvs.getContext('2d', { alpha: true });
const DPR = Math.min(devicePixelRatio || 1, 2);
let W=0, H=0;

function resize(){
  W = Math.floor(innerWidth);
  H = Math.floor(innerHeight);
  cvs.width  = W * DPR;
  cvs.height = H * DPR;
  cvs.style.width  = W + 'px';
  cvs.style.height = H + 'px';
  ctx.setTransform(DPR,0,0,DPR,0,0);
}
addEventListener('resize', resize); resize();

// ==== State & Controls ====
const state = { t:0, speed:1, id:null, drawEnabled:true };
const toggleBtn = document.getElementById('toggle');
const speedRange = document.getElementById('speed');
const drawToggleBtn = document.getElementById('drawToggle');
const clearBtn = document.getElementById('clearLines');

speedRange.addEventListener('input', e => state.speed = Number(e.target.value));
drawToggleBtn?.addEventListener('click', ()=>{
  state.drawEnabled = !state.drawEnabled;
  if (drawToggleBtn){
    drawToggleBtn.textContent = state.drawEnabled ? '✏️ Draw On' : '✏️ Draw Off';
    drawToggleBtn.setAttribute('aria-pressed', String(!state.drawEnabled));
  }
});
clearBtn?.addEventListener('click', ()=> { edges.length = 0; });

function start(){
  if(state.id==null){
    lastTS = 0;
    state.id = requestAnimationFrame(loop);
    if (toggleBtn){
      toggleBtn.textContent = '⏸ Pause';
      toggleBtn.setAttribute('aria-pressed','false');
    }
  }
}
function stop(){
  if(state.id!=null){
    cancelAnimationFrame(state.id); // ← cancelAnimationFrame 사용
    state.id = null;
    if (toggleBtn){
      toggleBtn.textContent = '▶ Play';
      toggleBtn.setAttribute('aria-pressed','true');
    }
  }
}
toggleBtn?.addEventListener('click', ()=> state.id==null ? start() : stop());
addEventListener('keydown', e=>{
  if(e.code==='Space'){ e.preventDefault(); state.id==null?start():stop(); }
});

// ==== Stars generation ====
// 더 진하고 선명하게 보이도록 alpha/size/twinkle 강화
const STAR_LAYERS = [
  { count: 80,  size: [1.6, 2.6], twinkle: [1.0, 1.5], parallax: 0.18, alpha: 1.0 },
  { count: 160, size: [1.0, 1.6], twinkle: [0.8, 1.2], parallax: 0.33, alpha: 0.85 },
  { count: 260, size: [0.7, 1.2], twinkle: [0.6, 1.0], parallax: 0.5,  alpha: 0.65 }
];
function rand(a,b){ return a + Math.random()*(b-a); }

function genStars(){
  const arr = [];
  for(const L of STAR_LAYERS){
    for(let i=0;i<L.count;i++){
      arr.push({
        x: Math.random()*W,
        y: Math.random()*H,
        r: rand(L.size[0], L.size[1]),
        tw: Math.random()*Math.PI*2,     // twinkle phase
        twAmp: rand(L.twinkle[0], L.twinkle[1]),
        layer: L
      });
    }
  }
  return arr;
}
let stars = genStars();

// ==== Pointer & Parallax ====
const pointer = { x: W/2, y: H/2, active:false };
cvs.addEventListener('pointermove', e=>{
  const r = cvs.getBoundingClientRect();
  pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top; pointer.active = true;
});
cvs.addEventListener('pointerleave', ()=> pointer.active=false);

// ==== Constellation drawing (edges) ====
let lastStarIndex = null;
const edges = []; // {a: idx, b: idx, life: 1.0}
const MAX_EDGE_LENGTH = 180;

function nearestStar(px,py){
  let idx = -1, dmin = Infinity;
  for(let i=0;i<stars.length;i++){
    const s = stars[i];
    const dx = s.x - px, dy = s.y - py;
    const d = Math.hypot(dx, dy);
    if(d < dmin){ dmin = d; idx = i; }
  }
  return (dmin<MAX_EDGE_LENGTH) ? idx : -1;
}
cvs.addEventListener('pointermove', ()=>{
  if(!state.drawEnabled) return;
  const idx = nearestStar(pointer.x, pointer.y);
  if(idx === -1) return;
  if(lastStarIndex !== null && lastStarIndex !== idx){
    edges.push({ a: lastStarIndex, b: idx, life: 1.0 });
    if(edges.length > 240) edges.splice(0, edges.length - 240);
  }
  lastStarIndex = idx;
});
cvs.addEventListener('pointerdown', ()=>{
  if(!state.drawEnabled) return;
  for(let k=0;k<3;k++){
    const idx = nearestStar(pointer.x + rand(-10,10), pointer.y + rand(-10,10));
    if(idx !== -1 && lastStarIndex !== null && lastStarIndex !== idx){
      edges.push({ a:lastStarIndex, b:idx, life:1.0 });
    }
    lastStarIndex = idx;
  }
});
cvs.addEventListener('pointerleave', ()=> { lastStarIndex = null; });

// ==== Shooting star (comet) ====
let comet = null;
function maybeSpawnComet(dt){
  if(comet || Math.random() > 0.008) return;
  const side = Math.random()<0.5 ? 'left' : 'top';
  const speed = rand(380, 560); // 살짝 더 빠르게
  if(side==='left'){
    comet = { x:-40, y:rand(0,H*0.6), vx:speed, vy:speed*rand(0.06,0.2), life:1.0 };
  } else {
    comet = { x:rand(0,W*0.7), y:-40, vx:speed*rand(0.06,0.2), vy:speed, life:1.0 };
  }
}
function updateComet(dt){
  if(!comet) return;
  comet.x += comet.vx * dt * state.speed;
  comet.y += comet.vy * dt * state.speed;
  comet.life -= dt * 0.4;
  if(comet.x > W+60 || comet.y > H+60 || comet.life<=0) comet = null;
}
function drawComet(){
  if(!comet) return;
  const len = 120;
  const ang = Math.atan2(comet.vy, comet.vx);
  ctx.save();
  ctx.globalAlpha = Math.max(0, comet.life);
  ctx.translate(comet.x, comet.y);
  const grad = ctx.createLinearGradient(0,0, -len, 0);
  grad.addColorStop(0,'rgba(255,255,255,0.98)');
  grad.addColorStop(1,'rgba(255,255,255,0)');
  ctx.rotate(ang);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0,0);
  ctx.lineTo(-len, 6);
  ctx.lineTo(-len, -6);
  ctx.closePath();
  ctx.fill();
  ctx.rotate(-ang);
  ctx.beginPath();
  ctx.arc(0,0,3.8,0,Math.PI*2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.restore();
}

// ==== NEW: Orbiting star groups (회전하는 별 군집) ====
// 화면 곳곳에 중심별(pivot)을 두고, 작은 위성별들이 궤도를 빙글빙글 도는 효과
const ORBIT_GROUPS = [];
function genOrbitGroups(){
  ORBIT_GROUPS.length = 0;
  const groupCount = 4; // 회전 군집 개수 (원하면 늘려도 돼)
  for(let g=0; g<groupCount; g++){
    const pivot = { x: rand(W*0.15, W*0.85), y: rand(H*0.2, H*0.8) };
    const satCount = Math.floor(rand(3,6));
    const sats = [];
    for(let i=0;i<satCount;i++){
      sats.push({
        r: rand(35, 90),           // 궤도 반경
        size: rand(1.2, 2.2),      // 위성별 크기
        ang: rand(0, Math.PI*2),   // 초기 각도
        spd: rand(0.4, 1.2),       // 공전 속도
        tw: Math.random()*Math.PI*2,
        twAmp: rand(0.8, 1.4)
      });
    }
    ORBIT_GROUPS.push({ pivot, sats });
  }
}
genOrbitGroups();

// ==== Render helpers ====
function drawBackground(){
  const g = ctx.createLinearGradient(0,0,0,H);
  g.addColorStop(0,'rgba(8,12,28,0.5)');
  g.addColorStop(1,'rgba(2,4,12,0.8)');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,W,H);
}

function drawStars(t){
  // 패럴럭스 오프셋
  const ox = pointer.active ? (pointer.x - W/2)/36 : 0;
  const oy = pointer.active ? (pointer.y - H/2)/36 : 0;

  for(const s of stars){
    const flicker = 0.75 + 0.35*Math.sin(t*1.7*s.twAmp + s.tw);
    const px = s.x - ox*s.layer.parallax;
    const py = s.y - oy*s.layer.parallax;

    // 중앙 코어
    ctx.globalAlpha = s.layer.alpha * flicker;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, s.r, 0, Math.PI*2);
    ctx.fill();

    // 글로우(살짝 크게)
    const g = ctx.createRadialGradient(px, py, 0, px, py, s.r*3.5);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(px, py, s.r*3.5, 0, Math.PI*2); ctx.fill();

    // 크로스 플레어(큰 별만)
    if(s.r > 1.7){
      ctx.save();
      ctx.globalAlpha = 0.35 * flicker;
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(px-6, py); ctx.lineTo(px+6, py); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(px, py-6); ctx.lineTo(px, py+6); ctx.stroke();
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
}

function drawConstellationLines(dt){
  for(const e of edges){ e.life -= dt * 0.25; }
  for(let i=edges.length-1;i>=0;i--){ if(edges[i].life<=0) edges.splice(i,1); }

  ctx.save();
  ctx.lineWidth = 1.35; // 조금 더 진하게
  for(const e of edges){
    const a = stars[e.a], b = stars[e.b];
    if(!a || !b) continue;
    const alpha = Math.max(0, Math.min(1, e.life));
    ctx.strokeStyle = `rgba(200,220,255,${0.6*alpha})`;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();

    // 선 중앙 반짝임
    const mx = (a.x + b.x)/2, my = (a.y + b.y)/2;
    ctx.fillStyle = `rgba(255,255,255,${0.35*alpha})`;
    ctx.beginPath(); ctx.arc(mx, my, 2.0, 0, Math.PI*2); ctx.fill();
  }
  ctx.restore();
}

function drawPointerGlow(){
  if(!pointer.active) return;
  const r = 80;
  const g = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, r);
  g.addColorStop(0,'rgba(120,180,255,0.28)');
  g.addColorStop(1,'rgba(120,180,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(pointer.x, pointer.y, r, 0, Math.PI*2); ctx.fill();
}

// 회전 군집 업데이트/그리기
function updateAndDrawOrbitGroups(dt, t){
  ctx.save();
  for(const group of ORBIT_GROUPS){
    // 피벗(중심별)
    const flicker = 0.8 + 0.2*Math.sin(t*1.4);
    ctx.globalAlpha = 0.95;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(group.pivot.x, group.pivot.y, 2.2, 0, Math.PI*2); ctx.fill();

    // 피벗 글로우
    const gg = ctx.createRadialGradient(group.pivot.x, group.pivot.y, 0, group.pivot.x, group.pivot.y, 10);
    gg.addColorStop(0, 'rgba(180,200,255,0.35)');
    gg.addColorStop(1, 'rgba(180,200,255,0)');
    ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(group.pivot.x, group.pivot.y, 10, 0, Math.PI*2); ctx.fill();

    // 위성별들
    for(const s of group.sats){
      s.ang += s.spd * dt * state.speed;
      const px = group.pivot.x + Math.cos(s.ang) * s.r;
      const py = group.pivot.y + Math.sin(s.ang) * s.r * 0.92; // 살짝 타원

      const tw = 0.75 + 0.25*Math.sin(t*1.8*s.twAmp + s.tw);

      // 연결선(궤도 느낌)
      ctx.globalAlpha = 0.14;
      ctx.strokeStyle = 'rgba(200,220,255,0.6)';
      ctx.beginPath();
      ctx.ellipse(group.pivot.x, group.pivot.y, s.r, s.r*0.92, 0, 0, Math.PI*2);
      ctx.stroke();

      // 위성별
      ctx.globalAlpha = 1 * tw;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(px, py, s.size, 0, Math.PI*2); ctx.fill();

      // 위성별 글로우
      const g = ctx.createRadialGradient(px, py, 0, px, py, s.size*4);
      g.addColorStop(0,'rgba(255,255,255,0.35)');
      g.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(px, py, s.size*4, 0, Math.PI*2); ctx.fill();

      // 살짝 꼬리(속도감)
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 0.8;
      const tail = 6 + s.spd*4;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - Math.cos(s.ang)*tail, py - Math.sin(s.ang)*tail*0.92);
      ctx.stroke();
      ctx.restore();
    }
  }
  ctx.restore();
}

// ==== Main loop ====
let lastTS = 0;
function loop(ts){
  state.id = requestAnimationFrame(loop);
  if(!lastTS) lastTS = ts;
  const dt = (ts - lastTS)/1000; lastTS = ts;
  state.t += dt * state.speed;

  // 배경 & 레이어
  ctx.clearRect(0,0,W,H);
  drawBackground();
  drawStars(state.t);
  drawConstellationLines(dt);
  drawPointerGlow();

  // 회전하는 별 군집
  updateAndDrawOrbitGroups(dt, state.t);

  // 유성
  maybeSpawnComet(dt);
  updateComet(dt);
  drawComet();
}

// 시작!
start();

// 창 크기 바뀌면 별/군집 재생성(구도 보정)
addEventListener('resize', ()=>{
  stars = genStars();
  genOrbitGroups();
});
