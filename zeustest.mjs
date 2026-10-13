// Zeus survivability + the ATLAS PRIME opponent — run it with:
//     npx esbuild src/game/Game.ts --bundle --format=esm --platform=node --outfile=.__game.mjs --external:three
//     npx esbuild src/game/robot.ts --bundle --format=esm --platform=node --outfile=.__robot.mjs --external:three
//     node zeustest.mjs
// (or just `npm run test:zeus`, which does both)
//
// It checks the two rules added to the WRC:
//   §1  ZEUS IS HARD TO KNOCK AWAY — the chassis resistances that drive every knockback, the brace rule (which
//       strikes can still sweep him off his feet, and only once he is softened) and the stability it eats
//   §2  ATLAS PRIME IS ON THE CARD — the champion's own chassis is the last Titan in the roster, fights with the
//       player's build (never Zeus), carries the ATLAS hands and the champion's thicker plating
//   §3  THE LAWAN ATLAS MODE — the lobby card, the locked bout and the reward table
import { ATLAS_IDX, OPPONENTS, PLAYER_NAME, PLAYER_STYLE, ZEUS_KNOCK_RESIST, ZEUS_LAUNCH_LIFT, ZEUS_LAUNCH_RESIST, ZEUS_POISE_COST, ZEUS_POISE_COST_HJ, Game, hpThick, ultraDef, zeusBraces } from './.__game.mjs';
import { MODES, makeSeries, modeOf, seriesLabel } from './.__progress.mjs';
import { Robot } from './.__robot.mjs';

let fails = 0;
const ok = (label, cond, info = '') => {
  if (!cond) fails++;
  console.log(`   ${cond ? 'PASS' : 'FAIL'}  ${label}${info ? '   ' + info : ''}`);
};
const f = (v) => (Math.round(v * 1000) / 1000).toFixed(3);
const HJ = ['jab', 'hook'];
const NORMAL = ['cross', 'upper', 'counter'];
const SPECIAL = ['slam', 'bolt', 'windmill', 'skyhook', 'grab'];

// ===================================================================================== §1 Zeus digs his boots in
console.log('\n§1  Zeus is hard to knock away (2-ton chassis)');
{
  // the resistances replaced the old single "0.833" shove multiplier — they have to be a real difference, not a tweak
  ok('a landed hit shoves Zeus at 40% (was 83%)', ZEUS_KNOCK_RESIST === 0.4, `ZEUS_KNOCK_RESIST ${f(ZEUS_KNOCK_RESIST)}`);
  ok('a thrown Zeus travels less than half the distance', ZEUS_LAUNCH_RESIST < 0.5, `ZEUS_LAUNCH_RESIST ${f(ZEUS_LAUNCH_RESIST)}`);
  ok('and he lifts off at 62% of the height', ZEUS_LAUNCH_LIFT === 0.62, `ZEUS_LAUNCH_LIFT ${f(ZEUS_LAUNCH_LIFT)}`);

  // THE BRACE RULE: a jab / hook never takes a standing Zeus off his feet, and neither does an ordinary punch —
  // only a softened Zeus (stability nearly gone, already rocked, or nearly out of HP) can be launched by one
  ok('jab / hook: a standing Zeus eats it, never leaves the canvas', HJ.every((id) => zeusBraces(id, true, false)));
  ok('cross / upper / counter: braced while he is still fresh', NORMAL.every((id) => zeusBraces(id, false, false)));
  ok('...and even those only launch him once he is SOFTENED', NORMAL.every((id) => !zeusBraces(id, false, true)));
  ok('the designated launchers always go through', SPECIAL.every((id) => !zeusBraces(id, false, false)), SPECIAL.join(' / '));
  ok('a jab is still braced even when he is softened (a 7 never drops him)', HJ.every((id) => zeusBraces(id, true, true)));

  // STABILITY: the same clean punches that break a standard Titan's bank must take roughly twice as long on Zeus
  const inBank = (mul) => 1 / mul; // hits-per-bank relative to a standard Titan
  ok('his stability bank eats 55% per clean punch (≈ 2× the hits)', ZEUS_POISE_COST === 0.55 && inBank(ZEUS_POISE_COST) > 1.8, `${f(inBank(ZEUS_POISE_COST))}× the hits of a standard Titan`);
  ok('a jab / hook barely scratches that bank at all', ZEUS_POISE_COST_HJ < 0.25 && ZEUS_POISE_COST_HJ < ZEUS_POISE_COST, `${f(ZEUS_POISE_COST_HJ)} per jab/hook`);
}

