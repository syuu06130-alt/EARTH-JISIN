/**
 * search.js — 地名検索モジュール（Nominatim / OpenStreetMap 版）
 * 世界中の市区町村・国・観光地・建物レベルまで検索可能。
 * 検索した場所を3D地球儀上にピンで表示し、そこへカメラを飛行させる。
 */

window.SearchModule = (() => {
  let debounceTimer = null;
  let currentQuery  = '';
  let isSearching   = false;
  let lastResults   = [];

  const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
  const MIN_CHARS = 2;   // 最低文字数
  const DEBOUNCE  = 450; // ms（レート制限対策）
  const LIMIT     = 12;  // 最大結果件数

  // 地震情報とは無関係に、どの国・地名でもヒットさせる
  const ACCEPT_LANG = 'ja,en';

  /* ══════════════════════════════════════════
     初期化
  ══════════════════════════════════════════ */
  function init() {
    const input     = document.getElementById('searchInput');
    const resultsEl = document.getElementById('searchResults');
    if (!input || !resultsEl) return;

    input.addEventListener('input',   onInput);
    input.addEventListener('keydown', onKeydown);

    // 検索欄以外をクリックで閉じる
    document.addEventListener('click', e => {
      if (!e.target.closest('.header-search')) hideResults();
    });

    // Enter で最初の候補を選択
    input.addEventListener('keydown', e => {
      if (e.key === 'Escape') { hideResults(); input.blur(); }
    });
  }

  /* ══════════════════════════════════════════
     入力ハンドラー
  ══════════════════════════════════════════ */
  function onInput(e) {
    const q = e.target.value.trim();
    currentQuery = q;

    if (q.length < MIN_CHARS) { hideResults(); return; }

    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (currentQuery === q) search(q);
    }, DEBOUNCE);
  }

  function onKeydown(e) {
    const items = document.querySelectorAll('.search-item');
    if (!items.length) return;
    const focused = document.querySelector('.search-item.focused');
    let idx = [...items].indexOf(focused);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focused?.classList.remove('focused');
      items[Math.min(idx + 1, items.length - 1)]?.classList.add('focused');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focused?.classList.remove('focused');
      items[Math.max(idx - 1, 0)]?.classList.add('focused');
    } else if (e.key === 'Enter') {
      const f = document.querySelector('.search-item.focused');
      if (f) { f.click(); return; }
      if (items.length) items[0].click();
    }
  }

  /* ══════════════════════════════════════════
     Nominatim API 呼び出し
  ══════════════════════════════════════════ */
  async function search(q) {
    if (isSearching) return;
    isSearching = true;
    showLoading();

    try {
      // まずオフラインの PLACES リストでローカル一致検索（高速）
      const localHits = searchLocal(q);

      // Nominatim API（世界中の地名）
      const params = new URLSearchParams({
        q,
        format:         'json',
        addressdetails: '1',
        limit:          String(LIMIT),
        'accept-language': ACCEPT_LANG,
      });

      const res  = await fetch(`${NOMINATIM}?${params}`, {
        headers: { 'User-Agent': 'EarthquakeMonitor/1.0 (educational project)' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // ローカルヒット＋APIヒットをマージ（重複排除）
      const apiHits = data.map(item => ({
        name:    item.display_name,
        short:   buildShortName(item),
        country: item.address?.country || '',
        type:    item.type || item.class || '',
        lat:     parseFloat(item.lat),
        lng:     parseFloat(item.lon),
        importance: parseFloat(item.importance || 0),
        source: 'api',
      }));

      // ローカル候補を先頭に、API結果を後に並べ（表示名でユニーク化）
      const seen = new Set();
      lastResults = [...localHits, ...apiHits].filter(r => {
        const key = `${r.lat.toFixed(3)},${r.lng.toFixed(3)}`;
        if (seen.has(key)) return false;
        seen.add(key); return true;
      });

      renderResults(lastResults);

    } catch (err) {
      // APIエラー時はローカル候補のみ表示
      const localHits = searchLocal(q);
      if (localHits.length) {
        lastResults = localHits;
        renderResults(lastResults);
      } else {
        showError('検索できませんでした。ネット接続を確認してください。');
      }
    } finally {
      isSearching = false;
    }
  }

  /* ══════════════════════════════════════════
     ローカル PLACES 検索（オフライン高速補完）
  ══════════════════════════════════════════ */
  function searchLocal(q) {
    if (!CONFIG.PLACES) return [];
    const lq = q.toLowerCase();
    return CONFIG.PLACES
      .filter(p => p.name.includes(q) || (p.kana && p.kana.includes(lq)) || p.name.toLowerCase().includes(lq))
      .map(p => ({
        name:    p.name,
        short:   p.name,
        country: '日本',
        type:    'prefecture',
        lat:     p.lat,
        lng:     p.lng,
        zoom:    p.zoom,
        importance: 0.9,
        source: 'local',
      }));
  }

  /* ══════════════════════════════════════════
     表示名を短くビルド（Nominatim の長い display_name を整形）
  ══════════════════════════════════════════ */
  function buildShortName(item) {
    const addr = item.address || {};
    // 優先順: city区市 > town町 > village村 > suburb > county郡 > state都道府県 > country
    const parts = [];
    const city = addr.city || addr.town || addr.village || addr.municipality ||
                 addr.suburb || addr.county || addr.district || addr.region || addr.state;
    if (city)              parts.push(city);
    if (addr.country)      parts.push(addr.country);
    return parts.length ? parts.join(', ') : (item.display_name || '').split(',').slice(0, 2).join(',');
  }

  /* ══════════════════════════════════════════
     結果リスト描画
  ══════════════════════════════════════════ */
  function renderResults(results) {
    const el = document.getElementById('searchResults');
    if (!el) return;

    if (!results.length) {
      el.innerHTML = '<div class="search-empty">該当する地名が見つかりませんでした</div>';
      el.classList.add('show');
      return;
    }

    el.innerHTML = results.map((r, i) => {
      const icon = iconForType(r.type);
      const meta = [r.country, r.type ? typeLabel(r.type) : ''].filter(Boolean).join(' · ');
      return `<div class="search-item" data-idx="${i}" tabindex="-1">
        <div class="search-item-name">${icon} ${r.short || r.name}</div>
        <div class="search-item-meta">${escHtml(meta)}</div>
      </div>`;
    }).join('');

    el.querySelectorAll('.search-item').forEach(item => {
      item.addEventListener('click', () => selectResult(parseInt(item.dataset.idx)));
      item.addEventListener('mouseenter', () => {
        el.querySelectorAll('.search-item').forEach(x => x.classList.remove('focused'));
        item.classList.add('focused');
      });
    });

    el.classList.add('show');
  }

  function iconForType(type) {
    const t = (type || '').toLowerCase();
    if (['city','town','village','municipality','suburb'].includes(t)) return '🏙️';
    if (['country','state','province','region','prefecture'].includes(t)) return '🌐';
    if (['mountain','peak','volcano'].includes(t)) return '🏔️';
    if (['island','peninsula'].includes(t)) return '🏝️';
    if (['river','lake','bay','ocean','sea'].includes(t)) return '🌊';
    if (['airport'].includes(t)) return '✈️';
    if (['station','stop'].includes(t)) return '🚉';
    if (['hospital'].includes(t)) return '🏥';
    if (['university','school'].includes(t)) return '🎓';
    if (['park','nature_reserve','forest'].includes(t)) return '🌳';
    return '📍';
  }

  function typeLabel(type) {
    const map = {
      city: '市', town: '町', village: '村', suburb: '地区', county: '郡',
      state: '都道府県', country: '国', administrative: '行政区', prefecture: '都道府県',
      municipality: '市区町村', district: '区', region: '地域', island: '島',
      peak: '山', mountain: '山', volcano: '火山', bay: '湾', river: '川',
      lake: '湖', ocean: '海', sea: '海', airport: '空港', station: '駅',
      park: '公園', forest: '森', nature_reserve: '自然保護区', hospital: '病院',
      university: '大学', school: '学校', neighbourhood: '近隣',
    };
    return map[type] || type;
  }

  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* ══════════════════════════════════════════
     候補を選択したときの処理
  ══════════════════════════════════════════ */
  function selectResult(idx) {
    const r = lastResults[idx];
    if (!r) return;

    // 検索欄に短名を設定
    const input = document.getElementById('searchInput');
    if (input) input.value = r.short || r.name;
    hideResults();

    // 3D地球儀上にピンを立てる
    if (window.MapModule?.setSearchPin) {
      window.MapModule.setSearchPin(r.lat, r.lng, r.short || r.name);
    }

    // カメラを飛ばす（重要度・種別に応じたズーム距離）
    const dist = calcFlyDist(r);
    if (window.MapModule?.flyTo) {
      window.MapModule.flyTo(r.lat, r.lng, null, dist);
    }

    // Bot ログへも記録
    if (window.BotModule?.log) {
      window.BotModule.log(`📍 「${r.short || r.name}」へ移動しました (${r.lat.toFixed(3)}, ${r.lng.toFixed(3)})`);
    }
  }

  function calcFlyDist(r) {
    const t = (r.type || '').toLowerCase();
    // 国・大陸レベル → 遠め
    if (['country','continent'].includes(t)) return 320;
    // 都道府県・州・地域 → 中距離
    if (['state','prefecture','province','region','administrative'].includes(t)) return 220;
    // 市区町村 → やや近め
    if (['city','town','municipality','district'].includes(t)) return 170;
    // 村・地区・近隣 → 近め
    if (['village','suburb','neighbourhood'].includes(t)) return 140;
    // 山・湖・特定施設 → かなり近め
    if (['peak','mountain','volcano','lake','hospital','university','park','station'].includes(t)) return 130;
    // 重要度で粗分類
    if ((r.importance || 0) > 0.7) return 240;
    if ((r.importance || 0) > 0.4) return 180;
    return 155;
  }

  /* ══════════════════════════════════════════
     UI ヘルパー
  ══════════════════════════════════════════ */
  function showLoading() {
    const el = document.getElementById('searchResults');
    if (!el) return;
    el.innerHTML = '<div class="search-empty">🔍 検索中...</div>';
    el.classList.add('show');
  }

  function showError(msg) {
    const el = document.getElementById('searchResults');
    if (!el) return;
    el.innerHTML = `<div class="search-empty" style="color:var(--accent)">⚠️ ${escHtml(msg)}</div>`;
    el.classList.add('show');
  }

  function hideResults() {
    document.getElementById('searchResults')?.classList.remove('show');
    document.querySelectorAll('.search-item').forEach(x => x.classList.remove('focused'));
  }

  /* 公開 API */
  return { init, search };
})();
