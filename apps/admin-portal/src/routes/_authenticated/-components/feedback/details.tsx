import { Link } from "@tanstack/react-router";

import type { FeedbackView } from "@namera-ai/protocol/dto";
import { Typography } from "@namera-ai/ui";

import { EmailDisplay, MemberDisplay } from "@/components/team-display";

import { feedbackCategories, FeedbackDate, FeedbackStatusDisplay } from "./display";
import { FeedbackStatusActions } from "./status-actions";

export function FeedbackDetails({ entry }: { entry: FeedbackView }) {
  return (
    <article className="mx-auto grid w-full max-w-4xl gap-6 py-4 sm:py-8">
      <Link
        to="/feedback"
        className="w-fit text-sm text-muted hover:text-foreground hover:underline"
      >
        Back to feedback
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="grid gap-3">
          <Typography.Heading level={2} className="text-2xl">
            {feedbackCategories.find((option) => option.id === entry.category)?.label}
          </Typography.Heading>
          <FeedbackStatusDisplay status={entry.status} />
        </div>
        <FeedbackStatusActions entry={entry} />
      </header>
      <dl className="grid gap-4 rounded-xl bg-surface p-4 text-sm sm:grid-cols-2 sm:p-5">
        <div className="grid min-w-0 gap-2">
          <dt className="text-muted">Submitted by</dt>
          <dd className="grid min-w-0 gap-1">
            <MemberDisplay {...entry.user} />
            <EmailDisplay email={entry.user.email} />
          </dd>
        </div>
        <div className="grid min-w-0 content-start gap-2">
          <dt className="text-muted">Organization</dt>
          <dd className="break-words">{entry.organization?.metadata.name ?? "No organization"}</dd>
        </div>
        <div className="grid gap-2">
          <dt className="text-muted">Submitted</dt>
          <dd>
            <FeedbackDate value={entry.createdAt} />
          </dd>
        </div>
        <div className="grid gap-2">
          <dt className="text-muted">Updated</dt>
          <dd>
            <FeedbackDate value={entry.updatedAt} />
          </dd>
        </div>
        {entry.pagePath ? (
          <div className="grid min-w-0 gap-2 sm:col-span-2">
            <dt className="text-muted">Page</dt>
            <dd className="break-all">{entry.pagePath}</dd>
          </div>
        ) : null}
      </dl>
      <section aria-labelledby="feedback-message" className="grid min-w-0 gap-3">
        <Typography.Heading id="feedback-message" level={3} className="text-base">
          Message
        </Typography.Heading>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">
          {entry.data.message}
        </p>
      </section>
    </article>
  );
}
