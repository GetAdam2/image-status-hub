import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Plus, Search, Pencil, Trash2, CheckCircle2, Circle, LogOut } from "lucide-react";
import ministryLogo from "@/assets/ministry-logo.png.asset.json";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { type CaseRow } from "./CaseFormDialog";

type Filter = "all" | "open" | "closed";

export function CaseTracker() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ full_name: string | null; department: string | null } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, department")
        .eq("id", data.user.id)
        .maybeSingle();
      setProfile(p ?? { full_name: null, department: null });
    });
  }, []);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const { data: cases = [], isLoading } = useQuery({
    queryKey: ["cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CaseRow[];
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async (c: CaseRow) => {
      const next = c.status === "open" ? "closed" : "open";
      const { error } = await supabase
        .from("cases")
        .update({
          status: next,
          closed_date: next === "closed" ? new Date().toISOString().slice(0, 10) : null,
        })
        .eq("id", c.id);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      qc.invalidateQueries({ queryKey: ["cases"] });
      toast.success(`Case marked ${next}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteCase = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("cases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cases"] });
      toast.success("Case deleted");
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      if (filter !== "all" && c.status !== filter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        c.case_number.toLowerCase().includes(q) ||
        (c.defendant_name ?? "").toLowerCase().includes(q) ||
        (c.plaintiff_name ?? "").toLowerCase().includes(q) ||
        (c.subject ?? "").toLowerCase().includes(q)
      );
    });
  }, [cases, filter, search]);

  const counts = useMemo(
    () => ({
      all: cases.length,
      open: cases.filter((c) => c.status === "open").length,
      closed: cases.filter((c) => c.status === "closed").length,
    }),
    [cases],
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-5">
          <div className="flex items-center gap-3">
            <img src={ministryLogo.url} alt="Ministry of Revenues logo" className="h-12 w-12 rounded-full object-contain" />
            <div>
              <h1 className="text-lg font-semibold leading-tight">Ministry of Revenues</h1>
              <p className="text-xs text-muted-foreground">Letter Case Tracker</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {profile && (
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium">{profile.full_name || "Staff"}</p>
                <p className="text-xs text-muted-foreground">{profile.department || "—"}</p>
              </div>
            )}
            <Button onClick={() => navigate({ to: "/register-letter" })}>
              <Plus className="mr-2 h-4 w-4" /> Register Letter
            </Button>
            <Button variant="outline" size="icon" onClick={signOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <StatCard label="Total Cases" value={counts.all} tone="default" />
          <StatCard label="Open" value={counts.open} tone="open" />
          <StatCard label="Closed" value={counts.closed} tone="closed" />
        </div>

        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="closed">Closed</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cases..."
              className="pl-9"
            />
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Case #</TableHead>
                  <TableHead>Plaintiff</TableHead>
                  <TableHead>Defendant</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Opened</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      No cases yet. Click "New Case" to add one.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono font-medium">{c.case_number}</TableCell>
                      <TableCell>{c.plaintiff_name ?? "—"}</TableCell>
                      <TableCell>{c.defendant_name ?? "—"}</TableCell>
                      <TableCell className="max-w-xs truncate">{c.subject ?? "—"}</TableCell>
                      <TableCell>{c.opened_date}</TableCell>
                      <TableCell>
                        <Badge variant={c.status === "open" ? "default" : "secondary"}>
                          {c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title={c.status === "open" ? "Mark closed" : "Reopen"}
                            onClick={() => toggleStatus.mutate(c)}
                          >
                            {c.status === "open" ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              <Circle className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              navigate({
                                to: "/register-letter",
                                search: { id: c.id },
                              })
                            }
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(c.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this case?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteCase.mutate(deleteId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "default" | "open" | "closed";
}) {
  const dot =
    tone === "open"
      ? "bg-chart-2"
      : tone === "closed"
        ? "bg-muted-foreground"
        : "bg-primary";
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <div className={`h-3 w-3 rounded-full ${dot}`} />
      </CardContent>
    </Card>
  );
}