// Default part adjustments (from user's exported data)
type N3 = [number, number, number];
const P = (id: string, part: string, mirror: boolean, letak: N3, kemiringan_deg: N3 = [0, 0, 0], skala_xyz: N3 = [1, 1, 1], ukuran = 1, titik_poin: N3 = [0, 0, 0]) =>
  ({ id, part, mirror, letak, kemiringan_deg, skala_xyz, ukuran, titik_poin, lengkung: [0, 0] as [number, number] });
// head parts raised by 0.45
const H = (id: string, part: string, mirror: boolean) => P(id, part, mirror, [0, 0.45, 0]);

export const ZEUS_PRESET = {
  model: 'Zeus Real Steel',
  version: 1,
  parts: [
    P('p74', 'Dada #24', true, [0, 0, 0], [0, 0, 27]),
    P('p91', 'Bahu #2', true, [0, 0, 0], [0, 180, 43]),
    P('p92', 'Bahu #3', true, [0.12, 0.32, 0], [0, 0, -21], [1, 1, 1], 0.88, [-0.08, -0.21, 0]),
    P('p79', 'Dada #25', false, [0, 0, -0.41], [19, 0, 0]),
    P('p83', 'Dada #29', true, [0, 0, -0.41], [15, 0, 0]),
    P('p84', 'Dada #28', true, [0, 0, -0.34], [19, 0, 0]),
    P('p69', 'Dada #19', true, [0, 0, 0], [0, 0, 0], [1, 1, 1], 1, [0, -0.08, 0]),
    P('p80', 'Dada #26', false, [0, 0, -0.08], [11, 0, 0]),
    P('p81', 'Dada #27', false, [0, 0, 0], [7, 0, 0]),
    P('p86', 'Dada #30', false, [0, 0, 0.19], [-13, 0, 0], [1, 1, 1], 0.94, [0, -0.61, 0]),
    P('p44', 'Dada #1', false, [0, -0.08, -0.14], [0, 0, 0], [1.22, 0.97, 0.94], 1.01, [0, -0.21, 0]),
    P('p71', 'Dada #21', true, [0, -0.08, 0.39], [0, 0, 0], [1.13, 1, 1]),
    P('p73', 'Dada #23', true, [0, -0.28, 0], [0, 7, -25]),
    H('p34', 'Kepala #21', true),
    H('p9', 'Kepala #7', false),
    H('p35', 'Kepala #22', false),
    H('p24', 'Kepala #19', true),
    H('p18', 'Kepala #13', false),
    H('p17', 'Kepala #12', false),
    H('p12', 'Kepala #10', true),
    H('p16', 'Kepala #11', false),
    H('p23', 'Kepala #18', true),
    H('p20', 'Kepala #15', true),
    H('p25', 'Kepala #20', true),
    P('p43', 'Kepala #30', false, [0, 0.324, 0]),
    H('p6', 'Kepala #5', true),
    H('p8', 'Kepala #6', false),
    H('p38', 'Kepala #25', false),
    H('p40', 'Kepala #27', false),
    H('p37', 'Kepala #24', false),
    H('p36', 'Kepala #23', false),
    H('p41', 'Kepala #28', false),
    H('p42', 'Kepala #29', false),
    H('p11', 'Kepala #9', true),
    P('p10', 'Kepala #8', true, [0, 0.25, 0.12]),
  ],
  groups: {
    'Grup 1': ['p4', 'p1', 'p0'],
    'Grup 3': ['p10', 'p11', 'p38', 'p24', 'p35', 'p40', 'p37', 'p16', 'p36', 'p33', 'p41', 'p42', 'p28', 'p31', 'p26', 'p23', 'p20', 'p43', 'p6', 'p8', 'p34', 'p25', 'p9', 'p17', 'p18', 'p12'],
  } as Record<string, string[]>,
  tema: '#22ff44',
  dihapus: [] as string[],
};
