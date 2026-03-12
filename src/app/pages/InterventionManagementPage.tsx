import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { AlertTriangle, Calendar, Search, Filter, AlertCircle, Send, FileText, Users, BookOpen, Heart, Brain, Clock, CheckCircle, XCircle, Plus, Bell, MessageSquare, Shield, Target } from 'lucide-react';
import { mockStudents } from '../mockData';
import { useNavigate } from 'react-router';
import { useData } from '../DataContext';
import { toast } from 'sonner';

// Intervention strategy recommendations based on risk profile
const interventionStrategies = {
  'GPA Below 2.0': [
    { type: 'Academic Tutoring', priority: 'High', description: 'Weekly one-on-one tutoring sessions', resources: ['Tutoring Center', 'Peer Tutors'] },
    { type: 'Study Skills Workshop', priority: 'High', description: 'Time management and study techniques training', resources: ['Academic Success Center'] },
    { type: 'Faculty Mentoring', priority: 'Medium', description: 'Regular check-ins with faculty mentor', resources: ['Faculty Mentors'] },
  ],
  'Low Attendance': [
    { type: 'Attendance Counseling', priority: 'High', description: 'Address barriers to attendance', resources: ['Student Counseling Services'] },
    { type: 'Schedule Adjustment', priority: 'Medium', description: 'Review and optimize course schedule', resources: ['Registrar Office'] },
    { type: 'Transportation Support', priority: 'Medium', description: 'Assist with transportation issues', resources: ['Student Services'] },
  ],
  'Low LMS Engagement': [
    { type: 'Digital Literacy Training', priority: 'High', description: 'LMS navigation and usage training', resources: ['IT Support Center'] },
    { type: 'Technology Access', priority: 'High', description: 'Provide device and internet access', resources: ['Technology Services'] },
    { type: 'Online Learning Support', priority: 'Medium', description: 'Strategies for online engagement', resources: ['Learning Support Center'] },
  ],
  'Mental Health Concerns': [
    { type: 'Counseling Services', priority: 'Critical', description: 'Professional mental health support', resources: ['Counseling Center', 'Crisis Hotline'] },
    { type: 'Wellness Program', priority: 'High', description: 'Stress management and wellness activities', resources: ['Student Wellness Center'] },
    { type: 'Peer Support Group', priority: 'Medium', description: 'Connect with peer support network', resources: ['Student Support Services'] },
  ],
  'Financial Difficulties': [
    { type: 'Financial Aid Consultation', priority: 'High', description: 'Review financial aid options', resources: ['Financial Aid Office'] },
    { type: 'Emergency Funding', priority: 'High', description: 'Apply for emergency financial assistance', resources: ['Student Emergency Fund'] },
    { type: 'Part-time Job Placement', priority: 'Medium', description: 'Campus employment opportunities', resources: ['Career Services'] },
  ],
};

// Stakeholder types for escalation
const stakeholders = [
  { value: 'faculty', label: 'Faculty Member', icon: Users },
  { value: 'counselor', label: 'Counselor', icon: Heart },
  { value: 'dean', label: 'Dean of Students', icon: Shield },
  { value: 'advisor-supervisor', label: 'Advisor Supervisor', icon: Target },
  { value: 'parent-guardian', label: 'Parent/Guardian', icon: Users },
  { value: 'department-head', label: 'Department Head', icon: Users },
];

