import "./style.css";

const VIEW_WIDTH = 384;
const VIEW_HEIGHT = 216;
const TILE = 16;
const MAP_WIDTH = 56;
const MAP_HEIGHT = 42;
const WORLD_WIDTH = MAP_WIDTH * TILE;
const WORLD_HEIGHT = MAP_HEIGHT * TILE;

type Direction = "down" | "up" | "left" | "right";
type PropKind = "vending" | "bench" | "crate" | "plant" | "table" | "lamp" | "sofa" | "mailbox" | "arcade";

type WorldProp = {
  kind: PropKind;
  x: number;
  y: number;
  width: number;
  height: number;
  solid?: boolean;
};

type Player = {
  x: number;
  y: number;
  direction: Direction;
  walking: number;
  name: string;
  knockbackX: number;
  knockbackY: number;
  hitUntil: number;
  fallingUntil: number;
  fallingStartedAt: number;
  fallTargetX: number;
  fallTargetY: number;
  airUntil: number;
  airStartedAt: number;
  dashUntil: number;
  dashVelocityX: number;
  dashVelocityY: number;
};

type Spinner = { x: number; y: number; radius: number; angle: number; speed: number };
type Pit = { x: number; y: number; width: number; height: number; active: boolean };
type AimState = { screenX: number; screenY: number; worldX: number; worldY: number; visible: boolean; pulseUntil: number; pulseX: number; pulseY: number };
type GameMode = "track" | "practice";
type SkillId = "push" | "dash" | "run" | "grab" | "clone" | "slow" | "sleep";
type TestBot = { id: number; x: number; y: number; direction: Direction; walking: number; color: string; name: string; moveX: number; moveY: number; nextTurnAt: number; knockbackX: number; knockbackY: number; slowUntil: number; sleepUntil: number };
type Clone = { x: number; y: number; direction: Direction; until: number };
type Projectile = { kind: "slow" | "sleep"; x: number; y: number; velocityX: number; velocityY: number; until: number; radius: number };

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("앱을 찾을 수 없어요.");

app.innerHTML = `
  <div class="pixel-shell">
    <header class="pixel-topbar">
      <a class="brand" href="#top" aria-label="픽셀 패닉 런 대기실"><span class="brand-icon">!</span><span>PIXEL<br />PANIC RUN</span></a>
      <div class="build-stamp">LOCAL BUILD 0.1<br /><span>TOP-DOWN PROTOTYPE</span></div>
    </header>

    <main id="lobby-screen" class="lobby-screen" aria-labelledby="game-title">
      <section class="hero-copy">
        <div class="eyebrow">WAITING ROOM / 01</div>
        <h1 id="game-title">픽셀 패닉<br /><em>마라톤</em></h1>
        <p>누가 먼저 도착하는지는 아직 중요하지 않아요.<br />우선은 운동장 트랙을 한 바퀴 돌며, 이 게임의 <b>손맛</b>부터 확인해 봅시다.</p>
        <div class="feature-tags"><span>TOP-DOWN 2D</span><span>PIXEL INDIE</span><span>WASD MOVE</span></div>
        <div class="pixel-panel start-panel">
          <label for="runner-name">러너 이름</label>
          <div class="entry-row"><input id="runner-name" maxlength="10" value="말썽꾸러기" autocomplete="nickname" /><button id="enter-town">트랙 입장</button></div>
          <p class="panel-note">스킬은 아직 없습니다. 장애물 운동장을 한 바퀴 도는 첫 단계예요.</p>
        </div>
      </section>

      <section class="lobby-card" aria-label="픽셀 대기실 미리보기">
        <div class="card-top"><span class="window-dot red"></span><span class="window-dot yellow"></span><span class="window-dot green"></span><span>LOBBY // TROUBLE TOWN</span></div>
        <canvas id="lobby-canvas" width="384" height="216" aria-label="픽셀 대기실"></canvas>
        <div class="card-bottom"><span><i class="tiny-person pink"></i> 1 / 4 READY</span><span class="blink">● LOCAL</span></div>
      </section>
    </main>

    <main id="game-screen" class="game-screen hidden">
      <div class="game-wrap">
        <div class="game-frame">
          <canvas id="game-canvas" width="384" height="216" tabindex="0" aria-label="탑다운 픽셀 운동장"></canvas>
          <div class="scanlines" aria-hidden="true"></div>
          <div class="game-hud">
            <div class="hud-box"><span>AREA</span><strong id="area-value">말썽 운동장</strong></div>
            <div class="hud-box middle"><span>LAP</span><strong id="lap-value">0 / 1 LAP</strong></div>
            <div class="hud-box right"><span>OBJECTIVE</span><strong id="objective-value">CHECKPOINT 1</strong></div>
          </div>
          <div class="message-box"><span class="key">WASD</span>로 달리고, <span class="key">MOUSE</span>로 스킬 방향을 조준하세요. <span class="key">L-CLICK</span>은 조준 펄스를 발사합니다.</div>
          <div id="skill-bar" class="skill-bar" aria-label="스킬 단축키"></div>
        </div>
        <aside class="side-panel">
          <div class="pixel-panel">
            <div class="eyebrow">PLAYER</div>
            <div id="player-name-tag" class="player-name-tag">말썽꾸러기</div>
            <p>회전봉은 밀어내고, 활성화된 구덩이는 되돌립니다. 마우스를 움직여 이후 추가할 스킬의 발사 방향도 미리 조준할 수 있어요.</p>
          </div>
          <div class="pixel-panel controls-panel"><span>MOVE</span><b>W A S D</b><span>AIM</span><b>MOUSE / CLICK</b><span>MENU</span><b>ESC</b></div>
          <button id="practice-button" class="ghost-button">스킬 연습장 이동</button>
          <button id="back-to-lobby" class="ghost-button">대기실로 돌아가기</button>
        </aside>
      </div>
    </main>

    <div id="toast" class="toast" role="status"></div>
  </div>
`;

function getElement<T extends HTMLElement>(selector: string) {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`${selector}을(를) 찾지 못했어요.`);
  return element;
}

const elements = {
  lobby: getElement<HTMLElement>("#lobby-screen"),
  game: getElement<HTMLElement>("#game-screen"),
  name: getElement<HTMLInputElement>("#runner-name"),
  enter: getElement<HTMLButtonElement>("#enter-town"),
  back: getElement<HTMLButtonElement>("#back-to-lobby"),
  lobbyCanvas: getElement<HTMLCanvasElement>("#lobby-canvas"),
  gameCanvas: getElement<HTMLCanvasElement>("#game-canvas"),
  playerName: getElement<HTMLElement>("#player-name-tag"),
  area: getElement<HTMLElement>("#area-value"),
  lap: getElement<HTMLElement>("#lap-value"),
  objective: getElement<HTMLElement>("#objective-value"),
  skillBar: getElement<HTMLElement>("#skill-bar"),
  practice: getElement<HTMLButtonElement>("#practice-button"),
  toast: getElement<HTMLElement>("#toast"),
};

function getPixelContext(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("픽셀 캔버스를 준비하지 못했어요.");
  return context;
}

const lobbyContext = getPixelContext(elements.lobbyCanvas);
const gameContext = getPixelContext(elements.gameCanvas);
lobbyContext.imageSmoothingEnabled = false;
gameContext.imageSmoothingEnabled = false;

