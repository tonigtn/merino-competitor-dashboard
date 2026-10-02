(() => {
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}, html = "") => { const e = document.createElement(tag); for (const k in attrs) e.setAttribute(k, attrs[k]); e.innerHTML = html; return e; };
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const col = b => `var(--b-${b.id})`;
const byId = Object.fromEntries(BRANDS.map(b => [b.id, b]));
const LAST = MONTHS.length - 1, YEAR_AGO = MONTHS.indexOf("2025-08");
const fmt = n => n == null ? "–" : n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, "") + "M" : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, "") + "K" : String(Math.round(n));
const usd = n => "$" + fmt(n);
const pct = (n, d = 0) => (n * 100).toFixed(d) + "%";
const sum = o => Object.values(o).reduce((a, b) => a + b, 0);
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

BRANDS.forEach(b => {
  b.visits = b.traffic[LAST];
  b.yoy = b.traffic[YEAR_AGO] ? b.visits / b.traffic[YEAR_AGO] - 1 : null;
  b.videoShare = b.ads ? b.mix.video / b.ads : null;
  b.presellShare = b.ads ? b.lpMix.presell / sum(b.lpMix) : null;
  b.intensity = b.ads / (b.visits / 1e4);
  b.peak = Math.max(...b.traffic.filter(Boolean));
});

const state = { active: new Set(BRANDS.map(b => b.id)), trafficMode: "log", profile: "mt", sort: { key: "ads", dir: -1 } };
const shown = () => BRANDS.filter(b => state.active.has(b.id));

/* ---------- tooltip ---------- */
const tip = $("#tip");
const showTip = (e, html) => { tip.innerHTML = html; tip.style.opacity = 1; const r = tip.getBoundingClientRect(); let x = e.clientX + 14, y = e.clientY + 14; if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14; if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 14; tip.style.left = Math.max(8, x) + "px"; tip.style.top = Math.max(8, y) + "px"; };
const hideTip = () => { tip.style.opacity = 0; };
const bindTips = root => root.querySelectorAll("[data-tip]").forEach(n => {
  n.addEventListener("pointermove", e => showTip(e, n.dataset.tip));
  n.addEventListener("pointerleave", hideTip);
  n.addEventListener("focus", () => { const r = n.getBoundingClientRect(); showTip({ clientX: r.left + r.width / 2, clientY: r.top }, n.dataset.tip); });
  n.addEventListener("blur", hideTip);
});
const dataTable = (host, head, rows) => {
  host.innerHTML = `<details class="data"><summary>See the numbers</summary><div class="tablewrap"><table><thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details>`;
};

/* ---------- horizontal bars ---------- */
function hbar(host, rows, o = {}) {
  host = typeof host === "string" ? $(host) : host;
  const W = Math.max(280, host.clientWidth), rowH = 30, labW = Math.min(118, W * 0.34), valW = 64;
  const neg = rows.some(r => r.v < 0);
  const max = Math.max(...rows.map(r => Math.abs(r.v || 0)), 1e-9);
  const plotW = W - labW - valW, H = rows.length * rowH + 4;
  const zero = neg ? labW + plotW * 0.32 : labW;
  const scale = neg ? (plotW * 0.68) / Math.max(...rows.map(r => r.v || 0), 1e-9) : plotW / max;
  const nscale = neg ? (plotW * 0.32 - 40) / Math.max(...rows.map(r => -(r.v || 0)), 1e-9) : 0;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || "Bar chart")}">`;
  if (neg) s += `<line x1="${zero}" x2="${zero}" y1="0" y2="${H}" stroke="${css("--axis")}"/>`;
  rows.forEach((r, i) => {
    const y = i * rowH + 5, h = rowH - 12, v = r.v;
    const w = v == null ? 0 : v >= 0 ? Math.max(v * scale, v > 0 ? 2 : 0) : Math.max(-v * nscale, 2);
    const x = v >= 0 || v == null ? zero : zero - w;
    s += `<g tabindex="0" data-tip="<b>${esc(r.name)}</b><br>${esc(r.tip || r.text)}">`;
    s += `<rect x="0" y="${i * rowH}" width="${W}" height="${rowH}" fill="transparent"/>`;
    s += `<text x="0" y="${y + h / 2 + 4}" ${r.focal ? 'class="v"' : ""}>${esc(r.name)}</text>`;
    if (w) s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4" fill="${r.color}"/>`;
    const tx = v == null ? zero : v >= 0 ? zero + w + 6 : zero + 6;
    s += `<text class="${v == null ? "m" : "v"}" x="${tx}" y="${y + h / 2 + 4}">${esc(r.text)}</text></g>`;
  });
  host.innerHTML = s + "</svg>"; bindTips(host);
}
const bars = (host, f, text, o = {}) => {
  let rows = shown().filter(o.filter || (() => true)).map(b => ({ name: b.name, v: f(b), text: text(b), tip: o.tip ? o.tip(b) : null, color: col(b), focal: b.focal }));
  if (o.sort !== false) rows.sort((a, b) => (b.v ?? -Infinity) - (a.v ?? -Infinity));
  hbar(host, rows, o);
};

