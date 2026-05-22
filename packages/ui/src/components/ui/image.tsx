import { type ImageProps, Image as UnPicImage } from "@unpic/react";

import { cn } from "@namera-ai/ui/lib/utils";

type ImageWithFallbackProps = ImageProps & {
  defaultImage?: string;
};

export const Image = ({
  defaultImage = "https://api.dicebear.com/9.x/glass/svg?seed=Jude",
  src,
  className,
  ...props
}: ImageWithFallbackProps) => {
  return (
    <div className={cn(className, "relative")}>
      <UnPicImage
        className={cn("w-full object-cover", className)}
        layout="fullWidth"
        src={defaultImage}
      />
      <UnPicImage
        className={cn("absolute top-0 w-full object-cover", className)}
        onError={(e) => {
          // oxlint-disable-next-line unicorn/prefer-add-event-listener
          e.currentTarget.onerror = null;
          e.currentTarget.src = defaultImage;
        }}
        src={src && src !== "" ? src : defaultImage}
        {...props}
      />
    </div>
  );
};
