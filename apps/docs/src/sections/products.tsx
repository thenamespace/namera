import { Hr } from "@/components/misc";

const products = [
  {
    tagline:
      "A fully managed backend for wallets and session keys, handling agent access and execution.",
    title: "Platform",
  },
  {
    tagline:
      "Integrate wallet capabilities into any app or workflow, using simple, composable building blocks.",
    title: "Developer toolkit",
  },
  {
    tagline:
      "A local-first interface for operating wallets and execution flows, with full control from your terminal.",
    title: "Local CLI",
  },
  {
    tagline:
      "Expose wallet functionality to agents in a structured way, enabling controlled and reliable interaction.",
    title: "MCP Server",
  },
  {
    tagline:
      "Integrate onchain payments directly into your systems, with support for conditional execution.",
    title: "x402 Payments",
  },
  {
    tagline:
      "Support for Stripe’s machine payments protocol, enabling agents to pay and transact using crypto.",
    title: "Machine payments (MPP)",
  },
];

type Product = (typeof products)[number];

export const Products = () => {
  return (
    <>
      <Hr />
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
      <Hr />
    </>
  );
};

const ProductCard = (product: Product) => {
  return (
    <div className="flex-1 border rounded-xl overflow-hidden border-[#727DA1]/10 bg-[#0F101A] min-w-full sm:min-w-84 sm:max-w-84 relative min-h-84">
      <img
        alt=""
        className="w-full h-full object-cover aspect-video"
        src="/assets/product-card.png"
      />
      <div className="flex flex-col gap-2 p-4 absolute bottom-2 mx-4">
        <div className="text-white">{product.title}</div>
        <p className="font-light text-neutral-200">{product.tagline}</p>
      </div>
    </div>
  );
};
