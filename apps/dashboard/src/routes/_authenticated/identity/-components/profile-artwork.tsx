import type { ReactNode } from "react";

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
  headerPreview,
  avatarPreview,
  headerAction,
  avatarAction,
}: {
  texts: Readonly<Record<string, string>>;
  name: string;
  headerPreview?: string | undefined;
  avatarPreview?: string | undefined;
  headerAction?: ReactNode;
  avatarAction?: ReactNode;
}) {
  const banner =
    headerPreview ??
    imageUrl(texts.header) ??
    "https://cdn.namera.ai/identity/namera-identity-header-v2.webp";
  const avatar =
    avatarPreview ??
    imageUrl(texts.avatar) ??
    "https://cdn.namera.ai/identity/namera-identity-avatar-v2.webp";
  return (
    <div>
      <div className="group relative h-32 overflow-hidden bg-gradient-to-br from-accent/25 via-surface to-accent/10 sm:h-36">
        <img
          src={banner}
          alt=""
          referrerPolicy="no-referrer"
          className="h-full w-full object-cover"
        />
        {headerAction}
      </div>
      <div
        className="group relative mx-5 -mt-7 mb-3 flex size-16 items-center justify-center overflow-hidden rounded-xl border-4 border-background bg-surface text-2xl font-medium"
        aria-label={`${name} avatar`}
      >
        <img src={avatar} alt="" referrerPolicy="no-referrer" className="size-full object-cover" />
        {avatarAction}
      </div>
    </div>
  );
}