const TRACK = { outerLeft: 32, outerTop: 32, outerRight: 864, outerBottom: 640, innerLeft: 208, innerTop: 192, innerRight: 688, innerBottom: 480 };
const props: WorldProp[] = [
  { kind: "bench", x: -10, y: 103, width: 39, height: 16, solid: true },
  { kind: "vending", x: 2, y: 157, width: 28, height: 36, solid: true },
  { kind: "plant", x: 4, y: 280, width: 20, height: 24, solid: true },
  { kind: "arcade", x: 1, y: 386, width: 27, height: 37, solid: true },
  { kind: "table", x: 294, y: 274, width: 42, height: 28, solid: true },
  { kind: "sofa", x: 426, y: 273, width: 47, height: 25, solid: true },
  { kind: "plant", x: 360, y: 220, width: 20, height: 24, solid: true },
  { kind: "mailbox", x: 870, y: 111, width: 23, height: 30, solid: true },
  { kind: "vending", x: 866, y: 222, width: 28, height: 36, solid: true },
  { kind: "bench", x: 870, y: 368, width: 39, height: 16, solid: true },
  { kind: "plant", x: 872, y: 542, width: 20, height: 24, solid: true },
  { kind: "lamp", x: 144, y: 2, width: 16, height: 30 },
  { kind: "lamp", x: 660, y: 2, width: 16, height: 30 },
  { kind: "lamp", x: 144, y: 640, width: 16, height: 30 },
  { kind: "lamp", x: 660, y: 640, width: 16, height: 30 },
];
const spinners: Spinner[] = [
  { x: 450, y: 552, radius: 52, angle: 0, speed: 2.15 },
  { x: 780, y: 340, radius: 48, angle: Math.PI * .5, speed: -2.8 },
  { x: 440, y: 112, radius: 48, angle: Math.PI * .2, speed: 3.1 },
];
const pits: Pit[] = [
  { x: 290, y: 532, width: 34, height: 36, active: false },
  { x: 720, y: 250, width: 34, height: 31, active: false },
  { x: 115, y: 280, width: 34, height: 31, active: false },
  { x: 540, y: 88, width: 34, height: 34, active: false },
];
const jumpPads = [{ x: 560, y: 532, width: 40, height: 30, pushX: -320, pushY: 0 }];
const checkpoints = [
  { x: 720, y: 512, width: 72, height: 74, spawnX: 744, spawnY: 552 },
  { x: 720, y: 80, width: 72, height: 74, spawnX: 790, spawnY: 120 },
  { x: 105, y: 80, width: 72, height: 74, spawnX: 128, spawnY: 120 },
];
const player: Player = { x: 128, y: 552, direction: "right", walking: 0, name: "말썽꾸러기", knockbackX: 0, knockbackY: 0, hitUntil: 0, fallingUntil: 0, fallingStartedAt: 0, fallTargetX: 0, fallTargetY: 0, airUntil: 0, airStartedAt: 0, dashUntil: 0, dashVelocityX: 0, dashVelocityY: 0 };
const PRACTICE_ARENA = { left: 180, top: 136, right: 716, bottom: 536 };
const testBots: TestBot[] = [];
const clones: Clone[] = [];
const projectiles: Projectile[] = [];
const skillReadyAt: Record<SkillId, number> = { push: 0, dash: 0, run: 0, grab: 0, clone: 0, slow: 0, sleep: 0 };
const skillLabels: Record<SkillId, string> = { push: "밀치기", dash: "돌진", run: "질주", grab: "그랩", clone: "분신", slow: "슬로우탄", sleep: "수면총" };
let dashCharges = 3;
let dashRechargeAt = 0;
let runUntil = 0;
let gameMode: GameMode = "track";
const pressedKeys = new Set<string>();
let gameActive = false;
let lastFrame = performance.now();
let toastTimer: number | undefined;
let checkpointIndex = 0;
let lap = 0;
let activePitIndex = -1;
let nextPitAt = 0;
let jumpPadCooldownUntil = 0;
let startArmed = false;
const aim: AimState = { screenX: VIEW_WIDTH / 2, screenY: VIEW_HEIGHT / 2, worldX: 0, worldY: 0, visible: false, pulseUntil: 0, pulseX: 0, pulseY: 0 };
let skillBarSignature = "";

function noise(x: number, y: number) {
  const value = Math.sin(x * 87.3 + y * 41.7) * 1031.77;
  return value - Math.floor(value);
}

function fillRect(context: CanvasRenderingContext2D, color: string, x: number, y: number, width: number, height: number) {
  context.fillStyle = color;
  context.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
}

function insideRect(x: number, y: number, left: number, top: number, right: number, bottom: number) {
  return x >= left && x <= right && y >= top && y <= bottom;
}

function isTrackPoint(x: number, y: number) {
  return insideRect(x, y, TRACK.outerLeft, TRACK.outerTop, TRACK.outerRight, TRACK.outerBottom)
    && !insideRect(x, y, TRACK.innerLeft, TRACK.innerTop, TRACK.innerRight, TRACK.innerBottom);
}

function drawWorldFloor(context: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
  const firstX = Math.floor(cameraX / TILE) - 1;
  const firstY = Math.floor(cameraY / TILE) - 1;
  const lastX = Math.ceil((cameraX + VIEW_WIDTH) / TILE) + 1;
  const lastY = Math.ceil((cameraY + VIEW_HEIGHT) / TILE) + 1;

  for (let ty = firstY; ty <= lastY; ty += 1) {
    for (let tx = firstX; tx <= lastX; tx += 1) {
      const sx = tx * TILE - cameraX;
      const sy = ty * TILE - cameraY;
      const wx = tx * TILE + TILE / 2;
      const wy = ty * TILE + TILE / 2;
      if (isTrackPoint(wx, wy)) {
        const shade = (tx + ty) % 2 ? "#d96b68" : "#e67b70";
        fillRect(context, shade, sx, sy, TILE, TILE);
        fillRect(context, "#bd555e", sx, sy + TILE - 2, TILE, 2);
        if (noise(tx, ty) > .68) fillRect(context, "#f39a83", sx + 3, sy + 4, 3, 2);
      } else if (insideRect(wx, wy, TRACK.innerLeft, TRACK.innerTop, TRACK.innerRight, TRACK.innerBottom)) {
        fillRect(context, (tx + ty) % 2 ? "#5da267" : "#64ad6d", sx, sy, TILE, TILE);
        if (noise(tx, ty) > .3) fillRect(context, "#8cca78", sx + 3 + Math.floor(noise(ty, tx) * 8), sy + 4 + Math.floor(noise(tx + 3, ty + 2) * 7), 2, 3);
      } else {
        fillRect(context, "#2f3153", sx, sy, TILE, TILE);
        fillRect(context, (tx + ty) % 2 ? "#45476d" : "#3d4166", sx + 1, sy + 1, TILE - 2, TILE - 2);
        if (noise(tx, ty) > .66) fillRect(context, "#777695", sx + 4, sy + 4, 2, 2);
      }
    }
  }

  const line = (color: string, x: number, y: number, width: number, height: number) => fillRect(context, color, x - cameraX, y - cameraY, width, height);
  line("#f4d7ab", TRACK.outerLeft, TRACK.outerTop, TRACK.outerRight - TRACK.outerLeft, 3);
  line("#f4d7ab", TRACK.outerLeft, TRACK.outerBottom - 3, TRACK.outerRight - TRACK.outerLeft, 3);
  line("#f4d7ab", TRACK.outerLeft, TRACK.outerTop, 3, TRACK.outerBottom - TRACK.outerTop);
  line("#f4d7ab", TRACK.outerRight - 3, TRACK.outerTop, 3, TRACK.outerBottom - TRACK.outerTop);
  line("#b94958", TRACK.innerLeft, TRACK.innerTop, TRACK.innerRight - TRACK.innerLeft, 3);
  line("#b94958", TRACK.innerLeft, TRACK.innerBottom - 3, TRACK.innerRight - TRACK.innerLeft, 3);
  line("#b94958", TRACK.innerLeft, TRACK.innerTop, 3, TRACK.innerBottom - TRACK.innerTop);
  line("#b94958", TRACK.innerRight - 3, TRACK.innerTop, 3, TRACK.innerBottom - TRACK.innerTop);

  for (let x = TRACK.innerLeft + 8; x < TRACK.innerRight - 8; x += 22) {
    line("#f8dab1", x, 111, 11, 3);
    line("#f8dab1", x, 559, 11, 3);
  }
  for (let y = TRACK.innerTop + 10; y < TRACK.innerBottom - 8; y += 22) {
    line("#f8dab1", 119, y, 3, 11);
    line("#f8dab1", 775, y, 3, 11);
  }

  for (let row = 0; row < 7; row += 1) {
    line(row % 2 ? "#fff0d1" : "#40344f", 160, 522 + row * 11, 10, 11);
    line(row % 2 ? "#40344f" : "#fff0d1", 170, 522 + row * 11, 10, 11);
  }
  line("#dbb75d", 398, 336, 102, 3);
  line("#dbb75d", 448, 286, 3, 102);
  line("#7ccc73", 403, 341, 92, 42);
  for (let index = 0; index < 10; index += 1) {
    const z = index * 63 + 24;
    line("#f6d477", 26, z, 5, 5);
    line("#f6d477", 870, z + 19, 5, 5);
  }
}