export default function InterventionManagementPage() {
  const navigate = useNavigate();
  const { students, interventions, appointments, addIntervention, updateIntervention, addAppointment } = useData();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRiskLevel, setFilterRiskLevel] = useState('all');
  const [filterProgram, setFilterProgram] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('recommend');
  
  // Intervention dialog state
  const [isInterventionDialogOpen, setIsInterventionDialogOpen] = useState(false);
  const [interventionType, setInterventionType] = useState('');
  const [interventionDescription, setInterventionDescription] = useState('');
  const [interventionPriority, setInterventionPriority] = useState('');
  const [assignedResource, setAssignedResource] = useState('');
  const [interventionNotes, setInterventionNotes] = useState('');
  
  // Escalation dialog state
  const [isEscalationDialogOpen, setIsEscalationDialogOpen] = useState(false);
  const [escalationStakeholder, setEscalationStakeholder] = useState('');
  const [escalationReason, setEscalationReason] = useState('');
  const [escalationMessage, setEscalationMessage] = useState('');
  const [escalationUrgency, setEscalationUrgency] = useState('');
  
  // Appointment dialog state
  const [isAppointmentDialogOpen, setIsAppointmentDialogOpen] = useState(false);
  const [appointmentType, setAppointmentType] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [appointmentNotes, setAppointmentNotes] = useState('');

  // Filter students
  const filteredStudents = students.filter(student => {
    const matchesSearch = student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         student.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRisk = filterRiskLevel === 'all' || student.riskLevel === filterRiskLevel;
    const matchesProgram = filterProgram === 'all' || student.programme === filterProgram;
    return matchesSearch && matchesRisk && matchesProgram;
  });

  // Get unique programs
  const allPrograms = Array.from(new Set(students.map(s => s.programme)));

  // Get recommended strategies for selected student
  const getRecommendedStrategies = (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return [];

    const recommendations = [];
    
    if (student.gpa < 2.0) {
      recommendations.push(...interventionStrategies['GPA Below 2.0']);
    }
    
    // In a real system, these would be determined by actual data
    if (student.riskScore > 70) {
      recommendations.push(...interventionStrategies['Low Attendance']);
      recommendations.push(...interventionStrategies['Mental Health Concerns']);
    }
    
    if (student.riskLevel === 'critical' || student.riskLevel === 'high') {
      recommendations.push(...interventionStrategies['Low LMS Engagement']);
    }

    // Remove duplicates
    return Array.from(new Map(recommendations.map(r => [r.type, r])).values());
  };

  const handleCreateIntervention = () => {
    if (!selectedStudent || !interventionType || !interventionDescription) {
      toast.error('Please fill in all required fields');
      return;
    }

    const newIntervention = {
      id: `int${Date.now()}`,
      studentId: selectedStudent,
      type: interventionType,
      description: interventionDescription,
      assignedBy: 'adv1',
      assignedTo: assignedResource,
      status: 'pending' as const,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      notes: `Priority: ${interventionPriority}. ${interventionNotes}`,
    };

    addIntervention(newIntervention);
    toast.success('Intervention logged successfully');
    
    setIsInterventionDialogOpen(false);
    setInterventionType('');
    setInterventionDescription('');
    setInterventionPriority('');
    setAssignedResource('');
    setInterventionNotes('');
  };

  const handleSendEscalation = () => {
    if (!selectedStudent || !escalationStakeholder || !escalationReason || !escalationMessage) {
      toast.error('Please fill in all required fields');
      return;
    }

    // In a real system, this would send an actual notification/email
    const student = students.find(s => s.id === selectedStudent);
    const stakeholder = stakeholders.find(s => s.value === escalationStakeholder);
    
    toast.success(`Escalation alert sent to ${stakeholder?.label} for ${student?.name}`);
    
    // Log as an intervention
    const escalationIntervention = {
      id: `esc${Date.now()}`,
      studentId: selectedStudent,
      type: 'Escalation Alert',
      description: `Escalated to ${stakeholder?.label}: ${escalationReason}`,
      assignedBy: 'adv1',
      assignedTo: escalationStakeholder,
      status: 'in-progress' as const,
      createdAt: new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
      notes: `Urgency: ${escalationUrgency}. Message: ${escalationMessage}`,
    };

    addIntervention(escalationIntervention);
    
    setIsEscalationDialogOpen(false);
    setEscalationStakeholder('');
    setEscalationReason('');
    setEscalationMessage('');
    setEscalationUrgency('');
  };

  const handleScheduleAppointment = () => {
    if (!selectedStudent || !appointmentType || !appointmentDate || !appointmentTime) {
      toast.error('Please fill in all required fields');
      return;
    }

    const newAppointment = {
      id: `apt${Date.now()}`,
      studentId: selectedStudent,
      advisorId: 'adv1',
      type: appointmentType,
      date: appointmentDate,
      time: appointmentTime,
      status: 'scheduled' as const,
      notes: appointmentNotes,
    };

    addAppointment(newAppointment);
    
    // Log reminder (in real system, this would trigger automated reminders)
    toast.success('Appointment scheduled. Reminder will be sent 24 hours before.');
    
    setIsAppointmentDialogOpen(false);
    setAppointmentType('');
    setAppointmentDate('');
    setAppointmentTime('');
    setAppointmentNotes('');
  };

  const getRiskBadge = (level: string) => {
    const colors = {
      critical: 'bg-red-600',
      high: 'bg-orange-500',
      medium: 'bg-yellow-500',
      low: 'bg-green-500',
    };
    return <Badge className={colors[level as keyof typeof colors]}>{level.toUpperCase()}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      Critical: 'bg-red-600',
      High: 'bg-orange-500',
      Medium: 'bg-yellow-500',
      Low: 'bg-blue-500',
    };
    return <Badge className={colors[priority as keyof typeof colors]}>{priority}</Badge>;
  };

  const getStatusBadge = (status: string) => {
    const colors = {
      pending: 'bg-yellow-500',
      'in-progress': 'bg-blue-500',
      completed: 'bg-green-500',
      cancelled: 'bg-gray-500',
    };
    return <Badge className={colors[status as keyof typeof colors]}>{status.replace('-', ' ')}</Badge>;
  };

  const selectedStudentData = selectedStudent ? students.find(s => s.id === selectedStudent) : null;
  const selectedStudentInterventions = selectedStudent ? interventions.filter(i => i.studentId === selectedStudent) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Intervention Management</h1>
        <p className="text-muted-foreground">
          Recommend interventions, assign resources, schedule appointments, and send escalation alerts
        </p>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Interventions</CardTitle>
            <Target className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {interventions.filter(i => i.status === 'in-progress').length}
            </div>
            <p className="text-xs text-muted-foreground">Currently in progress</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Cases</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {students.filter(s => s.riskLevel === 'critical').length}
            </div>
            <p className="text-xs text-muted-foreground">Need immediate attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled Appointments</CardTitle>
            <Calendar className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {appointments.filter(a => a.status === 'scheduled').length}
            </div>
            <p className="text-xs text-muted-foreground">Upcoming sessions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {interventions.filter(i => i.status === 'completed' && i.updatedAt === new Date().toISOString().split('T')[0]).length}
            </div>
            <p className="text-xs text-muted-foreground">Interventions closed</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Panel - Student List */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>At-Risk Students</CardTitle>
            <CardDescription>Filter and select students for intervention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>

              {/* Filters */}
              <div className="space-y-2">
                <Select value={filterRiskLevel} onValueChange={setFilterRiskLevel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by risk" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Risk Levels</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterProgram} onValueChange={setFilterProgram}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by program" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Programs</SelectItem>
                    {allPrograms.map(program => (
                      <SelectItem key={program} value={program}>{program}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Student List */}
              <div className="space-y-2 max-h-[500px] overflow-y-auto">
                {filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedStudent === student.id
                        ? 'bg-blue-50 border-blue-300'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setSelectedStudent(student.id)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="font-semibold text-sm">{student.name}</div>
                      {getRiskBadge(student.riskLevel)}
                    </div>
                    <div className="text-xs text-muted-foreground">{student.programme}</div>
                    <div className="text-xs text-muted-foreground">GPA: {student.gpa.toFixed(2)}</div>
                    {student.riskLevel === 'critical' && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-red-600">
                        <AlertCircle className="h-3 w-3" />
                        Immediate attention required
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Right Panel - Intervention Actions */}
        <Card className="md:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>
                  {selectedStudentData ? `${selectedStudentData.name} - Intervention Plan` : 'Select a Student'}
                </CardTitle>
                <CardDescription>
                  {selectedStudentData
                    ? 'Recommended strategies, resources, and action plans'
                    : 'Choose a student from the list to view intervention options'}
                </CardDescription>
              </div>
              {selectedStudentData && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/advisor/student/${selectedStudent}`)}
                >
                  View Full Profile
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedStudentData ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a student to view intervention options</p>
              </div>
            ) : (
              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="recommend">Recommend</TabsTrigger>
                  <TabsTrigger value="interventions">Log Actions</TabsTrigger>
                  <TabsTrigger value="escalate">Escalate</TabsTrigger>
                  <TabsTrigger value="appointments">Schedule</TabsTrigger>
                </TabsList>

                {/* Recommend Tab */}
                <TabsContent value="recommend" className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Brain className="h-5 w-5 text-blue-600" />
                      AI-Recommended Intervention Strategies
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Based on {selectedStudentData.name}'s risk profile (Risk Score: {selectedStudentData.riskScore})
                    </p>
                  </div>

                  <div className="space-y-3">
                    {getRecommendedStrategies(selectedStudent).map((strategy, idx) => (
                      <Card key={idx} className="border-l-4 border-l-blue-500">
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <h4 className="font-semibold">{strategy.type}</h4>
                              <p className="text-sm text-muted-foreground mt-1">{strategy.description}</p>
                            </div>
                            {getPriorityBadge(strategy.priority)}
                          </div>
                          
                          <div className="space-y-2">
                            <div className="text-sm">
                              <span className="font-medium">Available Resources:</span>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {strategy.resources.map((resource, ridx) => (
                                  <Badge key={ridx} variant="outline" className="text-xs">
                                    {resource}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 mt-4">
                            <Button
                              size="sm"
                              onClick={() => {
                                setInterventionType(strategy.type);
                                setInterventionDescription(strategy.description);
                                setInterventionPriority(strategy.priority);
                                setIsInterventionDialogOpen(true);
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Assign This Strategy
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setAppointmentType(strategy.type);
                                setIsAppointmentDialogOpen(true);
                              }}
                            >
                              <Calendar className="h-4 w-4 mr-1" />
                              Schedule Appointment
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {getRecommendedStrategies(selectedStudent).length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      No specific strategies recommended. Student showing stable performance.
                    </div>
                  )}
                </TabsContent>

                {/* Log Actions Tab */}
                <TabsContent value="interventions" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">Intervention History</h3>
                    <Button onClick={() => setIsInterventionDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Log New Intervention
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {selectedStudentInterventions.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No interventions recorded yet
                      </div>
                    ) : (
                      selectedStudentInterventions.map((intervention) => (
                        <Card key={intervention.id}>
                          <CardContent className="pt-4">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-semibold">{intervention.type}</h4>
                                <p className="text-sm text-muted-foreground">{intervention.description}</p>
                              </div>
                              {getStatusBadge(intervention.status)}
                            </div>
                            <div className="text-xs text-muted-foreground space-y-1 mt-3">
                              <div>Created: {intervention.createdAt}</div>
                              <div>Updated: {intervention.updatedAt}</div>
                              {intervention.assignedTo && <div>Assigned to: {intervention.assignedTo}</div>}
                              {intervention.notes && (
                                <div className="mt-2 p-2 bg-gray-50 rounded">
                                  <span className="font-medium">Notes:</span> {intervention.notes}
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </div>
                </TabsContent>

                {/* Escalate Tab */}
                <TabsContent value="escalate" className="space-y-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h3 className="font-semibold mb-2 flex items-center gap-2 text-red-800">
                      <AlertTriangle className="h-5 w-5" />
                      Send Escalation Alert
                    </h3>
                    <p className="text-sm text-red-700">
                      Use this when the situation requires immediate attention from other stakeholders
                    </p>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {stakeholders.map((stakeholder) => (
                      <Card
                        key={stakeholder.value}
                        className="cursor-pointer hover:border-red-300 transition-colors"
                        onClick={() => {
                          setEscalationStakeholder(stakeholder.value);
                          setIsEscalationDialogOpen(true);
                        }}
                      >
                        <CardContent className="pt-4">
                          <div className="flex items-center gap-3">
                            <div className="p-3 bg-red-50 rounded-lg">
                              <stakeholder.icon className="h-6 w-6 text-red-600" />
                            </div>
                            <div>
                              <h4 className="font-semibold">{stakeholder.label}</h4>
                              <p className="text-xs text-muted-foreground">Click to send alert</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div className="mt-6">
                    <h4 className="font-semibold mb-3">Recent Escalations</h4>
                    {selectedStudentInterventions.filter(i => i.type === 'Escalation Alert').length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No escalations sent yet
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {selectedStudentInterventions
                          .filter(i => i.type === 'Escalation Alert')
                          .map((escalation) => (
                            <Card key={escalation.id} className="border-l-4 border-l-red-500">
                              <CardContent className="pt-3">
                                <div className="flex justify-between items-start">
                                  <div className="text-sm">
                                    <div className="font-medium">{escalation.description}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {escalation.createdAt}
                                    </div>
                                  </div>
                                  {getStatusBadge(escalation.status)}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Appointments Tab */}
                <TabsContent value="appointments" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold">Scheduled Appointments</h3>
                    <Button onClick={() => setIsAppointmentDialogOpen(true)}>
                      <Calendar className="h-4 w-4 mr-2" />
                      Schedule New
                    </Button>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-blue-800 mb-2">
                      <Bell className="h-5 w-5" />
                      <span className="font-semibold">Automated Reminders Enabled</span>
                    </div>
                    <p className="text-sm text-blue-700">
                      Both student and advisor will receive email reminders 24 hours before the scheduled appointment
                    </p>
                  </div>

                  <div className="space-y-3">
                    {appointments.filter(a => a.studentId === selectedStudent).length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No appointments scheduled
                      </div>
                    ) : (
                      appointments
                        .filter(a => a.studentId === selectedStudent)
                        .map((appointment) => (
                          <Card key={appointment.id}>
                            <CardContent className="pt-4">
                              <div className="flex justify-between items-start mb-2">
                                <div>
                                  <h4 className="font-semibold">{appointment.type}</h4>
                                  <div className="flex items-center gap-4 mt-2 text-sm">
                                    <div className="flex items-center gap-1">
                                      <Calendar className="h-4 w-4 text-muted-foreground" />
                                      {appointment.date}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <Clock className="h-4 w-4 text-muted-foreground" />
                                      {appointment.time}
                                    </div>
                                  </div>
                                </div>
                                {getStatusBadge(appointment.status)}
                              </div>
                              {appointment.notes && (
                                <div className="text-sm text-muted-foreground mt-3 p-2 bg-gray-50 rounded">
                                  {appointment.notes}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Intervention Dialog */}
      <Dialog open={isInterventionDialogOpen} onOpenChange={setIsInterventionDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Log Intervention Action</DialogTitle>
            <DialogDescription>
              Record intervention strategy and assign appropriate resources
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Intervention Type</Label>
              <Input
                value={interventionType}
                onChange={(e) => setInterventionType(e.target.value)}
                placeholder="e.g., Academic Tutoring, Counseling"
              />
            </div>
            
            <div>
              <Label>Description</Label>
              <Textarea
                value={interventionDescription}
                onChange={(e) => setInterventionDescription(e.target.value)}
                placeholder="Detailed description of the intervention"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priority Level</Label>
                <Select value={interventionPriority} onValueChange={setInterventionPriority}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Critical">Critical</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Assign Resource/Service</Label>
                <Input
                  value={assignedResource}
                  onChange={(e) => setAssignedResource(e.target.value)}
                  placeholder="e.g., Tutoring Center"
                />
              </div>
            </div>

            <div>
              <Label>Additional Notes</Label>
              <Textarea
                value={interventionNotes}
                onChange={(e) => setInterventionNotes(e.target.value)}
                placeholder="Any additional information or follow-up actions"
                rows={2}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsInterventionDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateIntervention}>
                <FileText className="h-4 w-4 mr-2" />
                Log Intervention
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Escalation Dialog */}
      <Dialog open={isEscalationDialogOpen} onOpenChange={setIsEscalationDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Send Escalation Alert
            </DialogTitle>
            <DialogDescription>
              Alert stakeholder about urgent situation requiring immediate attention
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Escalate To</Label>
              <Select value={escalationStakeholder} onValueChange={setEscalationStakeholder}>
                <SelectTrigger>
                  <SelectValue placeholder="Select stakeholder" />
                </SelectTrigger>
                <SelectContent>
                  {stakeholders.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Urgency Level</Label>
              <Select value={escalationUrgency} onValueChange={setEscalationUrgency}>
                <SelectTrigger>
                  <SelectValue placeholder="Select urgency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Critical">Critical - Immediate Action Required</SelectItem>
                  <SelectItem value="High">High - Within 24 Hours</SelectItem>
                  <SelectItem value="Medium">Medium - Within 3 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Reason for Escalation</Label>
              <Input
                value={escalationReason}
                onChange={(e) => setEscalationReason(e.target.value)}
                placeholder="Brief summary of the issue"
              />
            </div>

            <div>
              <Label>Detailed Message</Label>
              <Textarea
                value={escalationMessage}
                onChange={(e) => setEscalationMessage(e.target.value)}
                placeholder="Provide detailed context and recommended actions"
                rows={4}
              />
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800">
              This will immediately notify the selected stakeholder via email and system notification
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsEscalationDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSendEscalation} className="bg-red-600 hover:bg-red-700">
                <Send className="h-4 w-4 mr-2" />
                Send Alert
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Schedule Appointment Dialog */}
      <Dialog open={isAppointmentDialogOpen} onOpenChange={setIsAppointmentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Appointment</DialogTitle>
            <DialogDescription>
              Book a session for counseling, academic advising, or intervention
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Appointment Type</Label>
              <Select value={appointmentType} onValueChange={setAppointmentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Academic Advising">Academic Advising</SelectItem>
                  <SelectItem value="Counseling">Counseling</SelectItem>
                  <SelectItem value="Intervention Session">Intervention Session</SelectItem>
                  <SelectItem value="Follow-up Meeting">Follow-up Meeting</SelectItem>
                  <SelectItem value="Progress Review">Progress Review</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={appointmentDate}
                  onChange={(e) => setAppointmentDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>

              <div>
                <Label>Time</Label>
                <Input
                  type="time"
                  value={appointmentTime}
                  onChange={(e) => setAppointmentTime(e.target.value)}
                />
              </div>
            </div>

            <div>
              <Label>Notes (Optional)</Label>
              <Textarea
                value={appointmentNotes}
                onChange={(e) => setAppointmentNotes(e.target.value)}
                placeholder="Agenda or preparation notes"
                rows={3}
              />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              <div className="flex items-center gap-2 mb-1">
                <Bell className="h-4 w-4" />
                <span className="font-semibold">Automatic Reminder</span>
              </div>
              Both you and the student will receive a reminder 24 hours before the appointment
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsAppointmentDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleScheduleAppointment}>
                <Calendar className="h-4 w-4 mr-2" />
                Schedule
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
