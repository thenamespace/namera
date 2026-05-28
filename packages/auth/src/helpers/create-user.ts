import type { Email } from "@namera-ai/schema";

import { DateTime, Effect } from "effect";

import * as AuthRepo from "@namera-ai/domain/auth";
import * as CoreRepo from "@namera-ai/domain/core";

type CreateNewUserProps = {
  email: Email;
  name?: string;
  emailVerified: boolean;
  image?: string;
};

export const createNewUser = Effect.fn("createNewUser")(function* ({
  email,
  name = "User",
  emailVerified,
  image,
}: CreateNewUserProps) {
  const authRepo = yield* AuthRepo.AuthRepo;
  const coreRepo = yield* CoreRepo.CoreRepo;

  const user = yield* authRepo.user.createUser({
    email,
    emailVerified,
    metadata: {
      name,
      image,
    },
    lastLoginAt: yield* DateTime.now,
  });

  // Create User preferences table.
  yield* coreRepo.userPreference.create({
    userId: user.id,
    notificationPreferences: {},
    metadata: {},
  });

  return user;
});
