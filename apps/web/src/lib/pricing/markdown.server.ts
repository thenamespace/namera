import { GROUPS, PLANS } from "#/components/pricing/plans";
import { PRICING_QUESTIONS } from "#/components/pricing/questions";

export function pricingMarkdown(origin: string) {
  const plans = PLANS.map(
    (plan) =>
      `## ${plan.name}\n\n${plan.price}${plan.cadence ? ` ${plan.cadence}` : ""}\n\n${plan.features.map((feature) => `- ${feature}`).join("\n")}`,
  ).join("\n\n");
  const comparison = GROUPS.map(
    (group) =>
      `### ${group.title ?? "Account and team limits"}\n\n| Feature | ${PLANS.map((plan) => plan.name).join(" | ")} |\n| --- | ${PLANS.map(() => "---").join(" | ")} |\n${group.rows.map((row) => `| ${row.label}${row.note ? ` ${row.note}` : ""} | ${PLANS.map((plan) => row.values[plan.id]).join(" | ")} |`).join("\n")}`,
  ).join("\n\n");
  const questions = PRICING_QUESTIONS.map(({ q, a }) => `### ${q}\n\n${a}`).join("\n\n");
  return `# Pricing\n\n> Documentation index: [llms.txt](${origin}/llms.txt).\n\nSource: ${origin}/pricing\n\n${plans}\n\n## Allowances and limits by plan\n\n${comparison}\n\n## Pricing questions\n\n${questions}\n\n## Launching soon!\n\nSmart accounts, session keys, and onchain policies - all in one place, ready for agents.\n\n[Join the waitlist](${origin}/#waitlist) or [Talk to us](mailto:hey@namera.ai). Paid plans: Coming soon.\n`;
}
