// ALI STYLE — "float like a butterfly": the low loose guard, the float and the ALI SHUFFLE. Run it with:
//     npx esbuild src/game/Game.ts    --bundle --format=esm --platform=node --outfile=.__game.mjs --external:three
//     npx esbuild src/game/poses.ts   --bundle --format=esm --platform=node --outfile=.__poses.mjs --external:three
//     node alitest.mjs
// (or just `npm run test:ali`, which does all three)
//
// The design rule this file audits: **a stance, not a buff.** The style changes how the machine STANDS, FLOATS and
// DANCES; it does not touch the dodge economy, the damage tables, the tells or the punch speeds — and the one number
// it does move (the footwork pace) is capped at +8%, because "float like a butterfly" is a footwork claim. Sections:
//   §1  THE STANCE — hands lower, looser and wider than the game's guard (a style, not an upgrade)
//   §2  THE FLOAT — the weave, the roll, the head and the sink all move, all bounded, none in phase
//   §3  THE ALI SHUFFLE — the tap cadence is rapid but real, and the feet never cross
//   §4  IT IS A STANCE, NOT A BUFF — the dodge economy and the punch book are untouched, and the pace is capped
//   §5  THE BUTTON — Y is the stance and nothing else (the pose that had the key gave it up, still in the book)
//   §6  WIRING — the player only, in the live path (checked in the source, not promised)
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Robot } from './.__robot.mjs';
import {
  ALI_CARRY,
  ALI_FLOAT,
  ALI_FLOAT_RATE,
  ALI_GUARD,
  ALI_HEAD,
  ALI_SPEED,
  ALI_TILT,
  ALI_WEAVE,
  DODGE_CFG,
  GUARD,
  MOVES,
  STAM_SCALE,
  aliFloat,
  aliHead,
  aliIdlePose,
  aliRoll,
  aliStanceWeight,
  aliWeave,
} from './.__game.mjs';
import { FREESTYLE } from './.__poses.mjs';

let fails = 0;
const ok = (label, cond, info = '') => {
  if (!cond) fails++;
  console.log(`   ${cond ? 'PASS' : 'FAIL'}  ${label}${info ? '   ' + info : ''}`);
};
const f = (v) => (Math.round(v * 1000) / 1000).toFixed(3);

// ==================================================================== §1 the stance
console.log('\n§1  the stance — the hands come down');
{
  ok('the hands drop off the jaw', Math.abs(ALI_GUARD.sx) < Math.abs(GUARD.sx) * 0.6, `sx ${f(ALI_GUARD.sx)} vs guard ${f(GUARD.sx)}`);
  ok('...and open up a little (elbows wider)', ALI_GUARD.sz > GUARD.sz, `sz ${f(ALI_GUARD.sz)} vs ${f(GUARD.sz)}`);
  ok('...with the arms less folded (fists further from the face)', Math.abs(ALI_GUARD.ex) < Math.abs(GUARD.ex), `ex ${f(ALI_GUARD.ex)} vs ${f(GUARD.ex)}`);
  ok('...and not tucked in behind the gloves', Math.abs(ALI_GUARD.sy) < Math.abs(GUARD.sy), `sy ${f(ALI_GUARD.sy)} vs ${f(GUARD.sy)}`);
  // ...which is why it is a STYLE: it covers up less than the guard does. If it ever covered MORE it would be a free
  // upgrade, and the whole point of the toggle would be gone.
  const cover = (p) => Math.abs(p.sx) + Math.abs(p.ex) + Math.abs(p.sy) - p.sz;
  ok('it is deliberately the LOOSER guard (never a free upgrade)', cover(ALI_GUARD) < cover(GUARD), `coverage ${f(cover(ALI_GUARD))} vs ${f(cover(GUARD))}`);
  // the rise and fall of the low guard: it has to be BIG enough to read from the broadcast camera — this is the
  // number that decided whether the style looked like a stance at all
  const drift = (() => {
    const s = [...Array(80)].map((_, i) => aliIdlePose(i * 0.04));
    return Math.max(...s.map((p) => p.sx)) - Math.min(...s.map((p) => p.sx));
  })();
  ok('the low guard itself rides up and down on the float', drift >= 0.1, `${f(drift)} rad of movement (was ±0.06)`);
  ok('it never wanders far from the stance it is afloat around', [...Array(80)].every((_, i) => {
    const p = aliIdlePose(i * 0.04);
    return Math.abs(p.sx - ALI_GUARD.sx) <= 0.13 && p.sy === ALI_GUARD.sy && p.sz === ALI_GUARD.sz && p.ex === ALI_GUARD.ex;
  }));
}

