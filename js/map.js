/**
 * map.js — 3D地球儀モジュール (Three.js)
 *
 * OrbitControls を完全インライン実装 → 外部CDN依存ゼロ
 * Three.js 本体のみ cdnjs から読み込めばOK
 */

/* ──────────────────────────────────────────────
   OrbitControls をインライン定義
   THREE.OrbitControls として登録
────────────────────────────────────────────── */
(function () {
  if (typeof THREE === 'undefined') return;
  if (THREE.OrbitControls) return; // 既に存在する場合はスキップ

  THREE.OrbitControls = function (camera, domElement) {
    this.camera     = camera;
    this.domElement = domElement;
    this.enabled    = true;
    this.target     = new THREE.Vector3();

    this.minDistance = 0;
    this.maxDistance = Infinity;
    this.enableDamping  = false;
    this.dampingFactor  = 0.05;
    this.rotateSpeed    = 0.5;
    this.zoomSpeed      = 1.0;
    this.enablePan      = false;
    this.autoRotate     = false;
    this.autoRotateSpeed = 2.0;

    var scope    = this;
    var STATE    = { NONE: -1, ROTATE: 0, DOLLY: 1 };
    var state    = STATE.NONE;
    var spherical     = new THREE.Spherical();
    var sphericalDelta = new THREE.Spherical();
    var scale    = 1;
    var rotateStart = new THREE.Vector2();
    var rotateEnd   = new THREE.Vector2();
    var rotateDelta = new THREE.Vector2();
    var dollyStart  = new THREE.Vector2();
    var dollyEnd    = new THREE.Vector2();
    var dollyDelta  = new THREE.Vector2();

    function getAutoRotationAngle() {
      return 2 * Math.PI / 60 / 60 * scope.autoRotateSpeed;
    }
    function getZoomScale() { return Math.pow(0.95, scope.zoomSpeed); }

    function rotateLeft(angle) { sphericalDelta.theta -= angle; }
    function rotateUp(angle)   { sphericalDelta.phi   -= angle; }
    function dollyIn(s)  { scale /= s; }
    function dollyOut(s) { scale *= s; }

    this.update = function () {
      var offset   = new THREE.Vector3();
      var quat     = new THREE.Quaternion().setFromUnitVectors(camera.up, new THREE.Vector3(0, 1, 0));
      var quatInv  = quat.clone().invert();
      var lastPos  = new THREE.Vector3();

      return function update() {
        var position = scope.camera.position;
        offset.copy(position).sub(scope.target);
        offset.applyQuaternion(quat);
        spherical.setFromVector3(offset);

        if (scope.autoRotate && state === STATE.NONE) {
          rotateLeft(getAutoRotationAngle());
        }

        if (scope.enableDamping) {
          spherical.theta += sphericalDelta.theta * scope.dampingFactor;
          spherical.phi   += sphericalDelta.phi   * scope.dampingFactor;
        } else {
          spherical.theta += sphericalDelta.theta;
          spherical.phi   += sphericalDelta.phi;
        }

        spherical.phi = Math.max(0.01, Math.min(Math.PI - 0.01, spherical.phi));
        spherical.radius *= scale;
        spherical.radius  = Math.max(scope.minDistance, Math.min(scope.maxDistance, spherical.radius));

        offset.setFromSpherical(spherical);
        offset.applyQuaternion(quatInv);
        position.copy(scope.target).add(offset);
        scope.camera.lookAt(scope.target);

        if (scope.enableDamping) {
          sphericalDelta.theta *= (1 - scope.dampingFactor);
          sphericalDelta.phi   *= (1 - scope.dampingFactor);
        } else {
          sphericalDelta.set(0, 0, 0);
        }
        scale = 1;
      };
    }();

    // ── ポインターイベント ──
    function onMouseDown(e) {
      if (!scope.enabled) return;
      e.preventDefault();
      if (e.button === 0) {
        state = STATE.ROTATE;
        rotateStart.set(e.clientX, e.clientY);
      } else if (e.button === 1) {
        state = STATE.DOLLY;
        dollyStart.set(e.clientX, e.clientY);
      }
      document.addEventListener('mousemove', onMouseMove, false);
      document.addEventListener('mouseup',   onMouseUp,   false);
    }

    function onMouseMove(e) {
      if (!scope.enabled) return;
      e.preventDefault();
      var el = scope.domElement;
      if (state === STATE.ROTATE) {
        rotateEnd.set(e.clientX, e.clientY);
        rotateDelta.subVectors(rotateEnd, rotateStart).multiplyScalar(scope.rotateSpeed);
        rotateLeft(2 * Math.PI * rotateDelta.x / el.clientWidth);
        rotateUp(2 * Math.PI * rotateDelta.y / el.clientHeight);
        rotateStart.copy(rotateEnd);
        scope.update();
      } else if (state === STATE.DOLLY) {
        dollyEnd.set(e.clientX, e.clientY);
        dollyDelta.subVectors(dollyEnd, dollyStart);
        if (dollyDelta.y > 0) dollyIn(getZoomScale());
        else if (dollyDelta.y < 0) dollyOut(getZoomScale());
        dollyStart.copy(dollyEnd);
        scope.update();
      }
    }

    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove, false);
      document.removeEventListener('mouseup',   onMouseUp,   false);
      state = STATE.NONE;
    }

    function onWheel(e) {
      if (!scope.enabled) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.deltaY < 0) dollyOut(getZoomScale());
      else              dollyIn(getZoomScale());
      scope.update();
    }

    // タッチ
    var touch1 = new THREE.Vector2(), touch2 = new THREE.Vector2();
    var prevDist = 0;

    function onTouchStart(e) {
      if (!scope.enabled) return;
      if (e.touches.length === 1) {
        state = STATE.ROTATE;
        rotateStart.set(e.touches[0].clientX, e.touches[0].clientY);
      } else if (e.touches.length === 2) {
        state = STATE.DOLLY;
        touch1.set(e.touches[0].clientX, e.touches[0].clientY);
        touch2.set(e.touches[1].clientX, e.touches[1].clientY);
        prevDist = touch1.distanceTo(touch2);
      }
    }

    function onTouchMove(e) {
      if (!scope.enabled) return;
      e.preventDefault();
      var el = scope.domElement;
      if (e.touches.length === 1 && state === STATE.ROTATE) {
        rotateEnd.set(e.touches[0].clientX, e.touches[0].clientY);
        rotateDelta.subVectors(rotateEnd, rotateStart).multiplyScalar(scope.rotateSpeed);
        rotateLeft(2 * Math.PI * rotateDelta.x / el.clientWidth);
        rotateUp(2 * Math.PI * rotateDelta.y / el.clientHeight);
        rotateStart.copy(rotateEnd);
        scope.update();
      } else if (e.touches.length === 2 && state === STATE.DOLLY) {
        touch1.set(e.touches[0].clientX, e.touches[0].clientY);
        touch2.set(e.touches[1].clientX, e.touches[1].clientY);
        var dist = touch1.distanceTo(touch2);
        if (dist > prevDist) dollyOut(getZoomScale());
        else                 dollyIn(getZoomScale());
        prevDist = dist;
        scope.update();
      }
    }

    function onTouchEnd() { state = STATE.NONE; }

    function onContextMenu(e) { if (scope.enabled) e.preventDefault(); }

    domElement.addEventListener('contextmenu', onContextMenu, false);
    domElement.addEventListener('mousedown',   onMouseDown,   false);
    domElement.addEventListener('wheel',       onWheel,       { passive: false });
    domElement.addEventListener('touchstart',  onTouchStart,  { passive: false });
    domElement.addEventListener('touchmove',   onTouchMove,   { passive: false });
    domElement.addEventListener('touchend',    onTouchEnd,    false);

    this.dispose = function () {
      domElement.removeEventListener('contextmenu', onContextMenu);
      domElement.removeEventListener('mousedown',   onMouseDown);
      domElement.removeEventListener('wheel',       onWheel);
      domElement.removeEventListener('touchstart',  onTouchStart);
      domElement.removeEventListener('touchmove',   onTouchMove);
      domElement.removeEventListener('touchend',    onTouchEnd);
    };

    this.update();
  };
})();

