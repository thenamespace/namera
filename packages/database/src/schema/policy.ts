// oxlint-disable no-underscore-dangle

import type { OrganizationMemberRole } from "@namera-ai/schema";

import { sql, type ColumnType } from "drizzle-orm";
import {
  ExtraConfigColumn,
  pgPolicy,
  PgRole,
  type PgColumnBaseConfig,
} from "drizzle-orm/pg-core";

export const and = (policies: string[]) => {
  return policies.join(" AND ");
};

export const or = (policies: string[]) => {
  return policies.join(" OR ");
};

export const onlyUserId = (
  id: ExtraConfigColumn<PgColumnBaseConfig<ColumnType>>,
) => {
  return `auth_current_user_id() = ${id}`;
};

export const onlyOrgMember = (
  orgId: ExtraConfigColumn<PgColumnBaseConfig<ColumnType>>,
) => {
  return `auth_user_has_org_access(${orgId})`;
};

export const onlyIfSeedMember = (
  orgId: ExtraConfigColumn<PgColumnBaseConfig<ColumnType>>,
  userId: ExtraConfigColumn<PgColumnBaseConfig<ColumnType>>,
  role: ExtraConfigColumn<PgColumnBaseConfig<ColumnType>>,
) => {
  return `auth_org_can_seed_owner(${orgId}, ${userId}, ${role})`;
};

export const onlyIfSmartAccountInOrg = (
  smartAccountId: ExtraConfigColumn<PgColumnBaseConfig<ColumnType>>,
  orgId: ExtraConfigColumn<PgColumnBaseConfig<ColumnType>>,
) => {
  return `auth_smart_account_in_org(${smartAccountId}, ${orgId})`;
};

export const onlyOrgMemberWithRoles = (
  orgId: ExtraConfigColumn<PgColumnBaseConfig<ColumnType>>,
  roles: OrganizationMemberRole[],
) => {
  return `auth_user_has_role_in_org(${orgId}, ARRAY[${roles.map((r) => `'${r}'`).join(",")}])`;
};

export class PgPolicyBuilder {
  protected _name!: string;
  protected _as?: "permissive" | "restrictive";
  protected _for?: "all" | "select" | "insert" | "update" | "delete";
  protected _using?: string;
  protected _withCheck?: string;
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

  public using(policy: string) {
    this._using = policy;
    return this;
  }

  public withCheck(policy: string) {
    this._withCheck = policy;
    return this;
  }

  public build() {
    return pgPolicy(this._name, {
      as: this._as,
      for: this._for,
      to: "user",
      using: sql`${this._using}`,
      withCheck: sql`${this._withCheck}`,
    });
  }
}
