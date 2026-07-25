const WORLD = {
  TILE: 16,
  MAP_W: 688,
  MAP_H: 400,

  ZOOM_TILES: 13,
  PLAYER_SPEED: 90,
  NPC_SPEED: 38
};

const MAP_ZOOM_TILES = {
  scene3map: 11,
  scene4map: 9
};

function charSet(ids) {
  const path = (id) => `assets/sprites/tile_${id}.png`;
  return {
    left: path(ids[0]),
    down: path(ids[1]),
    up: path(ids[2]),
    right: path(ids[3])
  };
}

const PLAYER_FRAMES = [
  charSet(["0023", "0024", "0025", "0026"]),
  charSet(["0050", "0051", "0052", "0053"]),
  charSet(["0077", "0078", "0079", "0080"])
];

const NPC_SETS = [
  [
    charSet(["0104", "0105", "0106", "0107"]),
    charSet(["0131", "0132", "0133", "0134"]),
    charSet(["0158", "0159", "0160", "0161"])
  ],
  [
    charSet(["0185", "0186", "0187", "0188"]),
    charSet(["0212", "0213", "0214", "0215"]),
    charSet(["0239", "0240", "0241", "0242"])
  ],
  [
    charSet(["0266", "0267", "0268", "0269"]),
    charSet(["0293", "0294", "0295", "0296"]),
    charSet(["0320", "0321", "0322", "0323"])
  ],
  [
    charSet(["0347", "0348", "0349", "0350"]),
    charSet(["0374", "0375", "0376", "0377"]),
    charSet(["0401", "0402", "0403", "0404"])
  ],
  [
    charSet(["0428", "0429", "0430", "0431"]),
    charSet(["0455", "0456", "0457", "0458"]),
    charSet(["0482", "0483", "0484", "0485"])
  ]
];

const world = {
  active: false,
  stageEl: null,
  worldEl: null,
  entityLayer: null,
  bgEl: null,
  mask: null,
  mapId: null,
  player: null,
  npcs: [],
  lastTs: 0,
  raf: 0,
  bird: null,
  chickens: [],
  mapHighlight: null,
  sidewalkCache: null,
  onBirdLanded: null,
  onArrive: null,
  onNpcClick: null,
  onWalkAbort: null,
  onProximity: null,
  paused: false,
  scale: 1,
  camX: 0,
  camY: 0,
  viewW: 400,
  viewH: 272
};

function parseMask(data) {
  return {
    width: data.width,
    height: data.height,
    cell: data.cell,
    cols: data.cols,
    rows: data.rows,
    solid: data.solid.map((row) => row.split("").map(Number)),
    zone: data.zone.map((row) => row.split("").map(Number))
  };
}

function applyMapSize(mask) {
  if (!mask) return;
  WORLD.MAP_W = mask.width || WORLD.MAP_W;
  WORLD.MAP_H = mask.height || WORLD.MAP_H;
}

async function fetchMask(mapId) {
  const res = await fetch(`assets/maps/${mapId}_mask.json`);
  return parseMask(await res.json());
}

function cellAt(mapX, mapY) {
  const m = world.mask;
  if (!m) return { solid: true, zone: 0 };
  const cx = Math.floor(mapX / m.cell);
  const cy = Math.floor(mapY / m.cell);
  if (cx < 0 || cy < 0 || cx >= m.cols || cy >= m.rows) return { solid: true, zone: 0 };
  return { solid: !!m.solid[cy][cx], zone: m.zone[cy][cx] };
}

function playerBlocked(x, y) {
  const r = WORLD.TILE * 0.3;
  return [
    [x, y],
    [x - r, y],
    [x + r, y],
    [x, y - r * 0.35],
    [x, y + r]
  ].some(([px, py]) => {
    if (px < 0 || py < 0 || px >= WORLD.MAP_W || py >= WORLD.MAP_H) return true;
    const c = cellAt(px, py);
    return c.solid || c.zone === 0;
  });
}

function inStage1Alley(x, y) {
  return world.mapId === "stage1" && x < 192 && y >= 208;
}

function npcBlocked(x, y) {
  const r = WORLD.TILE * 0.25;
  return [
    [x, y],
    [x - r, y],
    [x + r, y],
    [x, y + r]
  ].some(([px, py]) => {
    if (px < 0 || py < 0 || px >= WORLD.MAP_W || py >= WORLD.MAP_H) return true;
    if (inStage1Alley(px, py)) return true;
    const c = cellAt(px, py);
    return c.solid || c.zone !== 1;
  });
}

function tryMove(ent, nx, ny, blockedFn) {
  if (!blockedFn(nx, ny)) {
    ent.x = nx;
    ent.y = ny;
    return true;
  }
  if (!blockedFn(nx, ent.y)) {
    ent.x = nx;
    return true;
  }
  if (!blockedFn(ent.x, ny)) {
    ent.y = ny;
    return true;
  }
  return false;
}

function faceToward(ent, tx, ty) {
  const dx = tx - ent.x;
  const dy = ty - ent.y;
  if (Math.abs(dx) > Math.abs(dy)) ent.dir = dx < 0 ? "left" : "right";
  else if (Math.abs(dy) > 0.01) ent.dir = dy < 0 ? "up" : "down";
}

function entityPixelSize() {
  return WORLD.TILE * world.scale;
}

function makeEntityEl(className) {
  const el = document.createElement("div");
  el.className = "entity " + className;
  world.entityLayer.appendChild(el);
  sizeEntityEl(el);
  return el;
}

function sizeEntityEl(el) {
  const size = entityPixelSize();
  el.style.width = size + "px";
  el.style.height = size + "px";
  el.style.marginLeft = -size / 2 + "px";
  el.style.marginTop = -size * 0.85 + "px";
}

