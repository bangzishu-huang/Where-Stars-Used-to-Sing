const VOL = {
  footsteps: 0.75,
  talking: 0.38,
  timeTravel: 0.72,
  stageStart: 0.58,
  clue: 0.5,
  stars: 0.26,
  starsForget: 0.18,
  starsRememberBrief: 0.28,
  windWithStars: 0.18,
  ending: 0.5,
  sfxDefault: 0.6
};

const AUDIO = {
  base: "../assets/audio/",
  unlocked: false,
  muted: false,

  duckFactor: 0.32,
  ducked: false,
  walking: false,
  sceneId: null,

  bgm: null,
  ambient: null,
  footsteps: null,
  talking: null,
  stars: null,
  ending: null,

  _live: new Set(),

  _gen: { bgm: 0, ambient: 0, footsteps: 0, stars: 0, ending: 0, talking: 0 },

  _fades: new Map(),
  _footKind: null,
  _preDuck: null,
  _unduckTimer: null,
  _watchTimer: null
};

const AUDIO_FILES = {
  scene1: "scene1.ogg",
  scene2: "scene2.ogg",
  scene3: "scene3.ogg",
  cityFoot: "cityfootsteps.wav",
  grassFoot: "grassfootsteps.wav",
  cityAmb: "citysounds.wav",
  natureAmb: "naturesounds.wav",
  windAmb: "windsounds.wav",
  clue: "cluefound.wav",
  timeTravel: "timetravel.wav",
  stageStart: "stagestart.wav",
  talking: "talking.wav",
  stars: "stars.wav",
  ending: "ending.ogg"
};

const SCENE_AUDIO = {
  stage1: { bgm: "scene1", ambient: null, foot: "city", bgmVol: 0.25, ambVol: 0 },
  stage2: { bgm: "scene2", ambient: "cityAmb", foot: "city", bgmVol: 0.24, ambVol: 0.6 },
  stage3: { bgm: "scene3", ambient: "natureAmb", foot: "grass", bgmVol: 0.3, ambVol: 0.8 },
  stage4: { bgm: null, ambient: "windAmb", foot: "grass", bgmVol: 0, ambVol: 0.8 }
};

const SILENT_SCENE = { bgm: null, ambient: null, foot: "city", bgmVol: 0, ambVol: 0 };

function audioUrl(key) {
  return AUDIO.base + AUDIO_FILES[key];
}

function scene1BgmAllowed() {
  return AUDIO.sceneId === "stage1" || AUDIO.sceneId === "remember";
}

function isDead(el) {
  return !el || el.dataset.dead === "1";
}

function makeAudio(src, opts) {
  const a = new Audio(src);
  a.preload = "auto";
  a.loop = !!(opts && opts.loop);
  a.volume = 0;
  a.dataset.baseVol = String((opts && opts.volume) != null ? opts.volume : 1);
  a.dataset.dead = "0";
  AUDIO._live.add(a);
  return a;
}

function cancelFade(el) {
  const id = AUDIO._fades.get(el);
  if (id) {
    cancelAnimationFrame(id);
    AUDIO._fades.delete(el);
  }
}

function disposeAudioEl(el) {
  if (!el) return;
  cancelFade(el);
  el.dataset.dead = "1";
  try {
    el.pause();
    el.loop = false;
    el.volume = 0;
    el.removeAttribute("src");
    el.load();
  } catch (_) {}
  AUDIO._live.delete(el);
}

function fadeTo(el, targetVol, ms, onDone) {
  if (!el || isDead(el)) {
    if (onDone) onDone();
    return;
  }
  cancelFade(el);
  const start = el.volume;
  const t0 = performance.now();
  const dur = Math.max(40, ms || 800);

  function tick(now) {
    if (isDead(el)) {
      AUDIO._fades.delete(el);
      if (onDone) onDone();
      return;
    }
    const t = Math.min(1, (now - t0) / dur);
    const s = t * t * (3 - 2 * t);
    el.volume = Math.max(0, Math.min(1, start + (targetVol - start) * s));
    if (t < 1) {
      const id = requestAnimationFrame(tick);
      AUDIO._fades.set(el, id);
    } else {
      AUDIO._fades.delete(el);
      el.volume = targetVol;
      if (targetVol <= 0.001 && el !== AUDIO.footsteps && el !== AUDIO.talking) {
        if (el.loop) {
          try {
            el.pause();
          } catch (_) {}
        }
      }
      if (onDone) onDone();
    }
  }
  const id = requestAnimationFrame(tick);
  AUDIO._fades.set(el, id);
}

function ensurePlay(el) {
  if (!el || isDead(el)) return Promise.resolve();
  const p = el.play();
  if (p && typeof p.catch === "function") {
    return p.catch(() => {});
  }
  return Promise.resolve();
}

