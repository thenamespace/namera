const products = [
  {
    description:
      "Manage wallets, session keys, and agent access — no backend required.",
    key: "platform",
    label: "Platform",
    stat: "90%",
    statSub: "Less overhead",
  },
  {
    description: "Add programmable wallets to any app or agent workflow.",
    key: "sdk",
    label: "SDK",
    stat: "5 min",
    statSub: "Integration time",
  },
  {
    description: "Operate wallets via CLI or MCP. Full local control.",
    key: "cli",
    label: "CLI",
    stat: "100%",
    statSub: "Local Control",
  },
];

type Product = (typeof products)[number];

const ProductCard = (product: Product) => {
  return (
    <div
      className="group relative flex w-full max-w-xs flex-col overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] backdrop-blur-sm transition-all duration-300 ease-out"
      style={{
        boxShadow:
          "0 0 0 1px rgba(255,255,255,0.02), 0 8px 24px -12px rgba(0,0,0,0.6)",
      }}
    >
      {/* Top gradient accent line */}
      <div
        aria-hidden={true}
        className="absolute inset-x-0 top-0 h-px opacity-60"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.35) 50%, transparent 100%)",
        }}
      />
      {/* Colored radial glow on hover */}
      <div
        aria-hidden={true}
        className="pointer-events-none absolute top-6 left-1/2 h-28 w-28 -translate-x-1/2 rounded-full opacity-0 blur-2xl"
        style={{
          backgroundColor: "rgba(255,255,255,0.45)",
        }}
      />

      <div className="relative p-6 h-56">
        <div className="flex flex-row items-start gap-4">
          <div
            className="h-16 w-0.5 rounded-full"
            style={{
              backgroundColor: "rgba(255,255,255,0.7)",
              boxShadow: "0 0 12px rgba(255,255,255,0.14)",
            }}
          />
          <div className="flex flex-col gap-3">
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/55">
              {product.label}
            </span>
            <div className="flex flex-col gap-0">
              <span className="text-4xl font-semibold tracking-tight text-white/88">
                {product.stat}
              </span>
              <span className="text-sm text-muted-foreground mt-1">
                {product.statSub}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="relative border-t border-white/10 p-6 text-sm leading-relaxed text-muted-foreground">
        {product.description}
      </div>
    </div>
  );
};

export const Products = () => {
  return (
    <section
      className="relative px-4 max-w-7xl mx-auto py-[12dvh] flex flex-col gap-16"
      id="products"
    >
      {/* Section divider glow at top */}
      <div
        aria-hidden={true}
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)",
        }}
      />

      <div className="flex flex-col gap-3">
        <p className="text-center text-xs font-medium uppercase tracking-[0.25em] text-white/40">
          The Platform
        </p>
        <h2 className="text-3xl max-w-xl mx-auto text-center heading-gradient pb-2 sm:text-4xl md:text-5xl tracking-tight">
          Everything you need to build agent wallets
        </h2>
      </div>
      <div className="grid grid-cols-1 gap-8 max-w-5xl mx-auto sm:grid-cols-2 md:grid-cols-3 justify-items-center w-full">
        {products.map((product) => (
          <ProductCard {...product} key={product.key} />
        ))}
      </div>
    </section>
  );
};
