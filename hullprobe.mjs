#!/usr/bin/env node
/*
  hullprobe — PRINTS THE REAL PER-SEGMENT HULLS of whatever chassis is active, measured from the actual
  meshes (no FX/additive children). This is the tool that produced `HULL_ATLAS` in src/game/bodySpec.ts
  (run it with CHASSIS='atlas') and the SIMPLE column of DESAIN_ROBOT.md §5 (CHASSIS='simple').

  Use it after any art change to a segment, or to re-derive the ATLAS baseline:
      npm run --silent probe:hull
  It also prints the standing height and the kneecap's front reach, the two numbers the design doc quotes.
*/
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
mkdirSync('.tmp', { recursive: true });
const esbuild = await import('esbuild');
await esbuild.build({ entryPoints: ['src/game/robot.ts'], bundle: true, format: 'esm', outfile: '.__robot.mjs', platform: 'node', external: ['three'] });
import * as THREE from 'three';
import { Robot } from './.__robot.mjs';
import { CHASSIS } from './.__bodyspec.mjs';
const elStub = () => ({ style:{}, classList:{add(){}}, setAttribute(){}, addEventListener(){}, removeEventListener(){}, appendChild(){}, textContent:'' });
globalThis.document = globalThis.document || { createElement: elStub, createElementNS: elStub, body: elStub() };
const isFx = (o) => { const m=o.material; return !m || m.blending===THREE.AdditiveBlending || o.isLight || o.isSprite; };
function segBox(node, skip=[]){ node.updateWorldMatrix(true,true);
  const inv=new THREE.Matrix4().copy(node.matrixWorld).invert(); const b=new THREE.Box3(); const sk=new Set(skip);
  const walk=(o,blocked)=>{ if(sk.has(o))return; const stop=blocked||sk.has(o);
    if(o.isMesh&&o.geometry?.attributes?.position&&!stop&&!isFx(o)){ const g=o.geometry; if(!g.boundingBox)g.computeBoundingBox(); b.union(g.boundingBox.clone().applyMatrix4(o.matrixWorld).applyMatrix4(inv)); }
    for(const ch of o.children) walk(ch,stop); };
  walk(node,false); if(b.isEmpty())return null; const s=b.getSize(new THREE.Vector3());
  return {w:s.x,h:s.y,d:s.z,min:b.min,max:b.max}; }
console.log(`CHASSIS AKTIF = ${CHASSIS}\n`);
const r = new Robot({variant:'atom',main:0x8a8f98,secondary:0x3a3f47,accent:0x1e9bff,glow:0x63e0ff},1);
r.root.updateMatrixWorld(true);
const thighG=r.hipJ[0].children.find(c=>c!==r.kneeJ[0]&&c.isGroup);
const shinG=r.kneeJ[0].children.find(c=>c!==r.footJ[0]&&c!==r.kneeCaps[0]&&c.isGroup);
const segs=[
 ['pelvis',()=>segBox(r.pelvis,[r.waist,...r.hipJ])],['waist',()=>segBox(r.waist,[r.chest])],
 ['chest',()=>segBox(r.chest,[r.neck,...r.clavs])],['neck',()=>segBox(r.neck,[r.head])],
 ['head',()=>segBox(r.head,[])],['clav',()=>segBox(r.clavs[0],[r.caps[0],r.shoulders[0]])],
 ['cap',()=>segBox(r.caps[0],[])],['arm',()=>segBox(r.shoulders[0],[r.elbows[0]])],
 ['fore',()=>segBox(r.elbows[0],[r.wrists[0]])],['fist',()=>segBox(r.fists[0],[])],
 ['hip',()=>segBox(r.hipJ[0],[r.kneeJ[0],thighG])],['thigh',()=>segBox(thighG,[])],
 ['knee',()=>segBox(r.kneeJ[0],[r.footJ[0],r.kneeCaps[0],shinG])],['kneecap',()=>segBox(r.kneeCaps[0],[])],
 ['shin',()=>segBox(shinG,[])],['boot',()=>segBox(r.footJ[0],[])]];
const out={}; for(const [k,fn] of segs){ const m=fn(); out[k]=[+m.w.toFixed(2),+m.h.toFixed(2),+m.d.toFixed(2)]; 
  console.log(k.padEnd(9), out[k].join(' × '), ' y:',m.min.y.toFixed(2),'…',m.max.y.toFixed(2), ' z:',m.min.z.toFixed(2),'…',m.max.z.toFixed(2)); }
console.log('\nHULL =', JSON.stringify(out));
// jangkauan depan tempurung lutut (relatif lutut)
const kneeRel = (()=>{ const inv=new THREE.Matrix4().copy(r.kneeJ[0].matrixWorld).invert();
  const bb=new THREE.Box3(); r.kneeCaps[0].updateWorldMatrix(true,true); r.kneeCaps[0].traverse(o=>{ if(o.isMesh&&!isFx(o)){ const g=o.geometry; if(!g.boundingBox)g.computeBoundingBox(); bb.union(g.boundingBox.clone().applyMatrix4(o.matrixWorld).applyMatrix4(inv)); }}); return bb; })();
console.log('tempurung: z depan (relatif lutut) =', kneeRel.max.z.toFixed(3), ' z belakang =', kneeRel.min.z.toFixed(3));
// tinggi berdiri: puncak kepala sampai titik terendah boot, di ruang dunia
const toWorld = (node, v) => new THREE.Vector3(v[0], v[1], v[2]).applyMatrix4(node.matrixWorld);
const hb = segBox(r.head, []), fb = segBox(r.footJ[0], []);
const top = toWorld(r.head, [0, hb.max.y, 0]).y, bottom = toWorld(r.footJ[0], [0, fb.min.y, 0]).y;
console.log('tinggi berdiri =', (top - bottom).toFixed(2), 'm   (root scale', r.root.scale.x.toFixed(3) + ')');
