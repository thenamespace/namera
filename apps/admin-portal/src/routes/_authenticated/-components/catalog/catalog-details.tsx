// oxlint-disable react-perf/jsx-no-new-function-as-prop
import { Button, Modal, toast } from "@namera-ai/ui";
import { Copy01Icon, HugeiconsIcon } from "@namera-ai/ui/icons";

import { CatalogIdentity, CatalogStatus, chainNames, type CatalogRecord } from "./catalog-display";

async function copyAddress(address: string) {
  try {
    await navigator.clipboard.writeText(address);
    toast.success("Address copied");
  } catch {
    toast.danger("Couldn’t copy address", { description: "Select and copy the address manually." });
  }
}

export function CatalogDetails({
  record,
  onClose,
}: {
  record: CatalogRecord;
  onClose: () => void;
}) {
  return (
    <Modal
      isOpen
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Modal.Backdrop>
        <Modal.Container size="lg">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{record.data.display.name}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="grid gap-5">
              <div className="flex items-center justify-between gap-3">
                <CatalogIdentity record={record} />
                <CatalogStatus status={record.status} />
              </div>
              {record.data.display.description ? (
                <p className="text-muted text-sm">{record.data.display.description}</p>
              ) : null}
              <dl className="grid gap-2 text-sm">
                <div>
                  <dt className="text-muted">Catalog ID</dt>
                  <dd className="break-all font-mono text-xs">{record.id}</dd>
                </div>
                <div>
                  <dt className="text-muted">Search terms</dt>
                  <dd>{record.search.join(", ")}</dd>
                </div>
                {record.data.display.website ? (
                  <div>
                    <dt className="text-muted">Website</dt>
                    <dd>
                      <a
                        className="text-accent break-all underline"
                        href={record.data.display.website.href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {record.data.display.website.hostname}
                      </a>
                    </dd>
                  </div>
                ) : null}
              </dl>
              <section className="grid gap-3" aria-label="Deployments">
                <h3 className="text-sm font-medium">Deployments ({record.entries.length})</h3>
                {record.entries.length === 0 ? (
                  <p className="text-muted text-sm">No deployments added yet.</p>
                ) : null}
                <div className="grid max-h-80 gap-3 overflow-y-auto">
                  {record.entries.map((entry) => (
                    <div key={entry.id} className="border-border rounded-lg border p-3">
                      <div className="flex justify-between gap-2 text-sm">
                        <span className="font-medium">{chainNames[entry.chainId]}</span>
                        <span className="text-muted capitalize">{entry.status}</span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <code className="min-w-0 break-all text-xs">{entry.address}</code>
                        <Button
                          size="sm"
                          variant="tertiary"
                          isIconOnly
                          aria-label={`Copy ${chainNames[entry.chainId]} address`}
                          onPress={() => {
                            void copyAddress(entry.address);
                          }}
                        >
                          <HugeiconsIcon icon={Copy01Icon} />
                        </Button>
                      </div>
                      <p className="text-muted mt-1 text-xs">
                        {entry.data.type === "erc20" ? `${entry.data.decimals} decimals · ` : ""}
                        {entry.interfaceId ? "ABI linked" : "No ABI linked"}
                      </p>
                      {entry.interfaceId ? (
                        <p className="text-muted mt-1 break-all font-mono text-xs">
                          {entry.interfaceId}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" fullWidth onPress={onClose}>
                Close
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
