ALTER TABLE "notification"."notification_preferences" ADD COLUMN "topic" text;--> statement-breakpoint
DELETE FROM "notification"."notification_preferences" WHERE "channel" <> 'email' OR "category" = 'wallet';--> statement-breakpoint
UPDATE "notification"."notification_preferences"
SET
	"topic" = CASE "category"
		WHEN 'security' THEN 'activity'
		WHEN 'organization' THEN 'invitations'
		WHEN 'product' THEN 'announcements'
		WHEN 'billing' THEN 'activity'
		ELSE 'activity'
	END,
	"category" = CASE "category"
		WHEN 'security' THEN 'account'
		ELSE "category"
	END;--> statement-breakpoint
ALTER TABLE "notification"."notification_preferences" ALTER COLUMN "topic" SET NOT NULL;--> statement-breakpoint
DROP INDEX "notification"."notification_preferences_global_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_global_uidx" ON "notification"."notification_preferences" ("user_id","category","topic","channel") WHERE "organization_id" IS NULL;--> statement-breakpoint
DROP INDEX "notification"."notification_preferences_organization_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preferences_organization_uidx" ON "notification"."notification_preferences" ("user_id","organization_id","category","topic","channel") WHERE "organization_id" IS NOT NULL;
