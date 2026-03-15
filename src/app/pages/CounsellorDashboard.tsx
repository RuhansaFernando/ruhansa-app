import { useAuth } from "../AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Heart } from "lucide-react";

export default function CounsellorDashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Student Counsellor Dashboard</h1>
        <p className="text-muted-foreground">Welcome to your dashboard</p>
      </div>

      <Card className="max-w-md">
        <CardHeader className="flex flex-row items-center gap-4 pb-2">
          <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
            <Heart className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <CardTitle className="text-lg">{user?.name}</CardTitle>
            <p className="text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Welcome to your dashboard. Use the sidebar to navigate to your appointments and students.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
