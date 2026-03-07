import { mockAlerts } from '../mockData';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { AlertTriangle, AlertCircle, CheckCircle, Clock, Filter } from 'lucide-react';
import { useState } from 'react';

export default function FacultyAlertsPage() {
  const [filter, setFilter] = useState<'all' | 'acknowledged' | 'pending'>('all');

  // Get alerts relevant to faculty
  const facultyAlerts = mockAlerts.slice(0, 15);

  const filteredAlerts = facultyAlerts.filter((alert) => {
    if (filter === 'acknowledged') return alert.acknowledged;
    if (filter === 'pending') return !alert.acknowledged;
    return true;
  });

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      case 'high':
        return <AlertCircle className="h-5 w-5 text-orange-600" />;
      case 'medium':
        return <Clock className="h-5 w-5 text-yellow-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-blue-600" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const stats = {
    total: facultyAlerts.length,
    pending: facultyAlerts.filter((a) => !a.acknowledged).length,
    acknowledged: facultyAlerts.filter((a) => a.acknowledged).length,
    critical: facultyAlerts.filter((a) => a.severity === 'critical').length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Alerts</h1>
        <p className="text-muted-foreground">
          Student risk alerts and notifications for your courses
        </p>
      </div>

      {/* Alert Statistics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Alerts</CardDescription>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-3xl text-orange-600">{stats.pending}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Awaiting action</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Acknowledged</CardDescription>
            <CardTitle className="text-3xl text-green-600">{stats.acknowledged}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Reviewed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Critical</CardDescription>
            <CardTitle className="text-3xl text-red-600">{stats.critical}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Urgent attention needed</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Alert History</CardTitle>
              <CardDescription>Recent alerts for students in your courses</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant={filter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                All
              </Button>
              <Button
                variant={filter === 'pending' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('pending')}
              >
                Pending
              </Button>
              <Button
                variant={filter === 'acknowledged' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilter('acknowledged')}
              >
                Acknowledged
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`p-4 border rounded-lg ${
                  !alert.acknowledged ? 'bg-orange-50 border-orange-200' : 'bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1">{getSeverityIcon(alert.severity)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <h3 className="font-semibold mb-1">{alert.title}</h3>
                        <p className="text-sm text-muted-foreground mb-2">{alert.description}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge className={getSeverityColor(alert.severity)}>
                          {alert.severity}
                        </Badge>
                        {alert.acknowledged && (
                          <Badge className="bg-green-100 text-green-800 border-green-200">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Acknowledged
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        <span>Student: {alert.studentName}</span>
                        <span className="mx-2">•</span>
                        <span>{new Date(alert.timestamp).toLocaleString()}</span>
                        {alert.acknowledgedBy && (
                          <>
                            <span className="mx-2">•</span>
                            <span>Acknowledged by {alert.acknowledgedBy}</span>
                          </>
                        )}
                      </div>
                      {!alert.acknowledged && (
                        <Button size="sm" variant="outline">
                          Acknowledge
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredAlerts.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No alerts found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
