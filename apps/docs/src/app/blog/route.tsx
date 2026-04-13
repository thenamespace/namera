import { createFileRoute, Outlet } from "@tanstack/react-router";

import { Footer, Navbar } from "@/components";

const BlogLayout = () => {
  return (
    <div className="bg-[#08090a]">
      <Navbar />
      <Outlet />
      <Footer showDesign={false} />
    </div>
  );
};

export const Route = createFileRoute("/blog")({
  component: BlogLayout,
});
