import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import {
  ATLAS_IDX,
  CAM_MODES,
  FOOTWORK_STEPS,
  GFX_MODES,
  OPPONENTS,
  ULTRA_COLOR,
  loadArmorSkin,
  loadGloveSkin,
  loadHelmetSkin,
  smartDef,
  ultraDef,
  type BloomMode,
  type Game,
  type GfxMode,
  type HudState,
  type PyroPlacement,
  type TransId,
} from '../game/Game';
import { SFX_PROFILES, type SfxProfile } from '../game/audio';
import {
  BloomPicker,
  BrightnessPicker,
  DirectionalHeadSnapPicker,
  IqPicker,
  OverdrivePunchPicker,
  PyroPicker,
  ResetVisualsButton,
  RobotTexturePicker,
  SaturationPicker,
  SlowMoModePicker,
  TransitionPicker,
} from './Pickers';
import { ACCOUNT_NAME, MODES, levelOf, wrcPoints, type ModeId, type Profile } from '../game/progress';
import { Leaderboard } from './Modes';

export interface MenuProps {
  unlocked: number;
  sel: number;
  onSel: (i: number) => void;
  onStart: () => void;
  sfx: SfxProfile;
  onSfx: (id: SfxProfile) => void;
  ultra: boolean;
  onUltra: (ultra: boolean) => void;
  fw: number;
  onFw: (m: number) => void;
  cam: number;
  onCam: (i: number) => void;
  iq: number;
  onIq: (n: number) => void;
  muted?: boolean;
  onToggleMute?: () => void;
  game?: Game | null;
  hud?: HudState | null;
  profile: Profile;
  portrait: string | null;
  mode: ModeId;
  onMode: (m: ModeId) => void;
  onStartMode: (m: ModeId) => void;
  trans: TransId;
  onTrans: (id: TransId) => void;
  onTransTry: () => void;
  bright: number;
  onBright: (b: number) => void;
  sat: number;
  onSat: (s: number) => void;
  tex: boolean;
  onTex: (t: boolean) => void;
  bloom: BloomMode | number;
  onBloom: (b: BloomMode | number) => void;
  onResetVisuals: () => void;
  gfx: GfxMode;
  onGfx: (g: GfxMode) => void;
  pyro: PyroPlacement;
  onPyro: (p: PyroPlacement) => void;
  directionalHeadSnap?: boolean;
  onDirectionalHeadSnap?: (on: boolean) => void;
  noSlowMoNormal?: boolean;
  onNoSlowMoNormal?: (on: boolean) => void;
  allOverdrivePunch?: boolean;
  onAllOverdrivePunch?: (on: boolean) => void;
  onShowZeus?: () => void;
  onShowRealSteelSim?: () => void;
}

const act = (fn: () => void) => (e: MouseEvent<HTMLElement>) => {
  e.currentTarget.blur();
  fn();
};

type PanelId = 'main' | 'moves' | 'garage' | 'settings' | 'board';

