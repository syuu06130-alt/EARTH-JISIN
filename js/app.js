/**
 * app.js — エントリーポイント
 * 全モジュールを初期化し、定期更新を開始
 */

window.AppModule = (() => {
  let fetchTimer = null;
  let newsTimer = null;
  let botLogTimer = null;

  function setRefreshInterval(ms) {
    CONFIG.BOT.FETCH_INTERVAL = ms;
    clearInterval(fetchTimer);
    if (window.BotModule?.isRunning()) {
      fetchTimer = setInterval(() => DataModule.fetchAll(), ms);
    }
    window.BotModule?.log('info', `自動更新間隔を ${ms < 1000 ? ms+'ミリ秒' : (ms/1000)+'秒'} に変更しました`);
  }

  function startTimers() {
    fetchTimer  = setInterval(() => DataModule.fetchAll(), CONFIG.BOT.FETCH_INTERVAL);
    newsTimer   = setInterval(() => NewsModule.fetch(),    CONFIG.BOT.NEWS_INTERVAL);
    botLogTimer = setInterval(() => BotModule.periodicLog(), 300000);
  }

  function stopTimers() {
    clearInterval(fetchTimer);
    clearInterval(newsTimer);
    clearInterval(botLogTimer);
  }

  async function init() {
    MapModule.init();
    UIModule.init();
    BotModule.init();
    SearchModule.init();
    HistoryModule.render();

    BotModule.log('info', '初回データ取得中...');
    await DataModule.fetchAll();
    BotModule.log('ok', '初回データ取得完了');

    setTimeout(() => NewsModule.fetch(), 1000);

    startTimers();

    document.getElementById('botToggle')?.addEventListener('click', () => {
      setTimeout(() => {
        if (BotModule.isRunning()) startTimers();
        else stopTimers();
      }, 0);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        clearInterval(fetchTimer);
      } else if (BotModule.isRunning()) {
        DataModule.fetchAll();
        fetchTimer = setInterval(() => DataModule.fetchAll(), CONFIG.BOT.FETCH_INTERVAL);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.getElementById('bigscreenPanel')?.classList.remove('show');
        document.getElementById('emergencyOverlay')?.classList.remove('show');
        document.getElementById('tsunamiOverlay')?.classList.remove('show');
      }
      if (e.key === 'r' && !e.ctrlKey) DataModule.fetchAll();
      if (e.key === 'f') MapModule.resetView();
    });

    console.log('%c🗾 JISHIN.WATCH', 'font-size:24px;color:#e85d3a;font-weight:bold;');
    console.log('%cリアルタイム地震監視システム起動完了', 'color:#8b93ae;');
    console.log('%cデータソース: 気象庁(P2P地震情報) / USGS', 'color:#4e566b;');
    console.log('%cテスト: AlertsModule.testEmergency() / AlertsModule.testTsunami()', 'color:#4e566b;');
  }

  return { init, setRefreshInterval };
})();

document.addEventListener('DOMContentLoaded', () => {
  window.AppModule.init();
});
