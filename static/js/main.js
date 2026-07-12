// 滾動進場 + Three.js hero 場景。3D 失敗時靜默降級，不影響內容閱讀。
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

const io = new IntersectionObserver(
  (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("in")),
  { threshold: 0.15 }
);
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

const canvas = document.getElementById("hero3d");
if (canvas) {
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

    // 星塵：稀疏金色粒子營造景深
    const starGeo = new THREE.BufferGeometry();
    const pos = new Float32Array(540);
    for (let i = 0; i < pos.length; i++) pos[i] = (Math.random() - 0.5) * 26;
    starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xc9a227, size: 0.035, transparent: true, opacity: 0.55 })));

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
      group.rotation.x += (my * 0.12 - group.rotation.x) * 0.05;
      group.rotation.y += (mx * 0.18 - group.rotation.y) * 0.05;
      renderer.render(scene, camera);
    };

    if (reduced) {
      render(0); // 靜態單幀
    } else {
      addEventListener("pointermove", (e) => {
        mx = (e.clientX / innerWidth) * 2 - 1;
        my = (e.clientY / innerHeight) * 2 - 1;
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
