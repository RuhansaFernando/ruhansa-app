import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Calendar, Clock, User, Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { useData } from '../DataContext';

export default function AppointmentsPage() {
  const { students, appointments, updateAppointment, addAppointment } = useData();
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newAppointment, setNewAppointment] = useState({
    studentId: '',
    type: '',
    date: '',
    time: '',
    notes: '',
  });

  // Filter appointments by advisor (hardcoded for demo)
  const advisorAppointments = appointments.filter((a) => a.advisorId === 'adv1');

  // Apply status filter
  const filteredAppointments = advisorAppointments.filter((apt) => {
    if (filterStatus === 'all') return true;
    return apt.status === filterStatus;
  });

  // Group appointments by status
  const scheduled = filteredAppointments.filter((a) => a.status === 'scheduled');
  const completed = filteredAppointments.filter((a) => a.status === 'completed');

  const handleComplete = (appointmentId: string) => {
    updateAppointment(appointmentId, { status: 'completed' });
  };

  const handleReschedule = (appointment: any) => {
    setSelectedAppointment(appointment);
    setNewDate(appointment.date);
    setNewTime(appointment.time);
    setRescheduleDialogOpen(true);
  };

  const handleSaveReschedule = () => {
    if (selectedAppointment && newDate && newTime) {
      updateAppointment(selectedAppointment.id, { date: newDate, time: newTime });
      setRescheduleDialogOpen(false);
      setSelectedAppointment(null);
      setNewDate('');
      setNewTime('');
    }
  };

  const handleScheduleNew = () => {
    if (!newAppointment.studentId || !newAppointment.type || !newAppointment.date || !newAppointment.time) {
      return;
    }

    const appointment = {
      id: `apt${Date.now()}`,
      advisorId: 'adv1',
      studentId: newAppointment.studentId,
      type: newAppointment.type,
      date: newAppointment.date,
      time: newAppointment.time,
      status: 'scheduled',
      notes: newAppointment.notes,
    };

    addAppointment(appointment);
    setScheduleDialogOpen(false);
    setNewAppointment({
      studentId: '',
      type: '',
      date: '',
      time: '',
      notes: '',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Appointments</h1>
          <p className="text-muted-foreground">Manage student appointments and meetings</p>
        </div>
        <Button onClick={() => setScheduleDialogOpen(true)}>Schedule New Appointment</Button>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Appointments</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{advisorAppointments.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{scheduled.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <User className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completed.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter */}
      <div className="flex gap-3">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[200px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Appointments</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="no-show">No Show</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Appointments List */}
      <Card>
        <CardHeader>
          <CardTitle>Appointment Schedule</CardTitle>
          <CardDescription>View and manage your scheduled meetings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredAppointments.length > 0 ? (
              filteredAppointments.map((appointment) => {
                const student = students.find((s) => s.id === appointment.studentId);
                return (
                  <div
                    key={appointment.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-start gap-4">
                        <div className="h-12 w-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold">
                          {student?.name.split(' ').map((n) => n[0]).join('') || 'NA'}
                        </div>
                        <div>
                          <h4 className="font-medium">{student?.name}</h4>
                          <p className="text-sm text-muted-foreground">{appointment.type}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {appointment.date}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {appointment.time}
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          className={
                            appointment.status === 'completed'
                              ? 'bg-green-100 text-green-800 border-green-200'
                              : appointment.status === 'scheduled'
                              ? 'bg-blue-100 text-blue-800 border-blue-200'
                              : 'bg-red-100 text-red-800 border-red-200'
                          }
                        >
                          {appointment.status}
                        </Badge>
                        {appointment.status === 'scheduled' && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleReschedule(appointment)}>
                              Reschedule
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleComplete(appointment.id)}>
                              Complete
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                    {appointment.notes && (
                      <div className="mt-3 p-3 bg-muted rounded-md text-sm">
                        <span className="font-medium">Notes: </span>
                        {appointment.notes}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                No appointments found matching the selected filter.
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={setRescheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reschedule Appointment</DialogTitle>
            <DialogDescription>Change the date and time of the appointment.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                value={newTime}
                onChange={(e) => setNewTime(e.target.value)}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRescheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveReschedule}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule New Dialog */}
      <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule New Appointment</DialogTitle>
            <DialogDescription>Create a new appointment with a student.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="student">Student</Label>
              <Select
                value={newAppointment.studentId}
                onValueChange={(value) => setNewAppointment({ ...newAppointment, studentId: value })}
              >
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select a student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Input
                id="type"
                type="text"
                value={newAppointment.type}
                onChange={(e) => setNewAppointment({ ...newAppointment, type: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={newAppointment.date}
                onChange={(e) => setNewAppointment({ ...newAppointment, date: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Time</Label>
              <Input
                id="time"
                type="time"
                value={newAppointment.time}
                onChange={(e) => setNewAppointment({ ...newAppointment, time: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Input
                id="notes"
                type="text"
                value={newAppointment.notes}
                onChange={(e) => setNewAppointment({ ...newAppointment, notes: e.target.value })}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setScheduleDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleScheduleNew}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}