function drawVending(context: CanvasRenderingContext2D, x: number, y: number) {
  fillRect(context, "#563b65", x + 2, y + 6, 24, 30);
  fillRect(context, "#e65b71", x, y + 3, 24, 31);
  fillRect(context, "#ff8a84", x + 3, y + 6, 18, 14);
  fillRect(context, "#242542", x + 5, y + 8, 14, 9);
  for (let row = 0; row < 2; row += 1) for (let column = 0; column < 3; column += 1) fillRect(context, (row + column) % 2 ? "#79d7f0" : "#ffd766", x + 6 + column * 4, y + 9 + row * 4, 2, 2);
  fillRect(context, "#fff1d1", x + 4, y + 23, 14, 6);
  fillRect(context, "#7e334c", x + 20, y + 10, 2, 15);
  fillRect(context, "#3c2d4f", x + 3, y + 34, 20, 3);
}

function drawBench(context: CanvasRenderingContext2D, x: number, y: number) {
  fillRect(context, "#6e4860", x + 2, y + 9, 35, 6);
  fillRect(context, "#d08a5b", x, y + 4, 38, 7);
  fillRect(context, "#efae73", x + 2, y + 5, 34, 2);
  fillRect(context, "#4b3a52", x + 5, y + 15, 4, 5);
  fillRect(context, "#4b3a52", x + 29, y + 15, 4, 5);
}

function drawCrate(context: CanvasRenderingContext2D, x: number, y: number) {
  fillRect(context, "#664755", x + 2, y + 3, 20, 19);
  fillRect(context, "#b7765b", x, y, 20, 20);
  fillRect(context, "#e3aa6e", x + 3, y + 3, 14, 3);
  fillRect(context, "#8a554e", x + 8, y + 3, 4, 14);
  fillRect(context, "#8a554e", x + 3, y + 8, 14, 4);
}

function drawPlant(context: CanvasRenderingContext2D, x: number, y: number) {
  fillRect(context, "#5a4355", x + 4, y + 15, 12, 9);
  fillRect(context, "#e07b58", x + 3, y + 13, 14, 8);
  fillRect(context, "#ffc07b", x + 5, y + 14, 10, 2);
  fillRect(context, "#3b805d", x + 8, y + 2, 5, 13);
  fillRect(context, "#5fae6e", x + 2, y + 6, 7, 6);
  fillRect(context, "#5fae6e", x + 11, y + 4, 7, 7);
  fillRect(context, "#8bd57b", x + 5, y, 5, 7);
}

function drawTable(context: CanvasRenderingContext2D, x: number, y: number) {
  fillRect(context, "#52394c", x + 3, y + 11, 36, 15);
  fillRect(context, "#c58a63", x, y + 5, 40, 13);
  fillRect(context, "#f2bb7b", x + 3, y + 7, 34, 3);
  fillRect(context, "#f5f1db", x + 10, y + 8, 8, 5);
  fillRect(context, "#f5f1db", x + 23, y + 9, 10, 4);
  fillRect(context, "#5e4254", x + 4, y + 18, 4, 9);
  fillRect(context, "#5e4254", x + 32, y + 18, 4, 9);
}

function drawSofa(context: CanvasRenderingContext2D, x: number, y: number) {
  fillRect(context, "#4e415a", x + 3, y + 8, 42, 17);
  fillRect(context, "#6c8bc2", x, y + 6, 44, 16);
  fillRect(context, "#91b5e7", x + 3, y + 8, 16, 7);
  fillRect(context, "#91b5e7", x + 24, y + 8, 16, 7);
  fillRect(context, "#4d5d92", x + 4, y + 19, 36, 4);
  fillRect(context, "#3f354e", x + 4, y + 23, 4, 4);
  fillRect(context, "#3f354e", x + 36, y + 23, 4, 4);
}

function drawLamp(context: CanvasRenderingContext2D, x: number, y: number) {
  fillRect(context, "#52516c", x + 7, y + 10, 3, 20);
  fillRect(context, "#414159", x + 3, y + 28, 11, 3);
  fillRect(context, "#f3ca69", x + 3, y + 3, 11, 9);
  fillRect(context, "#fff3ae", x + 5, y + 5, 7, 4);
}

function drawMailbox(context: CanvasRenderingContext2D, x: number, y: number) {
  fillRect(context, "#4d4b66", x + 7, y + 15, 6, 15);
  fillRect(context, "#5c94b2", x + 2, y + 3, 18, 16);
  fillRect(context, "#94d5df", x + 4, y + 5, 14, 4);
  fillRect(context, "#293851", x + 5, y + 12, 11, 2);
  fillRect(context, "#ef6b6f", x + 19, y + 7, 4, 4);
}

function drawArcade(context: CanvasRenderingContext2D, x: number, y: number) {
  fillRect(context, "#40344f", x + 2, y + 6, 23, 31);
  fillRect(context, "#86528f", x, y + 2, 23, 31);
  fillRect(context, "#f174ae", x + 3, y + 5, 17, 12);
  fillRect(context, "#1e2945", x + 5, y + 7, 13, 8);
  fillRect(context, "#74f0dc", x + 8, y + 9, 7, 3);
  fillRect(context, "#f7d366", x + 8, y + 21, 3, 3);
  fillRect(context, "#67c5df", x + 14, y + 21, 3, 3);
  fillRect(context, "#3c2e49", x + 5, y + 33, 14, 4);
}

function drawProp(context: CanvasRenderingContext2D, prop: WorldProp, cameraX: number, cameraY: number) {
  const x = Math.floor(prop.x - cameraX);
  const y = Math.floor(prop.y - cameraY);
  if (x > VIEW_WIDTH + 50 || y > VIEW_HEIGHT + 50 || x + prop.width < -50 || y + prop.height < -50) return;
  if (prop.kind === "vending") drawVending(context, x, y);
  if (prop.kind === "bench") drawBench(context, x, y);
  if (prop.kind === "crate") drawCrate(context, x, y);
  if (prop.kind === "plant") drawPlant(context, x, y);
  if (prop.kind === "table") drawTable(context, x, y);
  if (prop.kind === "sofa") drawSofa(context, x, y);
  if (prop.kind === "lamp") drawLamp(context, x, y);
  if (prop.kind === "mailbox") drawMailbox(context, x, y);
  if (prop.kind === "arcade") drawArcade(context, x, y);
}

function drawPit(context: CanvasRenderingContext2D, pit: Pit, cameraX: number, cameraY: number, time: number) {
  const x = pit.x - cameraX;
  const y = pit.y - cameraY;
  fillRect(context, "#9e4c59", x - 2, y - 2, pit.width + 4, pit.height + 4);
  if (!pit.active) {
    fillRect(context, "#7f5665", x, y, pit.width, pit.height);
    for (let index = 4; index < pit.width; index += 8) fillRect(context, "#b37a77", x + index, y + 2, 2, pit.height - 4);
    fillRect(context, "#f0b26e", x + 2, y + 2, pit.width - 4, 2);
    return;
  }
  fillRect(context, "#392d4a", x, y, pit.width, pit.height);
  fillRect(context, "#17182e", x + 3, y + 4, pit.width - 6, pit.height - 7);
  fillRect(context, "#5b3f5b", x + 5, y + 5, pit.width - 10, 3);
  const spark = Math.floor(time / 120) % 3;
  fillRect(context, "#ec7769", x + 4 + spark * 6, y + pit.height - 7, 3, 2);
  fillRect(context, "#f4c562", x + pit.width - 8, y + 8 + spark * 4, 2, 3);
}

function drawJumpPad(context: CanvasRenderingContext2D, pad: typeof jumpPads[number], cameraX: number, cameraY: number) {
  const x = pad.x - cameraX;
  const y = pad.y - cameraY;
  fillRect(context, "#403b63", x - 2, y + 5, pad.width + 4, pad.height - 3);
  fillRect(context, "#4c77b8", x, y + 2, pad.width, pad.height - 6);
  fillRect(context, "#78cdea", x + 3, y + 5, pad.width - 6, 5);
  for (const offset of [5, 20]) {
    fillRect(context, "#fff0a7", x + offset + 6, y + 11, 9, 3);
    fillRect(context, "#fff0a7", x + offset + 3, y + 8, 4, 9);
    fillRect(context, "#fff0a7", x + offset, y + 11, 4, 3);
    fillRect(context, "#e7a85e", x + offset + 6, y + 14, 9, 2);
  }
  fillRect(context, "#293a68", x + 3, y + 21, pad.width - 6, 2);
}

