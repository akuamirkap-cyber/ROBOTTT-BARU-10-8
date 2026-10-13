// PANJER — hold a punch button for a full second and the punch comes out twice as hard. Run it with:
//     npx esbuild src/game/Game.ts --bundle --format=esm --platform=node --outfile=.__game.mjs --external:three
//     node panjertest.mjs
// (or just `npm run test:panjer`, which does both)
//
// The rule the user asked for, in their words, twice:
//   "pukulan yg tombolnya saya pencet panjer lebih dari 1 detik lalu lepas maka pukulan itu lebih kuat 2x dan daya
//    hajarnya 2x lebih kuat jadi kalo dibawah 1 detik maka ya pukulan normal."
//   "pastikan kalo 0.1-0.3 detik tu atau cuma sekelibat pencet maka normal tapi kalo diatas 0.4-1 detik lebih lagi
//    maka semakin lama semakin kuat."
// So the whole feature reduces to ONE decision taken at the moment the button comes up — pukulanShot(held) — and
// this file audits it from both ends: the pure curve and the live path (the source the game actually runs), plus
// the things that must NOT have changed when you just flick the button.
//   §1  THE RULE — a flick (≤0.4 s) is the ordinary punch; 0.4→1 s RAMPS ×1→×2 (the longer the harder); ≥1 s is 2×
//   §2  THE BUTTON — the strike keys load on the press and throw on the RELEASE (and the counter stays instant)
//   §3  THE LOAD IS VISIBLE — the coil pose, the strain, the glow, the sparks, the HUD gauge
//   §4  THE PAYOFF — 2× damage and 2× knockback, on BOTH the launch and the standing pushback
//   §5  THE LOAD IS A COMMITMENT — it dies to a hit, a guard, a launch, the bell, a pause and a lost focus
//   §6  THE OPPONENT CAN DO IT TOO (same rule, same 1 s) — and not too often
//   §7  NOTHING ELSE MOVED — the punch book, the tells and the dodge table are exactly what they were
//   §8  PANJER OTOMATIS (SHIFT) — one press and every punch is a full one, thrown at normal speed
//   §9  SPAM — a held punch button keeps punching, and a miss no longer locks the next punch out
import { readFileSync } from 'node:fs';
import {
  ALI_SPEED,
  PANJER_FREE,
  PANJER_AUTO_ORDER,
  PANJER_LOADABLE,
  PANJER_MODE_KEYS,
  DODGE_CFG,
  MOVES,
  PANJER_AI_CD_MAX,
  PANJER_AI_CD_MIN,
  PANJER_AI_RATE,
  PANJER_AI_STAM,
  PANJER_DMG,
  PANJER_KEYS,
  PANJER_KNOCK,
  PANJER_T,
  STAM_SCALE,
  TANK_POP_CD,
  WHIFF_SLOW,
  WHIFF_TAIL,
  panjerAiRate,
  panjerCharge,
  panjerLabel,
  panjerLoaded,
  panjerPower,
  panjerShot,
  starShouldGuard,
} from './.__game.mjs';

const src = readFileSync(new URL('./src/game/Game.ts', import.meta.url), 'utf8');
const hud = readFileSync(new URL('./src/ui/Hud.tsx', import.meta.url), 'utf8');
const menu = readFileSync(new URL('./src/ui/Menu.tsx', import.meta.url), 'utf8');

let fails = 0;
const ok = (label, cond, info = '') => {
  if (!cond) fails++;
  console.log(`   ${cond ? 'PASS' : 'FAIL'}  ${label}${info ? '   ' + info : ''}`);
};
const f = (v) => (Math.round(v * 1000) / 1000).toFixed(3);
/** the slice of the source that owns a piece of logic, so an assertion cannot match an unrelated line */
const slice = (from, to, len = 4000) => {
  const i = src.indexOf(from);
  if (i < 0) return '';
  const j = to ? src.indexOf(to, i + from.length) : i + len;
  return src.slice(i, j < 0 ? i + len : j);
};

