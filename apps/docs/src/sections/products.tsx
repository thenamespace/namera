import { motion, type Variants } from "motion/react";

import { Hr } from "@/components";

const products = [
  {
    color: "#ffa16c",
    description:
      "Manage smart wallets, session keys, and agent access through a unified layer without running your own backend",
    key: "platform",
    label: "Platform",
    stat: "90%",
    statSub: "Less Overhead",
  },
  {
    color: "#b6d6ff",
    description:
      "Integrate programmable wallets into your app or agent workflows with a simple, developer-first toolkit",
    key: "sdk",
    label: "SDK",
    stat: "5 min",
    statSub: "Integration time",
  },
  {
    color: "#d6fe51",
    description:
      "Operate wallets and execute transactions through CLI or MCP with full control over agent behavior",
    key: "cli",
    label: "CLI",
    stat: "100%",
    statSub: "Local Control",
  },
];

type Product = (typeof products)[number];

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.6,
      ease: [0.16, 1, 0.3, 1],
    },
    y: 0,
  },
};

const ProductCard = (product: Product) => {
  return (
    <motion.div
      className="group relative flex w-full flex-col overflow-hidden rounded-xl border border-white/10 bg-white/2 backdrop-blur-sm"
      style={{
        boxShadow:
          "0 0 0 1px rgba(255,255,255,0.02), 0 8px 24px -12px rgba(0,0,0,0.6)",
      }}
      variants={itemVariants}
    >
      {/* Top gradient accent line */}
      <div
        aria-hidden={true}
        className="absolute inset-x-0 top-0 h-px opacity-60"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)",
        }}
      />
      <div className="relative p-6 h-56">
        <div className="flex flex-row items-start gap-4">
          <div
            className="h-16 w-0.5 rounded-full"
            style={{
              backgroundColor: product.color,
            }}
          />
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/55">
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
    </motion.div>
  );
};

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      delayChildren: 0.2,
      staggerChildren: 0.15,
    },
  },
};

export const Products = () => {
  return (
    <motion.section
      className="relative px-4 max-w-7xl mx-auto py-[12dvh] flex flex-col gap-16 min-h-[80dvh] justify-center"
      id="products"
      initial="hidden"
      variants={containerVariants}
      viewport={{ margin: "-100px", once: true }}
      whileInView="visible"
    >
      <Hr />

      <motion.h2
        className="text-3xl max-w-xl mx-auto text-center heading-gradient pb-2 sm:text-4xl md:text-5xl tracking-tight"
        variants={itemVariants}
      >
        The complete stack for agent wallets
      </motion.h2>
      <div className="grid grid-cols-1 gap-8 max-w-5xl mx-auto sm:grid-cols-2 md:grid-cols-3 justify-items-center w-full">
        {products.map((product) => (
          <ProductCard {...product} key={product.key} />
        ))}
      </div>
    </motion.section>
  );
};
