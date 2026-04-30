"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

export function OrbHero({ onEnter }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const canvasShellRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    function getW() {
      return wrap.clientWidth || window.innerWidth;
    }

    let W = getW();
    let H = window.innerHeight;

    canvas.width = W;
    canvas.height = H;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 100);
    camera.position.z = 3.8;

    const clock = new THREE.Clock();

    const orbGeo = new THREE.SphereGeometry(1, 64, 64);
    const orbMat = new THREE.MeshPhongMaterial({
      color: 0x0d0820,
      emissive: 0x2e0a6e,
      emissiveIntensity: 0.15,
      transparent: true,
      opacity: 0.92,
      shininess: 120,
      specular: new THREE.Color(0x7c3aed),
    });
    const orb = new THREE.Mesh(orbGeo, orbMat);
    scene.add(orb);

    const coreGeo = new THREE.SphereGeometry(0.35, 32, 32);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x7c3aed,
      transparent: true,
      opacity: 0.7,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    const pupilGeo = new THREE.SphereGeometry(0.14, 16, 16);
    const pupilMat = new THREE.MeshBasicMaterial({ color: 0xede9fe });
    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    scene.add(pupil);

    function makeRing(innerR, outerR, tiltX, tiltZ, color, opacity) {
      const geo = new THREE.TorusGeometry((innerR + outerR) / 2, (outerR - innerR) / 2, 4, 128);
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

    const ring1 = makeRing(1.12, 1.18, Math.PI / 2, 0, 0x7c3aed, 0.7);
    const ring2 = makeRing(1.28, 1.33, Math.PI / 3, 0.4, 0x5b21b6, 0.45);
    const ring3 = makeRing(1.48, 1.52, Math.PI / 6, -0.6, 0x4c1d95, 0.3);
    scene.add(ring1, ring2, ring3);

    const particleCount = 240;
    const positions = new Float32Array(particleCount * 3);
    const particleData = [];
    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 1.8 + Math.random() * 2.4;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
      particleData.push({ theta, phi, r, speed: 0.0003 + Math.random() * 0.0005 });
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0xa78bfa,
      size: 0.025,
      transparent: true,
      opacity: 0.6,
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    const ambient = new THREE.AmbientLight(0x1a0a3a, 1.2);
    scene.add(ambient);
    const purpleLight = new THREE.PointLight(0x7c3aed, 2.5, 8);
    purpleLight.position.set(2, 2, 2);
    scene.add(purpleLight);
    const blueLight = new THREE.PointLight(0x3b0764, 1.5, 8);
    blueLight.position.set(-2, -1, 1);
    scene.add(blueLight);
    const rimLight = new THREE.PointLight(0xc4b5fd, 1.0, 6);
    rimLight.position.set(0, -2, -2);
    scene.add(rimLight);

    let mouseX = 0;
    let mouseY = 0;
    const onMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = ((e.clientX - rect.left) / W - 0.5) * 2;
      mouseY = -((e.clientY - rect.top) / H - 0.5) * 2;
    };
    canvas.addEventListener("mousemove", onMouseMove);

    const onResize = () => {
      W = getW();
      H = window.innerHeight;
      canvas.width = W;
      canvas.height = H;
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      renderer.setSize(W, H);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    let animationFrameId;
    function animate() {
      animationFrameId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      orb.rotation.y = t * 0.18 + mouseX * 0.3;
      orb.rotation.x = mouseY * 0.2;

      ring1.rotation.y = t * 0.4;
      ring2.rotation.y = -t * 0.28;
      ring3.rotation.z = t * 0.15;

      const pulse = 0.85 + 0.15 * Math.sin(t * 2.2);
      core.scale.setScalar(pulse);
      coreMat.opacity = 0.5 + 0.25 * Math.sin(t * 1.8);
      pupil.scale.setScalar(0.9 + 0.15 * Math.sin(t * 3));

      for (let i = 0; i < particleCount; i++) {
        particleData[i].theta += particleData[i].speed;
        const { theta, phi, r } = particleData[i];
        positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = r * Math.cos(phi);
      }
      pGeo.attributes.position.needsUpdate = true;
      particles.rotation.y = t * 0.06;

      purpleLight.position.x = Math.cos(t * 0.7) * 2.5;
      purpleLight.position.z = Math.sin(t * 0.7) * 2.5;

      renderer.render(scene, camera);
    }
    animate();

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      canvas.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
    };
  }, []);

  return (
    <>
      <h2 className="sr-only">
        DeepScry animated 3D scrying orb logo built with Three.js, full width
      </h2>
      <div
        ref={wrapRef}
        id="orb-wrap"
        style={{
          width: "100%",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "0",
          background: "#070412",
          borderRadius: "var(--border-radius-lg)",
          overflow: "hidden",
          boxSizing: "border-box",
          position: "relative",
        }}
      >
        <div
          ref={canvasShellRef}
          role={onEnter ? "button" : undefined}
          tabIndex={onEnter ? 0 : undefined}
          onClick={onEnter}
          onKeyDown={(event) => {
            if (!onEnter) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onEnter();
            }
          }}
          style={{
            cursor: onEnter ? "pointer" : "default",
            transition: "filter 160ms ease",
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.filter = "drop-shadow(0 0 10px rgba(124, 58, 237, 0.7))";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.filter = "none";
          }}
          aria-label="Enter DeepScry"
        >
          <canvas ref={canvasRef} id="orb-canvas" style={{ display: "block" }} />
        </div>
        <div
          role={onEnter ? "button" : undefined}
          tabIndex={onEnter ? 0 : undefined}
          onClick={onEnter}
          onKeyDown={(event) => {
            if (!onEnter) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onEnter();
            }
          }}
          style={{
            marginTop: "1.5rem",
            textAlign: "center",
            cursor: onEnter ? "pointer" : "default",
            transition: "filter 160ms ease, transform 160ms ease",
            position: "absolute",
            left: 0,
            right: 0,
            bottom: "2.5rem",
          }}
          onMouseEnter={(event) => {
            event.currentTarget.style.filter = "drop-shadow(0 0 10px rgba(124, 58, 237, 0.7))";
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.filter = "none";
            event.currentTarget.style.transform = "none";
          }}
          aria-label="Enter DeepScry"
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
        </div>
      </div>
    </>
  );
}

export default OrbHero;
