export const Hero = () => {
  return (
    <section className="pt-[20dvh]">
      <div className="max-w-7xl mx-auto flex flex-col gap-4 px-4">
        <div className="flex flex-col gap-6  text-center sm:text-left">
          <h1 className="text-4xl leading-none sm:text-5xl md:text-6xl lg:text-7xl md:leading-[0.9]">
            Programmable wallets
            <br />
            for autonomous agents
          </h1>
          <p className="text-muted-foreground font-light text-sm md:text-base">
            Define fine-grained permissions with session keys and let agents
            execute transactions on your behalf.
          </p>
        </div>
        <div className="relative">
          <video
            autoPlay={true}
            className="w-full rounded-2xl my-4"
            controls={false}
            disablePictureInPicture={true}
            loop={true}
            muted={true}
            poster="https://6iw07yybtp.ufs.sh/f/9tvkThgRlUcK8urJOvLOaQlLduTRAgwbGEzMkpcHBZnDfY9P"
            src="https://6iw07yybtp.ufs.sh/f/9tvkThgRlUcKlPJKvydv8A6jcXM3ehpNnSUiG7f0Vs2glHFW"
          />
        </div>
      </div>
    </section>
  );
};