function resizeAllEntities() {
  const all = [world.player, ...world.npcs].filter(Boolean);
  for (const ent of all) sizeEntityEl(ent.el);
  if (world.bird) sizeBirdEl(world.bird);
  for (const ch of world.chickens) sizeChickenEl(ch);
}

function setEntitySprite(ent) {
  const frames = ent.frames;
  const frame = frames[ent.animFrame % frames.length];
  const url = frame[ent.dir] || frame.down;
  ent.el.style.backgroundImage = `url("${url}")`;
}

function placeEntity(ent) {
  ent.el.style.left = (ent.x / WORLD.MAP_W) * 100 + "%";
  ent.el.style.top = (ent.y / WORLD.MAP_H) * 100 + "%";
  setEntitySprite(ent);
}

function updateCamera() {
  if (!world.player || !world.worldEl) return;
  const halfW = world.viewW / 2;
  const halfH = world.viewH / 2;
  let camX = world.player.x - halfW;
  let camY = world.player.y - halfH;
  const maxX = Math.max(0, WORLD.MAP_W - world.viewW);
  const maxY = Math.max(0, WORLD.MAP_H - world.viewH);
  camX = Math.max(0, Math.min(maxX, camX));
  camY = Math.max(0, Math.min(maxY, camY));
  world.camX = camX;
  world.camY = camY;
  world.worldEl.style.transform = `translate(${-camX * world.scale}px, ${-camY * world.scale}px)`;
}

function layoutStage() {
  if (!world.stageEl || !world.worldEl) return;
  const game = document.getElementById("game");
  const gw = game.clientWidth;
  const gh = game.clientHeight;

  const short = Math.min(gw, gh);
  const zoomTiles =
    (world.mapId && MAP_ZOOM_TILES[world.mapId]) || WORLD.ZOOM_TILES;
  const scale = short / (zoomTiles * WORLD.TILE);
  world.scale = scale;
  world.viewW = gw / scale;
  world.viewH = gh / scale;
  world.stageEl.style.width = gw + "px";
  world.stageEl.style.height = gh + "px";
  world.stageEl.style.left = "0px";
  world.stageEl.style.top = "0px";
  world.worldEl.style.width = WORLD.MAP_W * scale + "px";
  world.worldEl.style.height = WORLD.MAP_H * scale + "px";
  resizeAllEntities();
  updateCamera();
}

function screenToMap(clientX, clientY) {
  const rect = world.stageEl.getBoundingClientRect();
  const x = world.camX + ((clientX - rect.left) / rect.width) * world.viewW;
  const y = world.camY + ((clientY - rect.top) / rect.height) * world.viewH;
  return { x, y };
}

function mapToScreenGamePercent(mapX, mapY) {
  if (!world.stageEl || !world.active) return { x: 50, y: 50 };
  const stage = world.stageEl.getBoundingClientRect();
  const gameRect = document.getElementById("game").getBoundingClientRect();
  const sx = stage.left - gameRect.left + ((mapX - world.camX) / world.viewW) * stage.width;
  const sy = stage.top - gameRect.top + ((mapY - world.camY) / world.viewH) * stage.height;
  return {
    x: (sx / gameRect.width) * 100,
    y: (sy / gameRect.height) * 100
  };
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
  return arr;
}

function collectSidewalkSpawns() {
  if (world.sidewalkCache) return world.sidewalkCache.slice();
  const pts = [];
  const m = world.mask;
  if (!m) return pts;
  const cell = m.cell;
  for (let cy = 0; cy < m.rows; cy++) {
    for (let cx = 0; cx < m.cols; cx++) {
      if (!m.solid[cy][cx] && m.zone[cy][cx] === 1) {
        const x = (cx + 0.5) * cell;
        const y = (cy + 0.5) * cell;
        if (!npcBlocked(x, y)) pts.push({ x, y });
      }
    }
  }
  world.sidewalkCache = pts;
  return pts.slice();
}

function pickSpreadSpawns(count, minDist, exclude) {
  const skip = exclude || [];
  const pool = shuffleInPlace(collectSidewalkSpawns());
  const picked = [];
  for (const p of pool) {
    if (skip.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < minDist * 0.6)) continue;
    if (picked.every((q) => Math.hypot(p.x - q.x, p.y - q.y) >= minDist)) {
      picked.push(p);
      if (picked.length >= count) break;
    }
  }
  if (picked.length < count) {
    for (const p of pool) {
      if (picked.some((q) => q.x === p.x && q.y === p.y)) continue;
      if (skip.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < WORLD.TILE)) continue;
      picked.push(p);
      if (picked.length >= count) break;
    }
  }
  while (picked.length < count) {
    picked.push({ x: WORLD.MAP_W * 0.5, y: WORLD.MAP_H * 0.75 });
  }
  return picked;
}

function pickInterviewSpawns(count, playerPos) {
  const pool = collectSidewalkSpawns();
  const bands = [
    { x0: 30, x1: WORLD.MAP_W * 0.34, y0: playerPos.y - 110, y1: playerPos.y + 40 },
    { x0: WORLD.MAP_W * 0.34, x1: WORLD.MAP_W * 0.66, y0: playerPos.y - 110, y1: playerPos.y + 40 },
    { x0: WORLD.MAP_W * 0.66, x1: WORLD.MAP_W - 30, y0: playerPos.y - 110, y1: playerPos.y + 40 }
  ];
  const picked = [];
  for (let i = 0; i < count; i++) {
    const band = bands[i % bands.length];
    const candidates = shuffleInPlace(
      pool.filter(
        (p) =>
          p.x >= band.x0 &&
          p.x < band.x1 &&
          p.y >= band.y0 &&
          p.y <= band.y1 &&
          picked.every((q) => Math.hypot(p.x - q.x, p.y - q.y) >= WORLD.TILE * 5)
      )
    );
    if (candidates.length) {
      picked.push(candidates[0]);
      continue;
    }

    const fallback = pool
      .filter((p) => p.x >= band.x0 && p.x < band.x1)
      .sort(
        (a, b) =>
          Math.hypot(a.x - playerPos.x, a.y - playerPos.y) -
          Math.hypot(b.x - playerPos.x, b.y - playerPos.y)
      );
    if (fallback.length) picked.push(fallback[0]);
    else if (pool.length) picked.push(pool[Math.floor(Math.random() * pool.length)]);
    else picked.push({ x: playerPos.x + (i - 1) * 64, y: playerPos.y - 40 });
  }
  return picked;
}

