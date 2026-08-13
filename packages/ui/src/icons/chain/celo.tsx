import type { SVGProps } from "react";
export const ChainCeloIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="1em"
    height="1em"
    fill="none"
    viewBox="0 0 32 32"
    {...props}
  >
    <g clipPath="url(#celo_svg__a)">
      <path
        fill="#FCFF52"
        d="M16 32c8.837 0 16-7.163 16-16S24.837 0 16 0 0 7.163 0 16s7.163 16 16 16"
      />
      <path
        fill="#2C2D30"
        fillRule="evenodd"
        d="M24.951 6.991H7.05V25.01h17.903v-6.29h-2.97c-1.024 2.295-3.33 3.893-5.968 3.893-3.636 0-6.582-2.99-6.582-6.624 0-3.636 2.946-6.6 6.582-6.6 2.69 0 4.995 1.65 6.019 3.995h2.92V6.99z"
        clipRule="evenodd"
      />
    </g>
    <defs>
      <clipPath id="celo_svg__a">
        <path fill="#fff" d="M0 0h32v32H0z" />
      </clipPath>
    </defs>
  </svg>
);
