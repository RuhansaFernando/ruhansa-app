import { useStudentData } from '../contexts/StudentDataContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import { Skeleton } from '../components/ui/skeleton';
import { CALENDAR_LINKS } from '../config/calendarLinks';

export default function StudentAppointmentsPage() {
  const { studentData, loading } = useStudentData();
  const ssaMessages = studentData?.ssaMessages ?? [];

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
        <Skeleton className="h-48 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Book Support</h1>
        <p className="text-muted-foreground text-sm mt-1">Get help from your support team</p>
      </div>

      {/* Booking cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* SSA card */}
        <Card className="border-blue-200">
          <CardContent className="pt-6 pb-6 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">👩‍💼</span>
              <div>
                <p className="font-semibold text-base text-blue-900">Student Support Advisor</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4 flex-1">
              Get help with academic challenges, personal issues, career guidance and any other
              concerns. Your SSA is your first point of contact for all support.
            </p>
            <div className="flex flex-wrap gap-1.5 mb-5">
              {['Academic', 'Personal', 'Career', 'Financial'].map((tag) => (
                <Badge key={tag} className="bg-blue-50 text-blue-700 border-blue-200 text-xs">{tag}</Badge>
              ))}
            </div>
            <Button
              className="bg-blue-600 hover:bg-blue-700 w-full"
              onClick={() => window.open(CALENDAR_LINKS.ssa, '_blank')}
            >
              Book Appointment
            </Button>
          </CardContent>
        </Card>

        {/* Mentor card */}
        <Card className="border-green-200">
          <CardContent className="pt-6 pb-6 flex flex-col h-full">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl">👨‍🏫</span>
              <div>
                <p className="font-semibold text-base text-green-900">Academic Mentor</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4 flex-1">
              Get subject-specific academic support, module guidance and study advice from your
              assigned Academic Mentor.
            </p>
            <div className="flex flex-wrap gap-1.5 mb-5">
              {['Academic', 'Module Help', 'Study Skills'].map((tag) => (
                <Badge key={tag} className="bg-green-50 text-green-700 border-green-200 text-xs">{tag}</Badge>
              ))}
            </div>
            <Button
              className="bg-green-600 hover:bg-green-700 w-full"
              onClick={() => window.open(CALENDAR_LINKS.mentor, '_blank')}
            >
              Book Appointment
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Support History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Your Support History</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Messages and notes from your support team</p>
        </CardHeader>
        <CardContent className="pt-0">
          {ssaMessages.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No support interactions recorded yet. Book an appointment to get started.
            </p>
          ) : (
            <div className="divide-y">
              {ssaMessages.map((msg) => (
                <div key={msg.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-10 w-10 flex-shrink-0">
                      <AvatarFallback className="bg-blue-600 text-white text-xs font-semibold">
                        {msg.recordedBy.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="text-sm font-semibold">{msg.recordedBy}</p>
                        {msg.interventionType && (
                          <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                            {msg.interventionType}
                          </Badge>
                        )}
                        {msg.date && (
                          <span className="text-xs text-muted-foreground ml-auto">{msg.date}</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 leading-relaxed">{msg.notes}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
