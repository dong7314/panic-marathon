import titleKeyArt from "./assets/title-keyart-pixel-v3.webp";
import { io, type Socket } from "socket.io-client";
import {
  CLONE_COOLDOWN,
  CLONE_DURATION,
  CLONE_LIMIT,
  DASH_RECHARGE_DURATION,
  FLY_VISUAL_LIFT,
  PLAYER_BASE_SPEED,
  RUN_DURATION,
  ROCK_SQUASH_DURATION,
  START_POINT,
  getSkillBodyScale,
  getMovementSpeedMultiplier,
  getSkillRenderLayer,
  isGiantBodyMovementBlocked,
  isObstacleImmune,
  isPassiveSkill,
  runnersOverlap,
  runnerTouchesObstacle,
  type SkillId,
} from "../shared/game-rules.mjs";
import {
  DEFAULT_MAP_ID,
  getMapDefinition,
  isMapId,
  type MapId,
} from "../shared/map-catalog.mjs";
import type { GeneratedMapHazards } from "../shared/map-hazards.mjs";
import { canStandOnMap } from "../shared/geometry.mjs";
import type { MusicThemeId } from "../shared/music-themes.mjs";
import {
  CLIENT_EVENTS,
  SERVER_EVENTS,
  type ClientToServerEvents,
  type NetworkCombatEffect,
  type NetworkGrapple,
  type NetworkKnockback,
  type NetworkProjectile,
  type NetworkRockRemoval,
  type NetworkShot,
  type NetworkTeleport,
  type RoomCreatePayload,
  type RoomJoinPayload,
  type ServerToClientEvents,
} from "../shared/network-protocol.mjs";
import { GameAudio } from "./game/audio";
import {
  drawCheckpoint,
  drawJumpPad,
  drawPit,
  drawSpinner,
} from "./game/hazard-renderer";
import { installInputController } from "./game/input-controller";
import { getMapPresentation } from "./game/map-content";
import { MatchCountdown } from "./game/match-countdown";
import {
  countConnectedPlayers,
  NetworkSessionStore,
  resolveMultiplayerEndpoint,
} from "./game/network-session";
import { drawPerson, fillRect } from "./game/pixel-renderer";
import { drawRollingRock, drawWorldProp } from "./game/world-prop-renderer";
import { drawWorldFloor } from "./game/world-renderer";
import type {
  AimState,
  Clone,
  Direction,
  GrappleEffect,
  HazardEffect,
  LabelledRunner,
  NetworkClone,
  NetworkChatMessage,
  NetworkHazards,
  NetworkPlayer,
  NetworkResponse,
  NetworkRock,
  NetworkRoom,
  NetworkSession,
  NetworkStanding,
  Pit,
  Player,
  Projectile,
  PropKind,
  PushEffect,
  RemotePlayer,
  RollingRock,
  RoomConfig,
  SlowImpact,
  Spinner,
  WorldProp,
} from "./game/types";
import "./style.css";

const VIEW_WIDTH = 384;
const VIEW_HEIGHT = 216;

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
            <p>방장이 공유한 초대 코드를 입력하세요.</p>
          </div>
          <div class="title-create-fields">
            <div class="title-config-grid"><label for="title-lap-count">목표 랩 <input id="title-lap-count" type="number" min="1" max="999" step="1" value="5" /></label><label for="title-player-count">인원 <input id="title-player-count" type="number" min="2" max="6" step="1" value="4" /></label></div>
            <label class="title-invite-field" for="title-invite-code">초대 코드
              <input id="title-invite-code" maxlength="12" value="PM-7F2A" autocomplete="off" />
            </label>
            <div class="title-map-field">
              <span class="title-map-label">맵 선택</span>
              <input id="title-map-id" type="hidden" value="schoolyard" />
              <details id="title-map-select" class="title-popover-select title-map-select">
                <summary aria-controls="title-map-options">
                  <span id="title-map-summary">말썽 운동장 · 안전 난간</span>
                </summary>
                <div id="title-map-options" class="title-map-options" role="radiogroup" aria-label="플레이할 맵">
                  <label><input type="radio" name="title-map" value="schoolyard" checked /><span>말썽 운동장 · 안전 난간</span></label>
                  <label><input type="radio" name="title-map" value="space-station" /><span>우주 정거장 · 트랙 이탈 시 추락</span></label>
                  <label><input type="radio" name="title-map" value="mountain-pass" /><span>우당탕 산맥 · 직선 오르막과 낙석</span></label>
                </div>
              </details>
            </div>
            <div class="title-skill-field">
              <span class="title-skill-label">사용 스킬 <b id="title-skill-count" aria-live="polite">10개 · 최소 3개</b></span>
              <details id="title-skill-select" class="title-popover-select title-skill-select">
                <summary aria-controls="title-skill-pool">
                  <span id="title-skill-summary">전체 스킬 · 10개</span>
                </summary>
                <div id="title-skill-pool" class="title-skill-options" role="group" aria-label="사용할 스킬">
                  <label><input type="checkbox" value="push" checked /><span>밀치기</span></label>
                  <label><input type="checkbox" value="dash" checked /><span>돌진</span></label>
                  <label><input type="checkbox" value="run" checked /><span>질주</span></label>
                  <label><input type="checkbox" value="grab" checked /><span>그랩</span></label>
                  <label><input type="checkbox" value="clone" checked /><span>분신</span></label>
                  <label><input type="checkbox" value="slow" checked /><span>슬로우탄</span></label>
                  <label><input type="checkbox" value="sleep" checked /><span>수면총</span></label>
                  <label><input type="checkbox" value="fly" checked /><span>공중부양</span></label>
                  <label><input type="checkbox" value="slow30" checked /><span>속도 30%</span></label>
                  <label><input type="checkbox" value="giant" checked /><span>5배 거대화</span></label>
                </div>
              </details>
            </div>
          </div>
          <div id="title-waiting-summary" class="title-waiting-summary hidden">
            <div class="title-waiting-status"><i aria-hidden="true"></i><strong id="title-waiting-status">참가자를 기다리는 중</strong></div>
            <div class="title-waiting-meta">
              <span><small>MAP</small><b id="title-waiting-map">-</b></span>
              <span><small>RACE</small><b id="title-waiting-rules">-</b></span>
            </div>
            <div class="title-waiting-roster-heading"><span>RUNNERS</span><b id="title-waiting-count">0/0</b></div>
            <div id="title-waiting-players" class="title-waiting-players"></div>
          </div>
          <div id="title-room-share" class="title-room-share hidden">
            <span>내 방 코드</span>
            <strong id="title-room-share-code">---</strong>
            <button id="title-copy-room-code" type="button">복사</button>
          </div>
          <div class="title-panel-actions"><button id="title-confirm-room" class="title-panel-confirm" type="button">방 참여</button><button id="title-panel-back" class="title-panel-back" type="button">뒤로</button></div>
        </section>
        <div class="title-caption">2–6 PLAYERS · RANDOM SKILLS · TOTAL MAYHEM</div>
      </div>
    </main>

    <main id="game-screen" class="game-screen hidden">
      <div class="game-stage">
        <div id="game-frame" class="game-frame">
          <canvas id="game-canvas" width="384" height="216" tabindex="0" aria-label="탑다운 픽셀 레이스 코스"></canvas>
          <div id="world-label-layer" class="world-label-layer" aria-hidden="true">
            <span id="player-skill-label" class="world-label player-skill-label hidden"></span>
          </div>
          <div class="scanlines" aria-hidden="true"></div>
          <div class="frame-actions">
            <button id="fullscreen-button" class="frame-button" type="button">전체 화면</button>
            <button id="audio-button" class="frame-button audio-button" type="button" aria-pressed="false">소리 ON</button>
          </div>
          <div id="race-board" class="race-board" aria-label="레이스 현황"></div>
          <section id="game-chat" class="game-chat is-empty" aria-label="방 채팅">
            <div id="game-chat-messages" class="game-chat-messages" role="log" aria-live="polite" aria-relevant="additions">
              <p class="game-chat-empty">아직 메시지가 없습니다 · ENTER로 채팅</p>
            </div>
            <form id="game-chat-form" class="game-chat-form">
              <label for="game-chat-input">CHAT</label>
              <input id="game-chat-input" maxlength="80" autocomplete="off" placeholder="Enter를 눌러 채팅" readonly aria-disabled="true" tabindex="-1" />
              <span id="game-chat-hint">ENTER 입력</span>
            </form>
          </section>
          <div class="message-box"><span class="key">WASD</span> 이동 · <span class="key">L-CLICK</span> 총 · <span class="key">R-CLICK</span> 현재 스킬 · <span class="key">ENTER</span> 채팅</div>
          <div id="skill-bar" class="skill-bar" aria-label="스킬 단축키"></div>
          <aside class="game-menu-actions">
            <button id="back-to-lobby" class="ghost-button">게임 나가기</button>
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
    <div id="match-countdown" class="match-countdown hidden" role="status" aria-live="assertive">
      <span id="match-countdown-value"></span>
    </div>
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
  titleWaitingSummary: getElement<HTMLElement>("#title-waiting-summary"),
  titleWaitingStatus: getElement<HTMLElement>("#title-waiting-status"),
  titleWaitingMap: getElement<HTMLElement>("#title-waiting-map"),
  titleWaitingRules: getElement<HTMLElement>("#title-waiting-rules"),
  titleWaitingCount: getElement<HTMLElement>("#title-waiting-count"),
  titleWaitingPlayers: getElement<HTMLElement>("#title-waiting-players"),
  titleRoomShare: getElement<HTMLElement>("#title-room-share"),
  titleRoomShareCode: getElement<HTMLElement>("#title-room-share-code"),
  titleCopyRoomCode: getElement<HTMLButtonElement>("#title-copy-room-code"),
  titleRoomCode: getElement<HTMLInputElement>("#title-room-code"),
  titleRunnerName: getElement<HTMLInputElement>("#title-runner-name"),
  titleLapCount: getElement<HTMLInputElement>("#title-lap-count"),
  titlePlayerCount: getElement<HTMLInputElement>("#title-player-count"),
  titleMapId: getElement<HTMLInputElement>("#title-map-id"),
  titleMapSelect: getElement<HTMLDetailsElement>("#title-map-select"),
  titleMapSummary: getElement<HTMLElement>("#title-map-summary"),
  titleMapOptions: getElement<HTMLElement>("#title-map-options"),
  titleInviteCode: getElement<HTMLInputElement>("#title-invite-code"),
  titleSkillCount: getElement<HTMLElement>("#title-skill-count"),
  titleSkillSelect: getElement<HTMLDetailsElement>("#title-skill-select"),
  titleSkillSummary: getElement<HTMLElement>("#title-skill-summary"),
  titleSkillPool: getElement<HTMLElement>("#title-skill-pool"),
  titleConfirm: getElement<HTMLButtonElement>("#title-confirm-room"),
  titlePanelBack: getElement<HTMLButtonElement>("#title-panel-back"),
  back: getElement<HTMLButtonElement>("#back-to-lobby"),
  gameCanvas: getElement<HTMLCanvasElement>("#game-canvas"),
  gameFrame: getElement<HTMLElement>("#game-frame"),
  worldLabelLayer: getElement<HTMLElement>("#world-label-layer"),
  playerSkillLabel: getElement<HTMLElement>("#player-skill-label"),
  fullscreen: getElement<HTMLButtonElement>("#fullscreen-button"),
  audio: getElement<HTMLButtonElement>("#audio-button"),
  raceBoard: getElement<HTMLElement>("#race-board"),
  skillBar: getElement<HTMLElement>("#skill-bar"),
  gameChat: getElement<HTMLElement>("#game-chat"),
  gameChatMessages: getElement<HTMLElement>("#game-chat-messages"),
  gameChatForm: getElement<HTMLFormElement>("#game-chat-form"),
  gameChatInput: getElement<HTMLInputElement>("#game-chat-input"),
  gameChatHint: getElement<HTMLElement>("#game-chat-hint"),
  results: getElement<HTMLElement>("#match-results"),
  resultTitle: getElement<HTMLElement>("#result-title"),
  resultSummary: getElement<HTMLElement>("#result-summary"),
  resultStandings: getElement<HTMLOListElement>("#result-standings"),
  resultRematch: getElement<HTMLButtonElement>("#result-rematch"),
  resultToTitle: getElement<HTMLButtonElement>("#result-to-title"),
  resultStatus: getElement<HTMLElement>("#result-status"),
  toast: getElement<HTMLElement>("#toast"),
  matchCountdown: getElement<HTMLElement>("#match-countdown"),
  matchCountdownValue: getElement<HTMLElement>("#match-countdown-value"),
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

