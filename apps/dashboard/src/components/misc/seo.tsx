import { Head } from "@unhead/react";

type OgImage = {
  url: string;
  alt: string;
  width: number;
  height: number;
};

type OpenGraphMeta = {
  title?: string;
  description?: string;
  url?: string;
  siteName?: string;
  images?: OgImage[];
  locale?: string;
  type?: string;
};

type TwitterMeta = {
  title?: string;
  description?: string;
  image?: OgImage;
  url?: string;
  site?: string;
  card?: "summary_large_image" | "summary" | "app" | "player";
};

type IconType =
  | URL
  | {
      url: URL | string;
      media?: string;
      sizes?: string;
      type?: string;
      rel?: string;
    };

type IconsMeta = {
  icon?: IconType[];
  shortcut?: IconType;
  apple?: IconType[];
  other?: IconType[];
};

type SeoOptions = {
  title: string;
  description?: string;
  keywords?: string[];
  authors?: { name: string; url?: string }[];
  creator?: string;
  publisher?: string;
  openGraph?: OpenGraphMeta;
  twitter?: TwitterMeta;
  icons?: IconsMeta;
};

const getIconHref = (icon: IconType) => {
  if (icon instanceof URL) return icon.toString();
  if (icon.url instanceof URL) return icon.url.toString();
  return icon.url;
};

export const Seo = (props: SeoOptions) => {
  const authors = (props.authors ?? [])?.map((author) => {
    return <link rel="author" key={author.name} href={author.url} />;
  });

  const OpenGraph = () => {
    return (
      <>
        {props.openGraph?.title && (
          <meta property="og:title" content={props.openGraph.title} />
        )}
        {props.openGraph?.description && (
          <meta
            property="og:description"
            content={props.openGraph.description}
          />
        )}
        {props.openGraph?.url && (
          <meta property="og:url" content={props.openGraph.url} />
        )}
        {props.openGraph?.siteName && (
          <meta property="og:site_name" content={props.openGraph.siteName} />
        )}
        {props.openGraph?.images?.map((image) => {
          return (
            <>
              <meta property="og:image" content={image.url} />
              <meta property="og:image:alt" content={image.alt} />
              <meta
                property="og:image:width"
                content={image.width.toString()}
              />
              <meta
                property="og:image:height"
                content={image.height.toString()}
              />
            </>
          );
        })}
        {props.openGraph?.locale && (
          <meta property="og:locale" content={props.openGraph.locale} />
        )}
        {props.openGraph?.type && (
          <meta property="og:type" content={props.openGraph.type} />
        )}
      </>
    );
  };

  const TwitterMeta = () => {
    return (
      <>
        {props.twitter?.title && (
          <meta name="twitter:title" content={props.twitter.title} />
        )}
        {props.twitter?.description && (
          <meta
            name="twitter:description"
            content={props.twitter.description}
          />
        )}
        {props.twitter?.image && (
          <meta name="twitter:image" content={props.twitter.image.url} />
        )}
        {props.twitter?.url && (
          <meta name="twitter:url" content={props.twitter.url} />
        )}
        {props.twitter?.site && (
          <meta name="twitter:site" content={props.twitter.site} />
        )}
        {props.twitter?.card && (
          <meta name="twitter:card" content={props.twitter.card} />
        )}
      </>
    );
  };

  const Icons = () => {
    const icons = (props.icons?.icon ?? [])?.map((v) => {
      if (v instanceof URL) return <link rel="icon" href={v.toString()} />;
      return (
        <link
          rel="icon"
          href={getIconHref(v)}
          {...(v && { media: v.media })}
          {...(v && { sizes: v.sizes })}
          {...(v && { type: v.type })}
        />
      );
    });

    const appleIcons = (props.icons?.apple ?? [])?.map((v) => {
      if (v instanceof URL) {
        return <link rel="apple-touch-icon" href={v.toString()} />;
      }
      return (
        <link
          rel="apple-touch-icon"
          href={getIconHref(v)}
          {...(v && { media: v.media })}
          {...(v && { sizes: v.sizes })}
          {...(v && { type: v.type })}
        />
      );
    });

    return <>{...icons}
      {props.icons?.shortcut && (
        <link rel="shortcut icon" href={getIconHref(props.icons.shortcut)} />
      )}
      {...appleIcons}</>;
  };

  return (
    <Head>
      <title>{props.title}</title>
      {props.description && (
        <meta name="description" content={props.description} />
      )}
      {props.keywords && (
        <meta name="keywords" content={props.keywords.join(",")} />
      )}
      <Icons />
      {...authors}
      {props.creator && <meta name="creator" content={props.creator} />}
      {props.publisher && <meta name="publisher" content={props.publisher} />}
      <OpenGraph />
      <TwitterMeta />
    </Head>
  );
};
