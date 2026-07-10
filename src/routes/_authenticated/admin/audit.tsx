import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/admin/audit")({
  component: AuditPage,
});

function AuditPage() {
  const nav = useNavigate();
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_audit_log")
        .select("*, cases(serial_number, letter_reference_number, subject), profiles:user_id(full_name)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as any[];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-6 py-4">
          <Button variant="ghost" size="icon" onClick={() => nav({ to: "/dashboard" })}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold">Audit Trail</h1>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Case</TableHead>
                  <TableHead>Status change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Loading…</TableCell></TableRow>
                ) : logs.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">No activity yet.</TableCell></TableRow>
                ) : (
                  logs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap text-xs">
                        {new Date(l.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>{l.profiles?.full_name || "—"}</TableCell>
                      <TableCell><Badge variant="outline">{l.user_role || "—"}</Badge></TableCell>
                      <TableCell><Badge>{l.action}</Badge></TableCell>
                      <TableCell className="text-xs">
                        <div className="font-mono">{l.cases?.serial_number || "—"}</div>
                        <div className="text-muted-foreground truncate max-w-xs">{l.cases?.subject}</div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {l.previous_status && <span className="text-muted-foreground">{l.previous_status} → </span>}
                        {l.new_status || "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}