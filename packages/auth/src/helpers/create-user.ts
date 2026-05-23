import type { Email } from "@namera-ai/schema";

import { Effect } from "effect";

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
  image: string | null;
}) =>
  Effect.gen(function* () {
    const authRepo = yield* AuthRepo.AuthRepo;
    const coreRepo = yield* CoreRepo.CoreRepo;

    const user = yield* authRepo.user.createUser({
      email,
      emailVerified,
      name,
      image,
      lastLoginAt: new Date(),
      metadata: {},
    });

    // Create User preferences table.
    yield* coreRepo.userPreference.create({
      userId: user.id,
      notificationPreferences: {},
      metadata: {},
    });

    // TODO: Create a new org for user....

    return user;
  });
