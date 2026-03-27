import { createFileRoute } from "@tanstack/react-router";

import { Footer, Navbar } from "@/components";
import { Hero, HowItWorks } from "@/sections";
import { Products } from "@/sections/products";

const Home = () => {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <Navbar />
      <Hero />
      <Products />
      <HowItWorks />
      <div className="h-screen" />
      <Footer />
    </div>
  );
};

export const Route = createFileRoute("/")({ component: Home });
