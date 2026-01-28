import { SkeletonCard } from "@/components/ui/skeletons";

export default function AccountSettingsLoading() {
  return (
    <div className="space-y-6">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}
