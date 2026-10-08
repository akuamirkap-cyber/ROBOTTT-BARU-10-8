import * as THREE from 'three';
import { markReflect } from './layers';

/**
 * THE SHOW — the broadcast-arena dressing around the ring: a wrap-around LED ribbon high on the hall wall, two
 * giant face screens (the fighters' live portraits, like the big boards of a title fight), eight light columns
 * in the two corner colours around the apron, chasing LED edges. All of it
 * is emissive (no extra lights): the bloom pass does the glow, so intensities stay modest and balanced.
 */
export interface Show {
  update(t: number, dt: number, hype: number): void;
  setFaces(left: { name: string; color: string; img: string | null }, right: { name: string; color: string; img: string | null }): void;
}

export function buildShow(scene: THREE.Scene, _entryAngles: number[]): Show {
  // ---------- the LED ribbon ----------
  const rc = document.createElement('canvas');
  rc.width = 2048;
  rc.height = 192;
  const rg = rc.getContext('2d')!;
  const drawRibbon = () => {
    const grd = rg.createLinearGradient(0, 0, 2048, 0);
    grd.addColorStop(0, '#071029');
    grd.addColorStop(0.5, '#2a0810');
    grd.addColorStop(1, '#071029');
    rg.fillStyle = grd;
    rg.fillRect(0, 0, 2048, 192);
    rg.fillStyle = 'rgba(255,255,255,0.06)';
    for (let x = 0; x < 2048; x += 14) rg.fillRect(x, 0, 6, 192);
    rg.textAlign = 'left';
    rg.textBaseline = 'middle';
    rg.font = '800 112px "Barlow Condensed", Impact, sans-serif';
    const txt = 'STEEL TITANS   ◆   WRC WORLD ROBOT CHAMPIONSHIP   ◆   ';
    rg.fillStyle = '#ffffff';
    rg.fillText(txt, 20, 96);
    rg.fillStyle = '#c9a24a';
    rg.fillText('◆', 20 + rg.measureText('STEEL TITANS   ').width, 96);
    rg.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 0; y < 192; y += 4) rg.fillRect(0, y, 2048, 1);
  };
  drawRibbon();
  const rTex = new THREE.CanvasTexture(rc);
  rTex.colorSpace = THREE.SRGBColorSpace;
  rTex.wrapS = THREE.RepeatWrapping;
  rTex.repeat.set(-5, 1);
  rTex.anisotropy = 8;
  const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(62.2, 62.2, 5.2, 96, 1, true), new THREE.MeshBasicMaterial({ map: rTex, side: THREE.BackSide, color: new THREE.Color(0.95, 0.95, 0.95) }));
  ribbon.position.y = 36.2;
  markReflect(ribbon, true);
  scene.add(ribbon);
  for (const y of [33.4, 39.0]) {
    const edge = new THREE.Mesh(new THREE.TorusGeometry(62.1, 0.12, 6, 128), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8fd8ff).multiplyScalar(0.68) }));
    edge.rotation.x = Math.PI / 2;
    edge.position.y = y;
    scene.add(edge);
  }

  // ---------- the face screens ----------
  const fc = document.createElement('canvas');
  fc.width = 1536;
  fc.height = 864;
  const fg = fc.getContext('2d')!;
  const fTex = new THREE.CanvasTexture(fc);
  fTex.colorSpace = THREE.SRGBColorSpace;
  fTex.anisotropy = 8;
  const faces = { left: { name: 'ATOM', color: '#4da3ff', img: null as HTMLImageElement | null }, right: { name: 'SCRAP-9', color: '#ff6a4d', img: null as HTMLImageElement | null } };
  const drawFaces = () => {
    const W = 1536;
    const H = 864;
    const half = W / 2;
    const paint = (x0: number, side: typeof faces.left, flip: boolean) => {
      const g = fg;
      const grd = g.createLinearGradient(x0, 0, x0 + half, H);
      grd.addColorStop(0, '#05070e');
      grd.addColorStop(1, side.color + '55');
      g.fillStyle = grd;
      g.fillRect(x0, 0, half, H);
      // the glow behind the head
      const rad = g.createRadialGradient(x0 + half / 2, H * 0.42, 20, x0 + half / 2, H * 0.42, 420);
      rad.addColorStop(0, side.color + 'aa');
      rad.addColorStop(1, side.color + '00');
      g.fillStyle = rad;
      g.fillRect(x0, 0, half, H);
      if (side.img) {
        // the 3×4 bust fills the panel from the top, mirrored on the right so both machines look to centre
        const ih = H * 0.86;
        const iw = (ih * side.img.width) / side.img.height;
        g.save();
        if (flip) {
          g.translate(x0 + half, 0);
          g.scale(-1, 1);
          g.drawImage(side.img, half / 2 - iw / 2, 0, iw, ih);
        } else g.drawImage(side.img, x0 + half / 2 - iw / 2, 0, iw, ih);
        g.restore();
      }
      // name bar
      g.fillStyle = 'rgba(0,0,0,0.72)';
      g.fillRect(x0, H - 150, half, 150);
      g.fillStyle = side.color;
      g.fillRect(x0, H - 150, half, 8);
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = '800 108px "Barlow Condensed", Impact, sans-serif';
      g.fillStyle = '#ffffff';
      g.fillText(side.name.toUpperCase(), x0 + half / 2, H - 72);
    };
    paint(0, faces.left, false);
    paint(half, faces.right, true);
    // the VS seam
    fg.fillStyle = '#ffffff';
    fg.fillRect(half - 5, 0, 10, H);
    fg.font = '900 150px "Barlow Condensed", Impact, sans-serif';
    fg.textAlign = 'center';
    fg.textBaseline = 'middle';
    fg.lineWidth = 14;
    fg.strokeStyle = '#05070e';
    fg.strokeText('VS', half, H * 0.42);
    fg.fillStyle = '#e8ecf2';
    fg.fillText('VS', half, H * 0.42);
    // scan lines
    fg.fillStyle = 'rgba(0,0,0,0.22)';
    for (let y = 0; y < H; y += 4) fg.fillRect(0, y, W, 1);
    fTex.needsUpdate = true;
  };
  drawFaces();
  const scrMat = new THREE.MeshBasicMaterial({ map: fTex, color: new THREE.Color(1.02, 1.02, 1.02) });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0b0d14, metalness: 0.8, roughness: 0.5 });
  const edgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x8fd8ff).multiplyScalar(1.15) });
  const SCR_R = 59.4;
  const SCR_Y = 22.4;
  const SCR_W = 40;
  const SCR_H = 22.5;
  for (let i = 0; i < 2; i++) {
    const a = 0.52 + Math.PI / 6 + i * Math.PI;
    const x = Math.cos(a) * SCR_R;
    const z = Math.sin(a) * SCR_R;
    const ry = Math.atan2(-x, -z);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(SCR_W, SCR_H), scrMat);
    scr.position.set(x, SCR_Y, z);
    scr.rotation.y = ry;
    markReflect(scr, true);
    scene.add(scr);
    const fr = new THREE.Mesh(new THREE.BoxGeometry(SCR_W + 1.4, SCR_H + 1.4, 0.8), frameMat);
    fr.position.set(x * 1.006, SCR_Y, z * 1.006);
    fr.rotation.y = ry;
    scene.add(fr);
    // the lit edge strips above and below the board, the truss legs down to the bowl
    for (const dy of [SCR_H / 2 + 0.9, -SCR_H / 2 - 0.9]) {
      const ed = new THREE.Mesh(new THREE.BoxGeometry(SCR_W + 1.6, 0.22, 0.3), edgeMat);
      ed.position.set(x * 0.998, SCR_Y + dy, z * 0.998);
      ed.rotation.y = ry;
      scene.add(ed);
    }
    const legGeo = new THREE.BoxGeometry(0.6, 12, 0.6);
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(legGeo, frameMat);
      const lx = x + Math.cos(ry) * sx * (SCR_W / 2 - 1.5);
      const lz = z - Math.sin(ry) * sx * (SCR_W / 2 - 1.5);
      leg.position.set(lx, SCR_Y - SCR_H / 2 - 6, lz);
      scene.add(leg);
    }
  }

  // Note: The red and blue pillars around the spectator arena bowl have been removed as requested.
  const columns: { core: THREE.MeshBasicMaterial; glow: THREE.MeshBasicMaterial; beam: THREE.MeshBasicMaterial; spot: THREE.MeshBasicMaterial; base: THREE.Color; ph: number }[] = [];

  // ---------- the LED rings in the hall floor (two chasing light lines round the apron) ----------
  const floorRings: { mat: THREE.MeshBasicMaterial; base: THREE.Color; ph: number }[] = [];
  for (const [r, w] of [
    [19.6, 0.16],
    [26.4, 0.22],
  ]) {
    for (let h = 0; h < 2; h++) {
      const blue = h === 0;
      const base = new THREE.Color(blue ? 0x4f86e8 : 0xe03a44);
      const mat = new THREE.MeshBasicMaterial({ color: base.clone().multiplyScalar(0.7) });
      // x + z > 0 is the blue half of the hall: the arc runs from −45° round through +135°
      const ring = new THREE.Mesh(new THREE.RingGeometry(r - w, r + w, 96, 1, -Math.PI / 4 + (blue ? 0 : Math.PI), Math.PI), mat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -1.37;
      markReflect(ring, true);
      scene.add(ring);
      floorRings.push({ mat, base, ph: h * 1.6 + r * 0.1 });
    }
  }

  let smooth = 0;
  const update = (t: number, dt: number, hype: number) => {
    smooth += (hype - smooth) * (1 - Math.exp(-3 * dt));
    rTex.offset.x = (rTex.offset.x + dt * 0.03) % 1;
    // the light columns breathe smoothly in two groups, blue then red, and surge with the crowd
    columns.forEach((c) => {
      const wave = 0.5 + 0.5 * Math.sin(t * 0.9 + c.ph);
      const pulse = 0.90 + wave * (0.15 + smooth * 0.25);
      c.core.color.copy(c.base).multiplyScalar(pulse);
      c.glow.opacity = 0.06 + wave * 0.03;
      c.beam.opacity = 0.02 + wave * 0.015;
      c.spot.opacity = 0.05 + wave * 0.03;
    });
    // the floor LED lines chase round the apron smoothly
    floorRings.forEach((r) => {
      const wave = 0.5 + 0.5 * Math.sin(t * 1.4 + r.ph);
      const pulse = 0.85 + wave * (0.16 + smooth * 0.22);
      r.mat.color.copy(r.base).multiplyScalar(pulse * 0.82);
    });
    edgeMat.color.setHex(0x8fd8ff).multiplyScalar(0.65 + Math.sin(t * 1.0) * 0.05);
  };

  const setFaces: Show['setFaces'] = (left, right) => {
    faces.left.name = left.name;
    faces.left.color = left.color;
    faces.right.name = right.name;
    faces.right.color = right.color;
    const load = (side: typeof faces.left, url: string | null) => {
      if (!url) {
        side.img = null;
        drawFaces();
        return;
      }
      const im = new Image();
      im.onload = () => {
        side.img = im;
        drawFaces();
      };
      im.src = url;
    };
    load(faces.left, left.img);
    load(faces.right, right.img);
    drawFaces();
  };

  return { update, setFaces };
}
