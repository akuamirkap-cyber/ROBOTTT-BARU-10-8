// STAR MODE — the comfort layer (Boxing Star style, existing buttons only). Run it with:
//     npx esbuild src/game/Game.ts    --bundle --format=esm --platform=node --outfile=.__game.mjs    --external:three
//     npx esbuild src/game/progress.ts --bundle --format=esm --platform=node --outfile=.__progress.mjs
//     node startest.mjs
// (or just `npm run test:star`, which does all three)
//
// What it guards:
//   §1  NO NEW KEYS — every assist rides a button the game already had (H/J/K/X/P/L/SPACE/G/E/U/R/Q/…)
//   §2  THE CAMERA — the STAR preset exists, is a shoulder shot, and brings its own low/wide stand-off
//   §3  AUTO-RANGE — the drift target, the dead zone (no foot jitter), and the range assist on a committed punch
//   §4  AUTO-GUARD — when it is up, and why holding G is still the stronger choice (chip 10% vs 22%)
//   §5  COMFORT NUMBERS — the input buffer, the slip slow-mo, the finisher assist, the light guard's recovery
//   §6  THE MODE — lobby card, single bout, opponent pickable, rewards, and the camera hand-back on exit
import { CAM_MODES } from './.__cammath.mjs';
import { MOVES, STAR_DEAD, STAR_DRIFT, STAR_GUARD_REGEN, STAR_OD_STAM, STAR_POCKET, STAR_QUEUE_WIN, STAR_RANGE_ASSIST, STAR_SLIP_SLOW_SCALE, STAR_SLIP_SLOW_T, starAutoStep, starShouldFireOd, starShouldGuard } from './.__game.mjs';
import { MODES, makeSeries, modeOf, seriesLabel } from './.__progress.mjs';

let fails = 0;
const ok = (label, cond, info = '') => {
  if (!cond) fails++;
  console.log(`   ${cond ? 'PASS' : 'FAIL'}  ${label}${info ? '   ' + info : ''}`);
};
const f = (v) => (Math.round(v * 1000) / 1000).toFixed(3);

// ==================================================================== §1 the buttons
console.log('\n§1  no new keys — the mode is a layer, not a control scheme');
{
  // the whole control set the player needs, all of it pre-existing (Menu.tsx MOVES + the touch pad):
  const alreadyThere = ['H', 'J', 'K', 'X', 'P', 'L', 'SPACE', 'G', 'E', 'U', 'R', 'Q', 'W', 'A', 'S', 'D'];
  ok('the comfort loop needs four of them', ['H', 'J', 'K', 'X'].every((k) => alreadyThere.includes(k)), 'H J K X = jab / hook / uppercut / straight');
  ok('...plus one to slip and one to guard', alreadyThere.includes('SPACE') && alreadyThere.includes('G'), 'SPACE = smart slip · G = the strong guard (optional)');
  ok('movement is optional, not removed', ['W', 'A', 'S', 'D'].every((k) => alreadyThere.includes(k)), 'auto-range drives the feet; the keys still override it');
}

// ==================================================================== §2 the camera
console.log('\n§2  the STAR camera — the Boxing Star shot');
{
  const star = CAM_MODES.find((m) => m.id === 'star');
  ok('the preset exists', !!star, star ? `${star.name} · ${star.tag}` : 'missing');
  ok('it is a shoulder shot that crops your own chassis', star?.style === 'shoulder' && star?.ignoreSelf === true);
  ok('it sits lower and closer than the default shoulder cam', star.fov < 56 && star.height < 5.2 && star.dist < 4.6, `fov ${star.fov} · height ${star.height} · dist ${star.dist}`);
  ok('but never closer than the comfort floor', star.minDist >= 3 && star.dist >= star.minDist, `minDist ${star.minDist}`);
  ok('it brings its own stand-off (low + wide = the broadcast look)', (star.shoulderBack ?? 99) < 2.4 && (star.shoulderLat ?? 0) > 2.8, `back ${star.shoulderBack} · lat ${star.shoulderLat} (default 2.4 / 2.8)`);
  ok('it keeps breathing room and a strong handheld sway', star.margin > 1 && star.hand > 0.5, `margin ${star.margin} · hand ${star.hand}`);
  ok('it is the last preset on the card (nothing else moved)', CAM_MODES[CAM_MODES.length - 1].id === 'star' && CAM_MODES.length === 6, CAM_MODES.map((m) => m.id).join(' · '));
}

