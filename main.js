// general stuff
const game = document.getElementById("game");
const backgroundEl = document.getElementById("background");
const hotspotLayer = document.getElementById("hotspot-layer");
const characterEl = document.getElementById("character");
const flashEl = document.getElementById("flash");
const titleCardEl = document.getElementById("stage-title");
const dialogueBox = document.getElementById("dialogue-box");
const dialogueTextEl = document.getElementById("dialogue-text");
const choiceLayer = document.getElementById("choice-layer");
const debugFlagsEl = document.getElementById("debug-flags");

const WALK_SPEED_PX_PER_SEC = 260; // click-to-walk speed
const TYPEWRITER_MS_PER_CHAR = 18;

const state = {
  sceneIndex: 0,
  flags: new Set(),
  items: new Set(),
  charPos: { x: 50, y: 80 }, // percentage of game area
  dialogueQueue: [],
  dialogueActive: false,
  dialogueOnComplete: null,
  typewriterTimer: null,
  currentLineFull: "",
  currentLineRevealed: false,
  inputLocked: false 
};

function init() {
  characterEl.style.left = state.charPos.x + "%";
  characterEl.style.top = state.charPos.y + "%";

  game.addEventListener("click", onGameClick);
  dialogueBox.addEventListener("click", onDialogueClick);
  document.getElementById("choice-remember").addEventListener("click", () => handleChoice("remember"));
  document.getElementById("choice-forget").addEventListener("click", () => handleChoice("forget"));

  loadScene(0, true);
}

// loading the scenes
function loadScene(index, isFirstLoad) {
  state.sceneIndex = index;
  const scene = SCENES[index];

  // background
  if (scene.bg.startsWith("#")) {
    backgroundEl.style.backgroundImage = "none";
    backgroundEl.style.backgroundColor = scene.bg;
  } else {
    backgroundEl.style.backgroundColor = "transparent";
    backgroundEl.style.backgroundImage = `url("${scene.bg}")`;
  }
  backgroundEl.style.filter = `saturate(${scene.saturate}%) brightness(${0.85 + scene.saturate / 500})`;

  renderHotspots();
  updateDebugBar();

  showTitleCard(scene, () => {
    if (scene.onEnterDialogue && scene.onEnterDialogue.length) {
      startDialogue(scene.onEnterDialogue, null);
    }
  });
}

function showTitleCard(scene, callback) {
  titleCardEl.innerHTML = `<div class="label">${scene.label}</div><div class="title">${scene.title}</div>`;
  titleCardEl.classList.add("active");
  setTimeout(() => {
    titleCardEl.classList.remove("active");
    setTimeout(callback, 600);
  }, 1800);
}


// hotspot for the character
function renderHotspots() {
  hotspotLayer.innerHTML = "";
  const scene = SCENES[state.sceneIndex];

  scene.hotspots.forEach(h => {
    const el = document.createElement("div");
    el.className = "hotspot";
    el.style.left = h.x + "%";
    el.style.top = h.y + "%";
    el.style.width = h.w + "px";
    el.style.height = h.h + "px";
    el.style.marginLeft = (-h.w / 2) + "px";
    el.style.marginTop = (-h.h / 2) + "px";
    el.dataset.id = h.id;

    // see hotspot bounds:
    // el.classList.add("debug-visible");

    el.addEventListener("click", (e) => {
      e.stopPropagation();
      onHotspotClick(h);
    });

    hotspotLayer.appendChild(el);
  });
}

function meetsRequirements(h) {
  const flagsOk = !h.requiresFlags || h.requiresFlags.every(f => state.flags.has(f));
  const itemsOk = !h.requiresItems || h.requiresItems.every(i => state.items.has(i));
  return flagsOk && itemsOk;
}

function onHotspotClick(h) {
  if (state.inputLocked || state.dialogueActive) return;

  const hx = h.x, hy = h.y; // walk to the hotspot's position
  walkTo(hx, hy, () => {
    if (!meetsRequirements(h)) {
      startDialogue(h.lockedDialogue || ["..."], null);
      return;
    }

    if (h.oneTimeDialogue && h.__used) {
      return;
    }

    startDialogue(h.dialogue, () => {
      if (h.giveItem) state.items.add(h.giveItem);
      if (h.giveFlag) state.flags.add(h.giveFlag);
      h.__used = true;
      updateDebugBar();

      if (h.isClue) {
        advanceToNextStage();
      } else if (h.triggerChoiceAfter) {
        showChoices();
      }
    });
  });
}

