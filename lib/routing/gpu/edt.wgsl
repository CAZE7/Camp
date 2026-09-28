// Exakte separierbare EDT — GPU-Kern (Mission Stufe 4, WebGPU).
// Paritätsgarantie: identische Semantik wie `squaredEdt2D` in
// lib/routing/geometry/edt.ts (Zeilen-Pass, dann Spalten-Pass; INF-Clamp vor
// der Addition; i32-Differenz quadriert — Wertebereich ≤ EDT_MAX_DIM² < 2³¹).
// TOKEN-SLOT: EDT_MAX_D2=2147483647 — Drift-Guard: gpuEdt.test.ts liest diese
// Zeile und vergleicht gegen das Export aus edt.ts (§5′-5 WGSL-Tooling).
//
// Algorithmus: pro Zielzelle min über alle Quellen der Zeile/Spalte
// ((x−i)² + src[i]) — definitionsgleich zum Felzenszwalb–Huttenlocher-
// Unteren-Envelope in transform1D (Orakel-Parität, §2.2″). Der Sweep ist hier
// als direkte Min-Schleife je Zelle parallelisiert (zwei Dispatches wie
// spezifiziert; Kosten O(W²·H + H²·W) statt O(W·H) — Umsetzungsnote in §2.2″).

struct Dims {
  width : u32,
  height : u32,
  pad0 : u32,
  pad1 : u32,
}

@group(0) @binding(0) var<uniform> dims : Dims;
@group(0) @binding(1) var<storage, read> src : array<u32>;
@group(0) @binding(2) var<storage, read_write> dst : array<u32>;

@compute @workgroup_size(8, 8, 1)
fn edtRowPass(@builtin(global_invocation_id) gid : vec3<u32>) {
  let x = gid.x;
  let y = gid.y;
  if (x >= dims.width || y >= dims.height) {
    return;
  }
  var best = 2147483647u; // TOKEN-SLOT: EDT_MAX_D2=2147483647
  var i = 0u;
  while (i < dims.width) {
    let s = src[y * dims.width + i];
    var cand = 2147483647u; // TOKEN-SLOT: EDT_MAX_D2=2147483647
    if (s < 2147483647u) { // TOKEN-SLOT: EDT_MAX_D2=2147483647
      let dx = i32(x) - i32(i);
      cand = s + u32(dx * dx);
    }
    best = min(best, cand);
    i = i + 1u;
  }
  dst[y * dims.width + x] = best;
}

@compute @workgroup_size(8, 8, 1)
fn edtColPass(@builtin(global_invocation_id) gid : vec3<u32>) {
  let x = gid.x;
  let y = gid.y;
  if (x >= dims.width || y >= dims.height) {
    return;
  }
  var best = 2147483647u; // TOKEN-SLOT: EDT_MAX_D2=2147483647
  var i = 0u;
  while (i < dims.height) {
    let s = src[i * dims.width + x];
    var cand = 2147483647u; // TOKEN-SLOT: EDT_MAX_D2=2147483647
    if (s < 2147483647u) { // TOKEN-SLOT: EDT_MAX_D2=2147483647
      let dy = i32(y) - i32(i);
      cand = s + u32(dy * dy);
    }
    best = min(best, cand);
    i = i + 1u;
  }
  dst[y * dims.width + x] = best;
}
