import { TabNavigation } from "@/components/navigation/TabNavigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <TabNavigation />
      {children}
    </>
  );
}
