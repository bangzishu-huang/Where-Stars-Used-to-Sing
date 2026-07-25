const game = document.getElementById("game");
const backgroundEl = document.getElementById("background");
const hotspotLayer = document.getElementById("hotspot-layer");
const characterEl = document.getElementById("character");
const flashEl = document.getElementById("flash");
const titleCardEl = document.getElementById("stage-title");
const dialogueBox = document.getElementById("dialogue-box");
const dialogueTextEl = document.getElementById("dialogue-text");
const choiceLayer = document.getElementById("choice-layer");
const objectiveBox = document.getElementById("objective-box");
const objectiveTextEl = document.getElementById("objective-text");

const WALK_SPEED_PX_PER_SEC = 260;
const TYPEWRITER_MS_PER_CHAR = 18;

const state = {
  sceneIndex: 0,
  flags: new Set(),
  items: new Set(),
  charPos: { x: 50, y: 80 },
  dialogueQueue: [],
  dialogueActive: false,
  dialogueOnComplete: null,
  typewriterTimer: null,
  currentLineFull: "",
  currentLineKind: "narrate",
  currentLineRevealed: false,
  inputLocked: false,
  titleActive: false,
  enterDialogueTimer: null,
  interviewed: new Set(),
  carHotspot: null,
  questHotspots: [],
  pendingInteract: null,
  stage2Phase: null,
  stage3Phase: null,
  stage3Clues: null,
  stage4Phase: null
};

function init() {
  initWorldDom();

  characterEl.style.left = state.charPos.x + "%";
  characterEl.style.top = state.charPos.y + "%";

  game.addEventListener("click", onGameClick);
  const replayBtn = document.getElementById("replay-button");
  if (replayBtn) {
    replayBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      window.location.reload();
    });
  }

  ["selectstart", "dragstart", "copy", "cut", "contextmenu"].forEach((evt) => {
    dialogueBox.addEventListener(evt, (e) => e.preventDefault());
    titleCardEl.addEventListener(evt, (e) => e.preventDefault());
    const starsOverlay = document.getElementById("stars-overlay");
    if (starsOverlay) starsOverlay.addEventListener(evt, (e) => e.preventDefault());
    const starsImg = document.getElementById("stars-image");
    if (starsImg) starsImg.addEventListener(evt, (e) => e.preventDefault());
    const endingOverlay = document.getElementById("ending-overlay");
    if (endingOverlay) endingOverlay.addEventListener(evt, (e) => e.preventDefault());
  });
  document.getElementById("choice-remember").addEventListener("click", (e) => {
    e.stopPropagation();
    handleChoice("remember");
  });
  document.getElementById("choice-forget").addEventListener("click", (e) => {
    e.stopPropagation();
    handleChoice("forget");
  });

  const params = new URLSearchParams(window.location.search);
  const startStage = Math.max(
    0,
    Math.min(SCENES.length - 1, (Number(params.get("stage")) || 1) - 1)
  );

  const bootGame = () => {
    if (window.GameAudio) {
      GameAudio.unlock();
      GameAudio.playStageStart();
    }
    state._titleStingAlreadyPlayed = true;
    titleCardEl.classList.remove("active");
    titleCardEl.classList.remove("click-to-begin");
    window.setTimeout(() => loadScene(startStage), 280);
  };

  titleCardEl.classList.add("click-to-begin");
  titleCardEl.innerHTML =
    '<div class="label">Where Stars Used to Sing</div>' +
    '<div class="title">Click to begin</div>' +
    '<div class="begin-hint">▼</div>';
  titleCardEl.classList.add("active");
  state.titleActive = true;
  state.inputLocked = true;

  const onFirstGesture = (e) => {
    e.preventDefault();
    e.stopPropagation();
    game.removeEventListener("pointerdown", onFirstGesture, true);
    bootGame();
  };

  game.addEventListener("pointerdown", onFirstGesture, true);
}

function setObjective(text, opts) {
  const animate = !opts || opts.animate !== false;
  if (!text) {
    objectiveBox.classList.remove("visible");
    objectiveBox.classList.add("hidden");
    objectiveTextEl.textContent = "";
    return;
  }
  const wasHidden =
    objectiveBox.classList.contains("hidden") || !objectiveBox.classList.contains("visible");
  objectiveTextEl.textContent = text;
  objectiveBox.classList.remove("hidden");
  if (animate && wasHidden) {
    objectiveBox.classList.remove("visible");
    void objectiveBox.offsetWidth;
    requestAnimationFrame(() => objectiveBox.classList.add("visible"));
  } else {
    objectiveBox.classList.add("visible");
  }
}

function interviewProgressText(scene) {
  const total = (scene.interviews || []).length;
  const done = state.interviewed.size;
  return `${scene.objective} (${done}/${total})`;
}