/** condensed move list — the essentials only, big keycaps */
const MOVES: { keys: string[]; text: string }[] = [
  { keys: ['W', 'A', 'S', 'D'], text: 'Jalan & mengitari lawan' },
  { keys: ['H'], text: 'JAB cepat' },
  { keys: ['J'], text: 'HOOK samping' },
  { keys: ['K'], text: 'UPPERCUT ke udara' },
  { keys: ['X'], text: 'STRAIGHT kuat' },
  { keys: ['SHIFT'], text: 'PANJER OTOMATIS + SPAM: sekali tekan SHIFT, SEMUA pukulan otomatis mentok maks (×2 damage & ×2 hajar) dan keluar SEKETIKA saat tombol ditekan. TAHAN tombolnya = pukulannya keluar TERUS (spam sepuasnya) — dan pukulan meleset nggak ngunci lagi. Kepalanmu menyala terus selama mode ini hidup. Tekan SHIFT lagi = mati. (SPRINT sekarang di F)' },
  { keys: ['💪'], text: 'PANJER MANUAL (mode otomatis mati): TAHAN tombol pukulan (H/J/K/X) lalu LEPAS — makin lama ditahan makin kuat. Sekelibat / tap cepat (≤0,4 detik) = pukulan normal; dari 0,4 sampai 1 detik naik terus (×1 ke ×2); 1 detik ke atas mentok ×2. Pukulannya keluar saat tombol DILEPAS, dan ancang-ancangnya kelihatan (tangan ditarik + kepalan menyala + bar di HUD)' },
  { keys: ['P'], text: 'GRAB banting (tembus blok)' },
  { keys: ['L'], text: 'COUNTER tangkis & balas' },
  { keys: ['SPACE'], text: 'DODGE menghindar (muat tenaga — hindaran telat bakal kena hajar)' },
  { keys: ['G'], text: 'BLOK tahan untuk bertahan' },
  { keys: ['E'], text: 'PEEK-A-BOO (tahan), + serang = Dempsey' },
  { keys: ['U'], text: 'RAGE mode agresif' },
  { keys: ['R'], text: 'OVERDRIVE jurus pamungkas' },
  { keys: ['Q', '/', 'T'], text: 'Sasaran: kepala / dada / remix' },
  { keys: ['A', '/', 'D'], text: 'Tap = ganti tangan kiri/kanan' },
  { keys: ['Z'], text: 'Pose sombong (isi meter)' },
  { keys: ['!'], text: 'PUKULAN MELESET = badannya keburu jalan: capek & tidak bisa buru-buru mukul lagi (di PANJER OTOMATIS aturan ini dilepas biar bisa spam)' },
  { keys: ['!'], text: 'HINDARAN PAS (saat musuh ancang-ancang) = balik tenaga + meter, lalu balas keras' },
  { keys: ['!'], text: 'TENAGA < 25% = GASSED: tangan 8% lebih lambat, tenaga pulih separuh' },
  { keys: ['Y'], text: 'ALI STYLE: gaya bertarung Muhammad Ali — tangan turun ke dada, badan meliuk (float), dan ALI SHUFFLE: kaki berdansa di tempat. Bisa ditekan DI LOBBY (robotnya langsung joget) maupun saat bertarung. Tekan Y lagi = guard tinggi' },
  { keys: ['N'], text: 'KOMBO OTOMATIS: JAB-JAB-HOOK-HOOK-UPPERCUT lalu PUKULAN MEMATIKAN — putus sendiri kalau ada yang keblokir/dihindari, dan si mematikan bayar setengah meter' },
  { keys: ['!'], text: 'POSE (GAYA / M B O Z 1-6): "angkat sabuk" dan pose Y sekarang lewat tombol GAYA — N & Y dipakai untuk kombo dan ALI STYLE' },
  { keys: ['⭐'], text: 'STAR MODE — mode santai: kaki jalan sendiri ke jarak pukul, guard naik sendiri saat diam, dan kamera nempel di pundakmu' },
  { keys: ['⭐'], text: 'STAR MODE pakai tombol yang sama: SPACE tetap menghindar (arahnya dipilih otomatis), tap tertunda tetap kebaca, Overdrive lepas sendiri saat meter penuh' },
  { keys: ['ESC'], text: 'Jeda pertandingan' },
];

function KeyCap({ children }: { children: ReactNode }) {
  return <span className="hc-key">{children}</span>;
}

/** big tap-to-cycle setting row */
function BigRow({
  label,
  value,
  onClick,
  on = false,
}: {
  label: string;
  value: string;
  onClick: () => void;
  on?: boolean;
}) {
  return (
    <button className={`hc-row ${on ? 'hc-row-on' : ''}`} onClick={act(onClick)}>
      <span>{label}</span>
      <span className="hc-row-v">{value}</span>
    </button>
  );
}

