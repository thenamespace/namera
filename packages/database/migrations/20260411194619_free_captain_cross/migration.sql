ALTER TABLE "smart_account" ADD COLUMN "metadata" json NOT NULL;--> statement-breakpoint
ALTER TABLE "smart_account" DROP COLUMN "name";