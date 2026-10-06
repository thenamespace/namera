import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { cliFailure } from "./error-feedback.js";

export interface CliProfile {
  readonly baseUrl: string;
  readonly authorizationId?: string;
  readonly organizationId?: string;
  readonly organizationName?: string;
}

export interface CliConfig {
  readonly activeProfile: string;
  readonly profiles: Readonly<Record<string, CliProfile>>;
}

const configDirectory = () => {
  if (process.env.XDG_CONFIG_HOME) return join(process.env.XDG_CONFIG_HOME, "namera");
  if (process.platform === "darwin")
    return join(homedir(), "Library", "Application Support", "namera");
  if (process.platform === "win32") {
    return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "Namera");
  }
  return join(homedir(), ".config", "namera");
};

export const cliConfigPath = join(configDirectory(), "config.json");
export const cliLockPath = (profile: string) => join(configDirectory(), `${profile}.refresh.lock`);

export const readCliConfig = async (): Promise<CliConfig> => {
  try {
    return JSON.parse(await readFile(cliConfigPath, "utf8")) as CliConfig;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw cliFailure("CONFIG_UNAVAILABLE");
    return { activeProfile: "personal", profiles: {} };
  }
};

export const writeCliConfig = async (config: CliConfig) => {
  await mkdir(dirname(cliConfigPath), { recursive: true, mode: 0o700 });
  const temporaryPath = `${cliConfigPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  await rename(temporaryPath, cliConfigPath);
};

export const getProfile = async (name?: string) => {
  const config = await readCliConfig();
  const profileName = name ?? config.activeProfile;
  const profile = config.profiles[profileName];
  if (profile === undefined) throw cliFailure("UNAUTHORIZED");
  return { config, profile, profileName };
};

export const saveProfile = async (name: string, profile: CliProfile) => {
  const config = await readCliConfig();
  await writeCliConfig({
    activeProfile: name,
    profiles: { ...config.profiles, [name]: profile },
  });
};

export const removeProfile = async (name: string) => {
  const config = await readCliConfig();
  const profiles = { ...config.profiles };
  delete profiles[name];
  await writeCliConfig({
    activeProfile:
      config.activeProfile === name
        ? (Object.keys(profiles)[0] ?? "personal")
        : config.activeProfile,
    profiles,
  });
};
