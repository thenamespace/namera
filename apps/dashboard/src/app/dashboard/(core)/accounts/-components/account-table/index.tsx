import { AccountDisplayOptions } from "./display-options";
import { AccountFilter } from "./filters";

export const AccountsTable = () => {
  return (
    <div className="flex flex-row items-center justify-between px-4 py-2">
      <div className="text-muted-foreground text-sm">10 Accounts</div>
      <div className="flex flex-row items-center gap-2">
        <AccountFilter />
        <AccountDisplayOptions />
      </div>
    </div>
  );
};
