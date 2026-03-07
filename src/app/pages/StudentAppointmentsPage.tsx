import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Calendar as CalendarIcon, Clock, User, Plus, X, CheckCircle, AlertCircle, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../AuthContext';
import { useData } from '../DataContext';

export default function StudentAppointmentsPage() {
  const { user } = useAuth();
  const { appointments, addAppointment } = useData();
  
  const [isBookDialogOpen, setIsBookDialogOpen] = useState(false);
  const [appointmentType, setAppointmentType] = useState('');
  const [selectedStaffType, setSelectedStaffType] = useState('');
  const [selectedStaffMember, setSelectedStaffMember] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [appointmentReason, setAppointmentReason] = useState('');
  const [appointmentNotes, setAppointmentNotes] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Available staff members
  const staffMembers = {
    advisor: [
      { id: 'adv1', name: 'Dr. Sarah Johnson' },
      { id: 'adv2', name: 'Prof. Michael Chen' },
      { id: 'adv3', name: 'Dr. Emily Davis' },
    ],
    counselor: [
      { id: 'cou1', name: 'Lisa Anderson' },
      { id: 'cou2', name: 'Dr. Robert Martinez' },
      { id: 'cou3', name: 'Jennifer White' },
    ],
    faculty: [
      { id: 'fac1', name: 'Prof. David Brown' },
      { id: 'fac2', name: 'Dr. Amanda Taylor' },
      { id: 'fac3', name: 'Prof. James Wilson' },
    ],
    support: [
      { id: 'sup1', name: 'Career Services - John Smith' },
      { id: 'sup2', name: 'Financial Aid - Maria Garcia' },
      { id: 'sup3', name: 'Tutoring Center - Alex Thompson' },
    ],
  };

  // Available time slots
  const timeSlots = [
    '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
    '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM'
  ];

  const studentAppointments = appointments.filter((a) => a.studentId === user?.id);
  
  const filteredAppointments = filterStatus === 'all' 
    ? studentAppointments 
    : studentAppointments.filter(a => a.status === filterStatus);

  const upcomingAppointments = studentAppointments.filter((a) => a.status === 'scheduled');
  const completedAppointments = studentAppointments.filter((a) => a.status === 'completed');

  const handleBookAppointment = () => {
    if (!appointmentType || !selectedStaffType || !selectedStaffMember || !appointmentDate || !appointmentTime || !appointmentReason) {
      toast.error('Please fill in all required fields');
      return;
    }

    const staffMember = staffMembers[selectedStaffType as keyof typeof staffMembers].find(
      s => s.id === selectedStaffMember
    );

    const newAppointment = {
      id: `apt${Date.now()}`,
      studentId: user?.id || '',
      advisorId: selectedStaffMember,
      type: appointmentType,
      date: appointmentDate,
      time: appointmentTime,
      status: 'scheduled' as const,
      notes: `${appointmentReason}${appointmentNotes ? `\n\nAdditional Notes: ${appointmentNotes}` : ''}`,
    };

    addAppointment(newAppointment);
    
    toast.success('Appointment Request Submitted!', {
      description: `Your ${appointmentType} with ${staffMember?.name} has been scheduled for ${new Date(appointmentDate).toLocaleDateString()} at ${appointmentTime}. You will receive a confirmation email shortly.`
    });

    // Reset form
    setIsBookDialogOpen(false);
    setAppointmentType('');
    setSelectedStaffType('');
    setSelectedStaffMember('');
    setAppointmentDate('');
    setAppointmentTime('');
    setAppointmentReason('');
    setAppointmentNotes('');
  };

  const handleCancelAppointment = (appointmentId: string) => {
    const appointment = studentAppointments.find((a) => a.id === appointmentId);
    if (appointment) {
      toast.info('Appointment cancellation requested', {
        description: 'Your advisor will be notified. You will receive a confirmation email.'
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      scheduled: 'bg-blue-500',
      completed: 'bg-green-500',
      cancelled: 'bg-gray-500',
    };
    return <Badge className={colors[status as keyof typeof colors]}>{status.toUpperCase()}</Badge>;
  };

  const getAppointmentIcon = (type: string) => {
    return <User className="h-5 w-5" />;
  };

  const minDate = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">My Appointments</h1>
        <p className="text-muted-foreground">
          Book and manage appointments with advisors, counselors, and support staff
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Upcoming</CardTitle>
            <CalendarIcon className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{upcomingAppointments.length}</div>
            <p className="text-xs text-muted-foreground">Scheduled sessions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedAppointments.length}</div>
            <p className="text-xs text-muted-foreground">Past sessions</p>
          </CardContent>
        </Card>
      </div>

      {/* Appointment Booking Guide */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="text-blue-900">How to Book an Appointment</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-4 text-sm">
            <div className="flex items-start gap-2">
              <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold flex-shrink-0">1</div>
              <div>
                <div className="font-semibold text-blue-900">Choose Type</div>
                <div className="text-blue-700">Select appointment type</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold flex-shrink-0">2</div>
              <div>
                <div className="font-semibold text-blue-900">Select Staff</div>
                <div className="text-blue-700">Pick advisor or counselor</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold flex-shrink-0">3</div>
              <div>
                <div className="font-semibold text-blue-900">Pick Time</div>
                <div className="text-blue-700">Choose date and time slot</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold flex-shrink-0">4</div>
              <div>
                <div className="font-semibold text-blue-900">Confirm</div>
                <div className="text-blue-700">Receive email confirmation</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Appointments List */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Your Appointments</CardTitle>
              <CardDescription>View appointment status and details</CardDescription>
            </div>
            <div className="flex gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Appointments</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={() => setIsBookDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Appointment
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredAppointments.length === 0 ? (
            <div className="text-center py-12">
              <CalendarIcon className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No Appointments Found</h3>
              <p className="text-muted-foreground mb-6">
                {filterStatus === 'all' 
                  ? 'You haven\'t booked any appointments yet.'
                  : `No ${filterStatus} appointments.`}
              </p>
              <Button onClick={() => setIsBookDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Book Your First Appointment
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredAppointments.map((appointment) => (
                <Card key={appointment.id} className={`border-l-4 ${
                  appointment.status === 'scheduled' ? 'border-l-blue-500' :
                  appointment.status === 'completed' ? 'border-l-green-500' :
                  'border-l-gray-400'
                }`}>
                  <CardContent className="pt-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${
                          appointment.status === 'scheduled' ? 'bg-blue-50' :
                          appointment.status === 'completed' ? 'bg-green-50' :
                          'bg-gray-50'
                        }`}>
                          {getAppointmentIcon(appointment.type)}
                        </div>
                        <div>
                          <h4 className="font-semibold text-lg">{appointment.type}</h4>
                          <p className="text-sm text-muted-foreground">Appointment ID: {appointment.id}</p>
                        </div>
                      </div>
                      {getStatusBadge(appointment.status)}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2 mb-4">
                      <div className="flex items-center gap-2 text-sm">
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Date:</span>
                        <span>{new Date(appointment.date).toLocaleDateString('en-US', { 
                          weekday: 'short', 
                          year: 'numeric', 
                          month: 'short', 
                          day: 'numeric' 
                        })}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Time:</span>
                        <span>{appointment.time}</span>
                      </div>
                    </div>

                    {appointment.notes && (
                      <div className="p-3 bg-muted rounded-md mb-4">
                        <p className="text-sm"><strong>Notes:</strong> {appointment.notes}</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {appointment.status === 'scheduled' && (
                        <>
                          <Button variant="outline" size="sm">
                            Reschedule
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-red-600 hover:text-red-700"
                            onClick={() => handleCancelAppointment(appointment.id)}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                          </Button>
                        </>
                      )}
                      {appointment.status === 'completed' && (
                        <Badge variant="outline" className="text-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Completed
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Book Appointment Dialog */}
      <Dialog open={isBookDialogOpen} onOpenChange={setIsBookDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Book an Appointment</DialogTitle>
            <DialogDescription>
              Schedule a meeting with academic advisors, counselors, or support staff
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Appointment Type */}
            <div>
              <Label className="required">Appointment Type *</Label>
              <Select value={appointmentType} onValueChange={setAppointmentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select appointment type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Academic Advising">Academic Advising</SelectItem>
                  <SelectItem value="Counseling Session">Counseling Session</SelectItem>
                  <SelectItem value="Faculty Mentoring">Faculty Mentoring</SelectItem>
                  <SelectItem value="Career Guidance">Career Guidance</SelectItem>
                  <SelectItem value="Financial Aid">Financial Aid Consultation</SelectItem>
                  <SelectItem value="Tutoring Session">Tutoring Session</SelectItem>
                  <SelectItem value="Progress Review">Progress Review</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Staff Type */}
            <div>
              <Label className="required">Staff Type *</Label>
              <Select value={selectedStaffType} onValueChange={(value) => {
                setSelectedStaffType(value);
                setSelectedStaffMember('');
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="advisor">Academic Advisor</SelectItem>
                  <SelectItem value="counselor">Counselor</SelectItem>
                  <SelectItem value="faculty">Faculty Member</SelectItem>
                  <SelectItem value="support">Support Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Staff Member */}
            {selectedStaffType && (
              <div>
                <Label className="required">Staff Member *</Label>
                <Select value={selectedStaffMember} onValueChange={setSelectedStaffMember}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select staff member" />
                  </SelectTrigger>
                  <SelectContent>
                    {staffMembers[selectedStaffType as keyof typeof staffMembers].map((staff) => (
                      <SelectItem key={staff.id} value={staff.id}>
                        {staff.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="required">Preferred Date *</Label>
                <Input
                  type="date"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  min={minDate}
                />
              </div>

              <div>
                <Label className="required">Preferred Time *</Label>
                <Select value={appointmentTime} onValueChange={setAppointmentTime}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select time" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((slot) => (
                      <SelectItem key={slot} value={slot}>
                        {slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Reason */}
            <div>
              <Label className="required">Reason for Appointment *</Label>
              <Textarea
                value={appointmentReason}
                onChange={(e) => setAppointmentReason(e.target.value)}
                placeholder="Please briefly describe the purpose of your appointment"
                rows={3}
              />
            </div>

            {/* Additional Notes */}
            <div>
              <Label>Additional Notes (Optional)</Label>
              <Textarea
                value={appointmentNotes}
                onChange={(e) => setAppointmentNotes(e.target.value)}
                placeholder="Any other information you'd like to share"
                rows={2}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <strong>Note:</strong> Your appointment request will be reviewed by the staff member. 
              You will receive an email confirmation once approved. A reminder will be sent 24 hours before the appointment.
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => setIsBookDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleBookAppointment}>
                <Plus className="h-4 w-4 mr-2" />
                Book Appointment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}