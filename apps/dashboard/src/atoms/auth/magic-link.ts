import { NameraClient } from "@/atoms/client";

export const requestMagicLinkMutation = NameraClient.mutation("magicLink", "request");

export const verifyMagicLinkMutation = NameraClient.mutation("magicLink", "verify");
