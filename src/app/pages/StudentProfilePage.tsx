import { useAuth } from '../AuthContext';
import { useNavigate } from 'react-router';
import { useStudentData } from '../contexts/StudentDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { KeyRound, Mail, Phone, GraduationCap, Hash, User, BookOpen, Building2 } from 'lucide-react';
import { Skeleton } from '../components/ui/skeleton';

export default function StudentProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { studentData, loading } = useStudentData();

  if (loading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
          <Skeleton className="h-28 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  const displayName = studentData?.name || user?.name || '—';
  const displayEmail = studentData?.email || user?.email || '—';

  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">Your personal and academic information</p>
      </div>

      {/* Profile Header */}
      <Card>
        <CardContent className="pt-6 pb-6">
          <div className="flex items-center gap-5">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-blue-600 text-white text-xl font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold truncate">{displayName}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{displayEmail}</p>
              {studentData?.studentId && (
                <div className="flex items-center gap-1.5 mt-2">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm font-mono text-muted-foreground">{studentData.studentId}</span>
                </div>
              )}
              {studentData?.enrollmentStatus && (
                <div className="mt-2">
                  <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                    {studentData.enrollmentStatus}
                  </Badge>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Academic Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-blue-600" />
            Academic Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <InfoRow icon={<BookOpen className="h-4 w-4 text-muted-foreground" />} label="Programme" value={studentData?.programme} />
          <InfoRow icon={<User className="h-4 w-4 text-muted-foreground" />} label="Level / Year" value={studentData?.level} />
          <InfoRow icon={<GraduationCap className="h-4 w-4 text-muted-foreground" />} label="Academic Year" value={studentData?.academicYear} />
          <InfoRow icon={<Building2 className="h-4 w-4 text-muted-foreground" />} label="Faculty" value={studentData?.faculty} />
          <InfoRow icon={<Hash className="h-4 w-4 text-muted-foreground" />} label="Student ID" value={studentData?.studentId} />
        </CardContent>
      </Card>

      {/* Personal Information */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-blue-600" />
            Personal Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <InfoRow icon={<Mail className="h-4 w-4 text-muted-foreground" />} label="Email Address" value={displayEmail} />
          {studentData?.phone && (
            <InfoRow icon={<Phone className="h-4 w-4 text-muted-foreground" />} label="Phone Number" value={studentData.phone} />
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" className="gap-2" onClick={() => navigate('/student/change-password')}>
          <KeyRound className="h-4 w-4" />
          Change Password
        </Button>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium mt-0.5">{value || '—'}</p>
      </div>
    </div>
  );
}
