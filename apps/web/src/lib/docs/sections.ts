export function getDocsSection(url: string) {
  const section = url.split("/")[2];
  return section === "sdk" || section === "cli" || section === "mcp" ? section : "dashboard";
}