/* ---------- stacked 100% ---------- */
function stacked(host, legendHost, dataHost, keys, get, o = {}) {
  host = $(host);
  const rows = shown().filter(b => sum(get(b)) > 0);
  const W = Math.max(280, host.clientWidth), rowH = 36, labW = Math.min(118, W * 0.3), totW = 58, plotW = W - labW - totW, H = rows.length * rowH + 22;
  $(legendHost).innerHTML = keys.map(k => `<span><i style="--c:${k.color}"></i>${k.label}</span>`).join("");
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || "")}">`;
  [0, 25, 50, 75, 100].forEach(t => { const x = labW + plotW * t / 100; s += `<line x1="${x}" x2="${x}" y1="0" y2="${H - 18}" stroke="${css("--line")}"/><text class="m" x="${x}" y="${H - 3}" text-anchor="middle">${t}%</text>`; });
  rows.forEach((b, i) => {
    const d = get(b), tot = sum(d), y = i * rowH + 6, h = rowH - 14; let x = labW;
    s += `<text x="0" y="${y + h / 2 + 4}" ${b.focal ? 'class="v"' : ""}>${b.name}</text>`;
    keys.forEach(k => {
      const v = d[k.k] || 0; if (!v) return; const w = plotW * v / tot, p = Math.round(v / tot * 100);
      s += `<g tabindex="0" data-tip="<b>${b.name}</b><br>${k.label}: ${v} ads (${p}%)"><rect x="${x + 1}" y="${y}" width="${Math.max(w - 2, 1)}" height="${h}" rx="3" fill="${k.color}"/>`;
      if (w > 34) s += `<text x="${x + w / 2}" y="${y + h / 2 + 4}" text-anchor="middle" style="fill:${k.ink};font-weight:600">${p}%</text>`;
      s += `</g>`; x += w;
    });
    s += `<text class="m" x="${labW + plotW + 8}" y="${y + h / 2 + 4}">${tot} ads</text>`;
  });
  host.innerHTML = s + "</svg>"; bindTips(host);
  dataTable($(dataHost), ["Brand", ...keys.map(k => k.label), "Total"], rows.map(b => [b.name, ...keys.map(k => get(b)[k.k] || 0), sum(get(b))]));
}