function findOpenPlayerSpawn() {

  const candidates = [
    { x: WORLD.MAP_W * 0.5, y: WORLD.MAP_H * 0.78 },
    { x: WORLD.MAP_W * 0.35, y: WORLD.MAP_H * 0.78 },
    { x: WORLD.MAP_W * 0.65, y: WORLD.MAP_H * 0.78 },
    { x: WORLD.MAP_W * 0.5, y: WORLD.MAP_H * 0.65 }
  ];
  for (const c of candidates) {
    if (!playerBlocked(c.x, c.y)) return c;
  }
  const sidewalk = shuffleInPlace(collectSidewalkSpawns());
  for (const p of sidewalk) {
    if (!playerBlocked(p.x, p.y)) return p;
  }
  return { x: WORLD.MAP_W * 0.5, y: WORLD.MAP_H * 0.78 };
}

function nearestOpenSidewalk(x, y) {
  const m = world.mask;
  if (!m) return null;
  const cell = m.cell;
  const ox = Math.floor(x / cell);
  const oy = Math.floor(y / cell);
  for (let r = 0; r <= 12; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (r > 0 && Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const cx = ox + dx;
        const cy = oy + dy;
        if (cx < 0 || cy < 0 || cx >= m.cols || cy >= m.rows) continue;
        if (m.solid[cy][cx] || m.zone[cy][cx] !== 1) continue;
        const px = (cx + 0.5) * cell;
        const py = (cy + 0.5) * cell;
        if (!npcBlocked(px, py)) return { x: px, y: py };
      }
    }
  }
  return null;
}

function randomNpcTarget(npc, avoidDir) {
  const cell = world.mask ? world.mask.cell : WORLD.TILE;
  const dirs = [
    { dir: "right", dx: 1, dy: 0 },
    { dir: "left", dx: -1, dy: 0 },
    { dir: "down", dx: 0, dy: 1 },
    { dir: "up", dx: 0, dy: -1 }
  ];
  shuffleInPlace(dirs);
  if (avoidDir) {
    const i = dirs.findIndex((d) => d.dir === avoidDir);
    if (i >= 0) dirs.push(dirs.splice(i, 1)[0]);
  }

  const home = npc.home || { x: npc.x, y: npc.y };
  const leash = npc.leash != null ? npc.leash : WORLD.TILE * 14;

  for (const d of dirs) {
    const steps = [2, 3, 4, 5, 1, 6, 8];
    for (const s of steps) {
      const x = npc.x + d.dx * cell * s;
      const y = npc.y + d.dy * cell * s;
      if (Math.hypot(x - home.x, y - home.y) > leash) continue;
      if (!npcBlocked(x, y)) return { x, y, dir: d.dir };
    }
  }

  const m = world.mask;
  if (m) {
    const candidates = [];
    const ox = Math.floor(npc.x / m.cell);
    const oy = Math.floor(npc.y / m.cell);
    for (let cy = Math.max(0, oy - 10); cy < Math.min(m.rows, oy + 11); cy++) {
      for (let cx = Math.max(0, ox - 10); cx < Math.min(m.cols, ox + 11); cx++) {
        if (m.solid[cy][cx] || m.zone[cy][cx] !== 1) continue;
        const x = (cx + 0.5) * m.cell;
        const y = (cy + 0.5) * m.cell;
        if (Math.hypot(x - npc.x, y - npc.y) < cell * 0.75) continue;
        if (Math.hypot(x - home.x, y - home.y) > leash) continue;
        if (!npcBlocked(x, y)) candidates.push({ x, y });
      }
    }
    if (candidates.length) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
  }
  return nearestOpenSidewalk(npc.x, npc.y);
}

function advanceWalkAnim(ent, dt, period) {
  if (!ent.moving) {
    ent.animFrame = 0;
    ent.animT = 0;
    return;
  }
  const frameCount = ent.frames.length;
  ent.animT = (ent.animT || 0) + dt;
  if (ent.animT > period) {
    ent.animT = 0;

    ent.animFrame = (ent.animFrame + 1) % frameCount;
  }
}

function updatePlayer(dt) {
  const p = world.player;
  if (!p || !p.target) {
    if (p) {
      p.moving = false;
      p.stuckT = 0;
      advanceWalkAnim(p, dt, 0.18);
      if (window.GameAudio) GameAudio.setWalking(false);
    }
    return;
  }
  const dx = p.target.x - p.x;
  const dy = p.target.y - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) {
    p.x = p.target.x;
    p.y = p.target.y;
    p.target = null;
    p.moving = false;
    p.stuckT = 0;
    const cb = world.onArrive;
    world.onArrive = null;
    if (cb) cb();
    return;
  }
  faceToward(p, p.target.x, p.target.y);
  p.moving = true;
  advanceWalkAnim(p, dt, 0.18);
  const step = Math.min(dist, WORLD.PLAYER_SPEED * dt);
  const prevX = p.x;
  const prevY = p.y;
  const moved = tryMove(p, p.x + (dx / dist) * step, p.y + (dy / dist) * step, playerBlocked);
  const progress = Math.hypot(p.x - prevX, p.y - prevY);

  if (!moved || progress < 0.02) {
    p.stuckT = (p.stuckT || 0) + dt;
    if (!moved || p.stuckT > 0.35) {
      p.target = null;
      p.moving = false;
      p.stuckT = 0;
      world.onArrive = null;
      if (world.onWalkAbort) world.onWalkAbort();
      if (window.GameAudio) GameAudio.setWalking(false);
    }
  } else {
    p.stuckT = 0;
  }
  if (window.GameAudio) GameAudio.setWalking(!!p.moving);
}

