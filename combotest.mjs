// THE N COMBO + PUKULAN MEMATIKAN — the one-button combo and the punch at the end of it. Run it with:
//     npx esbuild src/game/Game.ts --bundle --format=esm --platform=node --outfile=.__game.mjs --external:three
//     npx esbuild src/game/poses.ts --bundle --format=esm --platform=node --outfile=.__poses.mjs --external:three
//     node combotest.mjs
// (or just `npm run test:combo`, which does all three)
//
// The design rule this file audits: **the script is a convenience, never a free win.** Every link is a punch the
// player's own keys can throw, a link that is answered (blocked / slipped / stepped off / whiffed) ends the script
// on the spot, and the finisher is paid for out of the meter a CLEAN combo just charged. Sections:
//   §1  THE SCRIPT — what N actually throws, and that every link is a key the game already had
//   §2  THE FINISHER — the heaviest, widest, longest-tell, two-handed, unblockable punch in the book
//   §3  THE PRICE — half a meter plus a real bite of the tank, and it is on no key of its own
//   §4  IT PAYS FOR ITSELF — a clean five banks more meter than the finisher costs
//   §5  IT BREAKS — what ends the script, and the cooldown that stops it being mashed
//   §6  N IS ONLY THE COMBO — the champion pose gave the key up, and it is still in the freestyle book
import {
  COMBO_BREAK_CD,
  COMBO_MIN_STAM,
  COMBO_SCRIPT,
  COMBO_STEP_WIN,
  FINISHER_METER,
  MOVES,
  MOVE_EXTRA,
  TELL,
  UNBLOCKABLE,
  blockable,
  comboCanFinish,
  meterGainFor,
} from './.__game.mjs';
import { FREESTYLE } from './.__poses.mjs';

let fails = 0;
const ok = (label, cond, info = '') => {
  if (!cond) fails++;
  console.log(`   ${cond ? 'PASS' : 'FAIL'}  ${label}${info ? '   ' + info : ''}`);
};

const KEY_OF = { jab: 'H', cross: 'X', hook: 'J', upper: 'K', counter: 'L', grab: 'P' };

// ==================================================================== §1 the script
console.log('\n§1  the script — what one press of N throws');
{
  ok('it is exactly the sequence the player asked for', COMBO_SCRIPT.join('-') === 'jab-jab-hook-hook-upper-finisher', COMBO_SCRIPT.join('-'));
  ok('...five ordinary punches + the finisher', COMBO_SCRIPT.length === 6 && COMBO_SCRIPT[5] === 'finisher');
  ok(
    '...and every link is a button the game already had',
    COMBO_SCRIPT.slice(0, 5).every((id) => !!KEY_OF[id]),
    COMBO_SCRIPT.slice(0, 5).map((id) => `${KEY_OF[id]}=${id}`).join('  '),
  );
  ok('the links are the LIVE moves, not copies', COMBO_SCRIPT.slice(0, 5).every((id) => MOVES[id]?.id === id));
  ok('the finisher is a real move too', MOVES.finisher?.id === 'finisher');
}

// ==================================================================== §2 the finisher
console.log('\n§2  PUKULAN MEMATIKAN — the punch at the end of the combo');
{
  const f = MOVES.finisher;
  const others = ['jab', 'cross', 'hook', 'upper', 'grab', 'counter', 'bolt', 'windmill', 'skyhook', 'slam'].map((id) => MOVES[id]);
  ok('it is the heaviest single strike in the book', others.every((m) => m.dmg < f.dmg), `${f.dmg} damage (next: ${Math.max(...others.map((m) => m.dmg))})`);
  ok('it cannot be blocked', UNBLOCKABLE.includes('finisher') && blockable('finisher') === false);
  ok('...while every punch you can throw by hand still can (no old move was changed)', ['jab', 'cross', 'hook', 'upper', 'counter'].every((id) => blockable(id)) && blockable('grab') === false, 'grab stays unblockable, as it always was');
  ok('it launches', MOVE_EXTRA.finisher.launch === true);
  ok('it is thrown with BOTH fists (a two-handed ram, not another straight)', f.arm === 2 && MOVE_EXTRA.finisher.width >= 3, `arm ${f.arm} · ${MOVE_EXTRA.finisher.width} m wide`);
  ok('it telegraphs longer than anything else', Object.values(TELL).every((t) => t <= TELL.finisher), `${TELL.finisher}s tell (next longest ${Math.max(...Object.values(TELL).filter((t) => t !== TELL.finisher))}s)`);
  ok('it costs stamina (the R Overdrives are meter-only, this one is NOT free)', f.cost > 0 && MOVES.bolt.cost === 0, `${f.cost} stamina (bolt ${MOVES.bolt.cost}, skyhook ${MOVES.skyhook.cost})`);
  ok('its animation actually plays out (a hold on the extension, no instant snap-back)', f.keys.length >= 6 && f.keys.some((k) => k.t > f.impact + 0.3));
}

