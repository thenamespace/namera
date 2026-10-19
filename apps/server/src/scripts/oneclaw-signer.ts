import { NodeCrypto, NodeRuntime } from "@effect/platform-node";
import { Effect, Layer, Schema } from "effect";

import { Audit, makeMaintainOneClawSigner } from "@namera-ai/application";
import { CryptoService } from "@namera-ai/crypto";
import { Database, Repository, TransactionService } from "@namera-ai/database";
import { OrganizationId, SigningKeyId } from "@namera-ai/protocol";

import { OneClawLive } from "../layers/services.js";

const persistence = Layer.mergeAll(Repository.layer, TransactionService.layer).pipe(
  Layer.provide(Database.layer),
);
const dependencies = Layer.mergeAll(
  persistence,
  CryptoService.layer.pipe(Layer.provide(NodeCrypto.layer)),
  OneClawLive,
);
const live = Layer.merge(dependencies, Audit.layer.pipe(Layer.provide(dependencies)));

NodeRuntime.runMain(
  Effect.gen(function* () {
    const [organizationId, signingKeyId, mode, ...extra] = process.argv.slice(2);
    if (
      !organizationId ||
      !signingKeyId ||
      (mode !== undefined && mode !== "--apply") ||
      extra.length
    )
      return yield* Effect.die(
        "Usage: oneclaw:signer <organization-id> <signing-key-id> [--apply]",
      );
    const maintain = yield* makeMaintainOneClawSigner;
    const result = yield* maintain({
      organizationId: yield* Schema.decodeUnknownEffect(OrganizationId)(organizationId),
      signingKeyId: yield* Schema.decodeUnknownEffect(SigningKeyId)(signingKeyId),
      apply: mode === "--apply",
    });
    yield* Effect.logInfo("oneclaw.signer.check", result);
  }).pipe(Effect.provide(live)),
);
