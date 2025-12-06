import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Play,
  Bell,
  CheckCircle2,
  XCircle,
  Link,
  Shield,
} from 'lucide-react'
import { Button } from '../ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Checkbox } from '../ui/checkbox'
import { webhookApi } from '../../services/webhookApi'
import type { Webhook, WebhookEventType, WebhookInput } from '../../types/webhook'
import { ALL_WEBHOOK_EVENTS, WEBHOOK_EVENT_LABELS } from '../../types/webhook'

export function WebhookManager(): React.ReactElement {
  const [webhooks, setWebhooks] = useState<Webhook[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<Webhook | null>(null)
  const [deletingWebhook, setDeletingWebhook] = useState<Webhook | null>(null)
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // Form states
  const [formName, setFormName] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formSecret, setFormSecret] = useState('')
  const [formEvents, setFormEvents] = useState<WebhookEventType[]>([])
  const [formEnabled, setFormEnabled] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const loadWebhooks = useCallback(async (): Promise<void> => {
    try {
      setLoading(true)
      setError('')
      const data = await webhookApi.list()
      setWebhooks(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load webhooks')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadWebhooks()
  }, [loadWebhooks])

  const resetForm = (): void => {
    setFormName('')
    setFormUrl('')
    setFormSecret('')
    setFormEvents([])
    setFormEnabled(true)
  }

  const openCreateDialog = (): void => {
    resetForm()
    setShowCreateDialog(true)
  }

  const openEditDialog = (webhook: Webhook): void => {
    setFormName(webhook.name)
    setFormUrl(webhook.url)
    setFormSecret(webhook.secret ?? '')
    try {
      setFormEvents(JSON.parse(webhook.events) as WebhookEventType[])
    } catch {
      setFormEvents([])
    }
    setFormEnabled(webhook.enabled === 1)
    setEditingWebhook(webhook)
  }

  const handleCreateWebhook = async (): Promise<void> => {
    if (!formName.trim() || !formUrl.trim() || formEvents.length === 0) {
      return
    }

    setSubmitting(true)
    try {
      const input: WebhookInput = {
        name: formName.trim(),
        url: formUrl.trim(),
        secret: formSecret.trim() || null,
        events: formEvents,
        enabled: formEnabled,
      }
      await webhookApi.create(input)
      setShowCreateDialog(false)
      resetForm()
      await loadWebhooks()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create webhook')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateWebhook = async (): Promise<void> => {
    if (!editingWebhook || !formName.trim() || !formUrl.trim() || formEvents.length === 0) {
      return
    }

    setSubmitting(true)
    try {
      const input: Partial<WebhookInput> = {
        name: formName.trim(),
        url: formUrl.trim(),
        secret: formSecret.trim() || null,
        events: formEvents,
        enabled: formEnabled,
      }
      await webhookApi.update(editingWebhook.id, input)
      setEditingWebhook(null)
      resetForm()
      await loadWebhooks()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update webhook')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteWebhook = async (): Promise<void> => {
    if (!deletingWebhook) return

    setSubmitting(true)
    try {
      await webhookApi.delete(deletingWebhook.id)
      setDeletingWebhook(null)
      await loadWebhooks()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete webhook')
    } finally {
      setSubmitting(false)
    }
  }

  const handleTestWebhook = async (webhookId: string): Promise<void> => {
    setTestingWebhook(webhookId)
    setTestResult(null)
    try {
      const result = await webhookApi.test(webhookId)
      setTestResult(result)
    } catch (err) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : 'Test failed',
      })
    } finally {
      setTestingWebhook(null)
    }
  }

  const handleToggleEnabled = async (webhook: Webhook): Promise<void> => {
    try {
      await webhookApi.update(webhook.id, { enabled: webhook.enabled !== 1 })
      await loadWebhooks()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle webhook')
    }
  }

  const toggleEvent = (event: WebhookEventType): void => {
    setFormEvents((prev) =>
      prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event]
    )
  }

  const parseEvents = (eventsJson: string): WebhookEventType[] => {
    try {
      return JSON.parse(eventsJson) as WebhookEventType[]
    } catch {
      return []
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

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold">Webhooks</h2>
          <p className="text-muted-foreground mt-1">
            Configure HTTP notifications for events
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => void loadWebhooks()}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Webhook
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-3 rounded-lg mb-6">
          {error}
          <button
            type="button"
            onClick={() => setError('')}
            className="ml-2 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Test Result Toast */}
      {testResult && (
        <div
          className={`mb-6 px-4 py-3 rounded-lg flex items-center gap-2 ${
            testResult.success
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          }`}
        >
          {testResult.success ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <XCircle className="h-5 w-5" />
          )}
          {testResult.message}
          <button
            type="button"
            onClick={() => setTestResult(null)}
            className="ml-auto underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty State */}
      {!loading && webhooks.length === 0 && (
        <div className="text-center py-12">
          <Bell className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No webhooks configured</h3>
          <p className="text-muted-foreground mb-4">
            Add a webhook to receive notifications when events occur
          </p>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add Your First Webhook
          </Button>
        </div>
      )}

      {/* Webhook List */}
      {!loading && webhooks.length > 0 && (
        <div className="space-y-4">
          {webhooks.map((webhook) => {
            const events = parseEvents(webhook.events)
            return (
              <Card key={webhook.id} className={webhook.enabled === 0 ? 'opacity-60' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Bell className={`h-5 w-5 ${webhook.enabled === 1 ? 'text-primary' : 'text-muted-foreground'}`} />
                      <div>
                        <CardTitle className="text-base flex items-center gap-2">
                          {webhook.name}
                          {webhook.secret && (
                            <span title="HMAC signature enabled">
                              <Shield className="h-4 w-4 text-green-500" />
                            </span>
                          )}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1">
                          <Link className="h-3 w-3" />
                          <span className="font-mono text-xs truncate max-w-[300px]">
                            {webhook.url}
                          </span>
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          webhook.enabled === 1
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
                        }`}
                      >
                        {webhook.enabled === 1 ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {events.map((event) => (
                      <span
                        key={event}
                        className="text-xs px-2 py-1 rounded bg-muted"
                      >
                        {WEBHOOK_EVENT_LABELS[event]}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Updated: {formatDate(webhook.updated_at)}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleTestWebhook(webhook.id)}
                        disabled={testingWebhook === webhook.id}
                      >
                        {testingWebhook === webhook.id ? (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4 mr-1" />
                        )}
                        Test
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleToggleEnabled(webhook)}
                      >
                        {webhook.enabled === 1 ? 'Disable' : 'Enable'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditDialog(webhook)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeletingWebhook(webhook)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog
        open={showCreateDialog || editingWebhook !== null}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false)
            setEditingWebhook(null)
            resetForm()
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingWebhook ? 'Edit Webhook' : 'Add Webhook'}
            </DialogTitle>
            <DialogDescription>
              Configure a webhook endpoint to receive event notifications
            </DialogDescription>
          </DialogHeader>
          <form
            id="webhook-form"
            onSubmit={(e) => {
              e.preventDefault()
              void (editingWebhook ? handleUpdateWebhook() : handleCreateWebhook())
            }}
            className="space-y-4 py-4"
            autoComplete="off"
          >
            <div className="space-y-2">
              <Label htmlFor="webhook-name">Name</Label>
              <Input
                id="webhook-name"
                name="webhook-name"
                placeholder="My Webhook"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhook-url">URL</Label>
              <Input
                id="webhook-url"
                name="webhook-url"
                type="url"
                placeholder="https://example.com/webhook"
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhook-secret">Secret (optional)</Label>
              <Input
                id="webhook-secret"
                name="webhook-secret"
                type="password"
                placeholder="For HMAC signature verification"
                value={formSecret}
                onChange={(e) => setFormSecret(e.target.value)}
                autoComplete="new-password"
              />
              <p className="text-xs text-muted-foreground">
                If set, requests will include an X-Webhook-Signature header
              </p>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium leading-none">Events</legend>
              <div className="grid grid-cols-2 gap-2">
                {ALL_WEBHOOK_EVENTS.map((event) => (
                  <div key={event} className="flex items-center space-x-2">
                    <Checkbox
                      id={`event-${event}`}
                      name={`event-${event}`}
                      checked={formEvents.includes(event)}
                      onCheckedChange={() => toggleEvent(event)}
                    />
                    <Label
                      htmlFor={`event-${event}`}
                      className="text-sm font-normal cursor-pointer"
                    >
                      {WEBHOOK_EVENT_LABELS[event]}
                    </Label>
                  </div>
                ))}
              </div>
            </fieldset>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="webhook-enabled"
                name="webhook-enabled"
                checked={formEnabled}
                onCheckedChange={(checked) => setFormEnabled(checked === true)}
              />
              <Label htmlFor="webhook-enabled" className="cursor-pointer">
                Enabled
              </Label>
            </div>
          </form>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false)
                setEditingWebhook(null)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="webhook-form"
              disabled={submitting || !formName.trim() || !formUrl.trim() || formEvents.length === 0}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingWebhook ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deletingWebhook !== null} onOpenChange={() => setDeletingWebhook(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Webhook</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingWebhook?.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingWebhook(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleDeleteWebhook()}
              disabled={submitting}
            >
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