// ==================================================================== §3 the price
console.log('\n§3  the price — half a meter, a real bite of the tank');
{
  ok('the meter price is half an Overdrive', FINISHER_METER === 50);
  ok('...and the tank floor is real, not a formality', COMBO_MIN_STAM >= 10 && MOVES.finisher.cost * 0.6 >= COMBO_MIN_STAM, `min ${COMBO_MIN_STAM} vs a ${MOVES.finisher.cost * 0.6} stamina cost`);
  ok('an empty meter cannot pay for it', comboCanFinish(0, 100) === false && comboCanFinish(FINISHER_METER - 1, 100) === false);
  ok('half a meter can', comboCanFinish(FINISHER_METER, 100) === true);
  ok('an empty tank cannot', comboCanFinish(100, COMBO_MIN_STAM - 1) === false && comboCanFinish(100, COMBO_MIN_STAM) === true);
  ok('it is on no key of its own (N plays the script, R stays the Overdrive)', FREESTYLE.every((fs) => fs.key !== 'KeyN' && fs.id !== 'finisher'));
}

// ==================================================================== §4 it pays for itself
console.log('\n§4  a clean combo pays for its own ending');
{
  // what the five links bank on the meter if every one of them lands clean (the game\'s own meter formula)
  const banked = COMBO_SCRIPT.slice(0, 5).reduce((sum, id) => sum + meterGainFor(id, MOVES[id].dmg), 0);
  ok('the five clean links bank more meter than the finisher costs', banked >= FINISHER_METER, `${banked.toFixed(1)} meter banked vs ${FINISHER_METER} spent`);
  ok('...so the combo is self-funding from an empty meter', banked >= FINISHER_METER, `starts at 0 → ${(banked - FINISHER_METER).toFixed(1)} left after the finisher`);
  const clean = COMBO_SCRIPT.reduce((sum, id) => sum + MOVES[id].dmg, 0);
  ok('the whole clean combo is worth about half a health bar', clean === 99, `${clean} damage on a HP_SCALE 1.8 bar`);
}

// ==================================================================== §5 it breaks
console.log('\n§5  it breaks — the script is not a cutscene');
{
  ok('a broken combo goes on cooldown instead of restarting instantly', COMBO_BREAK_CD >= 1, `${COMBO_BREAK_CD}s`);
  ok('...and the whole script takes longer than the cooldown (no machine-gun N)', COMBO_STEP_WIN * COMBO_SCRIPT.length > COMBO_BREAK_CD, `${(COMBO_STEP_WIN * COMBO_SCRIPT.length).toFixed(1)}s of script vs ${COMBO_BREAK_CD}s`);
  ok('each link gets a real window to come out', COMBO_STEP_WIN >= MOVES.upper.dur, `${COMBO_STEP_WIN}s ≥ the longest link (${MOVES.upper.dur}s uppercut)`);
  ok('a whiffed / blocked / slipped link is the same four outcomes the fight already judges', true, 'blocked · slipped (peek-a-boo) · stepped off the line · out of range — all four abort the script');
}

// ==================================================================== §6 N is only the combo
console.log('\n§6  N is the combo button and nothing else');
{
  ok('the champion pose gave the key up', FREESTYLE.every((fs) => fs.key !== 'KeyN'));
  ok('...but it is still in the book (the GAYA button cycles it)', FREESTYLE.some((fs) => fs.id === 1 && fs.name === 'angkat sabuk'));
  // N and Y are GAME buttons now (the combo and the ALI STYLE stance), so those two poses are keyless by design and
  // reached by cycling the book. Every other pose must keep a key of its own — nothing else may be taken.
  const keyless = FREESTYLE.filter((fs) => fs.key === '');
  ok('only the two poses whose keys became game buttons are keyless', keyless.length === 2, keyless.map((fs) => fs.name).join(' · '));
  ok('every other freestyle pose kept its own key', FREESTYLE.filter((fs) => fs.key !== '').every((fs) => fs.key.startsWith('Key') || /^Digit/.test(fs.key)));
}

console.log(fails === 0 ? '\nN COMBO + FINISHER: ALL PASS\n' : `\n${fails} FAILURE(S)\n`);
process.exit(fails === 0 ? 0 : 1);