function cancelPlayerWalk() {
  if (!world.player) return;
  world.player.target = null;
  world.player.moving = false;
  world.player.stuckT = 0;
  world.onArrive = null;
  if (window.GameAudio) GameAudio.setWalking(false);
}

function walkPlayerToMap(mapX, mapY, onArrive) {
  if (!world.player) return;

  cancelPlayerWalk();
  let x = Math.max(2, Math.min(WORLD.MAP_W - 2, mapX));
  let y = Math.max(2, Math.min(WORLD.MAP_H - 2, mapY));
  if (playerBlocked(x, y)) {
    let found = null;
    for (let r = 4; r <= 96 && !found; r += 4) {
      for (let a = 0; a < 24; a++) {
        const ang = (a / 24) * Math.PI * 2;
        const nx = x + Math.cos(ang) * r;
        const ny = y + Math.sin(ang) * r;
        if (!playerBlocked(nx, ny)) {
          found = { x: nx, y: ny };
          break;
        }
      }
    }
    if (!found) {

      if (typeof world.onWalkAbort === "function") world.onWalkAbort();
      return;
    }
    x = found.x;
    y = found.y;
  }
  world.player.target = { x, y };
  world.player.stuckT = 0;
  world.onArrive = onArrive || null;
}

function updateNpc(npc, dt) {
  if (npc.stationary) {
    npc.moving = false;
    advanceWalkAnim(npc, dt, 0.22);
    return;
  }
  if (world.paused) {
    npc.moving = false;
    advanceWalkAnim(npc, dt, 0.2);
    return;
  }

  if (npcBlocked(npc.x, npc.y)) {
    const safe = nearestOpenSidewalk(npc.x, npc.y);
    if (safe) {
      npc.x = safe.x;
      npc.y = safe.y;
    }
    npc.target = null;
    npc.stuck = 0;
    npc.wait = 0.15;
    npc.moving = false;
    advanceWalkAnim(npc, dt, 0.2);
    return;
  }

  if (npc.wait > 0) {
    npc.wait -= dt;
    npc.moving = false;
    advanceWalkAnim(npc, dt, 0.2);
    return;
  }

  if (!npc.target) {
    if (Math.random() < 0.25) {
      npc.wait = 0.4 + Math.random() * 1.6;
      return;
    }
    npc.target = randomNpcTarget(npc, npc.stuckDir || null);
    if (!npc.target) {
      npc.wait = 0.4;
      return;
    }
  }

  const dx = npc.target.x - npc.x;
  const dy = npc.target.y - npc.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) {
    npc.target = null;
    npc.moving = false;
    npc.stuck = 0;
    return;
  }

  faceToward(npc, npc.target.x, npc.target.y);
  npc.moving = true;
  advanceWalkAnim(npc, dt, 0.2);
  const step = Math.min(dist, WORLD.NPC_SPEED * dt);
  const prevX = npc.x;
  const prevY = npc.y;
  const moved = tryMove(npc, npc.x + (dx / dist) * step, npc.y + (dy / dist) * step, npcBlocked);
  const progress = Math.hypot(npc.x - prevX, npc.y - prevY);

  if (!moved || progress < 0.02) {
    npc.stuck = (npc.stuck || 0) + 1;
    npc.stuckDir = npc.dir;
    npc.target = null;
    npc.moving = false;
    const next = randomNpcTarget(npc, npc.stuckDir);
    if (next) {
      npc.target = next;
      npc.wait = 0;
    } else {
      npc.wait = 0.25 + Math.random() * 0.4;
    }

    if (npc.stuck >= 6) {
      const safe = nearestOpenSidewalk(npc.x, npc.y);
      if (safe) {
        npc.x = safe.x;
        npc.y = safe.y;
      }
      npc.stuck = 0;
      npc.target = null;
      npc.wait = 0.2;
    }
  } else {
    npc.stuck = 0;
  }
}

function tick(ts) {
  if (!world.active) return;
  if (!world.lastTs) world.lastTs = ts;
  const dt = Math.min(0.05, (ts - world.lastTs) / 1000);
  world.lastTs = ts;

  if (!world.paused) {
    updatePlayer(dt);
    for (const npc of world.npcs) updateNpc(npc, dt);
    updateBird(dt);
    updateChickens(dt);
    if (typeof world.onProximity === "function" && world.player) {
      world.onProximity(world.player.x, world.player.y);
    }
  } else {

    if (world.player) {
      world.player.moving = false;
      advanceWalkAnim(world.player, dt, 0.18);
    }
    for (const npc of world.npcs) {
      npc.moving = false;
      advanceWalkAnim(npc, dt, 0.2);
    }
  }
  updateCamera();

  const all = [world.player, ...world.npcs].filter(Boolean);
  all.sort((a, b) => a.y - b.y);
  all.forEach((ent, i) => {
    ent.el.style.zIndex = String(10 + i);
    placeEntity(ent);
  });
  if (world.bird) {
    world.bird.el.style.zIndex = String(40);
    placeBird(world.bird);
  }
  for (const ch of world.chickens) {
    ch.el.style.zIndex = String(8);
    placeChicken(ch);
  }

  world.raf = requestAnimationFrame(tick);
}

