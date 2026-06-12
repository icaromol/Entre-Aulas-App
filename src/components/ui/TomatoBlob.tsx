import { useEffect, useRef } from "react";
import { motion, useMotionValue, animate } from "motion/react";

function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function useMorphingRef(shapes: string[], duration: number) {
  const pathRef = useRef<SVGPathElement>(null);
  useEffect(() => {
    let rafId: number;
    let startTime: number | null = null;
    let fromIdx = 0;
    let toIdx = 1;

    function tick(now: number) {
      if (startTime === null) startTime = now;
      const elapsed = now - startTime;
      const t = easeInOut(Math.min(elapsed / (duration * 1000), 1));
      if (pathRef.current) {
        pathRef.current.setAttribute("d", lerpPath(shapes[fromIdx], shapes[toIdx], t));
      }
      if (elapsed >= duration * 1000) {
        startTime = now;
        fromIdx = toIdx;
        toIdx = (toIdx + 1) % shapes.length;
      }
      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  return pathRef;
}
import { COLORS } from "@/lib/colors";

interface TomatoBlobProps {
  size?: "sm" | "md" | "lg";
  celebrating?: boolean;
}

const SIZES = { sm: 272, md: 374, lg: 544 };

// Body blob — 3 variants, identical command count, already translated to (100,100) origin
const BODY_SHAPES = [
  "M141.4,86.1C150.4,114.3,152.2,144.3,135.7,158.5C119.2,172.8,84.4,171.1,60.2,153.8C35.9,136.4,22.3,103.4,30.8,76.1C39.2,48.8,69.6,27.2,92.9,29.5C116.2,31.8,132.4,58,141.4,86.1Z",
  "M138.4,83.1C148.2,112.0,150.8,143.5,133.2,157.8C115.6,172.1,81.0,170.2,57.5,152.1C34.0,134.0,21.2,100.2,30.5,73.5C39.8,46.8,71.4,26.0,94.3,28.8C117.2,31.6,128.6,54.2,138.4,83.1Z",
  "M143.6,88.8C152.8,117.4,153.4,146.2,136.8,160.0C120.2,173.8,86.6,171.8,62.4,154.2C38.2,136.6,23.8,105.2,32.0,77.5C40.2,49.8,68.2,28.2,91.6,30.2C115.0,32.2,134.4,60.2,143.6,88.8Z",
];

// Stem blob — 2 user-provided shapes + 1 interpolated midpoint, all same command count
const STEM_SHAPES = [
  "M133.8,36C137.8,43.7,130.7,65,133.8,77.9C136.9,90.9,150.1,95.4,159.1,105.2C168.2,115,173.1,130,168.9,141C164.7,151.9,151.3,158.8,138.3,156.9C125.3,154.9,112.6,144.1,103.2,138.7C93.7,133.2,87.3,133.1,81.4,131C75.4,128.9,69.8,124.8,60.5,119.3C51.1,113.8,38.1,106.9,38.1,100C38.2,93.2,51.3,86.3,57.4,75.2C63.5,64.2,62.6,48.9,68.5,42.4C74.5,35.9,87.2,38.1,101.1,36.3C115,34.4,129.9,28.3,133.8,36Z",
  "M124.3,66.1C137.7,65.6,159,59.6,172.2,64.4C185.4,69.1,190.5,84.6,181.7,94.9C172.8,105.3,150.1,110.5,137.7,116.7C125.3,122.9,123.4,130,118.9,141.8C114.3,153.6,107.2,169.9,99.9,170.1C92.6,170.3,85.3,154.3,76.6,144.9C68,135.5,58,132.7,55.8,126.4C53.6,120,59.1,110,54.6,97.4C50.1,84.8,35.6,69.6,38.9,65.1C42.2,60.7,63.4,67,76.5,67.3C89.7,67.6,94.8,62.1,100.2,61.8C105.5,61.5,110.9,66.5,124.3,66.1Z",
  "M129.0,51.0C137.7,54.6,144.8,62.3,153.0,71.2C166.9,76.7,181.3,90.5,175.3,98.0C166.7,107.9,150.7,110.5,137.7,116.7C125.3,122.9,123.4,130,118.9,141.8C111.3,151.7,103.5,162.0,99.9,153.0C92.6,141.8,85.3,136.3,76.6,126.9C63.0,119.6,40.0,119.8,47.7,103.2C51.0,90.0,54.2,86.3,57.4,75.2C63.5,64.2,62.6,56.9,68.5,50.4C77.8,43.0,87.2,38.1,101.1,36.3C115.0,34.4,120.3,47.4,129.0,51.0Z",
];

function lerpPath(a: string, b: string, t: number): string {
  const numsA = a.match(/-?[\d.]+/g)!.map(Number);
  const numsB = b.match(/-?[\d.]+/g)!.map(Number);
  let idx = 0;
  return a.replace(/-?[\d.]+/g, () => {
    const v = numsA[idx] + (numsB[idx] - numsA[idx]) * t;
    idx++;
    return String(Math.round(v * 100) / 100);
  });
}


export function TomatoBlob({ size = "md" }: TomatoBlobProps) {
  const px = SIZES[size];

  const bodyRef = useMorphingRef(BODY_SHAPES, 42);

  // Breathing squish
  const breathX = useMotionValue(1);
  const breathY = useMotionValue(1);
  useEffect(() => {
    const cx = animate(breathX, [1, 1.015, 0.99, 1], { duration: 42, repeat: Infinity, ease: "easeInOut" });
    const cy = animate(breathY, [1, 0.985, 1.01, 1], { duration: 42, repeat: Infinity, ease: "easeInOut" });
    return () => { cx.stop(); cy.stop(); };
  }, []);


  const stemSize = px * 0.45;
  const stemLeft = px * 0.28;
  const stemTop = -(stemSize * 0.20);

  return (
    <div style={{ width: px, height: px, position: "relative", display: "inline-block" }}>

      {/* Cabinho */}
      <div
        style={{
          position: "absolute",
          left: stemLeft,
          top: stemTop,
          width: stemSize,
          height: stemSize,
          zIndex: 2,
        }}
      >
        <svg viewBox="0 0 200 200" width={stemSize} height={stemSize} style={{ overflow: "visible" }}>
          <path d={STEM_SHAPES[0]} fill={COLORS.lightGreen} />
        </svg>
      </div>

      {/* Breathing squish wrapper */}
      <motion.div
        style={{
          width: px,
          height: px,
          filter: "drop-shadow(0px 15px 30px rgba(255,76,62,0.18))",
          scaleX: breathX,
          scaleY: breathY,
          originX: "50%",
          originY: "50%",
        }}
      >
        <svg viewBox="0 0 200 200" width={px} height={px} style={{ overflow: "visible" }}>
          <defs>
            <linearGradient id="tomatoGrad" x1="30%" y1="0%" x2="70%" y2="100%">
              <stop offset="0%" stopColor={COLORS.tomato} />
              <stop offset="100%" stopColor="#cc2a1e" />
            </linearGradient>
          </defs>
          <g transform="translate(100,100) scale(1.6) translate(-100,-100)">
            <path ref={bodyRef} d={BODY_SHAPES[0]} fill="url(#tomatoGrad)" />
          </g>
        </svg>
      </motion.div>
    </div>
  );
}
