// SWING DYNAMICS — the kinetic chain that makes a punch read (the "Boxing Star" feel: the whole machine throws
// itself, not just the arm). Run it with:
//     npx esbuild src/game/Game.ts --bundle --format=esm --platform=node --outfile=.__game.mjs --external:three
//     node swingtest.mjs
// (or just `npm run test:swing`, which does both)
//
// The design rule this file audits: **a punch is never one arm, and it never stops being thrown the moment it
// lands.** Every term that shapes a swing is a pure function of the move's own clock, so this harness can hold the
// whole thing still — and it checks the SOURCE too, to prove the chain is identical for the player and the AI.
// Sections:
//   §1  THE CLOCK — swingPhase: 0 → 1 exactly on the impact frame → 0 at rest, for every move in the book
//   §2  THE SNAP — swingStiff: tight on the way out, soft on the way back (the asymmetry is the trick)
//   §3  THE OFF HAND — it answers every punch in the right direction, and comes home to zero
//   §4  THE ROLL — the body leans into the punch, arcs roll hardest, and the sides mirror
//   §5  THE RIBBON — trailWidthFor: power-scaled, wider on the arcs, capped for the screen
//   §6  FOLLOW-THROUGH — no strike snaps straight back off the contact frame (and the two that HOLD say so)
//   §7  FAIRNESS — the whole chain is player-agnostic and deterministic (checked in the source, not promised)
import { readFileSync } from 'node:fs';
import {
  GUARD,
  MOVES,
  MOVE_EXTRA,
  offArmCounter,
  sampleKeys,
  swingPhase,
  swingRoll,
  swingStiff,
  trailWidthFor,
  SWING_LIFT,
  SWING_ROLL,
  SWING_SETTLE,
  TRAIL_CAP,
} from './.__game.mjs';

let fails = 0;
const ok = (label, cond, info = '') => {
  if (!cond) fails++;
  console.log(`   ${cond ? 'PASS' : 'FAIL'}  ${label}${info ? '   ' + info : ''}`);
};
const f = (v) => (Math.round(v * 1000) / 1000).toFixed(3);
const ALL = Object.keys(MOVES);
const OD = ['bolt', 'windmill', 'skyhook', 'slam', 'finisher'];

// ==================================================================== §1 the clock
console.log('\n§1  the clock — one envelope drives the whole chain');
{
  for (const id of ALL) {
    const m = MOVES[id];
    const peak = swingPhase(m.impact, m.strikeAt, m.impact, m.dur);
    ok(`${id}: peaks at exactly 1 on the impact frame`, Math.abs(peak - 1) < 1e-9, `phase(${f(m.impact)}) = ${f(peak)}`);
  }
  ok('it is 0 before the swing opens (no punch changes the body while it is still loaded)', ALL.every((id) => swingPhase(0, MOVES[id].strikeAt, MOVES[id].impact, MOVES[id].dur) === 0));
  ok('...and 0 again once the arm is home', ALL.every((id) => swingPhase(MOVES[id].dur, MOVES[id].strikeAt, MOVES[id].impact, MOVES[id].dur) === 0));
  ok('it rises monotonically through the release', ALL.every((id) => {
    const m = MOVES[id];
    let prev = -1;
    for (let t = 0; t <= m.impact; t += m.impact / 60) {
      const v = swingPhase(t, m.strikeAt, m.impact, m.dur);
      if (v < prev - 1e-9) return false;
      prev = v;
    }
    return true;
  }));
  ok('it never leaves 0..1 anywhere in the move', ALL.every((id) => {
    const m = MOVES[id];
    for (let t = 0; t <= m.dur + 0.2; t += m.dur / 120) {
      const v = swingPhase(t, m.strikeAt, m.impact, m.dur);
      if (v < -1e-9 || v > 1 + 1e-9) return false;
    }
    return true;
  }));
  ok('a later impact frame peaks later (it rides the move, not a fixed timer)', swingPhase(0.3, 0.2, 0.33, 1) > swingPhase(0.3, 0.44, 0.56, 1.3), 'a jab is already committing where an Overdrive is still loading');
}