function drawCheckpoint(context: CanvasRenderingContext2D, checkpoint: typeof checkpoints[number], cameraX: number, cameraY: number, active: boolean, label: string) {
  const x = checkpoint.x - cameraX;
  const y = checkpoint.y - cameraY;
  const color = active ? "#f7d366" : "#a58ca4";
  fillRect(context, "#4a3d58", x + 31, y + 12, 4, 41);
  fillRect(context, color, x + 35, y + 12, 18, 11);
  fillRect(context, active ? "#fff0af" : "#d6bfd2", x + 38, y + 15, 4, 4);
  fillRect(context, "#4a3d58", x + 27, y + 51, 12, 3);
  context.fillStyle = active ? "#fff5c1" : "#dfc7dc";
  context.font = "bold 7px monospace";
  context.fillText(label, Math.round(x + 42), Math.round(y + 21));
}

function drawSpinner(context: CanvasRenderingContext2D, spinner: Spinner, cameraX: number, cameraY: number) {
  const x = spinner.x - cameraX;
  const y = spinner.y - cameraY;
  const dx = Math.cos(spinner.angle) * spinner.radius;
  const dy = Math.sin(spinner.angle) * spinner.radius;
  context.save();
  context.translate(Math.round(x), Math.round(y));
  context.rotate(spinner.angle);
  fillRect(context, "#673f5a", -spinner.radius - 2, -4, spinner.radius * 2 + 4, 8);
  fillRect(context, "#f1c55f", -spinner.radius, -2, spinner.radius * 2, 4);
  fillRect(context, "#f37e72", -spinner.radius - 3, -5, 8, 10);
  fillRect(context, "#f37e72", spinner.radius - 5, -5, 8, 10);
  context.restore();
  fillRect(context, "#40364e", x - 7, y - 4, 14, 11);
  fillRect(context, "#9e8db4", x - 4, y - 8, 8, 12);
  fillRect(context, "#f8dd7d", x - 2, y - 5, 4, 5);
  fillRect(context, "#f1c55f", x + dx - 2, y + dy - 2, 4, 4);
}

function drawPerson(context: CanvasRenderingContext2D, x: number, y: number, direction: Direction, walking: number, color = "#f16c7a", npc = false) {
  const bounce = npc ? Math.sin(walking) > .65 ? 1 : 0 : Math.abs(Math.sin(walking)) > .65 ? 1 : 0;
  fillRect(context, "rgba(38,31,54,.35)", x - 6, y + 9, 13, 3);
  const leftStep = Math.sin(walking) > 0 ? 1 : 0;
  const rightStep = Math.sin(walking) <= 0 ? 1 : 0;
  fillRect(context, "#36324b", x - 4, y + 7 + leftStep, 3, 5);
  fillRect(context, "#36324b", x + 2, y + 7 + rightStep, 3, 5);
  fillRect(context, color, x - 5, y + 1 + bounce, 11, 8);
  fillRect(context, "#ffffff", x - 3, y + 2 + bounce, 7, 3);
  fillRect(context, "#f4d9c7", x - 4, y - 5 + bounce, 10, 8);
  fillRect(context, npc ? "#54415e" : "#3c3550", x - 5, y - 7 + bounce, 11, 4);
  if (direction === "down") {
    fillRect(context, "#273047", x - 2, y - 2 + bounce, 2, 2);
    fillRect(context, "#273047", x + 2, y - 2 + bounce, 2, 2);
  }
  if (direction === "up") fillRect(context, "#3c3550", x - 4, y - 3 + bounce, 9, 4);
  if (direction === "left") fillRect(context, "#273047", x - 4, y - 2 + bounce, 2, 2);
  if (direction === "right") fillRect(context, "#273047", x + 4, y - 2 + bounce, 2, 2);
  fillRect(context, "#f4d9c7", x - 7, y + 3 + bounce, 2, 4);
  fillRect(context, "#f4d9c7", x + 7, y + 3 + bounce, 2, 4);
}

function drawPlayer(context: CanvasRenderingContext2D, cameraX: number, cameraY: number, time: number) {
  const baseX = player.x - cameraX;
  const baseY = player.y - cameraY;
  if (player.fallingUntil > time) {
    const progress = Math.max(0, Math.min(1, (time - player.fallingStartedAt) / 520));
    const drawX = baseX + (player.fallTargetX - player.x) * progress;
    const drawY = baseY + (player.fallTargetY - player.y) * progress;
    const scale = Math.max(.16, 1 - progress * .84);
    context.save();
    context.translate(Math.round(drawX), Math.round(drawY));
    context.scale(scale, scale);
    drawPerson(context, 0, 0, player.direction, player.walking);
    context.restore();
    return;
  }

  const airProgress = player.airUntil > time ? Math.max(0, Math.min(1, (time - player.airStartedAt) / 560)) : 0;
  const lift = airProgress > 0 ? Math.sin(airProgress * Math.PI) * 18 : 0;
  if (lift > 0) fillRect(context, "rgba(38,31,54,.3)", baseX - 8, baseY + 10, 16, 3);
  drawPerson(context, baseX, baseY - lift, player.direction, player.walking);
}

type Rect = { x: number; y: number; width: number; height: number };

function intersects(left: number, top: number, width: number, height: number, rect: Rect, inset = 2) {
  return left < rect.x + rect.width - inset && left + width > rect.x + inset && top < rect.y + rect.height - inset && top + height > rect.y + inset;
}

function canStandAt(x: number, y: number) {
  if (gameMode === "practice") {
    if (x - 5 < PRACTICE_ARENA.left || x + 5 > PRACTICE_ARENA.right || y - 5 < PRACTICE_ARENA.top || y + 7 > PRACTICE_ARENA.bottom) return false;
    return !clones.some((clone) => Math.abs(x - clone.x) < 11 && Math.abs(y - clone.y) < 12);
  }
  const playerLeft = x - 5;
  const playerTop = y - 5;
  const feet = [
    [x - 4, y - 3], [x + 4, y - 3], [x - 4, y + 6], [x + 4, y + 6],
  ];
  if (!feet.every(([footX, footY]) => isTrackPoint(footX, footY))) return false;
  return !props.some((prop) => prop.solid && intersects(playerLeft, playerTop, 10, 12, prop));
}

function movePlayer(dx: number, dy: number) {
  const candidateX = player.x + dx;
  const candidateY = player.y + dy;
  if (canStandAt(candidateX, player.y)) player.x = candidateX;
  else player.knockbackX = 0;
  if (canStandAt(player.x, candidateY)) player.y = candidateY;
  else player.knockbackY = 0;
}

function getAimVector() {
  const fallback = player.direction === "left" ? [-1, 0] : player.direction === "up" ? [0, -1] : player.direction === "down" ? [0, 1] : [1, 0];
  if (!aim.visible) return { x: fallback[0], y: fallback[1] };
  const dx = aim.worldX - player.x;
  const dy = aim.worldY - player.y;
  const length = Math.hypot(dx, dy);
  return length > 2 ? { x: dx / length, y: dy / length } : { x: fallback[0], y: fallback[1] };
}

function getPracticeTargetInAim(maxDistance: number, minimumDot = .55) {
  const aimVector = getAimVector();
  let candidate: TestBot | undefined;
  let candidateDistance = Number.POSITIVE_INFINITY;
  for (const bot of testBots) {
    const dx = bot.x - player.x;
    const dy = bot.y - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance > maxDistance || distance === 0 || (dx / distance) * aimVector.x + (dy / distance) * aimVector.y < minimumDot) continue;
    if (distance < candidateDistance) {
      candidate = bot;
      candidateDistance = distance;
    }
  }
  return candidate;
}

function canUseSkill(id: SkillId, now: number) {
  if (id === "dash") return dashCharges > 0 && now >= skillReadyAt.dash;
  if (id === "clone") return clones.length < 5 && now >= skillReadyAt.clone;
  return now >= skillReadyAt[id];
}

function applySlow(centerX: number, centerY: number, radius: number, now: number) {
  let count = 0;
  for (const bot of testBots) {
    if (Math.hypot(bot.x - centerX, bot.y - centerY) > radius) continue;
    bot.slowUntil = Math.max(bot.slowUntil, now + 3600);
    count += 1;
  }
  return count;
}

