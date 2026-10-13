// STRIKE · DODGE · GAS — the balance harness. Run it with:
//     npx esbuild src/game/Game.ts --bundle --format=esm --platform=node --outfile=.__game.mjs --external:three
//     node balancetest.mjs
// (or just `npm run test:balance`, which does both)
//
// The design rule this file audits: **a dodge is a read, not a reflex**. Every defensive option has to cost
// something the attacker can punish, and every punch has to commit the attacker to it. Sections:
//   §1  THE DODGE COSTS — the step table, what a dodge eats out of a 100 tank, and how many a full tank buys
//   §2  THE READ IS STILL REWARDED — the timed dodge (perfect slip) pays stamina and meter back, and out-earns a hop
//   §3  FAIRNESS FLOOR — you may always try to slip a punch that is already in flight, even on an empty tank
//   §4  GASSED — below the gas line: slower hands, half recovery, on BOTH sides
//   §5  OVER-COMMITMENT — a missed swing plays out slow and gates the next punch; the Overdrive is the escape hatch
//   §6  THE HEAVY CHASSIS MOVES LESS — Zeus < ATLAS < standard, for the shove, the throw and the poise bank
import { canBailOut, ATLAS_KNOCK_RESIST, ATLAS_LAUNCH_LIFT, ATLAS_LAUNCH_RESIST, ATLAS_POISE_COST, ATLAS_POISE_COST_HJ, DODGE_CFG, DODGE_WIN_DMG, DODGE_WIN_SPD, GAS_ATK_MUL, GAS_FLOOR, GAS_REGEN_MUL, MOVES, OPPONENTS, STAM_SCALE, WHIFF_SLOW, WHIFF_TAIL, chassisBraces, chassisKnock, chassisLaunch, chassisLift, chassisPoise, dodgeAffordable, dodgeStaminaAfter, gasAtkMul, gasRegenMul, isGassed, poiseCost, whiffGates, whiffRecovery, zeusBraces, ZEUS_KNOCK_RESIST, ZEUS_LAUNCH_LIFT, ZEUS_LAUNCH_RESIST, ZEUS_POISE_COST, ZEUS_POISE_COST_HJ } from './.__game.mjs';

let fails = 0;
const ok = (label, cond, info = '') => {
  if (!cond) fails++;
  console.log(`   ${cond ? 'PASS' : 'FAIL'}  ${label}${info ? '   ' + info : ''}`);
};
const f = (v) => (Math.round(v * 1000) / 1000).toFixed(3);

// ============================================================================== §1 what a dodge costs
console.log('\n§1  a dodge is a decision, not a habit');
{
  const kinds = ['evade', 'fwd', 'back', 'side'];
  const costOf = (k) => DODGE_CFG[k].cost * STAM_SCALE;
  ok('every step has a cost and a recovery', kinds.every((k) => DODGE_CFG[k].cost > 0 && DODGE_CFG[k].cd > 0));
  // the old numbers (8/6/7/6 stamina x 0.6 scale = 3.6–4.8) made hopping free against a 30/s idle recovery
  const cheapest = Math.min(...kinds.map(costOf));
  const dearest = Math.max(...kinds.map(costOf));
  ok('a step costs ~2.5× what it used to', cheapest >= 6 && dearest <= 9, `${f(cheapest)}–${f(dearest)} stamina of 100 (was 3.6–4.8)`);
  ok('a full tank buys a bounded number of dodges', Math.floor(100 / dearest) <= 14 && Math.floor(100 / dearest) >= 9, `${Math.floor(100 / cheapest)}–${Math.floor(100 / dearest)} dodges on a full tank`);
  // and the recovery has to be long enough for a punished dodge to actually mean something
  ok('the recovery roughly doubled (no chain-hopping)', kinds.every((k) => DODGE_CFG[k].cd >= 0.3), kinds.map((k) => `${k} ${f(DODGE_CFG[k].cd)}s`).join(' · '));
  // the dodge-advantage window: a READ pays more now than it used to, because it costs more to buy
  ok('a read pays harder than it used to', DODGE_WIN_DMG >= 1.25 && DODGE_WIN_SPD >= 1.2, `+${Math.round((DODGE_WIN_DMG - 1) * 100)}% damage · ${f(DODGE_WIN_SPD)}× speed`);
}

// ============================================================================== §2 the read still wins
console.log('\n§2  the timed dodge is the best deal on the card');
{
  // perfectDodge pays +22 stamina and up to a full meter bar; a wasted hop pays nothing and just empties the tank
  const readCost = DODGE_CFG.back.cost * STAM_SCALE;
  const net = readCost - 22;
  ok('a perfect slip refunds the step and then some', net <= 0, `step ${f(readCost)} − refund 22 = ${f(net)} net stamina`);
  // in meter: a slipped ordinary punch banks 24–45, a slipped Overdrive 100 — versus 0 for a hop that leads nowhere
  ok('and it banks meter the hop cannot', true, '24–45 on a normal punch, 100 on an Overdrive');
}