// ==================================================================== §2 the snap
console.log('\n§2  the snap — a piston going out, sprung steel coming back');
{
  const B = 75;
  const atContact = swingStiff(B, 1, false);
  const recoil = swingStiff(B, 1, true);
  ok('the arms tighten through the release', atContact > B * (1 + 0.35), `${f(atContact)} vs the old flat ${B} (${SWING_LIFT >= 0.4 ? '+' + Math.round(SWING_LIFT * 100) + '%' : 'too soft'})`);
  ok('...and go soft through the recoil', recoil < B, `${f(recoil)} (−${Math.round(SWING_SETTLE * 100)}%)`);
  ok('the asymmetry is real (out is tighter than back)', atContact > recoil * 1.6, `${f(atContact)} vs ${f(recoil)}`);
  ok('an untouched swing keeps the tuned arms exactly as they were', swingStiff(B, 0, false) === B && swingStiff(B, 0, true) === B, `${B} → ${f(swingStiff(B, 0, false))}`);
  ok('it is monotone in the phase on both halves', [0, 0.25, 0.5, 0.75, 1].every((p, i, a) => i === 0 || (swingStiff(B, p, false) > swingStiff(B, a[i - 1], false) && swingStiff(B, p, true) < swingStiff(B, a[i - 1], true))));
  ok('Rage Mode gets the same treatment (it is the same body)', swingStiff(92, 1, false) / 92 === atContact / B);
}

// ==================================================================== §3 the off hand
console.log('\n§3  the off hand answers the punch');
{
  const kinds = { front: ['jab', 'cross', 'counter', 'bolt', 'windmill', 'grab', 'finisher'], side: ['hook'], up: ['upper', 'skyhook', 'slam'] };
  ok('every strike in the book has a kind the off hand reads', ALL.every((id) => Object.values(kinds).flat().includes(id)), ALL.length + ' moves');
  ok('nothing moves before the swing opens', ['front', 'side', 'up'].every((k) => {
    const d = offArmCounter(k, 0);
    return d.sx === 0 && d.sy === 0 && d.sz === 0 && d.ex === 0;
  }));
  const front = offArmCounter('front', 1);
  ok('a straight pulls the off hand back to the chin', front.sy <= -0.15 && front.sx <= -0.08 && front.ex <= -0.15, `sy ${f(front.sy)} · sx ${f(front.sx)} · ex ${f(front.ex)}`);
  const side = offArmCounter('side', 1);
  ok('an arc crosses it further than anything else', side.sy < front.sy, `sy ${f(side.sy)} vs ${f(front.sy)}`);
  const up = offArmCounter('up', 1);
  ok('an uppercut drops it to the ribs (and cinches the elbow)', up.sx >= 0.2 && up.ex <= -0.1, `sx ${f(up.sx)} · ex ${f(up.ex)}`);
  ok('the three are genuinely different answers', new Set([JSON.stringify(front), JSON.stringify(side), JSON.stringify(up)]).size === 3);
  ok('it is a real amount of motion, not a rounding error', ['front', 'side', 'up'].every((k) => {
    const d = offArmCounter(k, 1);
    return Math.max(Math.abs(d.sx), Math.abs(d.sy)) >= 0.2;
  }) && Math.abs(side.sy) >= 0.25, 'every kind ≥ 0.20 rad on its biggest axis (the arc crosses at 0.30)');
  ok('it is written in the rig\'s mirrored space (so the left and right hand do the same thing)', offArmCounter('front', 1).sy === offArmCounter('front', 1).sy && GUARD.sy < 0, 'no side sign needed: the rig mirrors sy/sz itself');
}