function clearEntities() {
  if (world.entityLayer) world.entityLayer.innerHTML = "";
  if (world.mapHighlight && world.mapHighlight.parentNode) {
    world.mapHighlight.remove();
  }
  world.mapHighlight = null;
  world.player = null;
  world.npcs = [];
  world.bird = null;
  world.chickens = [];
}

async function loadWorldMap(mapId, options) {
  if (!mapId) {
    unloadWorld();
    return;
  }

  const opts = options || {};
  world.mask = await fetchMask(mapId);
  applyMapSize(world.mask);
  world.sidewalkCache = null;
  world.mapId = mapId;
  world.active = true;
  world.paused = false;
  world.stageEl.classList.remove("hidden");
  world.bgEl.style.backgroundImage = `url("assets/maps/${mapId}.png")`;
  if (mapId === "stage1") {
    world.bgEl.style.filter = "saturate(0%) brightness(0.92)";
  } else if (mapId === "scene4map" || opts.night) {
    world.bgEl.style.filter = "brightness(0.55) saturate(0.75) contrast(1.05)";
  } else {
    world.bgEl.style.filter = "none";
  }
  layoutStage();
  clearEntities();

  const spawn =
    opts.spawn
      ? nearestOpenSidewalk(opts.spawn.x, opts.spawn.y) || opts.spawn
      : mapId === "scene3map"
        ? nearestOpenSidewalk(300, 180) || findOpenPlayerSpawn()
        : findOpenPlayerSpawn();
  world.player = {
    x: spawn.x,
    y: spawn.y,
    dir: "down",
    frames: PLAYER_FRAMES,
    animFrame: 0,
    animT: 0,
    moving: false,
    target: null,
    el: makeEntityEl("player")
  };
  placeEntity(world.player);
  updateCamera();

  const interviews = opts.interviews || [];
  const ambientCount =
    opts.quiet || mapId === "scene4map"
      ? 0
      : opts.ambientCount != null
        ? opts.ambientCount
        : mapId === "scene3map"
          ? 5
          : 4;
  const interviewSpots = interviews.length
    ? pickInterviewSpawns(interviews.length, spawn)
    : [];
  const ambientSpots = pickSpreadSpawns(
    ambientCount,
    WORLD.TILE * 5,
    interviewSpots
  );
  let lookOrder = shuffleInPlace(NPC_SETS.slice());
  if (opts.excludeNpcSet != null) {
    lookOrder = shuffleInPlace(
      NPC_SETS.filter((_, i) => i !== opts.excludeNpcSet).slice()
    );
  }

  for (let i = 0; i < interviews.length; i++) {
    const pos = interviewSpots[i];
    const frames = lookOrder[i % lookOrder.length];
    const npc = {
      x: pos.x,
      y: pos.y,
      home: { x: pos.x, y: pos.y },
      leash: WORLD.TILE * 7,
      dir: ["down", "left", "right"][i % 3],
      frames,
      animFrame: 0,
      animT: 0,
      moving: false,
      target: null,
      wait: 0.2 + Math.random() * 0.8,
      stuck: 0,
      stuckDir: null,
      interview: interviews[i],
      talked: false,
      el: makeEntityEl("npc")
    };
    if (mapId === "stage1") npc.el.classList.add("muted");
    npc.el.classList.add("talkable");
    npc.el.title = "Talk";
    const marker = document.createElement("div");
    marker.className = "npc-marker";
    marker.textContent = "!";
    npc.el.appendChild(marker);
    npc.marker = marker;
    npc.el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (world.onNpcClick) world.onNpcClick(npc);
    });
    world.npcs.push(npc);
    placeEntity(npc);
  }

  for (let i = 0; i < ambientSpots.length; i++) {
    const pos = ambientSpots[i];
    const frames = lookOrder[(i + interviews.length) % lookOrder.length];
    const npc = {
      x: pos.x,
      y: pos.y,
      home: { x: pos.x, y: pos.y },
      leash: WORLD.TILE * 12,
      dir: ["down", "left", "right", "up"][i % 4],
      frames,
      animFrame: 0,
      animT: 0,
      moving: false,
      target: null,
      wait: Math.random() * 1.5,
      stuck: 0,
      stuckDir: null,
      interview: null,
      talked: false,
      el: makeEntityEl("npc")
    };
    if (mapId === "stage1") npc.el.classList.add("muted");
    world.npcs.push(npc);
    placeEntity(npc);
  }

  if (opts.staticNpcs && opts.staticNpcs.length) {
    for (const spec of opts.staticNpcs) {
      spawnStationaryNpc(spec);
    }
  }

  if (opts.birdQuest) {
    createBird(opts.birdQuest);
  }
  if (opts.chickens && opts.chickens.length) {
    createChickens(opts.chickens);
  }

  world.lastTs = 0;
  cancelAnimationFrame(world.raf);
  world.raf = requestAnimationFrame(tick);
}

function unloadWorld() {
  world.active = false;
  world.paused = false;
  world.onNpcClick = null;
  world.onBirdLanded = null;
  world.onWalkAbort = null;
  world.onProximity = null;
  cancelAnimationFrame(world.raf);
  clearEntities();
  if (world.stageEl) world.stageEl.classList.add("hidden");
  world.mask = null;
  world.sidewalkCache = null;
  world.mapId = null;
}

function setWorldPaused(paused) {
  world.paused = !!paused;
  if (world.paused) {
    if (world.player) {
      world.player.target = null;
      world.player.moving = false;
    }
    for (const npc of world.npcs) {
      npc.target = null;
      npc.moving = false;
    }
  }
}

function markNpcTalked(npc) {
  if (!npc) return;
  npc.talked = true;
  npc.interview = null;
  npc.el.classList.remove("talkable");
  npc.el.classList.add("talked");
  npc.el.title = "";
  if (npc.marker) {
    npc.marker.remove();
    npc.marker = null;
  }
}