// ==================================================================== §1 the rule
console.log('\n§1  the rule — a flick is a punch, and above it the longer the harder');
{
  ok('a flick window exists at all (the user\'s 0.1-0.3 s)', PANJER_FREE === 0.4 && PANJER_FREE < PANJER_T, `free ≤ ${f(PANJER_FREE)} s, full at ${f(PANJER_T)} s`);
  ok('the ceiling is the 2× the user asked for', PANJER_DMG === 2 && PANJER_KNOCK === 2, `${f(PANJER_DMG)}× / ${f(PANJER_KNOCK)}×`);
  // ...and the rule itself: what a RELEASE turns into
  for (const held of [0.05, 0.1, 0.2, 0.3]) {
    const shot = panjerShot(held);
    ok(`a blink of ${held} s is the ORDINARY punch (no multiplier at all)`, shot.dmgMul === 1 && shot.knockMul === 1 && panjerShot(held).armed === false, '×1 / ×1');
  }
  ok('...the boundary itself is still ordinary (0.4 s exactly)', panjerShot(PANJER_FREE).dmgMul === 1 && panjerShot(0.399).dmgMul === 1);
  // THE RAMP: above the flick window every extra moment is worth more, all the way to the full second
  ok('just above the flick window it has already started to grow', panjerShot(0.42).dmgMul > 1 && panjerShot(0.5).dmgMul > 1, `0.5 s → ${f(panjerShot(0.5).dmgMul)}×`);
  ok('...and it grows the whole way (strictly harder every 0.05 s)', (() => {
    for (let h = PANJER_FREE + 0.05; h <= PANJER_T; h += 0.05) if (!(panjerShot(h).dmgMul > panjerShot(h - 0.05).dmgMul)) return false;
    return true;
  })());
  ok('the middle of the ramp is the middle of the punch', Math.abs(panjerShot(0.7).dmgMul - 1.5) < 1e-9 && Math.abs(panjerShot(0.55).dmgMul - 1.25) < 1e-9, `0.55 s → ${f(panjerShot(0.55).dmgMul)}× · 0.7 s → ${f(panjerShot(0.7).dmgMul)}×`);
  ok('the full second is exactly the 2× the user asked for', panjerShot(1.0).dmgMul === 2 && panjerShot(1.0).knockMul === 2 && panjerLoaded(1.0) === true, 'held 1.000 s → 2× / 2×');
  ok('...and holding it longer does not stack past it', panjerShot(3).dmgMul === 2 && panjerShot(30).dmgMul === 2);
  ok('the curve never dips and never leaves [1, 2]', (() => {
    for (let h = 0; h <= 3.001; h += 0.01) {
      const m = panjerShot(h).dmgMul;
      if (m < 1 || m > PANJER_DMG) return false;
      if (h > 0.01 && m < panjerShot(h - 0.01).dmgMul - 1e-9) return false;
    }
    return true;
  })(), 'sampled every 10 ms from 0 to 3 s');
  ok('the knockback rides the same curve (hajar grows with the hold too)', Math.abs(panjerShot(0.7).knockMul - 1.5) < 1e-9 && panjerShot(0.3).knockMul === 1 && panjerShot(1).knockMul === PANJER_KNOCK);
  ok('the load bar is the same curve normalised 0..1 (what you see is what you throw)', panjerCharge(0) === 0 && panjerCharge(0.4) === 0 && panjerCharge(0.7) === 0.5 && panjerCharge(1) === 1 && panjerCharge(9) === 1);
  ok('the multiplier is printed the way an Indonesian HUD writes it', panjerLabel(1.5) === '×1,5' && panjerLabel(2) === '×2,0');
  ok('the load is timed on the CLOCK, not on the frame count', /panjerSince = performance\.now\(\)/.test(src) && /performance\.now\(\) - f\.panjerSince\) \/ 1000/.test(src));
}