// ==================================================================== §2 the float
console.log('\n§2  the float — the upper body never settles');
{
  const cycle = [...Array(80)].map((_, i) => i * 0.02);
  const amp = (fn) => Math.max(...cycle.map(fn)) - Math.min(...cycle.map(fn));
  // a full weave takes 2π/rate seconds: at this rate the upper body completes one drift every ~1.4 s — alive, but
  // still a FLOAT (the fast rhythm is the shuffle's job, not the torso's)
  const WEAVE_T = (2 * Math.PI) / ALI_FLOAT_RATE;
  ok('the weave crosses the centre line (a moving target)', Math.abs(aliWeave(0)) < 0.01 && Math.abs(aliWeave(WEAVE_T / 4)) > ALI_WEAVE * 0.9, `weave swings ±${f(ALI_WEAVE)} every ${f(WEAVE_T)} s`);
  ok('...at a rate that reads as a drift, not a twitch', WEAVE_T > 0.9 && WEAVE_T < 2.2, `one weave every ${f(WEAVE_T)} s`);
  ok('...and every term is BIG enough to see at fight distance', ALI_WEAVE >= 0.15 && ALI_TILT >= 0.1 && ALI_HEAD >= 0.2 && ALI_FLOAT >= 0.08, `weave ±${f(ALI_WEAVE)} · roll ±${f(ALI_TILT)} · head ±${f(ALI_HEAD)} · sink ${f(ALI_FLOAT)}`);
  ok('the pelvis rolls with it', amp(aliRoll) > 0.15 && amp(aliRoll) <= 0.3, `±${f(ALI_TILT)} (${f(amp(aliRoll))} peak to peak)`);
  ok('the head moves too (never a static face)', amp(aliHead) > 0.3 && amp(aliHead) <= 0.5, `±${f(ALI_HEAD)} (${f(amp(aliHead))} peak to peak)`);
  ok('the float sinks and rises (a bounce in the legs)', amp(aliFloat) > 0.02 && Math.min(...cycle.map(aliFloat)) >= 0, `0 → ${f(ALI_FLOAT)}`);
  ok('none of them are in phase (it reads as a drift, not a metronome)', Math.abs(aliWeave(0.4) - aliRoll(0.4)) > 0.02 && Math.abs(aliRoll(0.4) - aliHead(0.4)) > 0.02, 'three different phase offsets');
  ok('every term is periodic at the float rate (a bounded drift, never a runaway)', [aliWeave, aliRoll, aliHead].every((fn) => Math.abs(fn(1.7) - fn(1.7 + WEAVE_T)) < 1e-9), `period ${f(WEAVE_T)} s`);
  ok('the style is FULL while standing', aliStanceWeight('idle', false, false) === 1);
  ok('...CARRIED (reduced) while walking, so it is visible in motion too', aliStanceWeight('idle', false, true) === ALI_CARRY && ALI_CARRY >= 0.5 && ALI_CARRY < 1, `${ALI_CARRY} of the stance while moving`);
  ok('...and gone while blocking / swinging / hurt', aliStanceWeight('idle', true, false) === 0 && aliStanceWeight('attack', false, false) === 0 && aliStanceWeight('stagger', false, false) === 0 && aliStanceWeight('down', false, false) === 0);
}

