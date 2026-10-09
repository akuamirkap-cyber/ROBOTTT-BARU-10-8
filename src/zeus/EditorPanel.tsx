type V3 = [number, number, number];
type Adj = { p: V3; r: V3; s: V3; u: number; v?: V3; b?: [number, number] };
type SelInfo = { id: string; label: string; side: string; hasMirror: boolean; adj: Adj };

function Row({ label, value, min, max, step, onChange, reset }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; reset: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-green-200/80 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="flex-1 accent-green-400" />
      <input
        type="number"
        step={step}
        value={Number(value.toFixed(3))}
        onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) onChange(v); }}
        className="w-16 bg-black/60 border border-green-800 rounded px-1 py-0.5 text-green-100 text-right"
      />
      <button onClick={() => onChange(reset)} title="Reset" className="text-green-500 hover:text-green-300 px-1">↺</button>
    </div>
  );
}

export default function EditorPanel({ sel, count = 1, mirror, setMirror, update, onReset, onClose, onDelete }: {
  sel: SelInfo; count?: number; mirror: boolean; onDelete?: () => void; setMirror: (v: boolean) => void; update: (fn: (a: Adj) => Adj) => void; onReset: () => void; onClose: () => void;
}) {
  const a = sel.adj;
  const setP = (i: number) => (v: number) => update((x) => { x.p[i] = v; return x; });
  const setR = (i: number) => (v: number) => update((x) => { x.r[i] = v; return x; });
  const v: V3 = a.v || [0, 0, 0];
  const bd: [number, number] = a.b || [0, 0];
  const setB = (i: number) => (val: number) => update((x) => { x.b = [...(x.b || [0, 0])] as [number, number]; x.b[i] = val; return x; });
  const setV = (i: number) => (val: number) => update((x) => { x.v = [...(x.v || [0, 0, 0])] as V3; x.v[i] = val; return x; });
  const setS = (i: number) => (v: number) => update((x) => { x.s[i] = v; return x; });
  return (
    <div className="absolute top-20 right-4 w-80 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-2xl border border-green-700/70 bg-black/75 backdrop-blur-md p-4 text-green-100 shadow-[0_0_30px_rgba(34,255,68,0.15)] z-40">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-lg font-black text-green-300">{count > 1 ? `${count} part dipilih` : sel.label}</div>
          {count > 1 && <div className="text-[11px] text-cyan-300">Utama: {sel.label} · perubahan diterapkan ke semua</div>}
          <div className="text-[11px] text-green-200/60">ID: {sel.id} · Sisi: {sel.side}</div>
        </div>
        <button onClick={onClose} className="text-green-400 hover:text-white text-xl leading-none">×</button>
      </div>

      {sel.hasMirror && (
        <label className="flex items-center gap-2 mb-3 text-xs bg-green-950/60 border border-green-800 rounded-lg px-3 py-2 cursor-pointer">
          <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} className="accent-green-400" />
          <span>🪞 Mirror otomatis ke sisi seberang <span className="text-yellow-300">(kotak kuning)</span></span>
        </label>
      )}

      <div className="text-[11px] uppercase tracking-widest text-green-400 mt-2 mb-1">📍 Letak</div>
      <div className="space-y-1">
        <Row label="Kiri-Kanan" value={a.p[0]} min={-3} max={3} step={0.01} onChange={setP(0)} reset={0} />
        <Row label="Atas-Bawah" value={a.p[1]} min={-3} max={3} step={0.01} onChange={setP(1)} reset={0} />
        <Row label="Maju-Mundur" value={a.p[2]} min={-3} max={3} step={0.01} onChange={setP(2)} reset={0} />
      </div>

      <div className="text-[11px] uppercase tracking-widest text-pink-400 mt-3 mb-1">🎯 Titik Poin Putar <span className="normal-case text-pink-300/70">(bola merah)</span></div>
      <div className="text-[10px] text-green-200/50 mb-1">Default = tengah massa part. Geser untuk ubah poros putar.</div>
      <div className="space-y-1">
        <Row label="Naik-Turun" value={v[1]} min={-3} max={3} step={0.01} onChange={setV(1)} reset={0} />
        <Row label="Kiri-Kanan" value={v[0]} min={-3} max={3} step={0.01} onChange={setV(0)} reset={0} />
        <Row label="Maju-Mundur" value={v[2]} min={-3} max={3} step={0.01} onChange={setV(2)} reset={0} />
      </div>

      <div className="text-[11px] uppercase tracking-widest text-green-400 mt-3 mb-1">📐 Angle / Kemiringan (°)</div>
      <div className="space-y-1">
        <Row label="Angguk (X)" value={a.r[0]} min={-180} max={180} step={1} onChange={setR(0)} reset={0} />
        <Row label="Putar (Y)" value={a.r[1]} min={-180} max={180} step={1} onChange={setR(1)} reset={0} />
        <Row label="Miring (Z)" value={a.r[2]} min={-180} max={180} step={1} onChange={setR(2)} reset={0} />
      </div>

      <div className="text-[11px] uppercase tracking-widest text-green-400 mt-3 mb-1">📏 Ukuran & Panjang</div>
      <div className="space-y-1">
        <Row label="Ukuran" value={a.u} min={0.2} max={3} step={0.01} onChange={(val) => update((x) => { x.u = val; return x; })} reset={1} />
        <Row label="Lebar" value={a.s[0]} min={0.1} max={3} step={0.01} onChange={setS(0)} reset={1} />
        <Row label="Panjang" value={a.s[1]} min={0.1} max={3} step={0.01} onChange={setS(1)} reset={1} />
        <Row label="Tebal" value={a.s[2]} min={0.1} max={3} step={0.01} onChange={setS(2)} reset={1} />
      </div>

      <div className="text-[11px] uppercase tracking-widest text-green-400 mt-3 mb-1">🌙 Lengkung</div>
      <div className="space-y-1">
        <Row label="Horizontal" value={bd[0]} min={-1} max={1} step={0.01} onChange={setB(0)} reset={0} />
        <Row label="Vertikal" value={bd[1]} min={-1} max={1} step={0.01} onChange={setB(1)} reset={0} />
      </div>

      <button onClick={onReset} className="mt-4 w-full rounded-lg border border-red-700/70 bg-red-950/40 py-1.5 text-xs font-bold text-red-200 hover:bg-red-900/50">
        Reset part ini
      </button>
      {onDelete && (
        <button onClick={onDelete} className="mt-2 w-full rounded-lg border border-red-600 bg-red-700/40 py-1.5 text-xs font-bold text-white hover:bg-red-600/60">
          🗑️ Hapus {count > 1 ? `${count} part` : 'part ini'} {mirror && sel.hasMirror ? '(+ mirror)' : ''} · tombol Delete
        </button>
      )}
    </div>
  );
}
