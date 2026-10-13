function imageUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function IdentityArtwork({
  texts,
  name,
}: {
  texts: Readonly<Record<string, string>>;
  name: string;
}) {
  const banner = imageUrl(texts.header);
  const avatar = imageUrl(texts.avatar);
  return (
    <div>
      <div className="h-32 overflow-hidden bg-gradient-to-br from-accent/25 via-surface to-accent/10 sm:h-36">
        {banner ? (
          <img
            src={banner}
            alt=""
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div
        className="relative mx-5 -mt-7 mb-3 flex size-16 items-center justify-center overflow-hidden rounded-2xl border-4 border-background bg-surface text-2xl font-medium"
        aria-label={`${name} avatar`}
      >
        {avatar ? (
          <img
            src={avatar}
            alt=""
            referrerPolicy="no-referrer"
            className="size-full object-cover"
          />
        ) : (
          name.slice(0, 1).toUpperCase()
        )}
      </div>
    </div>
  );
}