// ===================================================================================== §2 ATLAS PRIME on the card
console.log('\n§2  ATLAS PRIME — the champion’s own chassis, as a real opponent');
{
  const prime = OPPONENTS[ATLAS_IDX];
  ok('he is the last Titan in the roster', ATLAS_IDX === OPPONENTS.length - 1, `index ${ATLAS_IDX} of ${OPPONENTS.length}`);
  ok('his name does not collide with the player', prime.name === 'ATLAS PRIME' && PLAYER_NAME === 'ATLAS', `player ${PLAYER_NAME} vs ${prime.name}`);
  ok('he wears the player’s build (atom chassis, silver plating)', prime.style.variant === PLAYER_STYLE.variant && prime.style.main === PLAYER_STYLE.main && prime.style.secondary === PLAYER_STYLE.secondary);
  ok('...with champion gold trim, so the mirror duel is readable', prime.style.accent !== PLAYER_STYLE.accent && prime.style.glow !== PLAYER_STYLE.glow, `accent ${prime.style.accent.toString(16)} · glow ${prime.style.glow.toString(16)}`);

  // he must NEVER be mounted as Zeus: the mount check reads isZeus100 (and helmet+armor skin 1). If this ever flips,
  // the "LAWAN ATLAS" mode would put a second Zeus on the canvas.
  ok('he never wears the Zeus mount', !prime.style.isZeus100 && !(prime.style.helmetSkin === 1 && prime.style.armorSkin === 1), `helmet ${prime.style.helmetSkin ?? 0} · armor ${prime.style.armorSkin ?? 0}`);
  // ...and proved on a REAL rig: the Robot the ring would build for him reports isAtom/isAtlas, never isZeus, so the
  // LAWAN ATLAS duel can never put two Zeuses on the canvas (the Zeus chassis keeps its own green mount)
  const primeRig = new Robot(prime.style, prime.scale);
  ok('a real rig built from his style is an ATLAS, not a Zeus', primeRig.isZeus === false && primeRig.isAtlas === true, `isZeus ${primeRig.isZeus} · isAtlas ${primeRig.isAtlas}`);
  // (the Zeus entry needs a 2D canvas for its materials — off limits in node — so read its flags instead)
  ok('the Zeus entry still declares the real Zeus chassis', OPPONENTS[0].style.isZeus100 === true && OPPONENTS[0].name.includes('ZEUS'));
  ok('no HEAVY name-match accident: only Zeus gets the IQ doubling', !prime.name.includes('ZEUS') && !prime.title.includes('ZEUS'));

  // the champion's plating: makeDef is called exactly like the game calls it (ultra off, the default 12× IQ)
  const tune = (iq, idx) => Game.prototype.makeDef.call({ ultra: false, iq }, idx);
  const primeDef = tune(12, ATLAS_IDX);
  const zeusDef = tune(12, 0);
  const fangDef = tune(12, 1);
  ok('he is plated 60% thicker by makeDef — the same as Zeus', primeDef.hp === hpThick(Math.round(prime.hp * 1.6)), `${prime.hp} → ${primeDef.hp} HP`);
  ok('a standard Titan keeps its own (unboosted) plating', fangDef.hp === hpThick(OPPONENTS[1].hp), `${OPPONENTS[1].hp} → ${fangDef.hp} HP`);
  ok('he stays UNDER Zeus’s vitality (the heavyweight is still Zeus)', primeDef.hp < zeusDef.hp, `${primeDef.hp} vs Zeus ${zeusDef.hp} HP`);
  ok('Ultra Hard upgrades him like everyone else (×1.4 base)', hpThick(ultraDef(prime).hp) === hpThick(Math.round(prime.hp * 1.4)), `${prime.hp} → ${hpThick(ultraDef(prime).hp)} HP`);

  // identity: the champion is the fastest chassis on the card (the ATLAS build also swings 19% faster — see atkSpd)
  const speeds = OPPONENTS.map((o) => o.speed);
  ok('he has the fastest hands-on-feet in the roster', prime.speed === Math.max(...speeds), `speed ${prime.speed} vs next ${Math.max(...speeds.slice(0, -1))}`);
  ok('his brain is top of the non-Zeus field', prime.react >= 0.95 && prime.dodge >= 0.8 && prime.punish >= 0.95, `react ${prime.react} · dodge ${prime.dodge} · punish ${prime.punish}`);
  ok('he fights in the standard chassis (scale 1, so the ring scaling stays as tuned)', prime.scale === 1 && prime.slam === true);
}

// ===================================================================================== §3 the LAWAN ATLAS mode
console.log('\n§3  LAWAN ATLAS — a lobby mode that locks the duel onto ATLAS PRIME');
{
  const meta = MODES.find((m) => m.id === 'atlas');
  ok('the mode exists on the lobby card list', !!meta && meta.name === 'LAWAN ATLAS', meta ? `${meta.name} · ${meta.sub}` : 'missing from MODES');
  ok('the card says the player is put in the ZEUS set', /ZEUS/.test(meta.desc) && /ATLAS PRIME/.test(meta.desc));
  ok('modeOf resolves it (no falling back to PLAY MATCH)', modeOf('atlas').id === 'atlas');

  const s = makeSeries('atlas', OPPONENTS.length, 120, 0);
  ok('it is a single locked bout against ATLAS PRIME', !!s && s.queue.length === 1 && s.queue[0] === ATLAS_IDX, s ? `queue ${JSON.stringify(s.queue)}` : 'null series');
  ok('the bout cannot be re-pointed by the lobby selection', makeSeries('atlas', OPPONENTS.length, 120, 2).queue[0] === ATLAS_IDX);
  ok('and it never leaks into the tournament tree (still four rounds, Titans 0–3)', makeSeries('tournament', OPPONENTS.length, 120, 0).queue.join(',') === '0,1,2,3');
  ok('its banner names both fighters', seriesLabel(s) === 'DUEL ZEUS vs ATLAS PRIME', seriesLabel(s));
}

console.log(fails === 0 ? '\nZEUS + ATLAS PRIME: ALL PASS\n' : `\n${fails} FAILURE(S)\n`);
process.exit(fails === 0 ? 0 : 1);
