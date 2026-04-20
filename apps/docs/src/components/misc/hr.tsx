export const Hr = () => {
  return (
    <div
      aria-hidden={true}
      className="pointer-events-none absolute inset-x-0 top-0 h-px"
      style={{
        background:
          "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)",
      }}
    />
  );
};