function loadScene(index) {
  state.sceneIndex = index;
  const scene = SCENES[index];

  if (state.enterDialogueTimer) {
    clearTimeout(state.enterDialogueTimer);
    state.enterDialogueTimer = null;
  }
  if (state.dialogueActive) {
    clearInterval(state.typewriterTimer);
    state.dialogueActive = false;
    dialogueBox.classList.add("hidden");
    state.dialogueQueue = [];
    state.dialogueOnComplete = null;
  }

  state.interviewed = new Set();
  state.carHotspot = null;
  state.questHotspots = [];
  state.pendingInteract = null;
  state.stage2Phase = null;
  state.stage3Phase = null;
  state.stage3Clues = null;
  state.stage4Phase = null;
  if (typeof clearMapHighlight === "function") clearMapHighlight();
  state.flags.clear();
  state.items.clear();

  (scene.hotspots || []).forEach((h) => {
    h.__used = false;
  });
  setObjective("");
  hideStarsOverlay();
  hideNightAtmosphere();
  hideEndingOverlay();

  if (scene.map) {
    backgroundEl.style.backgroundImage = "none";
    backgroundEl.style.backgroundColor = "#0a0a0c";
    backgroundEl.style.filter = "none";
    characterEl.classList.add("hidden");

    loadWorldMap(scene.map, {
      interviews: scene.interviews || [],
      birdQuest: scene.birdQuest || null,
      chickens: scene.chickens || null,
      excludeNpcSet: scene.excludeNpcSet,
      ambientCount: scene.ambientCount,
      quiet: scene.id === "stage4",
      spawn: scene.spawn || null,
      night: !!scene.night,
      staticNpcs: scene.childNpc ? [scene.childNpc] : scene.staticNpcs || null
    }).then(() => {

      if (state.sceneIndex !== index) return;
      world.onNpcClick = onNpcClick;
      world.onWalkAbort = () => {
        state.pendingInteract = null;
      };
      world.onBirdLanded = onBirdLanded;
      world.onProximity = null;
      if (scene.birdQuest && scene.id === "stage2") {
        state.stage2Phase = "follow";
      }
      if (scene.id === "stage3") {
        state.stage3Phase = "talk";
        state.stage3Clues = new Set();
      }
      if (scene.id === "stage4") {
        beginStage4Silence(scene);
      }
      renderHotspots();
      beginSceneIntro(scene);
    });
    return;
  }

  unloadWorld();
  characterEl.classList.remove("hidden");
  if (scene.bg && scene.bg.startsWith("#")) {
    backgroundEl.style.backgroundImage = "none";
    backgroundEl.style.backgroundColor = scene.bg;
  } else if (scene.bg) {
    backgroundEl.style.backgroundColor = "transparent";
    backgroundEl.style.backgroundImage = `url("${scene.bg}")`;
  }
  backgroundEl.style.filter = `saturate(${scene.saturate}%) brightness(${0.85 + scene.saturate / 500})`;
  renderHotspots();
  beginSceneIntro(scene);
}

function beginSceneIntro(scene) {

  showTitleCard(scene, () => {
    state.inputLocked = false;
    if (scene.onEnterDialogue && scene.onEnterDialogue.length) {
      state.enterDialogueTimer = setTimeout(() => {
        state.enterDialogueTimer = null;
        startDialogue(scene.onEnterDialogue, () => {
          showSceneObjective(scene);
        });
      }, 1600);
    } else {
      showSceneObjective(scene);
    }
  });
}

function showSceneObjective(scene) {
  if (!scene.objective) return;
  if (scene.interviews && scene.interviews.length) {
    setObjective(interviewProgressText(scene));
  } else {
    setObjective(scene.objective);
  }

  if (scene.birdQuest && state.stage2Phase === "follow") {
    startBirdQuest();
  }
}

function beginStage4Silence(scene) {
  state.stage4Phase = "arrive";
  setObjective("");
  showNightAtmosphere();
  world.onProximity = null;

  const keep = [];
  for (const n of world.npcs || []) {
    if (n.id === "child" || n.stationary) {
      keep.push(n);
    } else if (n.el && n.el.parentNode) {
      n.el.remove();
    }
  }
  world.npcs = keep;

  const child = keep.find((n) => n.id === "child");
  if (child && scene.childGreeting) {
    makeNpcTalkable(child, {
      id: "child",
      dialogue: scene.childGreeting,
      stage4Greeting: true
    });

    if (child.marker) {
      child.marker.remove();
      child.marker = null;
    }
  }
}

function showNightAtmosphere() {
  const veil = document.getElementById("night-veil");
  const petals = document.getElementById("petal-layer");
  if (veil) veil.classList.remove("hidden");
  if (petals) {
    petals.classList.remove("hidden");
    petals.innerHTML = "";
    for (let i = 0; i < 14; i++) {
      const p = document.createElement("div");
      p.className = "petal";
      p.style.left = Math.random() * 100 + "%";
      p.style.animationDuration = 9 + Math.random() * 10 + "s";
      p.style.animationDelay = Math.random() * 8 + "s";
      p.style.opacity = String(0.35 + Math.random() * 0.4);
      petals.appendChild(p);
    }
  }
}