/* ---------- traffic lines ---------- */
function traffic() {
  const host = $("#trafficChart"), mode = state.trafficMode, bs = shown();
  const W = Math.max(300, host.clientWidth), H = Math.min(420, Math.max(300, W * 0.42)), m = { l: 46, r: W < 560 ? 12 : 108, t: 12, b: 28 };
  const pw = W - m.l - m.r, ph = H - m.t - m.b, start = mode === "index" ? YEAR_AGO : 0, n = LAST - start;
  const val = (b, i) => { const v = b.traffic[i]; if (v == null) return null; return mode === "index" ? v / b.traffic[YEAR_AGO] * 100 : v; };
  const all = bs.flatMap(b => b.traffic.map((_, i) => i >= start ? val(b, i) : null)).filter(v => v != null);
  if (!all.length) { host.innerHTML = ""; return; }
  let lo = Math.min(...all), hi = Math.max(...all), yS, ticks;
  if (mode === "log") { const a = Math.log10(lo * 0.85), z = Math.log10(hi * 1.1); yS = v => m.t + ph - (Math.log10(v) - a) / (z - a) * ph; ticks = [1e4, 3e4, 1e5, 3e5, 1e6, 3e6].filter(t => t >= lo * 0.85 && t <= hi * 1.1); }
  else { lo = 0; hi = Math.ceil(hi / 50) * 50; yS = v => m.t + ph - (v - lo) / (hi - lo) * ph; ticks = [0, 50, 100, 150, 200, 250, 300, 350, 400].filter(t => t <= hi); }
  const xS = i => m.l + (i - start) / n * pw;
  $("#trafficCap").innerHTML = mode === "log" ? "Monthly visits<small>Log scale, so small and large brands are readable together</small>" : "Monthly visits, indexed<small>August 2025 = 100 for every brand</small>";
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Monthly visits by brand">`;
  ticks.forEach(t => { s += `<line x1="${m.l}" x2="${m.l + pw}" y1="${yS(t)}" y2="${yS(t)}" stroke="${css(t === 100 && mode === "index" ? "--axis" : "--line")}"/><text class="m" x="${m.l - 8}" y="${yS(t) + 4}" text-anchor="end">${fmt(t)}</text>`; });
  MONTHS.forEach((mo, i) => { if (i < start) return; if (mo.endsWith("-12") || mo.endsWith("-06")) s += `<text class="m" x="${xS(i)}" y="${H - 6}" text-anchor="middle">${mo.endsWith("-12") ? "Dec" : "Jun"} ’${mo.slice(2, 4)}</text>`; if (mo.endsWith("-12")) s += `<line x1="${xS(i)}" x2="${xS(i)}" y1="${m.t}" y2="${m.t + ph}" stroke="${css("--line")}"/>`; });
  const ends = [];
  bs.forEach(b => {
    let d = "", pen = false;
    b.traffic.forEach((_, i) => { if (i < start) return; const v = val(b, i); if (v == null) { pen = false; return; } d += (pen ? "L" : "M") + xS(i).toFixed(1) + " " + yS(v).toFixed(1); pen = true; });
    s += `<path d="${d}" fill="none" stroke="${col(b)}" stroke-width="${b.focal ? 3 : 2}" stroke-linejoin="round" stroke-linecap="round"/>`;
    ends.push({ b, y: yS(val(b, LAST)) });
  });
  if (m.r > 50) { ends.sort((a, b) => a.y - b.y); for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
    ends.forEach(e => { s += `<circle cx="${xS(LAST)}" cy="${yS(val(e.b, LAST))}" r="4" fill="${col(e.b)}" stroke="${css("--surface")}" stroke-width="2"/><text x="${xS(LAST) + 10}" y="${e.y + 4}" ${e.b.focal ? 'class="v"' : ""}>${e.b.name}</text>`; }); }
  s += `<line id="xh" y1="${m.t}" y2="${m.t + ph}" stroke="${css("--axis")}" visibility="hidden"/><g id="xd"></g><rect id="hit" x="${m.l}" y="${m.t}" width="${pw}" height="${ph}" fill="transparent"/></svg>`;
  host.innerHTML = s;
  const hit = $("#hit", host), xh = $("#xh", host), xd = $("#xd", host);
  hit.addEventListener("pointermove", e => {
    const r = hit.getBoundingClientRect(), i = Math.round(start + (e.clientX - r.left) / r.width * n), x = xS(i);
    xh.setAttribute("x1", x); xh.setAttribute("x2", x); xh.setAttribute("visibility", "visible");
    const rows = bs.map(b => ({ b, v: val(b, i), raw: b.traffic[i] })).filter(r => r.v != null).sort((a, b) => b.v - a.v);
    xd.innerHTML = rows.map(r => `<circle cx="${x}" cy="${yS(r.v)}" r="4" fill="${col(r.b)}" stroke="${css("--surface")}" stroke-width="2"/>`).join("");
    const [yy, mm] = MONTHS[i].split("-"); const mn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][+mm - 1];
    showTip(e, `<b>${mn} ${yy}</b><br>` + rows.map(r => `<span style="color:${css("--b-" + r.b.id)}">●</span> ${r.b.name}: <b>${mode === "index" ? Math.round(r.v) : fmt(r.raw)}</b>${mode === "index" ? " (" + fmt(r.raw) + ")" : ""}`).join("<br>"));
  });
  hit.addEventListener("pointerleave", () => { xh.setAttribute("visibility", "hidden"); xd.innerHTML = ""; hideTip(); });
  dataTable($("#trafficData"), ["Month", ...bs.map(b => b.name)], MONTHS.map((mo, i) => [mo, ...bs.map(b => b.traffic[i] == null ? "–" : b.traffic[i].toLocaleString("en-US"))]).reverse());
}

