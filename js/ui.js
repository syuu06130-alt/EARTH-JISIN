/**
 * ui.js — UI操作モジュール
 * タブ・フィルター・時計・大画面モード
 * ★追加: マグニチュード→推定震度の併記フィルター
 * ★追加: 衛星モード「地名表示」ボタン連携
 * ★追加: showQuakeDetail() — ピンクリックでモーダル表示
 */

window.UIModule = (() => {

  function init() {
    bindTabs();
    bindFilter();
    startClock();
    bindRefresh();
    bindBigScreen();
    bindAlertPanelToggle();
  }

  /* ══════════════════════════════════════════
     タブ切替
  ══════════════════════════════════════════ */
  function bindTabs() {
    document.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById('tab-' + target)?.classList.add('active');
        if (target === 'stats')   window.ChartModule?.update(window.DataModule?.getQuakes() || []);
        if (target === 'news')    window.NewsModule?.fetch();
        if (target === 'history') window.HistoryModule?.render();
      });
    });
  }

  /* ══════════════════════════════════════════
     フィルター（マグニチュード＋推定震度を連動表示）
  ══════════════════════════════════════════ */
  function bindFilter() {
    const slider   = document.getElementById('magFilter');
    const magValEl = document.getElementById('magVal');
    const intValEl = document.getElementById('intensityVal');

    function updateFilterDisplay() {
      if (!slider) return;
      const m = parseFloat(slider.value);
      if (magValEl) magValEl.textContent = m.toFixed(1);

      // 推定震度表示（ヘッダーヒント + バッジ両方更新）
      if (CONFIG.MAG_TO_INTENSITY) {
        const intensity = CONFIG.MAG_TO_INTENSITY(m);
        if (intValEl) intValEl.textContent = m > 0 ? `推定震度 ${intensity}` : '';
        const badge = document.getElementById('intensityBadge');
        if (badge) {
          badge.textContent = m > 0 ? `震度 ${intensity}` : '';
          const col = CONFIG.MAG_COLOR ? CONFIG.MAG_COLOR(m) : '#4fc3f7';
          badge.style.borderColor = col;
          badge.style.color       = col;
        }
      }

      // スライダーの目盛りヒントを震度ステップに合わせて色変え
      updateSliderTrack(slider, m);
    }

    slider?.addEventListener('input', updateFilterDisplay);
    updateFilterDisplay(); // 初期表示

    document.getElementById('applyFilter')?.addEventListener('click', () => {
      window.DataModule?.fetchAll();
    });

    document.getElementById('refreshInterval')?.addEventListener('change', e => {
      window.AppModule?.setRefreshInterval(parseInt(e.target.value));
    });

    // 深さフィルターを追加（存在する場合）
    const depthSlider = document.getElementById('depthFilter');
    const depthValEl  = document.getElementById('depthVal');
    depthSlider?.addEventListener('input', () => {
      if (depthValEl) depthValEl.textContent = depthSlider.value + ' km';
    });
  }

  /* スライダーの背景グラデーションをMとともに更新（震度段階で色が変わる） */
  function updateSliderTrack(slider, m) {
    const colors = [
      { m:0,   c:'#4fc3f7' },
      { m:1.8, c:'#4fc3f7' },
      { m:2.8, c:'#00e5ff' },
      { m:3.7, c:'#7fff00' },
      { m:4.5, c:'#ffff00' },
      { m:5.2, c:'#ffa500' },
      { m:5.8, c:'#ff6900' },
      { m:6.4, c:'#ff2800' },
      { m:7.0, c:'#e50000' },
      { m:7.7, c:'#9b0000' },
    ];
    const max = parseFloat(slider.max || '9');
    const pct = ((m - parseFloat(slider.min || '0')) / (max - parseFloat(slider.min || '0'))) * 100;

    // 現在値に合ったアクセントカラーを取得
    let col = '#4fc3f7';
    for (const step of colors) { if (m >= step.m) col = step.c; }

    // CSS カスタムプロパティで上書き
    slider.style.setProperty('--track-fill', col);
    slider.style.setProperty('--track-pct', pct + '%');

    // accent-color でブラウザネイティブつまみの色変更
    slider.style.accentColor = col;
  }

  /* ══════════════════════════════════════════
     リアルタイム時計
  ══════════════════════════════════════════ */
  function startClock() {
    const tick = () => {
      const el = document.getElementById('liveTime');
      if (el) {
        el.textContent = new Date().toLocaleString('ja-JP', {
          timeZone: 'Asia/Tokyo',
          year:'numeric', month:'2-digit', day:'2-digit',
          hour:'2-digit', minute:'2-digit', second:'2-digit',
        }) + ' JST';
      }
    };
    tick();
    setInterval(tick, 1000);
  }

  /* ══════════════════════════════════════════
     更新ボタン
  ══════════════════════════════════════════ */
  function bindRefresh() {
    document.getElementById('refreshBtn')?.addEventListener('click', async () => {
      const btn = document.getElementById('refreshBtn');
      if (btn) { btn.classList.add('spinning'); btn.disabled = true; }
      await window.DataModule?.fetchAll();
      if (btn) { btn.classList.remove('spinning'); btn.disabled = false; }
    });
  }

  /* ══════════════════════════════════════════
     大画面モード切替
  ══════════════════════════════════════════ */
  function bindBigScreen() {
    const panel  = document.getElementById('bigscreenPanel');
    const toggle = document.getElementById('bigScreenToggle');
    const close  = document.getElementById('bigscreenClose');

    toggle?.addEventListener('click', () => {
      panel?.classList.add('show');
      toggle.classList.add('active');
      window.MapModule?.initBigMap();
    });

    close?.addEventListener('click', () => {
      panel?.classList.remove('show');
      toggle?.classList.remove('active');
    });
  }

  /* ══════════════════════════════════════════
     アラート設定パネル
  ══════════════════════════════════════════ */
  function bindAlertPanelToggle() {
    document.getElementById('alertToggle')?.addEventListener('click', function() {
      this.classList.toggle('active');
      document.querySelector('.tab[data-tab="bot"]')?.click();
    });
  }

  /* ══════════════════════════════════════════
     地震ピンクリックのモーダル詳細表示
  ══════════════════════════════════════════ */
  function showQuakeDetail(q) {
    const modal = document.getElementById('quakeModal') || createModal();
    const mag   = q.mag != null ? q.mag.toFixed(1) : '?';
    const magCls = CONFIG.MAG_COLOR ? CONFIG.MAG_COLOR(q.mag) : '#fff';
    const intensity = CONFIG.MAG_TO_INTENSITY ? CONFIG.MAG_TO_INTENSITY(q.mag) : '';
    const depth = q.depth != null ? q.depth + ' km' : '不明';
    const time  = window.MapModule?.formatTime(q.time) || (q.time ? new Date(q.time).toLocaleString('ja-JP') : '不明');

    modal.querySelector('#modalContent').innerHTML = `
      <div class="popup-mag" style="color:${magCls}">M ${mag}</div>
      ${intensity ? `<div style="font-size:12px;color:var(--text-2);margin:2px 0">推定震度: <strong style="color:${magCls}">${intensity}</strong></div>` : ''}
      <div class="popup-place">${escHtml(q.place || '場所不明')}</div>
      <div class="popup-row">深さ: <span>${escHtml(depth)}</span></div>
      <div class="popup-row">時刻: <span>${escHtml(time)}</span></div>
      ${q.source ? `<div class="popup-row">情報源: <span>${escHtml(q.source)}</span></div>` : ''}
      ${q.tsunami ? '<div class="lq-tsunami">🚨 津波情報あり</div>' : ''}
    `;
    modal.style.display = 'flex';
  }

  function createModal() {
    const div = document.createElement('div');
    div.id = 'quakeModal';
    div.style.cssText = `
      display:none; position:fixed; inset:0; z-index:9999;
      background:rgba(0,0,0,0.6); align-items:center; justify-content:center;
    `;
    div.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;
                  padding:20px 24px;min-width:240px;max-width:340px;position:relative;box-shadow:var(--shadow)">
        <button id="modalClose" style="position:absolute;top:10px;right:12px;background:none;border:none;
                color:var(--text-3);font-size:18px;cursor:pointer;line-height:1">✕</button>
        <div id="modalContent"></div>
      </div>`;
    document.body.appendChild(div);
    div.addEventListener('click', e => { if (e.target === div) div.style.display='none'; });
    div.querySelector('#modalClose')?.addEventListener('click', () => { div.style.display='none'; });
    return div;
  }

  function escHtml(s) {
    return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { init, showQuakeDetail };
})();
