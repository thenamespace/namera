const products = [
  {
    color: "#ffa16c",
    description:
      "Manage smart wallets, session keys, and agent access through a unified layer without running your own backend",
    key: "platform",
    title: (
      <div className="flex flex-col gap-0">
        <span className="text-3xl">90%</span>
        <span className="text-muted-foreground">Less overhead</span>
      </div>
    ),
  },
  {
    color: "#b6d6ff",
    description:
      "Integrate programmable wallets into your app or agent workflows with a simple, developer-first toolkit",
    key: "sdk",
    title: (
      <div className="flex flex-col gap-0">
        <span>5 min</span>
        <span className="text-muted-foreground">Integration time</span>
      </div>
    ),
  },
  {
    color: "#d6fe51",
    description:
      "Operate wallets and execute transactions through CLI or MCP with full control over agent behavior",
    key: "cli",
    title: (
      <div className="flex flex-col gap-0">
        <span>100%</span>
        <span className="text-muted-foreground">Local Control</span>
      </div>
    ),
  },
];

type Product = (typeof products)[number];

const ProductCard = (product: Product) => {
  return (
    <div className="flex flex-col border rounded-xl max-w-xs">
      <div className="p-5 h-56">
        <div className="flex flex-row gap-4">
          <div
            className="h-16 w-0.5"
            style={{
              backgroundColor: product.color,
            }}
          />
          <div className="text-3xl font-medium">{product.title}</div>
        </div>
      </div>
      <div className="p-5 border-t">{product.description}</div>
    </div>
  );
};

export const Products = () => {
  return (
    <section
      className="px-4 max-w-7xl mx-auto py-[5dvh] min-h-dvh justify-evenly flex flex-col"
      id="products"
    >
      <h2 className="text-3xl max-w-xl mx-auto text-center heading-gradient pb-2 sm:text-4xl md:text-5xl">
        Everything you need to build agent wallets
      </h2>
      <div className="grid grid-cols-1 gap-8 py-24 max-w-5xl mx-auto sm:grid-cols-2 md:grid-cols-3 justify-items-center">
        {products.map((product) => (
          <ProductCard {...product} key={product.key} />
        ))}
      </div>
    </section>
  );
};