let currentMap = getMapDefinition(DEFAULT_MAP_ID);
let mapPresentation = getMapPresentation(DEFAULT_MAP_ID);
let props: WorldProp[] = mapPresentation.props.map((prop) => ({ ...prop }));
let mapObstacles: WorldProp[] = [];
let spinners: Spinner[] = currentMap.spinners.map((spinner) => ({ ...spinner, angle: 0 }));
let pits: Pit[] = currentMap.pitZones.map((pit) => ({ ...pit, active: false }));
let jumpPads = currentMap.jumpPads;
let checkpoints = currentMap.checkpoints;
const rollingRocks: RollingRock[] = [];
const player: Player = { x: START_POINT.x, y: START_POINT.y, direction: "right", walking: 0, name: "말썽꾸러기", color: "#f16c7a", knockbackX: 0, knockbackY: 0, hitUntil: 0, flattenedUntil: 0, flattenedStartedAt: 0, fallingUntil: 0, fallingStartedAt: 0, fallTargetX: 0, fallTargetY: 0, airUntil: 0, airStartedAt: 0, dashUntil: 0, dashVelocityX: 0, dashVelocityY: 0, health: 5, ammo: 3, shotReadyAt: 0 };
type RunnerWorldLabelGroup = { container: HTMLDivElement; name: HTMLSpanElement; skill: HTMLSpanElement };
const runnerWorldLabels = new Map<string, RunnerWorldLabelGroup>();
const remotePlayers = new Map<string, RemotePlayer>();
const multiplayerEndpoint = resolveMultiplayerEndpoint(
  window.location,
  import.meta.env.VITE_MULTIPLAYER_URL,
  import.meta.env.DEV,
);
const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(multiplayerEndpoint, { autoConnect: false });
const networkSessionStore = new NetworkSessionStore(window.sessionStorage);
let activeNetworkSession = networkSessionStore.current;
let activeNetworkRoom: NetworkRoom | undefined;
let activeNetworkRound = 0;
let multiplayerActive = false;
let networkResumeInFlight = false;
let lastNetworkStateAt = 0;
let networkSleepUntil = 0;
let networkSlowUntil = 0;
let grappleLockUntil = 0;
let pushLockUntil = 0;
let networkSpinnerElapsedAtSync = 0;
let networkSpinnerSyncedAt = 0;
let networkChatMessages: NetworkChatMessage[] = [];
let chatMessageSignature = "";
const matchCountdown = new MatchCountdown();
const clones: Clone[] = [];
const projectiles: Projectile[] = [];
const grappleEffects: GrappleEffect[] = [];
const pushEffects: PushEffect[] = [];
const slowImpacts: SlowImpact[] = [];
const skillReadyAt: Record<SkillId, number> = { push: 0, dash: 0, run: 0, grab: 0, clone: 0, slow: 0, sleep: 0, fly: 0, slow30: 0, giant: 0 };
const skillLabels: Record<SkillId, string> = { push: "밀치기", dash: "돌진", run: "질주", grab: "그랩", clone: "분신", slow: "슬로우탄", sleep: "수면총", fly: "공중부양", slow30: "속도 30%", giant: "5배 거대화" };
let dashCharges = 3;
let dashRechargeAt = 0;
let runUntil = 0;
let roomConfig: RoomConfig = { lapLimit: 5, playerCount: 4, mapId: DEFAULT_MAP_ID, enabledSkills: ["push", "dash", "run", "grab", "clone", "slow", "sleep", "fly", "slow30", "giant"] };
let equippedSkill: SkillId = "push";
let matchFinished = false;
const audio = new GameAudio();
function setMusicTheme(theme: MusicThemeId) {
  audio.setMusicTheme(theme);
  document.documentElement.dataset.musicTheme = theme;
}
setMusicTheme("lobby");

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
let nextPitAt = 0;
let jumpPadCooldownUntil = 0;
let startArmed = false;
const aim: AimState = { screenX: VIEW_WIDTH / 2, screenY: VIEW_HEIGHT / 2, worldX: 0, worldY: 0, visible: false, pulseUntil: 0, pulseX: 0, pulseY: 0 };
let skillBarSignature = "";
let raceBoardSignature = "";

function applyHazardLayout(layout: GeneratedMapHazards) {
  spinners = layout.spinners.map((spinner) => ({ ...spinner, angle: 0 }));
  pits = layout.pitZones.map((pit) => ({ ...pit, active: false }));
  activePitIndex = -1;
  warningPitIndex = -1;
  pitOpenAt = 0;
}

function applyMapDefinition(mapId: MapId) {
  if (currentMap.id === mapId && pits.length === currentMap.pitZones.length) return;
  currentMap = getMapDefinition(mapId);
  mapPresentation = getMapPresentation(currentMap.id);
  mapObstacles = [];
  props = [
    ...mapPresentation.props.map((prop) => ({ ...prop })),
    ...currentMap.rockBarriers.map((barrier) => ({ ...barrier, kind: "rockwall" as const, solid: true })),
  ];
  spinners = currentMap.spinners.map((spinner) => ({ ...spinner, angle: 0 }));
  pits = currentMap.pitZones.map((pit) => ({ ...pit, active: false }));
  jumpPads = currentMap.jumpPads;
  checkpoints = currentMap.checkpoints;
  rollingRocks.length = 0;
  activePitIndex = -1;
  warningPitIndex = -1;
  pitOpenAt = 0;
  jumpPadCooldownUntil = 0;
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
  if (isPassiveSkill(skill)) return { text: `${name} AUTO`, charging: false };
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
  let labels = runnerWorldLabels.get(runner.id);
  if (!labels) {
    const container = document.createElement("div");
    const name = document.createElement("span");
    const skill = document.createElement("span");
    container.className = "world-label-stack";
    name.className = "world-label runner-name-label";
    skill.className = "world-label runner-skill-label";
    container.append(name, skill);
    elements.worldLabelLayer.append(container);
    labels = { container, name, skill };
    runnerWorldLabels.set(runner.id, labels);
  }
  labels.name.textContent = runner.name;
  const status = "skillCooldownUntil" in runner
    ? { cooldownUntil: runner.skillCooldownUntil, cloneCount: multiplayerActive ? clones.filter((clone) => clone.ownerId === runner.id).length : runner.cloneCount, dashCharges: runner.dashCharges, dashRechargeUntil: runner.dashRechargeUntil }
    : {};
  renderSkillLabel(labels.skill, runner.skill, status, performance.now());
  placeWorldLabel(labels.container, left, y);
}

function removeRunnerLabels(id: string) {
  const labels = runnerWorldLabels.get(id);
  if (!labels) return;
  labels.container.remove();
  runnerWorldLabels.delete(id);
}

function resetWorldLabels() {
  elements.playerSkillLabel.classList.add("hidden");
  for (const labels of runnerWorldLabels.values()) labels.container.remove();
  runnerWorldLabels.clear();
}

function getOwnedCloneCount() {
  const playerId = getLocalNetworkPlayerId();
  return multiplayerActive ? clones.filter((clone) => clone.ownerId === playerId).length : clones.length;
}