/* ══════════════════════════════════════════════════════════
   MapModule — Three.js 3D地球儀
══════════════════════════════════════════════════════════ */
window.MapModule = (() => {
  const RADIUS = 100;
  const G = () => window.CONFIG.GLOBE;

  let scene, camera, renderer, controls;
  let globeMesh, globeMat, cloudsMesh, cloudsMat;
  let pinGroup, waveGroup, faultGroup, plateGroup, searchPinGroup;
  let containerEl;
  let bigCtx = null;
  let currentTileType = 'standard';
  let showLabels = false;
  let isHeatmap  = false;
  let labelLayer = null, bigLabelLayer = null;
  let labelEntries = [];

  /* ── 座標変換 ── */
  function latLngToVec3(lat, lng, r) {
    r = (r != null) ? r : RADIUS;
    const phi   = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
       r * Math.cos(phi),
       r * Math.sin(phi) * Math.sin(theta)
    );
  }

  /* ── 初期化：ResizeObserver で高さ確定を待ってから buildScene ── */
  function init() {
    containerEl = document.getElementById('map');
    if (!containerEl) return;

    if (typeof THREE === 'undefined') {
      containerEl.innerHTML =
        '<div style="color:#f87171;padding:24px;font-size:14px">' +
        '⚠️ Three.js が読み込まれていません。<br>ネット接続を確認してページを再読み込みしてください。</div>';
      return;
    }

    const tryInit = () => {
      const h = containerEl.getBoundingClientRect().height;
      if (h < 10) { requestAnimationFrame(tryInit); return; }
      _doInit();
    };
    tryInit();
  }

  function _doInit() {
    const built = buildScene(containerEl);
    scene = built.scene; camera = built.camera; renderer = built.renderer; controls = built.controls;
    globeMesh = built.globeMesh; globeMat = built.globeMat;
    cloudsMesh = built.cloudsMesh; cloudsMat = built.cloudsMat;

    pinGroup       = new THREE.Group(); scene.add(pinGroup);
    waveGroup      = new THREE.Group(); scene.add(waveGroup);
    faultGroup     = new THREE.Group();
    plateGroup     = new THREE.Group();
    searchPinGroup = new THREE.Group(); scene.add(searchPinGroup);

    drawFaultLines(faultGroup);
    drawPlateBoundaries(plateGroup);
    setupLabelLayer();
    bindToolbar();
    bindLayerToggles();
    bindPointerEvents(renderer.domElement, false);
    window.addEventListener('resize', onResize);

    flyTo(36.5, 138.0, null, G().DEFAULT_DIST);
    animate();
  }

  /* ── シーン構築 ── */
  function buildScene(container) {
    const W = Math.max(container.getBoundingClientRect().width  || 100, 100);
    const H = Math.max(container.getBoundingClientRect().height || 100, 100);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 5000);
    camera.position.set(0, 0, G().DEFAULT_DIST);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x030508, 1);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    /* 星空 */
    const starBgMat = new THREE.MeshBasicMaterial({ color: 0x04050a, side: THREE.BackSide });
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(2500, 32, 32), starBgMat));
    new THREE.TextureLoader().load(G().STARFIELD,
      t => { starBgMat.map = t; starBgMat.color.set(0xffffff); starBgMat.needsUpdate = true; },
      undefined, () => {});
    addPointStars(scene);

    /* 地球本体 */
    const globeGeo = new THREE.SphereGeometry(RADIUS, 96, 96);
    const globeMat = new THREE.MeshPhongMaterial({ color: 0x1a3a5c, shininess: 10 });
    const globeMesh = new THREE.Mesh(globeGeo, globeMat);
    scene.add(globeMesh);
    loadTexture(globeMat, currentTileType);

    /* 雲 */
    const cloudsMat  = new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.25, depthWrite: false });
    const cloudsMesh = new THREE.Mesh(new THREE.SphereGeometry(RADIUS * 1.008, 64, 64), cloudsMat);
    scene.add(cloudsMesh);
    new THREE.TextureLoader().load(G().CLOUDS_MAP,
      t => { cloudsMat.map = t; cloudsMat.needsUpdate = true; }, undefined, () => {});

    /* 大気グロー */
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(RADIUS * 1.14, 48, 48),
      new THREE.ShaderMaterial({
        vertexShader:   'varying vec3 vN; void main(){ vN=normalize(normalMatrix*normal); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
        fragmentShader: 'varying vec3 vN; void main(){ float i=pow(0.58-dot(vN,vec3(0,0,1)),4.); gl_FragColor=vec4(.3,.6,1.,1.)*i; }',
        blending: THREE.AdditiveBlending, side: THREE.BackSide, transparent: true,
      })
    ));

    /* ライト */
    scene.add(new THREE.AmbientLight(0xffffff, 0.55));
    const sun = new THREE.DirectionalLight(0xffffff, 1.0); sun.position.set(300, 150, 200); scene.add(sun);
    const rim = new THREE.DirectionalLight(0x4466bb, 0.22); rim.position.set(-300,-100,-200); scene.add(rim);

    /* OrbitControls（インライン版）*/
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.rotateSpeed   = 0.45;
    controls.zoomSpeed     = 0.75;
    controls.minDistance   = G().MIN_ZOOM_DIST;
    controls.maxDistance   = G().MAX_ZOOM_DIST;
    controls.enablePan     = false;
    controls.target.set(0, 0, 0);

    return { scene, camera, renderer, controls, globeMesh, globeMat, cloudsMesh, cloudsMat };
  }

  function addPointStars(scene) {
    const N = 1800, pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r=1800+Math.random()*100, t=Math.random()*Math.PI*2, p=Math.acos(2*Math.random()-1);
      pos[i*3]=r*Math.sin(p)*Math.cos(t); pos[i*3+1]=r*Math.sin(p)*Math.sin(t); pos[i*3+2]=r*Math.cos(p);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ color:0xffffff, size:1.2, sizeAttenuation:true, transparent:true, opacity:0.85 })));
  }

  /* ── テクスチャ ── */
  function loadTexture(mat, type) {
    const loader = new THREE.TextureLoader();
    const url = (G().TEXTURES[type] || G().TEXTURES.standard);
    loader.load(url,
      t => {
        mat.map = t; mat.color.set(0xffffff);
        if (type === 'terrain')   { mat.color.set(0xc8e8c8); mat.shininess = 2; }
        if (type === 'satellite') { mat.shininess = 28; }
        mat.needsUpdate = true;
      },
      undefined,
      () => { mat.color.set(type==='terrain'?0x3a6b3a:0x1a4a6b); mat.needsUpdate = true; }
    );
    loader.load(G().BUMP_MAP,
      t => { mat.bumpMap=t; mat.bumpScale=type==='terrain'?7:1.8; mat.needsUpdate=true; },
      undefined, ()=>{});
    if (type !== 'terrain') {
      loader.load(G().SPECULAR_MAP,
        t => { mat.specularMap=t; mat.specular=new THREE.Color(0x223344); mat.needsUpdate=true; },
        undefined, ()=>{});
    }
  }

  /* ── 大画面モード ── */
  function initBigMap() {
    const container = document.getElementById('bigMap');
    if (!container) return;
    if (bigCtx) { setTimeout(onResize, 60); return; }
    const tryBuild = () => {
      if (container.getBoundingClientRect().height < 10) { setTimeout(tryBuild, 80); return; }
      const built = buildScene(container);
      bigCtx = { ...built, container,
        pinGroup: new THREE.Group(), waveGroup: new THREE.Group(), searchPinGroup: new THREE.Group() };
      built.scene.add(bigCtx.pinGroup); built.scene.add(bigCtx.waveGroup); built.scene.add(bigCtx.searchPinGroup);
      setupBigLabelLayer(container);
      bindPointerEvents(built.renderer.domElement, true);
      if (camera) { bigCtx.camera.position.copy(camera.position); bigCtx.controls.update(); }
      animateBig();
      if (window.DataModule) drawQuakes(window.DataModule.getQuakes());
    };
    setTimeout(tryBuild, 100);
  }

  /* ── タイル切替 ── */
  function switchTile(type) {
    currentTileType = type;
    if (globeMat) loadTexture(globeMat, type);
    if (bigCtx?.globeMat) loadTexture(bigCtx.globeMat, type);
    if (type !== 'satellite' && showLabels) { showLabels=false; updateLabelToggleUI(); refreshLabelVisibility(); }
    updateLabelToggleUI();
  }

  /* ── ピン（sizeAttenuation:false = 常に一定サイズ）── */
  function makeSprite(color, sizeScale) {
    const S=64, cv=document.createElement('canvas'); cv.width=S; cv.height=S;
    const ctx=cv.getContext('2d');
    const g=ctx.createRadialGradient(S/2,S/2,0,S/2,S/2,S/2);
    g.addColorStop(0,color); g.addColorStop(.5,color); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.beginPath(); ctx.arc(S/2,S/2,S/2,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(S/2,S/2,S*.15,0,Math.PI*2);
    ctx.fillStyle='#fff'; ctx.fill(); ctx.lineWidth=2.5; ctx.strokeStyle=color; ctx.stroke();
    const mat=new THREE.SpriteMaterial({ map:new THREE.CanvasTexture(cv), sizeAttenuation:false, transparent:true, depthTest:true, depthWrite:false });
    const sp=new THREE.Sprite(mat);
    const s=(G().PIN_PIXEL_SIZE/700)*(sizeScale||1);
    sp.scale.set(s,s,1); sp.renderOrder=999;
    return sp;
  }

  /* ── 地震マーカー ── */
  function drawQuakes(quakes) {
    clearGroup(pinGroup); clearGroup(waveGroup);
    if (bigCtx) { clearGroup(bigCtx.pinGroup); clearGroup(bigCtx.waveGroup); }
    if (!quakes?.length) return;

    const showEpi  = document.getElementById('showEpicenter')?.checked !== false;
    const showWave = document.getElementById('showWave')?.checked !== false;

    quakes.forEach((q, i) => {
      if (q.lat==null||q.lng==null||isNaN(q.lat)||isNaN(q.lng)) return;
      const pos=latLngToVec3(q.lat,q.lng,RADIUS*1.002);
      const col=CONFIG.MAG_COLOR(q.mag);
      const sc=0.55+Math.min(q.mag,8.5)*0.13;
      if (showEpi) {
        const sp=makeSprite(col,sc); sp.position.copy(pos); sp.userData={q}; pinGroup.add(sp);
        if (bigCtx) { const sp2=makeSprite(col,sc); sp2.position.copy(pos); sp2.userData={q}; bigCtx.pinGroup.add(sp2); }
      }
      if (showWave&&i<6) { spawnWaves(pos,q.mag,i,waveGroup); if(bigCtx) spawnWaves(pos,q.mag,i,bigCtx.waveGroup); }
    });
  }

  function clearGroup(g) {
    if(!g)return;
    while(g.children.length){ const o=g.children.pop(); o.material?.map?.dispose?.(); o.material?.dispose?.(); o.geometry?.dispose?.(); }
  }

  /* ── 波紋 ── */
  function spawnWaves(center, mag, idx, grp) {
    const color=CONFIG.MAG_COLOR(mag), waves=mag>=5?3:2;
    for(let w=0;w<waves;w++) setTimeout(()=>_wave(center,mag,color,grp), idx*200+w*380);
  }
  function _wave(center,mag,color,grp) {
    const S=128,cv=document.createElement('canvas'); cv.width=S; cv.height=S;
    const ctx=cv.getContext('2d'); ctx.strokeStyle=color; ctx.lineWidth=5;
    ctx.beginPath(); ctx.arc(S/2,S/2,S/2-5,0,Math.PI*2); ctx.stroke();
    const tex=new THREE.CanvasTexture(cv);
    const mat=new THREE.SpriteMaterial({map:tex,transparent:true,opacity:.7,sizeAttenuation:true,depthWrite:false});
    const sp=new THREE.Sprite(mat); sp.position.copy(center);
    const base=1.5+CONFIG.MAG_RADIUS(mag)*.08; sp.scale.set(base,base,1); grp.add(sp);
    const maxS=base*(mag>=5?16:10), dur=2400, t0=performance.now();
    (function step(now){ const t=Math.min(1,(now-t0)/dur); sp.scale.set(base+(maxS-base)*t,base+(maxS-base)*t,1); mat.opacity=.65*(1-t);
      if(t<1&&sp.parent) requestAnimationFrame(step);
      else if(sp.parent){ sp.parent.remove(sp); tex.dispose(); mat.dispose(); }
    })(t0);
  }

  /* ── 検索ピン ── */
  function setSearchPin(lat,lng,label) {
    clearGroup(searchPinGroup); if(bigCtx) clearGroup(bigCtx.searchPinGroup);
    const pos=latLngToVec3(lat,lng,RADIUS*1.003);
    const sp=makeSprite('#22c55e',1.3); sp.position.copy(pos); searchPinGroup.add(sp);
    if(bigCtx){ const sp2=makeSprite('#22c55e',1.3); sp2.position.copy(pos); bigCtx.searchPinGroup.add(sp2); }
    addOrUpdateSearchLabel(lat,lng,label);
  }
  function clearSearchPin() {
    clearGroup(searchPinGroup); if(bigCtx) clearGroup(bigCtx.searchPinGroup); removeSearchLabel();
  }

  /* ── ヒートマップ ── */
  function toggleHeatmap(quakes) {
    if (!isHeatmap) {
      isHeatmap=true; document.getElementById('btnHeatmap')?.classList.add('active');
      clearGroup(pinGroup); if(bigCtx) clearGroup(bigCtx.pinGroup);
      quakes.forEach(q=>{
        if(q.lat==null||q.lng==null)return;
        const pos=latLngToVec3(q.lat,q.lng,RADIUS*1.001), sp=makeSprite(CONFIG.MAG_COLOR(q.mag),1.2+Math.min(q.mag,8)*.28);
        sp.material.opacity=.22; sp.position.copy(pos); pinGroup.add(sp);
        if(bigCtx){ const sp2=makeSprite(CONFIG.MAG_COLOR(q.mag),1.2+Math.min(q.mag,8)*.28); sp2.material.opacity=.22; sp2.position.copy(pos); bigCtx.pinGroup.add(sp2); }
      });
    } else {
      isHeatmap=false; document.getElementById('btnHeatmap')?.classList.remove('active');
      window.DataModule?.redraw();
    }
  }

  /* ── カメラ飛行 ── */
  function flyTo(lat,lng,legacyZoom,dist) {
    const d=dist!=null?dist:zoomToDist(legacyZoom);
    _fly(camera,controls,lat,lng,d); if(bigCtx) _fly(bigCtx.camera,bigCtx.controls,lat,lng,d);
  }
  function focusQuake(lat,lng,mag) { flyTo(lat,lng,null,mag>=6?135:mag>=5?160:mag>=4?190:210); }
  function resetView() { flyTo(36.5,138.0,null,G().DEFAULT_DIST); }
  function zoomToDist(z) {
    if(z==null)return G().DEFAULT_DIST; z=Math.max(3,Math.min(12,z));
    return G().MAX_ZOOM_DIST-(z-3)/9*(G().MAX_ZOOM_DIST-G().MIN_ZOOM_DIST-40);
  }
  function _fly(cam,ctrl,lat,lng,d) {
    if(!cam||!ctrl)return;
    const target=latLngToVec3(lat,lng,d), start=cam.position.clone(), t0=performance.now(), DUR=1100;
    ctrl.enabled=false;
    (function step(now){ const r=Math.min(1,(now-t0)/DUR), e=r<.5?2*r*r:1-Math.pow(-2*r+2,2)/2;
      cam.position.lerpVectors(start,target,e); cam.lookAt(0,0,0);
      if(r<1) requestAnimationFrame(step); else { ctrl.target.set(0,0,0); ctrl.enabled=true; ctrl.update(); }
    })(t0);
  }

  /* ── ツールバー ── */
  function bindToolbar() {
    const sa=id=>{ ['btn2d','btnSatellite','btnTerrain'].forEach(b=>document.getElementById(b)?.classList.remove('active')); document.getElementById(id)?.classList.add('active'); };
    document.getElementById('btn2d')?.addEventListener('click',()=>{ switchTile('standard'); sa('btn2d'); });
    document.getElementById('btnSatellite')?.addEventListener('click',()=>{ switchTile('satellite'); sa('btnSatellite'); });
    document.getElementById('btnTerrain')?.addEventListener('click',()=>{ switchTile('terrain'); sa('btnTerrain'); });
    document.getElementById('btnReset')?.addEventListener('click',resetView);
    document.getElementById('btnHeatmap')?.addEventListener('click',()=>{ if(window.DataModule) toggleHeatmap(window.DataModule.getQuakes()); });
    document.getElementById('btnLabels')?.addEventListener('click',()=>{ showLabels=!showLabels; updateLabelToggleUI(); refreshLabelVisibility(); });
    updateLabelToggleUI();
  }
  function updateLabelToggleUI() {
    const btn=document.getElementById('btnLabels'); if(!btn)return;
    btn.classList.toggle('active',showLabels);
    btn.style.display=currentTileType==='satellite'?'':'none';
  }

  /* ── レイヤートグル ── */
  function bindLayerToggles() {
    document.getElementById('showFault')?.addEventListener('change',e=>{ if(e.target.checked) scene.add(faultGroup); else scene.remove(faultGroup); });
    document.getElementById('showPlate')?.addEventListener('change',e=>{ if(e.target.checked) scene.add(plateGroup); else scene.remove(plateGroup); });
    ['showEpicenter','showWave'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>window.DataModule?.redraw()));
  }

  /* ── 断層・プレート境界 ── */
  function drawFaultLines(g) {
    [[[33.5,130.3],[33.8,131.0],[34.2,132.0],[34.6,133.5],[34.9,135.0],[35.0,136.2]],
     [[36.8,137.9],[35.8,138.1],[35.2,138.4],[34.9,138.6]]].forEach(c=>addLine(g,c,0xff3333,true));
  }
  function drawPlateBoundaries(g) {
    [{ c:[[45,150],[42,145],[38,142],[35,142],[33,142],[30,140],[28,138]], col:0x3b82f6 },
     { c:[[35,140],[34,138],[33,136],[32,133],[31,131],[30,128]], col:0xa855f7 }].forEach(p=>addLine(g,p.c,p.col,true));
  }
  function addLine(g,coords,color,dashed) {
    const pts=coords.map(([a,b])=>latLngToVec3(a,b,RADIUS*1.002));
    const geo=new THREE.BufferGeometry().setFromPoints(pts);
    const mat=dashed?new THREE.LineDashedMaterial({color,dashSize:2.5,gapSize:1.5,transparent:true,opacity:.8}):new THREE.LineBasicMaterial({color,transparent:true,opacity:.8});
    const line=new THREE.Line(geo,mat); if(dashed)line.computeLineDistances(); g.add(line);
  }

  /* ── ピンクリック ── */
  function bindPointerEvents(domEl,isBig) {
    domEl.addEventListener('click',e=>{
      const rect=domEl.getBoundingClientRect();
      const ndc=new THREE.Vector2(((e.clientX-rect.left)/rect.width)*2-1,-((e.clientY-rect.top)/rect.height)*2+1);
      const cam=isBig?bigCtx?.camera:camera, grp=isBig?bigCtx?.pinGroup:pinGroup;
      if(!cam||!grp)return;
      const rc=new THREE.Raycaster(); rc.setFromCamera(ndc,cam);
      const hits=rc.intersectObjects(grp.children,false);
      if(hits.length){ const q=hits[0].object.userData?.q; if(q&&window.UIModule?.showQuakeDetail) window.UIModule.showQuakeDetail(q); }
    });
  }

  /* ── 地名ラベル ── */
  const LABELS=[
    {n:'東京',lat:35.69,lng:139.69,k:'city'},{n:'大阪',lat:34.69,lng:135.52,k:'city'},
    {n:'札幌',lat:43.06,lng:141.35,k:'city'},{n:'名古屋',lat:35.18,lng:136.91,k:'city'},
    {n:'福岡',lat:33.59,lng:130.40,k:'city'},{n:'那覇',lat:26.21,lng:127.68,k:'city'},
    {n:'仙台',lat:38.27,lng:140.87,k:'city'},{n:'ソウル',lat:37.57,lng:126.98,k:'city'},
    {n:'北京',lat:39.90,lng:116.41,k:'city'},{n:'上海',lat:31.23,lng:121.47,k:'city'},
    {n:'台北',lat:25.03,lng:121.57,k:'city'},{n:'香港',lat:22.32,lng:114.17,k:'city'},
    {n:'マニラ',lat:14.60,lng:120.98,k:'city'},{n:'バンコク',lat:13.76,lng:100.50,k:'city'},
    {n:'シンガポール',lat:1.35,lng:103.82,k:'city'},{n:'ジャカルタ',lat:-6.21,lng:106.85,k:'city'},
    {n:'デリー',lat:28.61,lng:77.21,k:'city'},{n:'モスクワ',lat:55.76,lng:37.62,k:'city'},
    {n:'ロンドン',lat:51.51,lng:-0.13,k:'city'},{n:'パリ',lat:48.86,lng:2.35,k:'city'},
    {n:'ベルリン',lat:52.52,lng:13.41,k:'city'},{n:'ニューヨーク',lat:40.71,lng:-74.01,k:'city'},
    {n:'ロサンゼルス',lat:34.05,lng:-118.24,k:'city'},{n:'サンパウロ',lat:-23.55,lng:-46.63,k:'city'},
    {n:'シドニー',lat:-33.87,lng:151.21,k:'city'},{n:'カイロ',lat:30.04,lng:31.24,k:'city'},
    {n:'イスタンブール',lat:41.01,lng:28.98,k:'city'},{n:'テヘラン',lat:35.69,lng:51.39,k:'city'},
    {n:'日本',lat:36.5,lng:138.0,k:'country'},{n:'中国',lat:35.0,lng:103.0,k:'country'},
    {n:'ロシア',lat:61.5,lng:90.0,k:'country'},{n:'インド',lat:22.0,lng:79.0,k:'country'},
    {n:'アメリカ合衆国',lat:39.5,lng:-98.5,k:'country'},{n:'カナダ',lat:56.0,lng:-106.0,k:'country'},
    {n:'ブラジル',lat:-10.0,lng:-52.0,k:'country'},{n:'オーストラリア',lat:-25.0,lng:134.0,k:'country'},
    {n:'インドネシア',lat:-2.5,lng:117.0,k:'country'},{n:'韓国',lat:36.5,lng:127.8,k:'country'},
    {n:'台湾',lat:23.7,lng:121.0,k:'country'},{n:'イギリス',lat:54.0,lng:-2.0,k:'country'},
    {n:'フランス',lat:46.5,lng:2.5,k:'country'},{n:'ドイツ',lat:51.0,lng:10.0,k:'country'},
    {n:'メキシコ',lat:23.6,lng:-102.5,k:'country'},{n:'アルゼンチン',lat:-35.0,lng:-65.0,k:'country'},
    {n:'チリ',lat:-33.0,lng:-71.0,k:'country'},{n:'エジプト',lat:26.0,lng:30.0,k:'country'},
    {n:'南アフリカ',lat:-29.0,lng:24.0,k:'country'},{n:'トルコ',lat:39.0,lng:35.0,k:'country'},
    {n:'ニュージーランド',lat:-41.0,lng:174.0,k:'country'},{n:'フィリピン',lat:12.8,lng:122.0,k:'country'},
  ];

  function mkEl(text,cls){ const el=document.createElement('div'); el.className='globe-label globe-label-'+cls; el.textContent=text; el.style.display='none'; el.style.pointerEvents='none'; return el; }
  function setupLabelLayer() {
    labelLayer=document.createElement('div'); labelLayer.className='globe-label-layer';
    containerEl.style.position='relative'; containerEl.appendChild(labelLayer);
    LABELS.forEach(p=>{ const el=mkEl(p.n,p.k); labelLayer.appendChild(el); labelEntries.push({el,lat:p.lat,lng:p.lng,isBig:false}); });
  }
  function setupBigLabelLayer(c) {
    bigLabelLayer=document.createElement('div'); bigLabelLayer.className='globe-label-layer';
    c.style.position='relative'; c.appendChild(bigLabelLayer);
    LABELS.forEach(p=>{ const el=mkEl(p.n,p.k); bigLabelLayer.appendChild(el); labelEntries.push({el,lat:p.lat,lng:p.lng,isBig:true}); });
  }
  let _sLabels=[];
  function addOrUpdateSearchLabel(lat,lng,text) {
    removeSearchLabel();
    [{layer:labelLayer,isBig:false},{layer:bigLabelLayer,isBig:true}].forEach(({layer,isBig})=>{
      if(!layer)return;
      const el=mkEl('📍 '+text,'search'); layer.appendChild(el); _sLabels.push(el);
      labelEntries.push({el,lat,lng,isBig,alwaysOn:true});
    });
  }
  function removeSearchLabel() { labelEntries=labelEntries.filter(e=>{ if(e.alwaysOn){e.el?.remove();return false;} return true; }); _sLabels=[]; }
  function refreshLabelVisibility() { labelEntries.forEach(e=>{ if(!e.alwaysOn&&!showLabels) e.el.style.display='none'; }); }
  function updateLabels(cam,isBig) {
    if(!cam)return;
    const domEl=isBig?bigCtx?.renderer?.domElement:renderer?.domElement; if(!domEl)return;
    const W=domEl.clientWidth,H=domEl.clientHeight; if(!W||!H)return;
    const camDir=cam.position.clone().normalize();
    labelEntries.forEach(e=>{
      if(e.isBig!==isBig)return;
      const vis=e.alwaysOn?true:showLabels; if(!vis){e.el.style.display='none';return;}
      const p=latLngToVec3(e.lat,e.lng,RADIUS*1.01), f=p.clone().normalize().dot(camDir);
      if(f<0.08){e.el.style.display='none';return;}
      const proj=p.clone().project(cam); if(proj.z>1){e.el.style.display='none';return;}
      const x=(proj.x*.5+.5)*W, y=(-proj.y*.5+.5)*H;
      e.el.style.display='block'; e.el.style.left='0'; e.el.style.top='0';
      e.el.style.transform=`translate(${x}px,${y}px) translate(-50%,-100%)`; e.el.style.opacity=String(Math.min(1,(f-.08)/.25));
    });
  }

  /* ── アニメーションループ ── */
  function animate() {
    requestAnimationFrame(animate);
    if(cloudsMesh) cloudsMesh.rotation.y+=.00016;
    controls?.update(); updateLabels(camera,false);
    if(renderer&&scene&&camera) renderer.render(scene,camera);
  }
  function animateBig() {
    if(!bigCtx)return; requestAnimationFrame(animateBig);
    if(bigCtx.cloudsMesh) bigCtx.cloudsMesh.rotation.y+=.00016;
    bigCtx.controls?.update(); updateLabels(bigCtx.camera,true);
    bigCtx.renderer.render(bigCtx.scene,bigCtx.camera);
  }

  /* ── リサイズ ── */
  function onResize() {
    if(containerEl&&camera&&renderer){ const r=containerEl.getBoundingClientRect(); if(r.width>0&&r.height>0){ camera.aspect=r.width/r.height; camera.updateProjectionMatrix(); renderer.setSize(r.width,r.height); } }
    if(bigCtx?.container){ const r=bigCtx.container.getBoundingClientRect(); if(r.width>0&&r.height>0){ bigCtx.camera.aspect=r.width/r.height; bigCtx.camera.updateProjectionMatrix(); bigCtx.renderer.setSize(r.width,r.height); } }
  }

  /* ── ユーティリティ ── */
  function formatTime(t) {
    if(!t)return'不明'; const d=new Date(t), p=n=>String(n).padStart(2,'0');
    return`${d.getFullYear()}/${p(d.getMonth()+1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  return { init, initBigMap, drawQuakes, focusQuake, flyTo, resetView, toggleHeatmap, setSearchPin, clearSearchPin, formatTime, latLngToVec3 };
})();
