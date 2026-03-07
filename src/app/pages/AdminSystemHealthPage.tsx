import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import {
  Activity,
  Server,
  Database,
  HardDrive,
  Cpu,
  Wifi,
  AlertTriangle,
  CheckCircle,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export default function AdminSystemHealthPage() {
  // System metrics data
  const cpuData = [
    { time: '00:00', usage: 45 },
    { time: '04:00', usage: 38 },
    { time: '08:00', usage: 72 },
    { time: '12:00', usage: 85 },
    { time: '16:00', usage: 68 },
    { time: '20:00', usage: 52 },
  ];

  const memoryData = [
    { time: '00:00', usage: 62 },
    { time: '04:00', usage: 58 },
    { time: '08:00', usage: 75 },
    { time: '12:00', usage: 82 },
    { time: '16:00', usage: 78 },
    { time: '20:00', usage: 65 },
  ];

  const apiResponseTimes = [
    { endpoint: '/api/students', avgTime: 120, status: 'healthy' },
    { endpoint: '/api/alerts', avgTime: 85, status: 'healthy' },
    { endpoint: '/api/appointments', avgTime: 95, status: 'healthy' },
    { endpoint: '/api/interventions', avgTime: 180, status: 'warning' },
    { endpoint: '/api/reports', avgTime: 250, status: 'warning' },
  ];

  const systemServices = [
    { name: 'Web Server', status: 'online', uptime: '99.9%', lastCheck: '2 min ago' },
    { name: 'Database', status: 'online', uptime: '99.8%', lastCheck: '1 min ago' },
    { name: 'Authentication', status: 'online', uptime: '100%', lastCheck: '3 min ago' },
    { name: 'Email Service', status: 'online', uptime: '98.5%', lastCheck: '5 min ago' },
    { name: 'Analytics Engine', status: 'warning', uptime: '95.2%', lastCheck: '10 min ago' },
    { name: 'Backup Service', status: 'online', uptime: '99.5%', lastCheck: '15 min ago' },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
      case 'healthy':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
      case 'healthy':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'warning':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'error':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Health</h1>
          <p className="text-muted-foreground">Monitor system performance and service status</p>
        </div>
        <Button variant="outline" className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Overall System Status */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>System Status</CardDescription>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-600" />
              <CardTitle className="text-2xl text-green-600">Operational</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">All systems running</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Uptime</CardDescription>
            <CardTitle className="text-3xl">99.7%</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active Users</CardDescription>
            <CardTitle className="text-3xl text-blue-600">342</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Currently online</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>API Requests</CardDescription>
            <CardTitle className="text-3xl">1.2M</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">Last 24 hours</p>
          </CardContent>
        </Card>
      </div>

      {/* Resource Usage */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>CPU Usage</CardTitle>
                <CardDescription>Server processor utilization over time</CardDescription>
              </div>
              <Cpu className="h-5 w-5 text-blue-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Current: 68%</span>
                <Badge className="bg-green-100 text-green-800 border-green-200">Normal</Badge>
              </div>
              <Progress value={68} className="h-2" />
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={cpuData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="usage" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Memory Usage</CardTitle>
                <CardDescription>RAM utilization over time</CardDescription>
              </div>
              <HardDrive className="h-5 w-5 text-purple-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Current: 78% (12.5GB / 16GB)</span>
                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Warning</Badge>
              </div>
              <Progress value={78} className="h-2" />
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={memoryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="usage" stroke="#a855f7" fill="#a855f7" fillOpacity={0.6} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Storage & Network */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Storage Usage</CardTitle>
              <Database className="h-5 w-5 text-green-600" />
            </div>
            <CardDescription>Disk space utilization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Database</span>
                <span className="text-sm text-muted-foreground">45GB / 100GB</span>
              </div>
              <Progress value={45} className="h-2" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">File Storage</span>
                <span className="text-sm text-muted-foreground">128GB / 500GB</span>
              </div>
              <Progress value={25.6} className="h-2" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Backup Storage</span>
                <span className="text-sm text-muted-foreground">210GB / 1TB</span>
              </div>
              <Progress value={21} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Network Traffic</CardTitle>
              <Wifi className="h-5 w-5 text-blue-600" />
            </div>
            <CardDescription>Bandwidth usage</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Incoming</span>
                <span className="text-sm text-muted-foreground">125 Mbps</span>
              </div>
              <Progress value={62.5} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">Peak: 200 Mbps</p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Outgoing</span>
                <span className="text-sm text-muted-foreground">85 Mbps</span>
              </div>
              <Progress value={42.5} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">Peak: 200 Mbps</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Services Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Services Status</CardTitle>
              <CardDescription>Monitor all system services and their health</CardDescription>
            </div>
            <Server className="h-5 w-5 text-blue-600" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {systemServices.map((service) => (
              <div
                key={service.name}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(service.status)}
                  <div>
                    <h4 className="font-medium">{service.name}</h4>
                    <p className="text-xs text-muted-foreground">Last checked: {service.lastCheck}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium">{service.uptime}</p>
                    <p className="text-xs text-muted-foreground">Uptime</p>
                  </div>
                  <Badge className={getStatusColor(service.status)}>{service.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* API Performance */}
      <Card>
        <CardHeader>
          <CardTitle>API Performance</CardTitle>
          <CardDescription>Average response times for critical endpoints</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {apiResponseTimes.map((api) => (
              <div key={api.endpoint} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(api.status)}
                  <div>
                    <h4 className="font-medium font-mono text-sm">{api.endpoint}</h4>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium">{api.avgTime}ms</p>
                    <p className="text-xs text-muted-foreground">Avg response time</p>
                  </div>
                  <Badge className={getStatusColor(api.status)}>
                    {api.avgTime < 150 ? 'Excellent' : api.avgTime < 300 ? 'Good' : 'Slow'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
