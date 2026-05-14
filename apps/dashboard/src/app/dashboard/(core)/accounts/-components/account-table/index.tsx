import { AccountDisplayOptions } from "./display-options";
import { AccountFilter } from "./filters";
import { AccountsTable } from "./table";

export const AccountsTableContainer = () => {
  return (
    <div className="flex flex-col">
      <div className="flex flex-row items-center justify-between px-4 py-2">
        <div className="text-muted-foreground text-xs">2 Accounts</div>
        <div className="flex flex-row items-center gap-2">
          <AccountFilter />
          <AccountDisplayOptions />
        </div>
      </div>
      <AccountsTable />
    </div>
  );
};
