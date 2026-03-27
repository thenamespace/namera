import { createFileRoute } from "@tanstack/react-router";

import { Footer, Navbar } from "@/components";
import { Hr } from "@/components/misc";
import { CallToAction, Faqs, Hero, HowItWorks, UseCases } from "@/sections";
import { Products } from "@/sections/products";

const Home = () => {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <Navbar />
      <Hero />
      <Hr />
      <Products />
      <Hr />
      <HowItWorks />
      <Hr />
      <UseCases />
      <Hr />
      <Faqs />
      <Hr />
      <CallToAction />
      <Footer />
    </div>
  );
};

export const Route = createFileRoute("/")({ component: Home });
