import { useId, useState } from "react";

interface Props {
  fill: number; // 0 = empty, 0..1 = partial, 1 = complete
  size?: number;
}

const PATH_LEAF = "M8,5.66A7.65,7.65,0,0,1,5.75,4.05c-.5,0-1.24.68-2.28,1.57,0-.86,1.17-1.7,1-1.93s-1.2.2-1.8.18A4.89,4.89,0,0,1,5.26,3c.27,0,.66-.64.55-1.27a.46.46,0,0,1,.37-.13c.26.07.4.85.32,1.33A4.8,4.8,0,0,1,9,3.47c-.84-.11-2,0-2,.33C6.94,4.65,7.73,4.7,8,5.66Z";
const PATH_BODY = "M5.7,4.34c.52.29,1.81,1.81,2.49,1.59.42-.15-.32-1.37-.85-2,.14-.29,1.69-.22,2.15-.22a5.08,5.08,0,0,1,3,4.45c0,2.87-2.77,5.2-6.19,5.2S.13,11,.13,8.11A4.93,4.93,0,0,1,2.48,4a6,6,0,0,0,1.76-.17,1.86,1.86,0,0,0-1,2C4.09,6.07,5.12,4.36,5.7,4.34Z";
const VIEWBOX = "0 0 12.37 11.68";
const TRANSFORM = "translate(-0.13 -1.63)";

export function PomodoroIcon({ fill, size = 28 }: Props) {
  const [hovered, setHovered] = useState(false);
  const rawId = useId();
  const id = `pom-${rawId.replace(/:/g, "")}`;

  const showColor = hovered || fill >= 1;

  // After transform(-0.13, -1.63), path data occupies viewBox coords:
  //   x: [0.13-0.13, 12.5-0.13] = [0, 12.37]
  //   y: [1.63-1.63, 13.31-1.63] = [0, 11.68]
  // Clip rect must be in this post-transform (viewBox) coordinate space.
  const clipW = 12.37 * fill;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={VIEWBOX}
      width={size}
      height={size}
      style={{ cursor: "pointer", flexShrink: 0 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <defs>
        <clipPath id={id}>
          <rect x="0" y="0" width={clipW} height="11.68" />
        </clipPath>
      </defs>

      {showColor ? (
        <>
          <path d={PATH_LEAF} fill="#74c044" transform={TRANSFORM} />
          <path d={PATH_BODY} fill="#f15a23" transform={TRANSFORM} />
        </>
      ) : (
        <>
          <path d={PATH_LEAF} fill="#D1D5DB" transform={TRANSFORM} />
          <path d={PATH_BODY} fill="#D1D5DB" transform={TRANSFORM} />
          {fill > 0 && (
            <>
              <path d={PATH_LEAF} fill="#4A90C4" transform={TRANSFORM} clipPath={`url(#${id})`} />
              <path d={PATH_BODY} fill="#4A90C4" transform={TRANSFORM} clipPath={`url(#${id})`} />
            </>
          )}
        </>
      )}
    </svg>
  );
}
