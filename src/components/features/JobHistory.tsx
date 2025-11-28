import { useState, useEffect } from 'react'
import { RefreshCw, Loader2, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { Button } from '../ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import { jobApi } from '../../services/api'
import type { Job } from '../../types'

export function JobHistory(): React.ReactElement {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')

  const loadJobs = async (): Promise<void> => {
    try {
      setLoading(true)
      setError('')
      const data = await jobApi.list({ limit: 50 })
      setJobs(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load jobs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadJobs()
  }, [])

  const getStatusIcon = (status: Job['status']): React.ReactElement => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-destructive" />
      case 'running':
        return <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
      case 'cancelled':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />
    }
  }

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDuration = (job: Job): string => {
    if (!job.started_at) return '-'
    const start = new Date(job.started_at).getTime()
    const end = job.completed_at
      ? new Date(job.completed_at).getTime()
      : Date.now()
    const duration = Math.round((end - start) / 1000)
    if (duration < 60) return `${String(duration)}s`
    if (duration < 3600) return `${String(Math.round(duration / 60))}m`
    return `${String(Math.round(duration / 3600))}h`
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold">Job History</h2>
          <p className="text-muted-foreground mt-1">
            Recent operations and their status
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void loadJobs()}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty State */}
      {!loading && jobs.length === 0 && (
        <div className="text-center py-12">
          <Clock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No jobs yet</h3>
          <p className="text-muted-foreground">
            Jobs will appear here when you perform operations
          </p>
        </div>
      )}

      {/* Job List */}
      {!loading && jobs.length > 0 && (
        <div className="space-y-4">
          {jobs.map((job) => (
            <Card key={job.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(job.status)}
                    <div>
                      <CardTitle className="text-base">{job.type}</CardTitle>
                      <CardDescription className="font-mono text-xs">
                        {job.id}
                      </CardDescription>
                    </div>
                  </div>
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${
                      job.status === 'completed'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                        : job.status === 'failed'
                        ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        : job.status === 'running'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                    }`}
                  >
                    {job.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Created:</span>
                    <span className="ml-2">{formatDate(job.created_at)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="ml-2">{formatDuration(job)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Progress:</span>
                    <span className="ml-2">{job.progress}%</span>
                  </div>
                  {job.user_email && (
                    <div>
                      <span className="text-muted-foreground">User:</span>
                      <span className="ml-2">{job.user_email}</span>
                    </div>
                  )}
                </div>
                {job.error && (
                  <div className="mt-3 p-2 bg-destructive/10 rounded text-sm text-destructive">
                    {job.error}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

