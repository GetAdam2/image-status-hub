import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "department_head" | "employee";

export function useCurrentRole() {
  const { data, isLoading } = useQuery({
    queryKey: ["current-role"],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) return null;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role, department_id")
        .eq("user_id", user.id);
      // pick highest privilege
      const order: AppRole[] = ["admin", "department_head", "employee"];
      const found = order.find((r) => roles?.some((x) => x.role === r)) ?? "employee";
      const departmentId =
        roles?.find((r) => r.department_id)?.department_id ?? null;
      return { userId: user.id, role: found as AppRole, departmentId };
    },
  });

  const role = data?.role;
  return {
    isLoading,
    userId: data?.userId ?? null,
    role: role ?? null,
    departmentId: data?.departmentId ?? null,
    isAdmin: role === "admin",
    isDeptHead: role === "department_head",
    isEmployee: role === "employee",
    canManageCases: role === "admin" || role === "department_head",
    canReopen: role === "admin",
    canDelete: role === "admin",
  };
}