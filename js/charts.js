/**
 * charts.js — 統計グラフ描画モジュール
 * Canvas 2D API で軽量グラフを描画
 */

window.ChartModule = (() => {

  function update(quakes) {
    const stats = window.DataModule?.getStats();
    if (!stats) return;

    setEl('stat24h',     stats.count24h);
    setEl('statMaxMag',  stats.maxMag !== '-' ? 'M' + stats.maxMag : '-');
    setEl('statAvgDepth', stats.avgDepth);
    setEl('statTsunami', stats.tsCount + '件');

    drawMagChart(stats.magDist);
    drawTimeChart(stats.hourly);
    drawDepthChart(stats.depthDist);
  }

  function drawMagChart(dist) {
    const canvas = document.getElementById('magChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const labels = Object.keys(dist);
    const vals   = Object.values(dist);
    const maxVal = Math.max(...vals, 1);
    const colors = ['#4fc3f7','#00e5ff','#7fff00','#ffa500','#ff6900','#e50000'];
    const padL = 28, padB = 20, padR = 8, padT = 8;
    const cW = W - padL - padR, cH = H - padB - padT;
    const bW = Math.floor(cW / labels.length) - 4;

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padT + cH - (cH * i / 4);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = '9px monospace';
      ctx.fillText(Math.round(maxVal * i / 4), 2, y + 3);
    }

    labels.forEach((label, i) => {
      const barH = (vals[i] / maxVal) * cH;
      const x = padL + i * (bW + 4) + 2;
      const y = padT + cH - barH;
      ctx.fillStyle = colors[i] || '#888';
      ctx.fillRect(x, y, bW, barH);

      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(label, x + bW/2, H - 4);

      if (vals[i] > 0) {
        ctx.fillStyle = '#fff';
        ctx.fillText(vals[i], x + bW/2, y - 2);
      }
    });
  }

  function drawTimeChart(hourly) {
    const canvas = document.getElementById('timeChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const maxVal = Math.max(...hourly, 1);
    const padL = 28, padB = 20, padR = 8, padT = 8;
    const cW = W - padL - padR, cH = H - padB - padT;
    const step = cW / (hourly.length - 1);

    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = padT + cH - (cH * i / 4);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.font = '9px monospace';
      ctx.fillText(Math.round(maxVal * i / 4), 2, y + 3);
    }

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'center';
    [0, 6, 12, 18, 23].forEach(i => {
      const x = padL + i * step;
      ctx.fillText('-' + (23-i) + 'h', x, H - 4);
    });

    ctx.beginPath();
    hourly.forEach((v, i) => {
      const x = padL + i * step;
      const y = padT + cH - (v / maxVal) * cH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.lineTo(padL + (hourly.length-1)*step, padT + cH);
    ctx.lineTo(padL, padT + cH);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, padT, 0, padT+cH);
    grad.addColorStop(0, 'rgba(59,130,246,0.4)');
    grad.addColorStop(1, 'rgba(59,130,246,0.0)');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 1.5;
    hourly.forEach((v, i) => {
      const x = padL + i * step;
      const y = padT + cH - (v / maxVal) * cH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }

  function drawDepthChart(dist) {
    const canvas = document.getElementById('depthChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const labels = Object.keys(dist);
    const vals   = Object.values(dist);
    const maxVal = Math.max(...vals, 1);
    const total  = vals.reduce((a,b)=>a+b,0) || 1;
    const colors = ['#22c55e','#3b82f6','#a855f7','#f5a623','#e85d3a'];
    const bH = Math.floor((H - 10) / labels.length) - 4;
    const padL = 52, padR = 40;
    const cW = W - padL - padR;

    labels.forEach((label, i) => {
      const barW = (vals[i] / maxVal) * cW;
      const y = 5 + i * (bH + 4);

      ctx.fillStyle = colors[i] || '#888';
      ctx.fillRect(padL, y, barW, bH);

      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(label + 'km', padL - 4, y + bH/2 + 3);

      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      const pct = Math.round(vals[i]/total*100);
      ctx.fillText(`${vals[i]} (${pct}%)`, padL + barW + 4, y + bH/2 + 3);
    });
  }

  function setEl(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  return { update };
})();