// click to walk mech
function onGameClick(e) {
  if (state.inputLocked || state.dialogueActive) {
    return;
  }
  const rect = game.getBoundingClientRect();
  const xPct = ((e.clientX - rect.left) / rect.width) * 100;
  const yPct = ((e.clientY - rect.top) / rect.height) * 100;
  walkTo(xPct, yPct, null);
}

function walkTo(xPct, yPct, callback) {
  const rect = game.getBoundingClientRect();
  const fromPx = {
    x: (state.charPos.x / 100) * rect.width,
    y: (state.charPos.y / 100) * rect.height
  };
  const toPx = {
    x: (xPct / 100) * rect.width,
    y: (yPct / 100) * rect.height
  };
  const dist = Math.hypot(toPx.x - fromPx.x, toPx.y - fromPx.y);
  const durationSec = Math.max(0.15, dist / WALK_SPEED_PX_PER_SEC);

  state.inputLocked = true;
  characterEl.style.transitionDuration = durationSec + "s";
  characterEl.style.left = xPct + "%";
  characterEl.style.top = yPct + "%";
  state.charPos = { x: xPct, y: yPct };

  window.setTimeout(() => {
    state.inputLocked = false;
    if (callback) callback();
  }, durationSec * 1000 + 30);
}

// typewriter animation for dialogues
function startDialogue(lines, onComplete) {
  state.dialogueQueue = lines.slice();
  state.dialogueOnComplete = onComplete;
  state.dialogueActive = true;
  dialogueBox.classList.remove("hidden");
  nextDialogueLine();
}

function nextDialogueLine() {
  if (state.dialogueQueue.length === 0) {
    endDialogue();
    return;
  }
  state.currentLineFull = state.dialogueQueue.shift();
  state.currentLineRevealed = false;
  dialogueTextEl.textContent = "";

  let i = 0;
  clearInterval(state.typewriterTimer);
  state.typewriterTimer = setInterval(() => {
    i++;
    dialogueTextEl.textContent = state.currentLineFull.slice(0, i);
    if (i >= state.currentLineFull.length) {
      clearInterval(state.typewriterTimer);
      state.currentLineRevealed = true;
    }
  }, TYPEWRITER_MS_PER_CHAR);
}

function onDialogueClick() {
  if (!state.dialogueActive) return;

  if (!state.currentLineRevealed) {
    // skip to full line
    clearInterval(state.typewriterTimer);
    dialogueTextEl.textContent = state.currentLineFull;
    state.currentLineRevealed = true;
    return;
  }
  nextDialogueLine();
}

function endDialogue() {
  state.dialogueActive = false;
  dialogueBox.classList.add("hidden");
  const cb = state.dialogueOnComplete;
  state.dialogueOnComplete = null;
  if (cb) cb();
}

// transitions between stages
function advanceToNextStage() {
  state.inputLocked = true;
  flashEl.classList.add("active");

  window.setTimeout(() => {
    const next = state.sceneIndex + 1;
    if (next >= SCENES.length) {
      flashEl.classList.remove("active");
      state.inputLocked = false;
      return;
    }
    // reset character to a default entry position for the new scene
    state.charPos = { x: 50, y: 80 };
    characterEl.style.transitionDuration = "0s";
    characterEl.style.left = "50%";
    characterEl.style.top = "80%";

    loadScene(next);

    window.setTimeout(() => {
      flashEl.classList.remove("active");
      state.inputLocked = false;
    }, 200);
  }, 500);
}

// choices when ending
function showChoices() {
  choiceLayer.classList.remove("hidden");
}

function handleChoice(choice) {
  choiceLayer.classList.add("hidden");
  const lines = ENDINGS[choice];
  startDialogue(lines, () => {
    showEndScreen(choice);
  });
}

function showEndScreen(choice) {
  titleCardEl.innerHTML = `<div class="label">Where Stars Used to Sing</div><div class="title">${choice === "remember" ? "END \u2014 REMEMBER" : "END \u2014 FORGET"}</div>`;
  titleCardEl.classList.add("active");
}

// stuff for debugging
function updateDebugBar() {
  debugFlagsEl.textContent =
    "flags: " + Array.from(state.flags).join(", ") +
    " | items: " + Array.from(state.items).join(", ");
}

// ------------------------------------------------------------
document.addEventListener("DOMContentLoaded", init);
