/**
 * history.js — 過去の大地震アーカイブ
 * 日本国内の主要な大地震情報と関連動画リンク（YouTube検索リンク形式）
 */

window.HistoryModule = (() => {

  // 過去の主要地震データ（マグニチュード・死者数等は気象庁・内閣府公表値に基づく概数）
  const QUAKES = [
    {
      year: '2024',
      name: '令和6年能登半島地震',
      mag: 'M7.6',
      date: '2024年1月1日',
      desc: '石川県能登地方で発生。最大震度7を観測し、津波・大規模火災・建物倒壊が発生。',
      lat: 37.5, lng: 137.2,
      videoUrl: 'https://www.youtube.com/results?search_query=令和6年能登半島地震+記録映像',
    },
    {
      year: '2018',
      name: '北海道胆振東部地震',
      mag: 'M6.7',
      date: '2018年9月6日',
      desc: '北海道厚真町を中心に大規模な土砂崩れが発生。北海道全域で大規模停電（ブラックアウト）。',
      lat: 42.7, lng: 141.9,
      videoUrl: 'https://www.youtube.com/results?search_query=北海道胆振東部地震+記録映像',
    },
    {
      year: '2016',
      name: '熊本地震',
      mag: 'M7.3',
      date: '2016年4月14日・16日',
      desc: '前震・本震の2度にわたり最大震度7を観測した珍しい地震。熊本城も甚大な被害。',
      lat: 32.8, lng: 130.7,
      videoUrl: 'https://www.youtube.com/results?search_query=熊本地震+2016+記録映像',
    },
    {
      year: '2011',
      name: '東北地方太平洋沖地震（東日本大震災）',
      mag: 'M9.0',
      date: '2011年3月11日',
      desc: '日本観測史上最大規模。巨大津波により東北沿岸部に壊滅的被害。福島第一原発事故の原因に。',
      lat: 38.1, lng: 142.9,
      videoUrl: 'https://www.youtube.com/results?search_query=東日本大震災+津波+記録映像',
    },
    {
      year: '2004',
      name: '新潟県中越地震',
      mag: 'M6.8',
      date: '2004年10月23日',
      desc: '新潟県中越地方で発生。山間部で大規模な土砂災害、高速道路の崩落被害。',
      lat: 37.3, lng: 138.9,
      videoUrl: 'https://www.youtube.com/results?search_query=新潟県中越地震+記録映像',
    },
    {
      year: '1995',
      name: '兵庫県南部地震（阪神・淡路大震災）',
      mag: 'M7.3',
      date: '1995年1月17日',
      desc: '都市直下型地震。高速道路の倒壊や大規模火災により神戸市を中心に甚大な被害。',
      lat: 34.6, lng: 135.0,
      videoUrl: 'https://www.youtube.com/results?search_query=阪神淡路大震災+記録映像',
    },
    {
      year: '1944',
      name: '昭和東南海地震',
      mag: 'M7.9',
      date: '1944年12月7日',
      desc: '紀伊半島から東海地方にかけて発生。戦時中のため被害情報が伏せられた歴史的地震。',
      lat: 33.7, lng: 136.2,
      videoUrl: 'https://www.youtube.com/results?search_query=昭和東南海地震+記録',
    },
    {
      year: '1923',
      name: '関東大震災',
      mag: 'M7.9',
      date: '1923年9月1日',
      desc: '相模湾を震源とした大地震。火災旋風により東京・横浜で死者・行方不明者約10万5千人。',
      lat: 35.3, lng: 139.1,
      videoUrl: 'https://www.youtube.com/results?search_query=関東大震災+記録映像',
    },
    {
      year: '1896',
      name: '明治三陸地震',
      mag: 'M8.2',
      date: '1896年6月15日',
      desc: '揺れは小さかったが巨大津波が三陸海岸を襲い、死者2万人を超える津波災害の教訓となった地震。',
      lat: 39.5, lng: 144.0,
      videoUrl: 'https://www.youtube.com/results?search_query=明治三陸地震+津波',
    },
    {
      year: '1854',
      name: '安政南海地震',
      mag: 'M8.4',
      date: '1854年12月24日',
      desc: '南海トラフを震源とする巨大地震。安政東海地震の翌日に発生し西日本各地に津波被害。',
      lat: 33.0, lng: 135.6,
      videoUrl: 'https://www.youtube.com/results?search_query=安政南海地震+南海トラフ',
    },
  ];

  // 将来想定される巨大地震（防災学習用）
  const FUTURE_RISKS = [
    {
      year: '想定',
      name: '南海トラフ巨大地震',
      mag: 'M8〜9想定',
      date: '今後30年以内の発生確率 70〜80%程度',
      desc: '静岡県から九州沖にかけてのプレート境界で想定される巨大地震。広範囲で強い揺れと大津波が想定される。',
      lat: 33.0, lng: 136.0,
      videoUrl: 'https://www.youtube.com/results?search_query=南海トラフ巨大地震+想定+解説',
    },
    {
      year: '想定',
      name: '首都直下地震',
      mag: 'M7程度想定',
      date: '今後30年以内の発生確率 70%程度',
      desc: '首都圏直下で想定される地震。東京都心部での建物倒壊・火災延焼が懸念されている。',
      lat: 35.7, lng: 139.7,
      videoUrl: 'https://www.youtube.com/results?search_query=首都直下地震+想定+解説',
    },
  ];

  function render() {
    const el = document.getElementById('historyList');
    if (!el) return;

    const all = [...QUAKES, ...FUTURE_RISKS];

    el.innerHTML = all.map(q => `
      <div class="history-item" onclick="HistoryModule.focus(${q.lat}, ${q.lng})">
        <div class="history-year">${q.year} ／ ${q.date}</div>
        <div class="history-name">${escapeHtml(q.name)}</div>
        <div class="history-mag">${q.mag}</div>
        <div class="history-desc">${escapeHtml(q.desc)}</div>
        <a class="history-link" href="${q.videoUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation()">
          ▶️ 関連動画を見る（YouTube検索）
        </a>
      </div>
    `).join('');
  }

  function focus(lat, lng) {
    window.MapModule?.flyTo(lat, lng, 7);
  }

  function escapeHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  return { render, focus, QUAKES, FUTURE_RISKS };
})();
