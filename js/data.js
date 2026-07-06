/**
 * data.js — 地震データ取得・管理モジュール
 * 気象庁(P2P地震情報) / USGS をまとめて使用
 */

window.DataModule = (() => {
  let allQuakes = [];
  let lastId = null;
  let isLoading = false;

  // ===== メインフェッチ =====
  async function fetchAll() {
    if (isLoading) return;
    isLoading = true;
    setStatus('loading');

    try {
      const [p2p, usgs] = await Promise.allSettled([
        fetchP2P(),
        fetchUSGS(),
      ]);

      let quakes = [];
      if (p2p.status === 'fulfilled') quakes = [...quakes, ...p2p.value];

      if (usgs.status === 'fulfilled') {
        const p2pIds = new Set(quakes.map(q => q.id));
        usgs.value.forEach(q => { if (!p2pIds.has(q.id)) quakes.push(q); });
      }

      quakes = dedup(quakes).sort((a, b) => b.time - a.time);

      const filtered = applyFilter(quakes);
      allQuakes = filtered;

      detectNew(filtered);
      render(filtered);
      setStatus('ok');
    } catch (e) {
      console.error('地震データ取得エラー:', e);
      setStatus('error');
    } finally {
      isLoading = false;
    }
  }

  // ===== P2P地震情報 API =====
  async function fetchP2P() {
    const res = await fetch(CONFIG.P2P_API, { cache: 'no-store' });
    if (!res.ok) throw new Error('P2P API error');
    const data = await res.json();

    return data
      .filter(d => d.earthquake && d.issue)
      .map(d => {
        const eq = d.earthquake;
        const hy = eq.hypocenter || {};
        return {
          id:           `p2p-${d.id}`,
          source:       '気象庁(P2P)',
          mag:          parseFloat(eq.magnitude) || 0,
          lat:          parseFloat(hy.latitude),
          lng:          parseFloat(hy.longitude),
          depth:        hy.depth != null ? parseInt(hy.depth) : null,
          place:        hy.name || '不明',
          time:         new Date(eq.time).getTime(),
          maxIntensity: eq.maxScale != null ? scaleLabel(eq.maxScale) : null,
          tsunami:      d.issue?.type === 'Tsunami' ? '津波注意報・警報' : null,
          raw:          d,
        };
      })
      .filter(q => q.mag > 0 && !isNaN(q.lat) && !isNaN(q.lng));
  }

  // ===== USGS API (日本周辺) =====
  async function fetchUSGS() {
    const hours = parseInt(document.getElementById('periodFilter')?.value || '24');
    const startTime = new Date(Date.now() - hours * 3600 * 1000).toISOString();
    const url = `${CONFIG.USGS_API}?format=geojson&starttime=${startTime}&minlatitude=20&maxlatitude=50&minlongitude=120&maxlongitude=155&orderby=time&limit=300`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('USGS API error');
    const data = await res.json();

    return data.features.map(f => {
      const p = f.properties;
      const [lng, lat, depthKm] = f.geometry.coordinates;
      return {
        id:     `usgs-${f.id}`,
        source: 'USGS',
        mag:    parseFloat(p.mag) || 0,
        lat:    parseFloat(lat),
        lng:    parseFloat(lng),
        depth:  depthKm != null ? Math.round(depthKm) : null,
        place:  p.place || '不明',
        time:   p.time,
        maxIntensity: null,
        tsunami: p.tsunami === 1 ? '津波の可能性あり' : null,
        raw: f,
      };
    }).filter(q => q.mag > 0);
  }

  function scaleLabel(s) {
    const map = { 10:'1', 20:'2', 30:'3', 40:'4', 45:'5弱', 50:'5強', 55:'6弱', 60:'6強', 70:'7' };
    return map[s] || String(s);
  }

  function dedup(quakes) {
    const seen = new Set();
    return quakes.filter(q => {
      if (seen.has(q.id)) return false;
      seen.add(q.id);
      return true;
    });
  }

  function applyFilter(quakes) {
    const minMag = parseFloat(document.getElementById('magFilter')?.value || '0');
    const hours  = parseInt(document.getElementById('periodFilter')?.value || '24');
    const cutoff = Date.now() - hours * 3600 * 1000;
    return quakes.filter(q => q.mag >= minMag && q.time >= cutoff);
  }

  // ===== 新着検知 → Bot通知・緊急アラート連携 =====
  function detectNew(quakes) {
    if (!quakes.length) return;
    const latest = quakes[0];
    if (latest.id === lastId) return;

    if (lastId !== null) {
      window.BotModule?.onNewQuake(latest);
      window.AlertsModule?.onNewQuake(latest);

      if (latest.mag >= CONFIG.BOT.ALERT_MAG_BANNER) {
        const banner = document.getElementById('alertBanner');
        const text   = document.getElementById('alertBannerText');
        if (banner && text) {
          text.textContent = `🚨 M${latest.mag.toFixed(1)} ${latest.place} 深さ${latest.depth != null ? latest.depth+'km' : '不明'}`;
          banner.style.display = 'flex';
          setTimeout(() => { banner.style.display = 'none'; }, 15000);
        }
      }
    }
    lastId = latest.id;
  }

  function render(quakes) {
    window.MapModule?.drawQuakes(quakes);
    updateList(quakes);
    updateLatest(quakes[0]);
    updateHeader(quakes);
    window.ChartModule?.update(quakes);
  }

  function updateList(quakes) {
    const el = document.getElementById('quakeList');
    const cnt = document.getElementById('quakeListCount');
    if (!el) return;
    if (cnt) cnt.textContent = `${quakes.length}件`;

    if (!quakes.length) {
      el.innerHTML = '<div class="loading-pulse">データなし（フィルター条件を確認してください）</div>';
      return;
    }

    el.innerHTML = quakes.slice(0, 150).map(q => `
      <div class="quake-item" onclick="DataModule.focusAndShow('${q.id}')">
        <div class="qi-mag" style="color:${CONFIG.MAG_COLOR(q.mag)}">M${q.mag.toFixed(1)}</div>
        <div class="qi-info">
          <div class="qi-place">${escapeHtml(q.place)}</div>
          <div class="qi-row">
            深さ ${q.depth != null ? q.depth+'km' : '不明'} ／ ${formatAgo(q.time)}前${q.tsunami ? ' 🌊' : ''}
          </div>
        </div>
        <div class="qi-scale">
          ${q.maxIntensity ? `<span class="qi-scale-badge ${scaleClass(q.maxIntensity)}">${q.maxIntensity}</span>` : ''}
        </div>
      </div>
    `).join('');
  }

  function updateLatest(q) {
    const el = document.getElementById('latestQuakeInfo');
    if (!el) return;
    if (!q) { el.innerHTML = '<div class="loading-pulse">該当データなし</div>'; return; }
    const magClass = q.mag >= 7 ? 'm7' : q.mag >= 6 ? 'm6' : q.mag >= 5 ? 'm5' : q.mag >= 4 ? 'm4' : q.mag >= 3 ? 'm3' : 'm2';
    el.innerHTML = `
      <div class="lq-mag ${magClass}">M${q.mag.toFixed(1)}</div>
      <div class="lq-place">${escapeHtml(q.place)}</div>
      <div class="lq-row">深さ <span>${q.depth != null ? q.depth+'km' : '不明'}</span></div>
      ${q.maxIntensity ? `<div class="lq-row">最大震度 <span>${q.maxIntensity}</span></div>` : ''}
      <div class="lq-row">情報源 <span>${q.source}</span></div>
      <div class="lq-time">${MapModule.formatTime(q.time)}</div>
      ${q.tsunami ? `<div class="lq-tsunami">🌊 ${q.tsunami}</div>` : ''}
    `;
  }

  function updateHeader(quakes) {
    const now = Date.now();
    const today = quakes.filter(q => q.time >= now - 86400000).length;
    const el1 = document.getElementById('todayCount');
    const el2 = document.getElementById('monthCount');
    if (el1) el1.textContent = today;
    if (el2) el2.textContent = quakes.length;
  }

  function focusAndShow(id) {
    const q = allQuakes.find(q => q.id === id);
    if (!q) return;
    if (q.lat != null && q.lng != null) window.MapModule?.focusQuake(q.lat, q.lng, q.mag);
    showModal(q);
  }

  function scaleClass(s) {
    const m = { '7':'s7','6強':'s6p','6弱':'s6m','5強':'s5p','5弱':'s5m','4':'s4','3':'s3','2':'s2','1':'s1' };
    return m[s] || 's1';
  }

  function formatAgo(ts) {
    const sec = Math.floor((Date.now() - ts) / 1000);
    if (sec < 60)    return `${sec}秒`;
    if (sec < 3600)  return `${Math.floor(sec/60)}分`;
    if (sec < 86400) return `${Math.floor(sec/3600)}時間`;
    return `${Math.floor(sec/86400)}日`;
  }

  function setStatus(state) {
    const dot  = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    if (state === 'loading') {
      if (dot)  dot.className = 'status-dot warning';
      if (text) text.textContent = '更新中...';
    } else if (state === 'ok') {
      if (dot)  dot.className = 'status-dot';
      if (text) text.textContent = '監視中 — ' + new Date().toLocaleTimeString('ja-JP');
    } else {
      if (dot)  dot.className = 'status-dot danger';
      if (text) text.textContent = 'エラー: 再試行中...';
    }
  }

  function redraw() { render(allQuakes); }
  function getQuakes() { return allQuakes; }

  function getStats() {
    const hours = parseInt(document.getElementById('periodFilter')?.value || '24');
    const cutoff = Date.now() - hours * 3600 * 1000;
    const q = allQuakes.filter(x => x.time >= cutoff);
    return {
      count24h:  q.length,
      maxMag:    q.length ? Math.max(...q.map(x => x.mag)).toFixed(1) : '-',
      avgDepth:  q.filter(x=>x.depth!=null).length ? Math.round(q.filter(x=>x.depth!=null).reduce((s,x)=>s+x.depth,0)/q.filter(x=>x.depth!=null).length) + 'km' : '-',
      tsCount:   q.filter(x => x.tsunami).length,
      hourly:    buildHourly(q),
      magDist:   buildMagDist(q),
      depthDist: buildDepthDist(q),
    };
  }

  function buildHourly(quakes) {
    const buckets = Array(24).fill(0);
    const now = Date.now();
    quakes.forEach(q => {
      const h = Math.floor((now - q.time) / 3600000);
      if (h < 24) buckets[23 - h]++;
    });
    return buckets;
  }

  function buildMagDist(quakes) {
    const b = { '1-2':0, '2-3':0, '3-4':0, '4-5':0, '5-6':0, '6+':0 };
    quakes.forEach(q => {
      if (q.mag < 2)      b['1-2']++;
      else if (q.mag < 3) b['2-3']++;
      else if (q.mag < 4) b['3-4']++;
      else if (q.mag < 5) b['4-5']++;
      else if (q.mag < 6) b['5-6']++;
      else                b['6+']++;
    });
    return b;
  }

  function buildDepthDist(quakes) {
    const b = { '0-10':0, '10-30':0, '30-60':0, '60-100':0, '100+':0 };
    quakes.forEach(q => {
      const d = q.depth || 0;
      if (d < 10)        b['0-10']++;
      else if (d < 30)   b['10-30']++;
      else if (d < 60)   b['30-60']++;
      else if (d < 100)  b['60-100']++;
      else               b['100+']++;
    });
    return b;
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { fetchAll, applyFilter, redraw, getQuakes, focusAndShow, getStats };
})();

// ===== 地震詳細モーダル（UIModule 経由、または直接表示） =====
function showModal(q) {
  // UIModule.showQuakeDetail が存在すればそちらを優先（3D地球儀ピンクリックと共通）
  if (window.UIModule?.showQuakeDetail) { window.UIModule.showQuakeDetail(q); return; }

  const overlay = document.getElementById('modalOverlay');
  const header  = document.getElementById('modalHeader');
  const body    = document.getElementById('modalBody');
  if (!overlay || !header || !body || !q) return;

  const color = CONFIG.MAG_COLOR(q.mag);

  header.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;">
      <div style="font-family:var(--mono);font-size:40px;font-weight:700;color:${color}">M${q.mag.toFixed(1)}</div>
      <div>
        <div style="font-size:16px;font-weight:700;">${escHtml(q.place)}</div>
        <div style="font-size:11px;color:var(--text-2);margin-top:2px;">${MapModule.formatTime(q.time)}</div>
      </div>
    </div>
  `;

  const rows = [
    ['震源地', q.place || '不明'],
    ['マグニチュード', `M${q.mag.toFixed(1)}`],
    ['震源深さ', q.depth != null ? `${q.depth} km` : '不明'],
    ['最大震度', q.maxIntensity || '情報なし'],
    ['発生日時', MapModule.formatTime(q.time)],
    ['情報源', q.source || '不明'],
    ['津波情報', q.tsunami || 'なし'],
    ['緯度/経度', (q.lat != null && q.lng != null) ? `${q.lat.toFixed(3)}°N, ${q.lng.toFixed(3)}°E` : '不明'],
  ];

  body.innerHTML = rows.map(([k, v]) => `
    <div class="modal-row"><span class="modal-key">${k}</span><span class="modal-val">${escHtml(String(v))}</span></div>
  `).join('');

  if (q.tsunami) {
    body.innerHTML += `<div style="margin-top:12px;padding:10px;background:rgba(232,93,58,0.1);border:1px solid var(--accent);border-radius:6px;font-size:12px;color:var(--accent);">🌊 ${escHtml(q.tsunami)} — 沿岸部では安全な場所へ避難してください</div>`;
  }

  if (q.lat != null && q.lng != null) {
    body.innerHTML += `
      <button onclick="MapModule.focusQuake(${q.lat},${q.lng},${q.mag});closeModal();"
        style="margin-top:12px;width:100%;padding:8px;background:var(--blue);border:none;border-radius:6px;color:#fff;font-size:12px;cursor:pointer;">
        🗺️ 地図で確認
      </button>
    `;
  }

  overlay?.classList.add("open")
}

function closeModal(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('modalOverlay')?.classList.remove('open');
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