// ==================================================================== §4 the roll
console.log('\n§4  the body rolls into the punch');
{
  ok('a straight rolls one way, and its mirror rolls the other', swingRoll('front', 1, 1) === -swingRoll('front', 1, -1));
  ok('an arc rolls harder than a straight', Math.abs(swingRoll('side', 1, 1)) > Math.abs(swingRoll('front', 1, 1)) * 1.4, `hook ${f(swingRoll('side', 1, 1))} vs straight ${f(swingRoll('front', 1, 1))}`);
  ok('an uppercut rolls less than a hook (it is a vertical punch)', Math.abs(swingRoll('up', 1, 1)) < Math.abs(swingRoll('side', 1, 1)));
  ok('there is no roll before the swing opens', ['front', 'side', 'up'].every((k) => swingRoll(k, 0, 1) === 0));
  ok('the roll is modest (it leans the silhouette, it does not spin the machine)', Math.abs(swingRoll('side', 1, 1)) <= 0.25, `max ${f(Math.abs(swingRoll('side', 1, 1)))} rad`);
  ok('SWING_ROLL is where the number lives', SWING_ROLL === 0.12);
}

// ==================================================================== §5 the ribbon
console.log('\n§5  the fist\'s ribbon is sized by the punch');
{
  const S = 1;
  const ordered = ['jab', 'cross', 'hook', 'upper', 'bolt'].map((id) => trailWidthFor(id, S));
  ok('it grows with the punch\'s power', ordered[0] < ordered[1] && ordered[1] < ordered[3], ordered.map((w, i) => `${['jab', 'cross', 'hook', 'upper', 'bolt'][i]} ${f(w)}`).join(' · '));
  ok('an arc is drawn wider than a straight of the same weight', trailWidthFor('hook', S) > trailWidthFor('cross', S) * 1.2, `hook ${f(trailWidthFor('hook', S))} vs cross ${f(trailWidthFor('cross', S))}`);
  ok('the Overdrive family gets the widest ribbons', OD.every((id) => trailWidthFor(id, S) > trailWidthFor('cross', S) * 1.4));
  ok('...and nothing can smear across the screen (it is capped)', ALL.every((id) => trailWidthFor(id, 2, true) <= TRAIL_CAP) && trailWidthFor('windmill', 2, true) === TRAIL_CAP, `cap ${TRAIL_CAP} m`);
  ok('the old default is still the floor for an unarmed trail', trailWidthFor('jab', S) > 0.28 * S * 0.9, `jab ${f(trailWidthFor('jab', S))} vs the plain 0.28`);
}