/* ---------- small multiples ---------- */
function minis() {
  const host = $("#minis"); host.innerHTML = "";
  shown().filter(b => b.pageTotal > 20).forEach(b => {
    const card = el("div", { class: "mini" }), peak = Math.max(...b.weeklyRun), now = b.weeklyRun.at(-1), launched = b.weeklyNew.reduce((a, c) => a + c, 0);
    card.innerHTML = `<h4><i style="--c:${col(b)}"></i>${b.name}</h4><p>${now} running now, ${launched.toLocaleString("en-US")} launched since late February</p><div class="plot"></div>`;
    host.appendChild(card);
    const p = $(".plot", card), W = Math.max(200, p.clientWidth), H = 96, n = WEEKS.length - 1, x = i => 2 + i / n * (W - 4), y = v => 16 + (H - 34) * (1 - v / peak);
    const pts = b.weeklyRun.map((v, i) => `${x(i).toFixed(1)} ${y(v).toFixed(1)}`), pi = b.weeklyRun.indexOf(peak);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${b.name} ads running per week"><path d="M${pts.join("L")}L${x(n)} ${H - 18}L${x(0)} ${H - 18}Z" fill="${col(b)}" opacity=".14"/><path d="M${pts.join("L")}" fill="none" stroke="${col(b)}" stroke-width="2" stroke-linejoin="round"/>`;
    s += `<line x1="0" x2="${W}" y1="${H - 18}" y2="${H - 18}" stroke="${css("--axis")}"/><circle cx="${x(pi)}" cy="${y(peak)}" r="3.5" fill="${col(b)}" stroke="${css("--surface")}" stroke-width="2"/><text class="v" x="${Math.min(Math.max(x(pi), 22), W - 22)}" y="11" text-anchor="middle">peak ${peak}</text>`;
    s += `<text class="m" x="0" y="${H - 3}">Mar</text><text class="m" x="${x(14)}" y="${H - 3}" text-anchor="middle">Jun</text><text class="m" x="${W}" y="${H - 3}" text-anchor="end">Oct</text>`;
    b.weeklyRun.forEach((v, i) => { s += `<rect tabindex="0" x="${x(i) - (W / n) / 2}" y="0" width="${W / n}" height="${H - 18}" fill="transparent" data-tip="<b>${b.name}</b>, week of ${WEEKS[i].replace("-", "/")}<br>${v} running, ${b.weeklyNew[i]} launched"/>`; });
    p.innerHTML = s + "</svg>"; bindTips(p);
  });
}

/* ---------- spend ---------- */
function spend() {
  const cpv = +$("#cpv").value, shr = +$("#shr").value, pad = +$("#pad").value;
  $("#cpvO").textContent = "$" + cpv.toFixed(2); $("#shrO").textContent = "×" + shr.toFixed(2); $("#padO").textContent = "$" + pad;
  const rows = shown().filter(b => b.ads > 0).map(b => { const A = b.visits * Math.min(b.paidShare * shr, 0.95) * cpv, B = b.ads * pad * 30; b.spendLo = Math.min(A, B); b.spendHi = Math.max(A, B); return { b, A, B }; }).sort((a, b) => (b.A + b.B) - (a.A + a.B));
  BRANDS.filter(b => !b.ads).forEach(b => { b.spendLo = b.spendHi = 0; });
  const host = $("#spendChart"), W = Math.max(300, host.clientWidth), rowH = 38, labW = Math.min(118, W * 0.3), valW = W < 560 ? 96 : 130, pw = W - labW - valW, H = rows.length * rowH + 24;
  const max = Math.max(...rows.map(r => Math.max(r.A, r.B)), 1), step = [10e3, 25e3, 50e3, 100e3, 250e3, 500e3].find(s => max / s <= 5) || 1e6, xS = v => labW + v / (Math.ceil(max / step) * step) * pw;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Estimated monthly spend range by brand">`;
  for (let t = 0; t <= Math.ceil(max / step) * step; t += step) s += `<line x1="${xS(t)}" x2="${xS(t)}" y1="0" y2="${H - 20}" stroke="${css("--line")}"/><text class="m" x="${xS(t)}" y="${H - 4}" text-anchor="middle">${usd(t)}</text>`;
  rows.forEach((r, i) => {
    const y = i * rowH + rowH / 2 - 2, lo = Math.min(r.A, r.B), hi = Math.max(r.A, r.B);
    s += `<g tabindex="0" data-tip="<b>${r.b.name}</b><br>A, from traffic: ${usd(r.A)} a month<br>B, from live ads: ${usd(r.B)} a month"><rect x="0" y="${i * rowH}" width="${W}" height="${rowH}" fill="transparent"/><text x="0" y="${y + 4}" ${r.b.focal ? 'class="v"' : ""}>${r.b.name}</text>`;
    s += `<line x1="${xS(lo)}" x2="${xS(hi)}" y1="${y}" y2="${y}" stroke="${col(r.b)}" stroke-width="6" stroke-linecap="round" opacity=".35"/><circle cx="${xS(r.A)}" cy="${y}" r="6" fill="${col(r.b)}" stroke="${css("--surface")}" stroke-width="2"/><circle cx="${xS(r.B)}" cy="${y}" r="5" fill="${css("--surface")}" stroke="${col(r.b)}" stroke-width="3"/>`;
    s += `<text class="v" x="${labW + pw + 10}" y="${y + 4}">${usd(lo)}–${usd(hi)}</text></g>`;
  });
  host.innerHTML = s + "</svg>"; bindTips(host);
  dataTable($("#spendData"), ["Brand", "A: from traffic", "B: from live ads", "Visits", "Assumed paid share", "Live ads"], rows.map(r => [r.b.name, usd(r.A), usd(r.B), fmt(r.b.visits), pct(Math.min(r.b.paidShare * shr, 0.95)), r.b.ads]));
  scoreboard();
}