// ==================================================================== §3 the shuffle
console.log('\n§3  the ALI SHUFFLE — the feet dance while he stands there');
{
  const src = readFileSync(new URL('./src/game/robot.ts', import.meta.url), 'utf8');
  const dur = Number(/const ALI_TAP_DUR = ([\d.]+)/.exec(src)?.[1]);
  const period = Number(/const ALI_TAP_PERIOD = ([\d.]+)/.exec(src)?.[1]);
  const out = Number(/const ALI_TAP_OUT = ([\d.]+)/.exec(src)?.[1]);
  ok('the cadence is genuinely rapid', period > 0.1 && period < 0.2, `a tap every ${f(period)} s (≈${f(1 / period)} taps/s)`);
  ok('...but a real foot, not a blur', dur >= 0.12 && dur <= 0.22 && dur <= period + 0.02, `each tap lasts ${f(dur)} s`);
  ok('the tap is a HALF-STEP, not a lunge — and not a shuffle you cannot see', out >= 0.4 && out <= 0.7, `${f(out)} units out of a ~1.2-wide stance`);
  ok('the dance alternates feet', /this\.aliSide = 1 - this\.aliSide/.test(src));
  ok('it rides the same foot solver as every other step (no teleporting)', /f\.aliStep = true;[\s\S]{0,400}?f\.stepping = true;/.test(src) && /else if \(f\.aliStep\) \{[\s\S]{0,200}?tl = \{ x: f\.tx, z: f\.tz \}/.test(src));
  ok('a foot mid-step is never re-launched (the dance waits its turn)', /if \(!f\.stepping && !o\.stepping && this\.balanceCooldown <= 0\) \{[\s\S]{0,900}?f\.aliStep = true/.test(src));
  ok('the dance fades out the moment he actually walks or gets hit', /const aliAmt = clamp\(a\.shuffle \?\? 0, 0, 1\) \* \(1 - this\.gaitW\)[\s\S]{0,80}?a\.hit < 0\.2/.test(src), 'gait weight and hit response both cut it');
  // the rock is what makes it a DANCE instead of fidgeting: it has to be big (sway ≥ 0.2, roll ≥ 0.12)
  // read them out of the DANCE branch specifically (the file has other, smaller sideways pushes in the dash / gait
  // branches, and the only place the shuffle's own rock is written is the block marked THE ROCK)
  const rockAt = src.indexOf('// THE ROCK:');
  const rock = src.slice(rockAt, rockAt + 500);
  const sway = Number(/sway \+= -s \* ([\d.]+) \* w;/.exec(rock)?.[1]);
  const roll = Number(/roll \+= s \* ([\d.]+) \* w;/.exec(rock)?.[1]);
  ok('it adds a big lateral rock (that rock is the shuffle\'s whole read)', sway >= 0.2 && roll >= 0.12, `sway ${f(sway)} · roll ${f(roll)} per tap`);
  ok('...and the float lifts the body while it dances', /const bob = \(h - 0\.5\) \* \(0\.045 \+ aliAmt \* ([\d.]+)\)/.test(src), 'the pendulum grows with the dance');
}

// ==================================================================== §4 stance, not buff
console.log('\n§4  a stance, not a buff');
{
  ok('the footwork pace is capped (a style, not a speed hack)', ALI_SPEED > 1 && ALI_SPEED <= 1.1, `+${Math.round((ALI_SPEED - 1) * 100)}%`);
  // the dodge economy is the thing the balance harness guards; the style must not have touched a single number of it
  // the exact table the dodge-balance pass shipped (the numbers balancetest.mjs audits): the style must not have
  // moved a single cell of it — that is the difference between a stance and a buff
  const before = { evade: [13, 0.34], fwd: [10, 0.3], back: [12, 0.34], side: [11, 0.32] };
  ok('...and it did not touch the dodge economy', ['evade', 'fwd', 'back', 'side'].every((k) => DODGE_CFG[k].cost === before[k][0] && Math.abs(DODGE_CFG[k].cd - before[k][1]) < 1e-9) && STAM_SCALE === 0.6, Object.keys(before).map((k) => `${k} ${DODGE_CFG[k].cost} stam · ${DODGE_CFG[k].cd}s`).join(' · '));
  ok('the punch book is untouched (same six basics, same Overdrive family)', MOVES.jab.dmg === 7 && MOVES.cross.dmg === 11 && MOVES.hook.dmg === 13 && MOVES.upper.dmg === 15 && MOVES.bolt.dmg === 32, 'jab 7 · cross 11 · hook 13 · upper 15 · bolt 32');
  const srcG = readFileSync(new URL('./src/game/Game.ts', import.meta.url), 'utf8');
  // the slice has to end where the ALI STYLE block ends: PANJER (the hold-to-load mechanic) sits between it and
  // SWING DYNAMICS and is a different feature with its own numbers
  const block = srcG.slice(srcG.indexOf('ALI STYLE — float like a butterfly'), srcG.indexOf('PANJER — hold a punch button'));
  ok('the style touches no damage, stamina, tell or dodge number', !/dmg|stam|cost|TELL|DODGE_CFG|knock/.test(block), 'only posture, cadence and pace');
  ok('...and no randomness anywhere in it', !/Math\.random/.test(block));
}

// ==================================================================== §5 the button
console.log('\n§5  Y is the ALI STYLE stance and nothing else');
{
  const src = readFileSync(new URL('./src/game/Game.ts', import.meta.url), 'utf8');
  ok('Y toggles the style', /if \(code === 'KeyY'\) \{[\s\S]{0,900}?this\.toggleAliStyle\(\)/.test(src));
  ok('Y is out of the freestyle key list', !/case 'KeyY':\s*\n\s*case 'KeyO':/.test(src) && /case 'KeyM':\s*\n\s*case 'KeyB':\s*\n\s*case 'KeyO':/.test(src));
  ok('the pose that had the key gave it up (still in the book)', FREESTYLE.every((fs) => fs.key !== 'KeyY') && FREESTYLE.length >= 6);
  ok('the toggle is a toggle (pressing it twice is off again)', /this\.aliStyle = !this\.aliStyle/.test(src));
}

// ==================================================================== §6b it answers everywhere
console.log('\n§6b the button answers where the player actually presses it');
{
  const src = readFileSync(new URL('./src/game/Game.ts', import.meta.url), 'utf8');
  const onEdge = src.slice(src.indexOf('private onEdge('), src.indexOf('private onEdge(') + 2600);
  ok('Y is read BEFORE the fight-only gate (so it works in the lobby and while paused)', onEdge.includes("if (code === 'KeyY')") && onEdge.indexOf("if (code === 'KeyY')") < onEdge.indexOf("if (this.phase !== 'fight' || this.paused) return;"));
  ok('...and it is not ALSO buried in the fight switch (one place, one meaning)', !/case 'KeyY':[^\n]*\n\s*this\.toggleAliStyle\(\);/.test(src));
  ok('toggling answers with a banner (not just a popup off screen)', /this\.showBanner\(on \? '🦋 ALI STYLE'/.test(src));
  ok('...plus a sound and a burst on the fighter', /this\.sfx\.cheer\(on \? 0\.85/.test(src) && /this\.fx\.ring\(p\.pos\.x, p\.pos\.y, on \? 0x8ff0ff/.test(src));
  ok('the LOBBY hero reacts too (press Y in the menu and he dances)', /const heroSt = this\.heroAnimState\(this\.heroPose/.test(src) && /if \(this\.aliStyle && \(this\.heroPose === 'ready' \|\| this\.heroPose === 'guard' \|\| this\.heroPose === 'stand'\)\)/.test(src) && /heroSt\.shuffle = 1;/.test(src));
  ok('...without hijacking the poses the player chose from the menu', /\(this\.heroPose === 'ready' \|\| this\.heroPose === 'guard' \|\| this\.heroPose === 'stand'\)/.test(src), 'victory / taunt / sombong are left alone');
  ok('the HUD badge is loud enough to notice', /ALI STYLE · ALI SHUFFLE/.test(readFileSync(new URL('./src/ui/Hud.tsx', import.meta.url), 'utf8')));
}

// ==================================================================== §6 wiring
console.log('\n§6  wiring — the player only, in the live path');
{
  const src = readFileSync(new URL('./src/game/Game.ts', import.meta.url), 'utf8');
  ok('the stance blends only for the player', /if \(this\.aliStyle && f\.isPlayer\) \{/.test(src));
  ok('the shuffle reaches the rig only for the player', /shuffle: this\.aliStyle && f\.isPlayer \?/.test(src));
  ok('the rig actually consumes it', /const aliAmt = clamp\(a\.shuffle \?\? 0/.test(readFileSync(new URL('./src/game/robot.ts', import.meta.url), 'utf8')));
  ok('the HUD knows about it (the low guard is never a mystery)', /ali: this\.aliStyle/.test(src) && /ali\?: boolean|  ali: boolean/.test(src));
  ok('the pace bonus is applied to the player walk multiplier', /const walkMul = \(0\.88 \+ 0\.16 \* this\.fwMul\) \* \(this\.aliStyle \? ALI_SPEED : 1\)/.test(src));
  // STAR MODE's auto-guard and ALI STYLE are mutually exclusive: a raised guard and a low loose one cannot both be
  // on, and the stance has to WIN — otherwise the style is invisible in exactly the mode the player plays most.
  ok('ALI STYLE wins over the STAR MODE auto-guard (the stance would be invisible otherwise)', /if \(this\.starMode && !this\.aliStyle && !wantBlockKey && starShouldGuard/.test(src));
  ok('...but the manual guard is never taken away (holding G still blocks)', /wantBlockKey/.test(src.slice(src.indexOf('p.autoGuard = false;'), src.indexOf('p.autoGuard = false;') + 900)));
}

// ==================================================================== §7 measured on the REAL rig
// Everything above is geometry on paper. This section drives the actual Robot (the same rig the game animates) and
// measures the world-space movement of the fists, the head and the boots — because "it feels the same" is a claim
// about what the rig does, and the answer has to be a number in metres.
console.log('\n§7  measured on the real rig (forward kinematics, 4 s of idle)');
{
  const STYLE = { variant: 'atom', main: 0x8a8f98, secondary: 0x3a3f47, accent: 0x1e9bff, glow: 0x63e0ff };
  const mk = (shuffle) => ({
    arms: [{ ...GUARD }, { ...GUARD }], twist: 0, lean: 0.08, lunge: 0, dip: 0.12, roll: 0,
    vf: 0, vl: 0, af: 0, al: 0, yawRate: 0, hit: 0, hitSign: 1, hitUp: 0, fall: 0, air: 0, time: 0,
    glow: 0, flash: 0, tilt: 0, dash: 0, dashF: 0, dashL: 1, idleBounce: 1, shuffle,
  });
  const measure = (mode) => {
    const r = new Robot(STYLE, 1);
    r.snapFeet();
    const fistY = [], fistX = [], headX = [], footX = [];
    const D = 1 / 60;
    for (let i = 0; i * D < 4; i++) {
      const t = i * D;
      const a = mk(mode === 'normal' ? 0 : 1);
      if (mode === 'normal') {
        // the game's ordinary idle: the guard, with its small breathing wobble
        const sw = Math.sin(t * 4) * 0.06;
        a.arms = [{ ...GUARD, sx: GUARD.sx + sw }, { ...GUARD, sx: GUARD.sx - sw }];
        a.roll = Math.sin(t * 2.6) * 0.03;
        a.dip = 0.15 + Math.sin(t * 5.2) * 0.035;
      } else {
        const ap = aliIdlePose(t);
        a.arms = [ap, ap];
        a.twist = aliWeave(t);
        a.roll = aliRoll(t);
        a.dip = 0.15 + aliFloat(t);
        a.headYaw = aliHead(t);
      }
      r.animate(a, D);
      const f = r.fists[0].getWorldPosition(new THREE.Vector3());
      const h = r.head.getWorldPosition(new THREE.Vector3());
      fistY.push(f.y);
      fistX.push(f.x);
      headX.push(h.x);
      footX.push(r.feet[0].curX);
    }
    const span = (arr) => Math.max(...arr) - Math.min(...arr);
    return { fistY: fistY.reduce((s, v) => s + v, 0) / fistY.length, fistX: span(fistX), headX: span(headX), footX: span(footX) };
  };
  const normal = measure('normal');
  const ali = measure('ali');
  ok('the fists drop OUT of the guard (a change you cannot miss)', normal.fistY - ali.fistY >= 0.8, `${f(normal.fistY - ali.fistY)} m lower (${f(normal.fistY)} → ${f(ali.fistY)} m)`);
  ok('the fists drift far more than the ordinary idle wobble', ali.fistX >= normal.fistX * 2, `${f(ali.fistX)} m vs ${f(normal.fistX)} m of sway`);
  ok('the HEAD is a moving target, not a static face', ali.headX >= normal.headX * 3, `${f(ali.headX)} m vs ${f(normal.headX)} m of lateral travel`);
  // ...and the shuffle, on the same rig: one boot has to actually dance
  const shuffling = (() => {
    const r = new Robot(STYLE, 1);
    r.snapFeet();
    const xs = [];
    const D = 1 / 60;
    for (let i = 0; i * D < 4; i++) {
      r.animate(mk(1), D);
      xs.push(r.feet[0].curX);
    }
    return Math.max(...xs) - Math.min(...xs);
  })();
  ok('...and the SHUFFLE actually moves a boot', shuffling >= 0.3, `${f(shuffling)} m of travel from one boot in 4 s (0.00 m without the style)`);
  ok('the ordinary fight is untouched by any of it', normal.footX === 0, 'the plain idle never moves a foot');
}

console.log(fails === 0 ? '\nALI STYLE: ALL PASS\n' : `\n${fails} FAILURE(S)\n`);
process.exit(fails === 0 ? 0 : 1);