function useSkill(id: SkillId, now = performance.now()) {
  if (gameMode !== "practice") {
    showToast("스킬은 연습장에서 테스트할 수 있다.");
    return false;
  }
  if (!canUseSkill(id, now) || player.fallingUntil > now) return false;
  const aimVector = getAimVector();

  if (id === "push") {
    skillReadyAt.push = now + 2600;
    let count = 0;
    for (const bot of testBots) {
      const dx = bot.x - player.x;
      const dy = bot.y - player.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 72 || distance === 0) continue;
      bot.knockbackX = dx / distance * 300;
      bot.knockbackY = dy / distance * 300;
      count += 1;
    }
    aim.pulseX = player.x;
    aim.pulseY = player.y;
    aim.pulseUntil = now + 300;
    showToast(count ? `${count}명을 밀쳐냈다!` : "밀칠 대상이 근처에 없다.");
  }

  if (id === "dash") {
    dashCharges -= 1;
    skillReadyAt.dash = now + 170;
    player.dashVelocityX = aimVector.x * 510;
    player.dashVelocityY = aimVector.y * 510;
    player.dashUntil = now + 165;
    if (dashCharges === 0) dashRechargeAt = now + 4300;
    showToast(`돌진! (${dashCharges}/3)`);
  }

  if (id === "run") {
    skillReadyAt.run = now + 9000;
    runUntil = now + 4600;
    showToast("질주 모드! 계속 달릴 수 있다.");
  }

  if (id === "grab") {
    skillReadyAt.grab = now + 3800;
    const target = getPracticeTargetInAim(180);
    if (target) {
      target.x = Math.max(PRACTICE_ARENA.left + 12, Math.min(PRACTICE_ARENA.right - 12, player.x + aimVector.x * 34));
      target.y = Math.max(PRACTICE_ARENA.top + 12, Math.min(PRACTICE_ARENA.bottom - 12, player.y + aimVector.y * 34));
      target.knockbackX = 0;
      target.knockbackY = 0;
      showToast(`${target.name}을(를) 앞으로 끌어왔다!`);
    } else {
      showToast("그랩 사거리 안에 조준한 대상이 없다.");
    }
  }

  if (id === "clone") {
    skillReadyAt.clone = now + 1100;
    const spawnX = Math.max(PRACTICE_ARENA.left + 12, Math.min(PRACTICE_ARENA.right - 12, player.x + aimVector.x * 32));
    const spawnY = Math.max(PRACTICE_ARENA.top + 12, Math.min(PRACTICE_ARENA.bottom - 12, player.y + aimVector.y * 32));
    clones.push({ x: spawnX, y: spawnY, direction: player.direction, until: now + 9500 });
    showToast(`분신 배치! (${clones.length}/5)`);
  }

  if (id === "slow") {
    skillReadyAt.slow = now + 4600;
    projectiles.push({ kind: "slow", x: player.x, y: player.y - 2, velocityX: aimVector.x * 265, velocityY: aimVector.y * 265, until: now + 760, radius: 72 });
    showToast("슬로우탄 발사!");
  }

  if (id === "sleep") {
    skillReadyAt.sleep = now + 2000;
    projectiles.push({ kind: "sleep", x: player.x, y: player.y - 2, velocityX: aimVector.x * 345, velocityY: aimVector.y * 345, until: now + 680, radius: 0 });
    showToast("수면총 발사!");
  }
  return true;
}

function useRandomSkill(now: number) {
  const available = (Object.keys(skillLabels) as SkillId[]).filter((id) => canUseSkill(id, now));
  if (!available.length) {
    showToast("지금 사용할 수 있는 랜덤 스킬이 없다.");
    return;
  }
  const selected = available[Math.floor(Math.random() * available.length)];
  useSkill(selected, now);
  showToast(`랜덤 스킬: ${skillLabels[selected]}!`);
}

function canBotStand(bot: TestBot, x: number, y: number) {
  if (x - 6 < PRACTICE_ARENA.left || x + 6 > PRACTICE_ARENA.right || y - 6 < PRACTICE_ARENA.top || y + 8 > PRACTICE_ARENA.bottom) return false;
  return !clones.some((clone) => Math.abs(x - clone.x) < 13 && Math.abs(y - clone.y) < 14);
}

function updatePracticeBots(now: number, dt: number) {
  for (let index = clones.length - 1; index >= 0; index -= 1) if (clones[index].until <= now) clones.splice(index, 1);
  if (dashCharges === 0 && now >= dashRechargeAt) {
    dashCharges = 3;
    showToast("돌진 3회가 다시 충전됐다!");
  }
  for (const bot of testBots) {
    if (bot.sleepUntil > now) continue;
    if (bot.nextTurnAt <= now) {
      const angle = Math.random() * Math.PI * 2;
      bot.moveX = Math.cos(angle);
      bot.moveY = Math.sin(angle);
      bot.nextTurnAt = now + 900 + Math.random() * 1500;
      bot.direction = Math.abs(bot.moveX) > Math.abs(bot.moveY) ? (bot.moveX < 0 ? "left" : "right") : (bot.moveY < 0 ? "up" : "down");
    }
    const speed = bot.slowUntil > now ? 19 : 48;
    const candidateX = bot.x + bot.moveX * speed * dt;
    const candidateY = bot.y + bot.moveY * speed * dt;
    if (canBotStand(bot, candidateX, bot.y)) bot.x = candidateX;
    else bot.nextTurnAt = 0;
    if (canBotStand(bot, bot.x, candidateY)) bot.y = candidateY;
    else bot.nextTurnAt = 0;
    if (Math.abs(bot.knockbackX) > 2 || Math.abs(bot.knockbackY) > 2) {
      const knockX = bot.x + bot.knockbackX * dt;
      const knockY = bot.y + bot.knockbackY * dt;
      if (canBotStand(bot, knockX, bot.y)) bot.x = knockX;
      else bot.knockbackX = 0;
      if (canBotStand(bot, bot.x, knockY)) bot.y = knockY;
      else bot.knockbackY = 0;
      bot.knockbackX *= Math.pow(.02, dt);
      bot.knockbackY *= Math.pow(.02, dt);
    }
    bot.walking += dt * (bot.slowUntil > now ? 4 : 9);
  }
}

function updateProjectiles(now: number, dt: number) {
  for (let index = projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = projectiles[index];
    projectile.x += projectile.velocityX * dt;
    projectile.y += projectile.velocityY * dt;
    const target = testBots.find((bot) => Math.hypot(bot.x - projectile.x, bot.y - projectile.y) < 11);
    const expired = now >= projectile.until || projectile.x < PRACTICE_ARENA.left || projectile.x > PRACTICE_ARENA.right || projectile.y < PRACTICE_ARENA.top || projectile.y > PRACTICE_ARENA.bottom;
    if (!target && !expired) continue;
    if (projectile.kind === "slow") {
      const count = applySlow(projectile.x, projectile.y, projectile.radius, now);
      showToast(count ? `${count}명이 느려졌다!` : "슬로우탄이 빈 곳에서 터졌다.");
    }
    if (projectile.kind === "sleep" && target) {
      target.sleepUntil = now + 2000;
      target.knockbackX = 0;
      target.knockbackY = 0;
      showToast(`${target.name}이(가) 2초간 잠들었다!`);
    }
    projectiles.splice(index, 1);
  }
}

function pointSegmentDistance(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const abX = bx - ax;
  const abY = by - ay;
  const denominator = abX * abX + abY * abY;
  const progress = denominator === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * abX + (py - ay) * abY) / denominator));
  return Math.hypot(px - (ax + abX * progress), py - (ay + abY * progress));
}

function updateObjective() {
  if (gameMode === "practice") {
    elements.objective.textContent = "TEST BOTS";
    return;
  }
  if (lap >= 1) {
    elements.objective.textContent = "1 LAP FINISH!";
    return;
  }
  elements.objective.textContent = checkpointIndex < checkpoints.length ? `CHECKPOINT ${checkpointIndex + 1}` : "START GATE!";
}

function respawnAtCheckpoint(message: string, now: number) {
  const respawns = [
    { x: 128, y: 552 },
    { x: 744, y: 552 },
    { x: 790, y: 120 },
    { x: 128, y: 120 },
  ];
  const safeSpot = respawns[Math.min(checkpointIndex, respawns.length - 1)];
  player.x = safeSpot.x;
  player.y = safeSpot.y;
  player.knockbackX = 0;
  player.knockbackY = 0;
  player.fallingUntil = 0;
  player.airUntil = 0;
  player.hitUntil = now + 550;
  showToast(message);
}