/* ---------- scoreboard ---------- */
const COLS = [
  ["visits", "Monthly visits", b => fmt(b.visits)],
  ["yoy", "vs a year ago", b => b.yoy == null ? "–" : `<span class="${b.yoy >= 0 ? "up" : "down"}">${b.yoy >= 0 ? "▲" : "▼"} ${pct(Math.abs(b.yoy))}</span>`],
  ["ads", "Live Meta ads", b => b.ads],
  ["new30", "New in 30 days", b => b.new30],
  ["videoShare", "Video share", b => b.videoShare == null ? "–" : pct(b.videoShare)],
  ["medianDays", "Median ad age", b => b.medianDays == null ? "–" : b.medianDays + " days"],
  ["presellShare", "Ads to a dedicated page", b => b.presellShare == null ? "–" : pct(b.presellShare)],
  ["gActive", "Live Google ads", b => b.google.active],
  ["spendHi", "Est. monthly spend", b => b.ads ? `${usd(b.spendLo)}–${usd(b.spendHi)}` : "none seen"]
];
function scoreboard() {
  const t = $("#score"), { key, dir } = state.sort, get = (b, k) => k === "gActive" ? b.google.active : b[k];
  const rows = shown().slice().sort((a, b) => ((get(a, key) ?? -1) - (get(b, key) ?? -1)) * dir);
  t.innerHTML = `<thead><tr><th>Brand</th>${COLS.map(c => `<th ${c[0] === key ? `aria-sort="${dir < 0 ? "descending" : "ascending"}"` : ""}><button data-k="${c[0]}">${c[1]}</button></th>`).join("")}</tr></thead><tbody>` +
    rows.map(b => `<tr class="${b.focal ? "focal" : ""}"><td><span class="bn" style="--c:${col(b)}"><i></i>${b.name}</span></td>${COLS.map(c => `<td>${c[2](b)}</td>`).join("")}</tr>`).join("") + "</tbody>";
  t.querySelectorAll("button").forEach(btn => btn.onclick = () => { const k = btn.dataset.k; state.sort = { key: k, dir: state.sort.key === k ? -state.sort.dir : -1 }; scoreboard(); });
}

/* ---------- static tables ---------- */
function tables() {
  const bs = shown();
  $("#offerTable").innerHTML = `<thead><tr><th>Brand</th><th style="text-align:left">Funnel</th><th style="text-align:left">Offer in market</th><th style="text-align:left">Price point</th></tr></thead><tbody>` + bs.map(b => `<tr class="${b.focal ? "focal" : ""}"><td><span class="bn" style="--c:${col(b)}"><i></i>${b.name}</span></td><td style="text-align:left;white-space:normal;min-width:240px">${b.funnel}</td><td style="text-align:left;white-space:normal;min-width:260px">${b.offer}</td><td style="text-align:left;white-space:normal;min-width:170px">${b.price}</td></tr>`).join("") + "</tbody>";
  $("#targetTable").innerHTML = `<thead><tr><th>Brand</th><th style="text-align:left">Countries targeted on Meta</th><th style="text-align:left">Visitors by country</th><th>Google ads using retargeting</th><th>EU/UK reach</th></tr></thead><tbody>` + bs.map(b => `<tr class="${b.focal ? "focal" : ""}"><td><span class="bn" style="--c:${col(b)}"><i></i>${b.name}</span></td><td style="text-align:left;white-space:normal;min-width:220px">${b.targetGeo}</td><td style="text-align:left;white-space:normal;min-width:200px">${b.countries.slice(0, 3).map(c => `${c[0]} ${c[1]}%`).join(", ")}</td><td>${b.google.total > 5 ? b.google.retargetPct + "%" : "–"}</td><td>${b.eu ? fmt(b.eu.reach) : "none"}</td></tr>`).join("") + "</tbody>";
}

