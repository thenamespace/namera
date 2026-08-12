import { Button, Dropdown, Label } from "@namera-ai/ui";
import {
  HugeiconsIcon,
  MoreHorizontalIcon,
  UserRemove01Icon,
  UserSettings01Icon,
} from "@namera-ai/ui/icons";

type MemberActionsProps = {
  name: string;
};

export function MemberActions({ name }: MemberActionsProps) {
  return (
    <Dropdown>
      <Button isIconOnly aria-label={`Actions for ${name}`} size="sm" variant="tertiary">
        <HugeiconsIcon icon={MoreHorizontalIcon} />
      </Button>
      <Dropdown.Popover className="min-w-44">
        <Dropdown.Menu>
          <Dropdown.Item id="update-role" textValue="Update role">
            <HugeiconsIcon icon={UserSettings01Icon} />
            <Label>Update role</Label>
          </Dropdown.Item>
          <Dropdown.Item id="remove-member" textValue="Remove member" variant="danger">
            <HugeiconsIcon icon={UserRemove01Icon} />
            <Label>Remove member</Label>
          </Dropdown.Item>
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}

export type { MemberActionsProps };
