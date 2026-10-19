import {
  ArrowRight01Icon,
  BotIcon,
  CheckmarkCircle02Icon,
  HugeiconsIcon,
  Key01Icon,
  NameraIcon,
  Shield01Icon,
  Tick02Icon,
  Wallet01Icon,
} from "@namera-ai/ui/icons";
import { motion, useReducedMotion } from "motion/react";

const captions = [
  {
    title: "Your account. Your control.",
    description: "One smart account, with permissions built in.",
  },
  {
    title: "A key with clear boundaries.",
    description: "Give your agent permission, without giving it everything.",
  },
  {
    title: "Your AI client, connected.",
    description: "Connect your AI client to your Namera account.",
  },
  {
    title: "From setup to something real.",
    description: "Every action follows the permissions you choose.",
  },
] as const;

const enter = { opacity: 0, y: 12, scale: 0.98 };
const visible = { opacity: 1, y: 0, scale: 1 };
const transition = { duration: 0.3, ease: "easeOut" } as const;
const reducedTransition = { duration: 0 };
const completeIcons = [
  { id: "wallet", icon: Wallet01Icon },
  { id: "session", icon: Key01Icon },
  { id: "connection", icon: BotIcon },
  { id: "action", icon: CheckmarkCircle02Icon },
];

export function StepIllustration({ step, finished }: { step: number; finished: boolean }) {
  const reducedMotion = useReducedMotion();
  const caption = captions[step] ?? captions[0];

  return (
    <figure className="setup-illustration" data-scene={finished ? "complete" : step}>
      <div className="setup-artwork" aria-hidden="true">
        <svg className="setup-grain" width="100%" height="100%">
          <filter id="setup-paper-grain">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.72"
              numOctaves="3"
              stitchTiles="stitch"
            />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#setup-paper-grain)" opacity="0.2" />
        </svg>
        <div className="setup-orbit setup-orbit-outer" />
        <div className="setup-orbit setup-orbit-inner" />
        <motion.div
          key={finished ? "complete" : step}
          className="setup-scene"
          initial={reducedMotion ? false : enter}
          animate={visible}
          transition={reducedMotion ? reducedTransition : transition}
        >
          {finished ? (
            <CompleteScene />
          ) : step === 0 ? (
            <WalletScene />
          ) : step === 1 ? (
            <PermissionsScene />
          ) : step === 2 ? (
            <ConnectionScene />
          ) : (
            <ActivityScene />
          )}
        </motion.div>
        <div className="setup-artwork-note">
          <span className="setup-status-dot" />
          {finished ? "Ready for what’s next" : "Built for agents. Controlled by you."}
        </div>
      </div>
      <figcaption className="px-2 pt-5 text-center">
        <p className="text-sm font-medium">{finished ? "You’re ready to build." : caption.title}</p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">
          {finished
            ? "Keep your ideas moving. Your boundaries stay in place."
            : caption.description}
        </p>
      </figcaption>
    </figure>
  );
}

function WalletScene() {
  return (
    <div className="setup-wallet-stack">
      <div className="setup-wallet-shadow-card setup-wallet-shadow-card-back" />
      <div className="setup-wallet-shadow-card setup-wallet-shadow-card-middle" />
      <div className="setup-product-card setup-wallet-card">
        <div className="setup-card-heading">
          <span className="setup-icon-tile">
            <HugeiconsIcon icon={Wallet01Icon} size={21} />
          </span>
          <NameraIcon className="h-5 w-6 fill-current text-muted" />
        </div>
        <p className="setup-small-label">Smart account</p>
        <p className="setup-card-title">My agent account</p>
        <div className="setup-address">
          0x71C…9A42 <span className="setup-address-dots">•••</span>
        </div>
        <div className="setup-wallet-footer">
          <span>
            <span className="setup-status-dot" />
            You’re in control
          </span>
          <HugeiconsIcon icon={Shield01Icon} size={17} />
        </div>
      </div>
      <div className="setup-floating-pill">
        <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} /> A home for your agent’s funds
      </div>
    </div>
  );
}

function PermissionsScene() {
  return (
    <div className="setup-permissions-stack">
      <div className="setup-key-seal">
        <HugeiconsIcon icon={Key01Icon} size={36} />
      </div>
      <div className="setup-product-card setup-permissions-card">
        <div className="setup-card-heading">
          <span className="setup-card-title setup-card-title-small">Agent permissions</span>
          <HugeiconsIcon icon={Shield01Icon} size={20} className="text-muted" />
        </div>
        <div className="setup-policy-row">
          <span>Network</span>
          <strong>Chosen by you</strong>
        </div>
        <div className="setup-policy-row">
          <span>Spending limit</span>
          <strong>You set the limit</strong>
        </div>
        <div className="setup-policy-row">
          <span>Allowed actions</span>
          <strong>Only what you approve</strong>
        </div>
        <div className="setup-permission-footer">
          <HugeiconsIcon icon={Tick02Icon} size={16} /> Scoped access, built in
        </div>
      </div>
    </div>
  );
}

function ConnectionScene() {
  return (
    <div className="setup-connections">
      <div className="setup-connection-hub">
        <NameraIcon className="h-9 w-11 fill-current" />
      </div>
      <div className="setup-connection-lines">
        <span className="setup-connection-label">MCP</span>
      </div>
      <div className="setup-connection-clients">
        <div className="setup-client-tile">
          <HugeiconsIcon icon={BotIcon} size={28} />
          <span>Your AI client</span>
        </div>
      </div>
      <div className="setup-product-card setup-request-card">
        <span className="setup-status-dot" />
        <span>List my accounts</span>
        <HugeiconsIcon icon={ArrowRight01Icon} size={16} />
      </div>
    </div>
  );
}

function ActivityScene() {
  return (
    <div className="setup-activity-stack">
      <div className="setup-signature-mark">Signed.</div>
      <div className="setup-product-card setup-activity-card">
        <div className="setup-card-heading">
          <span className="setup-icon-tile">
            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={23} />
          </span>
          <span className="setup-example-badge">Example</span>
        </div>
        <p className="setup-card-title">Your first agent action</p>
        <p className="mt-2 text-sm text-muted">One idea, put into motion.</p>
        <div className="setup-policy-row mt-6">
          <span>Permissions</span>
          <strong>
            Respected <HugeiconsIcon icon={Tick02Icon} size={14} />
          </strong>
        </div>
        <div className="setup-policy-row">
          <span>Activity</span>
          <strong>
            Recorded <HugeiconsIcon icon={Tick02Icon} size={14} />
          </strong>
        </div>
      </div>
    </div>
  );
}

function CompleteScene() {
  return (
    <div className="setup-complete-scene">
      <div className="setup-complete-seal">
        <HugeiconsIcon icon={Tick02Icon} size={50} strokeWidth={1.5} />
      </div>
      <div className="setup-product-card setup-complete-card">
        <p className="setup-card-title">Ready when you are.</p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          An account. Clear permissions.
          <br />
          An agent connected. A first action done.
        </p>
        <div className="setup-complete-marks">
          {completeIcons.map(({ id, icon }) => (
            <span key={id}>
              <HugeiconsIcon icon={icon} size={18} />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
