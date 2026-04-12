import { createFileRoute } from "@tanstack/react-router";

import { Navbar } from "@/components";
import { Hero, Integrate, Products, WhyNamera } from "@/sections";

// import { Hr } from "@/components/misc";
// import { CallToAction, Faqs, Hero, HowItWorks, UseCases } from "@/sections";
// import { Products } from "@/sections/products";

const Home = () => {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#08090a]">
      <Navbar />
      <Hero />
      <Products />
      <WhyNamera />
      <Integrate />
      <div className="h-dvh" />
      {/* <Hero />
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
      <Footer /> */}
    </div>
  );
};

export const Route = createFileRoute("/")({ component: Home });
