export const GridOverlay = () => {
  return (
    <div
      aria-hidden={true}
      className="pointer-events-none absolute inset-0 opacity-[0.04]"
      style={{
        backgroundImage:
          "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
        backgroundSize: "48px 48px",
        maskImage:
          "radial-gradient(ellipse 60% 60% at 50% 50%, #000 30%, transparent 80%)",
      }}
    />
  );
};
