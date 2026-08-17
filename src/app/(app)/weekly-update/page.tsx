"use client";

import { useEffect, useState } from "react";
import { format, startOfWeek } from "date-fns";
import { SectionShell } from "@/components/SectionShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { getDb } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

type Metric = { id: string; key: string; label: string; section: string };

export default function WeeklyUpdate() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [flag, setFlag] = useState({ status: "green", title: "", note: "" });
  const [saving, setSaving] = useState(false);
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  useEffect(() => {
    // Metrics are now in Firestore metrics-config, not Supabase
    // This page uses the SECTION_MAP from metrics-config instead
    const loadMetrics = async () => {
      try {
        const db = getDb();
        const snap = await getDocs(collection(db, "custom_metrics"));
        const items: Metric[] = [];
        snap.forEach(d => {
          const data = d.data();
          items.push({ id: d.id, key: data.key || d.id, label: data.label || d.id, section: data.section || "" });
        });
        setMetrics(items);
      } catch {}
    };
    loadMetrics();
  }, []);

  const grouped = metrics.reduce<Record<string, Metric[]>>((acc, m) => {
    (acc[m.section] ||= []).push(m);
    return acc;
  }, {});

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const db = getDb();
    const weekKey = format(weekStart, "yyyy-MM-dd");
    try {
      const { doc: firestoreDoc, setDoc, serverTimestamp } = await import("firebase/firestore");
      // Save metric values to Firestore (same structure as InlineMetricTable)
      for (const [metricId, v] of Object.entries(values)) {
        if (v === "") continue;
        const metric = metrics.find((m) => m.id === metricId);
        const section = metric?.section || "summary";
        const ref = firestoreDoc(db, "weekly_metrics", weekKey, "sections", section, "entries", metricId);
        await setDoc(ref, { value: v, notes: notes[metricId] || "", updatedBy: user.email || "unknown", updatedAt: serverTimestamp() }, { merge: true });
      }
      // Save RAG flag
      if (flag.title) {
        const flagId = `${flag.status}_${Date.now()}`;
        const flagRef = firestoreDoc(db, "rag_flags", weekKey, "items", flagId);
        await setDoc(flagRef, { status: flag.status, title: flag.title, note: flag.note || "", createdBy: user.email || "unknown", createdAt: serverTimestamp() });
      }
      toast.success("Weekly update saved");
      setValues({});
      setNotes({});
      setFlag({ status: "green", title: "", note: "" });
    } catch (e: any) {
      toast.error(e.message || "Save failed");
    }
    setSaving(false);
  };

  return (
    <SectionShell
      title="This Week's Update"
      description={`Week starting ${format(weekStart, "MMM d, yyyy")}`}
      actions={
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save update"}
        </Button>
      }
    >
      <div className="space-y-6">
        {Object.entries(grouped).map(([section, items]) => (
          <Card key={section}>
            <CardHeader>
              <CardTitle className="capitalize text-sm">{section}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((m) => (
                <div
                  key={m.id}
                  className="grid gap-2 sm:grid-cols-[1fr,140px,2fr] sm:items-center"
                >
                  <Label className="text-sm font-normal">{m.label}</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={values[m.id] ?? ""}
                    onChange={(e) => setValues({ ...values, [m.id]: e.target.value })}
                  />
                  <Input
                    placeholder="Notes (optional)"
                    value={notes[m.id] ?? ""}
                    onChange={(e) => setNotes({ ...notes, [m.id]: e.target.value })}
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Flag something Red / Yellow / Green</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-[180px,1fr]">
              <div>
                <Label>Status</Label>
                <Select value={flag.status} onValueChange={(v) => setFlag({ ...flag, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="red">Red</SelectItem>
                    <SelectItem value="yellow">Yellow</SelectItem>
                    <SelectItem value="green">Green</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Title</Label>
                <Input
                  value={flag.title}
                  onChange={(e) => setFlag({ ...flag, title: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Note</Label>
              <Textarea
                value={flag.note}
                onChange={(e) => setFlag({ ...flag, note: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </SectionShell>
  );
}
