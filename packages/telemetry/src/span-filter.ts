import type {
  ReadableSpan,
  Span,
  SpanProcessor,
} from "@opentelemetry/sdk-trace-base";

const lowLevelDatabaseSpanNames = new Set([
  "drizzle.operation",
  "sql.execute",
  "sql.transaction",
]);

export class FilteringSpanProcessor implements SpanProcessor {
  constructor(
    private readonly delegate: SpanProcessor,
    private readonly shouldDrop: (span: ReadableSpan) => boolean,
  ) {}

  forceFlush() {
    return this.delegate.forceFlush();
  }

  onStart(span: Span, parentContext: Parameters<SpanProcessor["onStart"]>[1]) {
    this.delegate.onStart(span, parentContext);
  }

  onEnding(span: Span) {
    this.delegate.onEnding?.(span);
  }

  onEnd(span: ReadableSpan) {
    if (!this.shouldDrop(span)) {
      this.delegate.onEnd(span);
    }
  }

  shutdown() {
    return this.delegate.shutdown();
  }
}

export const isLowLevelDatabaseSpan = (span: ReadableSpan) =>
  lowLevelDatabaseSpanNames.has(span.name) || span.name.startsWith("pg.query");
