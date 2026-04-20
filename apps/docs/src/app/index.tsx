import { createFileRoute } from "@tanstack/react-router";

import { Navbar } from "@/components";
import { Footer } from "@/components/footer";
import {
  Faqs,
  Hero,
  Integrate,
  McpSection,
  Products,
  SessionKeys,
  UseCases,
  WhyNamera,
} from "@/sections";

const Home = () => {
  return (
    <div className="min-h-screen bg-[#08090a]">
      <Navbar />
      <Hero />
      <Products />
      <SessionKeys />
      <McpSection />
      <UseCases />
      <Integrate />
      <WhyNamera />
      <Faqs />
      <Footer />
    </div>
  );
};

export const Route = createFileRoute("/")({ component: Home });
