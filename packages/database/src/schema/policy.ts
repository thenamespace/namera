// oxlint-disable no-underscore-dangle

import type { Permission } from "@namera-ai/schema";

import { type ColumnType, sql, type SQL } from "drizzle-orm";
import {
  ExtraConfigColumn,
  pgPolicy,
  PgRole,
  type PgColumnBaseConfig,
} from "drizzle-orm/pg-core";

type PolicyColumn = ExtraConfigColumn<PgColumnBaseConfig<ColumnType>>;

export const and = (policies: SQL[]) =>
  sql.join(
    policies.map((p) => sql`(${p})`),
    sql` AND `,
  );

export const or = (policies: SQL[]) =>
  sql.join(
    policies.map((p) => sql`(${p})`),
    sql` OR `,
  );

export const onlyUserId = (id: PolicyColumn) =>
  sql`auth_current_user_id() = ${id}`;

export const onlyOrgMember = (orgId: PolicyColumn) =>
  sql`auth_user_has_org_access(${orgId})`;

export const onlyOrgMemberWithPermissions = (
  orgId: PolicyColumn,
  permissions: Permission[],
) => {
  const permissionList = permissions
    .map((permission) => `'${permission.replaceAll("'", "''")}'`)
    .join(", ");

  return sql`auth_user_has_permissions_in_org(${orgId}, ARRAY[${sql.raw(permissionList)}]::text[])`;
};

export const onlyIfSmartAccountInOrg = (
  smartAccountId: PolicyColumn,
  orgId: PolicyColumn,
) => sql`auth_smart_account_in_org(${smartAccountId}, ${orgId})`;

export const onlyIfSessionKeyInOrg = (
  sessionKeyId: PolicyColumn,
  orgId: PolicyColumn,
) => sql`auth_session_key_in_org(${sessionKeyId}, ${orgId})`;

export class PgPolicyBuilder {
  protected _name!: string;
  protected _as?: "permissive" | "restrictive";
  protected _for?: "all" | "select" | "insert" | "update" | "delete";
  protected _using?: SQL;
  protected _withCheck?: SQL;
  protected _to?: PgRole;

  public name(name: string) {
    this._name = name;
    return this;
  }

  public as(as: "permissive" | "restrictive") {
    this._as = as;
    return this;
  }

  public forOperation(
    operation: "all" | "select" | "insert" | "update" | "delete",
  ) {
    this._for = operation;
    return this;
  }

  public to(role: PgRole) {
    this._to = role;
    return this;
  }

  public using(policy: SQL) {
    this._using = policy;
    return this;
  }

  public withCheck(policy: SQL) {
    this._withCheck = policy;
    return this;
  }

  public build() {
    return pgPolicy(this._name, {
      as: this._as,
      for: this._for,
      to: this._to,
      using: this._using,
      withCheck: this._withCheck,
    });
  }
}