function hideNightAtmosphere() {
  const veil = document.getElementById("night-veil");
  const petals = document.getElementById("petal-layer");
  if (veil) veil.classList.add("hidden");
  if (petals) {
    petals.classList.add("hidden");
    petals.innerHTML = "";
  }
}

function startStage4Greeting(scene) {

  if (state.stage4Phase !== "arrive") return;
  state.stage4Phase = "greeted";
  world.onProximity = null;

  state.inputLocked = true;
  cancelPlayerWalk();
  startDialogue(scene.childGreeting || [], () => {
    beginStage4Writing(scene);
  });
}

function beginStage4Writing(scene) {
  if (state.stage4Phase !== "greeted") return;
  state.stage4Phase = "writing";
  world.onProximity = null;
  state.inputLocked = true;
  cancelPlayerWalk();
  startDialogue(scene.notebookWriting || [], () => {
    startDialogue(scene.afterWriting || [], () => {
      startDialogue(scene.listenLine || ['\u201CDo you hear them?\u201D'], () => {

        state.stage4Phase = "stars";
        state.inputLocked = true;
        cancelPlayerWalk();
        setWorldPaused(true);
        if (window.GameAudio) {
          GameAudio.silenceAll(2200, () => playStarsLook(scene));
        } else {
          window.setTimeout(() => playStarsLook(scene), 2200);
        }
      });
    });
  });
}

function playStarsLook(scene) {
  state.stage4Phase = "stars";
  state.inputLocked = true;
  cancelPlayerWalk();
  setWorldPaused(true);
  const overlay = document.getElementById("stars-overlay");
  const img = document.getElementById("stars-image");
  if (!overlay || !img) {
    finishStarsLook(scene);
    return;
  }
  img.src = "assets/stars.jpg";
  img.draggable = false;
  img.setAttribute("draggable", "false");

  if (window.GameAudio) GameAudio.playStarsChoir({ volume: 0.26, fadeMs: 2400 });

  overlay.classList.remove("hidden", "visible", "zooming");
  img.classList.remove("stars-zooming");
  void overlay.offsetWidth;
  void img.offsetWidth;

  overlay.classList.add("visible");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      img.classList.add("stars-zooming");
      overlay.classList.add("zooming");
    });
  });

  window.setTimeout(() => {
    overlay.classList.remove("visible");
    if (window.GameAudio) GameAudio.fadeOutStars(1800);
    window.setTimeout(() => {
      overlay.classList.add("hidden");
      overlay.classList.remove("zooming");
      img.classList.remove("stars-zooming");
      finishStarsLook(scene);
    }, 1800);
  }, 7500);
}

function finishStarsLook(scene) {
  hideStarsOverlay();
  setWorldPaused(false);
  state.inputLocked = false;

  if (window.GameAudio) {
    GameAudio.setScene("stage4", { fadeMs: 1600 });
  }
  startDialogue(scene.afterStars || [], () => {
    state.stage4Phase = "choice";
    showChoices();
  });
}

function showChoices() {
  state.inputLocked = false;
  setWorldPaused(true);
  hideStarsOverlay();
  choiceLayer.classList.remove("hidden");

  choiceLayer.style.pointerEvents = "auto";
  choiceLayer.querySelectorAll("button").forEach((btn) => {
    btn.style.pointerEvents = "auto";
    btn.style.cursor = "pointer";
  });
}

function hideStarsOverlay() {
  const overlay = document.getElementById("stars-overlay");
  if (!overlay) return;
  overlay.classList.remove("visible", "zooming");
  overlay.classList.add("hidden");
}

function hideEndingOverlay() {
  const overlay = document.getElementById("ending-overlay");
  const quote = document.getElementById("ending-quote");
  const credits = document.getElementById("ending-credits");
  const replayBtn = document.getElementById("replay-button");
  if (overlay) {
    overlay.classList.remove("visible");
    overlay.classList.add("hidden");
  }
  if (quote) {
    quote.classList.remove("visible");
    quote.classList.add("hidden");
  }
  if (credits) {
    credits.classList.remove("visible");
    credits.classList.add("hidden");
  }
  if (replayBtn) {
    replayBtn.classList.remove("visible");
    replayBtn.classList.add("hidden");
  }
}

function onBirdLanded() {
  const scene = SCENES[state.sceneIndex];
  if (!scene) return;

  if (scene.id === "stage3") {
    startDialogue(
      [
        "~The bird stops beside the giant oak.~",
        "~Nobody is there. Only flowers.~",
        "~It looks back once — then flies away.~"
      ],
      () => markStage3Clue("bird")
    );
    return;
  }

  if (!scene.paperHotspot) return;
  state.stage2Phase = "paper";
  setObjective(scene.objectivePaper || "Check what the bird left behind");
  addQuestHotspot({ ...scene.paperHotspot, __used: false });
}

