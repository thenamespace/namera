import { useId, type SVGProps } from "react";

export const AlchemyIcon = (props: SVGProps<SVGSVGElement>) => {
  const gradientId = useId();

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      fill="none"
      viewBox="0 0 32 32"
      {...props}
    >
      <rect width="32" height="32" rx="16" fill="white" />
      <path
        d="M22.6385 16.8031 16.3097 6.174a.356.356 0 0 0-.6132-.0038l-1.8955 3.1849a.67.67 0 0 0 0 .6858l4.1269 6.9341a.714.714 0 0 0 .6132.3429h3.7908a.356.356 0 0 0 .3066-.5148ZM6.0488 22.3582l6.3289-10.6291a.356.356 0 0 1 .6122 0l1.8964 3.1821a.67.67 0 0 1 0 .6867l-4.1269 6.9341a.712.712 0 0 1-.612.3429H6.3554a.356.356 0 0 1-.3066-.5167ZM12.989 22.8728h12.6577a.356.356 0 0 0 .3057-.5149l-1.8935-3.1839a.714.714 0 0 0-.6132-.3429H15.192a.714.714 0 0 0-.6132.3429l-1.8954 3.1839a.356.356 0 0 0 .3056.5149Z"
        fill={`url(#${gradientId})`}
      />
      <defs>
        <linearGradient
          id={gradientId}
          x1="16"
          x2="14.277"
          y1="7.254"
          y2="22.881"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#05D5FF" />
          <stop offset=".724" stopColor="#363FF9" />
          <stop offset="1" stopColor="#5533FF" />
        </linearGradient>
      </defs>
    </svg>
  );
};
