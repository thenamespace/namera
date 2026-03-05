import type { PropsWithChildren } from "react";

import { ThemeProvider } from "./theme";
import { Web3Provider } from "./web3";

export const ProviderTree = ({ children }: PropsWithChildren) => {
  return (
    <ThemeProvider defaultTheme="dark">
      <Web3Provider>{children}</Web3Provider>
    </ThemeProvider>
  );
};
