import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useCurrentRole } from "@/hooks/useCurrentRole";

export function AssignCaseDialog({
  caseId,
  caseDepartmentId,
  open,
  onOpenChange,
}: {
  caseId: string | null;
  caseDepartmentId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const { isAdmin, isDeptHead, departmentId } = useCurrentRole();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Which department to draw candidates from
  const scopeDept = isAdmin ? caseDepartmentId : departmentId;

  const { data: candidates = [] } = useQuery({
    queryKey: ["assign-candidates", scopeDept, isAdmin],
    enabled: open,
    queryFn: async () => {
      // pull all roles (RLS allows authenticated select) then join profiles
      let rolesQ = supabase.from("user_roles").select("user_id, role, department_id");
      if (!isAdmin && scopeDept) rolesQ = rolesQ.eq("department_id", scopeDept);
      const { data: roles, error } = await rolesQ;
      if (error) throw error;
      const ids = Array.from(new Set((roles ?? []).map((r) => r.user_id)));
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, department")
        .in("id", ids);
      return (roles ?? []).map((r) => {
        const p = profs?.find((x) => x.id === r.user_id);
        return {
          user_id: r.user_id,
          role: r.role as string,
          department_id: r.department_id as string | null,
          full_name: p?.full_name ?? "(no name)",
          department: p?.department ?? "",
        };
      });
    },
  });

  const { data: existing = [] } = useQuery({
    queryKey: ["case-assignments", caseId],
    enabled: open && !!caseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_assignments")
        .select("user_id")
        .eq("case_id", caseId!);
      if (error) throw error;
      return (data ?? []).map((r) => r.user_id);
    },
  });

  useEffect(() => {
    setSelected(new Set(existing));
  }, [existing]);

  const save = useMutation({
    mutationFn: async () => {
      if (!caseId) return;
      const { data: userData } = await supabase.auth.getUser();
      const me = userData.user?.id;
      const toAdd = [...selected].filter((u) => !existing.includes(u));
      const toRemove = existing.filter((u) => !selected.has(u));
      if (toRemove.length) {
        const { error } = await supabase
          .from("case_assignments")
          .delete()
          .eq("case_id", caseId)
          .in("user_id", toRemove);
        if (error) throw error;
      }
      if (toAdd.length) {
        const { error } = await supabase.from("case_assignments").insert(
          toAdd.map((user_id) => ({ case_id: caseId, user_id, assigned_by: me })),
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Assignments updated");
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["case-assignments", caseId] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = (id: string) => {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const visible = useMemo(() => {
    if (isDeptHead) return candidates.filter((c) => c.department_id === departmentId);
    return candidates;
  }, [candidates, isDeptHead, departmentId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Assign case</DialogTitle>
          <DialogDescription>
            {isDeptHead
              ? "Select employees in your department to assign this case."
              : "Select users to assign this case."}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-80 space-y-2 overflow-y-auto rounded border p-2">
          {visible.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">
              No eligible users found.
            </p>
          ) : (
            visible.map((u) => (
              <label
                key={u.user_id}
                className="flex cursor-pointer items-center gap-3 rounded p-2 hover:bg-accent"
              >
                <Checkbox
                  checked={selected.has(u.user_id)}
                  onCheckedChange={() => toggle(u.user_id)}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium">{u.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {u.role.replace("_", " ")}
                    {u.department ? ` · ${u.department}` : ""}
                  </p>
                </div>
              </label>
            ))
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Save assignments
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}