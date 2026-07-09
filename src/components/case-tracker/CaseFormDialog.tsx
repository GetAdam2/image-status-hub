import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type CaseStatus = "open" | "closed";

export type CaseRow = {
  id: string;
  case_number: string;
  opened_date: string;
  closed_date: string | null;
  defendant_name: string | null;
  defendant_address: string | null;
  plaintiff_name: string | null;
  plaintiff_address: string | null;
  subject: string | null;
  notes: string | null;
  status: CaseStatus;
  created_at: string;
  updated_at: string;
};

type FormState = {
  case_number: string;
  opened_date: string;
  closed_date: string;
  plaintiff_name: string;
  plaintiff_address: string;
  defendant_name: string;
  defendant_address: string;
  subject: string;
  notes: string;
  status: CaseStatus;
};

const empty = (): FormState => ({
  case_number: "",
  opened_date: new Date().toISOString().slice(0, 10),
  closed_date: "",
  plaintiff_name: "",
  plaintiff_address: "",
  defendant_name: "",
  defendant_address: "",
  subject: "",
  notes: "",
  status: "open",
});

export function CaseFormDialog({
  open,
  onOpenChange,
  initial,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: CaseRow | null;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>(empty());

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setForm({
        case_number: initial.case_number,
        opened_date: initial.opened_date,
        closed_date: initial.closed_date ?? "",
        plaintiff_name: initial.plaintiff_name ?? "",
        plaintiff_address: initial.plaintiff_address ?? "",
        defendant_name: initial.defendant_name ?? "",
        defendant_address: initial.defendant_address ?? "",
        subject: initial.subject ?? "",
        notes: initial.notes ?? "",
        status: initial.status,
      });
    } else {
      setForm(empty());
    }
  }, [initial, open]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.case_number.trim()) throw new Error("Case number is required");
      const payload = {
        case_number: form.case_number.trim(),
        opened_date: form.opened_date,
        closed_date: form.closed_date || null,
        plaintiff_name: form.plaintiff_name || null,
        plaintiff_address: form.plaintiff_address || null,
        defendant_name: form.defendant_name || null,
        defendant_address: form.defendant_address || null,
        subject: form.subject || null,
        notes: form.notes || null,
        status: form.status,
      };
      if (initial) {
        const { error } = await supabase.from("cases").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cases").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(initial ? "Case updated" : "Case created");
      onSaved();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit Case" : "New Case"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Case Number *">
            <Input value={form.case_number} onChange={(e) => set("case_number", e.target.value)} />
          </Field>
          <Field label="Status">
            <Select value={form.status} onValueChange={(v) => set("status", v as CaseStatus)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Opened Date">
            <Input type="date" value={form.opened_date} onChange={(e) => set("opened_date", e.target.value)} />
          </Field>
          <Field label="Closed Date">
            <Input type="date" value={form.closed_date} onChange={(e) => set("closed_date", e.target.value)} />
          </Field>
          <Field label="Plaintiff Name">
            <Input value={form.plaintiff_name} onChange={(e) => set("plaintiff_name", e.target.value)} />
          </Field>
          <Field label="Plaintiff Address">
            <Input value={form.plaintiff_address} onChange={(e) => set("plaintiff_address", e.target.value)} />
          </Field>
          <Field label="Defendant Name">
            <Input value={form.defendant_name} onChange={(e) => set("defendant_name", e.target.value)} />
          </Field>
          <Field label="Defendant Address">
            <Input value={form.defendant_address} onChange={(e) => set("defendant_address", e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Subject">
              <Input value={form.subject} onChange={(e) => set("subject", e.target.value)} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <Textarea rows={3} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </Field>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving…" : initial ? "Save Changes" : "Create Case"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}