// ==================================================================== §2 the button
console.log('\n§2  the button — load on the press, throw on the RELEASE');
{
  const edge = slice('const tk = tapKind[code];', 'private heroAnimState', 3000);
  ok('the six strike keys no longer fire on the press by themselves', !/case 'KeyH':\s*this\.tryAttack/.test(src) && !/case 'KeyX':[^\n]*\n[^\n]*this\.tryAttack/.test(src));
  ok('...they start a LOAD instead (unless PANJER OTOMATIS is on)', /if \(this\.panjerMode\) \{[\s\S]{0,200}this\.panjerMax\(p, PANJER_KEYS\[code\]\);\s*\n\s*\} else this\.beginPanjer\(p, PANJER_KEYS\[code\], code\);/.test(edge) && /case 'KeyH':\s*\n\s*case 'KeyJ':\s*\n\s*case 'KeyC':\s*\n\s*case 'KeyK':\s*\n\s*case 'KeyV':\s*\n\s*case 'KeyX':/.test(edge));
  ok('...and the RELEASE is what throws the punch', /release\(code: string\)[\s\S]{0,700}if \(this\.player && this\.player\.panjerKey === code\) this\.firePanjer\(this\.player\);/.test(src));
  ok('the reactive COUNTER (L) still fires on the press — it has to answer a fist already in flight', /case 'KeyL':\s*\n\s*this\.tryAttack\(p, 'counter'\);/.test(src));
  ok('...and the throw (P) and the Overdrive (R) are untouched', PANJER_KEYS.KeyP === undefined && PANJER_KEYS.KeyL === undefined && PANJER_KEYS.KeyN === undefined && PANJER_KEYS.KeyR === undefined);
  // the four loadable keys are the four ordinary punches, and they throw the SAME move ids the old cases did
  const map = PANJER_KEYS;
  ok('the six keys load the four ordinary punches', map.KeyH === 'jab' && map.KeyJ === 'hook' && map.KeyC === 'hook' && map.KeyK === 'upper' && map.KeyV === 'upper' && map.KeyX === 'cross');
  ok('every loadable punch really exists in the book', Object.values(map).every((id) => !!MOVES[id] && MOVES[id].dmg > 0), Object.values(map).join(' · '));
  ok('the load dies with the key itself if the window loses focus', /onBlur = \(\) => \{[\s\S]{0,220}this\.player\?\.clearPanjer\(\);/.test(src));
}

// ==================================================================== §3 the tell
console.log('\n§3  the tell — you can SEE him wind it up (that is what pays for the 2×)');
{
  const pose = slice('PANJER: THE FIST THAT IS LOADING', 'ln = lerp(ln, 0.1 + stalk');
  ok('the loading arm pulls back into the move\'s own COIL key', /const coil = ld\.keys\[1\] \?\? ld\.keys\[0\];/.test(pose) && /lerpPose\((a0|a1), load, vis\)/.test(pose));
  ok('...and the coil DEEPENS as the load grows', /0\.62 \+ 0\.38 \* ch/.test(pose));
  ok('...with a strain in it (a tremble that grows)', /Math\.sin\(t \* \(26 \+ 20 \* ch\)/.test(pose));
  ok('...and the pose reads the CHARGE curve, so what you see is what you throw', /const ch = panjerCharge\(f\.panjerHold\)/.test(pose) && /f\.pkVis \* ch/.test(pose));
  ok('the shoulder turns away from the target while it loads', /tw \+= coil\.twist \* 0\.6/.test(pose) && /dp \+= coil\.dip \* 0\.4/.test(pose));
  ok('the body glows brighter as the load fills', /f\.panjerId \? 0\.4 \+ 0\.9 \* panjerCharge\(f\.panjerHold\) : 0/.test(src));
  ok('a full load sparks off the knuckles', /const burning = \(f\.panjerReady && !!f\.panjerId\)/.test(src) && /f\.pkTick2 = f\.panjerReady && f\.panjerId \? 0\.07 : 0\.15;/.test(src));
  ok('it answers out loud when it comes full — for BOTH fighters', /'💪 PANJER SIAP!'/.test(src) && /'⚠️ PANJER MUSUH!'/.test(src) && /this\.sfx\.ready\(\)/.test(src));
  ok('the loading tick rises with the load', /this\.sfx\.tick\(0\.3 \+ 0\.45 \* panjerCharge\(f\.panjerHold\)\)/.test(src));
  ok('the HUD carries a PANJER gauge', /h\.panjer > 0/.test(hud) && /h\.panjerReady \?/.test(hud));
  ok('...that prints the multiplier LIVE while you hold (so you can see it grow)', /h\.panjerMul/.test(hud) && /MAKIN LAMA MAKIN KUAT/.test(hud));
  ok('...and shouts when the load is full', /SIAP — LEPAS! ×2,0/.test(hud));
  ok('the guide explains the hold', /PANJER/.test(menu) && /LEPAS/.test(menu));
}

// ==================================================================== §4 the payoff
console.log('\n§4  the payoff — 2× damage, 2× hajar');
{
  ok('damage is multiplied by the load\'s own number', /if \(a\.panjer > 1\) dmg \*= a\.panjer;/.test(src));
  ok('...which is the value the ramp had reached, not a flag', /f\.panjer = f\.panjerNext > 1 \? f\.panjerNext : 1;/.test(src) && /f\.panjer = 1;/.test(src));
  ok('the multiplier rides on the swing as a one-shot (`panjer`), consumed by startMove', /if \(PANJER_LOADABLE\.includes\(id\)\) \{\s*\n\s*f\.panjer = f\.panjerNext > 1/.test(src) && /f\.panjerNext : 1;[\s\S]{0,90}f\.panjerNext = 0;/.test(src));
  ok('...and only a LOADABLE punch can carry it (never an Overdrive, a throw or a scripted link)', PANJER_LOADABLE.join(',') === 'jab,hook,upper,cross' && MOVES.finisher !== undefined && !PANJER_LOADABLE.includes('finisher') && !PANJER_LOADABLE.includes('skyhook') && !PANJER_LOADABLE.includes('grab') && PANJER_LOADABLE.every((id) => Object.values(PANJER_KEYS).includes(id)));
  ok('...and starting anything else takes the load away instead', /\} else \{\s*\n\s*f\.panjer = 1;\s*\n\s*f\.clearPanjer\(\);/.test(src));
  ok('...and it is set from the release, nowhere else', (src.match(/f\.panjerNext = id && PANJER_LOADABLE\.includes\(id\) \? shot\.dmgMul : 0;/g) ?? []).length === 1);
  const launch = slice('const force = m.knock * (0.72 + big * 0.5)', 'd.airSpin', 1600);
  ok('the LAUNCH of a knockdown is scaled by the same number', /\* panjerKb;/.test(launch) && /const panjerKb = a\.panjer;/.test(src));
  ok('...and the launch ceiling opens up with it (2× has to actually go 2×)', /clamp\(force \* 0\.95, 4\.5, 13\.5 \* panjerKb\)/.test(launch));
  const push = slice('const pushMul = (1.85', 'd.kb.addScaledVector(away, m.knock * pushMul);', 900);
  ok('the standing PUSHBACK is doubled too', /heavyNoDrop \* panjerKb \* chassisKnock\(chassis\)/.test(push) && /d\.kb\.addScaledVector\(away, m\.knock \* pushMul\);/.test(src));
  ok('the loaded punch names itself with the REAL number', /label = `💪 PANJER! \$\{panjerLabel\(a\.panjer\)\}`;/.test(src));
  ok('...and hits the camera like a special (ring + trauma)', /PANJER! \$\{panjerLabel[\s\S]{0,240}this\.trauma = Math\.min\(0\.7/.test(src));
}

// ==================================================================== §5 the commitment
console.log('\n§5  the load is a COMMITMENT, not a buff');
{
  const step = slice('private panjerStep(', 'private playerInput()');
  ok('a hit, a launch, a knockdown, a guard, the bell and a pause all cancel the load', /f\.blocking|f\.autoGuard/.test(step) && /f\.state === 'stagger'/.test(step) && /f\.state === 'air'/.test(step) && /f\.state === 'down'/.test(step) && /this\.phase !== 'fight'/.test(step) && /this\.paused/.test(step));
  ok('...by CLEARING it (a cancelled load never turns into a punch)', /f\.clearPanjer\(\);\s*\n\s*return;/.test(step));
  ok('the AI lets go the moment the load is full; the player has to let go himself', /if \(!isPlayer && f\.panjerReady\) this\.firePanjer\(f\);/.test(step));
  ok('the automatic N combo spends the load (a scripted script cannot bank a loaded fist)', /private startNCombo\([\s\S]{0,240}this\.player\.clearPanjer\(\);/.test(src));
  ok('...and a cancelled load never re-arms the next punch', /const shot = panjerShot\(held\);/.test(src) && /f\.panjerNext\b/.test(src) && /f\.panjerNext = 0;/.test(src));
  ok('the STAR MODE auto-guard steps aside for a loading fist', /starShouldGuard\(p\.state, p\.dodgeT, p\.tauntT, !!p\.panjerId\)/.test(src) && starShouldGuard('idle', 0, 0, true) === false && starShouldGuard('idle', 0, 0, false) === true);
  ok('...while the manual guard is still the manual guard', starShouldGuard('idle', 0, 0) === true);
}

// ==================================================================== §6 the other corner
console.log('\n§6  the opponent loads one up under the same rule');
{
  ok('the AI has a load decision of its own', /PANJER \(AI\)[\s\S]{0,1500}this\.beginPanjer\(e, loadId, null\);/.test(src));
  ok('...it only gambles with a real tank', /e\.stam > PANJER_AI_STAM/.test(src) && PANJER_AI_STAM >= 30);
  ok('...and it is rare enough to read (a capped rate + a cooldown)', panjerAiRate(1, true) < 1 && panjerAiRate(1, true) <= 0.85 && PANJER_AI_CD_MIN >= 5 && PANJER_AI_CD_MAX > PANJER_AI_CD_MIN, `rate ${f(panjerAiRate(1, true))}/s, cd ${PANJER_AI_CD_MIN}-${PANJER_AI_CD_MAX} s`);
  ok('...harder opponents (and a softened player) load more often', panjerAiRate(0.1, false) < panjerAiRate(0.9, false) && panjerAiRate(0.5, false) < panjerAiRate(0.5, true), `${f(panjerAiRate(0.1, false))} < ${f(panjerAiRate(0.9, false))} · soft +${f(panjerAiRate(0.5, true) - panjerAiRate(0.5, false))}`);
  ok('...and it is the SAME curve (one rule for both corners)', !/PANJER_AI_DMG/.test(src) && !/PANJER_AI_KNOCK/.test(src) && /this\.firePanjer\(f\)/.test(src) && (src.match(/panjerShot\(held\)/g) ?? []).length === 1);
  ok('the opponent\'s load is timed by the same clock and the same threshold', !/PANJER_AI_T\b/.test(src) && /panjerLoaded\(f\.panjerHold\)/.test(src));
}

// ==================================================================== §7 nothing else moved
console.log('\n§7  nothing else moved');
{
  ok('the punch book is untouched (jab 7 · cross 11 · hook 13 · upper 15)', MOVES.jab.dmg === 7 && MOVES.cross.dmg === 11 && MOVES.hook.dmg === 13 && MOVES.upper.dmg === 15);
  ok('...and so is every tell, reach and knock value', MOVES.jab.strikeAt === 0.13 && MOVES.jab.impact === 0.24 && MOVES.upper.reach === 3.7 && MOVES.upper.knock === 8 && MOVES.cross.knock === 6 && MOVES.hook.stun === 0.66);
  const d = DODGE_CFG;
  ok('the dodge economy is exactly the table it was', d.evade.cost === 13 && d.fwd.cost === 10 && d.back.cost === 12 && d.side.cost === 11 && d.evade.cd === 0.34 && d.side.cd === 0.32);
  ok('ALI STYLE is still just the footwork bonus', ALI_SPEED === 1.08);
  // the PLAYER's load path — start the hold, time it, decide it — is deterministic. The only dice in the whole
  // feature belong to the AI: how often it chooses to load, and the cooldown it pays afterwards.
  const playerLoad = slice('private beginPanjer(', 'this.ai.panjerCd = PANJER_AI_CD_MIN', 6000);
  ok('the player\'s load is deterministic — no dice anywhere the player can reach', (playerLoad.match(/Math\.random/g) ?? []).length === 0);
  ok('...and the AI\'s dice live in its own branch', (slice('} else {\n      // the AI\'s own release', 'private panjerReady(', 900).match(/Math\.random/g) ?? []).length === 2);
  ok('...the only roll in the decision itself is the one that makes him load', (src.match(/Math\.random\(\) < dt \* panjerAiRate/g) ?? []).length === 1);
}

// ==================================================================== §8 PANJER OTOMATIS
// "mending kalo saya pencet shift panjer maka pukulan automatis yg mentok maks jadi ga perlu pake manjer hjkl kalo
//  mau pukulan maks kecepatan dan hasilnya" — one key, and the hold is not needed any more.
console.log('\n§8  PANJER OTOMATIS (SHIFT) — full power, normal speed, no holding');
{
  ok('SHIFT is the button (either one)', PANJER_MODE_KEYS.join(',') === 'ShiftLeft,ShiftRight');
  ok('...and it is read BEFORE the fight gate, like the other modes (lobby, ring walk, fight, pause)', (() => {
    const edge = slice('private onEdge(', 'const p = this.player;', 2600);
    return /PANJER_MODE_KEYS\.includes\(code\)[\s\S]{0,260}this\.togglePanjerMode\(\);/.test(edge);
  })());
  ok('with the mode on the punch leaves ON THE PRESS (no release, no wait)', /if \(this\.panjerMode\) \{[\s\S]{0,200}this\.panjerMax\(p, PANJER_KEYS\[code\]\);/.test(src));
  ok('...and it leaves at the CEILING', /private panjerMax\(f: Fighter, id: MoveId\) \{\s*\n\s*f\.panjerNext = PANJER_DMG;/.test(src));
  ok('...at full speed: it is the ordinary press path (tryAttack), not the release one', slice('private panjerMax(', 'togglePanjerMode()').includes('this.tryAttack(f, id);'));
  ok('...and in the automatic mode nothing is ever LOADED (no hold to wait for)', !/beginPanjer/.test(slice('private panjerMax(', 'togglePanjerMode()')) && !/panjerHold/.test(slice('private panjerMax(', 'togglePanjerMode()')));
  ok('the multiplier it carries is the same ×2 the manual load tops out at', PANJER_DMG === 2 && /f\.panjerNext = PANJER_DMG;/.test(src) && !/PANJER_AUTO_DMG/.test(src));
  ok('a punch pressed mid-swing still comes out full (the queue keeps the load)', /f\.panjerNext = PANJER_DMG;\s*\n\s*this\.tryAttack\(f, id\);/.test(src));
  ok('the mode answers loudly (banner + shout + a burst on the fighter)', /showBanner\('PANJER OTOMATIS'/.test(src) && /this\.sfx\.charge\(\)/.test(slice('togglePanjerMode()', 'private panjerStep(')) && /this\.fx\.ring\(p\.pos\.x, p\.pos\.y, on \? 0xffd34a/.test(src));
  ok('...and it is remembered between visits (localStorage)', /LS_PANJER_MODE/.test(src) && /loadPanjerMode\(\)/.test(src) && /savePanjerMode\(on\)/.test(src) && /panjerMode = loadPanjerMode\(\);/.test(src));
  // THE TELL SURVIVES: the wind-up is gone, so the fighter himself has to show it
  ok('the tell becomes a STATE: the fists burn while the mode is on', /this\.panjerMode && f\.isPlayer \? 1\.0 : 0/.test(src) && /const burning = \(f\.panjerReady && !!f\.panjerId\) \|\| \(this\.panjerMode && f\.isPlayer\)/.test(src));
  ok('...and the HUD says it, not just the fists', /PANJER OTOMATIS/.test(hud) && /h\.panjerMode/.test(hud));
  ok('...with a touch button, so a phone can switch it too', /onPanjerMode/.test(hud) && /onPanjerMode\?\.\(\)/.test(hud) && /onPanjerMode=\{\(\) => gameRef\.current\?\.togglePanjerMode\(\)\}/.test(readFileSync(new URL('./src/App.tsx', import.meta.url), 'utf8')));
  ok('the manual load gauge stands down while it is on (no double readout)', /h\.panjer > 0 && !h\.panjerMode/.test(hud));
  // SHIFT used to run: one key cannot do both
  ok('SHIFT is no longer the sprint key', !/keys\.has\('ShiftLeft'\)/.test(src) && !/shiftHeld/.test(src));
  ok('...the sprint lives on F (and the double-tap W run latch)', /const runKey = this\.keys\.has\('KeyF'\)/.test(src) && /this\.runLatch && holdW && fwd > 0/.test(src));
  ok('...and the touch RUN button still sends that same F', /code="KeyF" label="RUN"/.test(hud));
  ok('the guide explains both ways of loading a punch', /PANJER OTOMATIS/.test(menu) && /SPRINT sekarang di F|Sprint sekarang di F|sekarang di F/.test(menu));
  ok('turning it off hands the game back to the hold mechanic untouched', /else this\.beginPanjer\(p, PANJER_KEYS\[code\], code\);/.test(src));
  ok('...and switching it on spends any load that was already in the arm', /if \(on\) this\.player\?\.clearPanjer\(\);/.test(src));
  // the editor screens use SHIFT+click: the game must not be listening at all while they are up
  ok('the game stops reading keys while a full-screen editor/sim is open', /if \(this\.inputOff\) return;/.test(src) && /setInputOff\(true\)/.test(readFileSync(new URL('./src/App.tsx', import.meta.url), 'utf8')) && /setInputOff\(false\)/.test(readFileSync(new URL('./src/App.tsx', import.meta.url), 'utf8')));
  // ...and the whole mode is a PLAYER switch: the AI fights the way it always did
  ok('the automatic mode is the player\'s switch (it only ever touches `this.player`)', /this\.panjerMax\(p, PANJER_KEYS\[code\]\)/.test(src) && /const p = this\.player;\s*\n\s*if \(!this\.panjerMode \|\| this\.phase !== 'fight'/.test(src));
  ok('...and the opponent\'s own panjer is exactly what it was', /if \(!isPlayer && f\.panjerReady\) this\.firePanjer\(f\);/.test(src) && /this\.beginPanjer\(e, loadId, null\);/.test(src));
}

// ==================================================================== §9 SPAM
// "saya mau saya bsa spam pukulan" — the two things that stopped a punch STREAM were the whiff lockout and having to
// press the button again. In PANJER OTOMATIS both are lifted for the player; the swing's own cancel window is still
// the metronome, so the animation stays honest.
console.log('\n§9  SPAM — a held button keeps punching (PANJER OTOMATIS only)');
{
  const spamFn = slice('private updateAutoFire()', 'private playerInput()', 2200);
  ok('holding a punch button re-fires it every frame (the press is not needed again)', /private updateAutoFire\(\)/.test(src) && /this\.panjerMax\(p, PANJER_KEYS\[code\]\);/.test(spamFn));
  ok('...it runs every frame of the fight', /this\.panjerStep\(this\.enemy, dt, false\);\s*\n\s*this\.updateAutoFire\(\);/.test(src));
  ok('...only in PANJER OTOMATIS (the manual hold mechanic is untouched)', /if \(!this\.panjerMode \|\| this\.phase !== 'fight' \|\| this\.paused\) return;/.test(spamFn));
  ok('...and it stops when the button comes up', /if \(this\.player && this\.player\.autoFireKey === code\) this\.player\.autoFireKey = null;/.test(src));
  ok('the last button PRESSED wins, with a fixed tie-break while two are held', /let code = p\.autoFireKey && this\.keys\.has\(p\.autoFireKey\) \? p\.autoFireKey : null;/.test(spamFn) && /for \(const c of PANJER_AUTO_ORDER\)/.test(spamFn) && PANJER_AUTO_ORDER.join(',') === 'KeyH,KeyJ,KeyC,KeyK,KeyV,KeyX');
  ok('the held button is remembered on the press', /p\.autoFireKey = code;/.test(slice("case 'KeyX':", 'break;', 400)));
  ok('nothing is thrown while he is on the floor, in the air or out of the round', /p\.state === 'ko' \|\| p\.state === 'down' \|\| p\.state === 'air'/.test(spamFn));
  // THE WHIFF LOCKOUT — the balance rule the user asked to be able to ignore
  ok('a MISS no longer locks the next punch out in this mode', /const spam = this\.panjerMode && f\.isPlayer;/.test(src) && /if \(whiffGates\(f\.whiffT\) && !isOD\(id\) && !spam\) return;/.test(src));
  ok('...but the slow tail still plays (the body still has to come back)', /whiffRecovery/.test(src) && WHIFF_TAIL === 0.42 && WHIFF_SLOW === 0.6);
  ok('...and only for the PLAYER: the opponent\'s over-commitment is untouched', !/spam = this\.panjerMode && !f\.isPlayer/.test(src));
  ok('...the dodge-cancel out of a whiffed swing is NOT lifted (that punishment stays)', /canBailOut = \(whiffT: number, incomingDeadly: boolean\) => !whiffGates\(whiffT\) \|\| incomingDeadly/.test(src));
  // stamina is still the price of a stream (and it no longer shouts every frame)
  ok('the stamina cost of every punch is untouched (a stream still empties the tank)', MOVES.jab.cost === 4 && STAM_SCALE === 0.6);
  ok('...and the empty-tank shout is throttled instead of firing every attempt', /f\.tankPopT = TANK_POP_CD;/.test(src) && TANK_POP_CD >= 0.4 && /if \(f\.isPlayer && f\.tankPopT <= 0\)/.test(src));
  ok('the HUD badge says the mode spams', /SPAM/.test(hud));
  ok('the guide says it too (and says the miss rule is relaxed inside the mode)', /SPAM/.test(menu) && /PUKULAN MELESET[\s\S]{0,120}PANJER OTOMATIS/.test(menu));
}

console.log(fails === 0 ? '\nPANJER: ALL PASS\n' : `\n${fails} FAILURE(S)\n`);
process.exit(fails === 0 ? 0 : 1);
