import type { MetadataIcon } from "@namera-ai/protocol/model";
import { Img } from "react-email";

/** User-provided images must be remotely loadable by email clients. */
export function emailImageUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function EmailIdentity({
  name,
  logo,
  avatarSeed,
}: {
  readonly name: string;
  readonly logo?: MetadataIcon | undefined;
  readonly avatarSeed?: string | undefined;
}) {
  const image = emailImageUrl(logo?.type === "image" ? logo.value : undefined);
  const src =
    image ??
    (avatarSeed
      ? `https://api.dicebear.com/10.x/glass/png?seed=${encodeURIComponent(avatarSeed)}&size=48`
      : undefined);
  return (
    <>
      {src ? (
        <Img
          alt=""
          src={src}
          width="24"
          height="24"
          className="mr-2 inline-block rounded align-middle object-cover"
        />
      ) : logo?.type === "emoji" ? (
        <span className="mr-2 inline-block h-6 w-6 rounded bg-email-light-surface text-center align-middle text-sm leading-6 dark:bg-email-dark-surface">
          {logo.value}
        </span>
      ) : null}
      {name}
    </>
  );
}