/* ---------- angle matrix ---------- */
function matrix() {
  const bs = ANGLE_BRANDS.filter(id => state.active.has(id));
  $("#matrix").innerHTML = `<thead><tr><th>Message</th>${bs.map(id => `<th><span class="bn" style="--c:var(--b-${id})"><i></i>${byId[id].name}</span></th>`).join("")}<th>Brands using it</th></tr></thead><tbody>` +
    ANGLES.map(a => { const vals = bs.map(id => a[2 + ANGLE_BRANDS.indexOf(id)]); return `<tr><td><b>${a[0]}</b><small>${a[1]}</small></td>${vals.map(v => `<td>${v ? `<i class="dot d${v}" title="${["", "mentions it", "uses it often", "leads with it"][v]}"></i>` : `<span class="none" aria-label="not used">·</span>`}</td>`).join("")}<td>${vals.filter(v => v >= 2).length} of ${bs.length}</td></tr>`; }).join("") + "</tbody>";
}

/* ---------- maps ---------- */
function scatter(host, pts, o) {
  host = $(host); const W = Math.max(280, host.clientWidth), H = Math.min(W * 0.82, 400), m = { l: 30, r: 16, t: 22, b: 40 }, pw = W - m.l - m.r, ph = H - m.t - m.b;
  const x = v => m.l + v / 100 * pw, y = v => m.t + ph - v / 100 * ph;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${o.label}">`;
  if (o.zone) s += `<rect x="${x(o.zone[0])}" y="${y(o.zone[3])}" width="${x(o.zone[2]) - x(o.zone[0])}" height="${y(o.zone[1]) - y(o.zone[3])}" rx="10" fill="${css("--b-mt")}" opacity=".09"/><text x="${x((o.zone[0] + o.zone[2]) / 2)}" y="${y(o.zone[4] ?? (o.zone[1] + o.zone[3]) / 2)}" text-anchor="middle" style="fill:${css("--b-mt")};font-weight:600">${o.zoneLabel}</text>`;
  s += `<line x1="${x(50)}" x2="${x(50)}" y1="${m.t}" y2="${m.t + ph}" stroke="${css("--line")}"/><line x1="${m.l}" x2="${m.l + pw}" y1="${y(50)}" y2="${y(50)}" stroke="${css("--line")}"/><rect x="${m.l}" y="${m.t}" width="${pw}" height="${ph}" fill="none" stroke="${css("--axis")}" rx="8"/>`;
  s += `<text class="m" x="${m.l}" y="${H - 10}">${o.x[0]}</text><text class="m" x="${m.l + pw}" y="${H - 10}" text-anchor="end">${o.x[1]}</text><text class="m" x="${m.l}" y="12">${o.y[1]}</text><text class="m" transform="translate(12 ${m.t + ph}) rotate(-90)">${o.y[0]}</text>`;
  pts.forEach(p => { const lx = p.x > 72 ? -11 : 11; s += `<g tabindex="0" data-tip="${p.tip.replace(/"/g, "&quot;")}"><circle cx="${x(p.x)}" cy="${y(p.y)}" r="16" fill="transparent"/><circle cx="${x(p.x)}" cy="${y(p.y)}" r="${p.r || 7}" fill="${p.color}" stroke="${css("--surface")}" stroke-width="2"/><text ${p.bold ? 'class="v"' : ""} x="${x(p.x) + lx}" y="${y(p.y) + 4}" text-anchor="${lx < 0 ? "end" : "start"}">${p.label}</text></g>`; });
  host.innerHTML = s + "</svg>"; bindTips(host);
}
function maps() {
  scatter("#mapChart", Object.entries(MAP).filter(([id]) => state.active.has(id)).map(([id, p]) => ({ x: p[0], y: p[1], color: `var(--b-${id})`, label: byId[id].name, bold: byId[id].focal, tip: `<b>${byId[id].name}</b><br>${byId[id].territory}` })),
    { label: "Positioning map", x: ["Brand storytelling", "Direct response"], y: ["Outdoor performance", "Everyday life"], zone: [56, 4, 98, 40], zoneLabel: "Nobody is here" });
  const jit = [[0, 0], [0, 0], [0, 0], [0, 0], [-3, 2], [3, -2], [0, 0], [0, -1]];
  scatter("#subChart", SUBAVATARS.map((a, i) => ({ x: (a[2] - 1) / 4 * 86 + 7 + jit[i][0], y: (a[1] - 1) / 4 * 80 + 8 + jit[i][1] * 3, color: a[5] ? css("--b-mt") : css("--g1"), r: a[5] ? 9 : 7, label: String(i + 1), bold: a[5], tip: `<b>${i + 1}. ${a[0]}</b><br>${a[3]}` })),
    { label: "Sub-avatar opportunity grid", x: ["Few brands talking", "Crowded"], y: ["Mild desire", "Burning desire"], zone: [0, 62, 34, 100, 68], zoneLabel: "Research these first" });
  $("#subList").innerHTML = SUBAVATARS.map((a, i) => `<div class="${a[5] ? "pick" : ""}"><b class="n">${i + 1}</b><p><b>${a[0]}</b><small>${a[3]}. ${a[4]}</small></p></div>`).join("");
}