function addQuestHotspot(h) {
  state.questHotspots = state.questHotspots.filter((x) => x.id !== h.id);
  state.questHotspots.push(h);
  renderHotspots();
}

function clearQuestHotspot(id) {
  state.questHotspots = state.questHotspots.filter((x) => x.id !== id);
  renderHotspots();
}

function beginAskWitness() {
  const scene = SCENES[state.sceneIndex];
  if (!scene || !scene.witness) return;
  state.stage2Phase = "ask";
  setObjective(scene.objectiveAsk || "Ask someone about the folded paper");
  enableNearestWitness(scene.witness);
}

function beginTreeClue() {
  const scene = SCENES[state.sceneIndex];
  if (!scene || !scene.treeHotspot) return;
  state.stage2Phase = "tree";
  setObjective(scene.objectiveTree || "Find the tree around the park");
  const h = scene.treeHotspot;
  setMapHighlight(h.mapX, h.mapY, h.highlightW, h.highlightH);
  addQuestHotspot({
    ...h,
    __used: false,
    highlight: "highlight-tree"
  });
}

function showTitleCard(scene, callback) {
  state.titleActive = true;
  state.inputLocked = true;

  const fromFlash = flashEl.classList.contains("active");

  const beginTitle = () => {
    titleCardEl.innerHTML = `<div class="label">${scene.label}</div><div class="title">${scene.title}</div>`;

    if (fromFlash) {
      titleCardEl.style.transition = "none";
      titleCardEl.classList.add("active");
      void titleCardEl.offsetWidth;
      titleCardEl.style.transition = "";
      flashEl.classList.remove("active", "to-black");
      flashEl.style.background = "";
    } else {
      titleCardEl.classList.add("active");
    }
    const sel = window.getSelection && window.getSelection();
    if (sel && sel.removeAllRanges) sel.removeAllRanges();

    if (window.GameAudio && !state._titleStingAlreadyPlayed) {
      GameAudio.playStageStart();
    }
    state._titleStingAlreadyPlayed = false;

    const HOLD_MS = 3600;
    const FADE_MS = 1000;
    setTimeout(() => {
      titleCardEl.classList.remove("active");
      setTimeout(() => {
        state.titleActive = false;

        if (window.GameAudio && scene.id) {
          GameAudio.setScene(scene.id, { fadeMs: 1600 });
        }
        callback();
      }, FADE_MS);
    }, HOLD_MS);
  };

  beginTitle();
}

function renderHotspots() {
  hotspotLayer.innerHTML = "";
  const scene = SCENES[state.sceneIndex];
  const list = [];
  if (scene.hotspots) list.push(...scene.hotspots);
  if (state.carHotspot) list.push(state.carHotspot);
  if (state.questHotspots) list.push(...state.questHotspots);

  list.forEach((h) => {
    if (h.oneTimeDialogue && h.__used) return;
    const el = document.createElement("div");
    el.className = "hotspot" + (h.highlight ? " " + h.highlight : "");
    el.dataset.id = h.id;
    layoutHotspotEl(el, h);
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      onHotspotClick(h);
    });
    hotspotLayer.appendChild(el);
  });
}

function hotspotScreenSize(h) {
  if (h.mapW != null && h.mapH != null && worldIsActive() && world.scale) {
    return { w: h.mapW * world.scale, h: h.mapH * world.scale };
  }
  return { w: h.w || 48, h: h.h || 48 };
}

function layoutHotspotEl(el, h) {
  const size = hotspotScreenSize(h);
  el.style.width = size.w + "px";
  el.style.height = size.h + "px";
  el.style.marginLeft = -size.w / 2 + "px";
  el.style.marginTop = -size.h / 2 + "px";
  if (h.mapX != null && worldIsActive()) {
    const pct = mapToScreenGamePercent(h.mapX, h.mapY);
    el.style.left = pct.x + "%";
    el.style.top = pct.y + "%";
  } else if (h.x != null) {
    el.style.left = h.x + "%";
    el.style.top = h.y + "%";
  }
}

function syncHotspotPositions() {
  if (!worldIsActive()) return;
  const scene = SCENES[state.sceneIndex];
  const byId = {};
  (scene.hotspots || []).forEach((h) => {
    byId[h.id] = h;
  });
  if (state.carHotspot) byId[state.carHotspot.id] = state.carHotspot;
  (state.questHotspots || []).forEach((h) => {
    byId[h.id] = h;
  });

  hotspotLayer.querySelectorAll(".hotspot").forEach((el) => {
    const h = byId[el.dataset.id];
    if (h && h.mapX != null) layoutHotspotEl(el, h);
  });
}