function beginPitFall(pit: Pit, now: number) {
  player.fallingStartedAt = now;
  player.fallingUntil = now + 520;
  player.fallTargetX = pit.x + pit.width / 2;
  player.fallTargetY = pit.y + pit.height / 2;
  player.knockbackX = 0;
  player.knockbackY = 0;
  player.airUntil = 0;
  player.hitUntil = now + 600;
  showToast("구덩이에 빨려 들어간다!");
}

function updateHazards(now: number, dt: number) {
  for (const spinner of spinners) spinner.angle += spinner.speed * dt;

  if (now >= nextPitAt) {
    const nextIndex = (activePitIndex + 1 + Math.floor(Math.random() * (pits.length - 1))) % pits.length;
    pits.forEach((pit, index) => { pit.active = index === nextIndex; });
    activePitIndex = nextIndex;
    nextPitAt = now + 2200 + Math.random() * 1600;
    showToast("트랙 바닥이 흔들린다!");
  }

  const playerLeft = player.x - 5;
  const playerTop = player.y - 5;
  for (const pit of pits) {
    if (pit.active && now > player.hitUntil && intersects(playerLeft, playerTop, 10, 12, pit, 4)) {
      beginPitFall(pit, now);
      return;
    }
  }

  for (const pad of jumpPads) {
    if (now > jumpPadCooldownUntil && intersects(playerLeft, playerTop, 10, 12, pad, 2)) {
      player.knockbackX = pad.pushX;
      player.knockbackY = pad.pushY;
      player.airStartedAt = now;
      player.airUntil = now + 560;
      player.hitUntil = now + 560;
      jumpPadCooldownUntil = now + 980;
      showToast("점프대에 떠올라 뒤로 날아간다!");
    }
  }

  if (now <= player.hitUntil) return;
  for (const spinner of spinners) {
    const dx = Math.cos(spinner.angle) * spinner.radius;
    const dy = Math.sin(spinner.angle) * spinner.radius;
    if (pointSegmentDistance(player.x, player.y + 2, spinner.x - dx, spinner.y - dy, spinner.x + dx, spinner.y + dy) > 8) continue;
    const awayX = player.x - spinner.x;
    const awayY = player.y - spinner.y;
    const distance = Math.max(1, Math.hypot(awayX, awayY));
    player.knockbackX = awayX / distance * 250;
    player.knockbackY = awayY / distance * 250;
    player.hitUntil = now + 430;
    showToast("회전봉에 밀려났다!");
    break;
  }
}

function updateProgress(now: number) {
  if (player.fallingUntil > now) return;
  const playerLeft = player.x - 5;
  const playerTop = player.y - 5;
  const checkpoint = checkpoints[checkpointIndex];
  if (checkpoint && intersects(playerLeft, playerTop, 10, 12, checkpoint, 8)) {
    checkpointIndex += 1;
    if (checkpointIndex === checkpoints.length) {
      startArmed = true;
      showToast("마지막 관문 통과! 시작선으로 돌아가세요.");
    } else {
      showToast(`${checkpointIndex}번째 체크포인트 통과!`);
    }
    updateObjective();
    return;
  }

  const startGate = { x: 128, y: 506, width: 62, height: 82 };
  if (startArmed && intersects(playerLeft, playerTop, 10, 12, startGate, 5)) {
    lap += 1;
    checkpointIndex = 0;
    startArmed = false;
    player.hitUntil = now + 300;
    elements.lap.textContent = `${lap} / 1 LAP`;
    updateObjective();
    showToast("★ 1바퀴 완주! 말썽 운동장을 정복했다! ★");
  }
}

function updatePlayer(dt: number, now: number) {
  if (player.fallingUntil > 0) {
    if (now < player.fallingUntil) return;
    respawnAtCheckpoint("마지막 체크포인트에서 다시 달린다!", now);
    return;
  }
  if (player.dashUntil > now) {
    movePlayer(player.dashVelocityX * dt, player.dashVelocityY * dt);
    player.walking += dt * 24;
    return;
  }
  let horizontal = Number(pressedKeys.has("d") || pressedKeys.has("arrowright")) - Number(pressedKeys.has("a") || pressedKeys.has("arrowleft"));
  let vertical = Number(pressedKeys.has("s") || pressedKeys.has("arrowdown")) - Number(pressedKeys.has("w") || pressedKeys.has("arrowup"));
  const moving = horizontal !== 0 || vertical !== 0;
  if (moving && now > player.hitUntil) {
    const length = Math.hypot(horizontal, vertical);
    horizontal /= length;
    vertical /= length;
    if (Math.abs(horizontal) > Math.abs(vertical)) player.direction = horizontal < 0 ? "left" : "right";
    else player.direction = vertical < 0 ? "up" : "down";
    const runMultiplier = runUntil > now ? 1.68 : 1;
    movePlayer(horizontal * 110 * runMultiplier * dt, vertical * 110 * runMultiplier * dt);
    player.walking += dt * 12;
  }

  if (Math.abs(player.knockbackX) > 2 || Math.abs(player.knockbackY) > 2) {
    movePlayer(player.knockbackX * dt, player.knockbackY * dt);
    player.knockbackX *= Math.pow(.015, dt);
    player.knockbackY *= Math.pow(.015, dt);
    player.walking += dt * 14;
  }
}

function getCamera() {
  return {
    x: Math.max(0, Math.min(WORLD_WIDTH - VIEW_WIDTH, player.x - VIEW_WIDTH / 2)),
    y: Math.max(0, Math.min(WORLD_HEIGHT - VIEW_HEIGHT, player.y - VIEW_HEIGHT / 2)),
  };
}

function drawAimGuide(context: CanvasRenderingContext2D, cameraX: number, cameraY: number, time: number) {
  if (!aim.visible) return;
  aim.worldX = cameraX + aim.screenX;
  aim.worldY = cameraY + aim.screenY;
  const originX = player.x - cameraX;
  const originY = player.y - cameraY - 1;
  const dx = aim.screenX - originX;
  const dy = aim.screenY - originY;
  const distance = Math.hypot(dx, dy);
  if (distance > 0) {
    const unitX = dx / distance;
    const unitY = dy / distance;
    const guideLength = Math.min(distance - 8, 92);
    for (let step = 14; step < guideLength; step += 8) {
      fillRect(context, "#76d7e7", originX + unitX * step - 1, originY + unitY * step - 1, 3, 3);
    }
  }

  const targetX = aim.screenX;
  const targetY = aim.screenY;
  fillRect(context, "#1f2947", targetX - 7, targetY - 1, 15, 3);
  fillRect(context, "#1f2947", targetX - 1, targetY - 7, 3, 15);
  fillRect(context, "#87e5eb", targetX - 5, targetY, 11, 1);
  fillRect(context, "#87e5eb", targetX, targetY - 5, 1, 11);
  fillRect(context, "#f6d477", targetX - 1, targetY - 1, 3, 3);

  if (time < aim.pulseUntil) {
    const progress = 1 - (aim.pulseUntil - time) / 400;
    const radius = 4 + Math.floor(progress * 15);
    const pulseX = aim.pulseX - cameraX;
    const pulseY = aim.pulseY - cameraY;
    fillRect(context, "#c5f3ed", pulseX - radius, pulseY - radius, radius * 2 + 1, 2);
    fillRect(context, "#c5f3ed", pulseX - radius, pulseY + radius - 1, radius * 2 + 1, 2);
    fillRect(context, "#c5f3ed", pulseX - radius, pulseY - radius, 2, radius * 2 + 1);
    fillRect(context, "#c5f3ed", pulseX + radius - 1, pulseY - radius, 2, radius * 2 + 1);
  }
}

