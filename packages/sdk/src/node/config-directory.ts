import { homedir } from "node:os";
import { join } from "node:path";

export const nameraConfigDirectory = () => {
  if (process.env.XDG_CONFIG_HOME) return join(process.env.XDG_CONFIG_HOME, "namera");
  if (process.platform === "darwin")
    return join(homedir(), "Library", "Application Support", "namera");
  if (process.platform === "win32")
    return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "Namera");
  return join(homedir(), ".config", "namera");
};
