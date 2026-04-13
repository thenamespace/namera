import { Schema } from "effect";

import { humanizeRelativeTime } from "@/lib/helpers/date";

export const BlogOgParams = Schema.Struct({
  description: Schema.String,
  lastUpdatedDate: Schema.String,
  paths: Schema.String,
  readTime: Schema.String,
  title: Schema.String,
  type: Schema.Literal("blog"),
});

export type BlogOgParams = typeof BlogOgParams.Type;

export const BlogOgImageResponse = (
  params: BlogOgParams & {
    baseUrl: string;
  },
) => {
  const url = new URL(params.baseUrl);

  // const spotLightUrl = new URL("/assets/spotlight.jpg", url);

  const relativeTime = humanizeRelativeTime(new Date(params.lastUpdatedDate));

  const paths = params.paths.split(",");

  return (
    <div tw="bg-[#0B0C14] h-full w-full flex items-center">
      {/* <img
        alt="spotlight"
        src={spotLightUrl.toString()}
        tw="absolute top-0 left-0 h-full w-full object-cover"
      /> */}
      <div tw="absolute bottom-8 right-12 flex flex-row items-center gap-2">
        <svg
          fill="#C9D3EE"
          height="20"
          viewBox="0 0 180 149"
          width="18"
          xmlns="http://www.w3.org/2000/svg"
        >
          <title>Namera</title>
          <path d="M52.9445 21.4688H0V42.6488H52.9445V21.4688Z" />
          <path d="M137.233 63.5289H158.413V0H52.5352V21.18H105.468V42.3489H52.5352V63.5289H105.468V84.709H52.5352V105.878H105.468V127.058H52.5352V148.238H158.413V84.709H137.233V63.5289Z" />
          <path d="M52.9445 63.8218H0V85.0018H52.9445V63.8218Z" />
          <path d="M52.9445 106.164H0V127.344H52.9445V106.164Z" />
          <path d="M180 63.8218H158.82V85.0018H180V63.8218Z" />
        </svg>
        <div tw="text-[#C9D3EE] text-lg">Namera</div>
      </div>
      <div tw="bg-[#707fdb] w-3 h-full" />
      <div tw="w-[90dvw] flex flex-col gap-8 h-[60dvh] mx-auto">
        <div tw="flex flex-row gap-2">
          {paths.map((path) => {
            const isLast = paths.indexOf(path) === paths.length - 1;
            return (
              <>
                <div key={path} tw="text-2xl text-[#707fdb]">
                  {path}
                </div>
                {!isLast && <div tw="text-2xl text-[#707fdb]">/</div>}
              </>
            );
          })}
        </div>
        <div tw="text-[5rem] text-white font-[HelveticaDisplay]">
          {params.title}
        </div>
        <div tw="flex flex-row gap-2 text-[#C9D3EE] text-xl items-center">
          <div>{params.readTime} minute read</div>
          <div tw="size-1.5 rounded-full bg-[#C9D3EE]" />
          <div>Updated {relativeTime}</div>
        </div>
        <div tw="text-xl text-[#9D9FAF] max-w-[80dvw] text-wrap">
          {params.description}
        </div>
      </div>
    </div>
  );
};
