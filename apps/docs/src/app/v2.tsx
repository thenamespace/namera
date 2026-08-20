import { createFileRoute } from "@tanstack/react-router";

import { Navbar } from "@/components";
import { Footer } from "@/components/footer";
import { Integrate, McpSection, SessionKeys } from "@/sections";
import {
  BoundedAutonomy,
  ControlPlane,
  Cta,
  Demos,
  Faqs,
  Features,
  Hero,
  HowItWorks,
} from "@/sections/v2";

const HomeV2 = () => {
  return (
    <div className="min-h-screen bg-[#08090a]">
      <Navbar />
      <Hero />
      <HowItWorks />
      <ControlPlane />
      <SessionKeys />
      <Features />
      <BoundedAutonomy />
      <McpSection />
      <Demos />
      <Integrate />
      <Faqs />
      <Cta />
      <Footer />
    </div>
  );
};

export const Route = createFileRoute("/v2")({ component: HomeV2 });