function makeNpcTalkable(npc, interview) {
  if (!npc) return;
  npc.interview = interview;
  npc.talked = false;
  npc.el.classList.add("talkable");
  npc.el.classList.remove("talked");
  npc.el.title = "Talk";
  if (!npc.marker) {
    const marker = document.createElement("div");
    marker.className = "npc-marker";
    marker.textContent = "!";
    npc.el.appendChild(marker);
    npc.marker = marker;
  }

  if (!npc._talkBound) {
    npc._talkBound = true;
    npc.el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (world.onNpcClick) world.onNpcClick(npc);
    });
  }
}

function enableNearestWitness(interview) {
  if (!world.npcs.length) {

    const pos = nearestOpenSidewalk(120, 120) || { x: 120, y: 120 };
    const frames = NPC_SETS[0];
    const npc = {
      x: pos.x,
      y: pos.y,
      home: { x: pos.x, y: pos.y },
      leash: WORLD.TILE * 6,
      dir: "down",
      frames,
      animFrame: 0,
      animT: 0,
      moving: false,
      target: null,
      wait: 0,
      stuck: 0,
      stuckDir: null,
      interview: null,
      talked: false,
      el: makeEntityEl("npc")
    };
    world.npcs.push(npc);
    placeEntity(npc);
  }
  const prefer = { x: 140, y: 140 };
  const ranked = world.npcs
    .filter((n) => !n.talked)
    .slice()
    .sort(
      (a, b) =>
        Math.hypot(a.x - prefer.x, a.y - prefer.y) -
        Math.hypot(b.x - prefer.x, b.y - prefer.y)
    );
  const npc = ranked[0];
  if (!npc) return null;
  makeNpcTalkable(npc, interview);
  const parkSidewalk = nearestOpenSidewalk(120, 120);
  if (parkSidewalk) {
    npc.x = parkSidewalk.x;
    npc.y = parkSidewalk.y;
    npc.home = { x: parkSidewalk.x, y: parkSidewalk.y };
    npc.leash = WORLD.TILE * 6;
    npc.target = null;
  }
  return npc;
}

const BIRD_FRAMES = {
  idle: ["assets/sprites/bird/r0_c0.png", "assets/sprites/bird/r0_c1.png"],
  fly: [
    "assets/sprites/bird/r1_c0.png",
    "assets/sprites/bird/r1_c1.png",
    "assets/sprites/bird/r1_c2.png",
    "assets/sprites/bird/r1_c3.png",
    "assets/sprites/bird/r1_c4.png",
    "assets/sprites/bird/r1_c5.png",
    "assets/sprites/bird/r1_c6.png",
    "assets/sprites/bird/r1_c7.png"
  ],
  peck: [
    "assets/sprites/bird/r2_c0.png",
    "assets/sprites/bird/r2_c1.png",
    "assets/sprites/bird/r2_c2.png"
  ]
};

function createBird(quest) {
  const start = quest.start || quest.stops[0];
  const path = [...(quest.stops || []), quest.land || quest.stops[quest.stops.length - 1]];
  const el = document.createElement("div");
  el.className = "entity bird";
  world.entityLayer.appendChild(el);
  const hop = !!quest.hop;
  const bird = {
    x: start.x,
    y: start.y,
    el,
    path,
    pathIndex: 0,
    mode: "wait",
    facing: -1,
    animFrame: 0,
    animT: 0,
    flyT: 0,
    flyDur: hop ? 0.55 : 1.15,
    from: { x: start.x, y: start.y },
    to: { x: start.x, y: start.y },
    active: false,
    landed: false,
    hop,
    departAfterLand: !!quest.departAfterLand,
    proximity: hop ? WORLD.TILE * 2.2 : WORLD.TILE * 2.8
  };
  sizeBirdEl(bird);
  setBirdSprite(bird);
  placeBird(bird);
  world.bird = bird;
  return bird;
}

function sizeBirdEl(bird) {
  const size = WORLD.TILE * world.scale * 0.55;
  bird.el.style.width = size + "px";
  bird.el.style.height = size + "px";
  bird.el.style.marginLeft = -size / 2 + "px";
  bird.el.style.marginTop = -size * 0.7 + "px";
}

function setBirdSprite(bird) {
  let frames = BIRD_FRAMES.idle;
  if (bird.mode === "fly") frames = BIRD_FRAMES.fly;
  else if (bird.mode === "land") frames = BIRD_FRAMES.peck;
  const url = frames[bird.animFrame % frames.length];
  bird.el.style.backgroundImage = `url("${url}")`;
  bird.el.style.transform = bird.facing > 0 ? "scaleX(-1)" : "scaleX(1)";
}

function placeBird(bird) {
  bird.el.style.left = (bird.x / WORLD.MAP_W) * 100 + "%";
  bird.el.style.top = (bird.y / WORLD.MAP_H) * 100 + "%";
  setBirdSprite(bird);
}

function setMapHighlight(mapX, mapY, sizeW, sizeH) {
  clearMapHighlight();
  if (!world.worldEl) return;
  const el = document.createElement("div");
  el.className = "map-highlight";

  const mw = sizeW || WORLD.TILE * 1.4;
  const mh = sizeH || WORLD.TILE * 1.75;
  el.style.width = (mw / WORLD.MAP_W) * 100 + "%";
  el.style.height = (mh / WORLD.MAP_H) * 100 + "%";
  el.style.left = (mapX / WORLD.MAP_W) * 100 + "%";
  el.style.top = (mapY / WORLD.MAP_H) * 100 + "%";
  world.worldEl.appendChild(el);
  world.mapHighlight = el;
}

function clearMapHighlight() {
  if (world.mapHighlight) {
    world.mapHighlight.remove();
    world.mapHighlight = null;
  }
}

function startBirdQuest() {
  if (!world.bird) return;
  world.bird.active = true;
  world.bird.mode = "wait";
}