/* ---------- profiles ---------- */
function profiles() {
  const tabs = $("#tabs"); tabs.innerHTML = "";
  BRANDS.forEach(b => { const t = el("button", { class: "tab", role: "tab", "aria-selected": state.profile === b.id, style: `--c:${col(b)}` }, `<i></i>${b.name}`); t.onclick = () => { state.profile = b.id; profiles(); }; tabs.appendChild(t); });
  const b = byId[state.profile], steps = ["Unaware", "Problem aware", "Solution aware", "Product aware", "Most aware"];
  $("#profile").innerHTML = `<div class="profile" style="--c:${col(b)}">
    <div><dl>
      <dt>Speaks to</dt><dd>${b.avatar}</dd>
      <dt>Awareness level</dt><dd><b>${b.awareness}</b>${b.awarenessIdx == null ? "" : `<div class="ladder">${steps.map(s => `<span>${s}</span>`).join("")}<b style="left:${(b.awarenessIdx + 0.5) / 5 * 100}%"></b></div>`}</dd>
      <dt>Desire, pushed with “so what?”</dt><dd>${b.desire}</dd>
      <dt>Emotional territory</dt><dd>${b.territory}</dd>
      <dt>Mechanism, or “why us”</dt><dd>${b.mechanism}</dd>
      <dt>Proof</dt><dd>${b.proof}</dd>
      <dt>Offer</dt><dd>${b.offer}</dd>
      <dt>Funnel</dt><dd>${b.funnel}</dd>
      <dt>Ad identities</dt><dd>${b.pageNote}</dd>
    </dl></div>
    <div>${b.hooks.length ? `<h3>Hooks and headlines in market</h3><ul class="quotes">${b.hooks.map(h => `<li>${h}</li>`).join("")}</ul>` : `<h3>No ads in market</h3><p class="take" style="margin-top:0">TrendTrack has seen 13 Meta ads from this brand in total, none live.</p>`}
      ${b.lpTop.length ? `<h3 style="margin-top:18px">Most-used landing pages</h3><p class="take" style="margin-top:0">${b.lpTop.map(l => `${l[0]} <span style="color:var(--muted)">(${l[1]} ads)</span>`).join("<br>")}</p>` : ""}</div>
  </div>
  <div class="wf"><div><h3>What works</h3><ul>${b.works.map(w => `<li>${w}</li>`).join("")}</ul></div><div><h3>What fails, or is missing</h3><ul>${b.fails.map(w => `<li>${w}</li>`).join("")}</ul></div></div>`;
}

