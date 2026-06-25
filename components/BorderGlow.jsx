import { useRef, useCallback, useEffect } from 'react';

function parseHSL(s) {
  const m = s.match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/);
  return m ? { h: +m[1], s: +m[2], l: +m[3] } : { h: 35, s: 80, l: 75 };
}

function buildGlowVars(glowColor, intensity) {
  const { h, s, l } = parseHSL(glowColor);
  const base = `${h}deg ${s}% ${l}%`;
  const ops = [100, 60, 50, 40, 30, 20, 10];
  const keys = ['', '-60', '-50', '-40', '-30', '-20', '-10'];
  const v = {};
  for (let i = 0; i < ops.length; i++)
    v[`--glow-color${keys[i]}`] = `hsl(${base} / ${Math.min(ops[i] * intensity, 100)}%)`;
  return v;
}

const POS = ['80% 55%', '69% 34%', '8% 6%', '41% 38%', '86% 85%', '82% 18%', '51% 4%'];
const GKEYS = ['--gradient-one','--gradient-two','--gradient-three','--gradient-four','--gradient-five','--gradient-six','--gradient-seven'];
const CM = [0, 1, 2, 0, 1, 2, 1];

function buildGradientVars(colors) {
  const v = {};
  for (let i = 0; i < 7; i++) {
    const c = colors[Math.min(CM[i], colors.length - 1)];
    v[GKEYS[i]] = `radial-gradient(at ${POS[i]}, ${c} 0px, transparent 50%)`;
  }
  v['--gradient-base'] = `linear-gradient(${colors[0]} 0 100%)`;
  return v;
}

function ease(x) { return 1 - Math.pow(1 - x, 3); }
function easeIn(x) { return x * x * x; }

function animate({ start = 0, end = 100, duration = 1000, delay = 0, ease: fn = ease, onUpdate, onEnd }) {
  const t0 = performance.now() + delay;
  function tick() {
    const t = Math.min((performance.now() - t0) / duration, 1);
    onUpdate(start + (end - start) * fn(t));
    if (t < 1) requestAnimationFrame(tick);
    else if (onEnd) onEnd();
  }
  setTimeout(() => requestAnimationFrame(tick), delay);
}

export default function BorderGlow({
  children,
  className = '',
  edgeSensitivity = 30,
  glowColor = '35 85 75',
  backgroundColor = '#F7F2EB',
  borderRadius = 28,
  glowRadius = 40,
  glowIntensity = 1.5,
  coneSpread = 22,
  animated = false,
  loop = false,
  loopSpeed = 0.35,
  innerStyle = {},
  colors = ['#F0DCBC', '#FBEFD7', '#E7CFA9'],
  fillOpacity = 0.4,
}) {
  const cardRef = useRef(null);

  const getCenter = useCallback((el) => {
    const { width, height } = el.getBoundingClientRect();
    return [width / 2, height / 2];
  }, []);

  const edgeProximity = useCallback((el, x, y) => {
    const [cx, cy] = getCenter(el);
    const dx = x - cx, dy = y - cy;
    let kx = Infinity, ky = Infinity;
    if (dx !== 0) kx = cx / Math.abs(dx);
    if (dy !== 0) ky = cy / Math.abs(dy);
    return Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
  }, [getCenter]);

  const cursorAngle = useCallback((el, x, y) => {
    const [cx, cy] = getCenter(el);
    const rad = Math.atan2(y - cy, x - cx);
    let deg = rad * (180 / Math.PI) + 90;
    if (deg < 0) deg += 360;
    return deg;
  }, [getCenter]);

  const handlePointerMove = useCallback((e) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left, y = e.clientY - rect.top;
    card.style.setProperty('--edge-proximity', `${(edgeProximity(card, x, y) * 100).toFixed(3)}`);
    card.style.setProperty('--cursor-angle', `${cursorAngle(card, x, y).toFixed(3)}deg`);
  }, [edgeProximity, cursorAngle]);

  // Intro sweep
  useEffect(() => {
    if (!animated || !cardRef.current) return;
    const card = cardRef.current;
    card.classList.add('sweep-active');
    card.style.setProperty('--cursor-angle', '110deg');
    animate({ duration: 500, onUpdate: v => card.style.setProperty('--edge-proximity', String(v)) });
    animate({ ease: easeIn, duration: 1500, end: 50, onUpdate: v => card.style.setProperty('--cursor-angle', `${(355 * v / 100) + 110}deg`) });
    animate({ ease, delay: 1500, duration: 2250, start: 50, end: 100, onUpdate: v => card.style.setProperty('--cursor-angle', `${(355 * v / 100) + 110}deg`) });
    animate({ ease: easeIn, delay: 2500, duration: 1500, start: 100, end: 0,
      onUpdate: v => card.style.setProperty('--edge-proximity', String(v)),
      onEnd: () => {
        if (!loop) card.classList.remove('sweep-active');
      },
    });
  }, [animated, loop]);

  // Continuous rotation loop for door glow
  useEffect(() => {
    if (!loop) return;
    const card = cardRef.current;
    if (!card) return;
    card.classList.add('sweep-active', 'loop-active');
    card.style.setProperty('--edge-proximity', '100');
    let angle = 110;
    let rafId;
    const tick = () => {
      angle = (angle + loopSpeed) % 360;
      card.style.setProperty('--cursor-angle', `${angle.toFixed(2)}deg`);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [loop, loopSpeed]);

  return (
    <div
      ref={cardRef}
      onPointerMove={loop ? undefined : handlePointerMove}
      className={`border-glow-card ${className}`}
      style={{
        '--card-bg': backgroundColor,
        '--edge-sensitivity': edgeSensitivity,
        '--border-radius': `${borderRadius}px`,
        '--glow-padding': `${glowRadius}px`,
        '--cone-spread': coneSpread,
        '--fill-opacity': fillOpacity,
        ...buildGlowVars(glowColor, glowIntensity),
        ...buildGradientVars(colors),
      }}
    >
      <span className="edge-light" />
      <div className="border-glow-inner" style={innerStyle}>
        {children}
      </div>
    </div>
  );
}
