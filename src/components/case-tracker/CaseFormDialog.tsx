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
export type LetterType = "incoming" | "outgoing";

export type CaseRow = {
  id: string;
  case_number: string;
  opened_date: string;
  closed_date: string | null;
  registration_date: string;
  letter_type: LetterType;
  letter_date: string | null;
  sender_name: string | null;
  sender_office: string | null;
  recipient_name: string | null;
  recipient_office: string | null;
  file_reference: string | null;
  remarks: string | null;
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
  registration_date: string;
  letter_type: LetterType;
  letter_date: string;
  sender_name: string;
  sender_office: string;
  recipient_name: string;
  recipient_office: string;
  file_reference: string;
  remarks: string;
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
  registration_date: new Date().toISOString().slice(0, 10),
  letter_type: "incoming",
  letter_date: "",
  sender_name: "",
  sender_office: "",
  recipient_name: "",
  recipient_office: "",
  file_reference: "",
  remarks: "",
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
        registration_date: initial.registration_date,
        letter_type: initial.letter_type,
        letter_date: initial.letter_date ?? "",
        sender_name: initial.sender_name ?? "",
        sender_office: initial.sender_office ?? "",
        recipient_name: initial.recipient_name ?? "",
        recipient_office: initial.recipient_office ?? "",
        file_reference: initial.file_reference ?? "",
        remarks: initial.remarks ?? "",
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
      const basePayload = {
        case_number: form.case_number.trim(),
        registration_date: form.registration_date,
        letter_type: form.letter_type,
        letter_date: form.letter_date || null,
        sender_name: form.sender_name || null,
        sender_office: form.sender_office || null,
        recipient_name: form.recipient_name || null,
        recipient_office: form.recipient_office || null,
        file_reference: form.file_reference || null,
        remarks: form.remarks || null,
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
        const { error } = await supabase.from("cases").update(basePayload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError || !userData.user) throw new Error("You must be signed in");
        const { error } = await supabase
          .from("cases")
          .insert({ ...basePayload, user_id: userData.user.id });
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
          <Field label="Registration ID (Case Number) *">
            <Input value={form.case_number} onChange={(e) => set("case_number", e.target.value)} />
          </Field>
          <Field label="Registration Date">
            <Input type="date" value={form.registration_date} onChange={(e) => set("registration_date", e.target.value)} />
          </Field>
          <Field label="Letter Type">
            <Select value={form.letter_type} onValueChange={(v) => set("letter_type", v as LetterType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="incoming">Incoming (ገቢ ደብዳቤ)</SelectItem>
                <SelectItem value="outgoing">Outgoing (ወጪ ደብዳቤ)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Letter Date">
            <Input type="date" value={form.letter_date} onChange={(e) => set("letter_date", e.target.value)} />
          </Field>
          <Field label="File Reference">
            <Input value={form.file_reference} onChange={(e) => set("file_reference", e.target.value)} placeholder="e.g. MoR/2024/001" />
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
          <Field label="Sender Name">
            <Input value={form.sender_name} onChange={(e) => set("sender_name", e.target.value)} />
          </Field>
          <Field label="Sender Office">
            <Input value={form.sender_office} onChange={(e) => set("sender_office", e.target.value)} />
          </Field>
          <Field label="Recipient Name">
            <Input value={form.recipient_name} onChange={(e) => set("recipient_name", e.target.value)} />
          </Field>
          <Field label="Recipient Office">
            <Input value={form.recipient_office} onChange={(e) => set("recipient_office", e.target.value)} />
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
            <Field label="Remarks">
              <Textarea rows={2} value={form.remarks} onChange={(e) => set("remarks", e.target.value)} />
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