import { Spinner } from "@namera-ai/ui";
import { cn } from "@namera-ai/ui/utils";

type DataLoadingProps = {
  readonly className?: string;
  readonly label?: string;
};

export function DataLoading({ className, label = "Loading data" }: DataLoadingProps) {
  return (
    <output aria-live="polite" className={cn("grid min-h-40 place-items-center", className)}>
      <Spinner />
      <span className="sr-only">{label}</span>
    </output>
  );
}