setInterval(() => {
  if (worldIsActive() && (state.carHotspot || (state.questHotspots && state.questHotspots.length))) {
    syncHotspotPositions();
  }
}, 100);

function meetsRequirements(h) {
  const flagsOk = !h.requiresFlags || h.requiresFlags.every((f) => state.flags.has(f));
  const itemsOk = !h.requiresItems || h.requiresItems.every((i) => state.items.has(i));
  return flagsOk && itemsOk;
}

function onNpcClick(npc) {
  if (state.dialogueActive || state.titleActive) return;
  if (!npc || !npc.interview || npc.talked) return;

  state.pendingInteract = "npc";
  const approach = nearestApproachPoint(npc.x, npc.y);
  walkPlayerToMap(approach.x, approach.y, () => {
    if (state.pendingInteract !== "npc") return;
    state.pendingInteract = null;
    if (world.player) faceToward(world.player, npc.x, npc.y);
    faceToward(npc, world.player.x, world.player.y);
    placeEntity(world.player);
    placeEntity(npc);

    const interview = npc.interview;

    if (interview.stage4Greeting) {
      const scene = SCENES[state.sceneIndex];
      markNpcTalked(npc);
      startStage4Greeting(scene);
      return;
    }

    startDialogue(
      interview.dialogue,
      () => {
        markNpcTalked(npc);
        state.interviewed.add(interview.id);

        if (interview.stage3Clue) {
          markStage3Clue("bridge");
          return;
        }

        if (SCENES[state.sceneIndex].interviews) {
          onInterviewProgress();
        }
        if (state.stage2Phase === "ask") {
          beginTreeClue();
        }
      },
      interview.stage3Clue ? null : { speech: true }
    );
  });
}

function onInterviewProgress() {
  const scene = SCENES[state.sceneIndex];
  if (!scene.interviews) return;

  const total = scene.interviews.length;
  if (state.interviewed.size < total) {
    setObjective(interviewProgressText(scene), { animate: false });
    return;
  }

  if (scene.id === "stage3") {
    beginStage3Explore();
    return;
  }

  setObjective(scene.objectiveCar || "Find the car with the child's drawing.");
  spawnCarClue(scene);
}

function beginStage3Explore() {
  const scene = SCENES[state.sceneIndex];
  if (!scene || scene.id !== "stage3") return;
  state.stage3Phase = "explore";
  setObjective(scene.objectiveExplore || "Find the final witness.");

  if (scene.bridgeWitness) spawnMapWitness(scene.bridgeWitness);
  if (scene.logHotspot) {
    addQuestHotspot({ ...scene.logHotspot, __used: false });
  }
  if (scene.barkHotspot) {
    addQuestHotspot({ ...scene.barkHotspot, __used: false });
  }
  if (scene.birdQuest) startBirdQuest();

  startDialogue(
    scene.exploreIntroDialogue || [
      "The village grows quiet around you.",
      "Someone — or something — still wants to be found."
    ],
    null
  );
}

function markStage3Clue(id) {
  if (!state.stage3Clues) state.stage3Clues = new Set();
  if (state.stage3Clues.has(id)) return;
  state.stage3Clues.add(id);

  const scene = SCENES[state.sceneIndex];
  const n = state.stage3Clues.size;
  if (n < 3 && scene) {
    const tmpl =
      scene.objectiveClueProgress || "Find the final witness. ({n}/3)";
    setObjective(tmpl.replace("{n}", String(n)), { animate: false });
    const hints = scene.clueHintDialogue && scene.clueHintDialogue[id];
    if (hints && hints.length) {
      startDialogue(hints, null);
    }
    return;
  }

  if (state.stage3Phase === "explore") {
    beginStage3Final();
  }
}

function beginStage3Final() {
  const scene = SCENES[state.sceneIndex];
  if (!scene || !scene.finalHotspot) return;
  state.stage3Phase = "final";
  setObjective(scene.objectiveFinal || "Look behind the giant oak.");
  const h = scene.finalHotspot;
  setMapHighlight(h.mapX, h.mapY, h.highlightW, h.highlightH);
  addQuestHotspot({
    ...h,
    __used: false,
    highlight: "highlight-tree"
  });
  startDialogue(
    scene.finalIntroDialogue || [
      "Three paths. Three quiet answers.",
      "And still — something waits behind the oak."
    ],
    null
  );
}

function spawnCarClue(scene) {
  if (state.carHotspot || !scene.carClue || !scene.parkingCars || !scene.parkingCars.length) return;
  const pick = scene.parkingCars[Math.floor(Math.random() * scene.parkingCars.length)];
  state.carHotspot = {
    ...scene.carClue,
    mapX: pick.mapX,
    mapY: pick.mapY,
    mapW: pick.mapW || 32,
    mapH: pick.mapH || 20,
    __used: false
  };
  renderHotspots();
  startDialogue(
    [
      "~Someone mentioned a child's drawing hanging in a car window.~",
      "~There are a few cars in the parking lot...~"
    ],
    null
  );
}