function updateBird(dt) {
  const bird = world.bird;
  if (!bird || !bird.active) {
    if (bird && bird.landed && bird.mode === "land") {
      bird.animT = (bird.animT || 0) + dt;
      if (bird.animT > 0.28) {
        bird.animT = 0;
        bird.animFrame = (bird.animFrame + 1) % BIRD_FRAMES.peck.length;
        setBirdSprite(bird);
      }
    }
    return;
  }

  if (bird.mode === "wait") {
    bird.animT = (bird.animT || 0) + dt;
    if (bird.animT > 0.35) {
      bird.animT = 0;
      bird.animFrame = (bird.animFrame + 1) % BIRD_FRAMES.idle.length;
      setBirdSprite(bird);
    }
    if (!world.player) return;
    const dist = Math.hypot(world.player.x - bird.x, world.player.y - bird.y);
    if (dist <= bird.proximity) {
      if (bird.pathIndex >= bird.path.length) return;
      bird.from = { x: bird.x, y: bird.y };
      bird.to = bird.path[bird.pathIndex];
      bird.pathIndex += 1;
      bird.flyT = 0;
      bird.mode = "fly";
      bird.animFrame = 0;
      const dx = bird.to.x - bird.from.x;
      bird.facing = dx >= 0 ? 1 : -1;
      bird.willLand = bird.pathIndex >= bird.path.length;
    }
    return;
  }

  if (bird.mode === "fly" || bird.mode === "depart") {
    bird.flyT += dt;
    const t = Math.min(1, bird.flyT / bird.flyDur);
    const e = 1 - Math.pow(1 - t, 2);
    bird.x = bird.from.x + (bird.to.x - bird.from.x) * e;
    bird.y = bird.from.y + (bird.to.y - bird.from.y) * e;
    const arc = bird.mode === "depart" ? 28 : bird.hop ? (bird.willLand ? 4 : 7) : bird.willLand ? 8 : 22;
    bird.y -= Math.sin(Math.PI * e) * arc;
    bird.animT = (bird.animT || 0) + dt;
    if (bird.animT > 0.07) {
      bird.animT = 0;
      bird.animFrame = (bird.animFrame + 1) % BIRD_FRAMES.fly.length;
    }
    if (t >= 1) {
      bird.x = bird.to.x;
      bird.y = bird.to.y;
      if (bird.mode === "depart") {
        bird.active = false;
        bird.el.style.opacity = "0";
        return;
      }
      if (bird.willLand) {
        bird.mode = "land";
        bird.landed = true;
        bird.active = false;
        bird.animFrame = 0;
        placeBird(bird);
        if (world.onBirdLanded) world.onBirdLanded();
        if (bird.departAfterLand) {
          window.setTimeout(() => departBird(), 900);
        }
      } else {
        bird.mode = "wait";
        bird.animFrame = 0;
      }
    }
    return;
  }
}

function departBird() {
  const bird = world.bird;
  if (!bird || !bird.el) return;
  bird.active = true;
  bird.landed = false;
  bird.mode = "depart";
  bird.from = { x: bird.x, y: bird.y };
  bird.to = { x: bird.x - 80, y: bird.y - 70 };
  bird.flyT = 0;
  bird.flyDur = 1.1;
  bird.facing = -1;
  bird.animFrame = 0;
}

const CHICKEN_FRAMES = {
  idle: ["assets/sprites/chicken/f0.png", "assets/sprites/chicken/f1.png"],
  walk: ["assets/sprites/chicken/f2.png", "assets/sprites/chicken/f3.png"]
};

function createChickens(spots) {
  world.chickens = [];
  for (const spot of spots) {
    const open = nearestOpenSidewalk(spot.x, spot.y) || spot;
    const el = document.createElement("div");
    el.className = "entity chicken";
    world.entityLayer.appendChild(el);
    const ch = {
      x: open.x,
      y: open.y,
      home: { x: open.x, y: open.y },
      leash: WORLD.TILE * 4,
      dir: Math.random() < 0.5 ? -1 : 1,
      animFrame: 0,
      animT: 0,
      wait: Math.random() * 1.2,
      target: null,
      el
    };
    sizeChickenEl(ch);
    placeChicken(ch);
    world.chickens.push(ch);
  }
}

function sizeChickenEl(ch) {
  const size = WORLD.TILE * world.scale * 0.7;
  ch.el.style.width = size + "px";
  ch.el.style.height = size + "px";
  ch.el.style.marginLeft = -size / 2 + "px";
  ch.el.style.marginTop = -size * 0.75 + "px";
}

function placeChicken(ch) {
  ch.el.style.left = (ch.x / WORLD.MAP_W) * 100 + "%";
  ch.el.style.top = (ch.y / WORLD.MAP_H) * 100 + "%";
  const frames = ch.target ? CHICKEN_FRAMES.walk : CHICKEN_FRAMES.idle;
  ch.el.style.backgroundImage = `url("${frames[ch.animFrame % frames.length]}")`;
  ch.el.style.transform = ch.dir > 0 ? "scaleX(-1)" : "scaleX(1)";
}

