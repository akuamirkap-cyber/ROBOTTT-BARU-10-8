import { useEffect, useRef, useState } from 'react';
import EditorPanel from './EditorPanel';
import { ZEUS_PRESET } from './zeusPreset';
type Mode = 'auto' | 'sombong' | 'tinju' | 'diam';
type V3 = [number, number, number];
type Adj = { p: V3; r: V3; s: V3; u: number; v?: V3; b?: [number, number] };
type SelInfo = { id: string; label: string; side: string; hasMirror: boolean; adj: Adj };
type Api = {
  setAdj: (id: string, a: Adj, mirror: boolean) => void;
  setAdjRigid: (primaryId: string, a: Adj, otherIds: string[], mirror: boolean) => void;
  setLinks: (groups: Record<string, string[]>, follow: boolean) => void;
  bakeLinks: () => void;
  setHidden: (ids: string[], mirror: boolean) => string[];
  mirrorOf: (id: string) => string | null;
  exportData: () => object;
  importData: (d: never) => void;
  resetAll: () => void;
  deselect: () => void;
  selectIds: (ids: string[]) => void;
  info: (id: string) => SelInfo | null;
  setTheme: (hex: string) => void;
};
export const THEMES: [string, string, string][] = [
  ['Hijau', '#22ff44', '#4ade80'],
  ['Merah', '#ff2233', '#f87171'],
  ['Kuning', '#ffdd00', '#fde047'],
  ['Biru', '#2288ff', '#60a5fa'],
  ['Putih', '#e8f0ff', '#f1f5f9'],
  ['Oren', '#ff7a00', '#fb923c'],
];
const LS_KEY = 'zeus-part-adjust-v1';
const GROUP_KEY = 'zeus-groups-v1';
const THEME_KEY = 'zeus-theme-v1';
const FOLLOW_KEY = 'zeus-follow-v1';
const HIDDEN_KEY = 'zeus-hidden-v1';
const defAdj = (): Adj => ({ p: [0, 0, 0], r: [0, 0, 0], s: [1, 1, 1], u: 1, v: [0, 0, 0], b: [0, 0] });
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

type N3 = [number, number, number];
type P2 = [number, number];

function blob(e = 0.5, seg = 48) {
  const g = new THREE.SphereGeometry(1, seg, seg / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const f = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), e);
    p.setXYZ(i, f(p.getX(i)), f(p.getY(i)), f(p.getZ(i)));
  }
  g.computeVertexNormals();
  return g;
}

function panel(o: { w: number; h: number; d?: number; bottom?: number; bendX?: number; bendY?: number; bulge?: number; skew?: number; tip?: number }) {
  const { w, h, d = 0.2, bottom = 1, bendX = 0, bendY = 0, bulge = 0.08, skew = 0, tip = 0 } = o;
  const g = new THREE.BoxGeometry(1, 1, 1, 32, 32, 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), z = p.getZ(i);
    const y = p.getY(i);
    const t = y + 0.5;
    const nx = x * 2;
    const edge = Math.max(Math.abs(nx), Math.abs(y * 2));
    z = z * d * (1 - Math.pow(edge, 8) * 0.5);
    if (z > 0) z += bulge * (1 - nx * nx) * (1 - 4 * y * y);
    let yy = y * h;
    if (tip) yy -= tip * (1 - Math.abs(nx)) * (1 - t) * (1 - t);
    x = x * w * (bottom + (1 - bottom) * t) + skew * (t - 0.5);
    if (bendX) { const R = bendX, a = x / R, r = R + z; x = r * Math.sin(a); z = r * Math.cos(a) - R; }
    if (bendY) { const R = bendY, a = yy / R, r = R + z; yy = r * Math.sin(a); z = r * Math.cos(a) - R; }
    p.setXYZ(i, x, yy, z);
  }
  g.computeVertexNormals();
  return g;
}

/** smooth shape outline (rounded corners via quadratic curves) */
function shape(pts: P2[], round = 0.12) {
  const s = new THREE.Shape();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n];
    const a: P2 = [p1[0] + (p0[0] - p1[0]) * round, p1[1] + (p0[1] - p1[1]) * round];
    const b: P2 = [p1[0] + (p2[0] - p1[0]) * round, p1[1] + (p2[1] - p1[1]) * round];
    if (i === 0) s.moveTo(a[0], a[1]); else s.lineTo(a[0], a[1]);
    s.quadraticCurveTo(p1[0], p1[1], b[0], b[1]);
  }
  s.closePath();
  return s;
}
/** front profile (x,y) extruded in z, centered, with big shiny bevel */
function front(pts: P2[], depth: number, bevel = 0.1, round = 0.15) {
  const g = new THREE.ExtrudeGeometry(shape(pts, round), { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 5, curveSegments: 8 });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}
/** side profile (z,y) extruded in x, centered */
function side(pts: P2[], width: number, bevel = 0.1, round = 0.15) {
  const g = front(pts, width, bevel, round);
  g.rotateY(-Math.PI / 2);
  return g;
}
/** wrap geometry around vertical axis (x -> arc) */
function bend(g: THREE.BufferGeometry, R: number) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const a = x / R, r = R + z;
    p.setXYZ(i, r * Math.sin(a), p.getY(i), r * Math.cos(a) - R);
  }
  g.computeVertexNormals();
  return g;
}
/** muscular round limb from radius profile [r,y] */
function lathe(pts: P2[], seg = 40) {
  return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
}

