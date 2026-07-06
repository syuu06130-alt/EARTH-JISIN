/**
 * alerts.js — 緊急アラートモジュール
 * 大地震発生時の全画面警告アニメーション・津波警報アニメーション
 */

window.AlertsModule = (() => {
  let emergencyTimer = null;
  let tsunamiTimer = null;
  let audioCtx = null;

  // ===== 新着地震を受け取り、条件に応じて警告を発動 =====
  function onNewQuake(q) {
    const emergencyEnabled = document.getElementById('alertEmergency')?.checked !== false;
    const tsunamiEnabled    = document.getElementById('alertTsunami')?.checked !== false;

    if (tsunamiEnabled && q.tsunami) {
      showTsunamiAlert(q);
      return;
    }

    if (emergencyEnabled && q.mag >= CONFIG.BOT.ALERT_MAG_EMERGENCY) {
      showEmergencyAlert(q);
    }
  }

  // ===== 緊急地震速報アニメーション表示 =====
  function showEmergencyAlert(q) {
    const overlay = document.getElementById('emergencyOverlay');
    const title    = document.getElementById('emergencyTitle');
    const sub      = document.getElementById('emergencySub');
    if (!overlay) return;

    title.textContent = '大地震が発生しています';
    sub.textContent = `M${q.mag.toFixed(1)} ／ ${q.place} ／ 深さ${q.depth != null ? q.depth+'km' : '不明'}${q.maxIntensity ? ' ／ 最大震度' + q.maxIntensity : ''}`;

    overlay.classList.add('show');
    playEmergencySound();

    clearTimeout(emergencyTimer);
    emergencyTimer = setTimeout(() => overlay.classList.remove('show'), 8000);

    overlay.onclick = () => {
      overlay.classList.remove('show');
      clearTimeout(emergencyTimer);
    };
  }

  // ===== 津波警報アニメーション表示 =====
  function showTsunamiAlert(q) {
    const overlay = document.getElementById('tsunamiOverlay');
    const detail  = document.getElementById('tsunamiDetail');
    if (!overlay) return;

    detail.textContent = `震源: ${q.place} ／ M${q.mag.toFixed(1)} ／ ${q.tsunami}`;

    overlay.classList.add('show');
    playTsunamiSound();

    clearTimeout(tsunamiTimer);
    tsunamiTimer = setTimeout(() => overlay.classList.remove('show'), 10000);

    overlay.onclick = () => {
      overlay.classList.remove('show');
      clearTimeout(tsunamiTimer);
    };
  }

  // ===== 緊急地震速報音（チャイム風2音連打） =====
  function playEmergencySound() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;
      [0, 0.35, 0.7, 1.05].forEach((t, i) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'square';
        osc.frequency.value = i % 2 === 0 ? 880 : 660;
        gain.gain.value = 0.18;
        osc.start(now + t);
        osc.stop(now + t + 0.25);
      });
    } catch(e) { /* 無視 */ }
  }

  // ===== 津波警報音（低音うねり） =====
  function playTsunamiSound() {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(330, now + 0.5);
      osc.frequency.linearRampToValueAtTime(220, now + 1.0);
      gain.gain.value = 0.15;
      osc.start(now);
      osc.stop(now + 2.0);
    } catch(e) { /* 無視 */ }
  }

  // ===== テスト発動用（デバッグ・デモ用） =====
  function testEmergency() {
    showEmergencyAlert({ mag: 6.8, place: 'テスト震源（南海トラフ）', depth: 20, maxIntensity: '6強' });
  }
  function testTsunami() {
    showTsunamiAlert({ mag: 7.5, place: 'テスト震源（日本海溝）', tsunami: '大津波警報' });
  }

  return { onNewQuake, showEmergencyAlert, showTsunamiAlert, testEmergency, testTsunami };
})();
