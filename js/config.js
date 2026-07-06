/**
 * config.js — 設定ファイル
 * GitHubに公開する前にAPIキーを環境変数等で管理してください
 */

window.CONFIG = {
  // ========== Google Maps API（任意・衛星写真の高品質化に使用） ==========
  // https://console.cloud.google.com/ でAPIキーを取得してください
  // 未設定でも無料の地図タイル（Esri衛星写真）で動作します
  GOOGLE_MAPS_API_KEY: '',

  // ========== データソース ==========
  JMA_API_BASE: 'https://www.jma.go.jp/bosai/quake/data',
  // P2P地震情報 (無料, CORS対応, APIキー不要)
  P2P_API: 'https://api.p2pquake.net/v2/history?codes=551&limit=100',
  P2P_API_TSUNAMI: 'https://api.p2pquake.net/v2/history?codes=552&limit=20',
  // USGS API (世界の地震データ, CORS対応, APIキー不要)
  USGS_API: 'https://earthquake.usgs.gov/fdsnws/event/1/query',
  // Nominatim (OpenStreetMap) 地名検索API（無料・APIキー不要・世界中の市区町村レベルまで検索可）
  NOMINATIM_API: 'https://nominatim.openstreetmap.org/search',

  // ========== Bot設定 ==========
  BOT: {
    FETCH_INTERVAL: 30000,       // 自動更新間隔(ミリ秒) 初期値=30秒。UIで変更可能
    NEWS_INTERVAL:  120000,      // ニュース更新間隔=2分
    ALERT_MAG_BANNER:    5.0,    // この規模以上でバナー表示
    ALERT_MAG_SOUND:     4.0,    // この規模以上で音声アラート
    ALERT_MAG_LOG:        3.0,   // この規模以上でBotログ記録
    ALERT_MAG_EMERGENCY: 6.0,    // この規模以上で緊急全画面警告
  },

  // ========== 地図設定 ==========
  MAP: {
    CENTER: [36.5, 136.0],
    ZOOM: 5,
    // タイル: 全てAPIキー不要の無料サービスのみ使用（401エラー回避）
    TILES: {
      // CartoDB Dark Matter（ダーク標準地図）
      standard:  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      // Esri World Imagery（衛星写真・無料・キー不要）
      satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      // OpenTopoMap（地形図・無料）
      terrain:   'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    },
    TILE_ATTR: {
      standard:  '&copy; OpenStreetMap, &copy; CARTO',
      satellite: '&copy; Esri, Maxar, Earthstar Geographics',
      terrain:   '&copy; OpenTopoMap (CC-BY-SA), SRTM',
    },
  },

  // ========== 震度カラー ==========
  SCALE_COLORS: {
    '7':  '#9b0000',
    '6+': '#e50000',
    '6-': '#ff2800',
    '5+': '#ff6900',
    '5-': '#ffa500',
    '4':  '#ffff00',
    '3':  '#7fff00',
    '2':  '#00e5ff',
    '1':  '#4fc3f7',
    '0':  '#888888',
  },

  // ========== マグニチュードカラー ==========
  MAG_COLOR: (m) => {
    if (m >= 7.0) return '#9b0000';
    if (m >= 6.0) return '#e50000';
    if (m >= 5.0) return '#ff6900';
    if (m >= 4.0) return '#ffa500';
    if (m >= 3.0) return '#3b82f6';
    return '#4fc3f7';
  },

  // ========== マグニチュード→サイズ ==========
  MAG_RADIUS: (m) => Math.max(4, Math.pow(2, m - 1) * 2),

  // ========== マグニチュード → 推定震度（簡易対応表） ==========
  // 気象庁の震度はマグニチュード・震源深さ・震央距離で決まるため厳密な変換はできませんが、
  // フィルターでの目安表示用に「震源近傍（直上）で想定される震度」を簡易計算します。
  MAG_TO_INTENSITY: (m) => {
    if (m >= 7.7) return '7';
    if (m >= 7.0) return '6強';
    if (m >= 6.4) return '6弱';
    if (m >= 5.8) return '5強';
    if (m >= 5.2) return '5弱';
    if (m >= 4.5) return '4';
    if (m >= 3.7) return '3';
    if (m >= 2.8) return '2';
    if (m >= 1.8) return '1';
    return '0';
  },
  // 震度ラベル→丸めた表示用ラベル（フィルタースライダーの目盛り表記用）
  INTENSITY_STEPS: [
    { mag: 0.0, label: '震度1未満' },
    { mag: 1.8, label: '震度1' },
    { mag: 2.8, label: '震度2' },
    { mag: 3.7, label: '震度3' },
    { mag: 4.5, label: '震度4' },
    { mag: 5.2, label: '震度5弱' },
    { mag: 5.8, label: '震度5強' },
    { mag: 6.4, label: '震度6弱' },
    { mag: 7.0, label: '震度6強' },
    { mag: 7.7, label: '震度7' },
  ],

  // ========== 3D地球儀設定 ==========
  GLOBE: {
    RADIUS: 100,
    // 地球テクスチャ（すべて無料・APIキー不要、three-globeパッケージの公開アセットをCDN経由で使用）
    TEXTURES: {
      // 標準（プレートカラー風の自然な地球） — 衛星写真と区別するためコントラストを変えて使用
      standard:  'https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg',
      // 衛星写真（フォトリアルなBlue Marble）
      satellite: 'https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg',
      // 地形（バンプマップをベースカラーとしても使用し、起伏を強調）
      terrain:   'https://unpkg.com/three-globe@2.31.0/example/img/earth-topology.png',
    },
    BUMP_MAP:     'https://unpkg.com/three-globe@2.31.0/example/img/earth-topology.png',
    SPECULAR_MAP: 'https://unpkg.com/three-globe@2.31.0/example/img/earth-water.png',
    CLOUDS_MAP:   'https://unpkg.com/three-globe@2.31.0/example/img/fair_clouds_4k.png',
    STARFIELD:    'https://unpkg.com/three-globe@2.31.0/example/img/night-sky.png',
    PIN_PIXEL_SIZE: 14,      // ピンの画面上での一定サイズ(px相当)
    MIN_ZOOM_DIST: 105,      // カメラがこれ以上近づけない距離
    MAX_ZOOM_DIST: 420,      // カメラがこれ以上離れられない距離
    DEFAULT_DIST: 260,
  },

  // ========== 都道府県・主要都市 検索用座標データ ==========
  PLACES: [
    { name: '北海道',   kana: 'ほっかいどう', lat: 43.0642, lng: 141.3469, zoom: 7 },
    { name: '札幌',     kana: 'さっぽろ',     lat: 43.0642, lng: 141.3469, zoom: 9 },
    { name: '青森県',   kana: 'あおもり',     lat: 40.8244, lng: 140.7400, zoom: 8 },
    { name: '岩手県',   kana: 'いわて',       lat: 39.7036, lng: 141.1527, zoom: 8 },
    { name: '宮城県',   kana: 'みやぎ',       lat: 38.2688, lng: 140.8721, zoom: 8 },
    { name: '仙台',     kana: 'せんだい',     lat: 38.2688, lng: 140.8721, zoom: 9 },
    { name: '秋田県',   kana: 'あきた',       lat: 39.7186, lng: 140.1024, zoom: 8 },
    { name: '山形県',   kana: 'やまがた',     lat: 38.2404, lng: 140.3633, zoom: 8 },
    { name: '福島県',   kana: 'ふくしま',     lat: 37.7503, lng: 140.4676, zoom: 8 },
    { name: '茨城県',   kana: 'いばらき',     lat: 36.3418, lng: 140.4468, zoom: 8 },
    { name: '栃木県',   kana: 'とちぎ',       lat: 36.5658, lng: 139.8836, zoom: 8 },
    { name: '群馬県',   kana: 'ぐんま',       lat: 36.3911, lng: 139.0608, zoom: 8 },
    { name: '埼玉県',   kana: 'さいたま',     lat: 35.8569, lng: 139.6489, zoom: 8 },
    { name: '千葉県',   kana: 'ちば',         lat: 35.6047, lng: 140.1233, zoom: 8 },
    { name: '東京都',   kana: 'とうきょう',   lat: 35.6895, lng: 139.6917, zoom: 9 },
    { name: '東京',     kana: 'とうきょう',   lat: 35.6895, lng: 139.6917, zoom: 9 },
    { name: '神奈川県', kana: 'かながわ',     lat: 35.4478, lng: 139.6425, zoom: 8 },
    { name: '横浜',     kana: 'よこはま',     lat: 35.4437, lng: 139.6380, zoom: 9 },
    { name: '新潟県',   kana: 'にいがた',     lat: 37.9024, lng: 139.0233, zoom: 8 },
    { name: '富山県',   kana: 'とやま',       lat: 36.6953, lng: 137.2113, zoom: 8 },
    { name: '石川県',   kana: 'いしかわ',     lat: 36.5947, lng: 136.6256, zoom: 8 },
    { name: '能登半島', kana: 'のと',         lat: 37.3000, lng: 137.0000, zoom: 9 },
    { name: '福井県',   kana: 'ふくい',       lat: 36.0652, lng: 136.2216, zoom: 8 },
    { name: '山梨県',   kana: 'やまなし',     lat: 35.6642, lng: 138.5683, zoom: 8 },
    { name: '長野県',   kana: 'ながの',       lat: 36.6513, lng: 138.1810, zoom: 8 },
    { name: '岐阜県',   kana: 'ぎふ',         lat: 35.3912, lng: 136.7223, zoom: 8 },
    { name: '静岡県',   kana: 'しずおか',     lat: 34.9769, lng: 138.3831, zoom: 8 },
    { name: '愛知県',   kana: 'あいち',       lat: 35.1802, lng: 136.9066, zoom: 8 },
    { name: '名古屋',   kana: 'なごや',       lat: 35.1815, lng: 136.9066, zoom: 9 },
    { name: '三重県',   kana: 'みえ',         lat: 34.7303, lng: 136.5086, zoom: 8 },
    { name: '滋賀県',   kana: 'しが',         lat: 35.0045, lng: 135.8686, zoom: 8 },
    { name: '京都府',   kana: 'きょうと',     lat: 35.0212, lng: 135.7556, zoom: 8 },
    { name: '大阪府',   kana: 'おおさか',     lat: 34.6863, lng: 135.5200, zoom: 8 },
    { name: '大阪',     kana: 'おおさか',     lat: 34.6863, lng: 135.5200, zoom: 9 },
    { name: '兵庫県',   kana: 'ひょうご',     lat: 34.6913, lng: 135.1830, zoom: 8 },
    { name: '神戸',     kana: 'こうべ',       lat: 34.6901, lng: 135.1955, zoom: 9 },
    { name: '奈良県',   kana: 'なら',         lat: 34.6851, lng: 135.8050, zoom: 8 },
    { name: '和歌山県', kana: 'わかやま',     lat: 34.2261, lng: 135.1675, zoom: 8 },
    { name: '鳥取県',   kana: 'とっとり',     lat: 35.5039, lng: 134.2378, zoom: 8 },
    { name: '島根県',   kana: 'しまね',       lat: 35.4723, lng: 133.0505, zoom: 8 },
    { name: '岡山県',   kana: 'おかやま',     lat: 34.6618, lng: 133.9344, zoom: 8 },
    { name: '広島県',   kana: 'ひろしま',     lat: 34.3966, lng: 132.4596, zoom: 8 },
    { name: '山口県',   kana: 'やまぐち',     lat: 34.1858, lng: 131.4706, zoom: 8 },
    { name: '徳島県',   kana: 'とくしま',     lat: 34.0658, lng: 134.5593, zoom: 8 },
    { name: '香川県',   kana: 'かがわ',       lat: 34.3401, lng: 134.0434, zoom: 8 },
    { name: '愛媛県',   kana: 'えひめ',       lat: 33.8417, lng: 132.7660, zoom: 8 },
    { name: '高知県',   kana: 'こうち',       lat: 33.5597, lng: 133.5311, zoom: 8 },
    { name: '福岡県',   kana: 'ふくおか',     lat: 33.6064, lng: 130.4181, zoom: 8 },
    { name: '福岡',     kana: 'ふくおか',     lat: 33.5904, lng: 130.4017, zoom: 9 },
    { name: '佐賀県',   kana: 'さが',         lat: 33.2494, lng: 130.2989, zoom: 8 },
    { name: '長崎県',   kana: 'ながさき',     lat: 32.7448, lng: 129.8737, zoom: 8 },
    { name: '熊本県',   kana: 'くまもと',     lat: 32.7898, lng: 130.7417, zoom: 8 },
    { name: '大分県',   kana: 'おおいた',     lat: 33.2382, lng: 131.6126, zoom: 8 },
    { name: '宮崎県',   kana: 'みやざき',     lat: 31.9111, lng: 131.4239, zoom: 8 },
    { name: '鹿児島県', kana: 'かごしま',     lat: 31.5602, lng: 130.5581, zoom: 8 },
    { name: '沖縄県',   kana: 'おきなわ',     lat: 26.2124, lng: 127.6809, zoom: 8 },
    { name: '那覇',     kana: 'なは',         lat: 26.2124, lng: 127.6809, zoom: 9 },
    { name: '南海トラフ', kana: 'なんかいとらふ', lat: 33.0, lng: 136.0, zoom: 6 },
    { name: '相模トラフ', kana: 'さがみとらふ', lat: 35.0, lng: 139.5, zoom: 7 },
    { name: '日本海溝',  kana: 'にほんかいこう', lat: 38.0, lng: 143.5, zoom: 6 },
  ],
};