function unlockAudio() {
  if (AUDIO.unlocked) return;
  AUDIO.unlocked = true;
  const warm = new Audio(audioUrl("stageStart"));
  warm.volume = 0;
  warm.play().then(() => {
    warm.pause();
  }).catch(() => {});
  startBgmWatchdog();
}

function purgeIllegalScene1() {
  if (scene1BgmAllowed()) return;
  for (const el of [...AUDIO._live]) {
    const src = el.currentSrc || el.src || "";
    if (src.indexOf("scene1.ogg") !== -1 || el.dataset.fileKey === "scene1") {
      disposeAudioEl(el);
      if (AUDIO.bgm === el) AUDIO.bgm = null;
    }
  }
}

function startBgmWatchdog() {

  if (AUDIO._watchTimer != null) {
    window.clearInterval(AUDIO._watchTimer);
    AUDIO._watchTimer = null;
  }
  let ticks = 0;
  AUDIO._watchTimer = window.setInterval(() => {
    purgeIllegalScene1();
    ticks += 1;
    if (ticks >= 10) {
      window.clearInterval(AUDIO._watchTimer);
      AUDIO._watchTimer = null;
    }
  }, 400);
}

function killChannel(refName) {
  const el = AUDIO[refName];
  AUDIO._gen[refName] = (AUDIO._gen[refName] || 0) + 1;
  if (!el) return;
  disposeAudioEl(el);
  AUDIO[refName] = null;
}

function stopChannel(refName, fadeMs) {
  const el = AUDIO[refName];
  if (!el) return;
  if (fadeMs === 0) {
    killChannel(refName);
    return;
  }
  const gen = AUDIO._gen[refName] || 0;
  fadeTo(el, 0, fadeMs != null ? fadeMs : 600, () => {
    if ((AUDIO._gen[refName] || 0) !== gen) return;
    disposeAudioEl(el);
    if (AUDIO[refName] === el) AUDIO[refName] = null;
  });
}

function startLoopChannel(refName, fileKey, targetVol, fadeMs) {
  unlockAudio();

  if (refName === "bgm" && fileKey === "scene1" && !scene1BgmAllowed()) {
    killChannel("bgm");
    return null;
  }

  const prev = AUDIO[refName];
  if (prev && !isDead(prev) && prev.dataset.fileKey === fileKey) {
    ensurePlay(prev);
    fadeTo(prev, targetVol, fadeMs != null ? fadeMs : 1200);
    prev.dataset.baseVol = String(targetVol);
    return prev;
  }

  const gen = (AUDIO._gen[refName] || 0) + 1;
  AUDIO._gen[refName] = gen;
  if (prev) {
    disposeAudioEl(prev);
    if (AUDIO[refName] === prev) AUDIO[refName] = null;
  }

  const el = makeAudio(audioUrl(fileKey), { loop: true, volume: targetVol });
  el.dataset.fileKey = fileKey;
  el.dataset.baseVol = String(targetVol);
  AUDIO[refName] = el;

  ensurePlay(el).then(() => {

    if ((AUDIO._gen[refName] || 0) !== gen || AUDIO[refName] !== el || isDead(el)) {
      disposeAudioEl(el);
      return;
    }
    fadeTo(el, targetVol, fadeMs != null ? fadeMs : 1400);
  });
  return el;
}

function setSceneAudio(sceneId, opts) {
  const cfg = SCENE_AUDIO[sceneId] || SILENT_SCENE;
  AUDIO.sceneId = sceneId;
  const fade = (opts && opts.fadeMs) != null ? opts.fadeMs : 1600;

  purgeIllegalScene1();
  startBgmWatchdog();

  if (cfg.bgm) {
    startLoopChannel("bgm", cfg.bgm, cfg.bgmVol, fade);
  } else {
    killChannel("bgm");
  }

  if (cfg.ambient) {
    startLoopChannel("ambient", cfg.ambient, cfg.ambVol, fade);
  } else {
    killChannel("ambient");
  }

  purgeIllegalScene1();

  AUDIO._footKind = cfg.foot;
  const footKey = cfg.foot === "city" ? "cityFoot" : "grassFoot";
  if (!AUDIO.footsteps || isDead(AUDIO.footsteps) || AUDIO.footsteps.dataset.fileKey !== footKey) {
    if (AUDIO.footsteps) disposeAudioEl(AUDIO.footsteps);
    const f = makeAudio(audioUrl(footKey), { loop: true, volume: VOL.footsteps });
    f.dataset.fileKey = footKey;
    f.dataset.baseVol = String(VOL.footsteps);
    AUDIO.footsteps = f;
  }
  setWalking(false);
}

