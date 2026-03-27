import { OrbitControls } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";

import { NodeGraph } from "./graph";

export const UseCases = () => {
  return (
    <section className="relative min-h-[90dvh] w-screen overflow-hidden cursor-grab active:cursor-grabbing py-24 max-w-7xl mx-auto mb-10">
      <h2 className="sr-only">The Agent Economy</h2>
      <div className="pointer-events-none absolute left-[10%] top-[45%] flex -translate-y-1/2 text-5xl tracking-wide md:text-7xl heading-gradient font-helveticaDisplay z-11 pb-2">
        The Agent
      </div>
      <div className="pointer-events-none absolute right-[10%] top-[55%] flex -translate-y-1/2 text-5xl tracking-wide md:text-7xl heading-gradient font-helveticaDisplay z-11 pb-2">
        Economy
      </div>

      <div className="absolute inset-0 z-10">
        <Canvas camera={{ fov: 60, position: [0, 0, 12] }}>
          <ambientLight intensity={0.5} />
          <NodeGraph count={150} radius={5} />
          <OrbitControls
            dampingFactor={0.05}
            enablePan={false}
            enableZoom={false}
          />
        </Canvas>
      </div>
      <div className="pointer-events-none absolute bottom-0 sm:bottom-[5%] z-100 font-mono text-[12px] sm:text-xs tracking-[0.2em] text-neutral-300 uppercase max-w-xs sm:max-w-md text-wrap text-center mx-auto translate-x-1/2 right-1/2 w-full">
        Hover to explore how agents use Namera
      </div>
    </section>
  );
};