function updateChickens(dt) {
  for (const ch of world.chickens) {
    ch.animT = (ch.animT || 0) + dt;
    if (ch.animT > 0.22) {
      ch.animT = 0;
      ch.animFrame = (ch.animFrame + 1) % 2;
    }
    if (ch.wait > 0) {
      ch.wait -= dt;
      ch.target = null;
      continue;
    }
    if (!ch.target) {
      if (Math.random() < 0.35) {
        ch.wait = 0.8 + Math.random() * 1.6;
        continue;
      }
      const ang = Math.random() * Math.PI * 2;
      const dist = 10 + Math.random() * ch.leash;
      let tx = ch.home.x + Math.cos(ang) * dist;
      let ty = ch.home.y + Math.sin(ang) * dist;
      tx = Math.max(8, Math.min(WORLD.MAP_W - 8, tx));
      ty = Math.max(8, Math.min(WORLD.MAP_H - 8, ty));
      if (!npcBlocked(tx, ty)) ch.target = { x: tx, y: ty };
      else ch.wait = 0.4;
      continue;
    }
    const speed = 28;
    const dx = ch.target.x - ch.x;
    const dy = ch.target.y - ch.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) {
      ch.target = null;
      ch.wait = 0.5 + Math.random();
      continue;
    }
    ch.dir = dx >= 0 ? 1 : -1;
    const step = Math.min(dist, speed * dt);
    const nx = ch.x + (dx / dist) * step;
    const ny = ch.y + (dy / dist) * step;
    if (!npcBlocked(nx, ny)) {
      ch.x = nx;
      ch.y = ny;
    } else {
      ch.target = null;
      ch.wait = 0.3;
    }
  }
}

function spawnMapWitness(spec) {
  if (!spec || !world.active) return null;
  const pos = nearestOpenSidewalk(spec.mapX, spec.mapY) || {
    x: spec.mapX,
    y: spec.mapY
  };
  const frames =
    NPC_SETS.filter((_, i) => i !== 2)[Math.floor(Math.random() * 4)] ||
    NPC_SETS[0];
  const npc = {
    x: pos.x,
    y: pos.y,
    home: { x: pos.x, y: pos.y },
    leash: WORLD.TILE * 3,
    dir: "down",
    frames,
    animFrame: 0,
    animT: 0,
    moving: false,
    target: null,
    wait: 0,
    stuck: 0,
    stuckDir: null,
    interview: {
      id: spec.id,
      dialogue: spec.dialogue,
      stage3Clue: true
    },
    talked: false,
    el: makeEntityEl("npc")
  };
  makeNpcTalkable(npc, npc.interview);
  world.npcs.push(npc);
  placeEntity(npc);
  return npc;
}

function spawnStationaryNpc(spec) {
  if (!spec || !world.active) return null;
  const pos = nearestOpenSidewalk(spec.mapX, spec.mapY) || {
    x: spec.mapX,
    y: spec.mapY
  };
  const setIndex = spec.npcSet != null ? spec.npcSet : 0;
  const frames = NPC_SETS[setIndex] || NPC_SETS[0];
  const npc = {
    x: pos.x,
    y: pos.y,
    home: { x: pos.x, y: pos.y },
    leash: 0,
    dir: spec.dir || "down",
    frames,
    animFrame: 0,
    animT: 0,
    moving: false,
    target: null,
    wait: 0,
    stuck: 0,
    stuckDir: null,
    interview: null,
    talked: false,
    stationary: true,
    id: spec.id || null,
    el: makeEntityEl("npc" + (spec.className ? " " + spec.className : ""))
  };
  if (spec.scale) {
    npc.el.style.transform = `scale(${spec.scale})`;
    npc.el.style.transformOrigin = "center bottom";
  }
  world.npcs.push(npc);
  placeEntity(npc);
  return npc;
}

function nearestApproachPoint(mapX, mapY, opts) {

  const mapW = (opts && opts.mapW) || 0;
  const mapH = (opts && opts.mapH) || 0;
  let candidates;
  if (mapW > 0 && mapH > 0) {
    const hw = mapW / 2;
    const hh = mapH / 2;
    const pad = 12;
    candidates = [
      { x: mapX, y: mapY + hh + pad },
      { x: mapX - hw - pad, y: mapY + hh + pad },
      { x: mapX + hw + pad, y: mapY + hh + pad },
      { x: mapX - hw - pad, y: mapY },
      { x: mapX + hw + pad, y: mapY },
      { x: mapX, y: mapY - hh - pad },
      { x: mapX - hw - pad, y: mapY - hh - pad },
      { x: mapX + hw + pad, y: mapY - hh - pad }
    ];
  } else {
    candidates = [
      { x: mapX, y: mapY + 14 },
      { x: mapX - 12, y: mapY + 8 },
      { x: mapX + 12, y: mapY + 8 },
      { x: mapX, y: mapY - 12 },
      { x: mapX - 16, y: mapY },
      { x: mapX + 16, y: mapY }
    ];
  }

  const open = candidates.filter((c) => !playerBlocked(c.x, c.y));
  const pool = open.length ? open : [];
  if (world.player && pool.length) {
    pool.sort((a, b) => {
      const da = (a.x - world.player.x) ** 2 + (a.y - world.player.y) ** 2;
      const db = (b.x - world.player.x) ** 2 + (b.y - world.player.y) ** 2;
      return da - db;
    });
    return pool[0];
  }
  if (pool.length) return pool[0];

  for (let r = 8; r <= 72; r += 4) {
    for (let a = 0; a < 20; a++) {
      const ang = (a / 20) * Math.PI * 2;
      const c = { x: mapX + Math.cos(ang) * r, y: mapY + Math.sin(ang) * r };
      if (!playerBlocked(c.x, c.y)) return c;
    }
  }
  return { x: mapX, y: mapY + 16 };
}

function playerTouchesRect(mapX, mapY, mapW, mapH, pad) {
  if (!world.player) return false;
  const p = pad == null ? 4 : pad;
  const hw = mapW / 2 + p;
  const hh = mapH / 2 + p;
  return (
    Math.abs(world.player.x - mapX) <= hw &&
    Math.abs(world.player.y - mapY) <= hh
  );
}

function worldIsActive() {
  return world.active;
}

function initWorldDom() {
  world.stageEl = document.getElementById("world-stage");
  world.worldEl = document.getElementById("world-world");
  world.bgEl = document.getElementById("world-bg");
  world.entityLayer = document.getElementById("entity-layer");
  window.addEventListener("resize", layoutStage);
}
