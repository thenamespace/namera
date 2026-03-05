import type { PropsWithChildren } from "react";

import { ThemeProvider } from "./theme";

export const ProviderTree = ({ children }: PropsWithChildren) => {
  return <ThemeProvider defaultTheme="dark">{children}</ThemeProvider>;
};