function activateHotspot(h) {
  if (state.dialogueActive || state.titleActive) return;
  if (h.__used) return;

  state.pendingInteract = null;
  cancelPlayerWalk();

  if (!meetsRequirements(h)) {
    startDialogue(h.lockedDialogue || ["..."], null);
    return;
  }

  if (h.touchRect || h.isClue || h.oneTimeDialogue) {
    h.__used = true;
  }

  if (h.id === "sit_tree") return;

  if ((h.isClue || h.id === "carved_log" || h.id === "folded_paper") && window.GameAudio) {
    GameAudio.playClueFound();
  }

  startDialogue(h.dialogue, () => {
    if (h.giveItem) state.items.add(h.giveItem);
    if (h.giveFlag) state.flags.add(h.giveFlag);
    h.__used = true;

    if (h.id === "folded_paper") {
      clearQuestHotspot("folded_paper");
      beginAskWitness();
      return;
    }

    if (h.id === "carved_log") {
      clearQuestHotspot("carved_log");
      markStage3Clue("log");
      return;
    }

    if (h.id === "tree_box" || h.id === "oak_notebook") {
      clearMapHighlight();
    }

    if (h.isClue) {
      state.stage2Phase = "done";
      state.stage3Phase = "done";
      advanceToNextStage();
    } else if (h.triggerChoiceAfter) {
      showChoices();
    }
  });
}

function onHotspotClick(h) {
  if (state.dialogueActive || state.titleActive) return;
  if (!worldIsActive() || !world.player) {
    if (h.x != null) {
      state.pendingInteract = "hotspot";
      walkTo(h.x, h.y, () => {
        if (state.pendingInteract !== "hotspot") return;
        state.pendingInteract = null;
        activateHotspot(h);
      });
    }
    return;
  }

  const fromX = world.player.x;
  const fromY = world.player.y;
  const arrive = () => {
    if (state.pendingInteract !== "hotspot") return;
    state.pendingInteract = null;

    if (h.mapX != null) {
      const near = playerTouchesRect(
        h.mapX,
        h.mapY,
        h.mapW || 28,
        h.mapH || 28,
        18
      );
      if (!near) return;
    }
    activateHotspot(h);
  };

  state.pendingInteract = "hotspot";
  const approachOpts =
    h.touchRect || h.mapW
      ? { mapW: h.mapW || 32, mapH: h.mapH || 20 }
      : null;
  const approach = nearestApproachPoint(h.mapX, h.mapY, approachOpts);

  let tx = approach.x;
  let ty = approach.y;
  if (Math.hypot(fromX - tx, fromY - ty) < 4) {
    const nudged = nearestApproachPoint(h.mapX, h.mapY, {
      mapW: (h.mapW || 32) + 8,
      mapH: (h.mapH || 20) + 8
    });
    if (Math.hypot(fromX - nudged.x, fromY - nudged.y) >= 4) {
      tx = nudged.x;
      ty = nudged.y;
    } else {

      tx = fromX;
      ty = Math.min(WORLD.MAP_H - 4, fromY + 10);
      if (playerBlocked(tx, ty)) {
        tx = fromX + 10;
        ty = fromY;
      }
      walkPlayerToMap(tx, ty, () => {
        walkPlayerToMap(approach.x, approach.y, arrive);
      });
      return;
    }
  }
  walkPlayerToMap(tx, ty, arrive);
}