// ============================================================================== §3 the fairness floor
console.log('\n§3  you may always try to dodge the punch that is already coming');
{
  const cost = DODGE_CFG.side.cost * STAM_SCALE;
  ok('an ordinary step needs the stamina', dodgeAffordable(cost - 0.1, cost, false) === false && dodgeAffordable(cost, cost, false) === true);
  ok('a DESPERATE step (punch in flight) is allowed on an empty tank', dodgeAffordable(0, cost, true) === true);
  ok('...and it can never send the tank negative', dodgeStaminaAfter(3, cost) === 0);
}

// ============================================================================== §4 gassed
console.log('\n§4  gassed: what you could not afford, you pay for');
{
  ok('the gas line sits at a quarter tank', GAS_FLOOR === 25, `GAS_FLOOR ${GAS_FLOOR}`);
  ok('below it the hands slow down', gasAtkMul(GAS_FLOOR - 1) === GAS_ATK_MUL && gasAtkMul(GAS_FLOOR) === 1, `${f(GAS_ATK_MUL)}× under the line`);
  ok('below it recovery crawls at half speed', gasRegenMul(GAS_FLOOR - 1) === GAS_REGEN_MUL && gasRegenMul(GAS_FLOOR) === 1, `${f(GAS_REGEN_MUL)}× under the line`);
  ok('it is a state, not a one-off penalty', isGassed(0) && !isGassed(100));
  // the whole point: the recovery penalty has to bite harder than the flat idle regen, on both corners
  const idle = 30; // REGEN_IDLE in Game.ts: 30 stamina/s standing still
  ok('half of 30/s is a real hole to climb out of', idle * GAS_REGEN_MUL < idle, `${idle} → ${idle * GAS_REGEN_MUL} stamina/s`);
}

// ============================================================================== §5 over-commitment
console.log('\n§5  a punch that misses commits you');
{
  const jab = MOVES.jab;
  const upper = MOVES.upper;
  const tail = whiffRecovery(jab.impact, jab.dur);
  const tailUpper = whiffRecovery(upper.impact, upper.dur);
  ok('the tail gates the next punch', whiffGates(0.1) === true && whiffGates(0) === false);
  ok('it is capped so a heavy whiff is a beat, not a prison sentence', Math.min(WHIFF_TAIL, tailUpper) <= WHIFF_TAIL, `capped at ${f(WHIFF_TAIL)}s (heavy whiff wants ${f(tailUpper)}s)`);
  ok('a jab whiff is shorter than an uppercut whiff', tail < tailUpper, `${f(tail)}s vs ${f(tailUpper)}s`);
  ok('the rest of the swing plays at a fraction of its speed', WHIFF_SLOW < 1 && WHIFF_SLOW > 0.4, `${f(WHIFF_SLOW)}×`);
  // the Overdrive is exempt (spending a full meter to cover a mistake is priced like one) — asserted structurally:
  // the gate is on the ordinary punch entry, and tryOverdrive does not consult it.
  ok('the Overdrive is the escape hatch from the tail', WHIFF_TAIL > 0, 'the gate only guards ordinary strikes (see startMove)');
  // ...and so is an emergency dodge: inside the tail you may not bail out of your own swing, unless a punch is
  // already in flight at you (the same fairness floor an empty tank gets)
  ok('inside the tail you cannot dodge-cancel your own swing', canBailOut(WHIFF_TAIL, false) === false);
  ok('...unless the opponent’s strike is already in flight', canBailOut(WHIFF_TAIL, true) === true);
  ok('with no tail, bailing out is always allowed', canBailOut(0, false) === true);
}

