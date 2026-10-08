import type { ReactNode } from 'react';
import { CAM_MODES, FOOTWORK_STEPS, GFX_MODES, IQ_STEPS, QUALITY_TIERS, SAT_STEPS, TRANSITIONS, ULTRA_COLOR, type BloomMode, type GfxMode, type PyroPlacement, type TransId } from '../game/Game';
import { SFX_PROFILES, type SfxProfile } from '../game/audio';
import { cssVar } from './Emblem';

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="h-3 w-[3px] bg-amber-300" style={{ transform: 'skewX(-20deg)' }} />
      <span className="font-tech text-[10px] font-bold tracking-[0.3em] text-white/70">{children}</span>
      <span className="h-px flex-1 bg-gradient-to-r from-white/25 to-transparent" />
      {right}
    </div>
  );
}

// the little "waveform" drawn on each sound card
const WAVE: Record<SfxProfile, number[]> = {
  heavy: [5, 11, 16, 9, 6],
  hydraulic: [14, 5, 16, 4, 12],
  glove: [6, 13, 8, 13, 6],
  cinema: [3, 7, 15, 16, 8],
};

export function SfxPicker({ value, onPick }: { value: SfxProfile; onPick: (id: SfxProfile) => void }) {
  return (
    <div>
      <SectionTitle>SUARA BENTURAN · KLIK UNTUK DENGAR</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {SFX_PROFILES.map((s, i) => {
          const on = s.id === value;
          return (
            <button
              key={s.id}
              onClick={() => onPick(s.id)}
              className={`tile cut-sm pointer-events-auto relative px-3 py-2 text-left ${on ? 'tile-on' : ''}`}
              style={cssVar('--c', '#ffd34a')}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-[17px] tracking-wider" style={{ color: on ? '#ffd34a' : '#ffffff' }}>
                  {i + 1}. {s.name}
                </span>
                <span className={`eq ${on ? 'eq-on' : ''}`} style={{ color: on ? '#ffd34a' : 'rgba(255,255,255,0.4)' }}>
                  {WAVE[s.id].map((h, k) => (
                    <i key={k} style={{ height: h }} />
                  ))}
                </span>
              </div>
              <div className="mt-0.5 text-[10px] leading-tight text-white/55">{s.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DifficultyPicker({ ultra, onPick }: { ultra: boolean; onPick: (ultra: boolean) => void }) {
  return (
    <div>
      <SectionTitle
        right={
          <span className={`font-tech text-[8px] font-bold tracking-[0.2em] ${ultra ? 'text-rose-400' : 'text-amber-300'}`}>
            {ultra ? 'MODE EKSTREM AKTIF' : 'MODE STANDAR'}
          </span>
        }
      >
        MODE KOMPETISI
      </SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onPick(false)}
          className={`tile cut-sm pointer-events-auto relative px-3 py-2 text-left ${!ultra ? 'tile-on' : ''}`}
          style={cssVar('--c', '#38bdf8')}
        >
          <div className="flex items-center justify-between">
            <span className="font-display text-[19px] leading-none tracking-wider" style={{ color: !ultra ? '#7dd3fc' : '#ffffff' }}>
              NORMAL LEAGUE
            </span>
            <span className="rounded bg-sky-500/20 px-1.5 py-0.5 font-tech text-[8px] font-bold text-sky-300">★ 1.0×</span>
          </div>
          <div className="mt-1 font-tech text-[8px] tracking-wider text-white/55">STAT STANDAR · COCOK PEMULA</div>
        </button>
        <button
          onClick={() => onPick(true)}
          className={`tile ultra-btn cut-sm pointer-events-auto relative overflow-hidden px-3 py-2 text-left ${ultra ? 'tile-on' : ''}`}
          style={cssVar('--c', ULTRA_COLOR)}
        >
          <div className="relative z-10 flex items-center justify-between">
            <span className="font-display text-[19px] leading-none tracking-wider" style={{ color: ULTRA_COLOR }}>
              ULTRA HARD
            </span>
            <span className="rounded bg-rose-500/25 px-1.5 py-0.5 font-tech text-[8px] font-bold text-rose-300">
              {ultra ? '🔥 ON' : '☠ PRO'}
            </span>
          </div>
          <div className="relative z-10 mt-1 font-tech text-[8px] tracking-wider text-rose-200/75">
            HP +40% · DMG +30% · OVERDRIVE
          </div>
        </button>
      </div>
    </div>
  );
}

const FW_DESC: Record<number, string> = { 1: 'NORMAL', 1.5: 'LINCAH', 2: 'CEPAT', 3: 'EKSTREM' };

export function FootworkPicker({ value, onPick }: { value: number; onPick: (m: number) => void }) {
  return (
    <div>
      <SectionTitle right={<span className="font-tech text-[9px] tracking-[0.2em] text-emerald-300">[ ] SAAT BERTANDING</span>}>KECEPATAN FOOTWORK</SectionTitle>
      <div className="grid grid-cols-4 gap-2">
        {FOOTWORK_STEPS.map((m, idx) => {
          const on = m === value;
          return (
            <button
              key={m}
              onClick={() => onPick(m)}
              className={`tile cut-sm pointer-events-auto relative px-1 py-2 text-center ${on ? 'tile-on' : ''}`}
              style={cssVar('--c', '#59ffb4')}
            >
              <div className="font-display text-[26px] leading-none" style={{ color: on ? '#7dffc4' : '#ffffff' }}>
                {m}×
              </div>
              <div className="mt-0.5 font-tech text-[8px] tracking-[0.15em] text-white/55">{FW_DESC[m]}</div>
              <div className="mx-auto mt-1.5 flex w-10 gap-0.5">
                {FOOTWORK_STEPS.map((_, k) => (
                  <i key={k} className="block h-[3px] flex-1" style={{ background: k <= idx ? (on ? '#7dffc4' : 'rgba(255,255,255,0.55)') : 'rgba(255,255,255,0.14)' }} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 text-[10px] leading-tight text-white/45">Mengalikan kecepatan jalan, lari, dash, dan seberapa cepat robot merespons tombol.</div>
    </div>
  );
}

const IQ_NAME: Record<number, string> = { 1: 'NORMAL', 2: 'PINTAR', 3: 'JENIUS', 10: 'SUPER AI', 12: 'STRATEGIS' };
const IQ_LABEL: Record<number, string> = { 12: '★' }; // the strategist tier is not "12×", it is its own thing
const IQ_SUB: Record<number, string> = {
  1: 'Refleks AI standar — pola serangan dasar',
  2: 'Baca serangan & dodge lebih responsif',
  3: 'Dodge presisi, feint & counter cepat',
  10: 'Refleks nyaris sempurna & hukuman instan',
  12: 'Taktik adaptif: memancing, menyudutkan & simpan Overdrive',
};

/** how many times smarter the enemy is: reads you faster, dodges and blocks more, counters harder */
export function IqPicker({ value, onPick }: { value: number; onPick: (n: number) => void }) {
  return (
    <div>
      <SectionTitle
        right={
          <span className={`font-tech text-[8px] font-bold tracking-[0.2em] ${value >= 10 ? 'text-amber-300' : 'text-purple-300'}`}>
            TIER: {IQ_NAME[value]}
          </span>
        }
      >
        KECERDASAN AI LAWAN
      </SectionTitle>
      <div className="grid grid-cols-5 gap-1.5">
        {IQ_STEPS.map((m) => {
          const on = m === value;
          const col = m >= 12 ? '#ffb030' : m >= 10 ? '#ff4a64' : '#c58bff';
          return (
            <button
              key={m}
              onClick={() => onPick(m)}
              className={`tile cut-sm pointer-events-auto relative px-1 py-1.5 text-center ${on ? 'tile-on' : ''}`}
              style={cssVar('--c', col)}
            >
              <div className="font-display text-[20px] leading-none" style={{ color: on ? col : '#ffffff' }}>
                {IQ_LABEL[m] ?? `${m}×`}
              </div>
              <div className="mt-0.5 font-tech text-[7px] font-bold tracking-[0.1em] text-white/65">{IQ_NAME[m]}</div>
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 rounded border border-white/5 bg-white/[0.03] px-2 py-1 font-tech text-[8.5px] tracking-wide text-white/65">
        <span className="text-amber-300">⚡</span>
        <span className="truncate">{IQ_SUB[value] ?? ''}</span>
      </div>
    </div>
  );
}

const GFX_COLOR = '#5ee7a0';
const GFX_DESC: Record<GfxMode, string> = {
  auto: 'Governor 60 fps: kualitas naik-turun sendiri mengikuti beban GPU',
  max: 'Semua efek menyala — refleksi lantai, bloom, bayangan 2048, AA 4×',
  balanced: 'Refleksi kanvas saja, bloom lebih murah, bayangan 1536',
  performance: 'Tanpa refleksi, AA via FXAA, bayangan 1024 — paling ringan, tetap ber-bloom',
};

/** the graphics modes: the 60 fps governor, or a tier the player pins by hand */
export function GfxPicker({ value, onPick, fps, tier }: { value: GfxMode; onPick: (m: GfxMode) => void; fps?: number; tier?: string }) {
  return (
    <div>
      <SectionTitle
        right={
          <span className="font-tech text-[9px] tracking-[0.2em]" style={{ color: GFX_COLOR }}>
            {fps ? `${Math.round(fps)} FPS` : ''}
            {tier ? ` · ${tier}` : ''}
          </span>
        }
      >
        GRAFIS &amp; PERFORMA
      </SectionTitle>
      <div className="grid grid-cols-4 gap-1.5">
        {GFX_MODES.map((m, i) => {
          const on = m.id === value;
          return (
            <button
              key={m.id}
              onClick={() => onPick(m.id)}
              className={`tile cut-sm pointer-events-auto relative px-1 py-1.5 text-center ${on ? 'tile-on' : ''}`}
              style={cssVar('--c', GFX_COLOR)}
            >
              <div className="font-display text-[12px] leading-none tracking-wider" style={{ color: on ? GFX_COLOR : '#ffffff' }}>
                {i + 1}. {m.name}
              </div>
              <div className="mx-auto mt-1 flex w-10 gap-0.5">
                {GFX_MODES.map((_, k) => (
                  <i key={k} className="block h-[3px] flex-1" style={{ background: k <= i ? (on ? GFX_COLOR : 'rgba(255,255,255,0.55)') : 'rgba(255,255,255,0.14)' }} />
                ))}
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 rounded border border-white/5 bg-white/[0.03] px-2 py-1 font-tech text-[8.5px] tracking-wide text-white/65">
        <span style={{ color: GFX_COLOR }}>✦</span>
        <span className="truncate">{GFX_DESC[value]}</span>
      </div>
    </div>
  );
}

const BRIGHT_LABEL: Record<number, string> = { 0.7: 'GELAP', 0.85: 'LEMBUT', 1: 'NORMAL', 1.15: 'TERANG', 1.3: 'SILAU', 1.5: 'MAKS' };

/**
 * THE EXPOSURE / LIGHT LEVEL. Adjusts the brightness of the scene and game world.
 */
export function BrightnessPicker({ value, onPick }: { value: number; onPick: (b: number) => void }) {
  const pct = Math.round(value * 100);
  return (
    <div className="mt-3">
      <SectionTitle
        right={
          <span className="font-tech text-[9px] tracking-[0.2em]" style={{ color: GFX_COLOR }}>
            {pct}% · {pct < 80 ? 'GELAP' : pct < 95 ? 'LEMBUT' : pct <= 105 ? 'NORMAL' : pct < 125 ? 'TERANG' : 'SILAU'}
          </span>
        }
      >
        TINGKAT CAHAYA / KECERAHAN
      </SectionTitle>

      {/* Interactive Brightness Slider */}
      <div className="mb-2 flex items-center gap-3 rounded border border-white/10 bg-black/40 px-3 py-2">
        <span className="font-tech text-[10px] font-bold text-white/50">50%</span>
        <input
          type="range"
          min={50}
          max={150}
          step={1}
          value={pct}
          onChange={(e) => onPick(Number(e.target.value) / 100)}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-slate-700 accent-emerald-400"
        />
        <span className="font-tech text-[10px] font-bold text-white/50">150%</span>
        <span className="min-w-[42px] text-right font-display text-[15px] font-bold text-emerald-300">
          {pct}%
        </span>
      </div>

      <div className="grid grid-cols-6 gap-1">
        {[0.70, 0.85, 1.0, 1.15, 1.30, 1.50].map((b) => {
          const on = Math.abs(b - value) < 0.04;
          return (
            <button
              key={b}
              onClick={() => onPick(b)}
              className={`tile cut-sm pointer-events-auto relative px-0.5 py-1 text-center ${on ? 'tile-on' : ''}`}
              style={cssVar('--c', GFX_COLOR)}
            >
              <div className="font-display text-[13px] leading-none" style={{ color: on ? GFX_COLOR : '#ffffff' }}>
                {Math.round(b * 100)}%
              </div>
              <div className="mt-0.5 font-tech text-[6.5px] font-bold tracking-[0.05em] text-white/60">{BRIGHT_LABEL[b] ?? ''}</div>
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 text-[9.5px] leading-tight text-white/50">
        Menyetel intensitas cahaya dan exposure visual arena &amp; robot secara real-time.
      </div>
    </div>
  );
}

const SAT_COLOR = '#ff5ea7';
const SAT_LABEL: Record<number, string> = {
  0.95: 'LEMBUT',
  1.15: 'NORMAL',
  1.45: 'VIVID (HIDUP)',
  1.70: 'ULTRA',
};
const SAT_DESC: Record<number, string> = {
  0.95: 'Warna natural lembut tanpa dorongan ekstra',
  1.15: 'Tampilan standar seimbang original',
  1.45: 'Warna hidup, lampu neon menyala kaya & robot penuh warna (Rekomendasi)',
  1.70: 'Saturasi sangat pekat, kontras tinggi & efek visual mencolok',
};

export function SaturationPicker({ value, onPick }: { value: number; onPick: (s: number) => void }) {
  return (
    <div className="mt-3">
      <SectionTitle
        right={
          <span className="font-tech text-[9px] tracking-[0.2em]" style={{ color: SAT_COLOR }}>
            {Math.abs(value - 1.15) < 0.05 ? 'STANDAR NORMAL' : Math.abs(value - 1.45) < 0.05 ? '★ VIVID HIDUP' : `${Math.round(value * 100)}%`}
          </span>
        }
      >
        SATURASI &amp; KEHIDUPAN WARNA
      </SectionTitle>
      <div className="grid grid-cols-4 gap-1.5">
        {SAT_STEPS.map((s) => {
          const on = Math.abs(s - value) < 0.05;
          return (
            <button
              key={s}
              onClick={() => onPick(s)}
              className={`tile cut-sm pointer-events-auto relative px-1 py-1.5 text-center ${on ? 'tile-on' : ''}`}
              style={cssVar('--c', SAT_COLOR)}
            >
              <div className="font-display text-[15px] leading-none" style={{ color: on ? SAT_COLOR : '#ffffff' }}>
                {s === 1.45 ? '1.45×' : s === 1.15 ? '1.0×' : `${s}×`}
              </div>
              <div className="mt-0.5 font-tech text-[7px] font-bold tracking-[0.08em] text-white/65">
                {SAT_LABEL[s] ?? ''}
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 rounded border border-white/5 bg-white/[0.03] px-2 py-1 font-tech text-[8.5px] tracking-wide text-white/65">
        <span style={{ color: SAT_COLOR }}>✦</span>
        <span className="truncate">{SAT_DESC[value] ?? 'Atur kepekatan warna arena dan robot'}</span>
      </div>
    </div>
  );
}

export function RobotTexturePicker({ value, onPick }: { value: boolean; onPick: (enhanced: boolean) => void }) {
  return (
    <div className="mt-3">
      <SectionTitle
        right={
          <span className={`font-tech text-[9px] tracking-[0.2em] ${value ? 'text-cyan-300' : 'text-white/60'}`}>
            {value ? 'HD PBR AKTIF' : 'NORMAL STANDAR'}
          </span>
        }
      >
        TEKSTUR &amp; DETAIL ROBOT
      </SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => onPick(true)}
          className={`tile cut-sm pointer-events-auto relative px-2.5 py-2 text-left ${value ? 'tile-on' : ''}`}
          style={cssVar('--c', '#38bdf8')}
        >
          <div className="flex items-center justify-between">
            <span className="font-display text-[16px] tracking-wider" style={{ color: value ? '#38bdf8' : '#ffffff' }}>
              ✦ HD DETAIL
            </span>
            <span className="rounded bg-sky-500/20 px-1 py-0.5 font-tech text-[7.5px] font-bold text-sky-300">
              REKOMENDASI
            </span>
          </div>
          <div className="mt-0.5 font-tech text-[8px] tracking-wide text-white/60">
            Brushed metal, serat karbon &amp; micro-groove
          </div>
        </button>
        <button
          onClick={() => onPick(false)}
          className={`tile cut-sm pointer-events-auto relative px-2.5 py-2 text-left ${!value ? 'tile-on' : ''}`}
          style={cssVar('--c', '#94a3b8')}
        >
          <div className="flex items-center justify-between">
            <span className="font-display text-[16px] tracking-wider" style={{ color: !value ? '#cbd5e1' : '#ffffff' }}>
              NORMAL
            </span>
            <span className="rounded bg-slate-500/20 px-1 py-0.5 font-tech text-[7.5px] font-bold text-slate-300">
              ORIGINAL
            </span>
          </div>
          <div className="mt-0.5 font-tech text-[8px] tracking-wide text-white/60">
            Tekstur halus standar tanpa micro-bump
          </div>
        </button>
      </div>
    </div>
  );
}

export function BloomPicker({
  value,
  onPick,
}: {
  value: number | BloomMode;
  onPick: (pct: number) => void;
}) {
  const numVal = typeof value === 'number' ? value : value === 'off' ? 0 : value === 'smooth' ? 18 : 28;
  const pct = Math.max(0, Math.min(50, Math.round(numVal)));
  const statusLabel = pct === 0 ? 'NONAKTIF' : pct <= 18 ? 'HALUS LEMBUT' : pct <= 35 ? 'STANDAR VIVID' : 'MAKSIMAL';
  const statusColor = pct === 0 ? '#94a3b8' : pct <= 20 ? '#34d399' : '#fbbf24';

  return (
    <div className="mt-3">
      <SectionTitle
        right={
          <span className="font-tech text-[9px] tracking-[0.2em]" style={{ color: statusColor }}>
            {pct}% · {statusLabel}
          </span>
        }
      >
        EFEK CAHAYA BLOOM (0 - 50%)
      </SectionTitle>

      {/* Interactive Bloom Range Slider: 0% to 50% */}
      <div className="mb-2 flex items-center gap-3 rounded border border-white/10 bg-black/40 px-3 py-2">
        <span className="font-tech text-[10px] font-bold text-white/50">0%</span>
        <input
          type="range"
          min={0}
          max={50}
          step={1}
          value={pct}
          onChange={(e) => onPick(Number(e.target.value))}
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-lg bg-slate-700 accent-amber-400"
        />
        <span className="font-tech text-[10px] font-bold text-white/50">50%</span>
        <span className="min-w-[42px] text-right font-display text-[15px] font-bold text-amber-300">
          {pct}%
        </span>
      </div>

      {/* Quick Bloom Presets */}
      <div className="grid grid-cols-5 gap-1.5">
        {[
          { p: 0, label: '0%', sub: 'MATI' },
          { p: 15, label: '15%', sub: 'LEMBUT' },
          { p: 25, label: '25%', sub: 'STANDAR' },
          { p: 35, label: '35%', sub: 'TERANG' },
          { p: 50, label: '50%', sub: 'MAKS 50%' },
        ].map((item) => {
          const on = Math.abs(pct - item.p) < 4;
          const col = item.p === 0 ? '#94a3b8' : item.p <= 20 ? '#34d399' : '#fbbf24';
          return (
            <button
              key={item.p}
              onClick={() => onPick(item.p)}
              className={`tile cut-sm pointer-events-auto relative px-1 py-1.5 text-center ${on ? 'tile-on' : ''}`}
              style={cssVar('--c', col)}
            >
              <div className="font-display text-[13px] leading-none" style={{ color: on ? col : '#ffffff' }}>
                {item.label}
              </div>
              <div className="mt-0.5 font-tech text-[6.5px] font-bold tracking-[0.05em] text-white/60">
                {item.sub}
              </div>
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 rounded border border-white/5 bg-white/[0.03] px-2 py-1 font-tech text-[8.5px] tracking-wide text-white/65">
        <span style={{ color: statusColor }}>✦</span>
        <span className="truncate">
          {pct === 0
            ? 'Bloom dinonaktifkan (0%) — pencahayaan tajam tanpa pendaran glow'
            : pct <= 20
            ? `Bloom halus (${pct}%) — glow sinematik lembut & stabil anti-flicker`
            : `Bloom intensif (${pct}%) — pendaran cahaya spektakuler pada lampu & efek`}
        </span>
      </div>
    </div>
  );
}

export function ResetVisualsButton({ onReset }: { onReset: () => void }) {
  return (
    <div className="mt-3.5">
      <button
        onClick={onReset}
        className="cut-sm pointer-events-auto flex w-full items-center justify-center gap-2 border border-amber-300/40 bg-amber-400/10 py-2 font-display text-[15px] tracking-[0.16em] text-amber-200 transition hover:bg-amber-400/20 active:scale-[0.98]"
      >
        <span>↺</span>
        <span>NORMALKAN TAMPILAN (RESET KE STANDAR)</span>
      </button>
      <div className="mt-1 text-center font-tech text-[8px] tracking-wider text-white/45">
        Kembalikan saturasi (normal), kecerahan (1.0), bloom normal, tekstur normal &amp; auto 60 fps
      </div>
    </div>
  );
}

/**
 * HOW THE LOBBY HANDS OVER TO THE RING. Every kind is dressed over the short VS countdown —
 * then the cover, then the bell under it — so this only changes the look, never when the fight starts. "COBA" plays
 * the picked one over the lobby right now, so you can choose one without having to start a match.
 */
export function TransitionPicker({ value, onPick, onTry }: { value: TransId; onPick: (id: TransId) => void; onTry?: () => void }) {
  const cur = TRANSITIONS.find((t) => t.id === value) ?? TRANSITIONS[0];
  return (
    <div>
      <SectionTitle
        right={
          onTry ? (
            <button onClick={onTry} className="pointer-events-auto border border-amber-300/60 bg-amber-400/15 px-2 py-0.5 font-tech text-[9px] font-bold tracking-[0.2em] text-amber-100 hover:bg-amber-400/30">
              ▶ COBA
            </button>
          ) : null
        }
      >
        TRANSISI MASUK RING
      </SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {TRANSITIONS.map((t) => {
          const on = t.id === value;
          return (
            <button
              key={t.id}
              onClick={() => onPick(t.id)}
              className={`tile cut-sm pointer-events-auto relative px-3 py-2 text-left ${on ? 'tile-on' : ''}`}
              style={cssVar('--c', '#ffd34a')}
            >
              <div className="font-display text-[15px] tracking-wider" style={{ color: on ? '#ffd34a' : '#ffffff' }}>
                {t.name}
              </div>
              <div className="mt-0.5 text-[10px] leading-tight text-white/55">{t.hint}</div>
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 text-[10px] leading-tight text-white/45">
        Terjadi tepat saat kedua robot mengadu tinju di layar VS: {cur.name.toLowerCase()} menutup potongan gambar ke
        ring walk. Tekan ▶ COBA untuk melihatnya sekarang, tanpa harus memulai pertandingan.
      </div>
    </div>
  );
}

/** the five rungs the picture can run on, top to bottom — purely informational, the game picks the rung itself */
export function TierLadder({ tier }: { tier?: string }) {
  return (
    <div className="mt-1 flex items-center gap-1.5 font-tech text-[8px] tracking-[0.16em] text-white/40">
      <span>LADDER</span>
      {QUALITY_TIERS.map((t) => (
        <span key={t.key} className={t.name === tier ? 'font-bold text-emerald-300' : ''}>
          {t.name}
          {t.key !== QUALITY_TIERS[QUALITY_TIERS.length - 1].key ? ' ▸' : ''}
        </span>
      ))}
    </div>
  );
}

const CAM_COLOR = '#7dd3fc';

/** the five camera presets. Same framing guarantee, five very different seats in the arena. */
export function CamPicker({ value, onPick }: { value: number; onPick: (i: number) => void }) {
  return (
    <div>
      <SectionTitle
        right={
          <span className="font-tech text-[9px] tracking-[0.2em]" style={{ color: CAM_COLOR }}>
            / . SAAT BERTANDING
          </span>
        }
      >
        MODE KAMERA
      </SectionTitle>
      <div className="flex flex-col gap-1.5">
        {CAM_MODES.map((m, i) => {
          const on = i === value;
          return (
            <button
              key={m.id}
              onClick={() => onPick(i)}
              className={`tile cut-sm pointer-events-auto relative px-3 py-2 text-left ${on ? 'tile-on' : ''}`}
              style={cssVar('--c', CAM_COLOR)}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-display text-[17px] tracking-wider" style={{ color: on ? CAM_COLOR : '#ffffff' }}>
                  {i + 1}. {m.name}
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-tech text-[8px] tracking-[0.16em] text-white/40">{m.tag}</span>
                  {on && <span className="font-tech text-[9px] font-bold tracking-[0.16em]" style={{ color: CAM_COLOR }}>AKTIF</span>}
                </span>
              </div>
              <div className="mt-0.5 text-[10px] leading-tight text-white/55">{m.desc}</div>
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 text-[10px] leading-tight text-white/45">
        Semua mode lewat pengaman framing yang sama: robot tidak akan pernah terpotong tepi layar. Ganti kapan saja —
        di menu, saat jeda, atau tengah ronde dengan tombol <b className="text-white/70">/</b> dan <b className="text-white/70">.</b>
      </div>
    </div>
  );
}

export function PyroPicker({
  value,
  onPick,
}: {
  value: PyroPlacement;
  onPick: (p: PyroPlacement) => void;
}) {
  const options: { id: PyroPlacement; name: string; desc: string; icon: string }[] = [
    {
      id: 'ring_posts',
      name: 'POJOK TIANG RING',
      desc: 'Nozel semburan api di 4 tiang sudut ring tinju',
      icon: '🏟️',
    },
    {
      id: 'steel_platform',
      name: 'PLATFORM BAJA',
      desc: 'Meriam api konser megah di 4 ujung dek platform baja',
      icon: '🔥',
    },
  ];
  return (
    <div>
      <SectionTitle>LETAK NOZEL PYRO API KONSER</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => {
          const on = opt.id === value;
          return (
            <button
              key={opt.id}
              onClick={() => onPick(opt.id)}
              className={`tile cut-sm pointer-events-auto relative px-3 py-2 text-left ${on ? 'tile-on' : ''}`}
              style={cssVar('--c', '#ff7814')}
            >
              <div className="flex items-center gap-1.5 font-display text-[15px] tracking-wider" style={{ color: on ? '#ff9b30' : '#ffffff' }}>
                <span>{opt.icon}</span>
                <span>{opt.name}</span>
              </div>
              <div className="mt-0.5 text-[10px] leading-tight text-white/55">{opt.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
