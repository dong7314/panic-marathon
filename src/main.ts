import titleKeyArt from "./assets/title-keyart-pixel-v3.png";
import { io } from "socket.io-client";
import {
  CHECKPOINTS,
  CLONE_COOLDOWN,
  CLONE_DURATION,
  CLONE_LIMIT,
  DASH_RECHARGE_DURATION,
  FIRST_PIT_WARNING_DELAY,
  GRAB_HIT_RADIUS,
  GRAB_RANGE,
  JUMP_PADS,
  PIT_CYCLE_MIN_DELAY,
  PIT_CYCLE_RANDOM_DELAY,
  PIT_WARNING_DURATION,
  PIT_ZONES,
  PLAYER_BASE_SPEED,
  RESPAWN_POINTS,
  RUN_DURATION,
  RUN_SPEED_MULTIPLIER,
  SLOW_SPEED_MULTIPLIER,
  SPINNER_RULES,
  START_GATE,
  START_POINT,
  TRACK,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type SkillId,
} from "../shared/game-rules.mjs";
import { insideRect, isTrackPoint, pointSegmentDistance } from "../shared/geometry.mjs";
import type {
  AimState,
  Clone,
  Direction,
  GameMode,
  GrappleEffect,
  HazardEffect,
  LabelledRunner,
  NetworkClone,
  NetworkHazards,
  NetworkPlayer,
  NetworkResponse,
  NetworkRoom,
  Pit,
  Player,
  Projectile,
  PropKind,
  PushEffect,
  RemotePlayer,
  RoomConfig,
  SlowImpact,
  Spinner,
  TestBot,
  WorldProp,
} from "./game/types";
import "./style.css";

const VIEW_WIDTH = 384;
const VIEW_HEIGHT = 216;
const TILE = 16;

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("앱을 찾을 수 없어요.");

app.innerHTML = `
  <div class="pixel-shell">
    <main id="title-screen" class="title-screen" aria-labelledby="title-logo">
      <div class="title-stage">
        <img id="title-keyart" class="title-keyart" src="${titleKeyArt}" alt="총을 든 러너와 복제 러너들이 운동장을 질주하는 픽셀 키비주얼" />
        <canvas id="title-canvas" width="384" height="216" aria-hidden="true"></canvas>
        <div class="scanlines" aria-hidden="true"></div>
        <div class="title-logo">
          <h1 id="title-logo" aria-label="패닉 마라톤"><span class="title-word title-word-panic"><i style="--wave-delay: 0">패</i><i style="--wave-delay: 1">닉</i></span><span class="title-word title-word-marathon"><i style="--wave-delay: 2">마</i><i style="--wave-delay: 3">라</i><i style="--wave-delay: 4">톤</i></span></h1>
          <b>달리고 · 쏘고 · 서로 끌어내려라</b>
        </div>
        <div class="title-actions" aria-label="게임 시작 메뉴">
          <button id="open-join" class="title-action primary"><span>01</span> 방 참여하기</button>
          <button id="open-create" class="title-action"><span>02</span> 방 생성하기</button>
        </div>
        <section id="title-room-panel" class="title-room-panel hidden" aria-label="방 설정">
          <div class="title-panel-heading"><span id="title-panel-marker">ROOM MENU</span><b id="title-panel-title">방 참여하기</b></div>
          <div class="title-name-field">
            <label for="title-runner-name">러너 이름</label>
            <input id="title-runner-name" maxlength="10" value="말썽꾸러기" autocomplete="nickname" />
          </div>
          <div class="title-join-fields">
            <label for="title-room-code">방 번호</label>
            <input id="title-room-code" maxlength="12" placeholder="예: PM-7F2A" autocomplete="off" />
            <p>초대 받은 방 번호를 입력하세요. <b>test</b>는 멀티 테스트, <b>test-skill</b>은 스킬 연습장입니다.</p>
          </div>
          <div class="title-create-fields">
            <div class="title-config-grid"><label for="title-lap-count">목표 랩 <input id="title-lap-count" type="number" min="1" max="999" step="1" value="5" /></label><label for="title-player-count">인원 <input id="title-player-count" type="number" min="2" max="6" step="1" value="4" /></label></div>
            <label for="title-invite-code">초대 코드</label>
            <input id="title-invite-code" maxlength="12" value="PM-7F2A" autocomplete="off" />
            <span class="title-skill-label">사용 스킬 <b>최소 3개</b></span>
            <div id="title-skill-pool" class="title-skill-options">
              <label><input type="checkbox" value="push" checked /> 밀치기</label><label><input type="checkbox" value="dash" checked /> 돌진</label><label><input type="checkbox" value="run" checked /> 질주</label><label><input type="checkbox" value="grab" checked /> 그랩</label><label><input type="checkbox" value="clone" checked /> 분신</label><label><input type="checkbox" value="slow" checked /> 슬로우탄</label><label><input type="checkbox" value="sleep" checked /> 수면총</label>
            </div>
          </div>
          <div class="title-panel-actions"><button id="title-confirm-room" class="title-panel-confirm" type="button">방 참여</button><button id="title-panel-back" class="title-panel-back" type="button">뒤로</button></div>
        </section>
        <div class="title-caption">2–6 PLAYERS · RANDOM SKILLS · TOTAL MAYHEM</div>
      </div>
    </main>

    <main id="game-screen" class="game-screen hidden">
      <div class="game-stage">
        <div id="game-frame" class="game-frame">
          <canvas id="game-canvas" width="384" height="216" tabindex="0" aria-label="탑다운 픽셀 운동장"></canvas>
          <div id="world-label-layer" class="world-label-layer" aria-hidden="true">
            <span id="player-skill-label" class="world-label player-skill-label hidden"></span>
          </div>
          <div class="scanlines" aria-hidden="true"></div>
          <button id="fullscreen-button" class="frame-button" type="button">전체 화면</button>
          <div id="race-board" class="race-board" aria-label="레이스 현황"></div>
          <div class="game-hud">
            <div class="hud-box middle"><span>LAP</span><strong id="lap-value">0 / 1 LAP</strong></div>
            <div class="hud-box right"><span>OBJECTIVE</span><strong id="objective-value">CHECKPOINT 1</strong></div>
          </div>
          <div class="message-box"><span class="key">WASD</span> 이동 · <span class="key">L-CLICK</span> 총 · <span class="key">R-CLICK</span> 현재 스킬 · 체크포인트에서 탄창과 스킬을 갱신합니다.</div>
          <div id="skill-bar" class="skill-bar" aria-label="스킬 단축키"></div>
          <aside class="side-panel">
            <div class="pixel-panel">
              <div class="eyebrow">PLAYER</div>
              <div id="player-name-tag" class="player-name-tag">말썽꾸러기</div>
              <p>라이프 5칸과 총알 3발로 달립니다. 구덩이 또는 체크포인트 복귀 시 탄창이 회복되고, 체크포인트마다 스킬도 바뀝니다.</p>
            </div>
            <div class="pixel-panel controls-panel"><span>MOVE</span><b>W A S D</b><span>GUN</span><b>L-CLICK</b><span>SKILL</span><b>R-CLICK</b><span>MENU</span><b>ESC</b></div>
            <button id="practice-button" class="ghost-button">스킬 연습장 이동</button>
            <button id="back-to-lobby" class="ghost-button">메인 화면으로 돌아가기</button>
          </aside>
          <section id="match-results" class="match-results hidden" role="dialog" aria-modal="true" aria-labelledby="result-title">
            <div class="result-card">
              <span class="result-marker">RACE COMPLETE</span>
              <h2 id="result-title">경기 종료</h2>
              <p id="result-summary" class="result-summary"></p>
              <ol id="result-standings" class="result-standings" aria-label="최종 순위"></ol>
              <div class="result-actions">
                <button id="result-rematch" class="result-primary" type="button">같은 방에서 재대결</button>
                <button id="result-to-title" class="result-secondary" type="button">메인 화면으로</button>
              </div>
              <p id="result-status" class="result-status"></p>
            </div>
          </section>
        </div>
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
  title: getElement<HTMLElement>("#title-screen"),
  game: getElement<HTMLElement>("#game-screen"),
  titleKeyArt: getElement<HTMLImageElement>("#title-keyart"),
  titleCanvas: getElement<HTMLCanvasElement>("#title-canvas"),
  openJoin: getElement<HTMLButtonElement>("#open-join"),
  openCreate: getElement<HTMLButtonElement>("#open-create"),
  titleStage: getElement<HTMLElement>(".title-stage"),
  titleRoomPanel: getElement<HTMLElement>("#title-room-panel"),
  titlePanelMarker: getElement<HTMLElement>("#title-panel-marker"),
  titlePanelTitle: getElement<HTMLElement>("#title-panel-title"),
  titleRoomCode: getElement<HTMLInputElement>("#title-room-code"),
  titleRunnerName: getElement<HTMLInputElement>("#title-runner-name"),
  titleLapCount: getElement<HTMLInputElement>("#title-lap-count"),
  titlePlayerCount: getElement<HTMLInputElement>("#title-player-count"),
  titleInviteCode: getElement<HTMLInputElement>("#title-invite-code"),
  titleSkillPool: getElement<HTMLElement>("#title-skill-pool"),
  titleConfirm: getElement<HTMLButtonElement>("#title-confirm-room"),
  titlePanelBack: getElement<HTMLButtonElement>("#title-panel-back"),
  back: getElement<HTMLButtonElement>("#back-to-lobby"),
  gameCanvas: getElement<HTMLCanvasElement>("#game-canvas"),
  gameFrame: getElement<HTMLElement>("#game-frame"),
  worldLabelLayer: getElement<HTMLElement>("#world-label-layer"),
  playerSkillLabel: getElement<HTMLElement>("#player-skill-label"),
  fullscreen: getElement<HTMLButtonElement>("#fullscreen-button"),
  playerName: getElement<HTMLElement>("#player-name-tag"),
  raceBoard: getElement<HTMLElement>("#race-board"),
  lap: getElement<HTMLElement>("#lap-value"),
  objective: getElement<HTMLElement>("#objective-value"),
  skillBar: getElement<HTMLElement>("#skill-bar"),
  practice: getElement<HTMLButtonElement>("#practice-button"),
  results: getElement<HTMLElement>("#match-results"),
  resultTitle: getElement<HTMLElement>("#result-title"),
  resultSummary: getElement<HTMLElement>("#result-summary"),
  resultStandings: getElement<HTMLOListElement>("#result-standings"),
  resultRematch: getElement<HTMLButtonElement>("#result-rematch"),
  resultToTitle: getElement<HTMLButtonElement>("#result-to-title"),
  resultStatus: getElement<HTMLElement>("#result-status"),
  toast: getElement<HTMLElement>("#toast"),
};

function getPixelContext(canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("픽셀 캔버스를 준비하지 못했어요.");
  return context;
}

const titleContext = getPixelContext(elements.titleCanvas);
const gameContext = getPixelContext(elements.gameCanvas);
titleContext.imageSmoothingEnabled = false;
gameContext.imageSmoothingEnabled = false;

// 기존 트랙보다 직선 구간을 50% 늘려, 한 바퀴 주행 거리를 약 1.5배로 확장한다.
const props: WorldProp[] = [
  { kind: "bench", x: -10, y: 103, width: 39, height: 16, solid: true },
  { kind: "vending", x: 2, y: 157, width: 28, height: 36, solid: true },
  { kind: "plant", x: 4, y: 280, width: 20, height: 24, solid: true },
  { kind: "arcade", x: 1, y: 386, width: 27, height: 37, solid: true },
  { kind: "table", x: 294, y: 274, width: 42, height: 28, solid: true },
  { kind: "sofa", x: 426, y: 273, width: 47, height: 25, solid: true },
  { kind: "plant", x: 360, y: 220, width: 20, height: 24, solid: true },
  { kind: "mailbox", x: 1286, y: 111, width: 23, height: 30, solid: true },
  { kind: "vending", x: 1282, y: 318, width: 28, height: 36, solid: true },
  { kind: "bench", x: 1286, y: 544, width: 39, height: 16, solid: true },
  { kind: "plant", x: 1288, y: 846, width: 20, height: 24, solid: true },
  { kind: "lamp", x: 144, y: 2, width: 16, height: 30 },
  { kind: "lamp", x: 660, y: 2, width: 16, height: 30 },
  { kind: "lamp", x: 144, y: 944, width: 16, height: 30 },
  { kind: "lamp", x: 1068, y: 944, width: 16, height: 30 },
];
const spinners: Spinner[] = SPINNER_RULES.map((spinner) => ({ ...spinner, angle: 0 }));
const pits: Pit[] = PIT_ZONES.map((pit) => ({ ...pit, active: false }));
const jumpPads = JUMP_PADS;
const checkpoints = CHECKPOINTS;
const player: Player = { x: START_POINT.x, y: START_POINT.y, direction: "right", walking: 0, name: "말썽꾸러기", color: "#f16c7a", knockbackX: 0, knockbackY: 0, hitUntil: 0, fallingUntil: 0, fallingStartedAt: 0, fallTargetX: 0, fallTargetY: 0, airUntil: 0, airStartedAt: 0, dashUntil: 0, dashVelocityX: 0, dashVelocityY: 0, health: 5, ammo: 3, shotReadyAt: 0 };
const PRACTICE_ARENA = { left: 180, top: 136, right: 716, bottom: 536 };
const testBots: TestBot[] = [];
const LOCAL_GRAPPLE_ID = "local-player";
type BotWorldLabelGroup = { container: HTMLDivElement; name: HTMLSpanElement; skill: HTMLSpanElement };
const botWorldLabels = new Map<string | number, BotWorldLabelGroup>();
const remotePlayers = new Map<string, RemotePlayer>();
const multiplayerEndpoint = import.meta.env.VITE_MULTIPLAYER_URL ?? `${window.location.protocol}//${window.location.hostname}:5175`;
const socket = io(multiplayerEndpoint, { autoConnect: false });
let activeNetworkRoom: NetworkRoom | undefined;
let activeNetworkRound = 0;
let multiplayerActive = false;
let lastNetworkStateAt = 0;
let networkSleepUntil = 0;
let networkSlowUntil = 0;
let grappleLockUntil = 0;
let pushLockUntil = 0;
let networkSpinnerElapsedAtSync = 0;
let networkSpinnerSyncedAt = 0;
const clones: Clone[] = [];
const projectiles: Projectile[] = [];
const grappleEffects: GrappleEffect[] = [];
const pushEffects: PushEffect[] = [];
const slowImpacts: SlowImpact[] = [];
const skillReadyAt: Record<SkillId, number> = { push: 0, dash: 0, run: 0, grab: 0, clone: 0, slow: 0, sleep: 0 };
const skillLabels: Record<SkillId, string> = { push: "밀치기", dash: "돌진", run: "질주", grab: "그랩", clone: "분신", slow: "슬로우탄", sleep: "수면총" };
let dashCharges = 3;
let dashRechargeAt = 0;
let runUntil = 0;
let gameMode: GameMode = "track";
let skillTestRoomActive = false;
let roomConfig: RoomConfig = { lapLimit: 5, playerCount: 4, enabledSkills: ["push", "dash", "run", "grab", "clone", "slow", "sleep"] };
let equippedSkill: SkillId = "push";
let matchFinished = false;
const pressedKeys = new Set<string>();