function setWalking(isWalking) {
  AUDIO.walking = !!isWalking;
  const f = AUDIO.footsteps;
  if (!f || isDead(f)) return;
  if (AUDIO.walking && !AUDIO.ducked) {
    ensurePlay(f);
    fadeTo(f, Number(f.dataset.baseVol) || VOL.footsteps, 120);
  } else {
    fadeTo(f, 0, 100, () => {
      if (!isDead(f)) {
        try {
          f.pause();
        } catch (_) {}
      }
    });
  }
}

function cancelPendingUnduck() {
  if (AUDIO._unduckTimer != null) {
    window.clearTimeout(AUDIO._unduckTimer);
    AUDIO._unduckTimer = null;
  }
}

function duckMusic(on) {
  purgeIllegalScene1();
  AUDIO.ducked = !!on;
  if (on) {
    cancelPendingUnduck();
    AUDIO._preDuck = {
      bgm: AUDIO.bgm && !isDead(AUDIO.bgm) ? Number(AUDIO.bgm.dataset.baseVol) || 0 : 0,
      amb: AUDIO.ambient && !isDead(AUDIO.ambient) ? Number(AUDIO.ambient.dataset.baseVol) || 0 : 0
    };
    if (AUDIO.bgm && !isDead(AUDIO.bgm)) {
      fadeTo(AUDIO.bgm, AUDIO._preDuck.bgm * AUDIO.duckFactor, 500);
    }
    if (AUDIO.ambient && !isDead(AUDIO.ambient)) {
      fadeTo(AUDIO.ambient, AUDIO._preDuck.amb * AUDIO.duckFactor, 500);
    }
    setWalking(false);
  } else {
    cancelPendingUnduck();
    purgeIllegalScene1();
    const pre = AUDIO._preDuck || {};
    if (AUDIO.bgm && !isDead(AUDIO.bgm)) {
      const v = pre.bgm != null ? pre.bgm : Number(AUDIO.bgm.dataset.baseVol) || 0;
      if (v > 0.001) {
        ensurePlay(AUDIO.bgm);
        fadeTo(AUDIO.bgm, v, 700);
      }
    }
    if (AUDIO.ambient && !isDead(AUDIO.ambient)) {
      const v = pre.amb != null ? pre.amb : Number(AUDIO.ambient.dataset.baseVol) || 0;
      if (v > 0.001) {
        ensurePlay(AUDIO.ambient);
        fadeTo(AUDIO.ambient, v, 700);
      }
    }
    AUDIO._preDuck = null;
  }
}

function setNpcTalking(on) {
  if (on) {
    if (!AUDIO.talking || isDead(AUDIO.talking)) {
      AUDIO.talking = makeAudio(audioUrl("talking"), { loop: true, volume: VOL.talking });
      AUDIO.talking.dataset.baseVol = String(VOL.talking);
    }
    ensurePlay(AUDIO.talking);
    fadeTo(AUDIO.talking, VOL.talking, 120);
  } else if (AUDIO.talking && !isDead(AUDIO.talking)) {
    fadeTo(AUDIO.talking, 0, 100, () => {
      if (!isDead(AUDIO.talking)) {
        try {
          AUDIO.talking.pause();
          AUDIO.talking.currentTime = 0;
        } catch (_) {}
      }
    });
  }
}

function playTimeTravel() {
  playSfx("timeTravel", VOL.timeTravel);
}

function playStageStart() {
  playSfx("stageStart", VOL.stageStart);
}

function playSfx(key, vol, opts) {
  if (AUDIO.muted) return null;
  unlockAudio();
  const a = new Audio(audioUrl(key));
  a.volume = vol != null ? vol : VOL.sfxDefault;
  if (opts && opts.loop) a.loop = true;
  ensurePlay(a);
  return a;
}

function playClueFound() {
  duckMusic(true);
  if (AUDIO.bgm && !isDead(AUDIO.bgm)) fadeTo(AUDIO.bgm, 0.05, 400);
  if (AUDIO.ambient && !isDead(AUDIO.ambient)) fadeTo(AUDIO.ambient, 0.05, 400);
  setWalking(false);
  playSfx("clue", VOL.clue);
  cancelPendingUnduck();
  AUDIO._unduckTimer = window.setTimeout(() => {
    AUDIO._unduckTimer = null;
    duckMusic(false);
  }, 1600);
}

function hardSilence() {
  cancelPendingUnduck();
  setNpcTalking(false);
  setWalking(false);
  AUDIO.ducked = false;
  AUDIO._preDuck = null;

  Object.keys(AUDIO._gen).forEach((k) => {
    AUDIO._gen[k] = (AUDIO._gen[k] || 0) + 1;
  });
  killChannel("bgm");
  killChannel("ambient");
  killChannel("stars");
  killChannel("ending");

  for (const el of [...AUDIO._live]) {
    disposeAudioEl(el);
  }
  AUDIO.bgm = null;
  AUDIO.ambient = null;
  AUDIO.stars = null;
  AUDIO.ending = null;

  if (AUDIO.footsteps) {
    disposeAudioEl(AUDIO.footsteps);
    AUDIO.footsteps = null;
  }
  if (AUDIO.talking) {
    disposeAudioEl(AUDIO.talking);
    AUDIO.talking = null;
  }
  AUDIO.sceneId = null;
  purgeIllegalScene1();
}

