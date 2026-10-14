import { useEffect, useState } from "react";

import { NeuroNoise } from "@paper-design/shaders-react";

const BACK = "#08090a";
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