function getControlKey(event: KeyboardEvent) {
  const physicalKeys: Record<string, string> = {
    KeyW: "w",
    KeyA: "a",
    KeyS: "s",
    KeyD: "d",
    KeyR: "r",
  };
  return physicalKeys[event.code] ?? event.key.toLowerCase();
}

let gameActive = false;
let lastFrame = performance.now();
let titleAnimationStartedAt = performance.now();
let titleFallbackActive = false;
let toastTimer: number | undefined;
let checkpointIndex = 0;
let lap = 0;
let activePitIndex = -1;
let warningPitIndex = -1;
let pitOpenAt = 0;
let pitOpenedAlertIndex = -1;
let pitOpenedAlertUntil = 0;
let nextPitAt = 0;
let jumpPadCooldownUntil = 0;
let startArmed = false;
const aim: AimState = { screenX: VIEW_WIDTH / 2, screenY: VIEW_HEIGHT / 2, worldX: 0, worldY: 0, visible: false, pulseUntil: 0, pulseX: 0, pulseY: 0 };
let skillBarSignature = "";
let raceBoardSignature = "";

function noise(x: number, y: number) {
  const value = Math.sin(x * 87.3 + y * 41.7) * 1031.77;
  return value - Math.floor(value);
}

function fillRect(context: CanvasRenderingContext2D, color: string, x: number, y: number, width: number, height: number) {
  context.fillStyle = color;
  context.fillRect(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
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
    line("#f8dab1", x, 863, 11, 3);
  }
  for (let y = TRACK.innerTop + 10; y < TRACK.innerBottom - 8; y += 22) {
    line("#f8dab1", 119, y, 3, 11);
    line("#f8dab1", 1191, y, 3, 11);
  }

  for (let row = 0; row < 7; row += 1) {
    line(row % 2 ? "#fff0d1" : "#40344f", 160, 826 + row * 11, 10, 11);
    line(row % 2 ? "#40344f" : "#fff0d1", 170, 826 + row * 11, 10, 11);
  }
  line("#dbb75d", 606, 488, 132, 3);
  line("#dbb75d", 670, 424, 3, 132);
  line("#7ccc73", 611, 493, 122, 54);
  for (let index = 0; index < 10; index += 1) {
    const z = index * 92 + 40;
    line("#f6d477", 26, z, 5, 5);
    line("#f6d477", 1286, z + 19, 5, 5);
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
  const shake = pit.warning ? (Math.floor(time / 55) % 2 === 0 ? -1 : 1) : 0;
  const x = pit.x - cameraX + shake;
  const y = pit.y - cameraY;
  fillRect(context, "#9e4c59", x - 2, y - 2, pit.width + 4, pit.height + 4);
  if (!pit.active) {
    fillRect(context, "#7f5665", x, y, pit.width, pit.height);
    for (let index = 4; index < pit.width; index += 8) fillRect(context, "#b37a77", x + index, y + 2, 2, pit.height - 4);
    fillRect(context, "#f0b26e", x + 2, y + 2, pit.width - 4, 2);
    if (pit.warning) {
      const warningColor = Math.floor(time / 110) % 2 === 0 ? "#fff0a7" : "#ef6f68";
      fillRect(context, warningColor, x + 3, y + 5, pit.width - 6, 2);
      fillRect(context, warningColor, x + 3, y + pit.height - 7, pit.width - 6, 2);
    }
    return;
  }
  fillRect(context, "#392d4a", x, y, pit.width, pit.height);
  fillRect(context, "#17182e", x + 3, y + 4, pit.width - 6, pit.height - 7);
  fillRect(context, "#5b3f5b", x + 5, y + 5, pit.width - 10, 3);
  const spark = Math.floor(time / 120) % 3;
  fillRect(context, "#ec7769", x + 4 + spark * 6, y + pit.height - 7, 3, 2);
  fillRect(context, "#f4c562", x + pit.width - 8, y + 8 + spark * 4, 2, 3);
}

function drawPitAlert(context: CanvasRenderingContext2D, cameraX: number, cameraY: number, time: number) {
  const pitIndex = warningPitIndex >= 0 ? warningPitIndex : time < pitOpenedAlertUntil ? pitOpenedAlertIndex : -1;
  const pit = pits[pitIndex];
  if (!pit) return;
  const rawX = pit.x + pit.width / 2 - cameraX;
  const rawY = pit.y + pit.height / 2 - cameraY;
  const markerX = Math.max(12, Math.min(VIEW_WIDTH - 96, rawX));
  const markerY = Math.max(14, Math.min(VIEW_HEIGHT - 14, rawY - 24));
  const warning = warningPitIndex >= 0;
  const color = warning ? "#fff0a7" : "#ff6f68";
  fillRect(context, "#25233f", markerX - 8, markerY - 8, 17, 17);
  fillRect(context, color, markerX - 6, markerY - 6, 13, 13);
  fillRect(context, "#25233f", markerX - 4, markerY - 4, 9, 9);
  context.fillStyle = color;
  context.font = "bold 8px monospace";
  context.textAlign = "center";
  context.fillText("!", Math.round(markerX + 1), Math.round(markerY + 3));
  context.textAlign = "start";
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

function drawHealthPips(context: CanvasRenderingContext2D, left: number, y: number, health: number) {
  for (let index = 0; index < 5; index += 1) {
    const pipX = left + index * 5;
    fillRect(context, "#211b35", pipX, y, 4, 4);
    fillRect(context, index < health ? "#ef5868" : "#5a526b", pipX + 1, y + 1, 2, 2);
  }
}

function drawAmmoPips(context: CanvasRenderingContext2D, left: number, y: number, ammo: number) {
  for (let index = 0; index < 3; index += 1) {
    const pipX = left + index * 6;
    fillRect(context, "#211b35", pipX + 1, y, 2, 1);
    fillRect(context, "#211b35", pipX, y + 1, 4, 5);
    if (index < ammo) {
      fillRect(context, "#f1b84f", pipX + 1, y + 1, 2, 4);
      fillRect(context, "#fff1a6", pipX + 1, y + 1, 1, 3);
    } else {
      fillRect(context, "#5a526b", pipX + 1, y + 1, 2, 4);
    }
  }
}

function placeWorldLabel(element: HTMLElement, x: number, y: number) {
  element.style.left = `${(x / VIEW_WIDTH) * 100}%`;
  element.style.top = `${(y / VIEW_HEIGHT) * 100}%`;
  element.classList.remove("hidden");
}

type SkillLabelStatus = { cooldownUntil?: number; cloneCount?: number; dashCharges?: number; dashRechargeUntil?: number };
type SkillLabelDisplay = { text: string; charging: boolean };

function formatSkillLabel(skill: SkillId, status: SkillLabelStatus, now: number): SkillLabelDisplay {
  const name = skillLabels[skill].slice(0, 5);
  const cooldown = Math.max(0, (status.cooldownUntil ?? 0) - now);
  const seconds = Math.max(1, Math.ceil(cooldown / 1000));
  if (skill === "clone") return { text: `${name} ${status.cloneCount ?? 0}/${CLONE_LIMIT}${cooldown > 0 ? ` ${seconds}s` : ""}`, charging: cooldown > 0 };
  if (skill === "dash" && status.dashCharges !== undefined) {
    if (status.dashCharges > 0 || (status.dashRechargeUntil ?? 0) <= now) return { text: `${name} ${status.dashCharges || 3}/3`, charging: false };
    const remaining = Math.max(0, (status.dashRechargeUntil ?? now) - now);
    return { text: `${name} 0/3 ${Math.max(1, Math.ceil(remaining / 1000))}s`, charging: true };
  }
  if (cooldown <= 0) return { text: name, charging: false };
  return { text: `${name} ${seconds}s`, charging: true };
}

function renderSkillLabel(element: HTMLElement, skill: SkillId, status: SkillLabelStatus, now: number) {
  const display = formatSkillLabel(skill, status, now);
  if (element.textContent !== display.text) element.textContent = display.text;
  element.classList.toggle("is-cooling", display.charging);
}

function updatePlayerSkillLabel(left: number, y: number) {
  const now = performance.now();
  renderSkillLabel(elements.playerSkillLabel, equippedSkill, {
    cooldownUntil: skillReadyAt[equippedSkill],
    cloneCount: getOwnedCloneCount(),
    dashCharges,
    dashRechargeUntil: dashRechargeAt,
  }, now);
  placeWorldLabel(elements.playerSkillLabel, left, y);
}

function updateRunnerLabels(runner: LabelledRunner, left: number, y: number) {
  let labels = botWorldLabels.get(runner.id);
  if (!labels) {
    const container = document.createElement("div");
    const name = document.createElement("span");
    const skill = document.createElement("span");
    container.className = "world-label-stack";
    name.className = "world-label bot-name-label";
    skill.className = "world-label bot-skill-label";
    container.append(name, skill);
    elements.worldLabelLayer.append(container);
    labels = { container, name, skill };
    botWorldLabels.set(runner.id, labels);
  }
  labels.name.textContent = runner.name;
  const status = "skillCooldownUntil" in runner
    ? { cooldownUntil: runner.skillCooldownUntil, cloneCount: multiplayerActive ? clones.filter((clone) => clone.ownerId === runner.id).length : runner.cloneCount, dashCharges: runner.dashCharges, dashRechargeUntil: runner.dashRechargeUntil }
    : {};
  renderSkillLabel(labels.skill, runner.skill, status, performance.now());
  placeWorldLabel(labels.container, left, y);
}

function resetWorldLabels() {
  elements.playerSkillLabel.classList.add("hidden");
  for (const labels of botWorldLabels.values()) labels.container.remove();
  botWorldLabels.clear();
}

function getOwnedCloneCount() {
  return multiplayerActive ? clones.filter((clone) => clone.ownerId === socket.id).length : clones.length;
}

function getGrappledPosition(id: string | number | undefined, fallbackX: number, fallbackY: number, now: number) {
  const effect = grappleEffects.find((candidate) => candidate.targetId !== undefined && candidate.targetId === id && candidate.until > now);
  if (!effect || effect.targetStartX === undefined || effect.targetStartY === undefined || effect.targetEndX === undefined || effect.targetEndY === undefined) return { x: fallbackX, y: fallbackY };
  const progress = Math.max(0, Math.min(1, (now - effect.startedAt) / 520));
  if (progress < .36) return { x: effect.targetStartX, y: effect.targetStartY };
  const pull = (progress - .36) / .64;
  const eased = 1 - Math.pow(1 - pull, 2);
  return {
    x: effect.targetStartX + (effect.targetEndX - effect.targetStartX) * eased,
    y: effect.targetStartY + (effect.targetEndY - effect.targetStartY) * eased,
  };
}

function getPushedPosition(id: string | number | undefined, fallbackX: number, fallbackY: number, now: number) {
  for (let index = pushEffects.length - 1; index >= 0; index -= 1) {
    const effect = pushEffects[index];
    if (effect.until <= now) {
      pushEffects.splice(index, 1);
      continue;
    }
    if (effect.targetId !== id) continue;
    const progress = Math.max(0, Math.min(1, (now - effect.startedAt) / effect.duration));
    const eased = 1 - Math.pow(1 - progress, 3);
    return {
      x: effect.startX + (effect.endX - effect.startX) * eased,
      y: effect.startY + (effect.endY - effect.startY) * eased,
    };
  }
  return { x: fallbackX, y: fallbackY };
}

function drawSlowStatus(context: CanvasRenderingContext2D, x: number, y: number, time: number, until: number) {
  if (until <= time) return;
  const pulse = Math.floor(time / 110) % 2;
  const wide = pulse ? 11 : 9;
  fillRect(context, "rgba(32,49,86,.72)", x - wide, y + 10, wide * 2 + 1, 4);
  fillRect(context, "#75ddeb", x - wide, y + 11, wide * 2 + 1, 2);
  fillRect(context, "#dffff2", x - 7, y + 12, 3, 1);
  fillRect(context, "#75ddeb", x - 10, y - 5 + pulse, 3, 3);
  fillRect(context, "#dffff2", x + 8, y - 2 - pulse, 2, 3);
  fillRect(context, "#75ddeb", x + 7, y + 4 + pulse, 3, 3);
}

function drawSleepStatus(context: CanvasRenderingContext2D, x: number, y: number, time: number, until: number) {
  if (until <= time) return;
  context.fillStyle = "#e5b8f4";
  context.font = "bold 8px monospace";
  context.fillText("Z", Math.round(x + 7), Math.round(y - 10));
}

function drawPlayer(context: CanvasRenderingContext2D, cameraX: number, cameraY: number, time: number) {
  const playerId = multiplayerActive ? socket.id : LOCAL_GRAPPLE_ID;
  const grappledPosition = getGrappledPosition(playerId, player.x, player.y, time);
  const position = getPushedPosition(playerId, grappledPosition.x, grappledPosition.y, time);
  const baseX = position.x - cameraX;
  const baseY = position.y - cameraY;
  if (player.fallingUntil > time) {
    elements.playerSkillLabel.classList.add("hidden");
    const progress = Math.max(0, Math.min(1, (time - player.fallingStartedAt) / 520));
    const drawX = baseX + (player.fallTargetX - player.x) * progress;
    const drawY = baseY + (player.fallTargetY - player.y) * progress;
    const scale = Math.max(.16, 1 - progress * .84);
    context.save();
    context.translate(Math.round(drawX), Math.round(drawY));
    context.scale(scale, scale);
    drawPerson(context, 0, 0, player.direction, player.walking, player.color);
    context.restore();
    return;
  }

  const airProgress = player.airUntil > time ? Math.max(0, Math.min(1, (time - player.airStartedAt) / 560)) : 0;
  const lift = airProgress > 0 ? Math.sin(airProgress * Math.PI) * 18 : 0;
  const drawY = baseY - lift;
  if (lift > 0) fillRect(context, "rgba(38,31,54,.3)", baseX - 8, baseY + 10, 16, 3);
  drawPerson(context, baseX, drawY, player.direction, player.walking, player.color);
  drawSlowStatus(context, baseX, drawY, time, networkSlowUntil);
  drawSleepStatus(context, baseX, drawY, time, networkSleepUntil);
  const statusLeft = Math.round(baseX - 12);
  drawHealthPips(context, statusLeft, drawY - 14, player.health);
  drawAmmoPips(context, statusLeft, drawY - 21, player.ammo);
  updatePlayerSkillLabel(statusLeft, drawY - 21);
}

function drawTitleCloud(context: CanvasRenderingContext2D, x: number, y: number) {
  fillRect(context, "#d7f4e6", x, y + 5, 32, 5);
  fillRect(context, "#d7f4e6", x + 6, y + 1, 19, 9);
  fillRect(context, "#fffbed", x + 11, y - 3, 9, 6);
  fillRect(context, "#b4dfdb", x + 3, y + 10, 28, 2);
}

function drawTitleCloneGate(context: CanvasRenderingContext2D, time: number) {
  const x = 324;
  const y = 22;
  const flash = Math.floor(time / 130) % 2;
  fillRect(context, "#283550", x - 3, y + 7, 48, 55);
  fillRect(context, "#536784", x, y + 9, 42, 49);
  fillRect(context, "#f5e8c7", x + 3, y, 35, 10);
  fillRect(context, "#243047", x + 8, y + 3, 25, 3);
  fillRect(context, "#f4c65c", x + 3, y + 14, 4, 4);
  fillRect(context, "#ef7078", x + 34, y + 14, 4, 4);
  fillRect(context, "#202d47", x + 6, y + 23, 29, 31);
  fillRect(context, flash ? "#90eff0" : "#57c8ea", x + 9, y + 26, 23, 25);
  fillRect(context, "#ecffe4", x + 12, y + 27, 4, 18);
  fillRect(context, "#ecffe4", x + 23, y + 32, 5, 16);
  fillRect(context, "#ecffe4", x + 16, y + 37, 10, 4);
  fillRect(context, "#2c3851", x + 42, y + 27, 7, 30);
  fillRect(context, "#f4c65c", x + 44, y + 34, 3, 4);
  fillRect(context, "#ef7078", x + 44, y + 45, 3, 4);
}

type TitleRunnerKind = "captain" | "grappler" | "sleeper" | "dasher" | "clone";

function drawTitleRunner(context: CanvasRenderingContext2D, x: number, y: number, scale: number, phase: number, kind: TitleRunnerKind, alpha = 1) {
  const bounce = Math.abs(Math.sin(phase)) > .56 ? 1 : 0;
  const strideForward = Math.sin(phase) > 0;
  const leftStep = strideForward ? 3 : 0;
  const rightStep = strideForward ? 0 : 3;
  const armSwing = strideForward ? 3 : -1;
  const palette = {
    captain: { suit: "#ef6e75", trim: "#ffd160", hair: "#463650", accent: "#f8a06f" },
    grappler: { suit: "#6aac70", trim: "#c6ef89", hair: "#2f4a45", accent: "#f2d5bf" },
    sleeper: { suit: "#9a7bd3", trim: "#efc5ff", hair: "#4a385f", accent: "#efc3dc" },
    dasher: { suit: "#4b96cd", trim: "#a8e9f1", hair: "#303d62", accent: "#f2d5bf" },
    clone: { suit: "#8b72cc", trim: "#d7c7ff", hair: "#4b3d66", accent: "#dfc6ea" },
  }[kind];
  context.save();
  context.globalAlpha = alpha;
  context.translate(Math.round(x), Math.round(y));
  context.scale(scale, scale);
  fillRect(context, "rgba(31,38,61,.3)", -8, 15, 17, 3);
  fillRect(context, "#273047", -7, 10 + leftStep, 5, 7);
  fillRect(context, "#273047", 3, 10 + rightStep, 5, 7);
  fillRect(context, "#f7f0d6", -8, 16 + leftStep, 7, 2);
  fillRect(context, "#f7f0d6", 3, 16 + rightStep, 7, 2);
  fillRect(context, "#273047", -7, -2 + bounce, 15, 15);
  fillRect(context, "#273047", -9, 1 + bounce, 19, 8);
  fillRect(context, palette.suit, -6, -1 + bounce, 13, 13);
  fillRect(context, palette.suit, -8, 2 + bounce, 17, 6);
  fillRect(context, palette.trim, -5, 4 + bounce, 11, 2);
  fillRect(context, "#ffffff", -1, 0 + bounce, 3, 10);
  fillRect(context, palette.trim, -6, 10 + bounce, 13, 2);
  fillRect(context, "#273047", -12, 2 + bounce + armSwing, 4, 8);
  fillRect(context, "#273047", 9, 2 + bounce - armSwing, 4, 8);
  fillRect(context, palette.suit, -11, 3 + bounce + armSwing, 3, 6);
  fillRect(context, palette.suit, 9, 3 + bounce - armSwing, 3, 6);
  fillRect(context, "#f2d5bf", -12, 8 + bounce + armSwing, 4, 3);
  fillRect(context, "#f2d5bf", 9, 8 + bounce - armSwing, 4, 3);
  fillRect(context, "#273047", -5, -17 + bounce, 11, 3);
  fillRect(context, "#273047", -7, -14 + bounce, 15, 14);
  fillRect(context, palette.accent, -5, -13 + bounce, 11, 12);
  fillRect(context, palette.accent, -6, -10 + bounce, 13, 8);
  fillRect(context, palette.hair, -5, -17 + bounce, 11, 4);
  fillRect(context, palette.hair, -7, -14 + bounce, 15, 3);
  fillRect(context, "#273047", -4, -8 + bounce, 3, 4);
  fillRect(context, "#ffffff", -3, -8 + bounce, 1, 1);
  fillRect(context, "#273047", 3, -8 + bounce, 3, 4);
  fillRect(context, "#ffffff", 4, -8 + bounce, 1, 1);
  fillRect(context, "#273047", -2, -2 + bounce, 5, 3);
  fillRect(context, "#ef7279", -1, -2 + bounce, 3, 1);
  if (kind === "captain") {
    fillRect(context, "#ffd160", -9, -14 + bounce, 19, 3);
    fillRect(context, "#ef6e75", 7, -17 + bounce, 6, 4);
    fillRect(context, "#273047", 10, -1 + bounce - armSwing, 12, 5);
    fillRect(context, "#9cb6c2", 12, bounce - armSwing, 9, 2);
    fillRect(context, "#f7d86f", 22, 1 + bounce - armSwing, 4, 2);
  }
  if (kind === "grappler") {
    fillRect(context, "#c6ef89", -8, -15 + bounce, 17, 3);
    fillRect(context, "#607b86", 10, 1 + bounce - armSwing, 8, 7);
    fillRect(context, "#ef6e75", 17, bounce - armSwing, 6, 9);
    fillRect(context, "#f2d5bf", 22, 1 + bounce - armSwing, 6, 7);
  }
  if (kind === "sleeper") {
    fillRect(context, "#efc5ff", -7, -13 + bounce, 15, 2);
    fillRect(context, "#39455d", -16, 4 + bounce + armSwing, 8, 5);
    fillRect(context, "#d899e8", -19, 5 + bounce + armSwing, 4, 3);
    fillRect(context, "#fff1a9", -21, 6 + bounce + armSwing, 2, 1);
  }
  if (kind === "dasher") {
    fillRect(context, "#a8e9f1", -8, -15 + bounce, 17, 3);
    fillRect(context, "#f3d66e", -10, -17 + bounce, 5, 3);
    fillRect(context, "#f3d66e", 7, -17 + bounce, 5, 3);
  }
  if (kind === "clone") {
    fillRect(context, "#d7c7ff", -6, -14 + bounce, 12, 2);
    fillRect(context, "#e5d7ff", -4, -7 + bounce, 3, 2);
    fillRect(context, "#e5d7ff", 3, -7 + bounce, 3, 2);
  }
  context.restore();
}

function drawTitlePreview(time: number) {
  const elapsed = time - titleAnimationStartedAt;
  const beat = elapsed / 1000;
  const walk = beat * 10;
  const fireLoop = (elapsed % 980) / 980;
  titleContext.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  fillRect(titleContext, "#69c9df", 0, 0, VIEW_WIDTH, 92);
  fillRect(titleContext, "#4b9b64", 0, 78, VIEW_WIDTH, 138);
  drawTitleCloud(titleContext, 42, 18);
  drawTitleCloud(titleContext, 176, 9);
  drawTitleCloud(titleContext, 260, 35);
  for (let index = 0; index < 18; index += 1) {
    const sparkleX = (index * 31) % VIEW_WIDTH;
    const sparkleY = 7 + (index * 19) % 82;
    fillRect(titleContext, index % 3 === 0 ? "#fff0a7" : "#d9fbf1", sparkleX, sparkleY, 2, 2);
  }

  fillRect(titleContext, "#566b7e", 75, 42, 211, 45);
  for (let row = 0; row < 5; row += 1) {
    fillRect(titleContext, row % 2 ? "#92a3aa" : "#bbc6bd", 77, 45 + row * 8, 204 - row * 7, 4);
    for (let seat = 0; seat < 14 - row; seat += 1) {
      const seatX = 84 + seat * 13 + row * 3;
      fillRect(titleContext, seat % 3 === 0 ? "#ef737b" : seat % 3 === 1 ? "#f3d06d" : "#5e9fcb", seatX, 48 + row * 8, 4, 3);
    }
  }
  for (let y = 90; y < VIEW_HEIGHT; y += 11) fillRect(titleContext, y % 22 ? "#63ac67" : "#75ba70", 0, y, VIEW_WIDTH, 2);

  for (let y = 82; y < VIEW_HEIGHT; y += 1) {
    const progress = (y - 82) / 134;
    const left = Math.round(168 - progress * 220);
    const width = Math.round(114 + progress * 336);
    fillRect(titleContext, "#dd695d", left, y, width, 1);
    for (let lane = 1; lane < 4; lane += 1) {
      const laneX = Math.round(left + width * lane / 4);
      fillRect(titleContext, "#ffe9bd", laneX, y, progress > .42 ? 2 : 1, 1);
    }
  }
  fillRect(titleContext, "#ffe7ba", 54, 184, 272, 3);
  fillRect(titleContext, "#ffe7ba", 54, 191, 272, 2);

  drawTitleCloneGate(titleContext, elapsed);
  for (let index = 0; index < 12; index += 1) {
    const loop = (beat * .21 + index * .11) % 1;
    const row = index % 4;
    const x = 337 - loop * 74 + row * 6;
    const y = 67 + row * 9 + loop * 26;
    drawTitleRunner(titleContext, x, y, .52 + loop * .15, walk + index, "clone", .46 + loop * .3);
  }

  const heroX = 209 + Math.sin(beat * 2.2) * 2;
  const heroY = 157 + Math.abs(Math.sin(walk)) * 2;
  drawTitleRunner(titleContext, 143, 161 + Math.abs(Math.sin(walk + 1.4)), 2.05, walk + 1.4, "sleeper");
  drawTitleRunner(titleContext, 297, 161 + Math.abs(Math.sin(walk + .8)), 2.15, walk + .8, "grappler");
  drawTitleRunner(titleContext, 350, 151 + Math.abs(Math.sin(walk + 2.4)), 1.72, walk + 2.4, "dasher");
  drawTitleRunner(titleContext, heroX, heroY, 3.15, walk, "captain");

  const bulletX = 171 + fireLoop * 66;
  if (fireLoop < .74) {
    fillRect(titleContext, "#fff0a7", bulletX, 155, 7, 4);
    fillRect(titleContext, "#f07862", bulletX + 2, 156, 3, 2);
    for (let trail = 0; trail < 3; trail += 1) fillRect(titleContext, "#ffd97a", bulletX - 7 - trail * 6, 156, 3, 2);
  }
  if (fireLoop > .8) {
    fillRect(titleContext, "#fff0a7", 162, 151, 8, 8);
    fillRect(titleContext, "#ef737b", 164, 149, 4, 12);
  }

  for (let index = 0; index < 15; index += 1) {
    const confettiX = (index * 47 + Math.floor(beat * (9 + index % 3))) % VIEW_WIDTH;
    const confettiY = 101 + (index * 29 + Math.floor(beat * (13 + index % 4))) % 105;
    fillRect(titleContext, index % 3 === 0 ? "#f5d765" : index % 3 === 1 ? "#79e0c1" : "#e87b9a", confettiX, confettiY, 2, 2);
  }
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
  return !props.some((prop) => prop.solid && intersects(playerLeft, playerTop, 10, 12, prop))
    && !clones.some((clone) => Math.abs(x - clone.x) < 11 && Math.abs(y - clone.y) < 12);
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

function getPracticeTargetInAim(maxDistance = GRAB_RANGE, hitRadius = GRAB_HIT_RADIUS) {
  const aimVector = getAimVector();
  let candidate: TestBot | undefined;
  let candidateForwardDistance = Number.POSITIVE_INFINITY;
  for (const bot of testBots) {
    const dx = bot.x - player.x;
    const dy = bot.y - player.y;
    const forwardDistance = dx * aimVector.x + dy * aimVector.y;
    const lateralDistance = Math.abs(dx * aimVector.y - dy * aimVector.x);
    if (forwardDistance <= 0 || forwardDistance > maxDistance || lateralDistance > hitRadius) continue;
    if (forwardDistance < candidateForwardDistance) {
      candidate = bot;
      candidateForwardDistance = forwardDistance;
    }
  }
  return candidate;
}

function isLocalActionLocked(now: number) {
  if (player.fallingUntil > 0 || player.airUntil > now) return true;
  if (grappleLockUntil > now || pushLockUntil > now) return true;
  return multiplayerActive && networkSleepUntil > now;
}

function canUseSkill(id: SkillId, now: number) {
  if (matchFinished || isLocalActionLocked(now)) return false;
  if (id === "dash") return dashCharges > 0 && now >= skillReadyAt.dash;
  if (id === "clone") return getOwnedCloneCount() < CLONE_LIMIT && now >= skillReadyAt.clone;
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
  if (!canUseSkill(id, now)) return false;
  const aimVector = getAimVector();

  if (multiplayerActive) {
    if (id === "dash") {
      dashCharges -= 1;
      skillReadyAt.dash = now + 170;
      player.dashVelocityX = aimVector.x * 280;
      player.dashVelocityY = aimVector.y * 280;
      player.dashUntil = now + 165;
      if (dashCharges === 0) dashRechargeAt = now + DASH_RECHARGE_DURATION;
    } else if (id === "run") {
      skillReadyAt.run = now + 9000;
      runUntil = now + RUN_DURATION;
    } else if (id === "push") skillReadyAt.push = now + 2600;
    else if (id === "grab") {
      skillReadyAt.grab = now + 3800;
      grappleLockUntil = now + 520;
    }
    else if (id === "clone") skillReadyAt.clone = now + CLONE_COOLDOWN;
    else if (id === "slow") {
      skillReadyAt.slow = now + 4600;
      projectiles.push({ kind: "slow", owner: "player", sourceId: socket.id, visualOnly: true, x: player.x, y: player.y - 2, velocityX: aimVector.x * 265, velocityY: aimVector.y * 265, until: now + 760, radius: 72 });
    } else {
      skillReadyAt.sleep = now + 2000;
      projectiles.push({ kind: "sleep", owner: "player", sourceId: socket.id, visualOnly: true, x: player.x, y: player.y - 2, velocityX: aimVector.x * 345, velocityY: aimVector.y * 345, until: now + 680, radius: 0 });
    }
    aim.pulseX = player.x;
    aim.pulseY = player.y;
    aim.pulseUntil = now + 220;
    socket.emit("combat:skill", { skill: id, dx: aimVector.x, dy: aimVector.y });
    showToast(`${skillLabels[id]} 사용!`);
    return true;
  }

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
    if (dashCharges === 0) dashRechargeAt = now + DASH_RECHARGE_DURATION;
    showToast(`돌진! (${dashCharges}/3)`);
  }

  if (id === "run") {
    skillReadyAt.run = now + 9000;
    runUntil = now + RUN_DURATION;
    showToast("질주 모드! 계속 달릴 수 있다.");
  }

  if (id === "grab") {
    skillReadyAt.grab = now + 3800;
    grappleLockUntil = now + 520;
    const target = getPracticeTargetInAim();
    const hookX = target ? target.x : player.x + aimVector.x * GRAB_RANGE;
    const hookY = target ? target.y : player.y + aimVector.y * GRAB_RANGE;
    if (target) {
      const targetStartX = target.x;
      const targetStartY = target.y;
      const pullX = player.x + aimVector.x * 34;
      const pullY = player.y + aimVector.y * 34;
      if (gameMode === "practice") {
        target.x = Math.max(PRACTICE_ARENA.left + 12, Math.min(PRACTICE_ARENA.right - 12, pullX));
        target.y = Math.max(PRACTICE_ARENA.top + 12, Math.min(PRACTICE_ARENA.bottom - 12, pullY));
      } else if (isTrackPoint(pullX, pullY)) {
        target.x = pullX;
        target.y = pullY;
      }
      target.knockbackX = 0;
      target.knockbackY = 0;
      grappleEffects.splice(0, grappleEffects.length, ...grappleEffects.filter((effect) => effect.targetId !== target.id));
      grappleEffects.push({
        sourceId: LOCAL_GRAPPLE_ID,
        targetId: target.id,
        sourceX: player.x,
        sourceY: player.y,
        hookX,
        hookY,
        targetStartX,
        targetStartY,
        targetEndX: target.x,
        targetEndY: target.y,
        startedAt: now,
        until: now + 520,
      });
      showToast(`${target.name}을(를) 앞으로 끌어왔다!`);
    } else {
      grappleEffects.push({
        sourceId: LOCAL_GRAPPLE_ID,
        sourceX: player.x,
        sourceY: player.y,
        hookX,
        hookY,
        startedAt: now,
        until: now + 520,
      });
      showToast("그랩 발사! 조준선에 맞은 대상이 없다.");
    }
  }

  if (id === "clone") {
    const rawX = player.x + aimVector.x * 32;
    const rawY = player.y + aimVector.y * 32;
    let spawnX = gameMode === "practice" ? Math.max(PRACTICE_ARENA.left + 12, Math.min(PRACTICE_ARENA.right - 12, rawX)) : rawX;
    let spawnY = gameMode === "practice" ? Math.max(PRACTICE_ARENA.top + 12, Math.min(PRACTICE_ARENA.bottom - 12, rawY)) : rawY;
    if (gameMode === "track" && !canStandAt(spawnX, spawnY)) {
      let found = false;
      for (let distance = 28; distance >= 8; distance -= 4) {
        const candidateX = player.x + aimVector.x * distance;
        const candidateY = player.y + aimVector.y * distance;
        if (!canStandAt(candidateX, candidateY)) continue;
        spawnX = candidateX;
        spawnY = candidateY;
        found = true;
        break;
      }
      if (!found) {
        showToast("분신을 놓을 수 있는 길이 없다.");
        return false;
      }
    }
    skillReadyAt.clone = now + CLONE_COOLDOWN;
    const clone = { x: spawnX, y: spawnY, direction: player.direction, until: now + CLONE_DURATION };
    clones.push(clone);
    for (const bot of testBots) nudgeBotFromNewClone(bot, clone, aimVector.x, aimVector.y);
    showToast(`분신 배치! (${clones.length}/${CLONE_LIMIT})`);
  }

  if (id === "slow") {
    skillReadyAt.slow = now + 4600;
    projectiles.push({ kind: "slow", owner: "player", x: player.x, y: player.y - 2, velocityX: aimVector.x * 265, velocityY: aimVector.y * 265, until: now + 760, radius: 72 });
    showToast("슬로우탄 발사!");
  }

  if (id === "sleep") {
    skillReadyAt.sleep = now + 2000;
    projectiles.push({ kind: "sleep", owner: "player", x: player.x, y: player.y - 2, velocityX: aimVector.x * 345, velocityY: aimVector.y * 345, until: now + 680, radius: 0 });
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

function rollEquippedSkill(now: number, announce = true) {
  const pool = roomConfig.enabledSkills;
  equippedSkill = pool[Math.floor(Math.random() * pool.length)] ?? "push";
  skillReadyAt[equippedSkill] = now;
  if (announce) showToast(`새 스킬: ${skillLabels[equippedSkill]}! 우클릭으로 사용하세요.`);
}

function refillPlayerAmmo() {
  player.ammo = 3;
}

function fireBasicShot(now: number) {
  if (now < player.shotReadyAt || matchFinished || isLocalActionLocked(now)) return;
  if (player.ammo <= 0) {
    showToast("총알을 다 썼다! 구덩이 또는 체크포인트 복귀 시 회복.");
    player.shotReadyAt = now + 220;
    return;
  }
  const aimVector = getAimVector();
  player.ammo -= 1;
  player.shotReadyAt = now + 210;
  projectiles.push({ kind: "bullet", owner: "player", x: player.x + aimVector.x * 8, y: player.y + aimVector.y * 2, velocityX: aimVector.x * 430, velocityY: aimVector.y * 430, until: now + 620, radius: 0 });
  if (multiplayerActive) socket.emit("combat:shoot", { dx: aimVector.x, dy: aimVector.y });
}

function respawnBot(bot: TestBot, now: number) {
  const point = RESPAWN_POINTS[Math.min(bot.checkpoint, RESPAWN_POINTS.length - 1)];
  bot.x = point.x + (bot.id % 2 ? 10 : -10);
  bot.y = point.y + (bot.id % 3 - 1) * 9;
  bot.health = 5;
  bot.knockbackX = 0;
  bot.knockbackY = 0;
  bot.sleepUntil = now + 250;
}

function damageBot(bot: TestBot, now: number) {
  bot.health -= 1;
  if (bot.health <= 0) {
    respawnBot(bot, now);
    showToast(`${bot.name} 처치! 체크포인트에서 부활.`);
  } else {
    bot.knockbackX += (bot.x - player.x) * 4;
    bot.knockbackY += (bot.y - player.y) * 4;
  }
}

function damagePlayer(now: number) {
  player.health -= 1;
  if (player.health <= 0) {
    player.health = 5;
    respawnAtCheckpoint("라이프가 모두 소진됐다! 체크포인트에서 부활.", now);
  } else {
    showToast(`피격! 라이프 ${player.health}/5`);
  }
}

function canBotStand(bot: TestBot, x: number, y: number) {
  if (gameMode === "track") {
    const feet = [[x - 4, y - 3], [x + 4, y - 3], [x - 4, y + 6], [x + 4, y + 6]];
    if (!feet.every(([footX, footY]) => isTrackPoint(footX, footY))) return false;
    return !clones.some((clone) => Math.abs(x - clone.x) < 13 && Math.abs(y - clone.y) < 14);
  }
  if (x - 6 < PRACTICE_ARENA.left || x + 6 > PRACTICE_ARENA.right || y - 6 < PRACTICE_ARENA.top || y + 8 > PRACTICE_ARENA.bottom) return false;
  return !clones.some((clone) => Math.abs(x - clone.x) < 13 && Math.abs(y - clone.y) < 14);
}

function nudgeBotFromNewClone(bot: TestBot, clone: Clone, fallbackX: number, fallbackY: number) {
  const deltaX = bot.x - clone.x;
  const deltaY = bot.y - clone.y;
  if (Math.abs(deltaX) >= 13 || Math.abs(deltaY) >= 14) return;
  const length = Math.hypot(deltaX, deltaY);
  const directionX = length > .01 ? deltaX / length : fallbackX;
  const directionY = length > .01 ? deltaY / length : fallbackY;
  for (let distance = 20; distance <= 48; distance += 4) {
    const x = clone.x + directionX * distance;
    const y = clone.y + directionY * distance;
    if (!canBotStand(bot, x, y)) continue;
    bot.x = x;
    bot.y = y;
    bot.knockbackX = 0;
    bot.knockbackY = 0;
    return;
  }
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

function updateTrackBots(now: number, dt: number) {
  for (let index = clones.length - 1; index >= 0; index -= 1) if (clones[index].until <= now) clones.splice(index, 1);
  if (dashCharges === 0 && now >= dashRechargeAt) dashCharges = 3;
  const route = [RESPAWN_POINTS[1], RESPAWN_POINTS[2], RESPAWN_POINTS[3], RESPAWN_POINTS[0]];
  for (const bot of testBots) {
    if (bot.sleepUntil > now) continue;
    const target = route[bot.routeIndex];
    const dx = target.x - bot.x;
    const dy = target.y - bot.y;
    const distance = Math.hypot(dx, dy);
    const speed = bot.slowUntil > now ? 29 : 72;
    if (distance < 12) {
      if (bot.routeIndex === 3) {
        bot.lap += 1;
        bot.checkpoint = 0;
        if (bot.lap >= roomConfig.lapLimit) {
          finishMatch(bot.name);
          return;
        }
      } else bot.checkpoint = bot.routeIndex + 1;
      bot.routeIndex = (bot.routeIndex + 1) % route.length;
      continue;
    }
    const moveX = dx / distance;
    const moveY = dy / distance;
    bot.direction = Math.abs(moveX) > Math.abs(moveY) ? (moveX < 0 ? "left" : "right") : (moveY < 0 ? "up" : "down");
    const candidateX = bot.x + moveX * speed * dt;
    const candidateY = bot.y + moveY * speed * dt;
    if (canBotStand(bot, candidateX, bot.y)) bot.x = candidateX;
    if (canBotStand(bot, bot.x, candidateY)) bot.y = candidateY;
    if (Math.abs(bot.knockbackX) > 2 || Math.abs(bot.knockbackY) > 2) {
      if (canBotStand(bot, bot.x + bot.knockbackX * dt, bot.y)) bot.x += bot.knockbackX * dt;
      if (canBotStand(bot, bot.x, bot.y + bot.knockbackY * dt)) bot.y += bot.knockbackY * dt;
      bot.knockbackX *= Math.pow(.02, dt);
      bot.knockbackY *= Math.pow(.02, dt);
    }
    const playerDistance = Math.hypot(player.x - bot.x, player.y - bot.y);
    if (playerDistance < 165 && now >= bot.shotReadyAt) {
      const bulletX = (player.x - bot.x) / Math.max(1, playerDistance);
      const bulletY = (player.y - bot.y) / Math.max(1, playerDistance);
      projectiles.push({ kind: "bullet", owner: "bot", sourceId: bot.id, x: bot.x + bulletX * 8, y: bot.y + bulletY * 2, velocityX: bulletX * 300, velocityY: bulletY * 300, until: now + 650, radius: 0 });
      bot.shotReadyAt = now + 2600 + Math.random() * 900;
    }
    bot.walking += dt * (bot.slowUntil > now ? 5 : 10);
  }
}

function updateProjectiles(now: number, dt: number) {
  for (let index = projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = projectiles[index];
    projectile.x += projectile.velocityX * dt;
    projectile.y += projectile.velocityY * dt;
    const target = projectile.owner === "player"
      ? testBots.find((bot) => Math.hypot(bot.x - projectile.x, bot.y - projectile.y) < 11)
      : undefined;
    const playerHit = projectile.owner === "bot" && Math.hypot(player.x - projectile.x, player.y - projectile.y) < 11;
    const outside = gameMode === "practice"
      ? projectile.x < PRACTICE_ARENA.left || projectile.x > PRACTICE_ARENA.right || projectile.y < PRACTICE_ARENA.top || projectile.y > PRACTICE_ARENA.bottom
      : projectile.x < 0 || projectile.x > WORLD_WIDTH || projectile.y < 0 || projectile.y > WORLD_HEIGHT;
    const expired = now >= projectile.until || outside;
    if (projectile.visualOnly) {
      if (expired) projectiles.splice(index, 1);
      continue;
    }
    if (!target && !playerHit && !expired) continue;
    if (projectile.kind === "bullet" && target) damageBot(target, now);
    if (projectile.kind === "bullet" && playerHit) damagePlayer(now);
    if (projectile.kind === "slow") {
      slowImpacts.push({ x: projectile.x, y: projectile.y, startedAt: now, until: now + 520 });
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

function updateObjective() {
  if (gameMode === "practice") {
    elements.objective.textContent = "TEST BOTS";
    return;
  }
  if (matchFinished) {
    elements.objective.textContent = "MATCH FINISHED";
    return;
  }
  elements.objective.textContent = checkpointIndex < checkpoints.length ? `CHECKPOINT ${checkpointIndex + 1}` : "START GATE!";
}

function finishMatch(winner: string, reason: "completed" | "time-limit" = "completed") {
  if (matchFinished) return;
  matchFinished = true;
  pressedKeys.clear();
  updateObjective();
  showToast(reason === "time-limit"
    ? `★ 시간 종료! ${winner}이(가) 현재 순위 1위입니다. ★`
    : `★ ${winner} 승리! ${roomConfig.lapLimit}랩을 가장 먼저 완주했습니다. ★`);
}

function formatRaceDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds % 3600 / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function hideMatchResults() {
  elements.results.classList.add("hidden");
  elements.resultRematch.disabled = false;
}

function showNetworkResults(room: NetworkRoom) {
  const result = room.result;
  if (!result || result.standings.length === 0) {
    hideMatchResults();
    return;
  }
  const winner = result.standings[0];
  const isHost = room.hostId === socket.id;
  const wasHidden = elements.results.classList.contains("hidden");
  elements.resultTitle.textContent = result.reason === "time-limit" ? `${winner.name} 시간 제한 1위!` : `${winner.name} 우승!`;
  elements.resultSummary.textContent = `${room.config.lapLimit}랩 경기 · ${formatRaceDuration(result.durationMs)} · ${room.code}`;
  elements.resultStandings.innerHTML = result.standings.map((standing) => {
    const checkpoint = standing.checkpoint < checkpoints.length ? `CP${standing.checkpoint + 1}` : "START";
    const progress = standing.completed ? "완주" : `${standing.lap}/${room.config.lapLimit} · ${checkpoint}`;
    return `<li class="result-row${standing.id === socket.id ? " me" : ""}"><span class="result-place">${standing.place}</span><i class="race-dot" style="background:${standing.color}"></i><span class="result-name">${escapeMarkup(standing.name)}</span><span class="result-progress">${progress}</span></li>`;
  }).join("");
  elements.resultRematch.classList.toggle("hidden", !isHost);
  elements.resultRematch.disabled = room.players.length < 2;
  elements.resultStatus.textContent = isHost
    ? room.players.length < 2 ? "재대결에는 최소 2명이 필요합니다." : "방장이 재대결을 시작하면 모든 러너가 같은 방에서 다시 출발합니다."
    : "방장이 재대결을 시작하기를 기다리거나 메인 화면으로 돌아갈 수 있습니다.";
  elements.results.classList.remove("hidden");
  if (wasHidden) window.setTimeout(() => (isHost && room.players.length >= 2 ? elements.resultRematch : elements.resultToTitle).focus(), 0);
}

function respawnAtCheckpoint(message: string, now: number) {
  const safeSpot = RESPAWN_POINTS[Math.min(checkpointIndex, RESPAWN_POINTS.length - 1)];
  player.x = safeSpot.x;
  player.y = safeSpot.y;
  player.knockbackX = 0;
  player.knockbackY = 0;
  player.fallingUntil = 0;
  player.airUntil = 0;
  player.hitUntil = now + 550;
  refillPlayerAmmo();
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
  if (multiplayerActive) {
    const spinnerElapsed = (networkSpinnerElapsedAtSync + Math.max(0, now - networkSpinnerSyncedAt)) / 1000;
    for (const spinner of spinners) spinner.angle = spinner.speed * spinnerElapsed;
  } else {
    for (const spinner of spinners) spinner.angle += spinner.speed * dt;
  }

  if (!multiplayerActive) {
    if (warningPitIndex >= 0 && now >= pitOpenAt) {
      activePitIndex = warningPitIndex;
      warningPitIndex = -1;
      pitOpenAt = 0;
      pits.forEach((pit, index) => {
        pit.active = index === activePitIndex;
        pit.warning = false;
      });
      pitOpenedAlertIndex = activePitIndex;
      pitOpenedAlertUntil = now + 1400;
      nextPitAt = now + PIT_CYCLE_MIN_DELAY + Math.random() * PIT_CYCLE_RANDOM_DELAY;
      showToast("구덩이가 열렸다!");
    } else if (warningPitIndex < 0 && now >= nextPitAt) {
      let nearestDistance = Number.POSITIVE_INFINITY;
      warningPitIndex = 0;
      pits.forEach((pit, index) => {
        const distance = Math.hypot(player.x - (pit.x + pit.width / 2), player.y - (pit.y + pit.height / 2));
        if (distance >= nearestDistance) return;
        nearestDistance = distance;
        warningPitIndex = index;
      });
      activePitIndex = -1;
      pitOpenAt = now + PIT_WARNING_DURATION;
      pits.forEach((pit, index) => {
        pit.active = false;
        pit.warning = index === warningPitIndex;
      });
      showToast("구덩이 경고! 잠시 후 열린다.");
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
  }

  if (multiplayerActive || now <= player.hitUntil) return;
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
  if (matchFinished || player.fallingUntil > now) return;
  const playerLeft = player.x - 5;
  const playerTop = player.y - 5;
  const checkpoint = checkpoints[checkpointIndex];
  if (checkpoint && intersects(playerLeft, playerTop, 10, 12, checkpoint, 8)) {
    checkpointIndex += 1;
    refillPlayerAmmo();
    rollEquippedSkill(now);
    if (checkpointIndex === checkpoints.length) {
      startArmed = true;
      showToast("마지막 관문 통과! 시작선으로 돌아가세요.");
    } else {
      showToast(`${checkpointIndex}번째 체크포인트 통과!`);
    }
    updateObjective();
    return;
  }

  if (startArmed && intersects(playerLeft, playerTop, 10, 12, START_GATE)) {
    lap += 1;
    checkpointIndex = 0;
    startArmed = false;
    player.hitUntil = now + 300;
    elements.lap.textContent = `${Math.min(lap, roomConfig.lapLimit)} / ${roomConfig.lapLimit} LAP`;
    updateObjective();
    if (lap >= roomConfig.lapLimit) finishMatch(player.name);
    else showToast(`${lap}랩 완주! 다음 바퀴도 말썽을 피워보자.`);
  }
}

function updatePlayer(dt: number, now: number) {
  if (player.fallingUntil > 0) {
    if (now < player.fallingUntil) return;
    if (multiplayerActive) return;
    respawnAtCheckpoint("마지막 체크포인트에서 다시 달린다!", now);
    return;
  }
  if (player.airUntil > now) return;
  if (grappleLockUntil > now || pushLockUntil > now) return;
  if (multiplayerActive && networkSleepUntil > now) return;
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
    const runMultiplier = runUntil > now ? RUN_SPEED_MULTIPLIER : 1;
    const slowMultiplier = multiplayerActive && networkSlowUntil > now ? SLOW_SPEED_MULTIPLIER : 1;
    movePlayer(horizontal * PLAYER_BASE_SPEED * runMultiplier * slowMultiplier * dt, vertical * PLAYER_BASE_SPEED * runMultiplier * slowMultiplier * dt);
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
  const playerId = multiplayerActive ? socket.id : LOCAL_GRAPPLE_ID;
  const grappledPosition = getGrappledPosition(
    playerId,
    player.x,
    player.y,
    performance.now(),
  );
  const position = getPushedPosition(playerId, grappledPosition.x, grappledPosition.y, performance.now());
  return {
    x: Math.max(0, Math.min(WORLD_WIDTH - VIEW_WIDTH, position.x - VIEW_WIDTH / 2)),
    y: Math.max(0, Math.min(WORLD_HEIGHT - VIEW_HEIGHT, position.y - VIEW_HEIGHT / 2)),
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
  const position = getGrappledPosition(bot.id, bot.x, bot.y, time);
  const x = position.x - cameraX;
  const y = position.y - cameraY;
  drawPerson(context, x, y, bot.direction, bot.walking, bot.color, true);
  const statusLeft = Math.round(x - 12);
  drawHealthPips(context, statusLeft, y - 14, bot.health);
  updateRunnerLabels(bot, statusLeft, y - 14);
  drawSlowStatus(context, x, y, time, bot.slowUntil);
  drawSleepStatus(context, x, y, time, bot.sleepUntil);
}

function drawRemotePlayer(context: CanvasRenderingContext2D, runner: RemotePlayer, cameraX: number, cameraY: number, time: number) {
  const grappledPosition = getGrappledPosition(runner.id, runner.x, runner.y, time);
  const position = getPushedPosition(runner.id, grappledPosition.x, grappledPosition.y, time);
  const baseX = position.x - cameraX;
  const baseY = position.y - cameraY;
  if (runner.fallingUntil > time) {
    const progress = Math.max(0, Math.min(1, (time - runner.fallingStartedAt) / 520));
    const drawX = baseX + (runner.fallTargetX - runner.x) * progress;
    const drawY = baseY + (runner.fallTargetY - runner.y) * progress;
    const scale = Math.max(.16, 1 - progress * .84);
    context.save();
    context.translate(Math.round(drawX), Math.round(drawY));
    context.scale(scale, scale);
    drawPerson(context, 0, 0, runner.direction, runner.walking, runner.color, true);
    context.restore();
    return;
  }
  const airProgress = runner.airUntil > time ? Math.max(0, Math.min(1, (time - runner.airStartedAt) / 560)) : 0;
  const lift = airProgress > 0 ? Math.sin(airProgress * Math.PI) * 18 : 0;
  const x = baseX;
  const y = baseY - lift;
  if (lift > 0) fillRect(context, "rgba(38,31,54,.3)", baseX - 8, baseY + 10, 16, 3);
  drawPerson(context, x, y, runner.direction, runner.walking, runner.color, true);
  drawSlowStatus(context, x, y, time, runner.slowEffectUntil);
  drawSleepStatus(context, x, y, time, runner.sleepEffectUntil);
  const statusLeft = Math.round(x - 12);
  drawHealthPips(context, statusLeft, y - 14, runner.health);
  updateRunnerLabels(runner, statusLeft, y - 14);
}

function drawGrappleEffects(context: CanvasRenderingContext2D, cameraX: number, cameraY: number, now: number) {
  for (let index = grappleEffects.length - 1; index >= 0; index -= 1) {
    const effect = grappleEffects[index];
    if (effect.until <= now) {
      grappleEffects.splice(index, 1);
      continue;
    }
    const progress = Math.max(0, Math.min(1, (now - effect.startedAt) / 520));
    const returnPhase = progress >= .36;
    const phase = returnPhase ? (progress - .36) / .64 : progress / .36;
    const tipX = returnPhase
      ? effect.hookX + (effect.sourceX - effect.hookX) * phase
      : effect.sourceX + (effect.hookX - effect.sourceX) * phase;
    const tipY = returnPhase
      ? effect.hookY + (effect.sourceY - effect.hookY) * phase
      : effect.sourceY + (effect.hookY - effect.sourceY) * phase;
    const distance = Math.hypot(tipX - effect.sourceX, tipY - effect.sourceY);
    const steps = Math.max(1, Math.ceil(distance / 5));
    for (let step = 0; step <= steps; step += 1) {
      const ratio = step / steps;
      const armX = effect.sourceX + (tipX - effect.sourceX) * ratio - cameraX;
      const armY = effect.sourceY + (tipY - effect.sourceY) * ratio - cameraY;
      fillRect(context, step % 2 ? "#97b4c0" : "#485b73", armX - 1, armY - 1, 3, 3);
    }
    const handX = tipX - cameraX;
    const handY = tipY - cameraY;
    fillRect(context, "#202d45", handX - 6, handY - 5, 12, 10);
    fillRect(context, "#8faeb8", handX - 4, handY - 4, 8, 7);
    fillRect(context, "#d4eef0", handX - 2, handY - 3, 4, 2);
    fillRect(context, "#f0b95b", handX + 3, handY - 1, 4, 3);
  }
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
  if (projectile.kind === "bullet") {
    fillRect(context, projectile.owner === "player" ? "#fff0a7" : "#ff916d", x - 3, y - 2, 7, 5);
    fillRect(context, projectile.owner === "player" ? "#e5795f" : "#fff0a7", x - 1, y - 1, 3, 3);
    return;
  }
  fillRect(context, "#4a345d", x - 5, y - 3, 11, 7);
  fillRect(context, "#d58ee9", x - 3, y - 2, 7, 5);
  fillRect(context, "#fff0cc", x + 2, y - 1, 3, 3);
}

function drawSlowImpacts(context: CanvasRenderingContext2D, cameraX: number, cameraY: number, time: number) {
  for (let index = slowImpacts.length - 1; index >= 0; index -= 1) {
    const impact = slowImpacts[index];
    if (impact.until <= time) {
      slowImpacts.splice(index, 1);
      continue;
    }
    const progress = Math.max(0, Math.min(1, (time - impact.startedAt) / (impact.until - impact.startedAt)));
    const radius = 6 + Math.round(progress * 20);
    const x = impact.x - cameraX;
    const y = impact.y - cameraY;
    const color = progress < .45 ? "#dffff2" : "#75ddeb";
    fillRect(context, "rgba(39,61,101,.72)", x - radius - 2, y - 2, (radius + 2) * 2, 5);
    fillRect(context, color, x - radius, y - 1, radius * 2, 2);
    fillRect(context, color, x - 1, y - radius, 2, radius * 2);
    fillRect(context, "#efffc9", x - radius + 2, y - radius + 2, 3, 3);
    fillRect(context, "#75ddeb", x + radius - 4, y + radius - 4, 3, 3);
  }
}

function updateSkillBar(now: number) {
  if (gameActive) {
    elements.skillBar.classList.add("hidden");
    elements.skillBar.classList.remove("track-mode");
    skillBarSignature = "";
    return;
  }
  elements.skillBar.classList.remove("hidden", "track-mode");
  const ids: SkillId[] = ["push", "dash", "run", "grab", "clone", "slow", "sleep"];
  const markup = ids.map((id, index) => {
    const remaining = Math.max(0, skillReadyAt[id] - now);
    const active = id === "run" && runUntil > now;
    const status = id === "dash" ? (dashCharges > 0 ? `${dashCharges}/3` : `${Math.ceil(Math.max(0, dashRechargeAt - now) / 1000)}s`) : id === "clone" ? `${getOwnedCloneCount()}/${CLONE_LIMIT}` : active ? "RUN!" : remaining > 0 ? `${Math.ceil(remaining / 1000)}s` : "READY";
    const unavailable = !canUseSkill(id, now);
    return `<span class="skill-chip${unavailable ? " cooldown" : ""}${active ? " active" : ""}"><b>${index + 1}. ${skillLabels[id]}</b>${status}</span>`;
  }).join("") + `<span class="skill-chip"><b>R. 랜덤</b>ROLL</span>`;
  if (markup !== skillBarSignature) {
    skillBarSignature = markup;
    elements.skillBar.innerHTML = markup;
  }
}

function escapeMarkup(value: string) {
  return value.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character] ?? character);
}

function updateRaceBoard() {
  if (gameMode !== "track") {
    elements.raceBoard.classList.add("hidden");
    return;
  }
  elements.raceBoard.classList.remove("hidden");
  const playerCheckpoint = lap >= roomConfig.lapLimit ? "FIN" : checkpointIndex < checkpoints.length ? `CP${checkpointIndex + 1}` : "START";
  const otherRunners = multiplayerActive
    ? [...remotePlayers.values()].map((runner) => ({ id: runner.id, name: runner.name, color: runner.color, lap: runner.lap, checkpoint: runner.checkpoint, label: runner.lap >= roomConfig.lapLimit ? "FIN" : runner.checkpoint < 3 ? `CP${runner.checkpoint + 1}` : "START", me: false }))
    : testBots.map((bot) => ({ id: bot.id, name: bot.name, color: bot.color, lap: bot.lap, checkpoint: bot.checkpoint, label: bot.routeIndex < 3 ? `CP${bot.routeIndex + 1}` : "START", me: false }));
  const runners = [
    { id: 0, name: player.name, color: player.color, lap, checkpoint: checkpointIndex, label: playerCheckpoint, me: true },
    ...otherRunners,
  ].sort((a, b) => b.lap * 4 + b.checkpoint - (a.lap * 4 + a.checkpoint));
  const markup = `<div class="race-title"><span>RACE BOARD</span><span>${runners.length}P</span></div>${runners.map((runner, index) => `<div class="race-row${runner.me ? " me" : ""}"><span>${index + 1}</span><i class="race-dot" style="background:${runner.color}"></i><span class="race-name">${escapeMarkup(runner.name)}</span><span class="race-progress">${Math.min(runner.lap, roomConfig.lapLimit)}/${roomConfig.lapLimit}</span><span class="race-cp">${runner.label}</span></div>`).join("")}`;
  if (markup !== raceBoardSignature) {
    raceBoardSignature = markup;
    elements.raceBoard.innerHTML = markup;
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
  drawSlowImpacts(context, cameraX, cameraY, time);
  drawGrappleEffects(context, cameraX, cameraY, time);
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
  drawPitAlert(context, cameraX, cameraY, time);
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

  for (const bot of testBots) drawTestBot(context, bot, cameraX, cameraY, time);
  for (const runner of remotePlayers.values()) drawRemotePlayer(context, runner, cameraX, cameraY, time);
  for (const clone of clones) drawClone(context, clone, cameraX, cameraY, time);
  for (const projectile of projectiles) drawProjectile(context, projectile, cameraX, cameraY);
  drawSlowImpacts(context, cameraX, cameraY, time);
  drawGrappleEffects(context, cameraX, cameraY, time);

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

function animate(now: number) {
  const dt = Math.min(.05, (now - lastFrame) / 1000);
  lastFrame = now;
  if (titleFallbackActive) drawTitlePreview(now);
  if (gameActive) {
    if (!matchFinished) {
      if (gameMode === "track") {
        updateHazards(now, dt);
        updateTrackBots(now, dt);
      } else updatePracticeBots(now, dt);
      updatePlayer(dt, now);
      if (gameMode === "track" && !multiplayerActive) updateProgress(now);
      updateProjectiles(now, dt);
      if (gameMode === "track") {
        interpolateRemotePlayers(dt);
        sendLocalNetworkState(now);
      }
    }
    drawTown(gameContext, now);
    updateSkillBar(now);
    updateRaceBoard();
  }
  requestAnimationFrame(animate);
}

function showToast(message: string) {
  elements.toast.textContent = message;
  elements.toast.classList.add("visible");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("visible"), 1900);
}

function syncNetworkHazards(hazards: NetworkHazards) {
  const now = performance.now();
  activePitIndex = hazards.activePitIndex;
  warningPitIndex = hazards.warningPitIndex;
  pitOpenAt = now + Math.max(0, hazards.warningMs);
  nextPitAt = now + Math.max(0, hazards.nextPitMs);
  networkSpinnerElapsedAtSync = Math.max(0, hazards.spinnerElapsedMs ?? 0);
  networkSpinnerSyncedAt = now;
  pits.forEach((pit, index) => {
    pit.active = index === activePitIndex;
    pit.warning = index === warningPitIndex;
  });
}

function syncRemotePlayers(room: NetworkRoom) {
  const present = new Set<string>();
  for (const runner of room.players) {
    if (runner.id === socket.id) continue;
    present.add(runner.id);
    upsertRemotePlayer(runner);
  }
  for (const id of remotePlayers.keys()) if (!present.has(id)) remotePlayers.delete(id);
}

function syncRemoteHazardState(current: RemotePlayer, runner: NetworkPlayer, receivedAt: number) {
  const fallingMs = Math.max(0, runner.fallingMs ?? 0);
  if (fallingMs > 0) {
    current.fallingStartedAt = receivedAt - Math.max(0, runner.fallingElapsedMs ?? 0);
    current.fallingUntil = receivedAt + fallingMs;
    current.fallTargetX = runner.fallTargetX ?? runner.x;
    current.fallTargetY = runner.fallTargetY ?? runner.y;
  } else {
    current.fallingStartedAt = 0;
    current.fallingUntil = 0;
  }
  const airMs = Math.max(0, runner.airMs ?? 0);
  if (airMs > 0) {
    current.airStartedAt = receivedAt - Math.max(0, runner.airElapsedMs ?? 0);
    current.airUntil = receivedAt + airMs;
  } else {
    current.airStartedAt = 0;
    current.airUntil = 0;
  }
}

function syncRemoteTimedState(current: RemotePlayer, runner: NetworkPlayer, receivedAt: number) {
  current.slowEffectUntil = receivedAt + Math.max(0, runner.slowMs ?? 0);
  current.sleepEffectUntil = receivedAt + Math.max(0, runner.sleepMs ?? 0);
}

function syncPlayerTimedState(runner: NetworkPlayer, receivedAt: number) {
  networkSleepUntil = receivedAt + Math.max(0, runner.sleepMs ?? 0);
  networkSlowUntil = receivedAt + Math.max(0, runner.slowMs ?? 0);
  runUntil = receivedAt + Math.max(0, runner.runMs ?? 0);
  grappleLockUntil = receivedAt + Math.max(0, runner.grappleMs ?? 0);
  pushLockUntil = receivedAt + Math.max(0, runner.pushMs ?? 0);
}

function syncPlayerHazardState(runner: NetworkPlayer, receivedAt: number) {
  const fallingMs = Math.max(0, runner.fallingMs ?? 0);
  if (fallingMs > 0) {
    player.fallingStartedAt = receivedAt - Math.max(0, runner.fallingElapsedMs ?? 0);
    player.fallingUntil = receivedAt + fallingMs;
    player.fallTargetX = runner.fallTargetX ?? runner.x;
    player.fallTargetY = runner.fallTargetY ?? runner.y;
    player.knockbackX = 0;
    player.knockbackY = 0;
    player.airUntil = 0;
  } else {
    player.fallingUntil = 0;
  }
  const airMs = Math.max(0, runner.airMs ?? 0);
  if (airMs > 0 && fallingMs === 0) {
    player.airStartedAt = receivedAt - Math.max(0, runner.airElapsedMs ?? 0);
    player.airUntil = receivedAt + airMs;
  } else if (airMs === 0) {
    player.airUntil = 0;
  }
}

function syncNetworkClones(room: NetworkRoom) {
  if (!multiplayerActive) return;
  clones.length = 0;
  const receivedAt = performance.now();
  for (const clone of room.clones ?? []) {
    if (clone.until <= Date.now()) continue;
    clones.push({ ...clone, until: receivedAt + (clone.until - Date.now()) });
  }
}

function upsertRemotePlayer(runner: NetworkPlayer) {
  const receivedAt = performance.now();
  const current = remotePlayers.get(runner.id);
  if (!current) {
    const created: RemotePlayer = {
      ...runner,
      targetX: runner.x,
      targetY: runner.y,
      targetWalking: runner.walking,
      skillCooldownUntil: receivedAt + Math.max(0, runner.skillCooldownMs ?? 0),
      dashRechargeUntil: receivedAt + Math.max(0, runner.dashRechargeMs ?? 0),
      fallingStartedAt: 0,
      fallingUntil: 0,
      fallTargetX: runner.fallTargetX ?? runner.x,
      fallTargetY: runner.fallTargetY ?? runner.y,
      airStartedAt: 0,
      airUntil: 0,
      slowEffectUntil: 0,
      sleepEffectUntil: 0,
    };
    syncRemoteHazardState(created, runner, receivedAt);
    syncRemoteTimedState(created, runner, receivedAt);
    remotePlayers.set(runner.id, created);
    return;
  }
  current.name = runner.name;
  current.color = runner.color;
  current.direction = runner.direction;
  current.health = runner.health;
  current.ammo = runner.ammo;
  current.skill = runner.skill;
  current.cloneCount = runner.cloneCount;
  current.dashCharges = runner.dashCharges;
  current.skillCooldownUntil = receivedAt + Math.max(0, runner.skillCooldownMs ?? 0);
  current.dashRechargeUntil = receivedAt + Math.max(0, runner.dashRechargeMs ?? 0);
  current.lap = runner.lap;
  current.checkpoint = runner.checkpoint;
  current.targetX = runner.x;
  current.targetY = runner.y;
  current.targetWalking = runner.walking;
  syncRemoteHazardState(current, runner, receivedAt);
  syncRemoteTimedState(current, runner, receivedAt);
}

function interpolateRemotePlayers(dt: number) {
  const amount = 1 - Math.exp(-16 * dt);
  for (const runner of remotePlayers.values()) {
    const distance = Math.hypot(runner.targetX - runner.x, runner.targetY - runner.y);
    if (distance > 96) {
      runner.x = runner.targetX;
      runner.y = runner.targetY;
    } else {
      runner.x += (runner.targetX - runner.x) * amount;
      runner.y += (runner.targetY - runner.y) * amount;
    }
    runner.walking += (runner.targetWalking - runner.walking) * amount;
  }
}

function updateNetworkWaitingPanel() {
  if (!activeNetworkRoom || activeNetworkRoom.phase !== "waiting" || gameActive) return;
  const isHost = activeNetworkRoom.hostId === socket.id;
  elements.titleRoomPanel.classList.add("network-waiting");
  elements.titlePanelMarker.textContent = "ONLINE ROOM";
  elements.titlePanelTitle.textContent = `${activeNetworkRoom.code} · ${activeNetworkRoom.players.length}/${activeNetworkRoom.config.playerCount}명`;
  elements.titleConfirm.textContent = isHost ? "경기 시작" : "방장 시작 대기";
  elements.titleConfirm.disabled = !isHost || activeNetworkRoom.players.length < 2;
}

function applyNetworkRoom(room: NetworkRoom) {
  activeNetworkRoom = room;
  roomConfig = room.config;
  syncNetworkHazards(room.hazards);
  syncRemotePlayers(room);
  syncNetworkClones(room);
  const self = room.players.find((runner) => runner.id === socket.id);
  if (self && multiplayerActive && gameActive) {
    const previousLap = lap;
    const previousCheckpoint = checkpointIndex;
    const receivedAt = performance.now();
    syncPlayerTimedState(self, receivedAt);
    syncPlayerHazardState(self, receivedAt);
    player.color = self.color;
    player.health = self.health;
    player.ammo = self.ammo;
    equippedSkill = self.skill;
    skillReadyAt[self.skill] = Math.max(skillReadyAt[self.skill], receivedAt + Math.max(0, self.skillCooldownMs ?? 0));
    if (self.dashCharges !== undefined) dashCharges = self.dashCharges;
    if (self.dashRechargeMs !== undefined) dashRechargeAt = receivedAt + Math.max(0, self.dashRechargeMs);
    lap = self.lap;
    checkpointIndex = self.checkpoint;
    if (player.dashUntil <= performance.now() && Math.hypot(self.x - player.x, self.y - player.y) > 12) {
      player.x = self.x;
      player.y = self.y;
    }
    elements.lap.textContent = `${Math.min(lap, roomConfig.lapLimit)} / ${roomConfig.lapLimit} LAP`;
    updateObjective();
    if (room.phase === "running" && lap > previousLap) {
      showToast(`${lap}랩 완주! 다음 바퀴도 말썽을 피워보자.`);
    } else if (room.phase === "running" && checkpointIndex > previousCheckpoint) {
      showToast(checkpointIndex === checkpoints.length ? "마지막 관문 통과! 시작선으로 돌아가세요." : `${checkpointIndex}번째 체크포인트 통과!`);
    }
  }
  if (multiplayerActive && gameActive && room.phase === "finished" && room.winner && room.result) {
    finishMatch(room.winner.name, room.result.reason);
    showNetworkResults(room);
  }
  if (!gameActive) updateNetworkWaitingPanel();
}

function ensureSocketConnected() {
  if (socket.connected) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      socket.off("connect", connected);
      socket.off("connect_error", failed);
      reject(new Error("멀티플레이 서버 연결 시간이 초과됐습니다."));
    }, 5000);
    const connected = () => {
      window.clearTimeout(timeout);
      socket.off("connect_error", failed);
      resolve();
    };
    const failed = () => {
      window.clearTimeout(timeout);
      socket.off("connect", connected);
      reject(new Error("멀티플레이 서버에 연결하지 못했습니다."));
    };
    socket.once("connect", connected);
    socket.once("connect_error", failed);
    socket.connect();
  });
}

function requestNetworkRoom(event: "room:create" | "room:join" | "room:start" | "room:rematch", payload?: unknown) {
  return new Promise<NetworkRoom>((resolve, reject) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (!settled) reject(new Error("서버 응답 시간이 초과됐습니다."));
    }, 5000);
    const done = (response: NetworkResponse) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      if (!response?.ok) {
        reject(new Error(response?.error ?? "방 요청을 처리하지 못했습니다."));
        return;
      }
      resolve(response.room);
    };
    if (payload === undefined) socket.emit(event, done);
    else socket.emit(event, payload, done);
  });
}

function sendLocalNetworkState(now: number) {
  if (!multiplayerActive || !socket.connected || player.dashUntil > now || isLocalActionLocked(now) || now - lastNetworkStateAt < 55) return;
  lastNetworkStateAt = now;
  socket.emit("player:state", {
    x: player.x,
    y: player.y,
    direction: player.direction,
    walking: player.walking,
  });
}

function readRoomConfig(): RoomConfig | undefined {
  const lapLimit = Math.floor(Number(elements.titleLapCount.value));
  const playerCount = Math.floor(Number(elements.titlePlayerCount.value));
  const enabledSkills = [...elements.titleSkillPool.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked')]
    .map((input) => input.value as SkillId)
    .filter((id): id is SkillId => Object.hasOwn(skillLabels, id));
  if (!Number.isFinite(lapLimit) || lapLimit < 1 || lapLimit > 999) {
    showToast("목표 랩은 1부터 999까지의 숫자로 입력하세요.");
    return undefined;
  }
  if (!Number.isFinite(playerCount) || playerCount < 2 || playerCount > 6) {
    showToast("인원은 2명부터 6명까지 설정할 수 있어요.");
    return undefined;
  }
  if (enabledSkills.length < 3) {
    showToast("랜덤 스킬 풀에 최소 3개를 선택하세요.");
    return undefined;
  }
  elements.titleLapCount.value = String(lapLimit);
  elements.titlePlayerCount.value = String(playerCount);
  return { lapLimit, playerCount, enabledSkills };
}

function startLocalGame(name: string) {
  const config = roomConfig;
  if (activeNetworkRoom) socket.emit("room:leave");
  activeNetworkRoom = undefined;
  activeNetworkRound = 0;
  multiplayerActive = false;
  remotePlayers.clear();
  hideMatchResults();
  const now = performance.now();
  roomConfig = config;
  gameMode = "track";
  resetWorldLabels();
  matchFinished = false;
  player.name = name;
  player.color = "#f16c7a";
  player.x = START_POINT.x;
  player.y = START_POINT.y;
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
  player.health = 5;
  player.ammo = 3;
  player.shotReadyAt = 0;
  runUntil = 0;
  clones.length = 0;
  projectiles.length = 0;
  slowImpacts.length = 0;
  pushEffects.length = 0;
  (Object.keys(skillReadyAt) as SkillId[]).forEach((id) => { skillReadyAt[id] = 0; });
  dashCharges = 3;
  dashRechargeAt = 0;
  testBots.length = 0;
  rollEquippedSkill(now, false);
  skillBarSignature = "";
  raceBoardSignature = "";
  elements.practice.textContent = "스킬 연습장 이동";
  lap = 0;
  checkpointIndex = 0;
  startArmed = false;
  activePitIndex = -1;
  warningPitIndex = -1;
  pitOpenAt = 0;
  pitOpenedAlertIndex = -1;
  pitOpenedAlertUntil = 0;
  pits.forEach((pit) => {
    pit.active = false;
    pit.warning = false;
  });
  nextPitAt = now + FIRST_PIT_WARNING_DELAY;
  jumpPadCooldownUntil = 0;
  aim.visible = false;
  aim.pulseUntil = 0;
  elements.lap.textContent = `0 / ${roomConfig.lapLimit} LAP`;
  updateObjective();
  elements.playerName.textContent = name;
  elements.back.classList.remove("hidden");
  elements.game.classList.remove("hidden");
  gameActive = true;
  elements.gameCanvas.focus();
  showToast(`${name}, ${roomConfig.playerCount}인 ${roomConfig.lapLimit}랩 레이스 시작!`);
}

function startNetworkMatch(room: NetworkRoom) {
  if (multiplayerActive && gameActive && activeNetworkRoom?.code === room.code && activeNetworkRound === room.round) {
    applyNetworkRoom(room);
    return;
  }
  const self = room.players.find((runner) => runner.id === socket.id);
  if (!self) return;
  activeNetworkRoom = room;
  activeNetworkRound = room.round;
  multiplayerActive = true;
  lastNetworkStateAt = 0;
  networkSleepUntil = 0;
  networkSlowUntil = 0;
  grappleLockUntil = 0;
  pushLockUntil = 0;
  grappleEffects.length = 0;
  pushEffects.length = 0;
  roomConfig = room.config;
  syncRemotePlayers(room);
  const now = performance.now();
  gameMode = "track";
  resetWorldLabels();
  matchFinished = false;
  hideMatchResults();
  player.name = self.name;
  player.color = self.color;
  player.x = self.x;
  player.y = self.y;
  player.direction = self.direction;
  player.walking = self.walking;
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
  player.health = self.health;
  player.ammo = self.ammo;
  player.shotReadyAt = 0;
  equippedSkill = self.skill;
  runUntil = 0;
  testBots.length = 0;
  clones.length = 0;
  syncNetworkClones(room);
  projectiles.length = 0;
  slowImpacts.length = 0;
  (Object.keys(skillReadyAt) as SkillId[]).forEach((id) => { skillReadyAt[id] = 0; });
  skillReadyAt[self.skill] = now + Math.max(0, self.skillCooldownMs ?? 0);
  dashCharges = self.dashCharges ?? 3;
  dashRechargeAt = now + Math.max(0, self.dashRechargeMs ?? 0);
  skillBarSignature = "";
  raceBoardSignature = "";
  elements.practice.textContent = "스킬 연습장 이동";
  lap = self.lap;
  checkpointIndex = self.checkpoint;
  startArmed = false;
  pitOpenedAlertIndex = -1;
  pitOpenedAlertUntil = 0;
  syncNetworkHazards(room.hazards);
  syncPlayerTimedState(self, now);
  syncPlayerHazardState(self, now);
  jumpPadCooldownUntil = 0;
  aim.visible = false;
  aim.pulseUntil = 0;
  elements.lap.textContent = `${lap} / ${roomConfig.lapLimit} LAP`;
  updateObjective();
  elements.playerName.textContent = self.name;
  elements.back.classList.remove("hidden");
  elements.title.classList.add("hidden");
  elements.game.classList.remove("hidden");
  gameActive = true;
  elements.gameCanvas.focus();
  showToast(`${room.code} 멀티 레이스 시작! ${room.players.length}명 연결됨.`);
}

function resetSkillPractice(now: number) {
  testBots.length = 0;
  resetWorldLabels();
  clones.length = 0;
  projectiles.length = 0;
  slowImpacts.length = 0;
  grappleEffects.length = 0;
  pushEffects.length = 0;
  if (skillTestRoomActive) {
    const targets = [
      { x: 354, y: 338, color: "#f4c562", name: "더미 노랑", skill: "push" as SkillId },
      { x: 544, y: 338, color: "#78d8e9", name: "더미 파랑", skill: "dash" as SkillId },
      { x: 345, y: 445, color: "#a985e6", name: "더미 보라", skill: "grab" as SkillId },
      { x: 555, y: 445, color: "#e58fba", name: "더미 분홍", skill: "sleep" as SkillId },
    ];
    targets.forEach((target, index) => testBots.push({
      ...target,
      id: index + 1,
      direction: "down",
      walking: index,
      moveX: 0,
      moveY: 0,
      nextTurnAt: Number.POSITIVE_INFINITY,
      knockbackX: 0,
      knockbackY: 0,
      slowUntil: 0,
      sleepUntil: 0,
      health: 5,
      lap: 0,
      checkpoint: 0,
      routeIndex: 0,
      shotReadyAt: Number.POSITIVE_INFINITY,
    }));
  }
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
  elements.practice.textContent = skillTestRoomActive ? "메인 화면으로 돌아가기" : "운동장으로 돌아가기";
  updateObjective();
  showToast(skillTestRoomActive ? "스킬 테스트 방 입장! 더미에게 자유롭게 사용해보세요." : "스킬 연습장 입장! 숫자 1~7 또는 R을 눌러 테스트하세요.");
}

function returnToTrack() {
  skillTestRoomActive = false;
  gameMode = "track";
  player.x = START_POINT.x;
  player.y = START_POINT.y;
  player.direction = "right";
  player.knockbackX = 0;
  player.knockbackY = 0;
  player.dashUntil = 0;
  player.hitUntil = 0;
  runUntil = 0;
  clones.length = 0;
  projectiles.length = 0;
  slowImpacts.length = 0;
  elements.skillBar.classList.add("hidden");
  elements.practice.textContent = "스킬 연습장 이동";
  updateObjective();
  showToast("운동장 트랙으로 돌아왔다.");
}

function togglePractice() {
  if (!gameActive) return;
  if (multiplayerActive) {
    showToast("멀티 레이스 중에는 연습장으로 이동할 수 없어요.");
    return;
  }
  if (gameMode === "practice" && skillTestRoomActive) returnToTitle();
  if (gameMode === "practice") returnToTrack();
  else enterPractice();
}

function returnToTitle() {
  if (activeNetworkRoom) socket.emit("room:leave");
  activeNetworkRoom = undefined;
  activeNetworkRound = 0;
  multiplayerActive = false;
  remotePlayers.clear();
  clones.length = 0;
  projectiles.length = 0;
  slowImpacts.length = 0;
  networkSleepUntil = 0;
  networkSlowUntil = 0;
  grappleLockUntil = 0;
  pushLockUntil = 0;
  grappleEffects.length = 0;
  pushEffects.length = 0;
  skillTestRoomActive = false;
  gameMode = "track";
  resetWorldLabels();
  gameActive = false;
  aim.visible = false;
  pressedKeys.clear();
  if (document.fullscreenElement) void document.exitFullscreen();
  elements.toast.classList.remove("visible");
  elements.toast.textContent = "";
  hideMatchResults();
  elements.skillBar.classList.add("hidden");
  elements.practice.textContent = "스킬 연습장 이동";
  elements.game.classList.add("hidden");
  closeTitleRoomPanel();
  elements.title.classList.remove("hidden");
}

type TitleRoomMode = "join" | "create";
let titleRoomMode: TitleRoomMode = "join";

function createInviteCode() {
  return `PM-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function openTitleRoomPanel(mode: TitleRoomMode) {
  titleRoomMode = mode;
  elements.titleRoomPanel.classList.remove("hidden");
  elements.titleRoomPanel.classList.remove("network-waiting");
  elements.titleRoomPanel.classList.toggle("create-mode", mode === "create");
  elements.titleStage.classList.add("room-panel-open");
  elements.titleStage.classList.toggle("create-panel-open", mode === "create");
  elements.titleConfirm.disabled = false;
  if (mode === "join") {
    elements.titlePanelMarker.textContent = "JOIN ROOM";
    elements.titlePanelTitle.textContent = "방 참여하기";
    elements.titleConfirm.textContent = "방 참가";
    window.setTimeout(() => elements.titleRoomCode.focus(), 0);
    return;
  }
  elements.titlePanelMarker.textContent = "CREATE ROOM";
  elements.titlePanelTitle.textContent = "방 생성하기";
  elements.titleConfirm.textContent = "방 열기";
  if (!elements.titleInviteCode.value.trim() || elements.titleInviteCode.value === "PM-7F2A") elements.titleInviteCode.value = createInviteCode();
  window.setTimeout(() => elements.titleRunnerName.focus(), 0);
}

function closeTitleRoomPanel() {
  if (activeNetworkRoom && !gameActive) socket.emit("room:leave");
  activeNetworkRoom = undefined;
  if (!gameActive) activeNetworkRound = 0;
  remotePlayers.clear();
  elements.titleRoomPanel.classList.add("hidden");
  elements.titleRoomPanel.classList.remove("network-waiting");
  elements.titleConfirm.disabled = false;
  elements.titleStage.classList.remove("room-panel-open");
  elements.titleStage.classList.remove("create-panel-open");
}

function startSkillTestRoom(name: string) {
  elements.title.classList.add("hidden");
  startLocalGame(name);
  if (!gameActive) return;
  elements.back.classList.add("hidden");
  skillTestRoomActive = true;
  enterPractice();
}

async function startFromTitleRoomPanel() {
  const runnerName = elements.titleRunnerName.value.trim().slice(0, 10) || "말썽꾸러기";
  if (titleRoomMode === "join" && elements.titleRoomCode.value.trim().toUpperCase() === "TEST-SKILL") {
    startSkillTestRoom(runnerName);
    return;
  }
  try {
    await ensureSocketConnected();
    if (activeNetworkRoom) {
      if (activeNetworkRoom.hostId !== socket.id) return;
      const room = await requestNetworkRoom("room:start");
      applyNetworkRoom(room);
      startNetworkMatch(room);
      return;
    }
    if (titleRoomMode === "join") {
      const code = elements.titleRoomCode.value.trim().toUpperCase();
      if (code.length < 4) {
        showToast("방 번호를 4자 이상 입력하세요.");
        elements.titleRoomCode.focus();
        return;
      }
      const room = await requestNetworkRoom("room:join", { code, name: runnerName });
      applyNetworkRoom(room);
      if (room.phase === "running") {
        startNetworkMatch(room);
        showToast("TEST 방 입장 완료 · 혼자서도 바로 테스트할 수 있어요.");
        return;
      }
      showToast(`${room.code} 방에 참가했습니다. 방장 시작을 기다리세요.`);
      return;
    }

    const inviteCode = elements.titleInviteCode.value.trim().toUpperCase();
    if (inviteCode.length < 4) {
      showToast("초대 코드를 4자 이상 입력하세요.");
      elements.titleInviteCode.focus();
      return;
    }
    const config = readRoomConfig();
    if (!config) return;
    const room = await requestNetworkRoom("room:create", { code: inviteCode, name: runnerName, config });
    applyNetworkRoom(room);
    showToast(`방 생성 완료 · 초대 코드 ${room.code}`);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "멀티플레이 방을 열지 못했습니다.");
  }
}

async function startNetworkRematch() {
  if (!activeNetworkRoom || activeNetworkRoom.phase !== "finished" || activeNetworkRoom.hostId !== socket.id) return;
  elements.resultRematch.disabled = true;
  elements.resultStatus.textContent = "출발선을 다시 준비하고 있습니다…";
  try {
    const room = await requestNetworkRoom("room:rematch");
    startNetworkMatch(room);
  } catch (error) {
    elements.resultRematch.disabled = activeNetworkRoom.players.length < 2;
    elements.resultStatus.textContent = error instanceof Error ? error.message : "재대결을 시작하지 못했습니다.";
  }
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await elements.game.requestFullscreen();
  } catch {
    showToast("이 브라우저에서는 전체 화면을 열지 못했어요.");
  }
}

document.addEventListener("fullscreenchange", () => {
  elements.fullscreen.textContent = document.fullscreenElement ? "전체 화면 종료" : "전체 화면";
});

function clearNetworkControlEffects(playerId: string) {
  for (let index = grappleEffects.length - 1; index >= 0; index -= 1) {
    const effect = grappleEffects[index];
    if (effect.sourceId === playerId || effect.targetId === playerId) grappleEffects.splice(index, 1);
  }
  for (let index = pushEffects.length - 1; index >= 0; index -= 1) {
    if (pushEffects[index].targetId === playerId) pushEffects.splice(index, 1);
  }
}

function applyNetworkHazardEffect(effect: HazardEffect) {
  if (!multiplayerActive) return;
  const now = performance.now();
  const isSelf = effect.playerId === socket.id;
  const remote = remotePlayers.get(effect.playerId);
  if (effect.kind === "pit") {
    clearNetworkControlEffects(effect.playerId);
    if (isSelf) {
      player.fallingStartedAt = now;
      player.fallingUntil = now + effect.duration;
      player.fallTargetX = effect.targetX;
      player.fallTargetY = effect.targetY;
      player.knockbackX = 0;
      player.knockbackY = 0;
      player.airUntil = 0;
      player.dashUntil = 0;
      networkSleepUntil = 0;
      networkSlowUntil = 0;
      runUntil = 0;
      grappleLockUntil = 0;
      pushLockUntil = 0;
      player.hitUntil = now + effect.duration;
      showToast("구덩이에 빨려 들어간다!");
    }
    if (remote) {
      remote.fallingStartedAt = now;
      remote.fallingUntil = now + effect.duration;
      remote.fallTargetX = effect.targetX;
      remote.fallTargetY = effect.targetY;
      remote.airUntil = 0;
      remote.sleepEffectUntil = 0;
      remote.slowEffectUntil = 0;
    }
    return;
  }
  if (effect.kind === "jump") {
    clearNetworkControlEffects(effect.playerId);
    pushEffects.push({
      sourceId: "hazard:jump",
      targetId: effect.playerId,
      startX: effect.startX,
      startY: effect.startY,
      endX: effect.endX,
      endY: effect.endY,
      duration: effect.duration,
      startedAt: now,
      until: now + effect.duration,
    });
    if (isSelf) {
      player.x = effect.endX;
      player.y = effect.endY;
      player.knockbackX = 0;
      player.knockbackY = 0;
      player.airStartedAt = now;
      player.airUntil = now + effect.duration;
      networkSleepUntil = 0;
      grappleLockUntil = 0;
      pushLockUntil = 0;
      player.hitUntil = now + effect.duration;
      showToast("점프대에 떠올라 뒤로 날아간다!");
    }
    if (remote) {
      remote.x = effect.endX;
      remote.y = effect.endY;
      remote.targetX = effect.endX;
      remote.targetY = effect.endY;
      remote.airStartedAt = now;
      remote.airUntil = now + effect.duration;
      remote.sleepEffectUntil = 0;
    }
    return;
  }
  clearNetworkControlEffects(effect.playerId);
  if (isSelf) {
    player.x = effect.x;
    player.y = effect.y;
    player.ammo = effect.ammo;
    player.fallingUntil = 0;
    player.airUntil = 0;
    player.knockbackX = 0;
    player.knockbackY = 0;
    player.dashUntil = 0;
    networkSleepUntil = 0;
    networkSlowUntil = 0;
    runUntil = 0;
    grappleLockUntil = 0;
    pushLockUntil = 0;
    player.hitUntil = now + 550;
    showToast("마지막 체크포인트에서 다시 달린다!");
  }
  if (remote) {
    remote.x = effect.x;
    remote.y = effect.y;
    remote.targetX = effect.x;
    remote.targetY = effect.y;
    remote.fallingUntil = 0;
    remote.airUntil = 0;
    remote.sleepEffectUntil = 0;
    remote.slowEffectUntil = 0;
  }
}

elements.titleKeyArt.addEventListener("error", () => {
  titleFallbackActive = true;
  elements.titleStage.classList.add("fallback-art");
  titleAnimationStartedAt = performance.now();
});
elements.openJoin.addEventListener("click", () => openTitleRoomPanel("join"));
elements.openCreate.addEventListener("click", () => openTitleRoomPanel("create"));
elements.titleConfirm.addEventListener("click", () => { void startFromTitleRoomPanel(); });
elements.titlePanelBack.addEventListener("click", closeTitleRoomPanel);
elements.titleRoomCode.addEventListener("keydown", (event) => { if (event.key === "Enter") void startFromTitleRoomPanel(); });
elements.titleInviteCode.addEventListener("keydown", (event) => { if (event.key === "Enter") void startFromTitleRoomPanel(); });
elements.back.addEventListener("click", returnToTitle);
elements.practice.addEventListener("click", togglePractice);
elements.fullscreen.addEventListener("click", () => { void toggleFullscreen(); });
elements.resultRematch.addEventListener("click", () => { void startNetworkRematch(); });
elements.resultToTitle.addEventListener("click", returnToTitle);

socket.on("room:state", (room: NetworkRoom) => applyNetworkRoom(room));
socket.on("match:started", (room: NetworkRoom) => startNetworkMatch(room));
socket.on("match:finished", (room: NetworkRoom) => applyNetworkRoom(room));
socket.on("hazard:warning", (hazards: NetworkHazards) => {
  syncNetworkHazards(hazards);
  showToast("구덩이 경고! 잠시 후 열린다.");
});
socket.on("hazard:state", (hazards: NetworkHazards) => {
  const warnedPitIndex = warningPitIndex;
  syncNetworkHazards(hazards);
  if (hazards.activePitIndex >= 0 && hazards.activePitIndex === warnedPitIndex) {
    pitOpenedAlertIndex = hazards.activePitIndex;
    pitOpenedAlertUntil = performance.now() + 1400;
    showToast("구덩이가 열렸다!");
  }
});
socket.on("hazard:effect", (effect: HazardEffect) => applyNetworkHazardEffect(effect));
socket.on("player:state", (runner: NetworkPlayer) => {
  if (!multiplayerActive || runner.id === socket.id) return;
  upsertRemotePlayer(runner);
});
socket.on("combat:shot", (shot: { sourceId: string; x: number; y: number; dx: number; dy: number }) => {
  if (!multiplayerActive || shot.sourceId === socket.id) return;
  projectiles.push({ kind: "bullet", owner: "remote", sourceId: shot.sourceId, x: shot.x, y: shot.y, velocityX: shot.dx * 430, velocityY: shot.dy * 430, until: performance.now() + 620, radius: 0 });
});
socket.on("combat:projectile", (projectile: { kind: "slow" | "sleep"; sourceId: string; x: number; y: number; velocityX: number; velocityY: number; lifetime: number }) => {
  if (!multiplayerActive || projectile.sourceId === socket.id) return;
  projectiles.push({
    kind: projectile.kind,
    owner: "remote",
    sourceId: projectile.sourceId,
    x: projectile.x,
    y: projectile.y,
    velocityX: projectile.velocityX,
    velocityY: projectile.velocityY,
    until: performance.now() + projectile.lifetime,
    radius: projectile.kind === "slow" ? 72 : 0,
    visualOnly: true,
  });
});
socket.on("combat:grapple", (grapple: Omit<GrappleEffect, "startedAt" | "until">) => {
  if (!multiplayerActive) return;
  const now = performance.now();
  if (grapple.targetId !== undefined) grappleEffects.splice(0, grappleEffects.length, ...grappleEffects.filter((effect) => effect.targetId !== grapple.targetId));
  grappleEffects.push({ ...grapple, startedAt: now, until: now + 520 });
  if (grapple.sourceId === socket.id || grapple.targetId === socket.id) grappleLockUntil = now + 520;
});
socket.on("combat:knockback", (knockback: Omit<PushEffect, "startedAt" | "until">) => {
  if (!multiplayerActive) return;
  const now = performance.now();
  pushEffects.splice(0, pushEffects.length, ...pushEffects.filter((effect) => effect.targetId !== knockback.targetId));
  pushEffects.push({ ...knockback, startedAt: now, until: now + knockback.duration });
  if (knockback.targetId === socket.id) {
    player.x = knockback.endX;
    player.y = knockback.endY;
    player.knockbackX = 0;
    player.knockbackY = 0;
    player.hitUntil = now + knockback.duration;
    pushLockUntil = now + knockback.duration;
    showToast("밀치기에 맞아 날아간다!");
  }
  const remote = remotePlayers.get(knockback.targetId);
  if (remote) {
    remote.x = knockback.endX;
    remote.y = knockback.endY;
    remote.targetX = knockback.endX;
    remote.targetY = knockback.endY;
  }
});
socket.on("combat:effect", (effect: { kind: "bullet" | SkillId; sourceId: string; targetIds: string[]; duration?: number; defeated?: boolean; x?: number; y?: number }) => {
  if (!multiplayerActive) return;
  const now = performance.now();
  if (effect.kind === "sleep" || effect.kind === "slow") {
    for (let index = projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = projectiles[index];
      if (projectile.kind === effect.kind && projectile.sourceId === effect.sourceId) projectiles.splice(index, 1);
    }
  }
  if (effect.kind === "slow" && Number.isFinite(effect.x) && Number.isFinite(effect.y)) {
    slowImpacts.push({ x: effect.x as number, y: effect.y as number, startedAt: now, until: now + 520 });
  }
  const hitMe = socket.id ? effect.targetIds.includes(socket.id) : false;
  if (hitMe && effect.kind === "sleep") networkSleepUntil = now + (effect.duration ?? 2000);
  if (hitMe && effect.kind === "slow") networkSlowUntil = now + (effect.duration ?? 3600);
  if (effect.kind === "sleep") {
    for (const targetId of effect.targetIds) {
      const target = remotePlayers.get(targetId);
      if (target) target.sleepEffectUntil = Math.max(target.sleepEffectUntil, now + (effect.duration ?? 2000));
    }
  }
  if (effect.kind === "slow") {
    for (const targetId of effect.targetIds) {
      const target = remotePlayers.get(targetId);
      if (target) target.slowEffectUntil = Math.max(target.slowEffectUntil, now + (effect.duration ?? 3600));
    }
  }
  if (effect.kind === "bullet" && effect.defeated) {
    for (const targetId of effect.targetIds) {
      clearNetworkControlEffects(targetId);
      const target = remotePlayers.get(targetId);
      if (target) {
        target.fallingUntil = 0;
        target.airUntil = 0;
        target.sleepEffectUntil = 0;
        target.slowEffectUntil = 0;
      }
    }
    if (hitMe) {
      player.fallingUntil = 0;
      player.airUntil = 0;
      player.dashUntil = 0;
      networkSleepUntil = 0;
      networkSlowUntil = 0;
      runUntil = 0;
      grappleLockUntil = 0;
      pushLockUntil = 0;
    }
  }
  if (effect.kind === "bullet" && hitMe) showToast(effect.defeated ? "처치당했습니다! 체크포인트에서 부활." : "총알에 맞았다!");
  if (effect.sourceId === socket.id && effect.targetIds.length > 0) showToast(`${skillLabels[effect.kind as SkillId] ?? "총알"} 명중!`);
});
socket.on("disconnect", () => {
  if (multiplayerActive) showToast("서버 연결이 끊겼습니다. 로비로 돌아가 다시 연결하세요.");
});

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
  if (!gameActive || (event.button !== 0 && event.button !== 2) || matchFinished) return;
  event.preventDefault();
  updateAimFromPointer(event);
  const now = performance.now();
  if (event.button === 0) {
    fireBasicShot(now);
  } else if (gameMode === "track") useSkill(equippedSkill, now);
  else useRandomSkill(now);
  elements.gameCanvas.focus();
});
elements.gameCanvas.addEventListener("contextmenu", (event) => event.preventDefault());
window.addEventListener("keydown", (event) => {
  const key = getControlKey(event);
  if (event.target instanceof HTMLInputElement) return;
  if (key === "escape" && gameActive) {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    returnToTitle();
    return;
  }
  const skillByKey: Record<string, SkillId | undefined> = { "1": "push", "2": "dash", "3": "run", "4": "grab", "5": "clone", "6": "slow", "7": "sleep" };
  if (gameActive && gameMode === "practice" && skillByKey[key]) {
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
window.addEventListener("keyup", (event) => pressedKeys.delete(getControlKey(event)));
window.addEventListener("blur", () => pressedKeys.clear());

requestAnimationFrame(animate);
