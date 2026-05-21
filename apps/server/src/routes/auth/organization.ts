export const a = "hello";

// import { Effect } from "effect";

// import { HttpApiBuilder } from "effect/unstable/httpapi";

// import { api, AuthenticatedUser } from "@namera-ai/api";
// import { AdminDatabase, Transaction } from "@namera-ai/database";
// import { AuthRepo } from "@namera-ai/domain";
// import {
//   CheckOrganizationSlugRequest,
//   type DeleteOrganizationRequest,
//   type GetFullOrganizationRequest,
//   OrganizationError,
//   type CreateOrganizationRequest,
//   type SetActiveOrganizationRequest,
//   type UpdateOrganizationRequest,
// } from "@namera-ai/schema";

// const createOrganizationHandler = (payload: CreateOrganizationRequest) =>
//   Effect.gen(function* () {
//     const currentUser = yield* AuthenticatedUser;
//     const auth = yield* AuthRepo.AuthRepo;

//     const db = yield* AdminDatabase.AdminDatabase;

//     const res = yield* db.transaction((tx) =>
//       Effect.gen(function* () {
//         const orgsCreatedByUser =
//           yield* auth.organization.listOrgsCreatedByUser(currentUser.user.id);

//         if (orgsCreatedByUser.length >= 3) {
//           return yield* new OrganizationError({
//             code: "ORG_LIMIT_REACHED",
//           });
//         }

//         const isSlugTaken = yield* auth.organization.checkSlug(payload.slug);

//         if (isSlugTaken) {
//           return yield* new OrganizationError({
//             code: "SLUG_ALREADY_TAKEN",
//           });
//         }

//         const newOrg = yield* auth.organization.createOrganization({
//           ...payload,
//           plan: "free",
//           createdById: currentUser.user.id,
//         });

//         return newOrg;
//       }).pipe(Transaction.withTx(tx)),
//     );

//     return res;
//   }).pipe(
//     Effect.catchTag("SqlError", () =>
//       Effect.fail(new OrganizationError({ code: "ORGANIZATION_NOT_FOUND" })),
//     ),
//   );

// const checkSlugHandler = ({ slug }: CheckOrganizationSlugRequest) =>
//   Effect.gen(function* () {
//     const db = yield* AdminDatabase.AdminDatabase;
//     const auth = yield* AuthRepo.AuthRepo;

//     const isSlugTaken = yield* db.transaction((tx) =>
//       Effect.gen(function* () {
//         return yield* auth.organization.checkSlug(slug);
//       }).pipe(Transaction.withTx(tx)),
//     );

//     return { isAvailable: !isSlugTaken };
//   });

// const listOrgsHandler = () =>
//   Effect.gen(function* () {
//     const currentUser = yield* AuthenticatedUser;
//     const auth = yield* AuthRepo.AuthRepo;

//     const res = yield* auth.organization.list(currentUser.user.id);

//     return res;
//   });

// const setActiveOrganizationHandler = (payload: SetActiveOrganizationRequest) =>
//   Effect.gen(function* () {
//     const currentUser = yield* AuthenticatedUser;
//     const auth = yield* AuthRepo.AuthRepo;
//     const db = yield* AdminDatabase.AdminDatabase;

//     return yield* db.transaction((tx) =>
//       Effect.gen(function* () {
//         const isMember = yield* auth.organization.hasActiveMembership(
//           currentUser.user.id,
//           payload.id,
//           payload.slug,
//         );

//         if (!isMember) {
//           return yield* new OrganizationError({
//             code: "ORGANIZATION_MEMBER_NOT_FOUND",
//           });
//         }

//         yield* auth.session.setActiveOrganization(
//           currentUser.session.id,
//           currentUser.user.id,
//           payload.id,
//         );
//       }).pipe(Transaction.withTx(tx)),
//     );
//   });

// const getFullOrganizationHandler = (params: GetFullOrganizationRequest) =>
//   Effect.gen(function* () {
//     const currentUser = yield* AuthenticatedUser;
//     const auth = yield* AuthRepo.AuthRepo;
//     const db = yield* AdminDatabase.AdminDatabase;

//     const res = yield* db.transaction((tx) =>
//       Effect.gen(function* () {
//         const org = yield* auth.organization.getFullOrganization(
//           currentUser.user.id,
//           params,
//         );

//         if (!org) {
//           return yield* new OrganizationError({
//             code: "ORGANIZATION_NOT_FOUND",
//           });
//         }

//         return org;
//       }).pipe(Transaction.withTx(tx)),
//     );

//     return res;
//   });

// const updateOrganizationHandler = (payload: UpdateOrganizationRequest) =>
//   Effect.gen(function* () {
//     const currentUser = yield* AuthenticatedUser;
//     const auth = yield* AuthRepo.AuthRepo;
//     const db = yield* AdminDatabase.AdminDatabase;

//     const res = yield* db.transaction((tx) =>
//       Effect.gen(function* () {
//         const org = yield* auth.organization.updateOrganization(
//           currentUser.user.id,
//           payload,
//         );

//         if (!org) {
//           return yield* new OrganizationError({
//             code: "ORGANIZATION_PERMISSION_DENIED",
//           });
//         }

//         return org;
//       }).pipe(Transaction.withTx(tx)),
//     );

//     return res;
//   });

// const deleteOrganizationHandler = (payload: DeleteOrganizationRequest) =>
//   Effect.gen(function* () {
//     const currentUser = yield* AuthenticatedUser;
//     const auth = yield* AuthRepo.AuthRepo;
//     const db = yield* AdminDatabase.AdminDatabase;

//     return yield* db.transaction((tx) =>
//       Effect.gen(function* () {
//         const deleted = yield* auth.organization.deleteOrganization(
//           currentUser.user.id,
//           payload.id,
//         );

//         if (!deleted) {
//           return yield* new OrganizationError({
//             code: "ORGANIZATION_PERMISSION_DENIED",
//           });
//         }
//       }).pipe(Transaction.withTx(tx)),
//     );
//   });

// export const OrganizationGroupLive = HttpApiBuilder.group(
//   api,
//   "organization",
//   (handlers) =>
//     handlers
//       .handle("create", ({ payload }) => createOrganizationHandler(payload))
//       .handle("checkSlug", ({ payload }) => checkSlugHandler(payload))
//       .handle("list", () => listOrgsHandler())
//       .handle("setActive", ({ payload }) =>
//         setActiveOrganizationHandler(payload),
//       )
//       .handle("getFullOrganization", ({ params }) =>
//         getFullOrganizationHandler(params),
//       )
//       .handle("update", ({ payload }) => updateOrganizationHandler(payload))
//       .handle("delete", ({ payload }) => deleteOrganizationHandler(payload)),
// );
