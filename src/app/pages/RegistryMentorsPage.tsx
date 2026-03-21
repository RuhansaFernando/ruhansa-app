import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import { Search, Users } from "lucide-react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../../firebase";

interface MentorRecord {
  id: string;
  tutorId: string;
  name: string;
  email: string;
  department: string;
  status: "active" | "inactive";
}

export default function RegistryMentorsPage() {
  const [mentors, setMentors] = useState<MentorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "academic_mentors"), orderBy("name")),
      (snap) => {
        setMentors(
          snap.docs.map((d) => ({
            id: d.id,
            tutorId: d.data().tutorId ?? "",
            name: d.data().name ?? "",
            email: d.data().email ?? "",
            department: d.data().department ?? "",
            status: d.data().status ?? "active",
          }))
        );
        setLoading(false);
      },
      () => {
        toast.error("Failed to load mentors.");
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  const filtered = mentors.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.tutorId.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      m.department.toLowerCase().includes(q)
    );
  });

  const activeCount = mentors.filter((m) => m.status === "active").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Academic Mentors</h1>
        <p className="text-muted-foreground">View all academic mentors</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader className="pb-3">
            <CardDescription>Total Mentors</CardDescription>
            <CardTitle className="text-3xl">{mentors.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Registered mentors</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-3">
            <CardDescription>Active</CardDescription>
            <CardTitle className="text-3xl text-green-600">{activeCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Active mentor accounts</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-gray-300">
          <CardHeader className="pb-3">
            <CardDescription>Inactive</CardDescription>
            <CardTitle className="text-3xl text-gray-500">{mentors.length - activeCount}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Inactive mentor accounts</p>
          </CardContent>
        </Card>
      </div>

      {/* Mentors Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>Mentor Directory</CardTitle>
              <CardDescription>All registered academic mentors</CardDescription>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, ID, email…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Loading mentors…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">
                {mentors.length === 0
                  ? "No mentors found."
                  : "No mentors match your search."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Mentor ID</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Full Name</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Department</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((mentor) => (
                    <tr
                      key={mentor.id}
                      className="border-b last:border-0 hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {mentor.tutorId || "—"}
                      </td>
                      <td className="px-4 py-3 font-medium">{mentor.name}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{mentor.email || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{mentor.department || "—"}</td>
                      <td className="px-4 py-3">
                        <Badge
                          className={
                            mentor.status === "active"
                              ? "bg-green-100 text-green-700 hover:bg-green-100"
                              : "bg-gray-100 text-gray-600 hover:bg-gray-100"
                          }
                        >
                          {mentor.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
