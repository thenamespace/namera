import { useEffect, useState } from "react";

import { NeuroNoise } from "@paper-design/shaders-react";

/*
 * The field behind the closing ask, from Paper's shader set.
 *
 * Neuro noise rather than a mesh gradient: the branching filaments read as a
 * network, which is what the product sits in, and a mesh gradient is the one
 * background treatment every generated page already ships.
 *
 * The three colours are the palette's own steps (DESIGN.md): the canvas, the
 * accent, and the lighter accent used for text on dark. Brightness and contrast
 * are held low so the type in front keeps its contrast ratio, with the scrim in
 * `closing-cta.tsx` doing the rest.
 */

const BACK = "#121213";
const MID = "#5e6ad2";
const FRONT = "#828fff";

export const ShaderField = ({ className }: { readonly className?: string }) => {
  const [still, setStill] = useState(true);

  /* Server-rendered it draws nothing, so motion is decided once, on the client. */
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => {
      setStill(query.matches);
    };
    sync();
    query.addEventListener("change", sync);
    return () => {
      query.removeEventListener("change", sync);
    };
  }, []);

  return (
    <NeuroNoise
      {...(className === undefined ? {} : { className })}
      colorBack={BACK}
      colorMid={MID}
      colorFront={FRONT}
      brightness={0.14}
      contrast={0.42}
      scale={1.1}
      speed={still ? 0 : 0.35}
    />
  );
};
