import config from "klarity/oxfmt";

export default {
  ...config,
  ignorePatterns: [...config.ignorePatterns, "contracts/dependencies/**", "contracts/out/**"],
};