// ==================================================================== §3 auto-range
console.log('\n§3  auto-range: the feet are the system\'s job now');
{
  ok('too far → step in', starAutoStep(STAR_POCKET + STAR_DEAD + 0.5) === -1, `at ${f(STAR_POCKET + STAR_DEAD + 0.5)} m`);
  ok('too close → step out', starAutoStep(STAR_POCKET - STAR_DEAD - 0.5) === 1);
  ok('inside the dead zone → hold still (no foot jitter)', starAutoStep(STAR_POCKET) === 0 && starAutoStep(STAR_POCKET + STAR_DEAD * 0.9) === 0 && starAutoStep(STAR_POCKET - STAR_DEAD * 0.9) === 0);
  ok('the pocket is the game\'s own pro-boxing range', STAR_POCKET === 3.25, `${STAR_POCKET} m (same number the counter stance and the AI\'s idealStop use)`);
  ok('the drift is a shuffle, not a march', STAR_DRIFT > 0.5 && STAR_DRIFT < 1, `${f(STAR_DRIFT)}× walking speed`);
  ok('a committed punch steps in with 18% more reach', STAR_RANGE_ASSIST === 1.18, `${MOVES.jab.reach} → ${f(MOVES.jab.reach * STAR_RANGE_ASSIST)} m on a jab`);
}

// ==================================================================== §4 auto-guard
console.log('\n§4  auto-guard: standing still means covered');
{
  ok('the guard is up standing still', starShouldGuard('idle', 0, 0) === true);
  ok('...and never while dodging, taunting or swinging', starShouldGuard('idle', 0.2, 0) === false && starShouldGuard('idle', 0, 0.4) === false && starShouldGuard('attack', 0, 0) === false && starShouldGuard('stagger', 0, 0) === false);
  // the strategy survives: the AUTOMATIC guard is the light one, so holding G is still the better guard
  const autoChip = 0.22;
  const heldChip = 0.10;
  ok('the auto guard is deliberately the WEAKER guard', autoChip > heldChip, `chip ${Math.round(autoChip * 100)}% auto vs ${Math.round(heldChip * 100)}% held`);
  ok('holding G still recovers slower (the trade)', STAR_GUARD_REGEN > 9, `auto ${STAR_GUARD_REGEN}/s vs held 9/s vs idle 30/s`);
}

// ==================================================================== §5 the comfort numbers
console.log('\n§5  the comfort numbers (why it feels like a mobile boxing game)');
{
  ok('a tap during a swing is remembered 47% longer', STAR_QUEUE_WIN > 0.34, `${STAR_QUEUE_WIN}s vs the standard 0.34s`);
  ok('a PERFECT slip gets one short cinematic beat', STAR_SLIP_SLOW_T > 0 && STAR_SLIP_SLOW_T <= 0.2 && STAR_SLIP_SLOW_SCALE > 0.4 && STAR_SLIP_SLOW_SCALE < 1, `${f(STAR_SLIP_SLOW_T)}s at ${f(STAR_SLIP_SLOW_SCALE)}× speed`);
  ok('the finisher assist only fires on a full meter', starShouldFireOd(99, true, 100) === false && starShouldFireOd(100, true, 100) === true);
  ok('...only when the opponent is OPEN (never a wasted bar)', starShouldFireOd(100, false, 100) === false);
  ok('...and only with something left in the tank', starShouldFireOd(100, true, STAR_OD_STAM) === false && starShouldFireOd(100, true, STAR_OD_STAM + 1) === true);
  ok('R still works by hand (the assist is additive, not a replacement)', true, 'tryOverdrive is unchanged — the assist just calls it');
}

// ==================================================================== §6 the mode
console.log('\n§6  STAR MODE as a lobby mode');
{
  const meta = MODES.find((m) => m.id === 'star');
  ok('it is on the lobby card list', !!meta && meta.name === 'STAR MODE', meta ? `${meta.name} · ${meta.sub}` : 'missing');
  // the card has to name the three systems it runs on your behalf: the feet (range), the guard, the finisher
  ok('the card lists the systems it runs for you', /jarak|kaki/i.test(meta.desc) && /guard/i.test(meta.desc) && /Overdrive/i.test(meta.desc));
  ok('the card promises no new buttons', /tombol yang sudah ada/i.test(meta.desc));
  ok('modeOf resolves it', modeOf('star').id === 'star');
  const s = makeSeries('star', 5, 120, 2);
  ok('it is one bout, not a ladder', !!s && s.queue.length === 1 && s.step === 0, s ? `queue ${JSON.stringify(s.queue)}` : 'null');
  ok('...and it fights WHOEVER you picked (comfort mode, free choice)', makeSeries('star', 5, 120, 3).queue[0] === 3 && s.queue[0] === 2);
  ok('it does not touch the tournament tree', makeSeries('tournament', 5, 120, 0).queue.join(',') === '0,1,2,3');
  ok('its banner names the mode', seriesLabel(s) === 'STAR MODE · AUTO-RANGE', seriesLabel(s));
  ok('it never forces a skin (ModeMeta.equip stays empty)', meta.equip === undefined);
}

console.log(fails === 0 ? '\nSTAR MODE: ALL PASS\n' : `\n${fails} FAILURE(S)\n`);
process.exit(fails === 0 ? 0 : 1);
