import { useEffect, useRef, useState } from 'react';
import { Engine, type CamPreset, type AutoMode } from './engine';
import { ATTACKS, CATEGORIES, phaseAt, slowAt, type AttackId } from './anim';

const PARTS: { group: string; icon: string; items: string[] }[] = [
  { group: '1. Kepala', icon: '🧠', items: ['Head', 'Neck'] },
  { group: '2. Badan (Torso)', icon: '🫁', items: ['Pelvis / Hip', 'Waist', 'Chest / Torso', 'Spine'] },
  { group: '3. Lengan Kiri & Kanan', icon: '💪', items: ['Shoulder', 'Upper Arm', 'Elbow', 'Forearm', 'Wrist', 'Hand / Fist'] },
  { group: '4. Kaki Kiri & Kanan', icon: '🦵', items: ['Hip', 'Thigh', 'Knee', 'Shin / Calf', 'Ankle', 'Foot'] },
];

export interface RealSteelGameProps {
  onBack?: () => void;
}

export default function RealSteelGame({ onBack }: RealSteelGameProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [time, setTime] = useState(0);
  const [attackId, setAttackId] = useState<AttackId>('clash');
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [joints, setJoints] = useState(false);
  const [cine, setCine] = useState(true);
  const [slowmo, setSlowmo] = useState(true);
  const [impact, setImpact] = useState<{ n: number; kind: 'hit' | 'clash' }>({ n: 0, kind: 'hit' });
  const [labels, setLabels] = useState(false);
  const [xray, setXray] = useState(false);
  const [auto, setAuto] = useState<AutoMode>('off');
  const [panel, setPanel] = useState(true);

  useEffect(() => {
    if (!mountRef.current) return;
    const e = new Engine(mountRef.current);
    let last = 0;
    e.onTime = (t) => {
      const now = performance.now();
      if (now - last > 16 || t < 0.05) {
        last = now;
        setTime(t);
      }
    };
    e.onAttack = (id) => setAttackId(id);
    e.onImpact = (kind) => setImpact((p) => ({ n: p.n + 1, kind }));
    engineRef.current = e;
    return () => e.dispose();
  }, []);

  useEffect(() => {
    if (engineRef.current) engineRef.current.playing = playing;
  }, [playing]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.speed = speed;
  }, [speed]);

  useEffect(() => {
    engineRef.current?.setJointsVisible(joints);
  }, [joints]);

  useEffect(() => {
    engineRef.current?.setLabelsVisible(labels);
  }, [labels]);

  useEffect(() => {
    engineRef.current?.setXray(xray);
  }, [xray]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.autoMode = auto;
  }, [auto]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.cinematic = cine;
  }, [cine]);

  useEffect(() => {
    if (engineRef.current) engineRef.current.slowmo = slowmo;
  }, [slowmo]);

  // Keyboard shortcut: Escape to go back
  useEffect(() => {
    const handleKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && onBack) {
        onBack();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onBack]);

  const attack = ATTACKS[attackId];
  const phase = phaseAt(attack, time);
  const inSlow = slowmo && playing && slowAt(attack, time) < 0.9;

  const cam = (p: CamPreset) => engineRef.current?.setCamera(p);
  const choose = (id: AttackId) => {
    engineRef.current?.setAttack(id, true);
    setPlaying(true);
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-950 text-slate-100 select-none z-50">
      <div ref={mountRef} className="absolute inset-0" />

      {/* Impact flash overlay */}
      {impact.n > 0 && (
        <div key={impact.n} className="pointer-events-none absolute inset-0">
          <div className={impact.kind === 'clash' ? 'flash-clash absolute inset-0' : 'flash-hit absolute inset-0'} />
        </div>
      )}

      {/* Cinematic letterbox during slow-mo */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-0 right-0 top-0 bg-black transition-all duration-500 ease-out" style={{ height: inSlow ? '9vh' : 0 }} />
        <div className="absolute bottom-0 left-0 right-0 bg-black transition-all duration-500 ease-out" style={{ height: inSlow ? '9vh' : 0 }} />
        <div className={`absolute left-1/2 top-[11vh] -translate-x-1/2 rounded border border-red-500/60 bg-black/60 px-3 py-0.5 font-mono text-xs tracking-[0.3em] text-red-400 transition-opacity duration-300 ${inSlow ? 'opacity-100' : 'opacity-0'}`}>
          ● SLOW-MO
        </div>
      </div>

      {/* Top Header with Back Button and Match title */}
      <div className="absolute left-0 right-0 top-0 flex items-center justify-between p-3 pointer-events-none z-30">
        {/* Back Button */}
        <div className="pointer-events-auto flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="group flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-950/90 via-slate-900/90 to-cyan-950/90 border border-cyan-400/80 text-cyan-200 hover:text-white hover:border-cyan-300 font-display text-xs tracking-wider shadow-[0_0_20px_rgba(6,182,212,0.4)] backdrop-blur-md transition-all active:scale-95 cursor-pointer"
              title="Kembali ke Menu Utama Steel Titans (Esc)"
            >
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-400/50 group-hover:bg-cyan-400 group-hover:text-black transition-colors">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
              </span>
              <span className="font-black text-xs">KEMBALI KE STEEL TITANS</span>
            </button>
          )}
          <span className="hidden md:inline-flex px-2.5 py-1 rounded-md bg-white/10 border border-white/10 text-[10px] font-mono text-slate-300 backdrop-blur">
            UNTUK REAL STEEL BLM DI UPDATE
          </span>
        </div>

        {/* Center Title and Phase Pill */}
        <div className="flex flex-col items-center gap-1.5 pointer-events-none">
          <h1 className="text-center text-sm font-black tracking-wide drop-shadow md:text-xl">
            🤖 ROBOT BOXING 3D: <span className="text-sky-400">UNIT-A</span> <span className="text-slate-400">vs</span> <span className="text-orange-400">UNIT-B</span>
          </h1>
          <div
            key={attackId + phase.name}
            className="phase-pop rounded-full px-4 py-1 text-xs font-bold shadow-lg md:text-sm"
            style={{ background: phase.color + 'dd', boxShadow: `0 0 20px ${phase.color}88` }}
          >
            {phase.name}
          </div>
        </div>

        {/* Right shortcut reminder */}
        <div className="hidden lg:flex items-center gap-2 pointer-events-auto">
          <span className="text-[11px] text-slate-400 font-mono">Tekan ESC untuk keluar</span>
        </div>
      </div>

      {/* Attack selector */}
      <div className="absolute right-3 top-20 w-60 rounded-2xl border border-white/10 bg-slate-900/85 p-2.5 shadow-2xl backdrop-blur z-20">
        <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Jenis Serangan</div>
        <div className="max-h-[calc(100vh-420px)] min-h-[120px] overflow-y-auto pr-0.5">
          {CATEGORIES.map((cat) => (
            <div key={cat.name} className="mb-1.5">
              <div className="mb-1 px-1 text-[9px] font-bold uppercase tracking-wider text-slate-500">{cat.name}</div>
              <div className="grid grid-cols-2 gap-1">
                {cat.ids.map((id) => {
                  const a = ATTACKS[id];
                  const active = id === attackId;
                  const tag =
                    a.category === 'taunt'
                      ? 'TAUNT · SOMBONG'
                      : a.category === 'combo'
                        ? `KOMBO ${a.hits?.length ?? 1} HIT`
                        : a.kind === 'show'
                          ? 'FOOTWORK'
                          : `${a.target.toUpperCase()} · ${a.hand === 'L' ? 'KIRI' : 'KANAN'}`;
                  const tagCls =
                    a.category === 'taunt'
                      ? 'bg-violet-500/90'
                      : a.category === 'combo'
                        ? 'bg-orange-500/90 text-slate-900'
                        : a.hitPart === 'fist'
                          ? 'bg-fuchsia-500/90'
                          : a.hitPart === 'none'
                            ? 'bg-emerald-500/90 text-slate-900'
                            : 'bg-rose-500/80';
                  return (
                    <button
                      key={id}
                      onClick={() => choose(id)}
                      title={a.desc}
                      className={`rounded-xl border px-2 py-1.5 text-left transition cursor-pointer ${
                        cat.ids.length % 2 === 1 && id === cat.ids[cat.ids.length - 1] ? 'col-span-2' : ''
                      } ${
                        a.detach && id !== 'overdrive'
                          ? `bg-gradient-to-r from-amber-600/60 via-yellow-500/40 to-amber-600/60 ${
                              active ? 'border-yellow-200 shadow-[0_0_20px_rgba(250,204,21,0.5)]' : 'border-amber-400/70 hover:brightness-125'
                            }`
                          : id === 'overdrive'
                            ? `bg-gradient-to-r from-red-700/70 via-orange-600/60 to-red-700/70 ${
                                active ? 'border-yellow-300 shadow-[0_0_22px_rgba(250,204,21,0.55)]' : 'border-red-400/70 hover:brightness-125'
                              }`
                            : active
                              ? 'border-red-400 bg-red-500/20 shadow-[0_0_18px_rgba(239,68,68,0.35)]'
                              : 'border-white/10 bg-white/5 hover:bg-white/10'
                      }`}
                    >
                      <div className="text-[12px] font-bold leading-tight">
                        {a.icon} {a.name}
                      </div>
                      <span className={`mt-0.5 inline-block rounded px-1 py-px text-[8px] font-bold ${tagCls}`}>{tag}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-1.5 rounded-lg bg-black/30 px-2 py-1.5 text-[10px] leading-snug text-slate-300">{attack.desc}</div>
        <div className="mt-2 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Mode Otomatis</div>
        <div className="mt-1 grid grid-cols-3 gap-1 text-[11px]">
          {([['off', 'Manual'], ['cycle', '🔁 Urut'], ['random', '🎲 Acak']] as [AutoMode, string][]).map(([k, l]) => (
            <button
              key={k}
              onClick={() => setAuto(k)}
              className={`rounded-md px-1 py-1 cursor-pointer transition ${auto === k ? 'bg-cyan-500 font-bold text-slate-950' : 'bg-white/5 hover:bg-white/15'}`}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="mt-2 px-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Kamera</div>
        <div className="mt-1 grid grid-cols-2 gap-1">
          {([
            ['side', '🎬 Samping'],
            ['diagonal', '📐 Diagonal'],
            ['victim', '🎯 Korban'],
            ['top', '🛰️ Atas'],
          ] as [CamPreset, string][]).map(([k, l]) => (
            <button key={k} onClick={() => cam(k)} className="rounded-md bg-white/5 px-1.5 py-1 text-left text-[11px] hover:bg-white/15 cursor-pointer">
              {l}
            </button>
          ))}
        </div>
        <div className="px-1 pt-1.5 text-[9px] text-slate-500">Drag = putar kamera · Scroll = zoom</div>
      </div>

      {/* Body parts panel */}
      <div className={`absolute left-3 top-20 w-56 transition-transform duration-300 z-20 ${panel ? '' : '-translate-x-[110%]'}`}>
        <div className="max-h-[calc(100vh-260px)] overflow-y-auto rounded-2xl border border-white/10 bg-slate-900/80 p-3 shadow-2xl backdrop-blur">
          <h2 className="mb-2 text-sm font-bold text-cyan-300">🦴 Struktur Tubuh (Rig)</h2>
          {PARTS.map((g) => (
            <div key={g.group} className="mb-2">
              <div className="text-xs font-semibold text-slate-200">
                {g.icon} {g.group}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                {g.items.map((i) => (
                  <span key={i} className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-300">
                    {i}
                  </span>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-2 border-t border-white/10 pt-2 text-[10px] leading-relaxed text-slate-400">
            <div>
              <span className="inline-block h-2 w-2 rounded-full bg-cyan-400 mr-1" /> Sendi UNIT-B (merah)
            </div>
            <div>
              <span className="inline-block h-2 w-2 rounded-full bg-yellow-400 mr-1" /> Sendi UNIT-A (biru)
            </div>
            20 sendi/karakter · interpolasi spline halus (monotone cubic) + crossfade antar serangan.
          </div>
        </div>
      </div>
      <button
        onClick={() => setPanel(!panel)}
        className="absolute left-3 top-[4.6rem] rounded-lg bg-slate-800/90 px-2 py-1 text-xs hover:bg-slate-700 cursor-pointer z-20 border border-white/10"
      >
        {panel ? '◀ Sembunyikan' : '▶ Bagian Tubuh'}
      </button>

      {/* Bottom Timeline Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-3 z-20">
        <div className="mx-auto max-w-4xl rounded-2xl border border-white/10 bg-slate-900/85 p-3 shadow-2xl backdrop-blur">
          <div className="relative mb-3 h-6">
            <div className="absolute inset-x-0 top-2.5 h-1.5 rounded-full bg-slate-700" />
            {attack.phases.map((p, i) => {
              const next = attack.phases[i + 1]?.t ?? attack.duration;
              return (
                <div
                  key={p.name}
                  title={p.name}
                  className="absolute top-2.5 h-1.5 cursor-pointer opacity-70 hover:opacity-100"
                  style={{ left: `${(p.t / attack.duration) * 100}%`, width: `${((next - p.t) / attack.duration) * 100}%`, background: p.color }}
                  onClick={() => engineRef.current?.seek(p.t + 0.001)}
                />
              );
            })}
            <div
              className={`pointer-events-none absolute top-0 h-6 w-0.5 bg-red-500 ${attack.kind === 'show' ? 'hidden' : ''}`}
              style={{ left: `${(attack.hitTime / attack.duration) * 100}%` }}
              title="Impact"
            />
            <input
              type="range"
              min={0}
              max={attack.duration}
              step={0.01}
              value={time}
              onChange={(e) => {
                setPlaying(false);
                engineRef.current?.seek(parseFloat(e.target.value));
              }}
              className="timeline absolute inset-x-0 top-0 h-6 w-full cursor-pointer appearance-none bg-transparent"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setPlaying(!playing)} className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-400 cursor-pointer">
              {playing ? '⏸ Pause' : '▶ Play'}
            </button>
            <button
              onClick={() => {
                engineRef.current?.seek(0);
                setPlaying(true);
              }}
              className="rounded-xl bg-slate-700 px-3 py-2 text-sm hover:bg-slate-600 cursor-pointer"
            >
              ⟲ Ulang
            </button>
            <span className="w-24 font-mono text-xs text-slate-300">
              {time.toFixed(2)}s / {attack.duration.toFixed(1)}s
            </span>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-400">Speed</span>
              {[0.25, 0.5, 1, 1.5].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`rounded-md px-2 py-1 cursor-pointer transition ${speed === s ? 'bg-cyan-500 font-bold text-slate-950' : 'bg-white/5 hover:bg-white/15'}`}
                >
                  {s}x
                </button>
              ))}
            </div>
            <div className="ml-auto flex flex-wrap gap-1.5 text-xs">
              <Toggle on={joints} set={setJoints} label="⚪ Sendi" />
              <Toggle on={labels} set={setLabels} label="🏷️ Label" />
              <Toggle on={xray} set={setXray} label="👻 X-Ray" />
              <Toggle on={cine} set={setCine} label="🎥 Sinematik" />
              <Toggle on={slowmo} set={setSlowmo} label="🐢 Slow-mo Clash" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Toggle({ on, set, label }: { on: boolean; set: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => set(!on)}
      className={`rounded-lg border px-2 py-1 transition cursor-pointer ${
        on ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200' : 'border-white/10 bg-white/5 text-slate-400 hover:bg-white/10'
      }`}
    >
      {label}
    </button>
  );
}
