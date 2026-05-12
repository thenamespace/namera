import { createHead, UnheadProvider } from "@unhead/react/client";
import { InferSeoMetaPlugin } from "@unhead/react/plugins";

const head = createHead({
  plugins: [InferSeoMetaPlugin()],
});

export const HeadProvider = ({ children }: React.PropsWithChildren) => {
  return <UnheadProvider head={head}>{children}</UnheadProvider>;
};
