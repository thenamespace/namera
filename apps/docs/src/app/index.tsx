import { createFileRoute } from "@tanstack/react-router";

import ReactLenis from "lenis/react";

import { Navbar } from "@/components";
import { Footer } from "@/components/footer";
import { Faqs, Hero, Integrate, Products, WhyNamera } from "@/sections";

const Home = () => {
  return (
    <ReactLenis root={true}>
      <div className="min-h-screen overflow-x-hidden bg-[#08090a]">
        <Navbar />
        <Hero />
        <Products />
        <WhyNamera />
        <Integrate />
        <Faqs />
        <Footer />
      </div>
    </ReactLenis>
  );
};

export const Route = createFileRoute("/")({ component: Home });