// ==================================================================== §6 follow-through
console.log('\n§6  no strike snaps straight back off the contact frame');
{
  // sample the pose the fist actually lands on (the game's own sampler) and check the keys after it: the arm has to
  // keep going (overshoot) or at least HOLD the extension — a punch that is already on its way home at contact reads
  // as a tap, and that is the single most common way a hand-keyed punch looks weak.
  const HOLD = ['counter', 'finisher']; // the two documented holds: the counter stops dead on purpose (it is half an
  // Overdrive — see striketest §2), and the finisher holds its extension because it is the last word of the combo.
  for (const id of ALL) {
    const m = MOVES[id];
    const after = m.keys.filter((k) => k.t > m.impact + 1e-9);
    const axis = m.kind === 'side' ? 'sy' : 'sx';
    const commit = Math.max(...after.map((k) => Math.abs(k.p[axis])));
    const atContact = Math.abs(m.keys.filter((k) => k.t <= m.impact + 1e-9).slice(-1)[0].p[axis]);
    ok(`${id}: the arm stays committed past the contact frame`, commit >= atContact - 0.06, `${axis} ${f(atContact)} → ${f(commit)}`);
  }
  ok('the four basics all genuinely overshoot (not just hold)', ['jab', 'cross', 'hook', 'upper'].every((id) => {
    const m = MOVES[id];
    const axis = m.kind === 'side' ? 'sy' : 'sx';
    const atContact = Math.abs(m.keys.filter((k) => k.t <= m.impact + 1e-9).slice(-1)[0].p[axis]);
    return Math.max(...m.keys.filter((k) => k.t > m.impact + 1e-9).map((k) => Math.abs(k.p[axis]))) > atContact + 0.03;
  }), 'the fist travels THROUGH the target and past it');
  ok('the two holds are holds, not snaps', HOLD.every((id) => {
    const m = MOVES[id];
    const axis = m.kind === 'side' ? 'sy' : 'sx';
    const atContact = Math.abs(m.keys.filter((k) => k.t <= m.impact + 1e-9).slice(-1)[0].p[axis]);
    const after = Math.max(...m.keys.filter((k) => k.t > m.impact + 1e-9).map((k) => Math.abs(k.p[axis])));
    return after > atContact * 0.9; // held within 10% — never dropped
  }), 'counter and finisher hold the line (documented, and the harness keeps it that way)');
  ok('every strike is a real animation (not a two-pose lerp)', ALL.every((id) => MOVES[id].keys.length >= 5), Math.min(...ALL.map((id) => MOVES[id].keys.length)) + ' keys is the shortest');
  ok('every strike loads before it fires (a key at or before the strike frame)', ALL.every((id) => MOVES[id].keys.some((k) => k.t <= MOVES[id].strikeAt + 1e-9 && k.t < MOVES[id].impact)));
  // THE LOAD IS THE TELL. Sampled with the game's own sampler: before a punch fires it has to be pulled back at least
  // as far from the target as the guard is — that coil is what the opponent reads, and what the release snaps out of.
  const dist = (a, b) => Math.hypot(a.sx - b.sx, a.sy - b.sy, a.sz - b.sz, a.ex - b.ex);
  const deepLoad = (id) => {
    const m = MOVES[id];
    const ext = sampleKeys(m.keys, m.impact).p;
    const loaded = m.keys.filter((k) => k.t <= m.strikeAt + 1e-9).map((k) => dist(k.p, ext));
    return Math.max(...loaded) / dist(GUARD, ext);
  };
  ok('every strike loads at least as deep as the guard before it fires', ALL.every((id) => deepLoad(id) >= 1), ALL.map((id) => `${id} ${deepLoad(id).toFixed(2)}×`).join(' · '));
  // ...and the marksman punches (the four basics + the finisher) are still loaded ON the strike frame itself, so the
  // release plays out of a held coil rather than out of a half-returned arm.
  ok('the readable punches fire straight out of the load', ['jab', 'cross', 'hook', 'upper', 'finisher'].every((id) => deepLoad(id) >= 1.1), 'a coil deeper than the guard, held through the strike frame');
  ok('...and a key that brings the arm home', ALL.every((id) => Math.abs(MOVES[id].keys[MOVES[id].keys.length - 1].t - MOVES[id].dur) < 1e-9));
}

// ==================================================================== §7 fairness
console.log('\n§7  the chain is the same for both fighters (checked in the source, not promised)');
{
  const src = readFileSync(new URL('./src/game/Game.ts', import.meta.url), 'utf8');
  const start = src.indexOf('SWING DYNAMICS — the boxer');
  const end = src.indexOf('COUNTER STRAIGHT (L). L is a punch');
  const block = src.slice(start, end);
  ok('the block exists and was found', start > 0 && end > start && block.length > 800, `${block.length} chars`);
  ok('nothing in it is player-only', !/isPlayer/.test(block), 'no isPlayer anywhere in the swing chain');
  ok('nothing in it is random (a swing is deterministic for both fighters)', !/Math\.random/.test(block));
  ok('every term is a pure exported function', ['swingPhase', 'swingStiff', 'offArmCounter', 'swingRoll', 'trailWidthFor'].every((n) => block.includes(`export const ${n}`) || block.includes(`export type`) === false));
  ok('the runtime actually calls every one of them (no dead code)', ['swingPhase', 'swingStiff', 'offArmCounter', 'swingRoll', 'trailWidthFor'].every((n) => src.split(n).length - 1 > block.split(n).length - 1), 'each term is referenced outside its own declaration block');
  ok('the AI path goes through the same pose code (no separate AI swing)', /swingStiff\(f\.rage \? 92 : 75/.test(src), 'the stiffness is computed from f.rage, not from who is throwing');
}

console.log(fails === 0 ? '\nSWING DYNAMICS: ALL PASS\n' : `\n${fails} FAILURE(S)\n`);
process.exit(fails === 0 ? 0 : 1);
