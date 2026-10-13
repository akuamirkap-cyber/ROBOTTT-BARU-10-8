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
import { readFileSync } from 'node:fs';
import {
  ALI_SPEED,
  PANJER_FREE,
  PANJER_LOADABLE,
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
  ok('the six strike keys no longer fire on the press', !/case 'KeyH':\s*this\.tryAttack/.test(src) && !/case 'KeyX':[^\n]*\n[^\n]*this\.tryAttack/.test(src));
  ok('...they start a LOAD instead', (edge.match(/this\.beginPanjer\(p, PANJER_KEYS\[code\], code\);/g) ?? []).length === 1 && /case 'KeyH':\s*\n\s*case 'KeyJ':\s*\n\s*case 'KeyC':\s*\n\s*case 'KeyK':\s*\n\s*case 'KeyV':\s*\n\s*case 'KeyX':/.test(edge));
  ok('...and the RELEASE is what throws the punch', /release\(code: string\)[\s\S]{0,320}if \(this\.player && this\.player\.panjerKey === code\) this\.firePanjer\(this\.player\);/.test(src));
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
  ok('a full load sparks off the knuckles', /f\.panjerReady && f\.panjerId/.test(src) && /f\.pkTick2 = 0\.07;/.test(src));
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

console.log(fails === 0 ? '\nPANJER: ALL PASS\n' : `\n${fails} FAILURE(S)\n`);
process.exit(fails === 0 ? 0 : 1);
