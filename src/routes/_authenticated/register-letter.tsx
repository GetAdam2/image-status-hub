import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Save, Pencil, Upload, ArrowLeft, FileText, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useCurrentRole } from "@/hooks/useCurrentRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Search = { id?: string };

export const Route = createFileRoute("/_authenticated/register-letter")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    id: typeof s.id === "string" ? s.id : undefined,
  }),
  component: RegisterLetterPage,
});

const DEPARTMENTS = [
  "IT Department",
  "Finance Department",
  "Human Resource Department",
  "Legal Department",
  "Administration Department",
];

const STATUSES: { value: string; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "under_review", label: "Under Review" },
  { value: "assigned", label: "Assigned" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_approval", label: "Waiting Approval" },
  { value: "approved", label: "Approved" },
  { value: "closed", label: "Closed" },
];

type FormState = {
  letter_reference_number: string;
  received_date: string;
  sender_organization: string;
  subject: string;
  description: string;
  assigned_department: string;
  responsible_person: string;
  acceptance_date: string;
  approving_officer: string;
  signature_text: string;
  status: string;
  remarks: string;
};

const empty = (): FormState => ({
  letter_reference_number: "",
  received_date: new Date().toISOString().slice(0, 10),
  sender_organization: "",
  subject: "",
  description: "",
  assigned_department: "",
  responsible_person: "",
  acceptance_date: "",
  approving_officer: "",
  signature_text: "",
  status: "open",
  remarks: "",
});

