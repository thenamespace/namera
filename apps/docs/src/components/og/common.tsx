/** biome-ignore-all assist/source/useSortedKeys: safe */

import { NameraIcon } from "@namera-ai/ui/icons";
import { Schema } from "effect";

import { humanizeRelativeTime } from "@/lib/helpers/date";

export const CommonOgParams = Schema.Struct({
  title: Schema.String,
  description: Schema.optional(Schema.String),
  paths: Schema.optional(Schema.String),
  lastUpdatedDate: Schema.String,
  readTime: Schema.optional(Schema.String),
});

export type CommonOgParams = typeof CommonOgParams.Type;

const ogImageBg =
  "https://6iw07yybtp.ufs.sh/f/9tvkThgRlUcKeMlXh9Izng8Coj7G45pUQwqiTVaF9ZxB3uHL";

export const CommonOgImageResponse = (params: CommonOgParams) => {
  const relativeTime = humanizeRelativeTime(new Date(params.lastUpdatedDate));

  return (
    <div>
      <img
        alt="OG Background"
        src={ogImageBg}
        tw="h-full w-full object-cover"
      />
      <div tw="absolute w-full h-full text-white top-0 z-10 px-18 py-28 flex flex-col justify-between">
        <div tw="flex flex-row gap-2 items-center">
          <NameraIcon fill="#fff" tw="w-8 h-6" />
          <div tw="font-medium text-[2rem]">Namera</div>
        </div>
        <div tw="flex flex-col gap-6">
          {params.paths && (
            <div tw="text-[#6a75e2] text-xl font-medium">
              {params.paths.split(",").join(" / ")}
            </div>
          )}
          <div tw="text-5xl font-medium">{params.title}</div>
          <div tw="text-xl font-medium text-[#97989a]">
            {params.description}
          </div>
          <div tw="flex flex-row gap-2 text-white text-base items-center">
            <div>{params.readTime} minute read</div>
            <div tw="size-1.5 rounded-full bg-white" />
            <div>Updated {relativeTime}</div>
          </div>
        </div>
      </div>
    </div>
  );
};
