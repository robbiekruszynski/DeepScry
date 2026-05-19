"use client";

import { useEffect, useRef } from "react";

const ORB_SIZE = 520;

export function OrbHero({ onEnter }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let animationFrameId = 0;
    let renderer;
    let resizeObserver;

    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.display = "block";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    mount.appendChild(canvas);

    const getSize = () => {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      return { w: Math.max(1, w), h: Math.max(1, h) };
    };

    let cleanupScene;

    void (async () => {
      const THREE = await import("three");
      if (disposed) return;

      let { w: W, h: H } = getSize();

      try {
        renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
      } catch (err) {
        console.error("OrbHero: WebGL unavailable", err);
        canvas.remove();
        return;
      }

      if (disposed) {
        renderer.dispose();
        canvas.remove();
        return;
      }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(W, H, false);
    renderer.setClearColor(0x070412, 1);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 200);
    const clock = new THREE.Clock();

    const orbGroup = new THREE.Group();
    scene.add(orbGroup);

    const updateCamera = () => {
      const viewMin = Math.min(W, H);
      camera.position.z = 3.8 * (viewMin / ORB_SIZE);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    };
    updateCamera();

    const orbGeo = new THREE.SphereGeometry(1, 64, 64);
    const orbMat = new THREE.MeshPhongMaterial({
      color: 0x1a1040,
      emissive: 0x4c1d95,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.95,
      shininess: 120,
      specular: new THREE.Color(0x7c3aed),
    });
    const orb = new THREE.Mesh(orbGeo, orbMat);
    orbGroup.add(orb);

    const coreGeo = new THREE.SphereGeometry(0.35, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x7c3aed,
      transparent: true,
      opacity: 0.85,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    orbGroup.add(core);

    const pupilGeo = new THREE.SphereGeometry(0.14, 16, 16);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0xede9fe });
    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    orbGroup.add(pupil);

    function makeRing(innerR, outerR, tiltX, tiltZ, color, opacity) {
      const geo = new THREE.TorusGeometry(
        (innerR + outerR) / 2,
        (outerR - innerR) / 2,
        4,
        128
      );
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.rotation.x = tiltX;
      mesh.rotation.z = tiltZ;
      return mesh;
    }

    const ring1 = makeRing(1.12, 1.18, Math.PI / 2, 0, 0x7c3aed, 0.85);
    const ring2 = makeRing(1.28, 1.33, Math.PI / 3, 0.4, 0x5b21b6, 0.55);
    const ring3 = makeRing(1.48, 1.52, Math.PI / 6, -0.6, 0x4c1d95, 0.4);
    orbGroup.add(ring1, ring2, ring3);

    function buildStarfield(count, minR, maxR, size, opacity) {
      const positions = new Float32Array(count * 3);
      const data = [];
      for (let i = 0; i < count; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = minR + Math.random() * (maxR - minR);
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
        data.push({
          theta,
          phi,
          r,
          speed: 0.00008 + Math.random() * 0.0002,
        });
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        color: 0xc4b5fd,
        size,
        transparent: true,
        opacity,
        depthWrite: false,
      });
      const points = new THREE.Points(geo, mat);
      return { points, positions, data, geo };
    }

    const nearStars = buildStarfield(240, 1.8, 4.2, 0.03, 0.75);
    const farStars = buildStarfield(520, 5, 28, 0.018, 0.45);
    scene.add(nearStars.points);
    scene.add(farStars.points);

    scene.add(new THREE.AmbientLight(0x1a0a3a, 1.4));
    const purpleLight = new THREE.PointLight(0x7c3aed, 3, 10);
    purpleLight.position.set(2, 2, 2);
    scene.add(purpleLight);
    const blueLight = new THREE.PointLight(0x3b0764, 2, 10);
    blueLight.position.set(-2, -1, 1);
    scene.add(blueLight);
    const rimLight = new THREE.PointLight(0xc4b5fd, 1.5, 8);
    rimLight.position.set(0, -2, -2);
    scene.add(rimLight);

    let mouseX = 0;
    let mouseY = 0;
    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      mouseX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
      mouseY = -((e.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    canvas.addEventListener("mousemove", onMouseMove);

    function tickStarfield(field) {
      const { positions, data, geo } = field;
      for (let i = 0; i < data.length; i++) {
        data[i].theta += data[i].speed;
        const { theta, phi, r } = data[i];
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
      }
      geo.attributes.position.needsUpdate = true;
    }

    const onResize = () => {
      const next = getSize();
      W = next.w;
      H = next.h;
      renderer.setSize(W, H, false);
      updateCamera();
    };

    resizeObserver = new ResizeObserver(onResize);
    resizeObserver.observe(mount);
    onResize();

    function animate() {
      if (disposed) return;
      animationFrameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      orb.rotation.y = t * 0.18 + mouseX * 0.3;
      orb.rotation.x = mouseY * 0.2;

      ring1.rotation.y = t * 0.4;
      ring2.rotation.y = -t * 0.28;
      ring3.rotation.z = t * 0.15;

      const pulse = 0.85 + 0.15 * Math.sin(t * 2.2);
      core.scale.setScalar(pulse);
      coreMat.opacity = 0.65 + 0.25 * Math.sin(t * 1.8);
      pupil.scale.setScalar(0.9 + 0.15 * Math.sin(t * 3));

      tickStarfield(nearStars);
      tickStarfield(farStars);
      nearStars.points.rotation.y = t * 0.06;
      farStars.points.rotation.y = t * 0.02;

      purpleLight.position.x = Math.cos(t * 0.7) * 2.5;
      purpleLight.position.z = Math.sin(t * 0.7) * 2.5;

      renderer.render(scene, camera);
    }
      animate();

      cleanupScene = () => {
        canvas.removeEventListener("mousemove", onMouseMove);
        resizeObserver?.disconnect();
        renderer?.dispose();
        canvas.remove();
      };
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(animationFrameId);
      cleanupScene?.();
    };
  }, []);

  const enterProps = onEnter
    ? {
        role: "button",
        tabIndex: 0,
        onClick: onEnter,
        onKeyDown: (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onEnter();
          }
        },
        style: { cursor: "pointer" },
      }
    : {};

  return (
    <div
      {...enterProps}
      aria-label="Enter DeepScry"
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        minHeight: "100dvh",
        background: "#070412",
        overflow: "hidden",
        cursor: onEnter ? "pointer" : "default",
      }}
    >
      <h2 className="sr-only">DeepScry — click anywhere to enter</h2>

      {/* Full-viewport WebGL layer */}
      <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />

      {/* Orb hit area + branding (orb is drawn centered in the canvas above) */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          minHeight: "100dvh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: `min(${ORB_SIZE}px, 92vw)`,
            height: `min(${ORB_SIZE}px, 62vh)`,
            minWidth: 280,
            minHeight: 280,
            flexShrink: 0,
          }}
        />

        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: "2.5rem",
            textAlign: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "36px",
              fontWeight: 500,
              letterSpacing: "-1px",
              color: "#C4B5FD",
            }}
          >
            Deep
            <span style={{ color: "#7C3AED", fontWeight: 400 }}>Scry</span>
          </div>
          <div
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "11px",
              letterSpacing: "3px",
              color: "#4C1D95",
              marginTop: "4px",
            }}
          >
            DECK ANALYSIS
          </div>
          {onEnter ? (
            <p
              style={{
                marginTop: "12px",
                fontSize: "12px",
                letterSpacing: "0.08em",
                color: "#6d28d9",
                textTransform: "uppercase",
              }}
            >
              Click to enter
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default OrbHero;