function onGameClick(e) {
  if (state.titleActive) return;
  if (state.dialogueActive) {
    onDialogueClick(e);
    return;
  }
  if (state.inputLocked) return;
  if (!choiceLayer.classList.contains("hidden")) return;
  if (
    state.stage4Phase === "stars" ||
    state.stage4Phase === "choice" ||
    state.stage4Phase === "ending"
  ) {
    return;
  }
  if (worldIsActive()) {

    state.pendingInteract = null;
    const pos = screenToMap(e.clientX, e.clientY);
    walkPlayerToMap(pos.x, pos.y, null);
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

function prepareDialogueLine(raw, asSpeech) {
  let text = String(raw == null ? "" : raw);
  let kind = "narrate";
  if (text.startsWith("~") && text.endsWith("~") && text.length >= 2) {
    kind = "think";
    text = text.slice(1, -1);
  } else if (asSpeech) {
    kind = "say";
    text = ensureSpeechQuotes(text);
  } else {
    const t = text.trim();
    const fullyQuoted =
      (t.startsWith("\u201C") && t.endsWith("\u201D")) ||
      (t.startsWith('"') && t.endsWith('"'));
    if (fullyQuoted) {
      kind = "say";
      text = ensureSpeechQuotes(t);
    }
  }
  return { kind, text };
}

function ensureSpeechQuotes(text) {
  const t = text.trim();
  if (t.startsWith("\u201C") && t.endsWith("\u201D")) return t;
  if (t.startsWith('"') && t.endsWith('"')) {
    return "\u201C" + t.slice(1, -1) + "\u201D";
  }
  return "\u201C" + t + "\u201D";
}

function escapeHtml(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderDialoguePartial(kind, fullText, visibleLen) {
  const slice = fullText.slice(0, visibleLen);
  const safe = escapeHtml(slice);
  if (kind === "think") return `<em class="dialogue-think">${safe}</em>`;
  if (kind === "say") return `<span class="dialogue-say">${safe}</span>`;
  return `<span class="dialogue-narrate">${safe}</span>`;
}

function startDialogue(lines, onComplete, opts) {
  if (!lines || !lines.length) {
    if (onComplete) onComplete();
    return;
  }
  const asSpeech = opts && opts.speech;
  state.dialogueQueue = lines.map((line) => prepareDialogueLine(line, asSpeech));
  state.dialogueOnComplete = onComplete;
  state.dialogueActive = true;
  if (worldIsActive()) setWorldPaused(true);
  dialogueBox.classList.remove("hidden");
  const sel = window.getSelection && window.getSelection();
  if (sel && sel.removeAllRanges) sel.removeAllRanges();

  if (window.GameAudio) GameAudio.duckMusic(true);
  nextDialogueLine();
}

function nextDialogueLine() {
  if (state.dialogueQueue.length === 0) {
    endDialogue();
    return;
  }
  const prepared = state.dialogueQueue.shift();
  state.currentLineKind = prepared.kind;
  state.currentLineFull = prepared.text;
  state.currentLineRevealed = false;
  dialogueTextEl.innerHTML = renderDialoguePartial(prepared.kind, prepared.text, 0);

  if (window.GameAudio) {
    GameAudio.setNpcTalking(prepared.kind === "say");

    if (
      state.stage4Phase === "ending" &&
      /can you hear them/i.test(prepared.text)
    ) {
      GameAudio.crossfadeToStarsBriefly(true);
    }
  }

  let i = 0;
  clearInterval(state.typewriterTimer);
  state.typewriterTimer = setInterval(() => {
    i++;
    dialogueTextEl.innerHTML = renderDialoguePartial(
      state.currentLineKind,
      state.currentLineFull,
      i
    );
    if (i >= state.currentLineFull.length) {
      clearInterval(state.typewriterTimer);
      state.currentLineRevealed = true;

      if (window.GameAudio) GameAudio.setNpcTalking(false);
    }
  }, TYPEWRITER_MS_PER_CHAR);
}

function onDialogueClick(e) {
  if (e) e.stopPropagation();
  if (!state.dialogueActive) return;

  if (!state.currentLineRevealed) {
    clearInterval(state.typewriterTimer);
    dialogueTextEl.innerHTML = renderDialoguePartial(
      state.currentLineKind,
      state.currentLineFull,
      state.currentLineFull.length
    );
    state.currentLineRevealed = true;

    if (window.GameAudio) GameAudio.setNpcTalking(false);
    return;
  }
  nextDialogueLine();
}

function endDialogue() {
  state.dialogueActive = false;
  dialogueBox.classList.add("hidden");
  if (window.GameAudio) {
    GameAudio.setNpcTalking(false);
    GameAudio.duckMusic(false);
  }
  const cb = state.dialogueOnComplete;
  state.dialogueOnComplete = null;

  if (cb) cb();
  if (!state.dialogueActive && worldIsActive()) setWorldPaused(false);
}

function advanceToNextStage() {
  state.inputLocked = true;
  setWorldPaused(true);
  if (window.GameAudio) {
    GameAudio.playTimeTravel();

    GameAudio.hardSilence();
  }

  flashEl.classList.remove("to-black");
  flashEl.style.background = "";
  flashEl.classList.add("active");

  window.setTimeout(() => {
    flashEl.classList.add("to-black");
  }, 240);

  window.setTimeout(() => {
    const next = state.sceneIndex + 1;
    if (next >= SCENES.length) {
      flashEl.classList.remove("active", "to-black");
      state.inputLocked = false;
      setWorldPaused(false);
      return;
    }
    state.charPos = { x: 50, y: 80 };
    characterEl.style.transitionDuration = "0s";
    characterEl.style.left = "50%";
    characterEl.style.top = "80%";

    loadScene(next);
  }, 780);
}

function handleChoice(choice) {
  choiceLayer.classList.add("hidden");
  state.stage4Phase = "ending";
  state.inputLocked = true;
  setWorldPaused(true);
  world.onProximity = null;

  if (choice === "forget") {
    if (window.GameAudio) GameAudio.keepStarsWithWind();
    playForgetFlashForward(() => {
      startDialogue(ENDINGS.forget, () => playFinalCredits());
    });
  } else {
    if (window.GameAudio) {
      GameAudio.playTimeTravel();
      GameAudio.playRememberCityBed();
    }

    flashEl.classList.remove("to-black");
    flashEl.style.background = "";
    flashEl.classList.add("active");
    window.setTimeout(() => flashEl.classList.add("to-black"), 80);
    window.setTimeout(() => {
      hideNightAtmosphere();
      clearEntities();
      if (world.bgEl) {
        world.bgEl.style.backgroundImage = 'url("assets/maps/stage1.png")';
        world.bgEl.style.filter = "saturate(0%) brightness(0.82)";
      }
      flashEl.classList.remove("active", "to-black");
      startDialogue(ENDINGS.remember, () => playFinalCredits());
    }, 700);
  }
}

function playForgetFlashForward(done) {
  const maps = ["stage1", "stage2", "scene3map", "scene4map"];
  let i = 0;
  hideNightAtmosphere();
  clearEntities();
  flashEl.classList.remove("to-black");
  flashEl.style.background = "#000";
  flashEl.classList.add("active");
  if (window.GameAudio) GameAudio.playTimeTravel();

  const step = () => {
    if (i >= maps.length) {
      window.setTimeout(() => {
        flashEl.classList.remove("active");
        flashEl.style.background = "";
        if (done) done();
      }, 400);
      return;
    }
    const id = maps[i++];
    if (i > 1 && window.GameAudio) GameAudio.playTimeTravel();
    if (world.bgEl) {
      world.bgEl.style.backgroundImage = `url("assets/maps/${id}.png")`;
      world.bgEl.style.filter =
        id === "stage1"
          ? "saturate(0%) brightness(0.8)"
          : id === "scene4map"
            ? "brightness(0.45) saturate(0.7)"
            : "brightness(0.7)";
    }
    flashEl.classList.remove("active");
    window.setTimeout(() => {
      flashEl.classList.add("active");
      window.setTimeout(step, 280);
    }, 420);
  };
  window.setTimeout(step, 200);
}

function playFinalCredits() {
  hideStarsOverlay();
  hideNightAtmosphere();
  setObjective("");
  choiceLayer.classList.add("hidden");
  dialogueBox.classList.add("hidden");
  if (window.GameAudio) GameAudio.playEndingTheme();

  const overlay = document.getElementById("ending-overlay");
  const quoteEl = document.getElementById("ending-quote");
  const quoteText = document.getElementById("ending-quote-text");
  const quoteAttr = document.getElementById("ending-quote-attr");
  const creditsEl = document.getElementById("ending-credits");
  const creditsLine = document.getElementById("ending-credits-line");
  if (!overlay || !quoteEl) return;

  if (quoteText) quoteText.textContent = ENDING_QUOTE;
  if (quoteAttr) quoteAttr.textContent = ENDING_QUOTE_ATTR;

  overlay.classList.remove("hidden");
  quoteEl.classList.remove("visible");
  quoteEl.classList.add("hidden");
  if (creditsEl) {
    creditsEl.classList.remove("visible");
    creditsEl.classList.add("hidden");
  }
  void overlay.offsetWidth;
  overlay.classList.add("visible");

  window.setTimeout(() => {
    quoteEl.classList.remove("hidden");
    void quoteEl.offsetWidth;
    quoteEl.classList.add("visible");
  }, 1000);

  window.setTimeout(() => {
    quoteEl.classList.remove("visible");
    window.setTimeout(() => {
      quoteEl.classList.add("hidden");
      rollCredits(creditsEl, creditsLine);
    }, 1400);
  }, 1000 + 4500);
}

function rollCredits(creditsEl, creditsLine) {
  if (!creditsEl || !creditsLine) return;
  const lines = typeof CREDITS !== "undefined" ? CREDITS : ["Thank you for looking up."];
  const replayBtn = document.getElementById("replay-button");
  let i = 0;
  creditsEl.classList.remove("hidden");
  void creditsEl.offsetWidth;
  creditsEl.classList.add("visible");
  if (replayBtn) {
    replayBtn.classList.remove("visible");
    replayBtn.classList.add("hidden");
  }

  const showNext = () => {
    if (i >= lines.length) return;
    creditsLine.style.opacity = "0";
    window.setTimeout(() => {
      const raw = String(lines[i++] || "");
      creditsLine.textContent = raw.replace(/\t/g, "  ");
      creditsLine.style.opacity = "1";
      const isLast = i >= lines.length;
      if (isLast) {
        window.setTimeout(() => showReplayButton(replayBtn), 5500);
      } else {
        const hold = raw.includes("\n") ? 4500 : 2400;
        window.setTimeout(showNext, hold);
      }
    }, 500);
  };
  creditsLine.style.transition = "opacity 0.6s ease";
  showNext();
}

function showReplayButton(replayBtn) {
  if (!replayBtn) return;
  replayBtn.classList.remove("hidden");
  void replayBtn.offsetWidth;
  replayBtn.classList.add("visible");
}

document.addEventListener("DOMContentLoaded", init);
