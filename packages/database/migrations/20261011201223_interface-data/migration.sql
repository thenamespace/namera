ALTER TABLE "core"."contract_interface" ADD COLUMN "data" jsonb;--> statement-breakpoint
UPDATE "core"."contract_interface" SET "data" = '{"version":1,"type":"evm-abi","name":"EVM ABI"}'::jsonb;--> statement-breakpoint
ALTER TABLE "core"."contract_interface" ALTER COLUMN "data" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "core"."contract_interface" ADD CONSTRAINT "contract_interface_data_check" CHECK (jsonb_typeof("data") = 'object' and ("data"->>'version') is not distinct from '1' and ("data"->>'type') is not distinct from "format" and jsonb_typeof("data"->'name') is not distinct from 'string' and length("data"->>'name') between 1 and 128 and ("data"->>'name') ~ '\S');
