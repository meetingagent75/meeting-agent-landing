/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heroTitleRef = useRef<HTMLHeadingElement>(null);
  const heroSubRef = useRef<HTMLParagraphElement>(null);
  const heroSealRef = useRef<HTMLDivElement>(null);
  const problemRef = useRef<HTMLDivElement>(null);

  const { scrollYProgress: problemScroll } = useScroll({
    target: problemRef,
    offset: ["start start", "end end"]
  });

  const textX = useTransform(problemScroll, [0, 0.5], ["0vw", "-100vw"]);
  const textOpacity = useTransform(problemScroll, [0, 0.5], [1, 0]);

  const cardsX = useTransform(problemScroll, [0, 0.5], ["100vw", "0vw"]);
  const cardsOpacity = useTransform(problemScroll, [0, 0.3], [0, 1]);

  useEffect(() => {
    // ── Scroll Reveal Logic
    const observer = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('visible');
      });
    }, { threshold: 0.15 });

    const scrollElements = document.querySelectorAll('[data-scroll]');
    scrollElements.forEach(el => observer.observe(el));

    // ── Parallax Logic
    const handleScroll = () => {
      const sy = window.scrollY;
      if (heroTitleRef.current) heroTitleRef.current.style.transform = `translateY(${sy * 0.25}px) translateZ(0)`;
      if (heroSubRef.current) heroSubRef.current.style.transform = `translateY(${sy * 0.15}px) translateZ(0)`;
      if (heroSealRef.current) heroSealRef.current.style.transform = `translateY(${sy * 0.1}px) translateZ(0)`;
    };
    window.addEventListener('scroll', handleScroll);

    // ── WebGL Logic
    const canvas = canvasRef.current;
    if (canvas) {
      const gl = canvas.getContext('webgl');
      if (gl) {
        let W: number, H: number;
        const resize = () => {
          W = canvas.width = window.innerWidth;
          H = canvas.height = window.innerHeight;
          gl.viewport(0, 0, W, H);
        };
        resize();
        window.addEventListener('resize', resize);

        const vsrc = `
          attribute vec4 aPos;
          attribute float aSize;
          attribute vec3 aColor;
          uniform mat4 uMVP;
          varying vec3 vColor;
          void main() {
            gl_Position = uMVP * aPos;
            gl_PointSize = aSize;
            vColor = aColor;
          }
        `;
        const fsrc = `
          precision mediump float;
          varying vec3 vColor;
          void main() {
            float d = length(gl_PointCoord - 0.5) * 2.0;
            if (d > 1.0) discard;
            float a = 1.0 - smoothstep(0.5, 1.0, d);
            gl_FragColor = vec4(vColor, a * 0.7);
          }
        `;

        const compileShader = (src: string, type: number) => {
          const sh = gl.createShader(type)!;
          gl.shaderSource(sh, src);
          gl.compileShader(sh);
          return sh;
        };
        const prog = gl.createProgram()!;
        gl.attachShader(prog, compileShader(vsrc, gl.VERTEX_SHADER));
        gl.attachShader(prog, compileShader(fsrc, gl.FRAGMENT_SHADER));
        gl.linkProgram(prog);
        gl.useProgram(prog);

        const N = 80;
        const nodes: any[] = [];
        const colors = [
          [0.42, 0.31, 0.96], // purple
          [0.0, 0.79, 0.66], // teal
          [1.0, 0.42, 0.42], // coral
          [1.0, 0.70, 0.28], // amber
        ];
        for (let i = 0; i < N; i++) {
          nodes.push({
            x: (Math.random() - 0.5) * 3,
            y: (Math.random() - 0.5) * 3,
            z: (Math.random() - 0.5) * 2,
            vx: (Math.random() - 0.5) * 0.002,
            vy: (Math.random() - 0.5) * 0.002,
            vz: (Math.random() - 0.5) * 0.001,
            size: 2 + Math.random() * 4,
            color: colors[Math.floor(Math.random() * colors.length)]
          });
        }

        const perspective = (fov: number, aspect: number, near: number, far: number) => {
          const f = 1 / Math.tan(fov / 2);
          return [
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (far + near) / (near - far), -1,
            0, 0, (2 * far * near) / (near - far), 0
          ];
        };

        const multiply = (a: number[], b: number[]) => {
          const r = new Array(16).fill(0);
          for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++)
            r[i * 4 + j] += a[i * 4 + k] * b[k * 4 + j];
          return r;
        };

        const translate = (tx: number, ty: number, tz: number) => {
          return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, tx, ty, tz, 1];
        };

        const rotY = (t: number) => {
          return [Math.cos(t), 0, Math.sin(t), 0, 0, 1, 0, 0, -Math.sin(t), 0, Math.cos(t), 0, 0, 0, 0, 1];
        };

        const aPos = gl.getAttribLocation(prog, 'aPos');
        const aSize = gl.getAttribLocation(prog, 'aSize');
        const aColor = gl.getAttribLocation(prog, 'aColor');
        const uMVP = gl.getUniformLocation(prog, 'uMVP');

        const posBuf = gl.createBuffer();
        const sizeBuf = gl.createBuffer();
        const colorBuf = gl.createBuffer();

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
        gl.clearColor(0, 0, 0, 0);

        let t = 0;
        let webglAnimId: number;
        const frame = () => {
          t += 0.003;
          gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

          for (const n of nodes) {
            n.x += n.vx; n.y += n.vy; n.z += n.vz;
            if (Math.abs(n.x) > 2) n.vx *= -1;
            if (Math.abs(n.y) > 2) n.vy *= -1;
            if (Math.abs(n.z) > 1.5) n.vz *= -1;
          }

          const posArr = new Float32Array(nodes.flatMap(n => [n.x, n.y, n.z, 1]));
          const sizeArr = new Float32Array(nodes.map(n => n.size));
          const colorArr = new Float32Array(nodes.flatMap(n => n.color));

          gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
          gl.bufferData(gl.ARRAY_BUFFER, posArr, gl.DYNAMIC_DRAW);
          gl.vertexAttribPointer(aPos, 4, gl.FLOAT, false, 0, 0);
          gl.enableVertexAttribArray(aPos);

          gl.bindBuffer(gl.ARRAY_BUFFER, sizeBuf);
          gl.bufferData(gl.ARRAY_BUFFER, sizeArr, gl.DYNAMIC_DRAW);
          gl.vertexAttribPointer(aSize, 1, gl.FLOAT, false, 0, 0);
          gl.enableVertexAttribArray(aSize);

          gl.bindBuffer(gl.ARRAY_BUFFER, colorBuf);
          gl.bufferData(gl.ARRAY_BUFFER, colorArr, gl.DYNAMIC_DRAW);
          gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, 0, 0);
          gl.enableVertexAttribArray(aColor);

          const scrollEffect = window.scrollY * 0.0004;
          const proj = perspective(Math.PI / 4, W / H, 0.1, 100);
          const view = multiply(translate(0, 0, -5), rotY(t + scrollEffect));
          const mvp = multiply(proj, view);

          gl.uniformMatrix4fv(uMVP, false, new Float32Array(mvp));
          gl.drawArrays(gl.POINTS, 0, N);

          webglAnimId = requestAnimationFrame(frame);
        };
        webglAnimId = requestAnimationFrame(frame);

        return () => {
          window.removeEventListener('scroll', handleScroll);
          window.removeEventListener('resize', resize);
          cancelAnimationFrame(webglAnimId);
          observer.disconnect();
        };
      }
    }
  }, []);

  return (
    <>
      <canvas id="webgl" ref={canvasRef}></canvas>

      <div className="orb orb1"></div>
      <div className="orb orb2"></div>
      <div className="orb orb3"></div>

      <nav>
        <div className="nav-logo">Puzzles</div>
      </nav>

      <section id="hero">
        <h1 className="hero-title" ref={heroTitleRef}>
          Autonomous<br />
          <span className="line2">Meeting Intelligence</span>
          <span className="accent"> Agent</span>
        </h1>
        <p className="hero-sub" ref={heroSubRef}>
          // meetings generate decisions.<br />
          decisions generate nothing.<br />
          until now.
        </p>
        <div className="hero-uspseal" ref={heroSealRef}>
          "The first agent that doesn't just record your meetings — it acts on them."
        </div>
      </section>

      <div className="marquee-wrap">
        <div className="marquee-track" id="marquee">
          {["Whisper STT", "AssemblyAI", "Claude API", "LangChain", "Supabase", "Next.js", "D3.js", "scikit-learn", "FastAPI", "Slack Webhooks", "Notion API", "BART-MNLI", "Vercel", "Railway"].map((item, idx) => (
            <div key={idx} className="marquee-item">{item}</div>
          ))}
          {["Whisper STT", "AssemblyAI", "Claude API", "LangChain", "Supabase", "Next.js", "D3.js", "scikit-learn", "FastAPI", "Slack Webhooks", "Notion API", "BART-MNLI", "Vercel", "Railway"].map((item, idx) => (
            <div key={`dup-${idx}`} className="marquee-item">{item}</div>
          ))}
        </div>
      </div>

      <section id="problem" ref={problemRef}>
        <div className="problem-sticky">
          <motion.div className="problem-text-container" style={{ x: textX, opacity: textOpacity }}>
            <div className="problem-bigtext">
              Decisions<br />made in<br />meetings<span className="highlight">disappear.</span>
            </div>
          </motion.div>
          <motion.div className="problem-cards-container" style={{ x: cardsX, opacity: cardsOpacity }}>
            <div className="problem-label">The Problem</div>
            <div className="problem-card" style={{ marginBottom: '16px' }}>
              <div className="problem-stat">01</div>
              <h3>Lost in notes</h3>
              <p>Action items get buried in docs no one reads again. The decision existed — its execution didn't.</p>
            </div>
            <div className="problem-card">
              <div className="problem-stat">02</div>
              <h3>No accountability loop</h3>
              <p>Verbal commitments evaporate by end-of-week. There's nothing connecting what was said to what got done.</p>
            </div>
          </motion.div>
        </div>
      </section>

      <section id="features">
        <div className="section-label">Competitive Analysis</div>
        <h2 className="section-title">Now, How are we Different?</h2>
        <div className="table-container" data-scroll>
          <table className="comparison-table">
            <thead>
              <tr>
                <th>Competing Tool</th>
                <th>What They Do</th>
                <th>What We Add</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Otter.ai / Fireflies</td>
                <td>Transcribe and summarize</td>
                <td>Auto-assign tasks + track completion</td>
              </tr>
              <tr>
                <td>Notion AI</td>
                <td>Summarize pasted notes</td>
                <td>Live call bot, zero manual paste</td>
              </tr>
              <tr>
                <td>Asana / Linear</td>
                <td>Task tracking (manual entry)</td>
                <td>Tasks created from speech, automatically</td>
              </tr>
            </tbody>
          </table>
          <div className="table-bonus-bar">
            <strong>Bonus:</strong> Conflict detection, accountability graph, meeting health score
          </div>
        </div>
      </section>

      <section id="stack">
        <h2 className="section-title" style={{ marginBottom: '16px', textTransform: 'uppercase' }}>Full Tech Stack</h2>
        <div className="section-label" style={{ marginBottom: '80px' }}>14 Tools. All Free.</div>
        <div className="stack-grid">
          {[
            { layer: "Transcription", tool: "Whisper", cost: "Free OSS" },
            { layer: "Speaker ID", tool: "AssemblyAI", cost: "Free tier" },
            { layer: "Meeting Bot", tool: "Meet API", cost: "Free" },
            { layer: "LLM Extract", tool: "Claude API", cost: "Free tier" },
            { layer: "Chaining", tool: "LangChain", cost: "Free OSS" },
            { layer: "Conflict NLP", tool: "BART-MNLI", cost: "Free OSS" },
            { layer: "Graph", tool: "D3.js", cost: "Free OSS" },
            { layer: "Classifier", tool: "scikit-learn", cost: "Free OSS" },
            { layer: "ML Serving", tool: "FastAPI", cost: "Railway free" },
            { layer: "Tasks", tool: "Notion API", cost: "Free tier" },
            { layer: "Alerts", tool: "Slack Hooks", cost: "Free" },
            { layer: "Database", tool: "Supabase", cost: "Free 500MB" },
            { layer: "Dashboard", tool: "Next.js", cost: "Vercel free" },
            { layer: "Automation", tool: "n8n", cost: "Self-hosted" }
          ].map((item, idx) => (
            <div key={idx} className="stack-item" data-scroll style={{ transitionDelay: `${idx * 0.04}s` }}>
              <div className="stack-layer">{item.layer}</div>
              <div className="stack-tool">{item.tool}</div>
              <div className="stack-cost">{item.cost}</div>
            </div>
          ))}
        </div>
      </section>

      <section id="moat">
        <div className="moat-bg"></div>
        <div className="moat-label">Core Moat</div>
        <h2 className="moat-title">Others stop<br />at the transcript.<br /><span style={{ color: 'var(--purple-mid)' }}>We own execution.</span></h2>
        <div className="differentiators">
          {[
            { num: "01 / 03", title: "Zero-friction capture", desc: "Joins calls silently. No installs for attendees. Zero behavior change required." },
            { num: "02 / 03", title: "Context-aware assignment", desc: "Assigns tasks to the speaker — not just any participant in the room." },
            { num: "03 / 03", title: "Accountability loop", desc: "Tracks completion. Sends reminders. Shows which decisions actually got done." }
          ].map((diff, idx) => (
            <div key={idx} className="diff-item">
              <div className="diff-num">{diff.num}</div>
              <div className="diff-title">{diff.title}</div>
              <div className="diff-desc">{diff.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <footer>
        <div className="footer-left">Puzzles</div>
      </footer>
    </>
  );
}
