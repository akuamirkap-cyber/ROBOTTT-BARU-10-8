import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export const JOINTS = [
  'pelvis', 'waist', 'spine', 'chest', 'neck', 'head',
  'clavL', 'shoulderL', 'elbowL', 'wristL',
  'clavR', 'shoulderR', 'elbowR', 'wristR',
  'hipL', 'kneeL', 'ankleL',
  'hipR', 'kneeR', 'ankleR',
] as const;
export type JointName = (typeof JOINTS)[number];

export interface Colors {
  armor: number;
  accent: number;
  frame: number;
  glow: number;
  glove: number;
  joint: number;
}

export interface Rig {
  root: THREE.Group;
  joints: Record<JointName, THREE.Group>;
  markers: THREE.Mesh[];
  labels: CSS2DObject[];
  meshes: THREE.Mesh[];
  hand: { L: THREE.Object3D; R: THREE.Object3D };
  headMesh: THREE.Object3D;
  chestMesh: THREE.Object3D;
  glowMat: THREE.MeshStandardMaterial;
  gloveMat: THREE.MeshStandardMaterial;
  knuckleMat: THREE.MeshStandardMaterial;
  armorMat: THREE.MeshStandardMaterial;
  glowColor: THREE.Color;
}

export function createRig(c: Colors, labelPrefix: string): Rig {
  const meshes: THREE.Mesh[] = [];
  const markers: THREE.Mesh[] = [];
  const labels: CSS2DObject[] = [];

  const armor = new THREE.MeshStandardMaterial({ color: c.armor, metalness: 0.65, roughness: 0.32 });
  const accent = new THREE.MeshStandardMaterial({ color: c.accent, metalness: 0.5, roughness: 0.35 });
  const frame = new THREE.MeshStandardMaterial({ color: c.frame, metalness: 0.9, roughness: 0.38 });
  const glowMat = new THREE.MeshStandardMaterial({ color: c.glow, emissive: c.glow, emissiveIntensity: 2.2, metalness: 0, roughness: 0.4 });
  const gloveMat = new THREE.MeshStandardMaterial({ color: c.glove, metalness: 0.85, roughness: 0.22, emissive: c.glow, emissiveIntensity: 0 });
  const knuckleMat = new THREE.MeshStandardMaterial({ color: c.glow, emissive: c.glow, emissiveIntensity: 1.2 });
  const markerMat = new THREE.MeshBasicMaterial({ color: c.joint, depthTest: false, transparent: true, opacity: 0.95 });

  type T3 = [number, number, number];
  const add = (parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, pos: T3, rot?: T3) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(...pos);
    if (rot) mesh.rotation.set(...rot);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    meshes.push(mesh);
    return mesh;
  };
  const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
  const cyl = (rt: number, rb: number, h: number, seg = 16) => new THREE.CylinderGeometry(rt, rb, h, seg);
  const sph = (r: number) => new THREE.SphereGeometry(r, 18, 12);

  const label = (obj: THREE.Object3D, text: string, offset: T3 = [0, 0, 0]) => {
    const div = document.createElement('div');
    div.className = 'joint-label';
    div.textContent = text;
    const l = new CSS2DObject(div);
    l.position.set(...offset);
    obj.add(l);
    labels.push(l);
  };

  const joint = (parent: THREE.Object3D, pos: T3, name: string) => {
    const g = new THREE.Group();
    g.name = name;
    g.position.set(...pos);
    parent.add(g);
    const mk = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), markerMat);
    mk.renderOrder = 999;
    g.add(mk);
    markers.push(mk);
    return g;
  };

  const root = new THREE.Group();
  root.name = labelPrefix + 'root';

  // ---------- TORSO ----------
  const pelvis = joint(root, [0, 0, 0], 'pelvis');
  add(pelvis, box(0.3, 0.13, 0.19), frame, [0, -0.01, 0]);
  add(pelvis, box(0.2, 0.1, 0.03), armor, [0, -0.02, 0.1]);
  add(pelvis, box(0.2, 0.1, 0.03), armor, [0, -0.02, -0.1]);
  label(pelvis, 'Pelvis / Hip', [0.24, 0, 0]);

  const waist = joint(pelvis, [0, 0.08, 0], 'waist');
  add(waist, cyl(0.075, 0.085, 0.13), frame, [0, 0.05, 0]);
  add(waist, cyl(0.095, 0.095, 0.025), accent, [0, 0.02, 0]);
  add(waist, cyl(0.09, 0.09, 0.025), accent, [0, 0.085, 0]);
  label(waist, 'Waist', [0.22, 0.04, 0]);

  const spine = joint(waist, [0, 0.12, 0], 'spine');
  add(spine, box(0.27, 0.12, 0.18), armor, [0, 0.06, 0]);
  add(spine, box(0.12, 0.03, 0.02), accent, [0, 0.04, 0.095]);
  add(spine, box(0.12, 0.03, 0.02), accent, [0, 0.085, 0.095]);
  label(spine, 'Spine', [-0.24, 0.04, 0]);

  const chest = joint(spine, [0, 0.12, 0], 'chest');
  const chestMesh = add(chest, box(0.4, 0.26, 0.23), armor, [0, 0.12, 0]);
  add(chest, box(0.3, 0.1, 0.05), accent, [0, 0.21, 0.1]);
  add(chest, cyl(0.055, 0.055, 0.03, 20), frame, [0, 0.11, 0.115], [Math.PI / 2, 0, 0]);
  add(chest, cyl(0.04, 0.04, 0.035, 20), glowMat, [0, 0.11, 0.12], [Math.PI / 2, 0, 0]);
  add(chest, box(0.06, 0.12, 0.05), frame, [0.1, 0.12, -0.13]);
  add(chest, box(0.06, 0.12, 0.05), frame, [-0.1, 0.12, -0.13]);
  label(chest, 'Chest / Torso', [0.28, 0.12, 0]);

  // ---------- HEAD / NECK ----------
  const neck = joint(chest, [0, 0.25, 0], 'neck');
  add(neck, cyl(0.035, 0.045, 0.1), frame, [0, 0.04, 0]);
  add(neck, cyl(0.05, 0.05, 0.015), accent, [0, 0.02, 0]);
  label(neck, 'Neck', [0.14, 0.03, 0]);

  const head = joint(neck, [0, 0.09, 0], 'head');
  // skull core
  const headMesh = add(head, box(0.18, 0.14, 0.19), armor, [0, 0.125, -0.01]);
  // sloped forehead armour
  add(head, box(0.2, 0.05, 0.13), armor, [0, 0.19, 0.04], [0.5, 0, 0]);
  // V-shaped angry brow plates
  add(head, box(0.1, 0.028, 0.045), accent, [0.048, 0.163, 0.098], [0, 0, 0.38]);
  add(head, box(0.1, 0.028, 0.045), accent, [-0.048, 0.163, 0.098], [0, 0, -0.38]);
  // dark visor recess
  add(head, box(0.165, 0.05, 0.02), frame, [0, 0.13, 0.093]);
  // slanted glowing eyes (angry)
  add(head, box(0.058, 0.015, 0.02), glowMat, [0.042, 0.133, 0.103], [0, 0, 0.32]);
  add(head, box(0.058, 0.015, 0.02), glowMat, [-0.042, 0.133, 0.103], [0, 0, -0.32]);
  // heavy jaw with grille teeth
  add(head, box(0.15, 0.065, 0.11), frame, [0, 0.055, 0.045]);
  add(head, box(0.12, 0.02, 0.03), armor, [0, 0.025, 0.095]);
  for (let i = -2; i <= 2; i++) add(head, box(0.013, 0.038, 0.012), accent, [i * 0.024, 0.06, 0.103]);
  // angled cheek guards
  add(head, box(0.025, 0.1, 0.12), armor, [0.088, 0.085, 0.04], [0, 0.4, 0.08]);
  add(head, box(0.025, 0.1, 0.12), armor, [-0.088, 0.085, 0.04], [0, -0.4, -0.08]);
  // crest fin
  add(head, box(0.022, 0.07, 0.2), accent, [0, 0.225, -0.02], [0.15, 0, 0]);
  // horns swept back
  add(head, new THREE.ConeGeometry(0.022, 0.14, 8), accent, [0.085, 0.215, -0.02], [-0.7, 0, -0.55]);
  add(head, new THREE.ConeGeometry(0.022, 0.14, 8), accent, [-0.085, 0.215, -0.02], [-0.7, 0, 0.55]);
  // ear pistons with glow
  add(head, cyl(0.034, 0.034, 0.035), frame, [0.1, 0.12, -0.02], [0, 0, Math.PI / 2]);
  add(head, cyl(0.034, 0.034, 0.035), frame, [-0.1, 0.12, -0.02], [0, 0, Math.PI / 2]);
  add(head, cyl(0.018, 0.018, 0.045), glowMat, [0.115, 0.12, -0.02], [0, 0, Math.PI / 2]);
  add(head, cyl(0.018, 0.018, 0.045), glowMat, [-0.115, 0.12, -0.02], [0, 0, Math.PI / 2]);
  // rear exhaust
  add(head, box(0.1, 0.06, 0.04), frame, [0, 0.12, -0.115]);
  label(head, 'Head', [0, 0.42, 0]);

  // ---------- ARMS ----------
  const arm = (side: 'L' | 'R') => {
    const s = side === 'L' ? 1 : -1;
    const sideTxt = side === 'L' ? 'Kiri' : 'Kanan';
    const clav = joint(chest, [s * 0.06, 0.2, 0], 'clav' + side);
    add(clav, box(0.12, 0.05, 0.07), frame, [s * 0.07, 0, 0]);
    const shoulder = joint(clav, [s * 0.15, 0, 0], 'shoulder' + side);
    add(shoulder, sph(0.062), frame, [0, 0, 0]);
    add(shoulder, box(0.15, 0.08, 0.16), armor, [s * 0.02, 0.04, 0]);
    add(shoulder, box(0.13, 0.02, 0.14), accent, [s * 0.02, 0.09, 0]);
    label(shoulder, `Shoulder ${sideTxt}`, [s * 0.17, 0.07, 0]);
    add(shoulder, cyl(0.048, 0.043, 0.2), armor, [0, -0.15, 0]);
    add(shoulder, cyl(0.028, 0.028, 0.24, 8), frame, [0, -0.14, 0]);
    label(shoulder, `Upper Arm ${sideTxt}`, [s * 0.14, -0.14, 0]);
    const elbow = joint(shoulder, [0, -0.28, 0], 'elbow' + side);
    add(elbow, sph(0.044), frame, [0, 0, 0]);
    add(elbow, cyl(0.03, 0.03, 0.1, 12), accent, [0, 0, 0], [0, 0, Math.PI / 2]);
    label(elbow, `Elbow ${sideTxt}`, [s * 0.13, 0, 0]);
    add(elbow, box(0.085, 0.19, 0.095), armor, [0, -0.13, 0]);
    add(elbow, box(0.09, 0.04, 0.1), accent, [0, -0.2, 0]);
    label(elbow, `Forearm ${sideTxt}`, [s * 0.14, -0.13, 0]);
    const wrist = joint(elbow, [0, -0.26, 0], 'wrist' + side);
    add(wrist, cyl(0.03, 0.03, 0.03, 12), frame, [0, 0, 0]);
    label(wrist, `Wrist ${sideTxt}`, [s * 0.13, 0.01, 0]);
    const fist = add(wrist, box(0.1, 0.11, 0.11), gloveMat, [0, -0.065, 0.003]);
    add(wrist, box(0.09, 0.012, 0.08), knuckleMat, [0, -0.121, 0.005]);
    add(wrist, box(0.03, 0.05, 0.04), gloveMat, [-s * 0.0, -0.05, 0.065]);
    label(wrist, `Hand / Fist ${sideTxt}`, [s * 0.15, -0.08, 0]);
    return { clav, shoulder, elbow, wrist, fist };
  };
  const aL = arm('L');
  const aR = arm('R');

  // ---------- LEGS ----------
  const leg = (side: 'L' | 'R') => {
    const s = side === 'L' ? 1 : -1;
    const sideTxt = side === 'L' ? 'Kiri' : 'Kanan';
    const hip = joint(pelvis, [s * 0.09, -0.05, 0], 'hip' + side);
    add(hip, sph(0.068), frame, [0, 0, 0]);
    label(hip, `Hip ${sideTxt}`, [s * 0.16, 0.02, 0]);
    add(hip, box(0.12, 0.3, 0.13), armor, [0, -0.22, 0]);
    add(hip, box(0.125, 0.05, 0.135), accent, [0, -0.1, 0]);
    label(hip, `Thigh ${sideTxt}`, [s * 0.16, -0.22, 0]);
    const knee = joint(hip, [0, -0.44, 0], 'knee' + side);
    add(knee, sph(0.055), frame, [0, 0, 0]);
    add(knee, box(0.09, 0.09, 0.04), accent, [0, 0.0, 0.06]);
    label(knee, `Knee ${sideTxt}`, [s * 0.15, 0, 0]);
    add(knee, box(0.1, 0.3, 0.11), armor, [0, -0.2, 0]);
    add(knee, box(0.04, 0.2, 0.02), glowMat, [0, -0.2, 0.058]);
    label(knee, `Shin / Calf ${sideTxt}`, [s * 0.16, -0.21, 0]);
    const ankle = joint(knee, [0, -0.42, 0], 'ankle' + side);
    add(ankle, sph(0.042), frame, [0, 0, 0]);
    label(ankle, `Ankle ${sideTxt}`, [s * 0.14, 0.01, 0]);
    add(ankle, box(0.115, 0.06, 0.26), frame, [0, -0.04, 0.055]);
    add(ankle, box(0.1, 0.03, 0.1), accent, [0, -0.0, 0.12]);
    label(ankle, `Foot ${sideTxt}`, [s * 0.13, -0.05, 0.17]);
    return { hip, knee, ankle };
  };
  const lL = leg('L');
  const lR = leg('R');

  const joints: Record<JointName, THREE.Group> = {
    pelvis, waist, spine, chest, neck, head,
    clavL: aL.clav, shoulderL: aL.shoulder, elbowL: aL.elbow, wristL: aL.wrist,
    clavR: aR.clav, shoulderR: aR.shoulder, elbowR: aR.elbow, wristR: aR.wrist,
    hipL: lL.hip, kneeL: lL.knee, ankleL: lL.ankle,
    hipR: lR.hip, kneeR: lR.knee, ankleR: lR.ankle,
  };

  return {
    root, joints, markers, labels, meshes,
    hand: { L: aL.fist, R: aR.fist },
    headMesh, chestMesh, glowMat, gloveMat, knuckleMat, armorMat: armor,
    glowColor: new THREE.Color(c.glow),
  };
}
