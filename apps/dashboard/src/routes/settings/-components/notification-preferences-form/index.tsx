import { DashboardCard } from "@/components/dashboard-card";
import { HeadingGroup } from "@/components/heading-group";

import { notificationPreferenceSections } from "./data";
import { NotificationPreferenceToggle } from "./preference-toggle";

export function NotificationPreferencesForm() {
  return (
    <div className="space-y-8">
      {notificationPreferenceSections.map((section) => (
        <section key={section.heading}>
          <HeadingGroup className="mb-4">
            <HeadingGroup.Title>{section.heading}</HeadingGroup.Title>
          </HeadingGroup>
          <DashboardCard>
            <DashboardCard.Content>
              {section.preferences.map((preference) => (
                <NotificationPreferenceToggle key={preference.label} {...preference} />
              ))}
            </DashboardCard.Content>
          </DashboardCard>
        </section>
      ))}
    </div>
  );
}
