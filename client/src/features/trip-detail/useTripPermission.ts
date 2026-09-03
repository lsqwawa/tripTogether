import { useMemo } from "react";
import type { Trip } from "../../types";
import { useUserStore } from "../../stores/userStore";

/** isOwner / canEdit 由当前用户成员角色派生 */
export function useTripPermission(trip: Trip | null) {
  const currentUser = useUserStore((s) => s.user);
  return useMemo(() => {
    const myMembership = trip?.members?.find(
      (m) => m.userId === currentUser?.id
    );
    const isOwner = myMembership?.role === "owner";
    const canEdit = isOwner || myMembership?.role === "editor";
    return { isOwner, canEdit };
  }, [trip, currentUser?.id]);
}