export function Menu({
  unlocked,
  sel,
  onSel,
  onStart,
  sfx,
  onSfx,
  ultra,
  onUltra,
  fw,
  onFw,
  cam,
  onCam,
  iq,
  onIq,
  muted = false,
  onToggleMute,
  game,
  hud,
  profile,
  mode,
  onMode,
  onStartMode,
  trans,
  onTrans,
  onTransTry,
  bright,
  onBright,
  sat,
  onSat,
  tex,
  onTex,
  bloom,
  onBloom,
  onResetVisuals,
  gfx,
  onGfx,
  pyro,
  onPyro,
  directionalHeadSnap = true,
  onDirectionalHeadSnap,
  noSlowMoNormal = false,
  onNoSlowMoNormal,
  allOverdrivePunch = false,
  onAllOverdrivePunch,
  onShowZeus,
  onShowRealSteelSim,
}: MenuProps) {
  const [panel, setPanel] = useState<PanelId>('main');
  const [helmetId, setHelmetId] = useState<number>(loadHelmetSkin);
  const [gloveId, setGloveId] = useState<number>(loadGloveSkin);
  const [armorId, setArmorId] = useState<number>(loadArmorSkin);
  const dragRef = useRef({ dragging: false, startX: 0 });

  // LAWAN ATLAS locks the opponent slot: the dock shows ATLAS PRIME (and the arrows stop hunting the roster)
  const atlasMode = mode === 'atlas';
  const foeDef = OPPONENTS[atlasMode ? ATLAS_IDX : sel] ?? OPPONENTS[0];
  const def = smartDef(ultra ? ultraDef(foeDef) : foeDef, iq);
  const col = ultra ? ULTRA_COLOR : def.color;

  // sync skins from the live game when they change in-fight
  useEffect(() => {
    if (hud?.helmetSkin !== undefined) setHelmetId(hud.helmetSkin);
    if (hud?.gloveSkin !== undefined) setGloveId(hud.gloveSkin);
    if (hud?.armorSkin !== undefined) setArmorId(hud.armorSkin);
  }, [hud?.helmetSkin, hud?.gloveSkin, hud?.armorSkin]);

  /** skin sekarang cuma 2 set: 0 = ATLAS (bawaan), 1 = ZEUS (model asli 100%) — semua part sekaligus */
  const skinSet = helmetId >= 1 || gloveId >= 1 || armorId >= 1 ? 1 : 0;

  const setSkinSet = (v: 0 | 1) => {
    setHelmetId(v);
    setGloveId(v);
    setArmorId(v);
    game?.equipZeus(v === 1);
  };

  const startSelected = () => {
    if (mode === 'leaderboard') {
      setPanel('board');
      return;
    }
    if (mode === 'play') onStart();
    else onStartMode(mode);
  };

  // keyboard: ENTER mulai · ESC kembali · 1-4 / panah pilih lawan
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'BUTTON' || t.tagName === 'INPUT')) return;
      if (e.code === 'Escape') {
        setPanel('main');
        return;
      }
      if (e.code === 'Enter') {
        if (panel === 'main') startSelected();
        return;
      }
      if (panel !== 'main') return;
      if (atlasMode) return; // the roster keys are dead in LAWAN ATLAS: the duel is locked onto ATLAS PRIME
      const n = Number(e.key);
      if (n >= 1 && n <= OPPONENTS.length && n - 1 <= unlocked) {
        if (n - 1 !== sel) onSel(n - 1);
        return;
      }
      if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
        const next = Math.max(0, Math.min(unlocked, sel + (e.code === 'ArrowRight' ? 1 : -1)));
        if (next !== sel) onSel(next);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel, sel, unlocked, onSel, mode, onStart, onStartMode, atlasMode]);

  // drag to rotate the 3D hero
  const onPointerDown = (e: React.PointerEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('a')) return;
    dragRef.current = { dragging: true, startX: e.clientX };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const nx = (e.clientX / window.innerWidth - 0.5) * 2;
    const ny = (e.clientY / window.innerHeight - 0.5) * 2;
    game?.setHeroMouse(nx, ny);
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    game?.rotateHero(dx * 0.008);
    dragRef.current.startX = e.clientX;
  };
  const onPointerUp = () => {
    dragRef.current.dragging = false;
  };

  // ---- skin set display (ATLAS / ZEUS)
  const skinMeta =
    skinSet === 1
      ? { name: 'ZEUS', sub: 'Model 3D Asli Zeus 100% · Helm + Armor + Sarung Tinju', color: '#22ff44' }
      : { name: 'ATLAS', sub: 'Robot Bawaan ATLAS · Helm + Armor + Sarung Tinju', color: '#45d6ff' };

  const gfxIdx = Math.max(0, GFX_MODES.findIndex((m) => m.id === gfx));
  const fwIdx = Math.max(0, (FOOTWORK_STEPS as readonly number[]).indexOf(fw));

  return (
    <div
      className="hc-root absolute inset-0 select-none overflow-hidden text-white"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div className="hc-scrim" />

      {/* ---------- TOP: judul + suara ---------- */}
      <header className="hc-top">
        <div>
          <div className="hc-brand font-display">
            STEEL <span style={{ color: ultra ? ULTRA_COLOR : '#5ee0ff' }}>TITANS</span> II
          </div>
          <div className="hc-brand-s">
            {ACCOUNT_NAME} · LV {levelOf(profile.xp).level} · WRC {wrcPoints(profile).toLocaleString('id-ID')}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onToggleMute && (
            <button
              className={`hc-pill ${muted ? 'hc-pill-off' : ''}`}
              onClick={act(onToggleMute)}
              title={muted ? 'Nyalakan suara' : 'Matikan suara'}
            >
              <span className="hc-pill-s">{muted ? 'SUARA MATI' : 'SUARA'}</span>
            </button>
          )}
        </div>
      </header>

      {/* ---------- MAIN STAGE ---------- */}
      <div className="hc-stage">
        {panel === 'main' && (
          <>
            {/* dock bawah — merata kiri · tengah · kanan, tidak menumpuk di tengah */}
            <div className="hc-dock">
              {/* KIRI: pilih lawan */}
              <div className="hc-opp">
                <button
                  className="hc-arrow"
                  onClick={act(() => onSel(Math.max(0, sel - 1)))}
                  disabled={atlasMode || sel <= 0}
                  title="Lawan sebelumnya"
                >
                  ◀
                </button>
                <div className="hc-opp-body">
                  <div className="hc-opp-k">{atlasMode ? 'LAWAN TERKUNCI · MODE' : 'PILIH LAWAN'}</div>
                  <div className="hc-opp-name font-display" style={{ color: col, textShadow: `0 0 26px ${col}66` }}>
                    {def.name}
                  </div>
                  <div className="hc-opp-sub">
                    {def.title} · {atlasMode ? 'SKIN BEBAS · ZEUS ATAU ATLAS' : `LAWAN ${sel + 1} DARI ${OPPONENTS.length}`}
                  </div>
                </div>
                <button
                  className="hc-arrow"
                  onClick={act(() => onSel(Math.min(unlocked, sel + 1)))}
                  disabled={atlasMode || sel >= unlocked}
                  title="Lawan berikutnya"
                >
                  ▶
                </button>
              </div>

              {/* TENGAH: tombol raksasa */}
              <button
                className={`hc-cta ${ultra ? 'hc-cta-ultra' : ''}`}
                onClick={act(startSelected)}
                title="Mulai pertandingan (ENTER)"
              >
                <span className="hc-cta-t">{mode === 'leaderboard' ? 'LIHAT PERINGKAT' : 'MASUK RING'}</span>
                <span className="hc-cta-k">TEKAN ENTER</span>
              </button>

              {/* KANAN: menu */}
              <div className="hc-side">
                <button className="hc-btn" onClick={act(() => setPanel('garage'))}>
                  <span className="hc-btn-s">GARASI</span>
                </button>
                <button className="hc-btn" onClick={act(() => setPanel('settings'))}>
                  <span className="hc-btn-s">SETTING</span>
                </button>
              </div>
            </div>

            {/* pilih mode — satu baris penuh, terbagi rata kiri-kanan */}
            <div className="hc-chips">
              {MODES.filter((m) => m.id !== 'leaderboard').map((m) => (
                <button
                  key={m.id}
                  className={`hc-chip ${mode === m.id ? 'hc-chip-on' : ''}`}
                  style={mode === m.id ? { background: m.color, borderColor: '#fff' } : undefined}
                  onClick={act(() => {
                    onMode(m.id);
                    // keep the hangar in step with the dock: LAWAN ATLAS stages the champion, every other mode the
                    // rival the dock is showing (so switching back out of the duel restores the pick)
                    game?.selectOpponent(m.id === 'atlas' ? ATLAS_IDX : Math.min(unlocked, sel));
                  })}
                  title={m.desc}
                >
                  <span className="hc-chip-led" style={{ background: m.color, color: m.color }} />
                  <span className="hc-chip-s">{m.name}</span>
                </button>
              ))}
              <button
                className={`hc-chip ${mode === 'leaderboard' ? 'hc-chip-on' : ''}`}
                style={mode === 'leaderboard' ? { background: '#ff5a36', borderColor: '#fff' } : undefined}
                onClick={act(() => {
                  onMode('leaderboard');
                  setPanel('board');
                })}
              >
                <span className="hc-chip-led" style={{ background: '#ff5a36', color: '#ff5a36' }} />
                <span className="hc-chip-s">PERINGKAT</span>
              </button>
            </div>
          </>
        )}

        {/* ---------- PANEL: JURUS ---------- */}
        {panel === 'moves' && (
          <div className="hc-panel">
            <h2 className="hc-title font-display">DAFTAR JURUS</h2>
            <div className="hc-moves">
              {MOVES.map((m) => (
                <div key={m.text} className="hc-move">
                  <span className="flex shrink-0 items-center gap-1.5">
                    {m.keys.map((k, i) =>
                      k === '+' || k === '/' ? (
                        <span key={i} className="hc-move-op">
                          {k}
                        </span>
                      ) : (
                        <KeyCap key={i}>{k}</KeyCap>
                      ),
                    )}
                  </span>
                  <span className="hc-move-t">{m.text}</span>
                </div>
              ))}
            </div>
            <button className="hc-back" onClick={act(() => setPanel('settings'))}>
              ◀ KEMBALI
            </button>
          </div>
        )}

        {/* ---------- PANEL: GARASI ---------- */}
        {panel === 'garage' && (
          <div className="hc-panel">
            <h2 className="hc-title font-display">PILIH SKIN</h2>

            <div className="min-w-0 text-center">
              <div className="hc-skin-name font-display" style={{ color: skinMeta.color }}>
                {skinMeta.name}
              </div>
              <div className="hc-skin-sub">{skinMeta.sub}</div>
            </div>

            <div className="hc-chips">
              <button
                className={`hc-chip hc-chip-big ${skinSet === 0 ? 'hc-chip-on' : ''}`}
                style={skinSet === 0 ? { background: '#45d6ff', borderColor: '#fff' } : undefined}
                onClick={act(() => setSkinSet(0))}
              >
                <span className="hc-chip-led" style={{ background: '#45d6ff', color: '#45d6ff' }} />
                <span className="hc-chip-s">ATLAS</span>
              </button>
              <button
                className={`hc-chip hc-chip-big ${skinSet === 1 ? 'hc-chip-on' : ''}`}
                style={skinSet === 1 ? { background: '#22ff44', borderColor: '#fff' } : undefined}
                onClick={act(() => setSkinSet(1))}
              >
                <span className="hc-chip-led" style={{ background: '#22ff44', color: '#22ff44' }} />
                <span className="hc-chip-s">ZEUS</span>
              </button>
            </div>

            <button className="hc-back" onClick={act(() => setPanel('main'))}>
              ◀ KEMBALI
            </button>
          </div>
        )}

        {/* ---------- PANEL: PERINGKAT ---------- */}
        {panel === 'board' && (
          <div className="hc-panel">
            <h2 className="hc-title font-display">PERINGKAT MINGGUAN</h2>
            <div className="hc-adv">
              <Leaderboard profile={profile} />
            </div>
            <button className="hc-back" onClick={act(() => setPanel('main'))}>
              ◀ KEMBALI
            </button>
          </div>
        )}

        {/* ---------- PANEL: SETTING ---------- */}
        {panel === 'settings' && (
          <div className="hc-panel">
            <h2 className="hc-title font-display">SETTING</h2>

            {/* pintasan yang dulu ada di menu utama — sekarang rapi di sini */}
            <div className="hc-sub">
              <button className="hc-btn" onClick={act(() => setPanel('moves'))}>
                <span className="hc-btn-s">JURUS</span>
              </button>
              {onShowRealSteelSim && (
                <button className="hc-btn hc-btn-cyan" onClick={act(onShowRealSteelSim)}>
                  <span className="hc-btn-s">REAL STEEL</span>
                </button>
              )}
              {onShowZeus && (
                <button className="hc-btn hc-btn-green" onClick={act(onShowZeus)}>
                  <span className="hc-btn-s">DESAIN ROBOT</span>
                </button>
              )}
            </div>

            <div className="hc-rows">
              <BigRow
                label="SUARA"
                value={muted ? 'MATI' : 'AKTIF'}
                on={!muted}
                onClick={() => onToggleMute?.()}
              />
              <BigRow
                label="SUARA PUKULAN"
                value={SFX_PROFILES.find((s) => s.id === sfx)?.name ?? 'BAJA BERAT'}
                onClick={() => {
                  const i = SFX_PROFILES.findIndex((s) => s.id === sfx);
                  onSfx(SFX_PROFILES[(i + 1) % SFX_PROFILES.length].id);
                }}
              />
              <BigRow
                label="KESULITAN"
                value={ultra ? 'ULTRA' : 'NORMAL'}
                on={ultra}
                onClick={() => onUltra(!ultra)}
              />
              <BigRow
                label="KUALITAS"
                value={GFX_MODES[gfxIdx].name}
                onClick={() => onGfx(GFX_MODES[(gfxIdx + 1) % GFX_MODES.length].id)}
              />
              <BigRow
                label="KAMERA"
                value={CAM_MODES[cam % CAM_MODES.length]?.name ?? 'SIARAN'}
                onClick={() => onCam((cam + 1) % CAM_MODES.length)}
              />
              <BigRow
                label="KECEPATAN"
                value={`${FOOTWORK_STEPS[fwIdx]}×`}
                onClick={() => onFw(FOOTWORK_STEPS[(fwIdx + 1) % FOOTWORK_STEPS.length])}
              />
            </div>

            {/* sisanya tertutup — biar menu utama tetap bersih */}
            <details className="hc-details">
              <summary>PENGATURAN LANJUTAN</summary>
              <div className="hc-adv space-y-3 pt-2">
                <IqPicker value={iq} onPick={onIq} />
                <BrightnessPicker value={bright} onPick={onBright} />
                <SaturationPicker value={sat} onPick={onSat} />
                <RobotTexturePicker value={tex} onPick={onTex} />
                <BloomPicker value={bloom} onPick={onBloom} />
                <ResetVisualsButton onReset={onResetVisuals} />
                <TransitionPicker value={trans} onPick={onTrans} onTry={onTransTry} />
                <PyroPicker value={pyro} onPick={onPyro} />
                {onNoSlowMoNormal && (
                  <SlowMoModePicker noSlowMoNormal={noSlowMoNormal} onPick={onNoSlowMoNormal} />
                )}
                {onDirectionalHeadSnap && (
                  <DirectionalHeadSnapPicker value={directionalHeadSnap} onPick={onDirectionalHeadSnap} />
                )}
                {onAllOverdrivePunch && (
                  <OverdrivePunchPicker value={!!allOverdrivePunch} onToggle={onAllOverdrivePunch} />
                )}
              </div>
            </details>

            <button className="hc-back" onClick={act(() => setPanel('main'))}>
              ◀ KEMBALI
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
