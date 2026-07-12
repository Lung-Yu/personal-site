// 滾動進場 + Three.js hero 場景。3D 失敗時靜默降級，不影響內容閱讀。
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

const io = new IntersectionObserver(
  (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
  { threshold: 0.15 }
);
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

// 僅在使用者明確開啟省流量模式時跳過 3D；3D 是本站的視覺簽名，行動裝置也保留
const skip3d = navigator.connection?.saveData;

const canvas = document.getElementById("hero3d");
if (canvas && skip3d) canvas.remove();
else if (canvas) {
  try {
    const THREE = await import("./three.module.min.js");

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x0b1120, 0.07);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 60);
    camera.position.set(0, 0, 9);

    scene.add(new THREE.AmbientLight(0x1c2a4a, 2.2));
    const gold = new THREE.PointLight(0xc9a227, 220, 40);
    gold.position.set(6, 4, 6);
    scene.add(gold);
    const cool = new THREE.PointLight(0x3b5bdb, 120, 40);
    cool.position.set(-7, -3, 4);
    scene.add(cool);

    // 黑曜石般的多面體 + 金色稜線（《魔鬼的計謀》棋子質感）
    const group = new THREE.Group();
    const faceMat = new THREE.MeshStandardMaterial({ color: 0x0e1730, metalness: 0.65, roughness: 0.3 });
    const edgeMat = new THREE.LineBasicMaterial({ color: 0xc9a227, transparent: true, opacity: 0.85 });
    const pieces = [
      [new THREE.IcosahedronGeometry(1.7), 2.6, 0.4, -2],
      [new THREE.OctahedronGeometry(1.15), -3.4, -0.9, -1],
      [new THREE.DodecahedronGeometry(0.75), -0.6, 2.1, -4],
      [new THREE.BoxGeometry(0.9, 0.9, 0.9), 4.6, -1.8, -5],
    ].map(([geo, x, y, z]) => {
      const mesh = new THREE.Mesh(geo, faceMat);
      mesh.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat));
      mesh.position.set(x, y, z);
      group.add(mesh);
      return mesh;
    });

    // 攻擊面標記：在多面體各面上映射不同數值——每個面是一個價值不同的攻擊面，
    // 隨形狀旋轉只有正對鏡頭的面可見，被遮住的面如同尚未探測的攻擊面（隱晦的暗示）。
    const hx = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("").toUpperCase();
    const faceTex = (val) => {
      const cv = document.createElement("canvas");
      cv.width = 128; cv.height = 64;
      const ctx = cv.getContext("2d");
      ctx.font = "600 26px ui-monospace, Menlo, monospace";
      ctx.fillStyle = "rgba(232,197,92,0.5)";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(val, 64, 34);
      const tex = new THREE.CanvasTexture(cv);
      tex.anisotropy = 2;
      return tex;
    };
    const Z = new THREE.Vector3(0, 0, 1);
    const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3();
    const cen = new THREE.Vector3(), nrm = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    const decorate = (mesh, size, density) => {
      const p = mesh.geometry.attributes.position;
      for (let i = 0; i < p.count; i += 3) {
        if (Math.random() > density) continue; // 只標注部分面，其餘留白更隱晦
        va.fromBufferAttribute(p, i); vb.fromBufferAttribute(p, i + 1); vc.fromBufferAttribute(p, i + 2);
        cen.copy(va).add(vb).add(vc).divideScalar(3);
        nrm.crossVectors(e1.subVectors(vb, va), e2.subVectors(vc, va)).normalize();
        const val = Math.random() < 0.5 ? hx(2) : String(Math.floor(Math.random() * 90 + 10));
        const plane = new THREE.Mesh(
          new THREE.PlaneGeometry(size, size * 0.5),
          new THREE.MeshBasicMaterial({ map: faceTex(val), transparent: true, depthWrite: false, opacity: 0.65 })
        );
        plane.position.copy(cen).addScaledVector(nrm, 0.02);
        plane.quaternion.setFromUnitVectors(Z, nrm);
        mesh.add(plane);
      }
    };
    decorate(pieces[0], 0.55, 0.8); // 二十面體：20 面，主要攻擊目標，面向最多元
    decorate(pieces[1], 0.5, 0.65); // 八面體

    // 星塵：稀疏金色粒子營造景深
    const starGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(540);
    for (let i = 0; i < pos.length; i++) pos[i] = (Math.random() - 0.5) * 26;
    starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xc9a227, size: 0.035, transparent: true, opacity: 0.55 })));

    // 威脅圖 / 攻擊圖：節點與邊——資安思維的視覺語言。
    // 每次載入節點數、佈局、連線與「目標節點」皆隨機，故每次觀看都略有不同。
    const graph = new THREE.Group();
    graph.position.set(-1.6, -0.4, -0.5);
    const nodeGeo = new THREE.SphereGeometry(0.13, 16, 16);
    const surfaces = ["auth", "api", "session", "crypto", "input", "kernel", "network", "storage", "iam", "supply-chain"];
    const nodes = Array.from({ length: 6 + Math.floor(Math.random() * 4) }, () => {
      const mat = new THREE.MeshStandardMaterial({ color: 0x0e1730, emissive: 0xc9a227, emissiveIntensity: 0.5, metalness: 0.6, roughness: 0.4 });
      const m = new THREE.Mesh(nodeGeo, mat);
      m.position.set((Math.random() - 0.5) * 6.5, (Math.random() - 0.5) * 5, (Math.random() - 0.5) * 3);
      // 每個節點是一個資產，但只有少數藏有真正的發現——符合安全探索「多數探測一無所獲」的實況
      m.userData = {
        base: m.position.clone(),
        phase: Math.random() * Math.PI * 2,
        probed: false,
        finding: false,
        hasData: false, // 稍後固定挑選 ≤30% 的節點設為有發現
        id: hx(4),
        surface: surfaces[Math.floor(Math.random() * surfaces.length)],
        exposure: 1 + Math.floor(Math.random() * 4), // 1–4
        value: Math.floor(Math.random() * 90 + 10),
      };
      graph.add(m);
      return m;
    });
    // 固定挑選 ≤30% 的節點藏有發現（至少 1 個），其餘點擊皆一無所獲
    const findingCount = Math.max(1, Math.floor(nodes.length * 0.3));
    [...nodes].sort(() => Math.random() - 0.5).slice(0, findingCount).forEach((n) => (n.userData.hasData = true));

    // 邊：每個節點連到最近的 1～2 個鄰居，形成攻擊路徑
    const edgePairs = [];
    nodes.forEach((n, i) => {
      const near = nodes.map((o, j) => ({ j, d: n.position.distanceTo(o.position) })).filter((o) => o.j !== i).sort((a, b) => a.d - b.d);
      for (let e = 0, k = 1 + Math.floor(Math.random() * 2); e < k; e++) {
        const j = near[e].j;
        if (!edgePairs.some(([a, b]) => (a === i || a === j) && (b === i || b === j))) edgePairs.push([i, j]);
      }
    });
    const edgeGeo = new THREE.BufferGeometry();
    const edgePos = new Float32Array(edgePairs.length * 6);
    edgeGeo.setAttribute("position", new THREE.BufferAttribute(edgePos, 3));
    const updateEdges = () => {
      edgePairs.forEach(([a, b], i) => {
        nodes[a].position.toArray(edgePos, i * 6);
        nodes[b].position.toArray(edgePos, i * 6 + 3);
      });
      edgeGeo.attributes.position.needsUpdate = true;
    };
    const edgeLines = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: 0xc9a227, transparent: true, opacity: 0.3 }));
    graph.add(edgeLines);
    scene.add(graph);

    let target = nodes[Math.floor(Math.random() * nodes.length)]; // 脈動的「目標」節點
    let hover = null;

    // 偵察讀出面板：點擊節點後揭露該資產的攻擊面資料。
    const probe = document.createElement("aside");
    probe.className = "probe";
    probe.setAttribute("aria-hidden", "true");
    probe.innerHTML =
      '<p class="probe-hd">RECON</p>' +
      '<dl><dt>NODE</dt><dd data-k="id"></dd>' +
      '<dt>SURFACE</dt><dd data-k="surface"></dd>' +
      '<dt>EXPOSURE</dt><dd data-k="exposure"></dd>' +
      '<dt>VALUE</dt><dd data-k="value"></dd></dl>';
    canvas.parentElement.appendChild(probe);
    const showProbe = (d) => {
      probe.querySelector('[data-k="id"]').textContent = "0x" + d.id;
      probe.querySelector('[data-k="surface"]').textContent = d.surface;
      probe.querySelector('[data-k="exposure"]').textContent = "●".repeat(d.exposure) + "○".repeat(4 - d.exposure);
      probe.querySelector('[data-k="value"]').textContent = d.value;
      probe.classList.remove("in"); void probe.offsetWidth; // 重觸發淡入動畫
      probe.classList.add("in");
    };

    scene.add(group);

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = canvas;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    addEventListener("resize", resize);

    let mx = 0, my = 0;
    const render = (t) => {
      pieces.forEach((m, i) => {
        m.rotation.x = t * 0.00008 * (i + 1) + i;
        m.rotation.y = t * 0.00012 * (i + 1);
        m.position.y += Math.sin(t * 0.0006 + i * 2) * 0.0015;
      });
      nodes.forEach((n) => {
        n.position.y = n.userData.base.y + Math.sin(t * 0.0007 + n.userData.phase) * 0.14;
        // 未探索=金中亮；已探索有發現=亮金；已探索無發現=冷暗
        const idle = !n.userData.probed ? 0.45 : n.userData.finding ? 1.0 : 0.12;
        let want;
        if (n === hover) want = 2.4;
        else if (n.userData.probed && !n.userData.finding) want = 0.12; // 清空的維持暗淡
        else if (n === target) want = 0.5 + (Math.sin(t * 0.005) + 1) * 0.7;
        else want = idle;
        n.material.emissiveIntensity += (want - n.material.emissiveIntensity) * 0.12;
        const s = n === hover ? 1.7 : n === target ? 1.15 : 1;
        n.scale.setScalar(n.scale.x + (s - n.scale.x) * 0.15);
      });
      updateEdges();
      edgeLines.material.opacity = 0.22 + (Math.sin(t * 0.001) + 1) * 0.09;
      graph.rotation.y += (mx * 0.22 - graph.rotation.y) * 0.04;
      graph.rotation.x += (my * 0.14 - graph.rotation.x) * 0.04;
      group.rotation.x += (my * 0.12 - group.rotation.x) * 0.05;
      group.rotation.y += (mx * 0.18 - group.rotation.y) * 0.05;
      renderer.render(scene, camera);
    };

    if (reduced) {
      render(0); // 靜態單幀
    } else {
      // 互動：滑鼠指到節點會發亮，點擊則把它設為新的脈動「目標」（如在攻擊圖上標記突破點）
      const raycaster = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      const pick = (e) => {
        ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
        raycaster.setFromCamera(ndc, camera);
        return raycaster.intersectObjects(nodes)[0]?.object ?? null;
      };
      addEventListener("pointermove", (e) => {
        mx = (e.clientX / innerWidth) * 2 - 1;
        my = (e.clientY / innerHeight) * 2 - 1;
        hover = pick(e);
        canvas.style.cursor = hover ? "pointer" : "";
      });
      canvas.style.pointerEvents = "auto";
      canvas.addEventListener("click", (e) => {
        const n = pick(e);
        if (!n || n.userData.probed) return;
        n.userData.probed = true; // 狀態改變：已探測
        if (n.userData.hasData) {
          n.userData.finding = true; // 有發現：持續亮金 + 揭露資料
          target = n;
          showProbe(n.userData);
        } else {
          n.material.emissive.set(0x35507a); // 無發現：轉冷灰、暗淡（已清空）
        }
      });
      const loop = (t) => {
        if (!document.hidden) render(t);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
  } catch {
    canvas.remove(); // WebGL 不可用：保留 CSS 漸層背景即可
  }
}