function RegisterLetterPage() {
  const { id } = useSearch({ from: "/_authenticated/register-letter" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { role, isEmployee, canManageCases, canReopen, isLoading: roleLoading } = useCurrentRole();

  const [form, setForm] = useState<FormState>(empty());
  const [readOnly, setReadOnlyState] = useState<boolean>(!!id);
  const effectiveReadOnly = readOnly || isEmployee;
  const setReadOnly = setReadOnlyState;
  const [confirmEdit, setConfirmEdit] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [existingAttachment, setExistingAttachment] = useState<{ url: string; name: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Directory of users (for assignment dropdowns)
  const { data: staff = [] } = useQuery({
    queryKey: ["staff-directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, department");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Load existing record when editing
  const { data: existing } = useQuery({
    queryKey: ["case", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("cases").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    if (!existing) return;
    setForm({
      letter_reference_number: existing.letter_reference_number ?? existing.file_reference ?? "",
      received_date: existing.received_date ?? existing.registration_date ?? "",
      sender_organization: existing.sender_organization ?? existing.sender_office ?? "",
      subject: existing.subject ?? "",
      description: existing.description ?? "",
      assigned_department: existing.assigned_department ?? "",
      responsible_person: existing.responsible_person ?? "",
      acceptance_date: existing.acceptance_date ?? "",
      approving_officer: existing.approving_officer ?? "",
      signature_text: existing.signature_text ?? "",
      status: existing.status ?? "open",
      remarks: existing.remarks ?? "",
    });
    if (existing.attachment_url) {
      setExistingAttachment({ url: existing.attachment_url, name: existing.attachment_name ?? "attachment" });
    }
  }, [existing]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      // Required field validation
      const required: [keyof FormState, string][] = [
        ["letter_reference_number", "Letter Reference Number"],
        ["received_date", "Received Date"],
        ["sender_organization", "Sender Organization"],
        ["subject", "Subject"],
        ["assigned_department", "Assigned Department"],
        ["status", "Status"],
      ];
      for (const [k, label] of required) {
        if (!String(form[k]).trim()) throw new Error(`${label} is required`);
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("You must be signed in");
      const userId = userData.user.id;

      let attachment_url = existingAttachment?.url ?? null;
      let attachment_name = existingAttachment?.name ?? null;

      if (attachmentFile) {
        const path = `${userId}/attachments/${Date.now()}-${attachmentFile.name}`;
        const { error: upErr } = await supabase.storage
          .from("letter-attachments")
          .upload(path, attachmentFile, { upsert: false });
        if (upErr) throw upErr;
        attachment_url = path;
        attachment_name = attachmentFile.name;
      }

      let signature_file_url: string | null = existing?.signature_file_url ?? null;
      if (signatureFile) {
        const path = `${userId}/signatures/${Date.now()}-${signatureFile.name}`;
        const { error: upErr } = await supabase.storage
          .from("letter-attachments")
          .upload(path, signatureFile, { upsert: false });
        if (upErr) throw upErr;
        signature_file_url = path;
      }

      const payload: any = {
        letter_reference_number: form.letter_reference_number,
        received_date: form.received_date,
        sender_organization: form.sender_organization,
        subject: form.subject,
        description: form.description || null,
        assigned_department: form.assigned_department || null,
        responsible_person: form.responsible_person || null,
        acceptance_date: form.acceptance_date || null,
        approving_officer: form.approving_officer || null,
        signature_text: form.signature_text || null,
        signature_file_url,
        attachment_url,
        attachment_name,
        remarks: form.remarks || null,
        status: form.status,
      };

      if (id) {
        const { error } = await supabase.from("cases").update(payload).eq("id", id);
        if (error) throw error;
        return id;
      } else {
        // case_number required by schema — reuse letter reference
        payload.case_number = form.letter_reference_number;
        payload.user_id = userId;
        const { data, error } = await supabase.from("cases").insert(payload).select("id").single();
        if (error) throw error;
        return data.id as string;
      }
    },
    onSuccess: (savedId) => {
      toast.success(id ? "Letter record updated" : "Letter registered successfully");
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["case", savedId] });
      navigate({ to: "/dashboard" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const serialDisplay = useMemo(() => {
    return existing?.serial_number ?? "Auto-generated on save";
  }, [existing]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setAttachmentFile(f);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="mx-auto max-w-6xl">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => navigate({ to: "/dashboard" })}
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Button>

        <Card className="overflow-hidden rounded-xl shadow-xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 px-6 py-6 text-white sm:px-8">
            <h1 className="text-xl font-bold sm:text-2xl">
              {id ? "Letter Record" : "Incoming Letter Registration Form"}
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              Ministry of Revenues — Official Document Management System
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!effectiveReadOnly) save.mutate();
            }}
            className="p-6 sm:p-8"
          >
            {/* Two-column body */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Left column */}
              <div className="space-y-5">
                <FormField label="Serial Number / Record ID">
                  <Input value={serialDisplay} readOnly disabled className="bg-slate-100" />
                </FormField>

                <FormField label="Letter Reference Number" required>
                  <Input
                    value={form.letter_reference_number}
                    onChange={(e) => set("letter_reference_number", e.target.value)}
                    disabled={effectiveReadOnly}
                    placeholder="e.g. MoR/2026/001"
                    className="rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </FormField>

                <FormField label="Received Date" required>
                  <Input
                    type="date"
                    value={form.received_date}
                    onChange={(e) => set("received_date", e.target.value)}
                    disabled={effectiveReadOnly}
                    className="rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </FormField>

                <FormField label="Sender / Source Organization" required>
                  <Input
                    value={form.sender_organization}
                    onChange={(e) => set("sender_organization", e.target.value)}
                    disabled={effectiveReadOnly}
                    placeholder="e.g. Ministry of Finance"
                    className="rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </FormField>

                <FormField label="Letter Subject / Title" required>
                  <Input
                    value={form.subject}
                    onChange={(e) => set("subject", e.target.value)}
                    disabled={effectiveReadOnly}
                    className="rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </FormField>

                <FormField label="Letter Description / Summary">
                  <Textarea
                    rows={5}
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    disabled={effectiveReadOnly}
                    placeholder="Provide a summary of the letter contents…"
                    className="rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </FormField>
              </div>

              {/* Right column */}
              <div className="space-y-5">
                <FormField label="Assigned Department" required>
                  <Select
                    value={form.assigned_department}
                    onValueChange={(v) => set("assigned_department", v)}
                    disabled={effectiveReadOnly}
                  >
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label="Responsible Person / Assigned Officer">
                  <Select
                    value={form.responsible_person}
                    onValueChange={(v) => set("responsible_person", v)}
                    disabled={effectiveReadOnly}
                  >
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder="Select officer" />
                    </SelectTrigger>
                    <SelectContent>
                      {staff.length === 0 ? (
                        <SelectItem value="__none" disabled>No staff available</SelectItem>
                      ) : (
                        staff.map((s: any) => (
                          <SelectItem key={s.id} value={s.full_name || s.id}>
                            {s.full_name || "Unnamed"} {s.department ? `— ${s.department}` : ""}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label="Acceptance Date">
                  <Input
                    type="date"
                    value={form.acceptance_date}
                    onChange={(e) => set("acceptance_date", e.target.value)}
                    disabled={effectiveReadOnly}
                    className="rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </FormField>

                <FormField label="Approving Officer / Department Head">
                  <Select
                    value={form.approving_officer}
                    onValueChange={(v) => set("approving_officer", v)}
                    disabled={effectiveReadOnly}
                  >
                    <SelectTrigger className="rounded-lg">
                      <SelectValue placeholder="Select approver" />
                    </SelectTrigger>
                    <SelectContent>
                      {staff.length === 0 ? (
                        <SelectItem value="__none" disabled>No staff available</SelectItem>
                      ) : (
                        staff.map((s: any) => (
                          <SelectItem key={`ap-${s.id}`} value={s.full_name || s.id}>
                            {s.full_name || "Unnamed"} {s.department ? `— ${s.department}` : ""}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </FormField>

                <FormField label="Signature">
                  <div className="space-y-2">
                    <Input
                      value={form.signature_text}
                      onChange={(e) => set("signature_text", e.target.value)}
                      disabled={effectiveReadOnly}
                      placeholder="Type signature name"
                      className="rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
                      <Upload className="h-4 w-4" />
                      <span className="truncate">
                        {signatureFile ? signatureFile.name : "Upload digital signature image"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={effectiveReadOnly}
                        onChange={(e) => setSignatureFile(e.target.files?.[0] ?? null)}
                      />
                    </label>
                  </div>
                </FormField>

                <FormField label="Status" required>
                  <Select
                    value={form.status}
                    onValueChange={(v) => set("status", v)}
                    disabled={effectiveReadOnly}
                  >
                    <SelectTrigger className="rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              </div>
            </div>

            {/* Full width */}
            <div className="mt-6 space-y-5">
              <FormField label="Remarks / Notes">
                <Textarea
                  rows={3}
                  value={form.remarks}
                  onChange={(e) => set("remarks", e.target.value)}
                  disabled={effectiveReadOnly}
                  className="rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </FormField>

              <FormField label="Upload Letter Document">
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => !effectiveReadOnly && fileInputRef.current?.click()}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center transition ${
                    dragOver
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-300 bg-slate-50 hover:bg-slate-100"
                  } ${effectiveReadOnly ? "cursor-not-allowed opacity-70" : ""}`}
                >
                  <Upload className="mb-2 h-8 w-8 text-slate-500" />
                  {attachmentFile ? (
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <FileText className="h-4 w-4" />
                      {attachmentFile.name}
                      {!effectiveReadOnly && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setAttachmentFile(null); }}
                          className="ml-2 text-red-500 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ) : existingAttachment ? (
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <FileText className="h-4 w-4" /> {existingAttachment.name}
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-slate-700">
                        Drag & drop or click to upload
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        PDF, DOCX, JPG, PNG allowed
                      </p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </FormField>
            </div>

            {/* Actions */}
            <div className="mt-8 flex flex-col-reverse items-center justify-center gap-3 sm:flex-row">
              {isEmployee ? (
                <p className="text-sm text-muted-foreground">
                  Read-only access — employees can view but not edit records.
                </p>
              ) : id && readOnly ? (
                <Button
                  type="button"
                  onClick={() => setConfirmEdit(true)}
                  className="w-full bg-blue-600 text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-lg sm:w-auto"
                >
                  <Pencil className="mr-2 h-4 w-4" /> Edit Record
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={save.isPending}
                  className="w-full bg-green-600 text-white shadow-md transition-all hover:-translate-y-0.5 hover:bg-green-700 hover:shadow-lg sm:w-auto"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {save.isPending ? "Saving…" : "Save Letter"}
                </Button>
              )}
            </div>
          </form>
        </Card>
      </div>

      <AlertDialog open={confirmEdit} onOpenChange={setConfirmEdit}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enable editing?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to modify an official record. Changes will be saved to the register.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setReadOnly(false); setConfirmEdit(false); }}>
              Enable Edit
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      {children}
    </div>
  );
}