function silenceAll(ms, onDone) {
  cancelPendingUnduck();
  setNpcTalking(false);
  setWalking(false);
  if (AUDIO.bgm && !isDead(AUDIO.bgm)) fadeTo(AUDIO.bgm, 0, ms != null ? ms * 0.4 : 600);
  if (AUDIO.ambient && !isDead(AUDIO.ambient)) {
    fadeTo(AUDIO.ambient, 0, ms != null ? ms * 0.4 : 600);
  }
  if (AUDIO.stars && !isDead(AUDIO.stars)) fadeTo(AUDIO.stars, 0, 400);
  window.setTimeout(() => {
    if (onDone) onDone();
  }, ms != null ? ms : 2000);
}

function playStarsChoir(opts) {
  unlockAudio();
  const vol = (opts && opts.volume) != null ? opts.volume : VOL.stars;
  const fade = (opts && opts.fadeMs) != null ? opts.fadeMs : 2200;
  if (AUDIO.stars && !isDead(AUDIO.stars) && !AUDIO.stars.paused) {
    fadeTo(AUDIO.stars, vol, fade);
    return AUDIO.stars;
  }
  if (AUDIO.stars) disposeAudioEl(AUDIO.stars);
  const gen = (AUDIO._gen.stars || 0) + 1;
  AUDIO._gen.stars = gen;
  const el = makeAudio(audioUrl("stars"), { loop: true, volume: vol });
  el.dataset.baseVol = String(vol);
  AUDIO.stars = el;
  ensurePlay(el).then(() => {
    if ((AUDIO._gen.stars || 0) !== gen || AUDIO.stars !== el || isDead(el)) {
      disposeAudioEl(el);
      return;
    }
    fadeTo(el, vol, fade);
  });
  return el;
}

function fadeOutStars(ms) {
  if (!AUDIO.stars || isDead(AUDIO.stars)) return;
  const el = AUDIO.stars;
  fadeTo(el, 0, ms != null ? ms : 1600, () => {
    disposeAudioEl(el);
    if (AUDIO.stars === el) AUDIO.stars = null;
  });
}

function keepStarsWithWind() {
  playStarsChoir({ volume: VOL.starsForget, fadeMs: 1800 });
  startLoopChannel("ambient", "windAmb", VOL.windWithStars, 2000);
  killChannel("bgm");
  purgeIllegalScene1();
}

function playRememberCityBed() {

  AUDIO.sceneId = "remember";
  fadeOutStars(800);
  startLoopChannel("bgm", "scene1", 0.4, 1600);
  killChannel("ambient");
}

function crossfadeToStarsBriefly(thenBackToCity) {
  if (AUDIO.bgm && !isDead(AUDIO.bgm)) fadeTo(AUDIO.bgm, 0.08, 900);
  playStarsChoir({ volume: VOL.starsRememberBrief, fadeMs: 1200 });
  if (thenBackToCity) {
    window.setTimeout(() => {
      fadeOutStars(1800);
      purgeIllegalScene1();
      if (AUDIO.bgm && !isDead(AUDIO.bgm) && scene1BgmAllowed()) {
        ensurePlay(AUDIO.bgm);
        fadeTo(AUDIO.bgm, Number(AUDIO.bgm.dataset.baseVol) || 0.4, 1800);
      }
    }, 5200);
  }
}

function playEndingTheme() {
  setNpcTalking(false);
  setWalking(false);
  hardSilence();
  window.setTimeout(() => {
    const el = makeAudio(audioUrl("ending"), { loop: false, volume: 0 });
    el.dataset.baseVol = String(VOL.ending);
    AUDIO.ending = el;
    ensurePlay(el).then(() => {
      if (isDead(el) || AUDIO.ending !== el) {
        disposeAudioEl(el);
        return;
      }
      fadeTo(el, VOL.ending, 5000);
    });
    el.addEventListener("ended", () => {
      fadeTo(el, 0, 800);
    });
  }, 2400);
}

window.GameAudio = {
  unlock: unlockAudio,
  setScene: setSceneAudio,
  setWalking,
  duckMusic,
  setNpcTalking,
  playTimeTravel,
  playStageStart,
  playClueFound,
  silenceAll,
  hardSilence,
  playStarsChoir,
  fadeOutStars,
  keepStarsWithWind,
  playRememberCityBed,
  crossfadeToStarsBriefly,
  playEndingTheme
};