/* ---------- render ---------- */
function render() {
  const mt = byId.mt, wx = byId.wx;
  bars("#heroBars", b => b.ads, b => b.ads ? String(b.ads) : "none", { label: "Unique live Meta ads by brand", tip: b => `${b.ads} unique live ads (${b.pageLive} counting every variant on its own pages)` });
  $("#findings").innerHTML = [
    [`${Math.round(wx.ads / mt.ads)}×`, `Woolx’s live ad count against Merino Tech’s: ${wx.ads} to ${mt.ads}.`],
    ["0%", `of Merino Tech’s ads are video. Woolx is at ${pct(wx.videoShare)}, Smartwool ${pct(byId.sw.videoShare)}.`],
    [pct(byId.wy.presellShare), "of Woolly’s ads land on a page built for that angle. Merino Tech: none."],
    ["2", "groups with a strong daily pain that no competitor’s ads speak to."]
  ].map(f => `<div><strong>${f[0]}</strong><span>${f[1]}</span></div>`).join("");
  spend(); tables(); traffic(); minis(); matrix(); maps(); profiles();
  bars("#visitBars", b => b.visits, b => fmt(b.visits), { label: "Monthly visits August 2026", tip: b => `${b.visits.toLocaleString("en-US")} visits in Aug 2026. Peak month: ${fmt(b.peak)}` });
  bars("#yoyBars", b => b.yoy, b => b.yoy == null ? "–" : (b.yoy >= 0 ? "+" : "−") + pct(Math.abs(b.yoy)), { label: "Year on year change in visits", tip: b => `${fmt(b.traffic[YEAR_AGO])} in Aug 2025 → ${fmt(b.visits)} in Aug 2026` });
  bars("#newBars", b => b.new30, b => b.ads ? `${b.new30}` : "none", { label: "New ads in 30 days", tip: b => b.ads ? `${b.new30} of ${b.ads} live ads are under 30 days old (${pct(b.new30 / b.ads)}). ${b.new7} started this week.` : "No live ads" });
  bars("#intensityBars", b => b.intensity, b => b.intensity.toFixed(1), { label: "Live ads per 10,000 visits", tip: b => `${b.ads} live ads on ${fmt(b.visits)} monthly visits` });
  bars("#vidBars", b => b.vidMedian, b => b.vidMedian ? b.vidMedian + " sec" : "no video", { label: "Median video length", filter: b => b.ads > 0, tip: b => b.vidMedian ? `${b.mix.video} live video ads, median ${b.vidMedian} seconds` : "No video ads live" });
  bars("#creatorBars", b => b.creatorAds, b => b.creatorAds ? `${b.creatorAds} ads` : "none", { label: "Ads run through creator or publisher identities", filter: b => b.ads > 0, tip: b => b.creatorAds ? `${b.creatorAds} of ${b.ads} live ads. ${b.pageNote}` : "All ads run from the brand’s own page" });
  bars("#googleBars", b => b.google.active, b => b.google.active ? fmt(b.google.active) : "none", { label: "Live Google ads", tip: b => `${b.google.active} live, ${b.google.total} seen in total. Search ${b.google.search}, YouTube ${b.google.youtube}, Shopping ${b.google.shopping}` });
  stacked("#mixChart", "#mixLegend", "#mixData", [
    { k: "video", label: "Video", color: "var(--strong)", ink: "var(--surface)" }, { k: "static", label: "Still image", color: "var(--g1)", ink: "var(--ink)" },
    { k: "carousel", label: "Carousel", color: "var(--g2)", ink: "var(--ink)" }, { k: "catalog", label: "Catalogue (automated)", color: "var(--g3)", ink: "var(--ink)" }], b => b.mix, { label: "Creative format mix" });
  stacked("#ageChart", "#ageLegend", "#ageData", ["Under a week", "8–30 days", "1–3 months", "3–6 months", "Over 6 months"].map((l, i) => ({ k: i, label: l, color: `var(--o${i + 1})`, ink: `var(--oi${i + 1})` })), b => Object.fromEntries(b.buckets.map((v, i) => [i, v])), { label: "Age of live ads" });
  stacked("#lpChart", "#lpLegend", "#lpData", [
    { k: "presell", label: "Dedicated page (education, bundle builder, advertorial)", color: "var(--strong)", ink: "var(--surface)" }, { k: "collection", label: "Collection page", color: "var(--g1)", ink: "var(--ink)" },
    { k: "product", label: "Product page", color: "var(--g2)", ink: "var(--ink)" }, { k: "home", label: "Homepage", color: "var(--g3)", ink: "var(--ink)" }, { k: "other", label: "Other", color: "var(--g3)", ink: "var(--ink)" }], b => b.lpMix, { label: "Landing page type" });
  $("#winnersList").innerHTML = [
    ["Woolx", "wx", "A customer’s review as the headline: “Attractive and Doesn’t Get Sweaty and Stinky.” – Pauline B.", "60 ads, up to 171 days"],
    ["Woolx", "wx", "Scarcity: “Sold Out Every Season — Grab Yours Before They’re Gone”", "64 ads"],
    ["Smartwool", "sw", "Product launch: “New Winterloft™ Jacket”", "48 ads, 8 days old"],
    ["Icebreaker", "ib", "Seasonal collection: “The 2026 hike collection”", "25 ads"],
    ["Merino Tech", "mt", "“Stay Fresh, Stay Active”", "12 ads, up to 375 days"],
    ["Woolly", "wy", "“Plastic traps heat and holds odor.”", "5 ads, plus 4 creator videos at 101 days"]
  ].filter(w => state.active.has(w[1])).map(w => `<li style="--c:var(--b-${w[1]})"><b>${w[0]}.</b> ${w[2]} <span style="color:var(--muted)">${w[3]}</span></li>`).join("");
}

/* ---------- controls ---------- */
const chips = $("#chips");
BRANDS.forEach(b => { const c = el("button", { class: "chip", "aria-pressed": "true", style: `--c:${col(b)}` }, `<i></i>${b.name}`); c.onclick = () => { if (b.focal) return; state.active.has(b.id) ? state.active.delete(b.id) : state.active.add(b.id); c.setAttribute("aria-pressed", state.active.has(b.id)); render(); }; if (b.focal) c.title = "Always shown"; chips.appendChild(c); });
$("#trafficMode").querySelectorAll("button").forEach(btn => btn.onclick = () => { state.trafficMode = btn.dataset.m; $("#trafficMode").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === btn)); traffic(); });
["cpv", "shr", "pad"].forEach(id => $("#" + id).addEventListener("input", spend));
let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(render, 150); });
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);
document.fonts && document.fonts.ready.then(render);
render();
})();
