import { createFileRoute } from "@tanstack/react-router";

import { Navbar } from "@/components";
import { Footer } from "@/components/footer";
import {
  Cta,
  Faqs,
  Features,
  Hero,
  Industries,
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
      <Features />
      <WhyNamera />
      <McpSection />
      <UseCases />
      <Industries />
      <Integrate />
      <Faqs />
      <Cta />
      <Footer />
    </div>
  );
};

export const Route = createFileRoute("/")({ component: Home });
