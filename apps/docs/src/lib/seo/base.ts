import { faqs } from "@/sections";
import appCss from "@/styles/globals.css?url";

import { env } from "../env";
import { baseOgImage, nameraIcon } from "./common";

export const getBaseSeo = () => {
  const canonicalUrl = new URL("/", env.baseUrl);

  const title = "Namera - Smart Wallets for Autonomous Agents";
  const description =
    "Namera is a programmable wallet platform for autonomous agents. Create smart wallets, define permissions, issue session keys, and let agents execute transactions securely onchain.";
  const keywords = [
    "programmable wallets",
    "agent wallets",
    "session keys",
    "wallet permissions",
    "autonomous agents",
    "smart account wallets",
    "wallet automation",
    "onchain automation",
    "agent infrastructure",
    "agent wallet sdk",
    "delegated wallet access",
    "smart contract wallets",
  ].join(", ");

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@id": new URL("#org", env.baseUrl).toString(),
        "@type": "Organization",
        logo: nameraIcon,
        name: "Namera",
        sameAs: [
          "https://x.com/namera_ai",
          "https://linkedin.com/company/namera-ai",
          "https://github.com/thenamespace/namera",
        ],
        url: env.baseUrl.toString(),
      },
      {
        "@id": new URL("#website", env.baseUrl).toString(),
        "@type": "WebSite",
        name: "Namera",
        publisher: {
          "@id": new URL("#org", env.baseUrl).toString(),
        },
        url: env.baseUrl.toString(),
      },
      {
        "@id": new URL("#webpage", env.baseUrl).toString(),
        "@type": "WebPage",
        about: {
          "@id": new URL("#product", env.baseUrl).toString(),
        },
        isPartOf: {
          "@id": new URL("#website", env.baseUrl).toString(),
        },
        name: title,
        url: env.baseUrl.toString(),
      },
      {
        "@id": new URL("#app", env.baseUrl).toString(),
        "@type": "SoftwareApplication",
        applicationCategory: "DeveloperApplication",
        name: "Namera",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        operatingSystem: "Web",
      },
      {
        "@id": new URL("#product", env.baseUrl).toString(),
        "@type": "Product",
        brand: {
          "@id": new URL("#org", env.baseUrl).toString(),
          "@type": "Organization",
          name: "Namera",
        },
        category: "Developer Tools",
        description,
        image: baseOgImage,
        name: "Namera Smart Accounts SDK",
        offers: {
          "@type": "Offer",
          availability: "https://schema.org/InStock",
          price: "0",
          priceCurrency: "USD",
          url: env.baseUrl.toString(),
        },
      },

      {
        "@id": new URL("#faq", env.baseUrl).toString(),
        "@type": "FAQPage",
        mainEntity: faqs.map((faq) => ({
          "@type": "Question",
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
          name: faq.question,
        })),
      },
    ],
  };

  return {
    links: [
      { href: appCss, rel: "stylesheet" },
      { href: canonicalUrl.toString(), rel: "canonical" },
      { href: nameraIcon, rel: "icon" },
    ],
    meta: [
      // Base Tags
      { charSet: "utf-8" },
      { content: "width=device-width, initial-scale=1", name: "viewport" },
      { content: "#08090a", name: "theme-color" },
      { content: "Namera", name: "author" },
      { content: "Namera", name: "publisher" },
      { title },
      { content: description, name: "description" },
      { content: "index, follow", name: "robots" },
      { content: keywords, name: "keywords" },
      // Open Graph
      { content: "website", property: "og:type" },
      { content: title, property: "og:title" },
      { content: description, property: "og:description" },
      { content: "website", property: "og:type" },
      { content: env.baseUrl.toString(), property: "og:url" },
      { content: baseOgImage, property: "og:image" },
      { content: "Namera", property: "og:site_name" },
      { content: "en_US", property: "og:locale" },
      { content: "Namera Smart Wallets", property: "og:image:alt" },
      // Twitter Tags
      { content: "summary_large_image", name: "twitter:card" },
      { content: title, name: "twitter:title" },
      { content: description, name: "twitter:description" },
      { content: baseOgImage, name: "twitter:image" },
      { content: "@namera_ai", name: "twitter:creator" },
    ],
    scripts: [
      {
        children: JSON.stringify(jsonLd),
        type: "application/ld+json",
      },
    ],
  };
};
