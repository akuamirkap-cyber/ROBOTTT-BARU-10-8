/** Shared skeleton dimensions (robot-local units). The IK and the model builders both depend on these.
 *  With CHASSIS 'realsteel' (default) every number comes from the measured Real Steel Simulator rig
 *  (`RS_SKEL` in bodySpec.ts); 'simple'/'atlas' keep the legacy heroic proportions. */
import { CHASSIS, RS_SKEL } from './bodySpec';
const RS = CHASSIS === 'realsteel';
export const L1 = RS ? RS_SKEL.L1 : 2.0; // hip -> knee
export const L2 = RS ? RS_SKEL.L2 : 1.92; // knee -> ankle
export const HIP_Y = RS ? RS_SKEL.HIP_Y : 2.85; // hip joint height, in pelvis space
export const UP = 0.71; // upper-body pivot offset in body space (preserves floor get-up hand-plant geometry)
export const CY = RS ? RS_SKEL.CY : 0.35; // chest origin above the waist origin
