/**
 * map.js — 3D地球儀 描画モジュール（Three.js版）
 * Leaflet(2D)からThree.js本格3D球体へ全面置き換え。
 * - 地球全体を球体として表示（自由回転・ズーム）
 * - ピンは画面上で常に一定サイズ（sizeAttenuation:false のスプライト）
 * - 緯度経度→3D座標変換により、回転・ズームしても常に正しい位置を維持
 * - 標準／衛星／地形の3テクスチャ切替＋衛星モードでの地名ラベルON/OFF
 */

window.MapModule = (() => {
  const RADIUS = 100;
  const G = () => window.CONFIG.GLOBE;

  // Three.js コアオブジェクト
  let scene, camera, renderer, controls;
  let globeMesh, globeMat, cloudsMesh, cloudsMat;
  let pinGroup, waveGroup, faultGroup, plateGroup, searchPinGroup;
  let containerEl;

  // 大画面モード
  let bigCtx = null;

  // 状態
  let currentTileType = 'standard';
  let showLabels = false;
  let isHeatmap = false;

  // ラベルDOM
  let labelLayer = null, bigLabelLayer = null;
  let labelEntries = [];

  /* ══════════════════════════════════════════
     緯度経度 ↔ 3D座標変換
  ══════════════════════════════════════════ */
  function latLngToVec3(lat, lng, r) {
    r = r != null ? r : RADIUS;
    const phi   = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
       r * Math.cos(phi),
       r * Math.sin(phi) * Math.sin(theta)
    );
  }

  /* ══════════════════════════════════════════
     メイン初期化
  ══════════════════════════════════════════ */
  function init() {
    containerEl = document.getElementById('map');
    if (!containerEl) return;

    const built = buildScene(containerEl);
    scene      = built.scene;
    camera     = built.camera;
    renderer   = built.renderer;
    controls   = built.controls;
    globeMesh  = built.globeMesh;
    globeMat   = built.globeMat;
    cloudsMesh = built.cloudsMesh;
    cloudsMat  = built.cloudsMat;

    pinGroup      = new THREE.Group(); scene.add(pinGroup);
    waveGroup     = new THREE.Group(); scene.add(waveGroup);
    faultGroup    = new THREE.Group();
    plateGroup    = new THREE.Group();
    searchPinGroup = new THREE.Group(); scene.add(searchPinGroup);

    drawFaultLines(faultGroup);
    drawPlateBoundaries(plateGroup);

    setupLabelLayer();
    bindToolbar();
    bindLayerToggles();
    bindPointerEvents(renderer.domElement, false);
    window.addEventListener('resize', onResize);

    // 初期視点：日本上空
    flyTo(36.5, 138.0, null, G().DEFAULT_DIST);
    animate();
  }

  /* ══════════════════════════════════════════
     シーン構築（通常・大画面で共用）
  ══════════════════════════════════════════ */
  function buildScene(container) {
    const W = container.clientWidth  || container.offsetWidth  || 800;
    const H = container.clientHeight || container.offsetHeight || 600;

    /* --- シーン & カメラ --- */
    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 5000);
    camera.position.set(0, 0, G().DEFAULT_DIST);

    /* --- レンダラー --- */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x030508, 1);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    /* --- 星空背景（シェーダー球） --- */
    const starBgGeo = new THREE.SphereGeometry(2500, 32, 32);
    const starBgMat = new THREE.MeshBasicMaterial({ color: 0x04050a, side: THREE.BackSide });
    scene.add(new THREE.Mesh(starBgGeo, starBgMat));
    new THREE.TextureLoader().load(
      'https://unpkg.com/three-globe@2.31.0/example/img/night-sky.png',
      tex => { starBgMat.map = tex; starBgMat.color.set(0xffffff); starBgMat.needsUpdate = true; },
      undefined, () => {}
    );
    addPointStars(scene);

    /* --- 地球本体 --- */
    const globeGeo = new THREE.SphereGeometry(RADIUS, 96, 96);
    const globeMat = new THREE.MeshPhongMaterial({ color: 0x1a3a5c, shininess: 10 });
    const globeMesh = new THREE.Mesh(globeGeo, globeMat);
    globeMesh.name = 'globe';
    scene.add(globeMesh);
    loadTexture(globeMat, currentTileType);

    /* --- 雲 --- */
    const cloudsMat = new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.25, depthWrite: false });
    const cloudsMesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS * 1.008, 96, 96), cloudsMat);
    scene.add(cloudsMesh);
    new THREE.TextureLoader().load(
      'https://unpkg.com/three-globe@2.31.0/example/img/fair_clouds_4k.png',
      tex => { cloudsMat.map = tex; cloudsMat.needsUpdate = true; },
      undefined, () => {}
    );

    /* --- 大気グロー --- */
    const atmMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main(){
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }`,
      fragmentShader: `
        varying vec3 vNormal;
        void main(){
          float i = pow(0.58 - dot(vNormal, vec3(0,0,1)), 4.0);
          gl_FragColor = vec4(0.3,0.6,1.0,1.0) * i;
        }`,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
    });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(RADIUS * 1.14, 64, 64), atmMat));

    /* --- ライト --- */
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(300, 150, 200);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x4466bb, 0.22);
    rim.position.set(-300, -100, -200);
    scene.add(rim);

    /* --- OrbitControls --- */
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping  = true;
    controls.dampingFactor  = 0.07;
    controls.rotateSpeed    = 0.45;
    controls.zoomSpeed      = 0.75;
    controls.minDistance    = G().MIN_ZOOM_DIST;
    controls.maxDistance    = G().MAX_ZOOM_DIST;
    controls.enablePan      = false;
    controls.autoRotate     = false;
    controls.target.set(0,0,0);

    return { scene, camera, renderer, controls, globeMesh, globeMat, cloudsMesh, cloudsMat };
  }

  /* --- ランダム点群の星 --- */
  function addPointStars(scene) {
    const N   = 2000;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r   = 1800 + Math.random() * 100;
      const th  = Math.random() * Math.PI * 2;
      const ph  = Math.acos(2 * Math.random() - 1);
      pos[i*3]   = r * Math.sin(ph) * Math.cos(th);
      pos[i*3+1] = r * Math.sin(ph) * Math.sin(th);
      pos[i*3+2] = r * Math.cos(ph);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffffff, size: 1.2, sizeAttenuation: true, transparent: true, opacity: 0.85
    })));
  }

  /* ══════════════════════════════════════════
     テクスチャ読み込み（モード別）
  ══════════════════════════════════════════ */
  function loadTexture(mat, type) {
    const loader = new THREE.TextureLoader();
    const urls   = G().TEXTURES;
    const url    = urls[type] || urls.standard;

    loader.load(url, tex => {
      mat.map      = tex;
      mat.color.set(0xffffff);
      if (type === 'terrain')   { mat.color.set(0xc8e8c8); mat.shininess = 2; }
      if (type === 'satellite') { mat.shininess = 28; }
      mat.needsUpdate = true;
    }, undefined, () => {});

    loader.load(G().BUMP_MAP, tex => {
      mat.bumpMap   = tex;
      mat.bumpScale = type === 'terrain' ? 7 : 1.8;
      mat.needsUpdate = true;
    }, undefined, () => {});

    if (type !== 'terrain') {
      loader.load(G().SPECULAR_MAP, tex => {
        mat.specularMap = tex;
        mat.specular    = new THREE.Color(0x223344);
        mat.needsUpdate = true;
      }, undefined, () => {});
    } else {
      mat.specularMap = null;
      mat.specular    = new THREE.Color(0x000000);
      mat.needsUpdate = true;
    }
  }

  /* ══════════════════════════════════════════
     大画面モード初期化
  ══════════════════════════════════════════ */
  function initBigMap() {
    const container = document.getElementById('bigMap');
    if (!container) return;

    if (bigCtx) {
      // すでに初期化済みならリサイズだけ
      setTimeout(onResize, 60);
      return;
    }

    const built = buildScene(container);
    bigCtx = {
      ...built,
      container,
      pinGroup:      new THREE.Group(),
      waveGroup:     new THREE.Group(),
      searchPinGroup: new THREE.Group(),
    };
    built.scene.add(bigCtx.pinGroup);
    built.scene.add(bigCtx.waveGroup);
    built.scene.add(bigCtx.searchPinGroup);

    setupBigLabelLayer(container);
    bindPointerEvents(built.renderer.domElement, true);

    // カメラ位置を通常画面から同期
    if (camera) {
      bigCtx.camera.position.copy(camera.position);
      bigCtx.controls.update();
    }

    animateBig();

    // 現在の地震データを描画
    if (window.DataModule) drawQuakes(window.DataModule.getQuakes());
  }

  /* ══════════════════════════════════════════
     タイル（テクスチャ）切り替え
  ══════════════════════════════════════════ */
  function switchTile(type) {
    currentTileType = type;
    if (globeMat) loadTexture(globeMat, type);
    if (bigCtx?.globeMat) loadTexture(bigCtx.globeMat, type);

    // 衛星モード以外はラベルを自動オフ
    if (type !== 'satellite' && showLabels) {
      showLabels = false;
      updateLabelToggleUI();
      refreshLabelVisibility();
    }
    // 地名ボタンの表示/非表示を更新
    updateLabelToggleUI();
  }

  /* ══════════════════════════════════════════
     ピン（Sprite）生成 — sizeAttenuation:false で画面上一定サイズ
  ══════════════════════════════════════════ */
  function makePinCanvas(color, withDot) {
    const S = 64;
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const ctx = c.getContext('2d');
    // 外周グロー
    const grad = ctx.createRadialGradient(S/2, S/2, 0, S/2, S/2, S/2);
    grad.addColorStop(0,   color);
    grad.addColorStop(0.50, color);
    grad.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(S/2, S/2, S/2, 0, Math.PI*2); ctx.fill();
    if (withDot !== false) {
      // 中央白点
      ctx.beginPath(); ctx.arc(S/2, S/2, S*0.15, 0, Math.PI*2);
      ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.lineWidth = 2.5; ctx.strokeStyle = color; ctx.stroke();
    }
    return c;
  }

  function makeSprite(color, sizeScale) {
    const tex = new THREE.CanvasTexture(makePinCanvas(color, true));
    const mat = new THREE.SpriteMaterial({
      map: tex, depthTest: true, depthWrite: false,
      sizeAttenuation: false, transparent: true,
    });
    const sp = new THREE.Sprite(mat);
    const s = (G().PIN_PIXEL_SIZE / 700) * (sizeScale || 1);
    sp.scale.set(s, s, 1);
    sp.renderOrder = 999;
    return sp;
  }

  /* ══════════════════════════════════════════
     地震マーカー描画
  ══════════════════════════════════════════ */
  function drawQuakes(quakes) {
    clearGroup(pinGroup);
    clearGroup(waveGroup);
    if (bigCtx) { clearGroup(bigCtx.pinGroup); clearGroup(bigCtx.waveGroup); }

    if (!quakes || !quakes.length) return;

    const showEpi  = document.getElementById('showEpicenter')?.checked !== false;
    const showWave = document.getElementById('showWave')?.checked !== false;

    quakes.forEach((q, i) => {
      const { lat, lng, mag } = q;
      if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return;

      const pos  = latLngToVec3(lat, lng, RADIUS * 1.002);
      const col  = CONFIG.MAG_COLOR(mag);
      const sc   = 0.55 + Math.min(mag, 8.5) * 0.13;

      if (showEpi) {
        const sp = makeSprite(col, sc);
        sp.position.copy(pos);
        sp.userData = { q, kind: 'quake' };
        pinGroup.add(sp);

        if (bigCtx) {
          const sp2 = makeSprite(col, sc);
          sp2.position.copy(pos);
          sp2.userData = { q };
          bigCtx.pinGroup.add(sp2);
        }
      }

      if (showWave && i < 6) {
        spawnWaves(pos, mag, i, waveGroup);
        if (bigCtx) spawnWaves(pos, mag, i, bigCtx.waveGroup);
      }
    });
  }

  function clearGroup(grp) {
    if (!grp) return;
    while (grp.children.length) {
      const o = grp.children.pop();
      o.material?.map?.dispose?.();
      o.material?.dispose?.();
      o.geometry?.dispose?.();
    }
  }

  /* ══════════════════════════════════════════
     波紋アニメーション
  ══════════════════════════════════════════ */
  function spawnWaves(center, mag, idx, grp) {
    const color = CONFIG.MAG_COLOR(mag);
    const waves = mag >= 5 ? 3 : 2;
    for (let w = 0; w < waves; w++) {
      setTimeout(() => spawnOneWave(center, mag, color, grp), idx * 200 + w * 380);
    }
  }

  function spawnOneWave(center, mag, color, grp) {
    const S = 128;
    const cv = document.createElement('canvas');
    cv.width = S; cv.height = S;
    const ctx = cv.getContext('2d');
    ctx.strokeStyle = color;
    ctx.lineWidth   = 5;
    ctx.beginPath(); ctx.arc(S/2, S/2, S/2 - 5, 0, Math.PI*2); ctx.stroke();

    const tex  = new THREE.CanvasTexture(cv);
    const mat  = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.7,
                                             sizeAttenuation: true, depthWrite: false });
    const sp   = new THREE.Sprite(mat);
    sp.position.copy(center);
    const base = 1.5 + CONFIG.MAG_RADIUS(mag) * 0.08;
    sp.scale.set(base, base, 1);
    grp.add(sp);

    const maxS = base * (mag >= 5 ? 16 : 10);
    const dur  = 2400;
    const t0   = performance.now();
    (function step(now) {
      const t = Math.min(1, (now - t0) / dur);
      const s = base + (maxS - base) * t;
      sp.scale.set(s, s, 1);
      mat.opacity = 0.65 * (1 - t);
      if (t < 1 && sp.parent) requestAnimationFrame(step);
      else if (sp.parent) {
        sp.parent.remove(sp);
        tex.dispose(); mat.dispose();
      }
    })(t0);
  }

  /* ══════════════════════════════════════════
     検索ピン（地名ヒット時）
  ══════════════════════════════════════════ */
  function setSearchPin(lat, lng, label) {
    clearGroup(searchPinGroup);
    if (bigCtx) clearGroup(bigCtx.searchPinGroup);

    const pos = latLngToVec3(lat, lng, RADIUS * 1.003);

    const sp = makeSprite('#22c55e', 1.25);
    sp.position.copy(pos);
    searchPinGroup.add(sp);

    if (bigCtx) {
      const sp2 = makeSprite('#22c55e', 1.25);
      sp2.position.copy(pos);
      bigCtx.searchPinGroup.add(sp2);
    }

    addOrUpdateSearchLabel(lat, lng, label);
  }

  function clearSearchPin() {
    clearGroup(searchPinGroup);
    if (bigCtx) clearGroup(bigCtx.searchPinGroup);
    removeSearchLabel();
  }

  /* ══════════════════════════════════════════
     ヒートマップ
  ══════════════════════════════════════════ */
  function toggleHeatmap(quakes) {
    if (!isHeatmap) {
      isHeatmap = true;
      document.getElementById('btnHeatmap')?.classList.add('active');
      clearGroup(pinGroup);
      if (bigCtx) clearGroup(bigCtx.pinGroup);
      quakes.forEach(q => {
        if (q.lat == null || q.lng == null) return;
        const pos = latLngToVec3(q.lat, q.lng, RADIUS * 1.001);
        const col = CONFIG.MAG_COLOR(q.mag);
        const sc  = 1.2 + Math.min(q.mag, 8) * 0.28;
        const sp  = makeSprite(col, sc);
        sp.material.opacity = 0.22;
        sp.position.copy(pos);
        pinGroup.add(sp);
        if (bigCtx) {
          const sp2 = makeSprite(col, sc);
          sp2.material.opacity = 0.22;
          sp2.position.copy(pos);
          bigCtx.pinGroup.add(sp2);
        }
      });
    } else {
      isHeatmap = false;
      document.getElementById('btnHeatmap')?.classList.remove('active');
      if (window.DataModule) window.DataModule.redraw();
    }
  }

  /* ══════════════════════════════════════════
     カメラ飛行（スムーズアニメーション）
  ══════════════════════════════════════════ */
  function flyTo(lat, lng, legacyZoom, dist) {
    const d = dist != null ? dist : zoomToDist(legacyZoom);
    _camFly(camera, controls, lat, lng, d);
    if (bigCtx) _camFly(bigCtx.camera, bigCtx.controls, lat, lng, d);
  }

  function focusQuake(lat, lng, mag) {
    const d = mag >= 6 ? 135 : mag >= 5 ? 160 : mag >= 4 ? 190 : 210;
    flyTo(lat, lng, null, d);
  }

  function resetView() {
    flyTo(36.5, 138.0, null, G().DEFAULT_DIST);
  }

  function zoomToDist(zoom) {
    if (zoom == null) return G().DEFAULT_DIST;
    const z = Math.max(3, Math.min(12, zoom));
    const t = (z - 3) / 9;
    return G().MAX_ZOOM_DIST - t * (G().MAX_ZOOM_DIST - G().MIN_ZOOM_DIST - 40);
  }

  function _camFly(cam, ctrl, lat, lng, distance) {
    if (!cam || !ctrl) return;
    const target = latLngToVec3(lat, lng, distance);
    const start  = cam.position.clone();
    const t0     = performance.now();
    const DUR    = 1100;
    ctrl.enabled = false;
    (function step(now) {
      const raw  = Math.min(1, (now - t0) / DUR);
      const ease = raw < 0.5 ? 2*raw*raw : 1 - Math.pow(-2*raw+2, 2)/2;
      cam.position.lerpVectors(start, target, ease);
      cam.lookAt(0, 0, 0);
      if (raw < 1) requestAnimationFrame(step);
      else { ctrl.target.set(0,0,0); ctrl.enabled = true; ctrl.update(); }
    })(t0);
  }

  /* ══════════════════════════════════════════
     ツールバーバインド
  ══════════════════════════════════════════ */
  function bindToolbar() {
    const setActive = id => {
      ['btn2d','btnSatellite','btnTerrain'].forEach(b =>
        document.getElementById(b)?.classList.remove('active'));
      document.getElementById(id)?.classList.add('active');
    };

    document.getElementById('btn2d')?.addEventListener('click', () => { switchTile('standard'); setActive('btn2d'); });
    document.getElementById('btnSatellite')?.addEventListener('click', () => { switchTile('satellite'); setActive('btnSatellite'); });
    document.getElementById('btnTerrain')?.addEventListener('click', () => { switchTile('terrain'); setActive('btnTerrain'); });
    document.getElementById('btnReset')?.addEventListener('click', resetView);
    document.getElementById('btnHeatmap')?.addEventListener('click', () => {
      if (window.DataModule) toggleHeatmap(window.DataModule.getQuakes());
    });
    document.getElementById('btnLabels')?.addEventListener('click', () => {
      showLabels = !showLabels;
      updateLabelToggleUI();
      refreshLabelVisibility();
    });

    updateLabelToggleUI(); // 初期状態（衛星でないのでボタン隠す）
  }

  function updateLabelToggleUI() {
    const btn = document.getElementById('btnLabels');
    if (!btn) return;
    btn.classList.toggle('active', showLabels);
    // 衛星モードのときだけラベルボタンを表示
    btn.style.display = (currentTileType === 'satellite') ? '' : 'none';
  }

  /* ══════════════════════════════════════════
     レイヤーチェックボックス
  ══════════════════════════════════════════ */
  function bindLayerToggles() {
    document.getElementById('showFault')?.addEventListener('change', e => {
      if (e.target.checked) scene.add(faultGroup); else scene.remove(faultGroup);
    });
    document.getElementById('showPlate')?.addEventListener('change', e => {
      if (e.target.checked) scene.add(plateGroup); else scene.remove(plateGroup);
    });
    ['showEpicenter','showWave'].forEach(id => {
      document.getElementById(id)?.addEventListener('change', () => window.DataModule?.redraw());
    });
  }

  /* ══════════════════════════════════════════
     断層線
  ══════════════════════════════════════════ */
  function drawFaultLines(grp) {
    const faults = [
      [[33.5,130.3],[33.8,131.0],[34.2,132.0],[34.6,133.5],[34.9,135.0],[35.0,136.2]],
      [[36.8,137.9],[35.8,138.1],[35.2,138.4],[34.9,138.6]],
      [[34.6,134.9],[34.8,135.1]],
      [[34.8,135.2],[34.9,135.6]],
    ];
    faults.forEach(coords => addLine(grp, coords, 0xff3333, true));
  }

  function drawPlateBoundaries(grp) {
    const plates = [
      { c: [[45,150],[42,145],[38,142],[35,142],[33,142],[30,140],[28,138]], col: 0x3b82f6 },
      { c: [[35,140],[34,138],[33,136],[32,133],[31,131],[30,128]], col: 0xa855f7 },
    ];
    plates.forEach(p => addLine(grp, p.c, p.col, true));
  }

  function addLine(grp, coords, color, dashed) {
    const pts = coords.map(([la,ln]) => latLngToVec3(la, ln, RADIUS * 1.002));
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = dashed
      ? new THREE.LineDashedMaterial({ color, dashSize: 2.5, gapSize: 1.5, transparent: true, opacity: 0.8 })
      : new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 });
    const line = new THREE.Line(geo, mat);
    if (dashed) line.computeLineDistances();
    grp.add(line);
  }

  /* ══════════════════════════════════════════
     クリックでポップアップ
  ══════════════════════════════════════════ */
  function bindPointerEvents(domEl, isBig) {
    domEl.addEventListener('click', e => {
      const rect = domEl.getBoundingClientRect();
      const ndc  = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width)  * 2 - 1,
       -((e.clientY - rect.top)  / rect.height) * 2 + 1
      );
      const cam = isBig ? bigCtx?.camera : camera;
      const grp = isBig ? bigCtx?.pinGroup : pinGroup;
      if (!cam || !grp) return;
      const rc = new THREE.Raycaster();
      rc.setFromCamera(ndc, cam);
      const hits = rc.intersectObjects(grp.children, false);
      if (hits.length) {
        const q = hits[0].object.userData?.q;
        if (q) showModal(q);
      }
    });
  }

  function showModal(q) {
    const intensity = CONFIG.MAG_TO_INTENSITY ? CONFIG.MAG_TO_INTENSITY(q.mag) : '';
    const depth = q.depth != null ? q.depth + ' km' : '不明';
    const time  = formatTime(q.time);
    const info  = [
      `M${q.mag.toFixed(1)}${intensity ? ' (推定震度' + intensity + ')' : ''}`,
      q.place || '',
      `深さ: ${depth}`,
      time,
    ].filter(Boolean).join('\n');

    // 既存の UIModule.showQuakeDetail が存在すれば使う、なければ alert フォールバック
    if (window.UIModule?.showQuakeDetail) {
      window.UIModule.showQuakeDetail(q);
    } else {
      alert(info);
    }
  }

  /* ══════════════════════════════════════════
     地名ラベル（DOM オーバーレイ）
  ══════════════════════════════════════════ */
  const LABEL_PLACES = [
    { n:'東京',      lat:35.69, lng:139.69, k:'city'    },
    { n:'大阪',      lat:34.69, lng:135.52, k:'city'    },
    { n:'札幌',      lat:43.06, lng:141.35, k:'city'    },
    { n:'名古屋',    lat:35.18, lng:136.91, k:'city'    },
    { n:'福岡',      lat:33.59, lng:130.40, k:'city'    },
    { n:'那覇',      lat:26.21, lng:127.68, k:'city'    },
    { n:'仙台',      lat:38.27, lng:140.87, k:'city'    },
    { n:'ソウル',    lat:37.57, lng:126.98, k:'city'    },
    { n:'北京',      lat:39.90, lng:116.41, k:'city'    },
    { n:'上海',      lat:31.23, lng:121.47, k:'city'    },
    { n:'台北',      lat:25.03, lng:121.57, k:'city'    },
    { n:'香港',      lat:22.32, lng:114.17, k:'city'    },
    { n:'マニラ',    lat:14.60, lng:120.98, k:'city'    },
    { n:'バンコク',  lat:13.76, lng:100.50, k:'city'    },
    { n:'シンガポール', lat:1.35, lng:103.82, k:'city'  },
    { n:'ジャカルタ', lat:-6.21, lng:106.85, k:'city'   },
    { n:'デリー',    lat:28.61, lng:77.21,  k:'city'    },
    { n:'ムンバイ',  lat:19.08, lng:72.88,  k:'city'    },
    { n:'モスクワ',  lat:55.76, lng:37.62,  k:'city'    },
    { n:'ロンドン',  lat:51.51, lng:-0.13,  k:'city'    },
    { n:'パリ',      lat:48.86, lng:2.35,   k:'city'    },
    { n:'ベルリン',  lat:52.52, lng:13.41,  k:'city'    },
    { n:'ローマ',    lat:41.90, lng:12.50,  k:'city'    },
    { n:'マドリード', lat:40.42, lng:-3.70, k:'city'    },
    { n:'カイロ',    lat:30.04, lng:31.24,  k:'city'    },
    { n:'ナイロビ',  lat:-1.29, lng:36.82,  k:'city'    },
    { n:'ニューヨーク', lat:40.71, lng:-74.01, k:'city' },
    { n:'ロサンゼルス', lat:34.05, lng:-118.24, k:'city'},
    { n:'シカゴ',    lat:41.88, lng:-87.63, k:'city'    },
    { n:'メキシコシティ', lat:19.43, lng:-99.13, k:'city'},
    { n:'サンパウロ', lat:-23.55, lng:-46.63, k:'city'  },
    { n:'ブエノスアイレス', lat:-34.60, lng:-58.38, k:'city'},
    { n:'シドニー',  lat:-33.87, lng:151.21, k:'city'   },
    { n:'オークランド', lat:-36.85, lng:174.76, k:'city'},
    { n:'アンカレジ', lat:61.22, lng:-149.90, k:'city'  },
    { n:'カトマンズ', lat:27.70, lng:85.32,  k:'city'   },
    { n:'テヘラン',  lat:35.69, lng:51.39,   k:'city'   },
    { n:'イスタンブール', lat:41.01, lng:28.98, k:'city'},
    // 国名ラベル
    { n:'日本',        lat:36.5, lng:138.0, k:'country' },
    { n:'中国',        lat:35.0, lng:103.0, k:'country' },
    { n:'ロシア',      lat:61.5, lng:90.0,  k:'country' },
    { n:'インド',      lat:22.0, lng:79.0,  k:'country' },
    { n:'アメリカ合衆国', lat:39.5, lng:-98.5, k:'country' },
    { n:'カナダ',      lat:56.0, lng:-106.0, k:'country' },
    { n:'ブラジル',    lat:-10.0, lng:-52.0, k:'country' },
    { n:'オーストラリア', lat:-25.0, lng:134.0, k:'country' },
    { n:'インドネシア', lat:-2.5, lng:117.0,  k:'country' },
    { n:'フィリピン',  lat:12.8,  lng:122.0,  k:'country' },
    { n:'アルゼンチン', lat:-35.0, lng:-65.0, k:'country' },
    { n:'チリ',        lat:-33.0, lng:-71.0,  k:'country' },
    { n:'ペルー',      lat:-10.0, lng:-76.0,  k:'country' },
    { n:'コロンビア',  lat:4.0,   lng:-74.0,  k:'country' },
    { n:'メキシコ',    lat:23.6,  lng:-102.5, k:'country' },
    { n:'イギリス',    lat:54.0,  lng:-2.0,   k:'country' },
    { n:'フランス',    lat:46.5,  lng:2.5,    k:'country' },
    { n:'ドイツ',      lat:51.0,  lng:10.0,   k:'country' },
    { n:'イタリア',    lat:42.0,  lng:13.0,   k:'country' },
    { n:'スペイン',    lat:40.0,  lng:-3.5,   k:'country' },
    { n:'エジプト',    lat:26.0,  lng:30.0,   k:'country' },
    { n:'南アフリカ',  lat:-29.0, lng:24.0,   k:'country' },
    { n:'エチオピア',  lat:9.0,   lng:40.0,   k:'country' },
    { n:'ナイジェリア', lat:9.0,  lng:8.0,    k:'country' },
    { n:'トルコ',      lat:39.0,  lng:35.0,   k:'country' },
    { n:'イラン',      lat:32.0,  lng:53.0,   k:'country' },
    { n:'サウジアラビア', lat:24.0, lng:45.0, k:'country' },
    { n:'パキスタン',  lat:30.0,  lng:70.0,   k:'country' },
    { n:'ニュージーランド', lat:-41.0, lng:174.0, k:'country' },
    { n:'韓国',        lat:36.5,  lng:127.8,  k:'country' },
    { n:'台湾',        lat:23.7,  lng:121.0,  k:'country' },
    { n:'ベトナム',    lat:14.0,  lng:108.0,  k:'country' },
    { n:'タイ',        lat:15.0,  lng:100.5,  k:'country' },
    { n:'マレーシア',  lat:4.0,   lng:109.0,  k:'country' },
    { n:'ミャンマー',  lat:17.0,  lng:96.0,   k:'country' },
    { n:'カザフスタン', lat:48.0, lng:68.0,   k:'country' },
    { n:'ウクライナ',  lat:49.0,  lng:32.0,   k:'country' },
    { n:'スウェーデン', lat:62.0, lng:17.0,   k:'country' },
    { n:'ノルウェー',  lat:65.0,  lng:13.0,   k:'country' },
    { n:'フィンランド', lat:64.0, lng:26.0,   k:'country' },
    { n:'アラスカ',    lat:64.0, lng:-153.0,  k:'country' },
    { n:'グリーンランド', lat:72.0, lng:-42.0, k:'country' },
    { n:'アイスランド', lat:65.0, lng:-19.0,  k:'country' },
    { n:'モロッコ',    lat:32.0,  lng:-5.5,   k:'country' },
    { n:'アルジェリア', lat:28.0, lng:3.0,    k:'country' },
    { n:'リビア',      lat:26.0,  lng:17.0,   k:'country' },
    { n:'スーダン',    lat:15.0,  lng:30.0,   k:'country' },
    { n:'アンゴラ',    lat:-12.0, lng:18.5,   k:'country' },
    { n:'コンゴ',      lat:-4.0,  lng:22.0,   k:'country' },
    { n:'マダガスカル', lat:-20.0, lng:47.0,  k:'country' },
    { n:'ネパール',    lat:28.0,  lng:84.0,   k:'country' },
  ];

  function setupLabelLayer() {
    labelLayer = document.createElement('div');
    labelLayer.className = 'globe-label-layer';
    containerEl.style.position = 'relative';
    containerEl.appendChild(labelLayer);
    LABEL_PLACES.forEach(p => {
      const el = document.createElement('div');
      el.className = 'globe-label globe-label-' + p.k;
      el.textContent = p.n;
      el.style.display = 'none';
      el.style.pointerEvents = 'none';
      labelLayer.appendChild(el);
      labelEntries.push({ el, lat: p.lat, lng: p.lng, isBig: false });
    });
  }

  function setupBigLabelLayer(container) {
    bigLabelLayer = document.createElement('div');
    bigLabelLayer.className = 'globe-label-layer';
    container.style.position = 'relative';
    container.appendChild(bigLabelLayer);
    LABEL_PLACES.forEach(p => {
      const el = document.createElement('div');
      el.className = 'globe-label globe-label-' + p.k;
      el.textContent = p.n;
      el.style.display = 'none';
      el.style.pointerEvents = 'none';
      bigLabelLayer.appendChild(el);
      labelEntries.push({ el, lat: p.lat, lng: p.lng, isBig: true });
    });
  }

  let _searchLabels = [];
  function addOrUpdateSearchLabel(lat, lng, text) {
    removeSearchLabel();
    [{ layer: labelLayer, isBig: false }, { layer: bigLabelLayer, isBig: true }].forEach(({ layer, isBig }) => {
      if (!layer) return;
      const el = document.createElement('div');
      el.className = 'globe-label globe-label-search';
      el.textContent = '📍 ' + text;
      el.style.display = 'none';
      el.style.pointerEvents = 'none';
      layer.appendChild(el);
      _searchLabels.push(el);
      labelEntries.push({ el, lat, lng, isBig, alwaysOn: true });
    });
  }

  function removeSearchLabel() {
    labelEntries = labelEntries.filter(e => {
      if (e.alwaysOn) { e.el?.remove(); return false; }
      return true;
    });
    _searchLabels = [];
  }

  function refreshLabelVisibility() {
    labelEntries.forEach(e => {
      if (e.alwaysOn) return;
      if (!showLabels) e.el.style.display = 'none';
    });
  }

  /* 各フレームでラベル位置を射影 */
  function updateLabels(cam, isBig) {
    if (!cam) return;
    const domEl  = isBig ? bigCtx?.renderer?.domElement : renderer?.domElement;
    if (!domEl) return;
    const W = domEl.clientWidth, H = domEl.clientHeight;
    if (!W || !H) return;

    const camDir = cam.position.clone().normalize();

    labelEntries.forEach(e => {
      if (e.isBig !== isBig) return;
      const visible = e.alwaysOn ? true : showLabels;
      if (!visible) { e.el.style.display = 'none'; return; }

      const pos3 = latLngToVec3(e.lat, e.lng, RADIUS * 1.01);
      const facing = pos3.clone().normalize().dot(camDir);

      if (facing < 0.08) { e.el.style.display = 'none'; return; }

      const proj = pos3.clone().project(cam);
      if (proj.z > 1) { e.el.style.display = 'none'; return; }

      const x = (proj.x * 0.5 + 0.5) * W;
      const y = (-proj.y * 0.5 + 0.5) * H;
      e.el.style.display = 'block';
      e.el.style.left  = '0';
      e.el.style.top   = '0';
      e.el.style.transform = `translate(${x}px,${y}px) translate(-50%,-100%)`;
      e.el.style.opacity = String(Math.min(1, (facing - 0.08) / 0.25));
    });
  }

  /* ══════════════════════════════════════════
     アニメーションループ
  ══════════════════════════════════════════ */
  function animate() {
    requestAnimationFrame(animate);
    if (cloudsMesh) cloudsMesh.rotation.y += 0.00016;
    controls?.update();
    updateLabels(camera, false);
    if (renderer && scene && camera) renderer.render(scene, camera);
  }

  function animateBig() {
    if (!bigCtx) return;
    requestAnimationFrame(animateBig);
    if (bigCtx.cloudsMesh) bigCtx.cloudsMesh.rotation.y += 0.00016;
    bigCtx.controls?.update();
    updateLabels(bigCtx.camera, true);
    bigCtx.renderer.render(bigCtx.scene, bigCtx.camera);
  }

  /* ══════════════════════════════════════════
     リサイズ
  ══════════════════════════════════════════ */
  function onResize() {
    if (containerEl && camera && renderer) {
      const w = containerEl.clientWidth, h = containerEl.clientHeight;
      if (w && h) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      }
    }
    if (bigCtx?.container) {
      const c = bigCtx.container;
      const w = c.clientWidth, h = c.clientHeight;
      if (w && h) {
        bigCtx.camera.aspect = w / h;
        bigCtx.camera.updateProjectionMatrix();
        bigCtx.renderer.setSize(w, h);
      }
    }
  }

  /* ══════════════════════════════════════════
     ユーティリティ
  ══════════════════════════════════════════ */
  function formatTime(t) {
    if (!t) return '不明';
    const d = new Date(t);
    const p = n => String(n).padStart(2,'0');
    return `${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  /* ══════════════════════════════════════════
     公開 API
  ══════════════════════════════════════════ */
  return {
    init, initBigMap, drawQuakes, focusQuake, flyTo, resetView,
    toggleHeatmap, setSearchPin, clearSearchPin, formatTime, latLngToVec3,
  };
})();
