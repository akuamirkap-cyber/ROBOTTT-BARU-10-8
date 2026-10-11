/**
 * THE PURE HALF OF THE FOOTWORK — the geometry of a steered strike plant, and the beat clock that puts a show-off's
 * boots on the music. Both are plain functions of numbers, so the harnesses measure exactly what the game plays.
 * (The same convention poses.ts follows: the curves and the book live here, the rig and the FX live elsewhere.)
 *
 * The two rules this file encodes, in the language of the fight:
 *   • A STRIKE STEPS WHERE THE FEET ARE ASKED TO GO. Hold W through a punch and the boot plants INTO the punch, S
 *     and it plants back under him as he retreats, A/D and it steps out to that side. A re-plant that always lands
 *     on the same old spot while the body travels is the "anomaly" the footwork must never show.
 *   • A SHOW-OFF STANDS ON PLANTED BOOTS. The boots hold their ground while the pose works over the top of them,
 *     and they answer the percussive beats of the move with one stamp each — armed a step-length early so the boot
 *     comes down exactly ON the beat, the trick a strike plant uses to land with the fist.
 */

/** where a fighter is asking his feet to go, robot-local: +z towards the enemy, +x towards his own left */
export interface Steer {
  f: number; // forward (+ = into the enemy)
  l: number; // lateral (+ = his own left)
}

/** the player's held movement keys → robot-local. +lat is the D key, which steps out to his own RIGHT = −x. */
export const steerFromKeys = (fwd: number, lat: number): Steer => ({ f: fwd, l: -lat });

export interface SteeredPlant {
  z: number; // forward part of the re-plant target (robot-local)
  x: number; // lateral part of the same target (+ = his own left)
  steer: number; // 0..1 how hard the plant is being steered (the rig lets go of the stance hold with this)
}

/**
 * THE STEERED STRIKE PLANT. The punch's own drive into the enemy keeps a share of the step; the rest of it goes
 * where the footwork is being asked to go. The reach grows with the distance to the enemy (there is more ring to
 * cross), with the weight of the punch, and with a running punch — and it is measured in the same robot-local units
 * the stance anchors use, so the plant lands in the stance, not out on some limb.
 */
export const steeredPlant = (p: {
  foot: 0 | 1; // the boot that re-plants (0 = lead/left, 1 = rear/right)
  far: number; // 0 at the clinch → 1 out of punching range
  power: number; // the punch's weight (MOVES[id].power)
  runStrike: boolean; // thrown at (near) full running speed
  steer: Steer; // see steerFromKeys / Game.steerDir
}): SteeredPlant => {
  const steer = Math.min(1, Math.hypot(p.steer.f, p.steer.l));
  const keep = 1 - 0.6 * steer; // a steered punch keeps a share of its own drive into the enemy
  const baseZ = (0.13 + p.far * 0.46) * (0.8 + p.power * 0.45) * (p.runStrike ? 1.25 : 1);
  const baseX = (p.foot === 0 ? -0.05 : 0.07) * (0.5 + p.far * 0.8); // a small pivot towards the centre line
  const reach = (0.32 + 0.30 * p.far) * (0.75 + 0.5 * p.power) * (p.runStrike ? 1.15 : 1);
  return { z: baseZ * keep + p.steer.f * reach * steer, x: baseX * keep + p.steer.l * reach * steer, steer };
};

// ---------------------------------------------------------------- the show-off's beat clock
/**
 * The beats of a freestyle move the boots answer with a stamp. A percussive beat — a chest pound, a fist clash, the
 * clap at the end of the windmill, the chin-up that ends a show — is a stamp. A beckon, a flex, a servo check is
 * not: there the boots stay planted and the hips do the talking.
 */
export const STAMP_CUES: ReadonlySet<string> = new Set(['beat', 'clash', 'clap', 'chin', 'roar']);
export const FS_STAMP_LEAD = 0.17; // how long a stamp takes to come down: the beat is armed this early so it LANDS on it.
// It is deliberately SNAPping — the boot is off the canvas for a blink, so a show-off reads as a machine tapping the
// mat on the beat, not as a machine doing a jig.
export const FS_STAMP_LIFT = 0.22; // and it is a real boot coming down — enough air for the fight camera to catch it
export const FS_STAMP_SEQ = 9000; // step ids of the stamps (the strike footwork uses the move sequence numbers)

/**
 * WHICH CUE OF THE RUNNING MOVE MUST BE PUT ON THE STAMP SCHEDULE RIGHT NOW — the first percussive beat whose landing
 * is inside the step's own lead time, or −1 when there is nothing to arm. `fired` is the move's own record of what
 * has already been scheduled (reset when a new move is chosen), and `tauntT` counts the move DOWN, so the time left
 * before a beat lands is `tauntT − (1 − p) · dur`.
 */
export const stampCueAt = (cues: { p: number; s: string }[], dur: number, tauntT: number, fired: boolean[]): number => {
  for (let i = 0; i < cues.length; i++) {
    if (fired[i] || !STAMP_CUES.has(cues[i].s)) continue;
    if (tauntT - (1 - cues[i].p) * dur <= FS_STAMP_LEAD) return i;
  }
  return -1;
};

/** how long the stamp armed for cue `i` should take: it is the time actually left before that beat, clamped */
export const stampDurFor = (cue: { p: number }, dur: number, tauntT: number) =>
  Math.max(0.1, Math.min(FS_STAMP_LEAD, tauntT - (1 - cue.p) * dur));
