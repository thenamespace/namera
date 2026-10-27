ALTER TABLE "core"."address_catalog_entry" DROP CONSTRAINT "address_catalog_entry_chain_check", ADD CONSTRAINT "address_catalog_entry_chain_check" CHECK ("chain_id" IN (
    'eip155:1', 'eip155:10', 'eip155:5042', 'eip155:5042002', 'eip155:8453', 'eip155:42161',
    'eip155:84532', 'eip155:421614', 'eip155:11155111', 'eip155:11155420'
  ));