function drawPracticeFloor(context: CanvasRenderingContext2D, cameraX: number, cameraY: number) {
  const firstX = Math.floor(cameraX / TILE) - 1;
  const firstY = Math.floor(cameraY / TILE) - 1;
  const lastX = Math.ceil((cameraX + VIEW_WIDTH) / TILE) + 1;
  const lastY = Math.ceil((cameraY + VIEW_HEIGHT) / TILE) + 1;
  for (let ty = firstY; ty <= lastY; ty += 1) {
    for (let tx = firstX; tx <= lastX; tx += 1) {
      const x = tx * TILE - cameraX;
      const y = ty * TILE - cameraY;
      const worldX = tx * TILE + TILE / 2;
      const worldY = ty * TILE + TILE / 2;
      const inArena = insideRect(worldX, worldY, PRACTICE_ARENA.left, PRACTICE_ARENA.top, PRACTICE_ARENA.right, PRACTICE_ARENA.bottom);
      fillRect(context, inArena ? ((tx + ty) % 2 ? "#59617c" : "#626b86") : "#292b4a", x, y, TILE, TILE);
      if (inArena) {
        fillRect(context, "#777f99", x, y + TILE - 2, TILE, 2);
        if (noise(tx, ty) > .7) fillRect(context, "#93a2b2", x + 4, y + 4, 2, 2);
      }
    }
  }
  const line = (color: string, x: number, y: number, width: number, height: number) => fillRect(context, color, x - cameraX, y - cameraY, width, height);
  line("#e8c861", PRACTICE_ARENA.left, PRACTICE_ARENA.top, PRACTICE_ARENA.right - PRACTICE_ARENA.left, 4);
  line("#e8c861", PRACTICE_ARENA.left, PRACTICE_ARENA.bottom - 4, PRACTICE_ARENA.right - PRACTICE_ARENA.left, 4);
  line("#e8c861", PRACTICE_ARENA.left, PRACTICE_ARENA.top, 4, PRACTICE_ARENA.bottom - PRACTICE_ARENA.top);
  line("#e8c861", PRACTICE_ARENA.right - 4, PRACTICE_ARENA.top, 4, PRACTICE_ARENA.bottom - PRACTICE_ARENA.top);
  line("#3e4563", 424, 312, 48, 48);
  line("#8ee0bf", 428, 316, 40, 3);
  line("#8ee0bf", 428, 353, 40, 3);
}

function drawTestBot(context: CanvasRenderingContext2D, bot: TestBot, cameraX: number, cameraY: number, time: number) {
  const x = bot.x - cameraX;
  const y = bot.y - cameraY;
  drawPerson(context, x, y, bot.direction, bot.walking, bot.color, true);
  if (bot.slowUntil > time) {
    fillRect(context, "#76d7e7", x - 7, y - 9, 14, 2);
    fillRect(context, "#76d7e7", x - 7, y + 12, 14, 2);
  }
  if (bot.sleepUntil > time) {
    context.fillStyle = "#e5b8f4";
    context.font = "bold 8px monospace";
    context.fillText("Z", Math.round(x + 7), Math.round(y - 10));
  }
  context.fillStyle = "#fff4d5";
  context.font = "bold 6px monospace";
  context.fillText(bot.name, Math.round(x - 11), Math.round(y - 13));
}

function drawClone(context: CanvasRenderingContext2D, clone: Clone, cameraX: number, cameraY: number, time: number) {
  const x = clone.x - cameraX;
  const y = clone.y - cameraY;
  const flicker = Math.floor(time / 120) % 2;
  fillRect(context, flicker ? "#b8a2f1" : "#806bc7", x - 8, y - 9, 16, 23);
  drawPerson(context, x, y, clone.direction, 0, "#8977d1", true);
  fillRect(context, "#d8c4ff", x - 4, y - 8, 8, 1);
}

function drawProjectile(context: CanvasRenderingContext2D, projectile: Projectile, cameraX: number, cameraY: number) {
  const x = projectile.x - cameraX;
  const y = projectile.y - cameraY;
  if (projectile.kind === "slow") {
    fillRect(context, "#273d65", x - 5, y - 5, 11, 11);
    fillRect(context, "#74dbea", x - 3, y - 3, 7, 7);
    fillRect(context, "#efffc9", x - 1, y - 1, 3, 3);
    return;
  }
  fillRect(context, "#4a345d", x - 5, y - 3, 11, 7);
  fillRect(context, "#d58ee9", x - 3, y - 2, 7, 5);
  fillRect(context, "#fff0cc", x + 2, y - 1, 3, 3);
}

function updateSkillBar(now: number) {
  if (gameMode !== "practice") {
    elements.skillBar.classList.add("hidden");
    return;
  }
  elements.skillBar.classList.remove("hidden");
  const ids: SkillId[] = ["push", "dash", "run", "grab", "clone", "slow", "sleep"];
  const markup = ids.map((id, index) => {
    const remaining = Math.max(0, skillReadyAt[id] - now);
    const active = id === "run" && runUntil > now;
    const status = id === "dash" ? (dashCharges > 0 ? `${dashCharges}/3` : `${Math.ceil(Math.max(0, dashRechargeAt - now) / 1000)}s`) : id === "clone" ? `${clones.length}/5` : active ? "RUN!" : remaining > 0 ? `${Math.ceil(remaining / 1000)}s` : "READY";
    const unavailable = !canUseSkill(id, now);
    return `<span class="skill-chip${unavailable ? " cooldown" : ""}${active ? " active" : ""}"><b>${index + 1}. ${skillLabels[id]}</b>${status}</span>`;
  }).join("") + `<span class="skill-chip"><b>R. 랜덤</b>ROLL</span>`;
  if (markup !== skillBarSignature) {
    skillBarSignature = markup;
    elements.skillBar.innerHTML = markup;
  }
}

function drawPractice(context: CanvasRenderingContext2D, time: number) {
  const camera = getCamera();
  const cameraX = camera.x;
  const cameraY = camera.y;
  context.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  drawPracticeFloor(context, cameraX, cameraY);
  for (const clone of clones) drawClone(context, clone, cameraX, cameraY, time);
  const bots = [...testBots].sort((a, b) => a.y - b.y);
  let playerDrawn = false;
  for (const bot of bots) {
    if (!playerDrawn && player.y < bot.y) {
      drawPlayer(context, cameraX, cameraY, time);
      playerDrawn = true;
    }
    drawTestBot(context, bot, cameraX, cameraY, time);
  }
  if (!playerDrawn) drawPlayer(context, cameraX, cameraY, time);
  for (const projectile of projectiles) drawProjectile(context, projectile, cameraX, cameraY);
  drawAimGuide(context, cameraX, cameraY, time);
  fillRect(context, "rgba(34,26,57,.28)", 0, 0, VIEW_WIDTH, 3);
  fillRect(context, "rgba(34,26,57,.28)", 0, VIEW_HEIGHT - 3, VIEW_WIDTH, 3);
}

function drawTown(context: CanvasRenderingContext2D, time: number) {
  if (gameMode === "practice") {
    drawPractice(context, time);
    return;
  }
  const camera = getCamera();
  const cameraX = camera.x;
  const cameraY = camera.y;
  context.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  drawWorldFloor(context, cameraX, cameraY);

  for (const pit of pits) drawPit(context, pit, cameraX, cameraY, time);
  for (const pad of jumpPads) drawJumpPad(context, pad, cameraX, cameraY);
  checkpoints.forEach((checkpoint, index) => drawCheckpoint(context, checkpoint, cameraX, cameraY, checkpointIndex === index, `${index + 1}`));

  const draws = [...props].sort((a, b) => a.y + a.height - (b.y + b.height));
  let playerDrawn = false;
  for (const prop of draws) {
    if (!playerDrawn && player.y + 12 < prop.y + prop.height) {
      drawPlayer(context, cameraX, cameraY, time);
      playerDrawn = true;
    }
    drawProp(context, prop, cameraX, cameraY);
  }
  if (!playerDrawn) drawPlayer(context, cameraX, cameraY, time);

  for (const spinner of spinners) drawSpinner(context, spinner, cameraX, cameraY);
  drawAimGuide(context, cameraX, cameraY, time);

  const npcs = [
    { x: 271, y: 205, color: "#f4c562" },
    { x: 400, y: 347, color: "#78d8e9" },
    { x: 531, y: 367, color: "#a985e6" },
    { x: 159, y: 312, color: "#e58fba" },
  ];
  for (const npc of npcs) drawPerson(context, npc.x - cameraX, npc.y - cameraY, "down", time / 330 + npc.x, npc.color, true);

  fillRect(context, "rgba(34,26,57,.22)", 0, 0, VIEW_WIDTH, 3);
  fillRect(context, "rgba(34,26,57,.22)", 0, VIEW_HEIGHT - 3, VIEW_WIDTH, 3);
}