function getGrappledPosition(id: string | undefined, fallbackX: number, fallbackY: number, now: number) {
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

function getPushedPosition(id: string | undefined, fallbackX: number, fallbackY: number, now: number) {
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
  const drift = Math.floor(time / 180) % 2;
  context.fillStyle = "#e5b8f4";
  context.font = "bold 7px monospace";
  context.fillText("Z", Math.round(x - 17), Math.round(y - 8 - drift));
  context.font = "bold 5px monospace";
  context.fillText("z", Math.round(x - 11), Math.round(y - 13 + drift));
}

function getFlightLift(skill: SkillId, time: number) {
  return skill === "fly" ? FLY_VISUAL_LIFT + Math.sin(time / 180) * 2 : 0;
}

function drawFlightEffect(context: CanvasRenderingContext2D, x: number, y: number, time: number) {
  const flap = Math.floor(time / 120) % 2;
  fillRect(context, "rgba(38,31,54,.3)", x - 9, y + 25, 18, 3);
  fillRect(context, "#dffcff", x - 12, y + 1 + flap, 5, 3);
  fillRect(context, "#79dfee", x - 14, y + 3 + flap, 6, 2);
  fillRect(context, "#dffcff", x + 7, y + 1 + flap, 5, 3);
  fillRect(context, "#79dfee", x + 8, y + 3 + flap, 6, 2);
}

function drawSkillScaledPerson(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: Direction,
  walking: number,
  color: string,
  skill: SkillId,
  npc = false,
  sleeping = false,
) {
  const scale = getSkillBodyScale(skill);
  if (scale === 1) {
    drawPerson(context, x, y, direction, walking, color, npc, sleeping);
    return;
  }
  context.save();
  context.translate(Math.round(x), Math.round(y));
  context.scale(scale, scale);
  drawPerson(context, 0, 0, direction, walking, color, npc, sleeping);
  context.restore();
}

function getSkillStatusY(y: number, skill: SkillId) {
  return y - (8 * getSkillBodyScale(skill) + 6);
}

function drawRockSquashedPerson(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: Direction,
  walking: number,
  color: string,
  skill: SkillId,
  startedAt: number,
  time: number,
  npc = false,
) {
  const progress = Math.max(0, Math.min(1, (time - startedAt) / ROCK_SQUASH_DURATION));
  const compression = Math.sin(Math.min(1, progress / .32) * Math.PI / 2);
  const scaleX = 1 + compression * .58;
  const scaleY = 1 - compression * .73;
  fillRect(context, "rgba(38,31,54,.34)", x - 12, y + 10, 24, 3);
  if (progress < .55) {
    const dustOffset = Math.round(progress * 7);
    fillRect(context, "#cbb88f", x - 11 - dustOffset, y + 7, 3, 2);
    fillRect(context, "#e3d0a4", x + 9 + dustOffset, y + 6, 3, 2);
  }
  context.save();
  context.translate(Math.round(x), Math.round(y + compression * 9));
  context.scale(scaleX, scaleY);
  drawSkillScaledPerson(context, 0, 0, direction, walking, color, skill, npc);
  context.restore();
}

function drawPlayer(context: CanvasRenderingContext2D, cameraX: number, cameraY: number, time: number) {
  const playerId = getLocalNetworkPlayerId();
  const grappledPosition = getGrappledPosition(playerId, player.x, player.y, time);
  const position = getPushedPosition(playerId, grappledPosition.x, grappledPosition.y, time);
  const baseX = position.x - cameraX;
  const baseY = position.y - cameraY;
  if (player.flattenedUntil > time) {
    elements.playerSkillLabel.classList.add("hidden");
    drawRockSquashedPerson(
      context,
      baseX,
      baseY,
      player.direction,
      player.walking,
      player.color,
      equippedSkill,
      player.flattenedStartedAt,
      time,
    );
    return;
  }
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
  const jumpLift = airProgress > 0 ? Math.sin(airProgress * Math.PI) * 18 : 0;
  const flightLift = getFlightLift(equippedSkill, time);
  const lift = Math.max(jumpLift, flightLift);
  const drawY = baseY - lift;
  const sleeping = networkSleepUntil > time;
  if (flightLift > 0) drawFlightEffect(context, baseX, drawY, time);
  else if (lift > 0) fillRect(context, "rgba(38,31,54,.3)", baseX - 8, baseY + 10, 16, 3);
  drawSkillScaledPerson(context, baseX, drawY, player.direction, player.walking, player.color, equippedSkill, false, sleeping);
  drawSlowStatus(context, baseX, drawY, time, networkSlowUntil);
  drawSleepStatus(context, baseX, drawY, time, networkSleepUntil);
  const statusLeft = Math.round(baseX - 12);
  const statusY = getSkillStatusY(drawY, equippedSkill);
  drawHealthPips(context, statusLeft, statusY, player.health);
  drawAmmoPips(context, statusLeft, statusY - 7, player.ammo);
  updatePlayerSkillLabel(statusLeft, statusY - 7);
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

function blockedByGiantRunner(x: number, y: number) {
  if (!multiplayerActive) return false;
  for (const runner of remotePlayers.values()) {
    if (!runner.connected) continue;
    if (isGiantBodyMovementBlocked(
      equippedSkill,
      player.x,
      player.y,
      x,
      y,
      runner.skill,
      runner.targetX,
      runner.targetY,
    )) return true;
  }
  return false;
}

function canStandAt(x: number, y: number) {
  if (x - 5 < 0 || x + 5 > currentMap.worldWidth || y - 5 < 0 || y + 7 > currentMap.worldHeight) return false;
  if (currentMap.trackBoundary !== "fall" && !canStandOnMap(currentMap, x, y)) return false;
  if (blockedByGiantRunner(x, y)) return false;
  if (isObstacleImmune(equippedSkill)) return true;
  return ![...props, ...mapObstacles].some((prop) => prop.solid && runnerTouchesObstacle(x, y, prop))
    && !clones.some((clone) => runnersOverlap(x, y, clone.x, clone.y));
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

function isLocalActionLocked(now: number) {
  if (player.fallingUntil > 0 || player.flattenedUntil > 0 || player.airUntil > now) return true;
  if (grappleLockUntil > now || pushLockUntil > now) return true;
  if (multiplayerActive && (!socket.connected || networkResumeInFlight)) return true;
  return multiplayerActive && networkSleepUntil > now;
}

function canUseSkill(id: SkillId, now: number) {
  if (!multiplayerActive || matchFinished || isLocalActionLocked(now)) return false;
  if (isPassiveSkill(id)) return false;
  if (id === "dash") return dashCharges > 0 && now >= skillReadyAt.dash;
  if (id === "clone") return getOwnedCloneCount() < CLONE_LIMIT && now >= skillReadyAt.clone;
  return now >= skillReadyAt[id];
}

function useSkill(id: SkillId, now = performance.now()) {
  if (!canUseSkill(id, now)) return false;
  audio.play("skill");
  const aimVector = getAimVector();

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
    projectiles.push({ kind: "slow", owner: "player", sourceId: getLocalNetworkPlayerId(), visualOnly: true, x: player.x, y: player.y - 2, velocityX: aimVector.x * 265, velocityY: aimVector.y * 265, until: now + 760, radius: 72 });
  } else {
    skillReadyAt.sleep = now + 2000;
    projectiles.push({ kind: "sleep", owner: "player", sourceId: getLocalNetworkPlayerId(), visualOnly: true, x: player.x, y: player.y - 2, velocityX: aimVector.x * 345, velocityY: aimVector.y * 345, until: now + 680, radius: 0 });
  }
  aim.pulseX = player.x;
  aim.pulseY = player.y;
  aim.pulseUntil = now + 220;
  socket.emit(CLIENT_EVENTS.combatSkill, { skill: id, dx: aimVector.x, dy: aimVector.y });
  showToast(`${skillLabels[id]} 사용!`);
  return true;
}

function refillPlayerAmmo() {
  player.ammo = 3;
}

function fireBasicShot(now: number) {
  if (now < player.shotReadyAt || matchFinished || isLocalActionLocked(now)) return;
  if (player.ammo <= 0) {
    audio.play("empty");
    showToast("총알을 다 썼다! 구덩이 또는 체크포인트 복귀 시 회복.");
    player.shotReadyAt = now + 220;
    return;
  }
  const aimVector = getAimVector();
  audio.play("shoot");
  player.ammo -= 1;
  player.shotReadyAt = now + 210;
  projectiles.push({ kind: "bullet", owner: "player", x: player.x + aimVector.x * 8, y: player.y + aimVector.y * 2, velocityX: aimVector.x * 430, velocityY: aimVector.y * 430, until: now + 620, radius: 0 });
  if (multiplayerActive) socket.emit(CLIENT_EVENTS.combatShoot, { dx: aimVector.x, dy: aimVector.y });
}

function updateProjectiles(now: number, dt: number) {
  for (let index = projectiles.length - 1; index >= 0; index -= 1) {
    const projectile = projectiles[index];
    projectile.x += projectile.velocityX * dt;
    projectile.y += projectile.velocityY * dt;
    const outside = projectile.x < 0 || projectile.x > currentMap.worldWidth || projectile.y < 0 || projectile.y > currentMap.worldHeight;
    if (now >= projectile.until || outside) projectiles.splice(index, 1);
  }
}

function finishMatch(winner: string, reason: "completed" | "time-limit" = "completed") {
  if (matchFinished) return;
  matchFinished = true;
  audio.play("finish");
  pressedKeys.clear();
  closeGameChat(false);
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

function isGameChatOpen() {
  return elements.gameChat.classList.contains("is-open");
}

function renderGameChat() {
  const visibleMessages = networkChatMessages.slice(-6);
  const signature = visibleMessages.map((message) => message.id).join("|");
  if (signature === chatMessageSignature) return;
  chatMessageSignature = signature;
  elements.gameChatMessages.replaceChildren();
  if (visibleMessages.length === 0) {
    const empty = document.createElement("p");
    empty.className = "game-chat-empty";
    empty.textContent = "아직 메시지가 없습니다 · ENTER로 채팅";
    elements.gameChatMessages.append(empty);
  }
  for (const message of visibleMessages) {
    const row = document.createElement("p");
    row.className = "game-chat-message";
    if (message.playerId === getLocalNetworkPlayerId()) row.classList.add("me");
    const name = document.createElement("strong");
    name.textContent = message.name;
    name.style.color = message.color;
    const text = document.createElement("span");
    text.textContent = message.text;
    row.append(name, text);
    elements.gameChatMessages.append(row);
  }
  elements.gameChat.classList.toggle("is-empty", visibleMessages.length === 0);
  elements.gameChatMessages.scrollTop = elements.gameChatMessages.scrollHeight;
}

function syncGameChat(messages: NetworkChatMessage[] = []) {
  networkChatMessages = messages.slice(-30);
  renderGameChat();
}

function receiveGameChatMessage(message: NetworkChatMessage) {
  if (!multiplayerActive || !gameActive || activeNetworkRoom?.phase !== "running") return;
  if (networkChatMessages.some((current) => current.id === message.id)) return;
  networkChatMessages.push(message);
  if (networkChatMessages.length > 30) networkChatMessages.splice(0, networkChatMessages.length - 30);
  renderGameChat();
}

function closeGameChat(focusCanvas = true) {
  elements.gameChat.classList.remove("is-open");
  elements.gameChatInput.value = "";
  elements.gameChatInput.readOnly = true;
  elements.gameChatInput.tabIndex = -1;
  elements.gameChatInput.placeholder = "Enter를 눌러 채팅";
  elements.gameChatInput.setAttribute("aria-disabled", "true");
  elements.gameChatHint.textContent = "ENTER 입력";
  if (focusCanvas && gameActive) elements.gameCanvas.focus();
}

function openGameChat() {
  if (!multiplayerActive || !gameActive || matchFinished || activeNetworkRoom?.phase !== "running") return;
  pressedKeys.clear();
  elements.gameChat.classList.add("is-open");
  elements.gameChatInput.readOnly = false;
  elements.gameChatInput.tabIndex = 0;
  elements.gameChatInput.placeholder = "메시지를 입력하세요";
  elements.gameChatInput.removeAttribute("aria-disabled");
  elements.gameChatHint.textContent = "ENTER 전송 · ESC 닫기";
  window.setTimeout(() => elements.gameChatInput.focus(), 0);
}

function sendGameChat() {
  if (!isGameChatOpen()) return;
  const text = elements.gameChatInput.value.trim();
  if (text) socket.emit(CLIENT_EVENTS.chatSend, { text });
  closeGameChat();
}

function formatStandingStats(standing: NetworkStanding) {
  const stats = standing.stats;
  const falls = stats.pitFalls + stats.voidFalls;
  return [
    ["명중", `${stats.shotsHit}/${stats.shotsFired}`],
    ["처치", stats.eliminations],
    ["밀침", stats.pushHits],
    ["그랩", stats.grabHits],
    ["수면", stats.sleepHits],
    ["감속", stats.slowHits],
    ["분신", stats.clonesCreated],
    ["낙하", falls],
  ].map(([label, value]) => `<span><b>${label}</b>${value}</span>`).join("");
}

function showNetworkResults(room: NetworkRoom) {
  const result = room.result;
  if (!result || result.standings.length === 0) {
    hideMatchResults();
    return;
  }
  const winner = result.standings[0];
  const playerId = getLocalNetworkPlayerId();
  const isHost = room.hostId === playerId;
  const connectedPlayers = countConnectedPlayers(room);
  const wasHidden = elements.results.classList.contains("hidden");
  if (wasHidden) audio.play("finish");
  elements.resultTitle.textContent = result.reason === "time-limit" ? `${winner.name} 시간 제한 1위!` : `${winner.name} 우승!`;
  elements.resultSummary.textContent = `${getMapDefinition(room.config.mapId).name} · ${room.config.lapLimit}랩 · ${formatRaceDuration(result.durationMs)} · ${room.code}`;
  elements.resultStandings.innerHTML = result.standings.map((standing) => {
    const checkpoint = standing.checkpoint < checkpoints.length ? `CP${standing.checkpoint + 1}` : "START";
    const progress = standing.completed ? "완주" : `${standing.lap}/${room.config.lapLimit} · ${checkpoint}`;
    return `<li class="result-row${standing.id === playerId ? " me" : ""}">
      <span class="result-place">${standing.place}</span>
      <i class="race-dot" style="background:${standing.color}"></i>
      <span class="result-runner">
        <strong class="result-name">${escapeMarkup(standing.name)}</strong>
        <em class="result-title">《 ${escapeMarkup(standing.title)} 》</em>
      </span>
      <span class="result-progress">${progress}</span>
      <span class="result-stats">${formatStandingStats(standing)}</span>
    </li>`;
  }).join("");
  elements.resultRematch.classList.toggle("hidden", !isHost);
  elements.resultRematch.disabled = connectedPlayers < 2;
  elements.resultStatus.textContent = isHost
    ? connectedPlayers < 2 ? "재대결에는 연결된 플레이어가 최소 2명 필요합니다." : "방장이 재대결을 시작하면 모든 러너가 같은 방에서 다시 출발합니다."
    : "방장이 재대결을 시작하기를 기다리거나 메인 화면으로 돌아갈 수 있습니다.";
  elements.results.classList.remove("hidden");
  if (wasHidden) window.setTimeout(() => (isHost && connectedPlayers >= 2 ? elements.resultRematch : elements.resultToTitle).focus(), 0);
}

function respawnAtCheckpoint(message: string, now: number) {
  const safeSpot = currentMap.respawnPoints[Math.min(checkpointIndex, currentMap.respawnPoints.length - 1)];
  player.x = safeSpot.x;
  player.y = safeSpot.y;
  player.knockbackX = 0;
  player.knockbackY = 0;
  player.fallingUntil = 0;
  player.fallKind = undefined;
  player.airUntil = 0;
  player.flattenedUntil = 0;
  player.flattenedStartedAt = 0;
  player.hitUntil = now + 550;
  refillPlayerAmmo();
  showToast(message);
}

function updateHazards(now: number, dt: number) {
  for (let index = rollingRocks.length - 1; index >= 0; index -= 1) {
    const rock = rollingRocks[index];
    if (now >= rock.until) {
      rollingRocks.splice(index, 1);
      continue;
    }
    rock.x += rock.velocityX * dt;
    rock.y += rock.velocityY * dt;
    rock.angle += Math.hypot(rock.velocityX, rock.velocityY) * dt / Math.max(1, rock.radius);
  }
  const spinnerElapsed = (networkSpinnerElapsedAtSync + Math.max(0, now - networkSpinnerSyncedAt)) / 1000;
  for (const spinner of spinners) spinner.angle = spinner.speed * spinnerElapsed;
}

function updatePlayer(dt: number, now: number) {
  if (player.fallingUntil > 0) {
    if (now < player.fallingUntil) return;
    if (multiplayerActive) return;
    const fellIntoVoid = player.fallKind === "void";
    if (fellIntoVoid) player.health = 5;
    respawnAtCheckpoint(
      fellIntoVoid ? "우주 구조대가 마지막 체크포인트로 복귀시켰다!" : "마지막 체크포인트에서 다시 달린다!",
      now,
    );
    return;
  }
  if (player.flattenedUntil > 0) return;
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
    const movementMultiplier = getMovementSpeedMultiplier(
      equippedSkill,
      multiplayerActive && networkSlowUntil > now,
      runUntil > now,
    ) * currentMap.movementSpeedMultiplier;
    movePlayer(horizontal * PLAYER_BASE_SPEED * movementMultiplier * dt, vertical * PLAYER_BASE_SPEED * movementMultiplier * dt);
    player.walking += dt * 12 * movementMultiplier;
  }

  if (Math.abs(player.knockbackX) > 2 || Math.abs(player.knockbackY) > 2) {
    movePlayer(player.knockbackX * dt, player.knockbackY * dt);
    player.knockbackX *= Math.pow(.015, dt);
    player.knockbackY *= Math.pow(.015, dt);
    player.walking += dt * 14;
  }
}

function getCamera() {
  const playerId = getLocalNetworkPlayerId();
  const grappledPosition = getGrappledPosition(
    playerId,
    player.x,
    player.y,
    performance.now(),
  );
  const position = getPushedPosition(playerId, grappledPosition.x, grappledPosition.y, performance.now());
  const worldWidth = currentMap.worldWidth;
  const worldHeight = currentMap.worldHeight;
  return {
    x: Math.max(0, Math.min(worldWidth - VIEW_WIDTH, position.x - VIEW_WIDTH / 2)),
    y: Math.max(0, Math.min(worldHeight - VIEW_HEIGHT, position.y - VIEW_HEIGHT / 2)),
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

function drawRemotePlayer(context: CanvasRenderingContext2D, runner: RemotePlayer, cameraX: number, cameraY: number, time: number) {
  if (!runner.connected) {
    removeRunnerLabels(runner.id);
    return;
  }
  const grappledPosition = getGrappledPosition(runner.id, runner.x, runner.y, time);
  const position = getPushedPosition(runner.id, grappledPosition.x, grappledPosition.y, time);
  const baseX = position.x - cameraX;
  const baseY = position.y - cameraY;
  if (runner.flattenedUntil > time) {
    removeRunnerLabels(runner.id);
    drawRockSquashedPerson(
      context,
      baseX,
      baseY,
      runner.direction,
      runner.walking,
      runner.color,
      runner.skill,
      runner.flattenedStartedAt,
      time,
      true,
    );
    return;
  }
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
  const jumpLift = airProgress > 0 ? Math.sin(airProgress * Math.PI) * 18 : 0;
  const flightLift = getFlightLift(runner.skill, time);
  const lift = Math.max(jumpLift, flightLift);
  const x = baseX;
  const y = baseY - lift;
  const sleeping = runner.sleepEffectUntil > time;
  if (flightLift > 0) drawFlightEffect(context, x, y, time);
  else if (lift > 0) fillRect(context, "rgba(38,31,54,.3)", baseX - 8, baseY + 10, 16, 3);
  drawSkillScaledPerson(context, x, y, runner.direction, runner.walking, runner.color, runner.skill, true, sleeping);
  drawSlowStatus(context, x, y, time, runner.slowEffectUntil);
  drawSleepStatus(context, x, y, time, runner.sleepEffectUntil);
  const statusLeft = Math.round(x - 12);
  const statusY = getSkillStatusY(y, runner.skill);
  drawHealthPips(context, statusLeft, statusY, runner.health);
  updateRunnerLabels(runner, statusLeft, statusY);
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
  elements.raceBoard.classList.remove("hidden");
  const finishLabel = currentMap.courseType === "linear" ? "TOP" : "START";
  const playerCheckpoint = lap >= roomConfig.lapLimit ? "FIN" : checkpointIndex < checkpoints.length ? `CP${checkpointIndex + 1}` : finishLabel;
  const otherRunners = [...remotePlayers.values()].map((runner) => ({
    id: runner.id,
    name: runner.connected ? runner.name : `${runner.name} · REJOIN`,
    color: runner.color,
    lap: runner.lap,
    checkpoint: runner.checkpoint,
    label: runner.lap >= roomConfig.lapLimit ? "FIN" : runner.checkpoint < checkpoints.length ? `CP${runner.checkpoint + 1}` : finishLabel,
    me: false,
  }));
  const runners = [
    { id: "local", name: player.name, color: player.color, lap, checkpoint: checkpointIndex, label: playerCheckpoint, me: true },
    ...otherRunners,
  ].sort((a, b) => b.lap * 4 + b.checkpoint - (a.lap * 4 + a.checkpoint));
  const markup = `<div class="race-title"><span>RACE BOARD</span><span>${runners.length}P</span></div>${runners.map((runner, index) => `<div class="race-row${runner.me ? " me" : ""}"><span>${index + 1}</span><i class="race-dot" style="background:${runner.color}"></i><span class="race-name">${escapeMarkup(runner.name)}</span><span class="race-progress">${Math.min(runner.lap, roomConfig.lapLimit)}/${roomConfig.lapLimit}</span><span class="race-cp">${runner.label}</span></div>`).join("")}`;
  if (markup !== raceBoardSignature) {
    raceBoardSignature = markup;
    elements.raceBoard.innerHTML = markup;
  }
}

function drawTown(context: CanvasRenderingContext2D, time: number) {
  const camera = getCamera();
  const cameraX = camera.x;
  const cameraY = camera.y;
  context.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  drawWorldFloor(context, cameraX, cameraY, currentMap, VIEW_WIDTH, VIEW_HEIGHT);

  for (const pit of pits) drawPit(context, pit, cameraX, cameraY, time);
  for (const pad of jumpPads) drawJumpPad(context, pad, cameraX, cameraY);
  checkpoints.forEach((checkpoint, index) => drawCheckpoint(context, checkpoint, cameraX, cameraY, checkpointIndex === index, `${index + 1}`));
  for (const spinner of spinners) drawSpinner(context, spinner, cameraX, cameraY);
  for (const rock of rollingRocks) drawRollingRock(context, rock, cameraX, cameraY);

  const draws = [...props, ...mapObstacles].sort((a, b) => a.y + a.height - (b.y + b.height));
  const playerRenderLayer = getSkillRenderLayer(equippedSkill);
  let playerDrawn = false;
  for (const prop of draws) {
    if (playerRenderLayer === 0 && !playerDrawn && player.y + 12 < prop.y + prop.height) {
      drawPlayer(context, cameraX, cameraY, time);
      playerDrawn = true;
    }
    drawWorldProp(context, prop, cameraX, cameraY);
  }
  if (playerRenderLayer === 0 && !playerDrawn) drawPlayer(context, cameraX, cameraY, time);

  for (const runner of remotePlayers.values()) {
    if (getSkillRenderLayer(runner.skill) === 0) drawRemotePlayer(context, runner, cameraX, cameraY, time);
  }
  for (const clone of clones) drawClone(context, clone, cameraX, cameraY, time);
  for (const projectile of projectiles) drawProjectile(context, projectile, cameraX, cameraY);
  drawSlowImpacts(context, cameraX, cameraY, time);
  drawGrappleEffects(context, cameraX, cameraY, time);

  for (const renderLayer of [1, 2] as const) {
    if (playerRenderLayer === renderLayer) drawPlayer(context, cameraX, cameraY, time);
    for (const runner of remotePlayers.values()) {
      if (getSkillRenderLayer(runner.skill) === renderLayer) drawRemotePlayer(context, runner, cameraX, cameraY, time);
    }
  }
  drawAimGuide(context, cameraX, cameraY, time);

  fillRect(context, "rgba(34,26,57,.22)", 0, 0, VIEW_WIDTH, 3);
  fillRect(context, "rgba(34,26,57,.22)", 0, VIEW_HEIGHT - 3, VIEW_WIDTH, 3);
}

function animate(now: number) {
  const dt = Math.min(.05, (now - lastFrame) / 1000);
  lastFrame = now;
  updateMatchCountdown(now);
  if (titleFallbackActive) drawTitlePreview(now);
  if (gameActive) {
    if (!matchFinished) {
      updateHazards(now, dt);
      updatePlayer(dt, now);
      updateProjectiles(now, dt);
      interpolateRemotePlayers(dt);
      sendLocalNetworkState(now);
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

function storeNetworkSession(session: NetworkSession) {
  activeNetworkSession = networkSessionStore.save(session);
}

function clearNetworkSession() {
  activeNetworkSession = undefined;
  networkSessionStore.clear();
}

function getLocalNetworkPlayerId() {
  return activeNetworkSession?.playerId;
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
  });
}

function syncNetworkHazardLayout(room: NetworkRoom) {
  applyHazardLayout({
    pitZones: room.pitZones ?? [],
    spinners: room.spinners ?? [],
  });
}

function syncRemotePlayers(room: NetworkRoom) {
  const present = new Set<string>();
  const playerId = getLocalNetworkPlayerId();
  for (const runner of room.players) {
    if (runner.id === playerId) continue;
    present.add(runner.id);
    upsertRemotePlayer(runner);
  }
  for (const id of remotePlayers.keys()) {
    if (present.has(id)) continue;
    remotePlayers.delete(id);
    removeRunnerLabels(id);
  }
}

function syncRemoteHazardState(current: RemotePlayer, runner: NetworkPlayer, receivedAt: number) {
  const flattenedMs = Math.max(0, runner.flattenedMs ?? 0);
  if (runner.actionState === "flattened" || flattenedMs > 0) {
    current.flattenedStartedAt = receivedAt - Math.max(0, runner.flattenedElapsedMs ?? 0);
    current.flattenedUntil = receivedAt + Math.max(1, flattenedMs);
  } else {
    current.flattenedStartedAt = 0;
    current.flattenedUntil = 0;
  }
  const fallingMs = Math.max(0, runner.fallingMs ?? 0);
  if (fallingMs > 0) {
    current.fallingStartedAt = receivedAt - Math.max(0, runner.fallingElapsedMs ?? 0);
    current.fallingUntil = receivedAt + fallingMs;
    current.fallTargetX = runner.fallTargetX ?? runner.x;
    current.fallTargetY = runner.fallTargetY ?? runner.y;
    current.fallKind = runner.fallKind;
  } else {
    current.fallingStartedAt = 0;
    current.fallingUntil = 0;
    current.fallKind = undefined;
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
  const flattenedMs = Math.max(0, runner.flattenedMs ?? 0);
  if (runner.actionState === "flattened" || flattenedMs > 0) {
    player.flattenedStartedAt = receivedAt - Math.max(0, runner.flattenedElapsedMs ?? 0);
    player.flattenedUntil = receivedAt + Math.max(1, flattenedMs);
    player.knockbackX = 0;
    player.knockbackY = 0;
    player.airUntil = 0;
    player.dashUntil = 0;
  } else {
    player.flattenedStartedAt = 0;
    player.flattenedUntil = 0;
  }
  const fallingMs = Math.max(0, runner.fallingMs ?? 0);
  if (fallingMs > 0) {
    player.fallingStartedAt = receivedAt - Math.max(0, runner.fallingElapsedMs ?? 0);
    player.fallingUntil = receivedAt + fallingMs;
    player.fallTargetX = runner.fallTargetX ?? runner.x;
    player.fallTargetY = runner.fallTargetY ?? runner.y;
    player.fallKind = runner.fallKind;
    player.knockbackX = 0;
    player.knockbackY = 0;
    player.airUntil = 0;
  } else {
    player.fallingUntil = 0;
    player.fallKind = undefined;
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

function upsertNetworkRock(networkRock: NetworkRock) {
  const receivedAt = performance.now();
  const current = rollingRocks.find((rock) => rock.id === networkRock.id);
  if (current) {
    current.x = networkRock.x;
    current.y = networkRock.y;
    current.velocityX = networkRock.velocityX;
    current.velocityY = networkRock.velocityY;
    current.radius = networkRock.radius;
    current.until = receivedAt + Math.max(0, networkRock.remainingMs);
    return;
  }
  rollingRocks.push({
    id: networkRock.id,
    x: networkRock.x,
    y: networkRock.y,
    velocityX: networkRock.velocityX,
    velocityY: networkRock.velocityY,
    radius: networkRock.radius,
    until: receivedAt + Math.max(0, networkRock.remainingMs),
    angle: 0,
  });
}

function syncNetworkRocks(room: NetworkRoom) {
  if (!multiplayerActive) return;
  const present = new Set((room.rocks ?? []).map((rock) => rock.id));
  for (let index = rollingRocks.length - 1; index >= 0; index -= 1) {
    if (!present.has(rollingRocks[index].id)) rollingRocks.splice(index, 1);
  }
  for (const rock of room.rocks ?? []) upsertNetworkRock(rock);
}

function syncNetworkObstacles(room: NetworkRoom) {
  mapObstacles = (room.obstacles ?? []).map((obstacle) => ({
    ...obstacle,
    solid: true,
  }));
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
      flattenedStartedAt: 0,
      flattenedUntil: 0,
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
  current.connected = runner.connected;
  current.reconnectMs = runner.reconnectMs;
  current.cloneCount = runner.cloneCount;
  current.dashCharges = runner.dashCharges;
  current.skillCooldownUntil = receivedAt + Math.max(0, runner.skillCooldownMs ?? 0);
  current.dashRechargeUntil = receivedAt + Math.max(0, runner.dashRechargeMs ?? 0);
  current.lap = runner.lap;
  current.checkpoint = runner.checkpoint;
  current.targetX = runner.x;
  current.targetY = runner.y;
  current.targetWalking = runner.connected ? runner.walking : current.walking;
  if (!runner.connected) removeRunnerLabels(runner.id);
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

function syncNetworkCountdown(room: NetworkRoom) {
  matchCountdown.sync(room.countdownMs);
  if (room.countdownMs > 0) {
    pressedKeys.clear();
  }
}

function showNetworkStartBanner() {
  matchCountdown.showStart();
  audio.play("start");
}

function clearNetworkCountdown() {
  matchCountdown.clear();
  elements.matchCountdown.classList.add("hidden");
  elements.matchCountdown.classList.remove("starting");
  elements.matchCountdownValue.textContent = "";
}

function updateMatchCountdown(now: number) {
  const { value, starting } = matchCountdown.view(now, Boolean(activeNetworkRoom?.countdownMs));
  if (!value) {
    elements.matchCountdown.classList.add("hidden");
    elements.matchCountdown.classList.remove("starting");
    elements.matchCountdownValue.textContent = "";
    return;
  }
  elements.matchCountdown.classList.remove("hidden");
  elements.matchCountdown.classList.toggle("starting", starting);
  if (elements.matchCountdownValue.textContent !== value) {
    if (!starting) audio.play("countdown");
    elements.matchCountdownValue.textContent = value;
  }
}

function updateNetworkWaitingPanel() {
  if (!activeNetworkRoom || activeNetworkRoom.phase !== "waiting" || gameActive) return;
  const isHost = activeNetworkRoom.hostId === getLocalNetworkPlayerId();
  const countingDown = activeNetworkRoom.countdownMs > 0;
  const connectedPlayers = countConnectedPlayers(activeNetworkRoom);
  elements.titleRoomPanel.classList.remove("create-mode");
  elements.titleRoomPanel.classList.add("network-waiting");
  elements.titleWaitingSummary.classList.remove("hidden");
  elements.titlePanelMarker.textContent = "ONLINE ROOM";
  const map = getMapDefinition(activeNetworkRoom.config.mapId);
  elements.titlePanelTitle.textContent = activeNetworkRoom.code;
  elements.titleWaitingStatus.textContent = countingDown
    ? "출발 카운트다운 진행 중"
    : isHost
      ? connectedPlayers < 2 ? "한 명 이상의 러너를 기다리는 중" : "모두 준비됐어요. 경기를 시작하세요!"
      : "방장이 경기를 시작할 때까지 기다려주세요";
  elements.titleWaitingMap.textContent = map.name;
  elements.titleWaitingRules.textContent = `${activeNetworkRoom.config.lapLimit}랩 · 스킬 ${activeNetworkRoom.config.enabledSkills.length}종`;
  elements.titleWaitingCount.textContent = `${connectedPlayers}/${activeNetworkRoom.config.playerCount}`;
  elements.titleWaitingPlayers.replaceChildren();
  for (const runner of activeNetworkRoom.players) {
    const row = document.createElement("div");
    row.className = "title-waiting-player";
    if (!runner.connected) row.classList.add("disconnected");
    const color = document.createElement("i");
    color.style.backgroundColor = runner.color;
    const name = document.createElement("span");
    name.textContent = runner.name;
    const role = document.createElement("b");
    role.textContent = runner.id === activeNetworkRoom.hostId
      ? "HOST"
      : runner.connected ? "READY" : "REJOIN";
    row.append(color, name, role);
    elements.titleWaitingPlayers.append(row);
  }
  elements.titleRoomShare.classList.toggle("hidden", !isHost);
  elements.titleRoomShareCode.textContent = activeNetworkRoom.code;
  elements.titleCopyRoomCode.setAttribute("aria-label", `방 코드 ${activeNetworkRoom.code} 복사`);
  elements.titleConfirm.textContent = countingDown
    ? "출발 준비 중"
    : isHost
      ? connectedPlayers < 2 ? "참가자 기다리는 중" : "경기 시작"
      : "방장 시작 대기";
  elements.titleConfirm.disabled = countingDown || !isHost || connectedPlayers < 2;
}

function applyNetworkRoom(room: NetworkRoom) {
  activeNetworkRoom = room;
  syncGameChat(room.chatMessages ?? []);
  syncNetworkCountdown(room);
  roomConfig = room.config;
  applyMapDefinition(room.config.mapId);
  syncNetworkObstacles(room);
  syncNetworkHazardLayout(room);
  syncNetworkHazards(room.hazards);
  syncRemotePlayers(room);
  syncNetworkClones(room);
  syncNetworkRocks(room);
  const self = room.players.find((runner) => runner.id === getLocalNetworkPlayerId());
  if (self && multiplayerActive && gameActive) {
    const previousLap = lap;
    const previousCheckpoint = checkpointIndex;
    const previousSkill = equippedSkill;
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
    const skillNotice = previousSkill !== self.skill
      ? ` 새 스킬: ${skillLabels[self.skill]}${isPassiveSkill(self.skill) ? " 자동 적용!" : "!"}`
      : "";
    if (room.phase === "running" && lap > previousLap) {
      showToast(currentMap.courseType === "linear"
        ? `${lap}랩 완주! 산 아래 출발점으로 순간이동했습니다.${skillNotice}`
        : `${lap}랩 완주! 다음 바퀴도 말썽을 피워보자.${skillNotice}`);
    } else if (room.phase === "running" && checkpointIndex > previousCheckpoint) {
      showToast(checkpointIndex === checkpoints.length
        ? currentMap.courseType === "linear"
          ? `마지막 체크포인트 통과! 정상까지 올라가세요.${skillNotice}`
          : `마지막 체크포인트 통과! 출발선으로 돌아가세요.${skillNotice}`
        : `${checkpointIndex}번째 체크포인트 통과!${skillNotice}`);
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

type NetworkRoomRequest =
  | { event: typeof CLIENT_EVENTS.createRoom; payload: RoomCreatePayload }
  | { event: typeof CLIENT_EVENTS.joinRoom; payload: RoomJoinPayload }
  | { event: typeof CLIENT_EVENTS.startRoom }
  | { event: typeof CLIENT_EVENTS.rematchRoom };

function requestNetworkRoom(request: NetworkRoomRequest) {
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
      if (response.session) storeNetworkSession(response.session);
      resolve(response.room);
    };
    if (request.event === CLIENT_EVENTS.createRoom) socket.emit(CLIENT_EVENTS.createRoom, request.payload, done);
    else if (request.event === CLIENT_EVENTS.joinRoom) socket.emit(CLIENT_EVENTS.joinRoom, request.payload, done);
    else if (request.event === CLIENT_EVENTS.startRoom) socket.emit(CLIENT_EVENTS.startRoom, done);
    else socket.emit(CLIENT_EVENTS.rematchRoom, done);
  });
}

function restoreNetworkRoom(room: NetworkRoom) {
  if (room.phase === "running" || room.phase === "finished") {
    startNetworkMatch(room);
    applyNetworkRoom(room);
    showToast(`${room.code} 방의 경기 상태를 복구했습니다.`);
    return;
  }
  setMusicTheme("lobby");
  multiplayerActive = false;
  gameActive = false;
  elements.game.classList.add("hidden");
  elements.title.classList.remove("hidden");
  elements.titleRoomPanel.classList.remove("hidden", "create-mode");
  elements.titleRoomPanel.classList.add("network-waiting");
  elements.titleStage.classList.add("room-panel-open");
  applyNetworkRoom(room);
  showToast(`${room.code} 대기실에 다시 연결했습니다.`);
}

function resumeNetworkSession() {
  const session = activeNetworkSession;
  if (!session || !socket.connected || networkResumeInFlight) return;
  networkResumeInFlight = true;
  const timeout = window.setTimeout(() => {
    networkResumeInFlight = false;
    showToast("재접속 응답이 지연되고 있습니다. 다시 시도합니다.");
    if (socket.connected) window.setTimeout(resumeNetworkSession, 500);
  }, 5000);
  socket.emit(CLIENT_EVENTS.resumeRoom, session, (response: NetworkResponse) => {
    window.clearTimeout(timeout);
    networkResumeInFlight = false;
    if (activeNetworkSession?.playerId !== session.playerId) return;
    if (!response?.ok) {
      const message = response?.error ?? "기존 멀티플레이 세션을 복구하지 못했습니다.";
      clearNetworkSession();
      returnToTitle();
      showToast(message);
      return;
    }
    if (response.session) storeNetworkSession(response.session);
    restoreNetworkRoom(response.room);
  });
}

function sendLocalNetworkState(now: number) {
  if (!multiplayerActive || !socket.connected || player.dashUntil > now || isLocalActionLocked(now) || now - lastNetworkStateAt < 55) return;
  lastNetworkStateAt = now;
  socket.emit(CLIENT_EVENTS.playerState, {
    x: player.x,
    y: player.y,
    direction: player.direction,
    walking: player.walking,
  });
}

function readRoomConfig(): RoomConfig | undefined {
  const lapLimit = Math.floor(Number(elements.titleLapCount.value));
  const playerCount = Math.floor(Number(elements.titlePlayerCount.value));
  const mapId = isMapId(elements.titleMapId.value)
    ? elements.titleMapId.value
    : DEFAULT_MAP_ID;
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
  return { lapLimit, playerCount, mapId, enabledSkills };
}

function updateSkillPoolSummary() {
  const selectedSkills = [...elements.titleSkillPool.querySelectorAll<HTMLInputElement>('input[type="checkbox"]:checked')];
  const selectedCount = selectedSkills.length;
  const selectedLabels = selectedSkills.map((input) => (
    input.closest("label")?.querySelector("span")?.textContent?.trim() || input.value
  ));
  const invalid = selectedCount < 3;
  elements.titleSkillCount.textContent = `${selectedCount}개 · 최소 3개`;
  elements.titleSkillSummary.textContent = selectedCount === 10
    ? "전체 스킬 · 10개"
    : selectedCount <= 2
      ? selectedLabels.join(" · ") || "선택된 스킬 없음"
      : `${selectedLabels.slice(0, 2).join(" · ")} 외 ${selectedCount - 2}개`;
  elements.titleSkillCount.classList.toggle("invalid", invalid);
  elements.titleSkillSelect.classList.toggle("invalid", invalid);
}

function updateMapSelection() {
  const selected = elements.titleMapOptions.querySelector<HTMLInputElement>('input[type="radio"]:checked');
  const mapId = selected && isMapId(selected.value) ? selected.value : DEFAULT_MAP_ID;
  const selectedLabel = selected?.closest("label")?.querySelector("span")?.textContent?.trim();
  elements.titleMapId.value = mapId;
  elements.titleMapSummary.textContent = selectedLabel || getMapDefinition(mapId).name;
}

function startNetworkMatch(room: NetworkRoom) {
  if (multiplayerActive && gameActive && activeNetworkRoom?.code === room.code && activeNetworkRound === room.round) {
    applyNetworkRoom(room);
    return;
  }
  const self = room.players.find((runner) => runner.id === getLocalNetworkPlayerId());
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
  applyMapDefinition(room.config.mapId);
  setMusicTheme(room.config.mapId);
  syncNetworkObstacles(room);
  syncNetworkHazardLayout(room);
  syncRemotePlayers(room);
  const now = performance.now();
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
  player.flattenedUntil = 0;
  player.flattenedStartedAt = 0;
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
  clones.length = 0;
  syncNetworkClones(room);
  syncNetworkRocks(room);
  syncGameChat(room.chatMessages ?? []);
  projectiles.length = 0;
  slowImpacts.length = 0;
  (Object.keys(skillReadyAt) as SkillId[]).forEach((id) => { skillReadyAt[id] = 0; });
  skillReadyAt[self.skill] = now + Math.max(0, self.skillCooldownMs ?? 0);
  dashCharges = self.dashCharges ?? 3;
  dashRechargeAt = now + Math.max(0, self.dashRechargeMs ?? 0);
  skillBarSignature = "";
  raceBoardSignature = "";
  lap = self.lap;
  checkpointIndex = self.checkpoint;
  startArmed = false;
  syncNetworkHazards(room.hazards);
  syncPlayerTimedState(self, now);
  syncPlayerHazardState(self, now);
  jumpPadCooldownUntil = 0;
  aim.visible = false;
  aim.pulseUntil = 0;
  elements.back.classList.remove("hidden");
  elements.title.classList.add("hidden");
  elements.game.classList.remove("hidden");
  gameActive = true;
  elements.gameCanvas.focus();
  const passiveNotice = isPassiveSkill(equippedSkill) ? ` ${skillLabels[equippedSkill]} 자동 적용!` : "";
  showToast(`${room.code} 멀티 레이스 시작! ${room.players.length}명 연결됨.${passiveNotice}`);
}

function returnToTitle() {
  setMusicTheme("lobby");
  if (activeNetworkRoom) socket.emit(CLIENT_EVENTS.leaveRoom);
  clearNetworkSession();
  activeNetworkRoom = undefined;
  activeNetworkRound = 0;
  multiplayerActive = false;
  clearNetworkCountdown();
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
  resetWorldLabels();
  gameActive = false;
  aim.visible = false;
  pressedKeys.clear();
  closeGameChat(false);
  syncGameChat();
  if (document.fullscreenElement) void document.exitFullscreen();
  elements.toast.classList.remove("visible");
  elements.toast.textContent = "";
  hideMatchResults();
  elements.skillBar.classList.add("hidden");
  elements.game.classList.add("hidden");
  closeTitleRoomPanel();
  elements.title.classList.remove("hidden");
}

type TitleRoomMode = "join" | "create";
let titleRoomMode: TitleRoomMode = "join";

function createInviteCode() {
  return `PM-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function fallbackCopyText(value: string) {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  return copied;
}

async function copyActiveRoomCode() {
  const code = activeNetworkRoom?.code;
  if (!code) {
    showToast("복사할 방 코드가 없습니다.");
    return;
  }

  let copied = false;
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(code);
      copied = true;
    }
  } catch {
    copied = false;
  }
  if (!copied) copied = fallbackCopyText(code);

  if (copied) {
    audio.play("ui");
    showToast(`방 코드 ${code}를 복사했습니다.`);
    return;
  }
  showToast("방 코드를 복사하지 못했습니다. 코드를 길게 눌러 복사해주세요.");
}

function openTitleRoomPanel(mode: TitleRoomMode) {
  titleRoomMode = mode;
  elements.titleMapSelect.open = false;
  elements.titleSkillSelect.open = false;
  elements.titleRoomPanel.classList.remove("hidden");
  elements.titleRoomPanel.classList.remove("network-waiting");
  elements.titleWaitingSummary.classList.add("hidden");
  elements.titleRoomShare.classList.add("hidden");
  elements.titleRoomPanel.classList.toggle("create-mode", mode === "create");
  elements.titleStage.classList.add("room-panel-open");
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
  if (activeNetworkRoom && !gameActive) {
    socket.emit(CLIENT_EVENTS.leaveRoom);
    clearNetworkSession();
  }
  activeNetworkRoom = undefined;
  if (!gameActive) activeNetworkRound = 0;
  if (!gameActive) clearNetworkCountdown();
  remotePlayers.clear();
  elements.titleMapSelect.open = false;
  elements.titleSkillSelect.open = false;
  elements.titleRoomPanel.classList.add("hidden");
  elements.titleRoomPanel.classList.remove("network-waiting");
  elements.titleWaitingSummary.classList.add("hidden");
  elements.titleRoomShare.classList.add("hidden");
  elements.titleConfirm.disabled = false;
  elements.titleStage.classList.remove("room-panel-open");
}

async function startFromTitleRoomPanel() {
  const runnerName = elements.titleRunnerName.value.trim().slice(0, 10) || "말썽꾸러기";
  try {
    await ensureSocketConnected();
    if (activeNetworkRoom) {
      if (activeNetworkRoom.hostId !== getLocalNetworkPlayerId()) return;
      const room = await requestNetworkRoom({ event: CLIENT_EVENTS.startRoom });
      applyNetworkRoom(room);
      return;
    }
    if (titleRoomMode === "join") {
      const code = elements.titleRoomCode.value.trim().toUpperCase();
      if (code.length < 4) {
        showToast("방 번호를 4자 이상 입력하세요.");
        elements.titleRoomCode.focus();
        return;
      }
      const room = await requestNetworkRoom({ event: CLIENT_EVENTS.joinRoom, payload: { code, name: runnerName } });
      applyNetworkRoom(room);
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
    const room = await requestNetworkRoom({ event: CLIENT_EVENTS.createRoom, payload: { code: inviteCode, name: runnerName, config } });
    applyNetworkRoom(room);
    showToast(`방 생성 완료 · 초대 코드 ${room.code}`);
  } catch (error) {
    showToast(error instanceof Error ? error.message : "멀티플레이 방을 열지 못했습니다.");
  }
}

async function startNetworkRematch() {
  if (!activeNetworkRoom || activeNetworkRoom.phase !== "finished" || activeNetworkRoom.hostId !== getLocalNetworkPlayerId()) return;
  elements.resultRematch.disabled = true;
  elements.resultStatus.textContent = "출발선을 다시 준비하고 있습니다…";
  try {
    const room = await requestNetworkRoom({ event: CLIENT_EVENTS.rematchRoom });
    applyNetworkRoom(room);
    elements.resultStatus.textContent = "3초 뒤 재대결이 시작됩니다.";
  } catch (error) {
    elements.resultRematch.disabled = countConnectedPlayers(activeNetworkRoom) < 2;
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
  const isSelf = effect.playerId === getLocalNetworkPlayerId();
  const remote = remotePlayers.get(effect.playerId);
  if (effect.kind === "pit" || effect.kind === "void") {
    clearNetworkControlEffects(effect.playerId);
    if (isSelf) {
      audio.play("pit");
      player.fallingStartedAt = now;
      player.fallingUntil = now + effect.duration;
      player.fallKind = effect.kind;
      player.fallTargetX = effect.targetX;
      player.fallTargetY = effect.targetY;
      player.knockbackX = 0;
      player.knockbackY = 0;
      player.airUntil = 0;
      player.flattenedUntil = 0;
      player.flattenedStartedAt = 0;
      player.dashUntil = 0;
      networkSleepUntil = 0;
      networkSlowUntil = 0;
      runUntil = 0;
      grappleLockUntil = 0;
      pushLockUntil = 0;
      player.hitUntil = now + effect.duration;
      showToast(effect.kind === "void" ? "정거장 밖으로 추락했습니다!" : "구덩이에 빨려 들어간다!");
    }
    if (remote) {
      remote.fallingStartedAt = now;
      remote.fallingUntil = now + effect.duration;
      remote.fallKind = effect.kind;
      remote.fallTargetX = effect.targetX;
      remote.fallTargetY = effect.targetY;
      remote.airUntil = 0;
      remote.flattenedUntil = 0;
      remote.flattenedStartedAt = 0;
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
      audio.play("jump");
      player.x = effect.endX;
      player.y = effect.endY;
      player.knockbackX = 0;
      player.knockbackY = 0;
      player.airStartedAt = now;
      player.airUntil = now + effect.duration;
      player.flattenedUntil = 0;
      player.flattenedStartedAt = 0;
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
      remote.flattenedUntil = 0;
      remote.flattenedStartedAt = 0;
      remote.sleepEffectUntil = 0;
    }
    return;
  }
  clearNetworkControlEffects(effect.playerId);
  if (isSelf) {
    player.x = effect.x;
    player.y = effect.y;
    player.health = effect.health;
    player.ammo = effect.ammo;
    player.fallingUntil = 0;
    player.fallKind = undefined;
    player.airUntil = 0;
    player.flattenedUntil = 0;
    player.flattenedStartedAt = 0;
    player.knockbackX = 0;
    player.knockbackY = 0;
    player.dashUntil = 0;
    networkSleepUntil = 0;
    networkSlowUntil = 0;
    runUntil = 0;
    grappleLockUntil = 0;
    pushLockUntil = 0;
    player.hitUntil = now + 550;
    showToast(effect.reason === "rock"
      ? "낙석에 납작해진 뒤 마지막 체크포인트로 복귀했습니다!"
      : "마지막 체크포인트에서 다시 달린다!");
  }
  if (remote) {
    remote.x = effect.x;
    remote.y = effect.y;
    remote.targetX = effect.x;
    remote.targetY = effect.y;
    remote.health = effect.health;
    remote.fallingUntil = 0;
    remote.fallKind = undefined;
    remote.airUntil = 0;
    remote.flattenedUntil = 0;
    remote.flattenedStartedAt = 0;
    remote.sleepEffectUntil = 0;
    remote.slowEffectUntil = 0;
  }
}

elements.titleKeyArt.addEventListener("error", () => {
  titleFallbackActive = true;
  elements.titleStage.classList.add("fallback-art");
  titleAnimationStartedAt = performance.now();
});
elements.openJoin.addEventListener("click", () => {
  audio.play("ui");
  openTitleRoomPanel("join");
});
elements.openCreate.addEventListener("click", () => {
  audio.play("ui");
  openTitleRoomPanel("create");
});
elements.titleConfirm.addEventListener("click", () => { void startFromTitleRoomPanel(); });
elements.titlePanelBack.addEventListener("click", closeTitleRoomPanel);
elements.titleRoomCode.addEventListener("keydown", (event) => { if (event.key === "Enter") void startFromTitleRoomPanel(); });
elements.titleInviteCode.addEventListener("keydown", (event) => { if (event.key === "Enter") void startFromTitleRoomPanel(); });
elements.titleMapOptions.addEventListener("change", () => {
  updateMapSelection();
  elements.titleMapSelect.open = false;
  elements.titleMapSelect.querySelector("summary")?.focus();
});
elements.titleSkillPool.addEventListener("change", updateSkillPoolSummary);
for (const popover of [elements.titleMapSelect, elements.titleSkillSelect]) {
  popover.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !popover.open) return;
    event.preventDefault();
    popover.open = false;
    popover.querySelector("summary")?.focus();
  });
}
document.addEventListener("pointerdown", (event) => {
  if (!(event.target instanceof Node)) return;
  for (const popover of [elements.titleMapSelect, elements.titleSkillSelect]) {
    if (popover.open && !popover.contains(event.target)) popover.open = false;
  }
});
elements.titleCopyRoomCode.addEventListener("click", () => { void copyActiveRoomCode(); });
elements.back.addEventListener("click", returnToTitle);
elements.fullscreen.addEventListener("click", () => { void toggleFullscreen(); });
elements.audio.addEventListener("click", () => {
  void audio.toggle().then((muted) => {
    elements.audio.textContent = muted ? "소리 OFF" : "소리 ON";
    elements.audio.setAttribute("aria-pressed", String(muted));
  });
});
elements.audio.textContent = audio.muted ? "소리 OFF" : "소리 ON";
elements.audio.setAttribute("aria-pressed", String(audio.muted));
updateMapSelection();
updateSkillPoolSummary();
elements.gameChatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendGameChat();
});
elements.gameChatInput.addEventListener("keydown", (event) => {
  if (event.isComposing) return;
  if (event.key === "Enter") {
    event.preventDefault();
    event.stopPropagation();
    sendGameChat();
  } else if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
    closeGameChat();
  }
});
window.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.repeat || event.target === elements.gameChatInput) return;
  if (!multiplayerActive || !gameActive || matchFinished || activeNetworkRoom?.phase !== "running") return;
  event.preventDefault();
  event.stopImmediatePropagation();
  openGameChat();
}, true);
elements.resultRematch.addEventListener("click", () => { void startNetworkRematch(); });
elements.resultToTitle.addEventListener("click", returnToTitle);

socket.on("connect", () => {
  if (activeNetworkSession) resumeNetworkSession();
});
socket.on(SERVER_EVENTS.roomState, (room) => applyNetworkRoom(room));
socket.on(SERVER_EVENTS.matchCountdown, (room) => applyNetworkRoom(room));
socket.on(SERVER_EVENTS.matchStarted, (room) => {
  showNetworkStartBanner();
  startNetworkMatch(room);
});
socket.on(SERVER_EVENTS.matchFinished, (room) => applyNetworkRoom(room));
socket.on(SERVER_EVENTS.chatMessage, (message) => receiveGameChatMessage(message));
socket.on(SERVER_EVENTS.hazardWarning, (hazards) => {
  syncNetworkHazards(hazards);
  showToast("구덩이 경고! 잠시 후 열린다.");
});
socket.on(SERVER_EVENTS.hazardState, (hazards) => {
  const warnedPitIndex = warningPitIndex;
  syncNetworkHazards(hazards);
  if (hazards.activePitIndex >= 0 && hazards.activePitIndex === warnedPitIndex) {
    showToast("구덩이가 열렸다!");
  }
});
socket.on(SERVER_EVENTS.hazardEffect, (effect) => applyNetworkHazardEffect(effect));
socket.on(SERVER_EVENTS.rockSpawn, (rock) => {
  if (!multiplayerActive) return;
  upsertNetworkRock(rock);
});
socket.on(SERVER_EVENTS.rockRemove, (event: NetworkRockRemoval) => {
  const index = rollingRocks.findIndex((rock) => rock.id === event.id);
  if (index >= 0) rollingRocks.splice(index, 1);
  if (event.playerId !== getLocalNetworkPlayerId()) return;
  audio.play("hit");
  showToast(event.defeated ? "낙석에 완전히 깔렸습니다!" : "낙석에 맞아 납작해졌습니다!");
});
socket.on(SERVER_EVENTS.raceTeleport, (event: NetworkTeleport) => {
  if (!multiplayerActive) return;
  if (event.playerId === getLocalNetworkPlayerId()) {
    player.x = event.x;
    player.y = event.y;
    player.knockbackX = 0;
    player.knockbackY = 0;
    return;
  }
  const runner = remotePlayers.get(event.playerId);
  if (!runner) return;
  runner.x = event.x;
  runner.y = event.y;
  runner.targetX = event.x;
  runner.targetY = event.y;
});
socket.on(SERVER_EVENTS.playerState, (runner) => {
  if (!multiplayerActive || runner.id === getLocalNetworkPlayerId()) return;
  upsertRemotePlayer(runner);
});
socket.on(SERVER_EVENTS.combatShot, (shot: NetworkShot) => {
  if (!multiplayerActive || shot.sourceId === getLocalNetworkPlayerId()) return;
  projectiles.push({ kind: "bullet", owner: "remote", sourceId: shot.sourceId, x: shot.x, y: shot.y, velocityX: shot.dx * 430, velocityY: shot.dy * 430, until: performance.now() + 620, radius: 0 });
});
socket.on(SERVER_EVENTS.combatProjectile, (projectile: NetworkProjectile) => {
  if (!multiplayerActive || projectile.sourceId === getLocalNetworkPlayerId()) return;
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
socket.on(SERVER_EVENTS.combatGrapple, (grapple: NetworkGrapple) => {
  if (!multiplayerActive) return;
  const now = performance.now();
  if (grapple.targetId !== undefined) grappleEffects.splice(0, grappleEffects.length, ...grappleEffects.filter((effect) => effect.targetId !== grapple.targetId));
  grappleEffects.push({ ...grapple, startedAt: now, until: now + 520 });
  const playerId = getLocalNetworkPlayerId();
  if (grapple.sourceId === playerId || grapple.targetId === playerId) grappleLockUntil = now + 520;
});
socket.on(SERVER_EVENTS.combatKnockback, (knockback: NetworkKnockback) => {
  if (!multiplayerActive) return;
  const now = performance.now();
  pushEffects.splice(0, pushEffects.length, ...pushEffects.filter((effect) => effect.targetId !== knockback.targetId));
  pushEffects.push({ ...knockback, startedAt: now, until: now + knockback.duration });
  if (knockback.targetId === getLocalNetworkPlayerId()) {
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
socket.on(SERVER_EVENTS.combatEffect, (effect: NetworkCombatEffect) => {
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
  const playerId = getLocalNetworkPlayerId();
  const hitMe = playerId ? effect.targetIds.includes(playerId) : false;
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
  if (effect.sourceId === playerId && effect.targetIds.length > 0) showToast(`${skillLabels[effect.kind as SkillId] ?? "총알"} 명중!`);
});
socket.on("disconnect", () => {
  if (!activeNetworkSession) return;
  pressedKeys.clear();
  showToast("연결이 끊겼습니다. 30초 동안 기존 경기로 재접속합니다.");
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

const pressedKeys = installInputController({
  canvas: elements.gameCanvas,
  isGameActive: () => gameActive,
  isInputBlocked: isGameChatOpen,
  isMatchFinished: () => matchFinished,
  onAim: updateAimFromPointer,
  onPrimaryAction: () => fireBasicShot(performance.now()),
  onSecondaryAction: () => {
    const now = performance.now();
    if (isPassiveSkill(equippedSkill)) {
      showToast(`${skillLabels[equippedSkill]}은 지급 즉시 자동 적용 중입니다.`);
    } else useSkill(equippedSkill, now);
  },
  onEscape: () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else returnToTitle();
  },
  onInteraction: () => { void audio.unlock(); },
});
window.addEventListener("pointerdown", () => { void audio.unlock(); }, { once: true });

if (activeNetworkSession) {
  showToast("이전 멀티플레이 세션에 다시 연결하고 있습니다.");
  socket.connect();
}
requestAnimationFrame(animate);
