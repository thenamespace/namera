export const AmbientGlow = () => {
  return (
    <div
      aria-hidden={true}
      className="pointer-events-none absolute inset-x-0 top-1/4 mx-auto h-96 max-w-4xl blur-3xl opacity-30"
      style={{
        background:
          "radial-gradient(ellipse 60% 50% at 30% 50%, rgba(255,255,255,0.05), transparent 70%), radial-gradient(ellipse 40% 50% at 80% 50%, rgba(255,255,255,0.04), transparent 70%)",
      }}
    />
  );
};
