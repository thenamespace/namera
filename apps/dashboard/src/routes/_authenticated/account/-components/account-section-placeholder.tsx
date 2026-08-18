import { Typography } from "@namera-ai/ui";

type AccountSectionPlaceholderProps = {
  title: string;
  description: string;
};

export function AccountSectionPlaceholder({ title, description }: AccountSectionPlaceholderProps) {
  return (
    <section className="border-t border-separator pt-8">
      <Typography.Heading className="text-lg" level={2}>
        {title}
      </Typography.Heading>
      <Typography.Paragraph className="mt-2 text-muted" size="sm">
        {description}
      </Typography.Paragraph>
    </section>
  );
}

export type { AccountSectionPlaceholderProps };
