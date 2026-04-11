import { SignOutIcon } from "@phosphor-icons/react/dist/ssr";
import { ConnectButton as ConnectButtonCore } from "@rainbow-me/rainbowkit";
import Avvvatars from "avvvatars-react";
import { useDisconnect } from "wagmi";

import { Button } from "@namera-ai/ui/components/ui/button";
export const ConnectButton = () => {
  const { mutateAsync: disconnect } = useDisconnect();
  return (
    <ConnectButtonCore.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        // Note: If your app doesn't use authentication, you
        // can remove all 'authenticationStatus' checks
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus || authenticationStatus === "authenticated");

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
              },
            })}
          >
            {(() => {
              if (!connected) {
                return (
                  <Button onClick={openConnectModal} type="button">
                    Connect Wallet
                  </Button>
                );
              }
              if (chain.unsupported) {
                return (
                  <Button onClick={openChainModal} type="button">
                    Wrong network
                  </Button>
                );
              }
              return (
                <div className="flex flex-row gap-1">
                  <Button
                    onClick={openAccountModal}
                    type="button"
                    variant="secondary"
                  >
                    {account.ensAvatar ? (
                      <img
                        src={account.ensAvatar}
                        alt="ENS Avatar"
                        className="size-5 rounded-full"
                      />
                    ) : (
                      <Avvvatars
                        value={account.address}
                        style="shape"
                        size={20}
                      />
                    )}

                    {account.displayName}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={async () => await disconnect()}
                  >
                    <SignOutIcon />
                  </Button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButtonCore.Custom>
  );
};
