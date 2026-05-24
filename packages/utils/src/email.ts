export const inferNameFromEmail = (email: string) => {
  const localPart = email.split("@")[0] ?? "User";

  const cleaned = localPart
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "User";

  return cleaned
    .split(" ")
    .map((part) => {
      if (/\d/.test(part)) return part;
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    })
    .join(" ");
};