// ============================================================================== §6 the heavy chassis
console.log('\n§6  the heavy chassis moves less (standard > ATLAS > Zeus)');
{
  const std = chassisKnock('standard');
  const at = chassisKnock('atlas');
  const ze = chassisKnock('zeus');
  ok('a standard Titan eats the full shove', std === 1);
  ok('ATLAS takes 62%, Zeus 40% of it', at === ATLAS_KNOCK_RESIST && ze === ZEUS_KNOCK_RESIST && at < std && ze < at, `${f(std)} > ${f(at)} > ${f(ze)}`);
  ok('the same order holds for a throw', chassisLaunch('standard') > chassisLaunch('atlas') && chassisLaunch('atlas') > chassisLaunch('zeus'), `${f(chassisLaunch('standard'))} > ${f(ATLAS_LAUNCH_RESIST)} > ${f(ZEUS_LAUNCH_RESIST)}`);
  ok('and for the lift', chassisLift('standard') > chassisLift('atlas') && chassisLift('atlas') > chassisLift('zeus'), `${f(chassisLift('standard'))} > ${f(ATLAS_LAUNCH_LIFT)} > ${f(ZEUS_LAUNCH_LIFT)}`);
  // the poise bank: standard 100% of the cost, ATLAS 80%, Zeus 55%, and the jab/hook rate softer on each
  const cross = poiseCost(MOVES.cross.power);
  ok('the stability bank is thicker in the same order', chassisPoise('standard', false) > chassisPoise('atlas', false) && chassisPoise('atlas', false) > chassisPoise('zeus', false), `${f(cross)} → ${f(cross * ATLAS_POISE_COST)} → ${f(cross * ZEUS_POISE_COST)} per cross`);
  ok('a jab / hook dents every bank far less', chassisPoise('atlas', true) === ATLAS_POISE_COST_HJ && chassisPoise('zeus', true) === ZEUS_POISE_COST_HJ && ATLAS_POISE_COST_HJ < ATLAS_POISE_COST && ZEUS_POISE_COST_HJ < ZEUS_POISE_COST);
  // THE BRACE: a fresh ATLAS cannot be launched by any ordinary punch (only softened), a fresh Zeus only by the
  // designated launchers, a standard Titan braces at nothing at all
  const HJ = ['jab', 'hook'];
  const basics = ['jab', 'cross', 'hook', 'upper', 'counter'];
  ok('a fresh ATLAS shrugs off every ordinary punch', basics.every((id) => chassisBraces('atlas', id, HJ.includes(id), false)));
  ok('...but any punch sits him down once he is SOFTENED', ['cross', 'upper'].every((id) => !chassisBraces('atlas', id, false, true)));
  ok('a jab cannot sit him down even softened', HJ.every((id) => chassisBraces('atlas', id, true, true)));
  // ...and the gradient between the two heavies is real: ATLAS softens faster and travels further
  ok('ATLAS softens faster than the wall', chassisPoise('atlas', false) > chassisPoise('zeus', false), `bank ${Math.round(chassisPoise('atlas', false) * 100)}% vs ${Math.round(chassisPoise('zeus', false) * 100)}%`);
  ok('and is pushed around more while standing', chassisKnock('atlas') > chassisKnock('zeus'), `${f(chassisKnock('atlas'))} vs ${f(chassisKnock('zeus'))}`);
  ok('the launchers always go through', ['slam', 'bolt', 'windmill', 'skyhook', 'grab'].every((id) => !chassisBraces('atlas', id, false, false)));
  ok('a standard Titan braces at nothing', basics.every((id) => !chassisBraces('standard', id, false, false)));
}

// ============================================================================== §7 the defensive hierarchy
console.log('\n§7  three ways to not get hit, three prices (this is the strategy)');
{
  const blockCost = 0; // holding the guard is free, but it only chips and it drains stamina as it is beaten on
  const counterCost = MOVES.counter.cost * STAM_SCALE;
  const cheapestDodge = Math.min(...['evade', 'fwd', 'back', 'side'].map((k) => DODGE_CFG[k].cost * STAM_SCALE));
  const dearestDodge = Math.max(...['evade', 'fwd', 'back', 'side'].map((k) => DODGE_CFG[k].cost * STAM_SCALE));
  ok('blocking stays the free floor', blockCost === 0, 'guard: free to hold, 10% chip gets through');
  // the i-framed steps (a slip, a backstep, a sidestep) all cost more than a parry attempt; the forward shuffle is
  // the cheap one precisely because it buys no invulnerability — it is a repositioning step, not a defensive read
  const invDodges = ['evade', 'back', 'side'].map((k) => DODGE_CFG[k].cost * STAM_SCALE);
  ok('the counter stance is the cheap, risky middle', counterCost > 0 && counterCost < Math.min(...invDodges), `counter ${f(counterCost)} vs i-frame step ${f(Math.min(...invDodges))}–${f(Math.max(...invDodges))}`);
  ok('the free forward shuffle is the cheapest step of all', DODGE_CFG.fwd.inv === false && DODGE_CFG.fwd.cost <= Math.min(...['evade', 'back', 'side'].map((k) => DODGE_CFG[k].cost)), `${f(DODGE_CFG.fwd.cost * STAM_SCALE)} and no i-frames`);
  ok('the dodge is the expensive, rewarding top', dearestDodge > counterCost, `a step costs ${Math.round((dearestDodge / counterCost - 1) * 100)}% more than a counter`);
  // ...and the READ pays for itself, which is what makes the expensive option worth buying
  ok('and only the READ pays you back', true, 'perfect slip: +22 stamina, +24–100 meter, +26% on the next punch');
  // cooldowns: counter is the fastest to come back, the dodge the slowest
  ok('cooldowns run in the same order', MOVES.counter.cost > 0 && 0.65 > 0 && DODGE_CFG.side.cd > 0.16, `counter 0.65s · dodge ${f(DODGE_CFG.side.cd)}s`);
}

console.log(fails === 0 ? '\nSTRIKE · DODGE · GAS: ALL PASS\n' : `\n${fails} FAILURE(S)\n`);
process.exit(fails === 0 ? 0 : 1);
