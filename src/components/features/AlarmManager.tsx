import { useState, useEffect, useCallback } from "react";
import { Bell, BellOff, Clock, Loader2, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { alarmApi, type AlarmResponse } from "../../services/alarmApi";

interface AlarmManagerProps {
  instanceId: string;
  instanceName: string | null;
  /** Called when an alarm is set or deleted, allowing parent to refresh instance data */
  onAlarmChange?: () => void;
}

export function AlarmManager({
  instanceId,
  instanceName,
  onAlarmChange,
}: AlarmManagerProps): React.ReactElement {
  const [alarm, setAlarm] = useState<AlarmResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [showSetDialog, setShowSetDialog] = useState(false);

  const loadAlarm = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError("");
      const data = await alarmApi.get(instanceId);
      setAlarm(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load alarm");
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  const handleDeleteAlarm = async (): Promise<void> => {
    if (!confirm("Delete the current alarm?")) {
      return;
    }
    try {
      await alarmApi.delete(instanceId);
      await loadAlarm();
      onAlarmChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete alarm");
    }
  };

  useEffect(() => {
    void loadAlarm();
  }, [loadAlarm]);

  const formatAlarmTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getTimeUntilAlarm = (timestamp: number): string => {
    const now = Date.now();
    const diff = timestamp - now;

    if (diff <= 0) return "Overdue";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${String(days)} day${days > 1 ? "s" : ""}`;
    }
    if (hours > 0) {
      return `${String(hours)}h ${String(minutes)}m`;
    }
    return `${String(minutes)} min`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {alarm?.hasAlarm ? (
              <Bell className="h-5 w-5 text-yellow-500" />
            ) : (
              <BellOff className="h-5 w-5 text-muted-foreground" />
            )}
            <CardTitle className="text-base">Alarm</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSetDialog(true)}
            disabled={loading || alarm?.admin_hook_required}
          >
            <Clock className="h-4 w-4 mr-2" />
            {alarm?.hasAlarm ? "Change" : "Set"}
          </Button>
        </div>
        <CardDescription>
          Schedule the DO to wake up at a future time
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="text-sm text-destructive">{error}</div>
        ) : alarm?.warning ? (
          <div className="text-sm text-yellow-600 dark:text-yellow-400">
            <p className="font-medium">⚠️ Admin Hook Required</p>
            <p className="mt-1">{alarm.warning}</p>
          </div>
        ) : alarm?.error ? (
          <div className="text-sm text-destructive">
            <p className="font-medium">Admin Hook Error</p>
            <p className="mt-1">{alarm.error}</p>
            {alarm.details && (
              <pre className="text-xs mt-2 p-2 bg-black/10 rounded overflow-auto">
                {alarm.details}
              </pre>
            )}
          </div>
        ) : alarm?.hasAlarm && alarm.alarm ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Scheduled:</span>
              <span className="text-sm font-medium">
                {formatAlarmTime(alarm.alarm)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Time until:</span>
              <span className="text-sm font-medium">
                {getTimeUntilAlarm(alarm.alarm)}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2"
              onClick={() => void handleDeleteAlarm()}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Alarm
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No alarm set</p>
        )}
      </CardContent>

      {/* Set Alarm Dialog */}
      <SetAlarmDialog
        open={showSetDialog}
        onOpenChange={setShowSetDialog}
        instanceId={instanceId}
        instanceName={instanceName}
        onComplete={() => {
          setShowSetDialog(false);
          void loadAlarm();
          onAlarmChange?.();
        }}
      />
    </Card>
  );
}

interface SetAlarmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  instanceName: string | null;
  onComplete: () => void;
}

function SetAlarmDialog({
  open,
  onOpenChange,
  instanceId,
  instanceName,
  onComplete,
}: SetAlarmDialogProps): React.ReactElement {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Initialize with current date/time + 1 hour
  useEffect(() => {
    if (open) {
      const future = new Date(Date.now() + 3600000);
      setDate(future.toISOString().split("T")[0] ?? "");
      setTime(future.toTimeString().slice(0, 5));
      setError("");
    }
  }, [open]);

  const handleSubmit = async (): Promise<void> => {
    if (!date || !time) {
      setError("Date and time are required");
      return;
    }

    const timestamp = new Date(`${date}T${time}`).getTime();
    if (timestamp <= Date.now()) {
      setError("Alarm must be set in the future");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await alarmApi.set(instanceId, timestamp);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set alarm");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Set Alarm</DialogTitle>
          <DialogDescription>
            Schedule an alarm for {instanceName ?? "this instance"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          {error && (
            <div className="bg-destructive/10 border border-destructive text-destructive px-3 py-2 rounded text-sm">
              {error}
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="time">Time</Label>
            <Input
              id="time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">
              The alarm will trigger the{" "}
              <code className="text-xs">alarm()</code> handler method in your
              Durable Object at the scheduled time.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Set Alarm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
