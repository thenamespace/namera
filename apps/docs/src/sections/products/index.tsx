import {
  CliIcon,
  MachinePaymentsIcon,
  PlatformIcon,
  StarIcon,
  ToolkitIcon,
  x402Icon,
} from "./icons";

const products = [
  {
    icon: PlatformIcon,
    tagline:
      "A fully managed backend for wallets and session keys, handling agent access and execution.",
    title: "Platform",
  },
  {
    icon: ToolkitIcon,
    tagline:
      "Integrate wallet capabilities into any app or workflow, using simple, composable building blocks.",
    title: "Developer toolkit",
  },
  {
    icon: CliIcon,
    tagline:
      "A local-first interface for operating wallets and execution flows, with full control from your terminal.",
    title: "Local CLI",
  },
  {
    icon: StarIcon,
    tagline:
      "Expose wallet functionality to agents in a structured way, enabling controlled and reliable interaction.",
    title: "MCP Server",
  },
  {
    icon: x402Icon,
    tagline:
      "Integrate onchain payments directly into your systems, with support for conditional execution.",
    title: "x402 Payments",
  },
  {
    icon: MachinePaymentsIcon,
    tagline:
      "Support for Stripe's machine payments protocol, enabling agents to pay and transact using crypto.",
    title: "Machine payments (MPP)",
  },
];

type Product = (typeof products)[number];

export const Products = () => {
  return (
    <section
      className="px-4 max-w-6xl mx-auto my-24 flex flex-col gap-12"
      id="products"
    >
      <h2 className="font-helveticaDisplay text-3xl sm:text-4xl heading-gradient text-center pb-2">
        Everything you need to
        <br />
        build agent wallets
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {products.map((product) => (
          <ProductCard key={product.title} {...product} />
        ))}
      </div>
    </section>
  );
};

const ProductCard = (product: Product) => {
  return (
    <div className="flex-1 border rounded-xl min-w-full sm:min-w-84 sm:max-w-84 relative py-6 px-6 flex gap-6 flex-col">
      <product.icon className="size-12 fill-[url(#gradient-primary)]" />
      <div className="flex flex-col gap-2 ">
        <div className="text-white">{product.title}</div>
        <p className="font-light text-neutral-200">{product.tagline}</p>
      </div>
    </div>
  );
};