function drawLobbyPreview() {
  lobbyContext.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  for (let y = 0; y < VIEW_HEIGHT; y += 16) {
    for (let x = 0; x < VIEW_WIDTH; x += 16) {
      const shade = ((x / 16) + (y / 16)) % 2 === 0 ? "#63547d" : "#5b4c75";
      fillRect(lobbyContext, shade, x, y, 16, 16);
      fillRect(lobbyContext, "#77658d", x, y + 15, 16, 1);
      fillRect(lobbyContext, "#77658d", x + 15, y, 1, 16);
    }
  }
  fillRect(lobbyContext, "#34304f", 0, 0, VIEW_WIDTH, 17);
  fillRect(lobbyContext, "#f6d477", 22, 10, 340, 2);
  fillRect(lobbyContext, "#29304e", 43, 39, 298, 117);
  fillRect(lobbyContext, "#cfa767", 46, 42, 292, 111);
  fillRect(lobbyContext, "#efd18b", 49, 45, 286, 105);
  drawSofa(lobbyContext, 72, 120);
  drawArcade(lobbyContext, 287, 95);
  drawVending(lobbyContext, 103, 77);
  drawPlant(lobbyContext, 242, 119);
  drawTable(lobbyContext, 165, 83);
  drawPerson(lobbyContext, 186, 137, "down", 0, "#f26d7c");
  drawPerson(lobbyContext, 208, 137, "down", 1, "#78d8e9", true);
  drawPerson(lobbyContext, 198, 105, "left", 2, "#f4c562", true);
  const title = "MALSSUNG LOBBY";
  lobbyContext.font = "bold 9px monospace";
  lobbyContext.fillStyle = "#fff3b2";
  lobbyContext.fillText(title, 131, 31);
}

function animate(now: number) {
  const dt = Math.min(.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (gameActive) {
    if (gameMode === "track") updateHazards(now, dt);
    else updatePracticeBots(now, dt);
    updatePlayer(dt, now);
    if (gameMode === "track") updateProgress(now);
    else updateProjectiles(now, dt);
    drawTown(gameContext, now);
    updateSkillBar(now);
  }
  requestAnimationFrame(animate);
}

function showToast(message: string) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("visible"), 1900);
}

function startGame() {
  const name = elements.name.value.trim().slice(0, 10) || "말썽꾸러기";
  gameMode = "track";
  player.name = name;
  player.x = 128;
  player.y = 552;
  player.direction = "right";
  player.walking = 0;
  player.knockbackX = 0;
  player.knockbackY = 0;
  player.hitUntil = 0;
  player.fallingUntil = 0;
  player.fallingStartedAt = 0;
  player.airUntil = 0;
  player.airStartedAt = 0;
  player.dashUntil = 0;
  player.dashVelocityX = 0;
  player.dashVelocityY = 0;
  runUntil = 0;
  testBots.length = 0;
  clones.length = 0;
  projectiles.length = 0;
  elements.skillBar.classList.add("hidden");
  elements.area.textContent = "말썽 운동장";
  elements.practice.textContent = "스킬 연습장 이동";
  lap = 0;
  checkpointIndex = 0;
  startArmed = false;
  activePitIndex = -1;
  pits.forEach((pit) => { pit.active = false; });
  nextPitAt = performance.now() + 1800;
  jumpPadCooldownUntil = 0;
  aim.visible = false;
  aim.pulseUntil = 0;
  elements.lap.textContent = "0 / 1 LAP";
  updateObjective();
  elements.playerName.textContent = name;
  elements.lobby.classList.add("hidden");
  elements.game.classList.remove("hidden");
  gameActive = true;
  elements.gameCanvas.focus();
  showToast(`${name}, 말썽 운동장 트랙에 입장!`);
}

function resetSkillPractice(now: number) {
  testBots.length = 0;
  clones.length = 0;
  projectiles.length = 0;
  const opponents = [
    { x: 354, y: 338, color: "#f4c562", name: "테스터 노랑" },
    { x: 544, y: 338, color: "#78d8e9", name: "테스터 파랑" },
    { x: 345, y: 445, color: "#a985e6", name: "테스터 보라" },
    { x: 555, y: 445, color: "#e58fba", name: "테스터 분홍" },
  ];
  opponents.forEach((opponent, index) => testBots.push({ ...opponent, id: index + 1, direction: "down", walking: index, moveX: 0, moveY: 0, nextTurnAt: now + index * 190, knockbackX: 0, knockbackY: 0, slowUntil: 0, sleepUntil: 0 }));
  (Object.keys(skillReadyAt) as SkillId[]).forEach((id) => { skillReadyAt[id] = 0; });
  dashCharges = 3;
  dashRechargeAt = 0;
  runUntil = 0;
  skillBarSignature = "";
}

function enterPractice() {
  gameMode = "practice";
  const now = performance.now();
  player.x = 448;
  player.y = 428;
  player.direction = "up";
  player.walking = 0;
  player.knockbackX = 0;
  player.knockbackY = 0;
  player.hitUntil = 0;
  player.fallingUntil = 0;
  player.airUntil = 0;
  player.dashUntil = 0;
  runUntil = 0;
  resetSkillPractice(now);
  elements.area.textContent = "스킬 연습장";
  elements.practice.textContent = "운동장으로 돌아가기";
  updateObjective();
  showToast("스킬 연습장 입장! 숫자 1~7 또는 R을 눌러 테스트하세요.");
}

function returnToTrack() {
  gameMode = "track";
  player.x = 128;
  player.y = 552;
  player.direction = "right";
  player.knockbackX = 0;
  player.knockbackY = 0;
  player.dashUntil = 0;
  player.hitUntil = 0;
  runUntil = 0;
  clones.length = 0;
  projectiles.length = 0;
  elements.skillBar.classList.add("hidden");
  elements.area.textContent = "말썽 운동장";
  elements.practice.textContent = "스킬 연습장 이동";
  updateObjective();
  showToast("운동장 트랙으로 돌아왔다.");
}

function togglePractice() {
  if (!gameActive) return;
  if (gameMode === "practice") returnToTrack();
  else enterPractice();
}

function returnToLobby() {
  gameActive = false;
  aim.visible = false;
  pressedKeys.clear();
  elements.skillBar.classList.add("hidden");
  elements.game.classList.add("hidden");
  elements.lobby.classList.remove("hidden");
}

elements.enter.addEventListener("click", startGame);
elements.name.addEventListener("keydown", (event) => { if (event.key === "Enter") startGame(); });
elements.back.addEventListener("click", returnToLobby);
elements.practice.addEventListener("click", togglePractice);

function updateAimFromPointer(event: PointerEvent) {
  const bounds = elements.gameCanvas.getBoundingClientRect();
  aim.screenX = Math.max(0, Math.min(VIEW_WIDTH, (event.clientX - bounds.left) * VIEW_WIDTH / bounds.width));
  aim.screenY = Math.max(0, Math.min(VIEW_HEIGHT, (event.clientY - bounds.top) * VIEW_HEIGHT / bounds.height));
  const camera = getCamera();
  aim.worldX = camera.x + aim.screenX;
  aim.worldY = camera.y + aim.screenY;
  aim.visible = true;
}

elements.gameCanvas.addEventListener("pointermove", (event) => {
  if (gameActive) updateAimFromPointer(event);
});
elements.gameCanvas.addEventListener("pointerdown", (event) => {
  if (!gameActive || event.button !== 0) return;
  event.preventDefault();
  updateAimFromPointer(event);
  aim.pulseX = aim.worldX;
  aim.pulseY = aim.worldY;
  aim.pulseUntil = performance.now() + 400;
  elements.gameCanvas.focus();
});
elements.gameCanvas.addEventListener("contextmenu", (event) => event.preventDefault());
window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (event.target instanceof HTMLInputElement) return;
  if (key === "escape" && gameActive) {
    returnToLobby();
    return;
  }
  const skillByKey: Record<string, SkillId | undefined> = { "1": "push", "2": "dash", "3": "run", "4": "grab", "5": "clone", "6": "slow", "7": "sleep" };
  if (gameActive && skillByKey[key]) {
    event.preventDefault();
    useSkill(skillByKey[key], performance.now());
    return;
  }
  if (gameActive && key === "r") {
    event.preventDefault();
    if (gameMode === "practice") useRandomSkill(performance.now());
    else showToast("랜덤 스킬은 연습장에서 테스트할 수 있다.");
    return;
  }
  if (["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
    event.preventDefault();
    pressedKeys.add(key);
  }
});
window.addEventListener("keyup", (event) => pressedKeys.delete(event.key.toLowerCase()));
window.addEventListener("blur", () => pressedKeys.clear());

drawLobbyPreview();
requestAnimationFrame(animate);
