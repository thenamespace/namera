import type { Email } from "@namera-ai/schema";

import { DateTime, Effect } from "effect";

import * as AuthRepo from "@namera-ai/domain/auth";
import * as CoreRepo from "@namera-ai/domain/core";

export const createNewUser = ({
  email,
  name = "User",
  emailVerified,
  image,
}: {
  email: Email;
  name?: string;
  emailVerified: boolean;
  image?: string;
}) =>
  Effect.gen(function* () {
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