export default function ZeusViewer({ onBack }: { onBack?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const modeRef = useRef<Mode>('auto');
  const [mode, setMode] = useState<Mode>('auto');
  const pick = (m: Mode) => { modeRef.current = m; setMode(m); };
  const apiRef = useRef<Api | null>(null);
  const editRef = useRef(false);
  const [edit, setEdit] = useState(false);
  const [sel, setSel] = useState<SelInfo | null>(null);
  const [mirror, setMirror] = useState(true);
  const [toast, setToast] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  // ---- multi-select & groups ----
  const [selIds, setSelIds] = useState<string[]>([]);
  const selIdsRef = useRef<string[]>([]);
  const [groups, setGroups] = useState<Record<string, string[]>>(() => {
    try {
      const s = localStorage.getItem(GROUP_KEY);
      return s ? JSON.parse(s) : { ...ZEUS_PRESET.groups };
    } catch { return { ...ZEUS_PRESET.groups }; }
  });
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const [groupLock, setGroupLock] = useState(true);
  const groupLockRef = useRef(true);
  groupLockRef.current = groupLock;
  const [multi, setMulti] = useState(false);
  const multiRef = useRef(false);
  multiRef.current = multi;
  const [groupName, setGroupName] = useState('');
  const [hiddenIds, setHiddenIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem(HIDDEN_KEY) || '[]'); } catch { return []; }
  });
  const deleteSelected = () => {
    if (!selIds.length) return;
    const add = new Set(hiddenIds);
    selIds.forEach((id) => {
      add.add(id);
      if (mirror) {
        const mid = apiRef.current?.mirrorOf(id);
        if (mid) add.add(mid);
      }
    });
    setHiddenIds([...add]);
    flash(`${selIds.length} part dihapus`);
    applySel([]);
  };
  const [follow, setFollowState] = useState(() => localStorage.getItem(FOLLOW_KEY) !== '0');
  const setFollow = (v: boolean) => { setFollowState(v); localStorage.setItem(FOLLOW_KEY, v ? '1' : '0'); };
  // choose leader: move to end of selection and of its group
  const makeLeader = (id: string) => {
    const g: Record<string, string[]> = {};
    let changed = false;
    Object.entries(groupsRef.current).forEach(([k, v]) => {
      if (v.includes(id) && v[v.length - 1] !== id) { g[k] = [...v.filter((x) => x !== id), id]; changed = true; }
      else g[k] = v;
    });
    if (changed) saveGroups(g);
    applySel([...selIdsRef.current.filter((x) => x !== id), id]);
  };
  // ---- theme ----
  const [theme, setThemeState] = useState<string>(() => localStorage.getItem(THEME_KEY) || '#22ff44');
  const themeRef = useRef(theme);
  const accent = THEMES.find((t) => t[1] === theme)?.[2] || '#4ade80';
  const changeTheme = (hex: string) => {
    setThemeState(hex);
    themeRef.current = hex;
    localStorage.setItem(THEME_KEY, hex);
    apiRef.current?.setTheme(hex);
  };

  const saveGroups = (g: Record<string, string[]>) => {
    setGroups(g);
    localStorage.setItem(GROUP_KEY, JSON.stringify(g));
    apiRef.current?.bakeLinks();
  };
  const applySel = (ids: string[]) => {
    selIdsRef.current = ids;
    setSelIds(ids);
    apiRef.current?.selectIds(ids);
    const last = ids[ids.length - 1];
    setSel(last ? apiRef.current?.info(last) || null : null);
  };
  const onPickRef = useRef<(id: string | null, add: boolean) => void>(() => {});
  onPickRef.current = (id, add) => {
    const cur = selIdsRef.current;
    if (!id) { if (!add) applySel([]); return; }
    let ids: string[] = [id];
    if (groupLockRef.current) {
      const g = Object.values(groupsRef.current).find((m) => m.includes(id));
      if (g) ids = [...g]; // leader (last) stays primary
    }
    if (add) {
      const allIn = ids.every((x) => cur.includes(x));
      ids = allIn ? cur.filter((x) => !ids.includes(x)) : [...cur.filter((x) => !ids.includes(x)), ...ids];
    }
    applySel(ids);
  };
  const createGroup = () => {
    if (selIds.length < 2) { flash('Pilih minimal 2 part (Shift+klik)'); return; }
    const name = groupName.trim() || `Grup ${Object.keys(groups).length + 1}`;
    const g: Record<string, string[]> = {};
    // a part can only belong to one group
    Object.entries(groups).forEach(([k, v]) => { const r = v.filter((x) => !selIds.includes(x)); if (r.length > 1) g[k] = r; });
    g[name] = [...selIds];
    saveGroups(g);
    setGroupName('');
    flash(`Grup "${name}" dibuat (${selIds.length} part)`);
  };
  const deleteGroup = (name: string) => { const g = { ...groups }; delete g[name]; saveGroups(g); };

  const toggleEdit = () => {
    const v = !editRef.current;
    editRef.current = v;
    setEdit(v);
    if (v) pick('diam');
    else applySel([]);
  };
  const flash = (t: string) => { setToast(t); setTimeout(() => setToast(''), 2200); };
  // applies the same changed field to every selected part
  const update = (fn: (a: Adj) => Adj) => {
    const api = apiRef.current;
    if (!api || !selIds.length) return;
    if (follow && selIds.length > 1) {
      const pid = selIds[selIds.length - 1];
      const cur = api.info(pid);
      if (!cur) return;
      api.setAdjRigid(pid, fn(cur.adj), selIds.slice(0, -1), mirror);
      setSel(api.info(pid));
      return;
    }
    for (const id of selIds) {
      const cur = api.info(id);
      if (!cur) continue;
      api.setAdj(id, fn(cur.adj), mirror);
    }
    const last = selIds[selIds.length - 1];
    setSel(api.info(last));
  };
  const doExport = () => {
    apiRef.current?.bakeLinks();
    const data = { ...(apiRef.current?.exportData() || {}), groups, tema: theme, dihapus: hiddenIds };
    const txt = JSON.stringify(data, null, 2);
    navigator.clipboard?.writeText(txt).catch(() => {});
    const blob = new Blob([txt], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'zeus-adjust.json';
    a.click();
    flash('Data diexport (file + clipboard)');
  };
  const doImport = (f: File) => {
    f.text().then((t) => {
      try {
        const d = JSON.parse(t);
        apiRef.current?.importData(d as never);
        if (d.groups && typeof d.groups === 'object') saveGroups(d.groups);
        if (typeof d.tema === 'string') changeTheme(d.tema);
        if (Array.isArray(d.dihapus)) setHiddenIds(d.dihapus);
        flash('Import berhasil');
      }
      catch { flash('File tidak valid'); }
    });
  };

  useEffect(() => {
    const el = ref.current!;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
    scene.environmentIntensity = 0.65;

    const camera = new THREE.PerspectiveCamera(30, innerWidth / innerHeight, 0.1, 200);
    camera.position.set(0, 7, 30);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 6.5, 0);
    controls.enableDamping = true;
    controls.minDistance = 8;
    controls.maxDistance = 60;

    scene.add(new THREE.HemisphereLight(0xffffff, 0x222222, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(5, 14, 12);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -10, right: 10, top: 16, bottom: -2, near: 1, far: 50 });
    key.shadow.bias = -0.0004;
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xdde8ff, 0.8);
    fill.position.set(-8, 6, 8);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0x5dff7a, 3.5);
    rim.position.set(0, 10, -10);
    scene.add(rim);
    for (const sx of [-1, 1]) {
      const r2 = new THREE.DirectionalLight(0xffffff, 1.2);
      r2.position.set(sx * 12, 8, -4);
      scene.add(r2);
    }

    const gun = new THREE.MeshPhysicalMaterial({ color: 0x33373b, metalness: 0.9, roughness: 0.24, clearcoat: 1, clearcoatRoughness: 0.08 });
    const gunL = new THREE.MeshPhysicalMaterial({ color: 0x50555a, metalness: 0.9, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08 });
    const blk = new THREE.MeshPhysicalMaterial({ color: 0x121314, metalness: 0.6, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
    const blkM = new THREE.MeshStandardMaterial({ color: 0x050505, metalness: 0.3, roughness: 0.6 });
    const chrome = new THREE.MeshPhysicalMaterial({ color: 0xd8dce0, metalness: 1, roughness: 0.08 });
    const eye = new THREE.MeshStandardMaterial({ color: 0x66ff66, emissive: 0x22ff44, emissiveIntensity: 8, toneMapped: false });
    const crystal = new THREE.MeshPhysicalMaterial({ color: 0x1e9a3a, emissive: 0x0a4a14, emissiveIntensity: 0.6, metalness: 0, roughness: 0.08, transmission: 0.6, thickness: 0.6, ior: 1.5, clearcoat: 1 });
    [gun, gunL, blk, blkM, chrome, eye, crystal].forEach((m) => (m.side = THREE.DoubleSide));

    const glowTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const x = c.getContext('2d')!;
      const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.3, 'rgba(255,255,255,0.4)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, 128, 128);
      return new THREE.CanvasTexture(c);
    })();

    const robot = new THREE.Group();
    scene.add(robot);
    const arms: { arm: THREE.Group; fore: THREE.Group; s: number }[] = [];
    const legs: { leg: THREE.Group; s: number }[] = [];
    // ---- part registry (for click-to-edit) ----
    const parts: THREE.Mesh[] = [];
    const partById = new Map<string, THREE.Mesh>();
    const createdStack: THREE.Mesh[][] = [];
    const secCount: Record<string, number> = {};
    let section = 'Kepala';
    const add = (g: THREE.BufferGeometry, m: THREE.Material, p: N3, r: N3 = [0, 0, 0], s: N3 = [1, 1, 1], parent: THREE.Object3D = robot) => {
      const mesh = new THREE.Mesh(g, m);
      mesh.position.set(...p); mesh.rotation.set(...r); mesh.scale.set(...s);
      mesh.castShadow = mesh.receiveShadow = true;
      parent.add(mesh);
      const id = 'p' + parts.length;
      mesh.userData.id = id;
      mesh.userData.sec = section;
      parts.push(mesh);
      partById.set(id, mesh);
      createdStack.forEach((l) => l.push(mesh));
      return mesh;
    };
    const pair = (parent: THREE.Object3D, fn: (g: THREE.Group) => void) => {
      const lists: THREE.Mesh[][] = [];
      for (const s of [1, -1]) {
        const g = new THREE.Group(); g.scale.x = s; parent.add(g);
        const list: THREE.Mesh[] = [];
        createdStack.push(list);
        fn(g);
        createdStack.pop();
        lists.push(list);
      }
      lists[0].forEach((m, i) => {
        const o = lists[1][i];
        if (o && !m.userData.mirror) {
          m.userData.mirror = o; o.userData.mirror = m;
          m.userData.side = 'Kanan'; o.userData.side = 'Kiri';
        }
      });
    };
    const cyl = (rt: number, rb: number, h: number, seg = 32) => new THREE.CylinderGeometry(rt, rb, h, seg);
    const B = blob(0.5), B3 = blob(0.3), B7 = blob(0.75), S = blob(1);

    // ================= HEAD =================
    const head = new THREE.Group();
    head.position.set(0, 11.35, 0.55);
    head.scale.setScalar(0.72);
    robot.add(head);
    add(B7, gun, [0, 0.45, -0.15], [0, 0, 0], [0.85, 1.1, 0.95], head);
    add(B7, gunL, [0, 0.5, -0.15], [0, 0, 0], [0.2, 1.17, 1.02], head);
    pair(head, (g) => {
      add(B7, gun, [0.36, 0.46, -0.15], [0, 0, 0.06], [0.11, 1.08, 1.0], g);
      add(B7, blk, [0.22, 0.48, -0.15], [0, 0, 0.03], [0.07, 1.1, 1.0], g);
    });
    pair(head, (g) => {
      const s = new THREE.Shape();
      s.moveTo(0, -0.12); s.lineTo(0.78, 0.2); s.lineTo(0.8, 0.36); s.lineTo(0, 0.18); s.closePath();
      add(new THREE.ExtrudeGeometry(s, { depth: 0.38, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.04, bevelSegments: 3 }), gunL, [0, -0.05, 0.5], [0.12, 0.22, 0], [1, 1, 1], g);
    });
    add(B, gunL, [0, 0.0, 0.95], [0, 0, 0], [0.09, 0.18, 0.1], head);
    add(B, blkM, [0, -0.23, 0.62], [0, 0, 0], [0.82, 0.15, 0.3], head);
    pair(head, (g) => {
      const s = new THREE.Shape();
      s.moveTo(0.06, -0.02); s.lineTo(0.66, 0.11); s.quadraticCurveTo(0.74, 0.04, 0.66, -0.05); s.lineTo(0.1, -0.08); s.closePath();
      add(new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 }), eye, [0, -0.24, 0.85], [0, 0.2, -0.04], [1, 1, 1], g);
      const l = new THREE.PointLight(0x33ff55, 0.8, 1.2);
      l.position.set(0.4, -0.22, 1.2);
      g.add(l);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x33ff55, map: glowTex, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }));
      sp.position.set(0.4, -0.22, 1.0);
      sp.scale.set(1.1, 0.55, 1);
      g.add(sp);
      add(panel({ w: 0.62, h: 0.08, d: 0.08 }), gun, [0.38, -0.34, 0.9], [0, 0.22, 0.13], [1, 1, 1], g);
      add(panel({ w: 0.45, h: 0.5, d: 0.18, bottom: 0.5, bendX: 0.8, bulge: 0.06 }), gunL, [0.5, -0.6, 0.72], [0, 0.55, 0.15], [1, 1, 1], g);
    });
    add(panel({ w: 1.3, h: 1.15, d: 0.55, bottom: 0.6, bendX: 0.9, bulge: 0.1 }), blk, [0, -0.85, 0.45], [0, 0, 0], [1, 1, 1], head);
    add(panel({ w: 0.18, h: 0.6, d: 0.32, bottom: 2.8, bulge: 0.12 }), gunL, [0, -0.55, 0.92], [-0.18, 0, 0], [1, 1, 1], head);
    add(B, gunL, [0, -0.86, 1.02], [0.15, 0, 0], [0.32, 0.12, 0.16], head);
    pair(head, (g) => {
      add(B, blkM, [0.13, -0.9, 1.13], [0, 0, 0.3], [0.07, 0.035, 0.03], g);
      const s = new THREE.Shape();
      s.moveTo(0.05, 0.0); s.lineTo(0.62, 0.25); s.lineTo(0.7, -0.15); s.lineTo(0.45, -0.55); s.lineTo(0.05, -0.62); s.closePath();
      add(new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 3 }), gun, [0.02, -0.98, 0.7], [0.1, 0.42, 0], [1, 1, 1], g);
      for (let i = 0; i < 3; i++) add(B3, blkM, [0.22 + i * 0.13, -1.2 + i * 0.04, 1.0 - i * 0.08], [0, 0.42, -0.15], [0.02, 0.2, 0.03], g);
      add(panel({ w: 0.36, h: 0.12, d: 0.12, bulge: 0.02 }), gunL, [0.18, -1.04, 1.03], [0, 0.3, -0.3], [1, 1, 1], g);
      add(B, gun, [0.72, -0.55, 0.05], [0, 0.2, 0.08], [0.2, 0.6, 0.6], g);
      add(cyl(0.18, 0.18, 0.1, 24), chrome, [0.9, -0.5, 0.05], [0, 0, Math.PI / 2], [1, 1, 1], g);
    });
    add(B, blkM, [0, -1.13, 1.0], [0, 0, 0], [0.24, 0.045, 0.05], head);
    for (let i = -2; i <= 2; i++) add(B3, chrome, [i * 0.08, -1.13, 1.03], [0, 0, 0], [0.025, 0.035, 0.02], head);
    add(B3, gunL, [0, -1.42, 0.82], [0.15, 0, 0], [0.32, 0.17, 0.25], head);
    add(B, blkM, [0, -1.42, 1.07], [0, 0, 0], [0.012, 0.13, 0.02], head);
    add(cyl(0.45, 0.55, 1.0), blk, [0, 10.6, 0.1]);

    // ================= TORSO =================
    section = 'Dada';
    // inner black core (narrower at bottom -> V torso)
    add(lathe([[0, 10.9], [1.6, 10.8], [2.0, 10.1], [1.85, 8.9], [1.3, 7.7], [0.9, 7.3], [0, 7.25]], 48), blk, [0, 0, -0.1], [0, 0, 0], [1, 1, 0.68]);
    // green crystal: central cluster between plates + side rib clusters
    const crys = (p: N3, r: N3, s: N3, parent: THREE.Object3D = robot) => add(new THREE.OctahedronGeometry(0.5, 0), crystal, p, r, s, parent);
    for (let i = 0; i < 12; i++) {
      const y = 10.2 - i * 0.2;
      const w = 0.55 * (1 - i / 14);
      crys([((i % 3) - 1) * w * 0.6, y, 1.05], [0.2 * i, i * 0.9, 0.15 * (i % 2 ? 1 : -1)], [0.45, 0.9, 0.35]);
    }
    pair(robot, (g) => {
      for (let i = 0; i < 6; i++) {
        crys([0.85 + (i % 2) * 0.25, 8.9 - i * 0.22, 1.05 - (i % 2) * 0.1], [0.3, 0.4, 0.9 + i * 0.08], [0.32, 0.85, 0.28], g);
      }
      crys([1.25, 8.4, 0.85], [0.2, 0.5, 1.1], [0.35, 1.0, 0.3], g);
    });
    const coreLight = new THREE.PointLight(0x33ff55, 2, 3);
    coreLight.position.set(0, 9.0, 1.8);
    robot.add(coreLight);

    pair(robot, (g) => {
      // big curved V pec plate (blade-shaped, wraps around torso)
      const pec = front([
        [0.32, 10.55], [1.3, 10.75], [2.25, 10.55], [2.35, 9.9], [2.1, 9.1], [1.55, 8.55], [1.0, 8.0], [0.5, 7.75], [0.42, 8.5], [0.55, 9.3], [0.4, 10.0],
      ], 0.22, 0.1, 0.25);
      add(bend(pec, 2.4), gun, [0, 0, 1.12], [0, 0, 0], [1, 1, 1], g);
      // inner dark bevel edge along the V
      const edge = front([[0.3, 10.5], [0.42, 10.0], [0.5, 9.3], [0.38, 8.5], [0.45, 7.75], [0.32, 7.8], [0.22, 8.5], [0.36, 9.3], [0.2, 10.0]], 0.3, 0.04, 0.3);
      add(bend(edge, 2.4), blk, [0, 0, 1.12], [0, 0, 0], [1, 1, 1], g);
      // upper collar plate near neck
      add(bend(front([[0.4, 10.6], [1.9, 10.85], [2.0, 11.15], [0.55, 11.0]], 0.6, 0.08, 0.3), 2.0), gunL, [0, 0, 0.55], [0, 0, 0], [1, 1, 1], g);
      // side black rib frame
      add(side([[-0.6, 10.2], [0.75, 10.0], [0.65, 8.4], [0.1, 7.6], [-0.6, 7.9]], 0.5, 0.08, 0.25), blk, [1.95, 0, 0], [0, 0, -0.08], [1, 1, 1], g);
    });
    // lower black frame: arch with center spine + side feet (like reference)
    add(front([[-1.35, 8.05], [-0.45, 7.75], [-0.2, 7.95], [0.2, 7.95], [0.45, 7.75], [1.35, 8.05], [1.3, 7.45], [0.95, 7.0], [0.55, 7.0], [0.4, 7.35], [-0.4, 7.35], [-0.55, 7.0], [-0.95, 7.0], [-1.3, 7.45]], 0.5, 0.08, 0.15), blk, [0, 0, 0.95]);
    // central sternum clasp
    add(front([[-0.28, 8.6], [0.28, 8.6], [0.35, 7.7], [0.18, 7.3], [-0.18, 7.3], [-0.35, 7.7]], 0.4, 0.06, 0.2), blk, [0, 0, 1.25]);
    add(front([[-0.07, 8.4], [0.07, 8.4], [0.07, 7.6], [-0.07, 7.6]], 0.1, 0.02, 0.3), blkM, [0, 0, 1.5]);
    // side clamp teeth on frame
    pair(robot, (g) => {
      for (let i = 0; i < 2; i++) add(front([[0, 0.25], [0.22, 0.25], [0.22, -0.25], [0, -0.25]], 0.25, 0.04, 0.3), blk, [0.62 + i * 0.32, 7.2, 1.2], [0, 0, 0], [1, 1, 1], g);
    });
    add(B, gun, [0, 9.2, -0.9], [0, 0, 0], [1.9, 1.6, 0.7]);
    // waist
    add(lathe([[0, 7.6], [0.85, 7.55], [0.95, 7.3], [0.7, 7.0], [0.78, 6.7], [0, 6.6]]), blk, [0, 0, 0]);
    add(B, blk, [0, 6.45, 0.05], [0, 0, 0], [1.15, 0.42, 0.78]);
    add(panel({ w: 0.9, h: 0.9, d: 0.3, bottom: 0.6, bendX: 1.5, bulge: 0.08 }), gunL, [0, 6.2, 0.75], [0, 0, 0]);

    // ================= SHOULDERS + ARMS =================
    pair(robot, (g) => {
      section = 'Bahu';
      // ---- shoulder pauldron: sculpted arch, sloped top, folded front edge ----
      const sh = new THREE.Group();
      sh.position.set(2.85, 10.35, 0);
      g.add(sh);
      add(S, blk, [-0.15, -0.45, 0], [0, 0, 0], [0.8, 0.8, 0.8], sh);
      add(front([[-1.0, 0.2], [0.1, 0.62], [1.05, 0.35], [1.35, -0.25], [1.25, -1.15], [0.85, -1.2], [0.8, -0.3], [0.2, 0.05], [-1.0, -0.2]], 1.9, 0.14, 0.22), gun, [0.1, 0, 0], [0, 0, 0], [1, 1, 1], sh);
      // top ridge plate
      add(front([[-0.7, 0.1], [0.1, 0.4], [0.9, 0.2], [0.85, 0.0], [0.1, 0.2], [-0.7, -0.08]], 2.05, 0.06, 0.2), gunL, [0.1, 0.25, 0], [0, 0, 0], [1, 1, 1], sh);
      // inner black seam
      add(front([[1.0, -0.3], [1.1, -1.05], [0.95, -1.05], [0.88, -0.3]], 1.6, 0.03, 0.2), blkM, [0.06, 0, 0], [0, 0, 0], [1, 1, 1], sh);
      for (const z of [0.75, -0.75]) add(cyl(0.07, 0.07, 0.1, 12), chrome, [1.42, -0.5, z], [0, 0, Math.PI / 2], [1, 1, 1], sh);

      section = 'Lengan';
      // ---- ARM ----
      const arm = new THREE.Group();
      arm.position.set(3.4, 9.6, 0);
      arm.rotation.z = 0.05;
      arm.scale.y = 0.9;
      g.add(arm);
      // deltoid joint
      add(cyl(0.5, 0.5, 1.2, 32), blk, [-0.1, 0, 0], [0, 0, Math.PI / 2], [1, 1, 1], arm);
      // upper arm: muscular lathe (bicep bulge)
      add(lathe([[0, 0], [0.48, -0.05], [0.6, -0.6], [0.62, -1.1], [0.52, -1.8], [0.42, -2.3], [0, -2.4]]), blk, [0, 0, 0], [0, 0, 0], [1, 1, 1.05], arm);
      // upper-arm grey shell at top (silver shoulder-arm armor) — side profile
      add(side([[-0.55, -0.1], [0.45, -0.05], [0.68, -0.45], [0.6, -1.2], [0.25, -1.45], [-0.5, -1.35], [-0.62, -0.7]], 1.15, 0.1, 0.25), gun, [0.05, 0, 0], [0, 0, 0], [1, 1, 1], arm);
      // black bracket pieces on bicep (mechanical look)
      add(side([[0.2, -0.9], [0.75, -1.05], [0.72, -1.75], [0.3, -2.0]], 0.7, 0.06, 0.2), blk, [-0.1, 0, 0], [0, 0, 0], [1, 1, 1], arm);
      add(side([[-0.6, -1.2], [-0.15, -1.3], [-0.2, -2.1], [-0.6, -2.0]], 0.8, 0.06, 0.2), blk, [0, 0, 0], [0, 0, 0], [1, 1, 1], arm);
      // outer gear ridge
      for (let i = 0; i < 6; i++) add(B3, gunL, [0.68, -0.35 - i * 0.2, -0.05], [0, 0, 0], [0.1, 0.07, 0.4], arm);
      // elbow: black hinge bracket plates + axle
      add(S, blk, [0, -2.45, 0], [0, 0, 0], [0.48, 0.48, 0.5], arm);
      for (const sx of [0.42, -0.42]) add(side([[-0.45, -2.0], [0.35, -2.1], [0.5, -2.6], [0.2, -3.0], [-0.4, -2.9]], 0.16, 0.05, 0.25), blk, [sx, 0, 0], [0, 0, 0], [1, 1, 1], arm);
      add(cyl(0.2, 0.2, 1.05, 24), chrome, [0, -2.5, 0], [0, 0, Math.PI / 2], [1, 1, 1], arm);
      // forearm: grey armor — top thick & angled forward, tapering to wrist (side profile)
      add(side([[-0.5, -2.75], [0.35, -2.7], [0.62, -2.95], [0.6, -4.35], [0.35, -4.7], [-0.4, -4.7], [-0.55, -4.0]], 1.0, 0.12, 0.2), gun, [0, 0, 0], [0, 0, 0], [1, 1, 1], arm);
      // forward vent fin with holes (iconic) — sticks out the front
      add(side([[0.5, -2.85], [1.0, -3.0], [1.05, -4.05], [0.55, -4.25]], 0.18, 0.05, 0.2), gunL, [0.3, 0, 0], [0, 0, 0], [1, 1, 1], arm);
      for (let i = 0; i < 5; i++) add(cyl(0.055, 0.055, 0.32, 12), blkM, [0.3, -3.15 - i * 0.2, 0.82], [0, 0, Math.PI / 2], [1, 1, 1], arm);
      // inner black panel on forearm
      add(side([[-0.3, -3.0], [0.2, -3.0], [0.25, -4.3], [-0.25, -4.3]], 1.06, 0.03, 0.3), blk, [-0.02, 0, -0.05], [0, 0, 0], [1, 1, 1], arm);
      // chrome tapered wrist piston
      add(cyl(0.34, 0.26, 0.3, 24), chrome, [0, -4.8, 0.05], [0, 0, 0], [1, 1, 1], arm);
      // short wrist rings
      for (let i = 0; i < 2; i++) add(cyl(0.5, 0.5, 0.12, 32), i % 2 ? blk : gunL, [0, -5.0 - i * 0.13, 0.05], [0, 0, 0], [1, 1, 1], arm);

      section = 'Tinju';
      // ---- FIST (hammer: black top, grey striking block jutting forward) ----
      const fist = new THREE.Group();
      fist.position.set(0, -5.9, 0.1);
      arm.add(fist);
      add(side([[-0.6, 0.75], [0.3, 0.78], [0.5, 0.4], [0.85, 0.25], [0.9, -0.15], [-0.6, -0.15]], 1.25, 0.12, 0.22), blk, [0, 0, 0], [0, 0, 0], [1, 1, 1], fist);
      add(side([[-0.6, -0.1], [0.95, -0.1], [1.08, -0.45], [0.98, -1.0], [-0.45, -1.0], [-0.62, -0.6]], 1.32, 0.12, 0.2), gun, [0, 0, 0], [0, 0, 0], [1, 1, 1], fist);
      // knuckle notch + finger lines
      add(side([[0.45, 0.35], [0.8, 0.22], [0.82, 0.0], [0.45, 0.05]], 1.3, 0.03, 0.3), blkM, [0, 0, 0.02], [0, 0, 0], [1, 1, 1], fist);
      for (let i = 0; i < 3; i++) add(B, blkM, [-0.4 + i * 0.4, -0.55, 1.14], [0, 0, 0], [0.02, 0.32, 0.03], fist);
      // thumb
      add(side([[0.1, 0.55], [0.45, 0.5], [0.5, 0.15], [0.1, 0.2]], 0.3, 0.06, 0.3), blk, [-0.6, 0, 0.1], [0, 0, 0], [1, 1, 1], fist);

      // split forearm into its own elbow-pivot group for animation
      const fore = new THREE.Group();
      fore.position.set(0, -2.5, 0);
      arm.add(fore);
      scene.updateMatrixWorld(true);
      const bb = new THREE.Box3();
      [...arm.children].forEach((c) => {
        if (c === fore) return;
        bb.setFromObject(c);
        const cy = arm.worldToLocal(bb.getCenter(new THREE.Vector3())).y;
        if (cy < -2.6) fore.attach(c);
      });
      arms.push({ arm, fore, s: g.scale.x });
    });

    // ================= LEGS =================
    pair(robot, (g) => {
      const leg = new THREE.Group();
      leg.position.set(1.0, 6.1, 0);
      g.add(leg);
      legs.push({ leg, s: g.scale.x });
      section = 'Pinggul';
      add(S, blk, [0, 0, 0], [0, 0, 0], [0.62, 0.58, 0.62], leg);
      add(cyl(0.22, 0.22, 1.4, 24), gunL, [0, 0, 0], [0, 0, Math.PI / 2], [1, 1, 1], leg);

      section = 'Paha';
      // black thigh core: athletic V taper
      add(lathe([[0, 0], [0.55, -0.12], [0.62, -0.6], [0.55, -1.4], [0.4, -2.25], [0, -2.4]], 40), blk, [0, 0, 0], [0, 0, 0], [1, 1, 1.05], leg);
      // grey thigh armor shell — front blade, sharp outer flare
      add(bend(front([[-0.5, -0.15], [0.35, -0.1], [0.72, -0.35], [0.66, -1.35], [0.32, -2.05], [-0.15, -2.1], [-0.42, -1.4], [-0.58, -0.6]], 0.16, 0.08, 0.2), 0.7), gun, [0, 0, 0.55], [0, 0, 0], [1, 1, 1], leg);
      // outer thigh fin
      add(side([[-0.45, -0.25], [0.45, -0.3], [0.38, -1.5], [-0.3, -1.7]], 0.14, 0.05, 0.25), gunL, [0.72, 0, 0], [0, 0, 0.04], [1, 1, 1], leg);
      // signature clamp band (wraps, notched, bolts)
      add(front([[-0.66, -0.35], [0.66, -0.3], [0.86, -0.45], [0.84, -0.88], [0.62, -1.0], [-0.66, -0.97]], 1.38, 0.08, 0.2), gunL, [0, 0, 0.02], [0, 0, 0], [1, 1, 1], leg);
      add(front([[-0.5, -0.6], [0.6, -0.58], [0.6, -0.68], [-0.5, -0.7]], 1.42, 0.01, 0.4), blkM, [0, 0, 0.02], [0, 0, 0], [1, 1, 1], leg);
      for (const [xx, yy] of [[0.35, -0.47], [0.35, -0.82], [0.6, -0.47], [0.6, -0.82]]) add(new THREE.SphereGeometry(0.05, 10, 6), chrome, [xx, yy, 0.82], [0, 0, 0], [1, 1, 1], leg);
      // chrome hydraulic: cylinder + rod + end caps
      add(new THREE.SphereGeometry(0.15, 16, 8), chrome, [-0.42, -0.3, 0.62], [0, 0, 0], [1, 1, 1], leg);
      add(cyl(0.16, 0.16, 0.7, 20), chrome, [-0.42, -0.75, 0.66], [0.06, 0, 0], [1, 1, 1], leg);
      add(cyl(0.2, 0.2, 0.08, 20), blk, [-0.42, -1.1, 0.68], [0.06, 0, 0], [1, 1, 1], leg);
      add(cyl(0.085, 0.085, 1.3, 16), chrome, [-0.42, -1.75, 0.7], [0.06, 0, 0], [1, 1, 1], leg);
      add(cyl(0.18, 0.15, 0.3, 16), chrome, [-0.42, -2.45, 0.72], [0, 0, 0], [1, 1, 1], leg);

      section = 'Lutut';
      add(S, blk, [0, -2.7, 0.0], [0, 0, 0], [0.52, 0.48, 0.55], leg);
      add(cyl(0.22, 0.22, 1.3, 24), gunL, [0, -2.7, 0], [0, 0, Math.PI / 2], [1, 1, 1], leg);
      for (const sx of [0.66, -0.66]) add(cyl(0.14, 0.14, 0.06, 16), chrome, [sx, -2.7, 0], [0, 0, Math.PI / 2], [1, 1, 1], leg);
      // V-shaped knee guard
      add(bend(front([[-0.45, -2.35], [0.45, -2.35], [0.5, -2.7], [0.0, -3.15], [-0.5, -2.7]], 0.2, 0.08, 0.2), 0.6), gun, [0, 0, 0.55], [-0.08, 0, 0], [1, 1, 1], leg);
      add(front([[-0.06, -2.5], [0.06, -2.5], [0.03, -2.95], [-0.03, -2.95]], 0.1, 0.015, 0.3), blkM, [0, 0, 0.78], [-0.08, 0, 0], [1, 1, 1], leg);

      section = 'Betis';
      add(lathe([[0, -2.95], [0.42, -3.05], [0.48, -3.7], [0.36, -5.3], [0, -5.4]], 40), blk, [0, 0, 0], [0, 0, 0], [1, 1, 1], leg);
      // main shin shield: knee flare, waist, calf flare, taper
      const shinPts: P2[] = [[-0.5, -3.0], [0.0, -2.92], [0.5, -3.0], [0.66, -3.5], [0.55, -3.95], [0.66, -4.4], [0.48, -5.1], [0.25, -5.4], [-0.25, -5.4], [-0.48, -5.1], [-0.66, -4.4], [-0.55, -3.95], [-0.66, -3.5]];
      add(bend(front(shinPts, 0.2, 0.1, 0.2), 0.6), gun, [0, 0, 0.45], [0, 0, 0], [1, 1, 1], leg);
      // layered side armor wings
      add(bend(front([[0.42, -3.2], [0.78, -3.45], [0.8, -4.65], [0.45, -5.2]], 0.16, 0.06, 0.25), 0.58), gunL, [0, 0, 0.4], [0, 0, 0], [1, 1, 1], leg);
      add(bend(front([[-0.42, -3.2], [-0.78, -3.45], [-0.8, -4.65], [-0.45, -5.2]], 0.16, 0.06, 0.25), 0.58), gunL, [0, 0, 0.4], [0, 0, 0], [1, 1, 1], leg);
      // center ridge with slot + arrow tip
      add(bend(front([[-0.28, -3.25], [0.28, -3.25], [0.34, -3.7], [0.2, -4.85], [0, -5.15], [-0.2, -4.85], [-0.34, -3.7]], 0.1, 0.05, 0.25), 0.7), gunL, [0, 0, 0.73], [0, 0, 0], [1, 1, 1], leg);
      add(front([[-0.09, -3.45], [0.09, -3.45], [0.09, -4.35], [-0.09, -4.35]], 0.12, 0.025, 0.35), blkM, [0, 0, 0.88], [0, 0, 0], [1, 1, 1], leg);
      add(B, blkM, [0.3, -4.65, 0.74], [0, 0, 0.55], [0.17, 0.018, 0.03], leg);
      add(B, blkM, [-0.3, -4.65, 0.74], [0, 0, -0.55], [0.17, 0.018, 0.03], leg);
      // calf muscle armor (back) + rear piston
      add(side([[-0.3, -3.1], [-0.78, -3.5], [-0.72, -4.4], [-0.35, -5.0]], 0.8, 0.08, 0.3), gun, [0, 0, 0], [0, 0, 0], [1, 1, 1], leg);
      add(cyl(0.07, 0.07, 1.6, 12), chrome, [0, -4.2, -0.7], [-0.12, 0, 0], [1, 1, 1], leg);

      section = 'Kaki';
      add(S, blk, [0, -5.6, 0], [0, 0, 0], [0.38, 0.3, 0.38], leg);
      add(cyl(0.16, 0.16, 1.0, 16), chrome, [0, -5.6, 0], [0, 0, Math.PI / 2], [1, 1, 1], leg);
      // boot sole + segmented toe armor + heel spur
      add(side([[-0.55, -5.6], [0.25, -5.6], [1.15, -5.88], [1.3, -6.25], [-0.6, -6.25]], 1.0, 0.1, 0.25), blk, [0, 0, 0], [0, 0, 0], [1, 1, 1], leg);
      add(side([[0.25, -5.62], [0.75, -5.75], [0.78, -5.92], [0.25, -5.8]], 0.92, 0.04, 0.25), gunL, [0, 0.04, 0], [0, 0, 0], [1, 1, 1], leg);
      add(side([[0.8, -5.78], [1.15, -5.9], [1.2, -6.02], [0.82, -5.94]], 0.88, 0.04, 0.25), gunL, [0, 0.04, 0], [0, 0, 0], [1, 1, 1], leg);
      add(side([[-0.55, -5.75], [-0.85, -6.0], [-0.8, -6.25], [-0.5, -6.25]], 0.6, 0.05, 0.3), gun, [0, 0, 0], [0, 0, 0], [1, 1, 1], leg);
      add(side([[-0.6, -6.18], [1.3, -6.18], [1.28, -6.27], [-0.62, -6.27]], 1.04, 0.02, 0.3), gun, [0, 0, 0], [0, 0, 0], [1, 1, 1], leg);
    });

    // ================= STAGE =================
    {
      const c = document.createElement('canvas');
      c.width = c.height = 512;
      const x = c.getContext('2d')!;
      const grd = x.createRadialGradient(256, 170, 10, 256, 256, 380);
      grd.addColorStop(0, '#3f8a3c');
      grd.addColorStop(0.5, '#123216');
      grd.addColorStop(1, '#030704');
      x.fillStyle = grd;
      x.fillRect(0, 0, 512, 512);
      const bg = new THREE.CanvasTexture(c);
      bg.colorSpace = THREE.SRGBColorSpace;
      scene.background = bg;
    }
    scene.fog = new THREE.Fog(0x050a06, 45, 90);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.MeshStandardMaterial({ color: 0x0b120c, roughness: 0.6, metalness: 0.3 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const ped = new THREE.Mesh(cyl(3.2, 3.4, 0.3, 64), new THREE.MeshPhysicalMaterial({ color: 0x1a1c1e, metalness: 0.6, roughness: 0.3, clearcoat: 1 }));
    ped.position.y = 0.15;
    ped.receiveShadow = true;
    scene.add(ped);
    robot.position.y = 0.55;
    const baseY = 0.55;
    let lastT = 0;

    // ================= PART EDITOR =================
    const D2R = Math.PI / 180;
    parts.forEach((m) => {
      m.userData.base = { p: m.position.clone(), r: m.rotation.clone(), s: m.scale.clone() };
      if (m.userData.side === 'Kiri') return;
      const sec = m.userData.sec as string;
      secCount[sec] = (secCount[sec] || 0) + 1;
      m.userData.label = `${sec} #${secCount[sec]}`;
      if (m.userData.mirror) m.userData.mirror.userData.label = m.userData.label;
    });
    const adjMap = new Map<string, Adj>();
    // pivot = center of the part's geometry (mass center), offset adjustable
    const centerOf = (m: THREE.Mesh) => {
      if (!m.userData.center) {
        m.geometry.computeBoundingBox();
        m.userData.center = m.geometry.boundingBox!.getCenter(new THREE.Vector3());
      }
      return m.userData.center as THREE.Vector3;
    };
    const pivotOf = (m: THREE.Mesh, a: Adj) => {
      // pivot in parent space (after scale-about-center, before rotation)
      const b = m.userData.base;
      const c = centerOf(m);
      const q = new THREE.Quaternion().setFromEuler(b.r);
      const v = a.v || [0, 0, 0];
      return c.clone().multiply(b.s).applyQuaternion(q).add(b.p).add(new THREE.Vector3(v[0], v[1], v[2]));
    };
    const applyAdj = (m: THREE.Mesh, a: Adj) => {
      const b = m.userData.base;
      const c = centerOf(m);
      const qb = new THREE.Quaternion().setFromEuler(b.r);
      const sAdj = new THREE.Vector3(a.s[0] * a.u, a.s[1] * a.u, a.s[2] * a.u);
      // 1) scale about geometry center
      const pos0 = c.clone().sub(c.clone().multiply(sAdj)).multiply(b.s).applyQuaternion(qb).add(b.p);
      // 2) rotate about pivot (center + offset)
      const P = pivotOf(m, a);
      const qa = new THREE.Quaternion().setFromEuler(new THREE.Euler(a.r[0] * D2R, a.r[1] * D2R, a.r[2] * D2R));
      const pos = pos0.sub(P).applyQuaternion(qa).add(P);
      // 3) move
      pos.add(new THREE.Vector3(a.p[0], a.p[1], a.p[2]));
      m.position.copy(pos);
      m.quaternion.copy(qa.multiply(qb));
      m.scale.copy(b.s.clone().multiply(sAdj));
      applyBend(m, a.b);
    };
    // bend (lengkung) deformation: b[0] = horizontal curve, b[1] = vertical curve, range -1..1 (=±180° arc)
    const applyBend = (m: THREE.Mesh, b?: [number, number]) => {
      const bh = b?.[0] || 0, bv = b?.[1] || 0;
      if (!m.userData.orig) {
        if (!bh && !bv) return;
        centerOf(m);
        m.geometry = m.geometry.clone(); // geometries may be shared
        m.userData.orig = (m.geometry.attributes.position.array as Float32Array).slice();
        m.geometry.computeBoundingBox();
        m.userData.size = m.geometry.boundingBox!.getSize(new THREE.Vector3());
      }
      const o = m.userData.orig as Float32Array;
      const c = centerOf(m);
      const sz = m.userData.size as THREE.Vector3;
      const pos = m.geometry.attributes.position;
      const kh = (bh * Math.PI) / Math.max(sz.x, 0.001);
      const kv = (bv * Math.PI) / Math.max(sz.y, 0.001);
      for (let i = 0; i < pos.count; i++) {
        let x = o[i * 3], y = o[i * 3 + 1], z = o[i * 3 + 2];
        if (kh) { const R = 1 / kh, dz = z - c.z, a = (x - c.x) * kh; x = c.x + (R + dz) * Math.sin(a); z = c.z - R + (R + dz) * Math.cos(a); }
        if (kv) { const R = 1 / kv, dz = z - c.z, a = (y - c.y) * kv; y = c.y + (R + dz) * Math.sin(a); z = c.z - R + (R + dz) * Math.cos(a); }
        pos.setXYZ(i, x, y, z);
      }
      pos.needsUpdate = true;
      m.geometry.computeVertexNormals();
      m.geometry.computeBoundingBox();
      m.geometry.computeBoundingSphere();
    };
    // pivot marker
    const pivotMark = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 8), new THREE.MeshBasicMaterial({ color: 0xff3366, depthTest: false }));
    pivotMark.renderOrder = 999;
    pivotMark.visible = false;
    scene.add(pivotMark);
    // forward ref (links are defined later)
    let relinkLater: (m: THREE.Mesh) => void = () => {};
    const hidden = new Set<string>();
    // multi-selection
    let selList: THREE.Mesh[] = [];
    let selected: THREE.Mesh | null = null; // primary (last picked)
    const boxPool: THREE.BoxHelper[] = [];
    const getBox = (i: number) => {
      if (!boxPool[i]) { boxPool[i] = new THREE.BoxHelper(new THREE.Object3D(), 0x22ff44); scene.add(boxPool[i]); }
      return boxPool[i];
    };
    const updateBoxes = () => {
      let n = 0;
      const sel = new Set(selList);
      for (const m of selList) {
        const b = getBox(n++);
        b.setFromObject(m);
        (b.material as THREE.LineBasicMaterial).color.set(m === selected ? 0x22ff44 : 0x22ccff);
        b.visible = true;
        const o = m.userData.mirror as THREE.Mesh | undefined;
        if (o && !sel.has(o)) {
          const bm = getBox(n++);
          bm.setFromObject(o);
          (bm.material as THREE.LineBasicMaterial).color.set(0xffcc00);
          bm.visible = true;
        }
      }
      for (let i = n; i < boxPool.length; i++) boxPool[i].visible = false;
    };
    const updatePivotMark = () => {
      if (!selected) { pivotMark.visible = false; return; }
      const a = adjMap.get(selected.userData.id) || defAdj();
      const P = pivotOf(selected, a).add(new THREE.Vector3(a.p[0], a.p[1], a.p[2]));
      pivotMark.position.copy(selected.parent!.localToWorld(P));
      pivotMark.visible = true;
    };
    const save = () => {
      const o: Record<string, Adj> = {};
      adjMap.forEach((v, k) => (o[k] = v));
      localStorage.setItem(LS_KEY, JSON.stringify(o));
      localStorage.setItem(GROUP_KEY, JSON.stringify(groupsRef.current));
    };
    const info = (id: string): SelInfo | null => {
      const m = partById.get(id);
      if (!m) return null;
      return { id, label: m.userData.label, side: m.userData.side || 'Tengah', hasMirror: !!m.userData.mirror, adj: JSON.parse(JSON.stringify(adjMap.get(id) || defAdj())) };
    };
    const selectIds = (ids: string[]) => {
      selList = ids.map((i) => partById.get(i)).filter(Boolean) as THREE.Mesh[];
      selected = selList[selList.length - 1] || null;
      updateBoxes();
    };
    const select = (m: THREE.Mesh | null) => {
      selectIds(m ? [m.userData.id] : []);
    };
    const setAdj = (id: string, a: Adj, mirror: boolean) => {
      const m = partById.get(id);
      if (!m) return;
      adjMap.set(id, a);
      applyAdj(m, a);
      relinkLater(m);
      const o = m.userData.mirror as THREE.Mesh | undefined;
      if (mirror && o) { adjMap.set(o.userData.id, a); applyAdj(o, a); relinkLater(o); }
      save();
    };
    // inverse of applyAdj: find Adj that produces a given local pos/quat/scale (keeps pivot offset)
    const adjFromLocal = (m: THREE.Mesh, pos: THREE.Vector3, quat: THREE.Quaternion, scl: THREE.Vector3, prev: Adj): Adj => {
      const b = m.userData.base;
      const c = centerOf(m);
      const qb = new THREE.Quaternion().setFromEuler(b.r);
      const qa = quat.clone().multiply(qb.clone().invert());
      const u = prev.u || 1;
      const sAdj = new THREE.Vector3(scl.x / b.s.x, scl.y / b.s.y, scl.z / b.s.z);
      const pos0 = c.clone().sub(c.clone().multiply(sAdj)).multiply(b.s).applyQuaternion(qb).add(b.p);
      const P = pivotOf(m, prev);
      const rotated = pos0.sub(P).applyQuaternion(qa).add(P);
      const p = pos.clone().sub(rotated);
      const e = new THREE.Euler().setFromQuaternion(qa);
      const R2D = 180 / Math.PI;
      const r4 = (x: number) => Math.round(x * 10000) / 10000;
      return {
        p: [r4(p.x), r4(p.y), r4(p.z)],
        r: [r4(e.x * R2D), r4(e.y * R2D), r4(e.z * R2D)],
        s: [r4(sAdj.x / u), r4(sAdj.y / u), r4(sAdj.z / u)],
        u,
        v: prev.v || [0, 0, 0],
        b: prev.b || [0, 0],
      };
    };
    // rigid group edit: others follow the primary's motion as one welded unit
    const setAdjRigid = (primaryId: string, newAdj: Adj, otherIds: string[], mirror: boolean) => {
      const pm = partById.get(primaryId);
      if (!pm) return;
      const oldAdj = adjMap.get(primaryId) || defAdj();
      robot.updateMatrixWorld(true);
      const before = pm.matrixWorld.clone();
      const othersBefore = new Map<string, THREE.Matrix4>();
      otherIds.forEach((id) => { const m = partById.get(id); if (m) othersBefore.set(id, m.matrixWorld.clone()); });
      setAdj(primaryId, newAdj, mirror);
      robot.updateMatrixWorld(true);
      const T = pm.matrixWorld.clone().multiply(before.clone().invert());
      const ob = oldAdj.b || [0, 0], nb = newAdj.b || [0, 0];
      const done = new Set<string>([primaryId]);
      if (mirror && pm.userData.mirror) done.add(pm.userData.mirror.userData.id);
      for (const id of otherIds) {
        if (done.has(id)) continue;
        const m = partById.get(id);
        const wb = othersBefore.get(id);
        if (!m || !wb) continue;
        const W = T.clone().multiply(wb);
        const local = m.parent!.matrixWorld.clone().invert().multiply(W);
        const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
        local.decompose(pos, quat, scl);
        const prev = adjMap.get(id) || defAdj();
        const a = adjFromLocal(m, pos, quat, scl, prev);
        const pb = prev.b || [0, 0];
        a.b = [pb[0] + nb[0] - ob[0], pb[1] + nb[1] - ob[1]];
        setAdj(id, a, mirror);
        done.add(id);
        if (mirror && m.userData.mirror) done.add(m.userData.mirror.userData.id);
      }
      otherIds.forEach((id) => {
        const m = partById.get(id);
        if (m) {
          relinkLater(m);
          const o = m.userData.mirror as THREE.Mesh | undefined;
          if (mirror && o) relinkLater(o);
        }
      });
    };
    // ================= PERMANENT LINKS (group followers welded to leader) =================
    type Link = { f: THREE.Mesh; l: THREE.Mesh; off: THREE.Matrix4 };
    let links: Link[] = [];
    const withRest = (fn: () => void) => {
      const snap: [THREE.Object3D, THREE.Vector3, THREE.Euler][] = [];
      const setRest = (o: THREE.Object3D, pos: THREE.Vector3 | null, rot: THREE.Euler) => {
        snap.push([o, o.position.clone(), o.rotation.clone()]);
        if (pos) o.position.copy(pos);
        o.rotation.copy(rot);
      };
      setRest(robot, new THREE.Vector3(0, baseY, 0), new THREE.Euler());
      setRest(head, null, new THREE.Euler());
      arms.forEach((a) => { setRest(a.arm, null, new THREE.Euler(0, 0, 0.05)); setRest(a.fore, null, new THREE.Euler()); });
      legs.forEach((l) => setRest(l.leg, null, new THREE.Euler()));
      robot.updateMatrixWorld(true);
      fn();
      snap.forEach(([o, p, r]) => { o.position.copy(p); o.rotation.copy(r); });
      robot.updateMatrixWorld(true);
    };
    const linkedLocal = (lk: Link) => {
      const M = lk.f.parent!.matrixWorld.clone().invert().multiply(lk.l.matrixWorld).multiply(lk.off);
      const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
      M.decompose(pos, quat, scl);
      return { pos, quat, scl };
    };
    const computeOffset = (lk: Link) => {
      applyAdj(lk.f, adjMap.get(lk.f.userData.id) || defAdj());
      withRest(() => { lk.off = lk.l.matrixWorld.clone().invert().multiply(lk.f.matrixWorld); });
    };
    const bakeLinks = () => {
      if (!links.length) {
        save();
        return;
      }
      // convert current linked placement into followers' own adj values
      const results: [THREE.Mesh, Adj][] = [];
      withRest(() => {
        for (const lk of links) {
          const { pos, quat, scl } = linkedLocal(lk);
          const prev = adjMap.get(lk.f.userData.id) || defAdj();
          results.push([lk.f, adjFromLocal(lk.f, pos, quat, scl, prev)]);
        }
      });
      links = [];
      results.forEach(([m, a]) => {
        adjMap.set(m.userData.id, a);
        applyAdj(m, a);
        const om = m.userData.mirror as THREE.Mesh | undefined;
        if (om) {
          adjMap.set(om.userData.id, a);
          applyAdj(om, a);
        }
      });
      save();
    };
    const setLinks = (groups: Record<string, string[]>, follow: boolean) => {
      bakeLinks();
      links = [];
      if (!follow) return;
      const isFollower = new Set<string>();
      Object.values(groups).forEach((ids) => ids.slice(0, -1).forEach((i) => isFollower.add(i)));
      for (const ids of Object.values(groups)) {
        if (ids.length < 2) continue;
        const L = partById.get(ids[ids.length - 1]);
        if (!L) continue;
        for (const fid of ids.slice(0, -1)) {
          const F = partById.get(fid);
          if (!F || F === L) continue;
          links.push({ f: F, l: L, off: new THREE.Matrix4() });
          const fm = F.userData.mirror as THREE.Mesh | undefined;
          const lm = L.userData.mirror as THREE.Mesh | undefined;
          if (fm && lm && fm !== L && fm !== lm && !isFollower.has(fm.userData.id) && !ids.includes(fm.userData.id)) {
            links.push({ f: fm, l: lm, off: new THREE.Matrix4() });
          }
        }
      }
      links.forEach(computeOffset);
    };
    const applyLinks = () => {
      if (!links.length) return;
      robot.updateMatrixWorld(true);
      for (const lk of links) {
        const { pos, quat, scl } = linkedLocal(lk);
        lk.f.position.copy(pos); lk.f.quaternion.copy(quat); lk.f.scale.copy(scl);
      }
    };
    const relinkPart = (m: THREE.Mesh) => {
      for (const lk of links) if (lk.f === m) computeOffset(lk);
    };
    relinkLater = relinkPart;
    const r3 = (v: number) => Math.round(v * 1000) / 1000;
    const isDef = (a: Adj) => a.p.every((v) => v === 0) && a.r.every((v) => v === 0) && a.s.every((v) => v === 1) && a.u === 1 && (a.v || [0, 0, 0]).every((v) => v === 0) && (a.b || [0, 0]).every((v) => v === 0);
    const exportData = () => {
      const out: object[] = [];
      const done = new Set<string>();
      adjMap.forEach((a, id) => {
        if (done.has(id) || isDef(a)) return;
        const m = partById.get(id)!;
        const o = m.userData.mirror as THREE.Mesh | undefined;
        const oa = o && adjMap.get(o.userData.id);
        const mirrored = !!(o && oa && JSON.stringify(oa) === JSON.stringify(a));
        if (mirrored) done.add(o!.userData.id);
        done.add(id);
        out.push({
          id, part: m.userData.label, side: mirrored ? 'Kanan+Kiri' : m.userData.side || 'Tengah', mirror: mirrored,
          letak: a.p.map(r3), kemiringan_deg: a.r.map(r3), skala_xyz: a.s.map(r3), ukuran: r3(a.u), titik_poin: (a.v || [0, 0, 0]).map(r3), lengkung: (a.b || [0, 0]).map(r3),
        });
      });
      return { model: 'Zeus Real Steel', version: 1, total: out.length, parts: out };
    };
    const importData = (data: { parts?: { id: string; mirror?: boolean; letak: N3; kemiringan_deg: N3; skala_xyz: N3; ukuran: number }[] } | Record<string, Adj>) => {
      if (Array.isArray((data as { parts?: unknown }).parts)) {
        for (const e of (data as { parts: { id: string; mirror?: boolean; letak: N3; kemiringan_deg: N3; skala_xyz: N3; ukuran: number }[] }).parts) {
          setAdj(e.id, { p: e.letak, r: e.kemiringan_deg, s: e.skala_xyz, u: e.ukuran ?? 1, v: (e as { titik_poin?: N3 }).titik_poin || [0, 0, 0], b: (e as { lengkung?: [number, number] }).lengkung || [0, 0] }, !!e.mirror);
        }
      } else {
        Object.entries(data as Record<string, Adj>).forEach(([id, a]) => setAdj(id, a, false));
      }
      if (selected) select(selected);
    };
    const resetAll = () => {
      adjMap.forEach((_, id) => { const m = partById.get(id); if (m) applyAdj(m, defAdj()); });
      adjMap.clear();
      save();
      if (selected) select(selected);
    };
    // built-in preset first, then any further local edits on top
    importData(ZEUS_PRESET as never);
    try {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      importData(saved);
    } catch { /* ignore */ }
    // ---- theme color ----
    const makeBg = (hex: string) => {
      const col = new THREE.Color(hex);
      const c = document.createElement('canvas');
      c.width = c.height = 512;
      const x = c.getContext('2d')!;
      const grd = x.createRadialGradient(256, 170, 10, 256, 256, 380);
      grd.addColorStop(0, '#' + col.clone().multiplyScalar(0.5).getHexString());
      grd.addColorStop(0.5, '#' + col.clone().multiplyScalar(0.14).getHexString());
      grd.addColorStop(1, '#030303');
      x.fillStyle = grd;
      x.fillRect(0, 0, 512, 512);
      const bg = new THREE.CanvasTexture(c);
      bg.colorSpace = THREE.SRGBColorSpace;
      return bg;
    };
    const setTheme = (hex: string) => {
      const col = new THREE.Color(hex);
      eye.color.copy(col).lerp(new THREE.Color(0xffffff), 0.35);
      eye.emissive.copy(col);
      crystal.color.copy(col).multiplyScalar(0.6);
      crystal.emissive.copy(col).multiplyScalar(0.3);
      rim.color.copy(col).lerp(new THREE.Color(0xffffff), 0.25);
      scene.traverse((o) => {
        if ((o as THREE.PointLight).isPointLight) (o as THREE.PointLight).color.copy(col);
        if ((o as THREE.Sprite).isSprite) ((o as THREE.Sprite).material as THREE.SpriteMaterial).color.copy(col);
      });
      const old = scene.background as THREE.Texture | null;
      scene.background = makeBg(hex);
      old?.dispose?.();
      (scene.fog as THREE.Fog).color.copy(col).multiplyScalar(0.05);
      (floor.material as THREE.MeshStandardMaterial).color.copy(col).multiplyScalar(0.06);
    };
    setTheme(themeRef.current);

    apiRef.current = {
      setAdj: (id, a, mirror) => setAdj(id, a, mirror),
      setAdjRigid,
      setLinks,
      bakeLinks,
      mirrorOf: (id: string) => partById.get(id)?.userData.mirror?.userData.id ?? null,
      setHidden: (ids: string[], mirror: boolean) => {
        hidden.clear();
        ids.forEach((id) => {
          const m = partById.get(id);
          if (!m) return;
          hidden.add(id);
          if (mirror && m.userData.mirror) hidden.add(m.userData.mirror.userData.id);
        });
        parts.forEach((m) => (m.visible = !hidden.has(m.userData.id)));
        return [...hidden];
      },
      exportData,
      importData,
      resetAll,
      deselect: () => { selectIds([]); onPickRef.current(null, false); },
      selectIds,
      info,
      setTheme,
    };

    // click-to-select (ignores drags)
    const ray = new THREE.Raycaster();
    let down = { x: 0, y: 0 };
    const onDown = (e: PointerEvent) => (down = { x: e.clientX, y: e.clientY });
    const onUp = (e: PointerEvent) => {
      if (!editRef.current) return;
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = ray.intersectObjects(parts.filter((m) => m.visible), false)[0];
      onPickRef.current(hit ? (hit.object as THREE.Mesh).userData.id : null, e.shiftKey || e.ctrlKey || e.metaKey || multiRef.current);
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.3, 0.2, 3.5));
    composer.addPass(new OutputPass());

    let raf = 0;
    const clock = new THREE.Clock();
    const loop = () => {
      const t = clock.getElapsedTime();
      eye.emissiveIntensity = 8 + Math.sin(t * 3) * 1.5;
      const dt = Math.min(Math.max(t - lastT, 0.001), 0.05);
      lastT = t;
      let mode = modeRef.current;
      if (mode === 'auto') mode = Math.floor(t / 9) % 2 === 0 ? 'sombong' : 'tinju';

      // ---- body targets ----
      let ry = 0, rx = 0, py = 0, hx = 0, hy = 0, hz = 0;
      const armT: Record<number, { ax: number; az: number; el: number }> = {};
      const legT: Record<number, { lx: number; lz: number }> = {};
      let speed = 6;
      if (mode === 'diam') {
        armT[1] = { ax: 0, az: 0, el: 0 }; armT[-1] = { ax: 0, az: 0, el: 0 };
        legT[1] = { lx: 0, lz: 0 }; legT[-1] = { lx: 0, lz: 0 };
      } else if (mode === 'sombong') {
        // chest out, chin up, looking down at opponent, slow "come at me" beckon
        rx = -0.07; ry = Math.sin(t * 0.5) * 0.08; py = Math.sin(t * 1.5) * 0.05;
        hx = -0.28 + Math.sin(t * 0.8) * 0.03; hy = Math.sin(t * 0.35) * 0.35; hz = 0.08;
        armT[-1] = { ax: 0.08, az: 0.32, el: -0.25 };
        const beckon = Math.sin(t * 0.6) > 0.2;
        armT[1] = beckon
          ? { ax: -1.25, az: 0.15, el: -1.3 - (Math.sin(t * 7) * 0.5 + 0.5) * 0.7 }
          : { ax: 0.1, az: 0.3, el: -0.2 };
        legT[1] = { lx: 0, lz: 0.08 }; legT[-1] = { lx: 0, lz: 0.08 };
        speed = 4;
      } else {
        // boxing guard: turned stance, bob & weave, jab + cross
        ry = 0.32 + Math.sin(t * 2.2) * 0.06;
        py = -0.12 + Math.abs(Math.sin(t * 4)) * 0.1;
        rx = 0.05;
        hx = 0.12; hz = Math.sin(t * 2.2) * 0.05;
        armT[1] = { ax: -0.75, az: -0.18, el: -2.15 };
        armT[-1] = { ax: -1.05, az: -0.12, el: -1.75 };
        const p = t % 3;
        if (p < 0.3) { armT[-1] = { ax: -1.55, az: -0.05, el: -0.12 }; ry -= 0.12; speed = 18; }
        else if (p > 1.4 && p < 1.75) { armT[1] = { ax: -1.55, az: -0.3, el: -0.15 }; ry -= 0.55; rx = 0.1; speed = 18; }
        else speed = 9;
        hy = -ry * 0.85;
        legT[-1] = { lx: -0.2, lz: 0.05 }; legT[1] = { lx: 0.2, lz: 0.05 };
      }
      const k = 1 - Math.exp(-dt * speed);
      const L = (a: number, b: number) => a + (b - a) * k;
      robot.rotation.y = L(robot.rotation.y, ry);
      robot.rotation.x = L(robot.rotation.x, rx);
      robot.position.y = L(robot.position.y, baseY + py);
      head.rotation.x = L(head.rotation.x, hx);
      head.rotation.y = L(head.rotation.y, hy);
      head.rotation.z = L(head.rotation.z, hz);
      for (const a of arms) {
        const tg = armT[a.s];
        a.arm.rotation.x = L(a.arm.rotation.x, tg.ax);
        a.arm.rotation.z = L(a.arm.rotation.z, 0.05 + tg.az);
        a.fore.rotation.x = L(a.fore.rotation.x, tg.el);
      }
      for (const l of legs) {
        const tg = legT[l.s];
        l.leg.rotation.x = L(l.leg.rotation.x, tg.lx);
        l.leg.rotation.z = L(l.leg.rotation.z, tg.lz);
      }
      applyLinks();
      if (selList.length) updateBoxes();
      updatePivotMark();
      controls.update();
      composer.render();
      raf = requestAnimationFrame(loop);
    };
    loop();
    const onResize = () => {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
      composer.setSize(innerWidth, innerHeight);
    };
    addEventListener('resize', onResize);
    return () => {
      apiRef.current?.bakeLinks();
      cancelAnimationFrame(raf);
      removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.dispose();
      el.removeChild(renderer.domElement);
    };
  }, []);

  const delRef = useRef(deleteSelected);
  delRef.current = deleteSelected;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'Escape') {
        if (editRef.current) {
          toggleEdit();
        } else if (onBack) {
          apiRef.current?.bakeLinks();
          onBack();
        }
        return;
      }
      if (!editRef.current) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); delRef.current(); }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onBack]);
  useEffect(() => {
    apiRef.current?.setHidden(hiddenIds, false);
    localStorage.setItem(HIDDEN_KEY, JSON.stringify(hiddenIds));
  }, [hiddenIds]);
  // keep permanent links in sync with groups / follow toggle
  useEffect(() => {
    apiRef.current?.setLinks(groups, follow);
  }, [groups, follow]);

  return (
    <div className="w-screen h-screen relative overflow-hidden bg-[#040608] z-50">
      <div ref={ref} className={`absolute inset-0 ${edit ? 'cursor-crosshair' : ''}`} />

      {/* Back to Steel Titans Button */}
      {onBack && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-40">
          <button
            onClick={() => {
              apiRef.current?.bakeLinks();
              onBack();
            }}
            className="group flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-sky-950/95 via-slate-900/95 to-sky-950/95 border border-sky-400/80 text-sky-100 hover:text-white hover:border-sky-300 font-display text-sm tracking-wider shadow-[0_0_25px_rgba(56,189,248,0.45)] backdrop-blur-md transition-all active:scale-95 cursor-pointer"
            title="Kembali ke Ring Tinju Steel Titans"
          >
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-sky-500/20 border border-sky-400/50 group-hover:bg-sky-400 group-hover:text-black transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </span>
            <span className="font-black text-sm">KEMBALI KE STEEL TITANS</span>
          </button>
        </div>
      )}

      {/* editor toolbar */}
      <div className="absolute top-6 right-4 flex gap-2 z-40">
        <button
          onClick={toggleEdit}
          className={`px-4 py-2 rounded-xl font-bold text-sm border backdrop-blur ${edit ? 'bg-green-500 text-black border-green-300 shadow-[0_0_20px_#22ff44]' : 'bg-black/50 text-green-200 border-green-700 hover:bg-green-900/60'}`}
        >
          🛠️ {edit ? 'Edit Mode: ON' : 'Edit Part'}
        </button>
        {edit && (
          <>
            <button onClick={doExport} className="px-3 py-2 rounded-xl text-sm font-bold border border-green-700 bg-black/50 text-green-200 hover:bg-green-900/60">⬇️ Export</button>
            <button onClick={() => fileRef.current?.click()} className="px-3 py-2 rounded-xl text-sm font-bold border border-green-700 bg-black/50 text-green-200 hover:bg-green-900/60">⬆️ Import</button>
            <button onClick={() => { if (confirm('Reset semua perubahan?')) { apiRef.current?.resetAll(); flash('Semua part di-reset'); } }} className="px-3 py-2 rounded-xl text-sm font-bold border border-red-800 bg-black/50 text-red-300 hover:bg-red-900/50">♻️ Reset</button>
          </>
        )}
        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) doImport(f); e.target.value = ''; }} />
      </div>

      {/* theme picker */}
      <div className="absolute top-24 left-6 flex gap-2 items-center bg-black/50 backdrop-blur rounded-xl px-3 py-2 border border-white/10">
        <span className="text-[11px] text-white/60 mr-1">Tema</span>
        {THEMES.map(([name, hex]) => (
          <button
            key={hex}
            title={name}
            onClick={() => changeTheme(hex)}
            className={`w-6 h-6 rounded-full border-2 transition-transform ${theme === hex ? 'scale-125 border-white' : 'border-white/20 hover:scale-110'}`}
            style={{ background: hex, boxShadow: theme === hex ? `0 0 12px ${hex}` : undefined }}
          />
        ))}
      </div>

      {/* selection + group panel */}
      {edit && (
        <div className="absolute top-40 left-6 w-64 rounded-2xl border border-white/10 bg-black/70 backdrop-blur p-3 text-xs text-white/90 space-y-2">
          <div className="font-bold" style={{ color: accent }}>🧩 Seleksi & Grup</div>
          <div className="text-white/60">{selIds.length} part dipilih · Shift/Ctrl+klik = tambah</div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} />
            <span>Mode multi-select (tanpa Shift)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={groupLock} onChange={(e) => setGroupLock(e.target.checked)} />
            <span>Klik part = pilih seluruh grupnya</span>
          </label>
          <label className="flex items-start gap-2 cursor-pointer rounded-lg px-2 py-1.5 border" style={{ borderColor: follow ? accent : 'rgba(255,255,255,0.15)', background: follow ? 'rgba(255,255,255,0.06)' : undefined }}>
            <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} className="mt-0.5" />
            <span>
              <b>🔗 Ikutkan gerak (satu kesatuan)</b>
              <span className="block text-white/50">ON: anggota grup menempel permanen ke part utama (terakhir di grup) — ikut saat diedit DAN saat animasi. OFF: dilepas, posisi saat ini dipertahankan.</span>
            </span>
          </label>
          {selIds.length > 1 && (
            <div>
              <div className="text-white/60 mb-1">Part utama / penggerak grup:</div>
              <select
                value={selIds[selIds.length - 1]}
                onChange={(e) => makeLeader(e.target.value)}
                className="w-full bg-black/60 border border-white/20 rounded px-2 py-1"
              >
                {selIds.map((id) => (
                  <option key={id} value={id}>{apiRef.current?.info(id)?.label || id} ({apiRef.current?.info(id)?.side})</option>
                ))}
              </select>
            </div>
          )}
          <div className="flex gap-1">
            <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Nama grup" className="flex-1 bg-black/60 border border-white/20 rounded px-2 py-1" />
            <button onClick={createGroup} className="px-2 py-1 rounded font-bold text-black" style={{ background: accent }}>+ Grup</button>
          </div>
          {selIds.length > 0 && (
            <div className="flex gap-1">
              <button onClick={() => applySel([])} className="flex-1 py-1 rounded border border-white/20 hover:bg-white/10">Batal pilih</button>
              <button onClick={deleteSelected} className="flex-1 py-1 rounded border border-red-700 bg-red-950/50 text-red-200 hover:bg-red-900/60 font-bold">🗑️ Hapus ({selIds.length})</button>
            </div>
          )}
          {hiddenIds.length > 0 && (
            <div className="rounded-lg bg-white/5 p-2 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-white/60">🗑️ Terhapus: {hiddenIds.length}</span>
                <button onClick={() => { setHiddenIds([]); flash('Semua part dikembalikan'); }} className="text-[11px] underline" style={{ color: accent }}>Kembalikan semua</button>
              </div>
              <div className="max-h-24 overflow-y-auto space-y-0.5">
                {hiddenIds.map((id) => (
                  <div key={id} className="flex items-center justify-between text-[11px]">
                    <span className="text-white/70">{apiRef.current?.info(id)?.label || id} <span className="text-white/40">{apiRef.current?.info(id)?.side}</span></span>
                    <button onClick={() => setHiddenIds(hiddenIds.filter((x) => x !== id))} className="hover:underline" style={{ color: accent }}>↩ balikin</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="max-h-48 overflow-y-auto space-y-1">
            {Object.entries(groups).map(([name, ids]) => (
              <div key={name} className="flex items-center gap-1 bg-white/5 rounded px-2 py-1">
                <button onClick={() => applySel(ids)} className="flex-1 text-left hover:underline">📦 {name} <span className="text-white/40">({ids.length})</span></button>
                <button onClick={() => deleteGroup(name)} className="text-red-400 hover:text-red-300 px-1">×</button>
              </div>
            ))}
            {!Object.keys(groups).length && <div className="text-white/40">Belum ada grup</div>}
          </div>
        </div>
      )}

      {edit && !sel && (
        <div className="absolute top-20 right-4 w-72 rounded-2xl border border-green-800 bg-black/70 backdrop-blur p-4 text-sm text-green-100">
          <div className="font-bold text-green-300 mb-1">Klik part robot untuk diedit</div>
          <ul className="text-xs text-green-200/70 list-disc pl-4 space-y-1">
            <li>Drag = putar kamera, klik = pilih part</li>
            <li>Kotak hijau = part dipilih, kuning = pasangan mirror</li>
            <li>Perubahan tersimpan otomatis di browser</li>
            <li>Export hanya menyimpan part yang diubah</li>
          </ul>
        </div>
      )}
      {edit && sel && (
        <EditorPanel
          sel={sel}
          count={selIds.length}
          onDelete={deleteSelected}
          mirror={mirror}
          setMirror={setMirror}
          update={update}
          onReset={() => update(() => defAdj())}
          onClose={() => apiRef.current?.deselect()}
        />
      )}
      {toast && <div className="absolute top-20 left-1/2 -translate-x-1/2 rounded-xl bg-green-500 text-black font-bold px-4 py-2 shadow-lg">{toast}</div>}

      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3">
        {([['sombong', '😤 Pose Sombong'], ['tinju', '🥊 Siap Tinju'], ['auto', '🔁 Auto'], ['diam', '🧍 Diam']] as [Mode, string][]).map(([m, label]) => (
          <button
            key={m}
            onClick={() => pick(m)}
            className={`px-5 py-2.5 rounded-xl font-bold tracking-wide border transition-all backdrop-blur ${
              mode === m
                ? 'bg-green-500/90 text-black border-green-300 shadow-[0_0_20px_#22ff44]'
                : 'bg-black/50 text-green-200 border-green-700 hover:bg-green-900/60'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="absolute top-6 left-6 font-black tracking-widest pointer-events-none text-green-300">
        <h1 className="text-4xl" style={{ color: accent, textShadow: `0 0 10px ${theme}` }}>ZEUS</h1>
        <p className="text-xs text-green-100/70">REAL STEEL · Drag untuk memutar, scroll untuk zoom</p>
      </div>
    </div>
  );
}
