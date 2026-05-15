import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
} from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';
import { useUpdateQueueItem, type QueueItem } from '@/hooks/useSimulationQueue';
import {
  fieldConfigs,
  validateField,
  hasErrors as hasValidationErrors,
  estimateDuration,
  formatDurationSeconds,
  type SimulationFormData,
  type ValidationErrors,
} from '@/lib/simulationParams';
import { getFieldIcon } from '@/components/common/fieldIcons';
import { Save, AlertCircle, Clock } from 'lucide-react';

interface EditQueueItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: QueueItem | null;
}

export function EditQueueItemDialog({
  open,
  onOpenChange,
  item,
}: EditQueueItemDialogProps) {
  const [formData, setFormData] = useState<SimulationFormData & { label?: string }>({
    node_count: 5,
    tx_count: 10,
    tx_delay: 10,
    max_peers: 5,
    wait: 120,
    orphan_ttl: 600,
    orphan_pool_max: 1000,
    rate_limit_base: 10,
    rate_limit_burst: 20,
    rate_limit_window_sec: 60,
    monitor_period: 5,
    label: '',
  });
  const [touched, setTouched] = useState<
    Partial<Record<keyof SimulationFormData, boolean>>
  >({});

  const updateQueueItem = useUpdateQueueItem();

  // Populate form when item changes
  useEffect(() => {
    if (item) {
      setFormData({
        node_count: item.node_count,
        tx_count: item.tx_count,
        tx_delay: item.tx_delay,
        max_peers: item.max_peers,
        wait: item.wait,
        orphan_ttl: item.orphan_ttl,
        orphan_pool_max: item.orphan_pool_max,
        rate_limit_base: item.rate_limit_base,
        rate_limit_burst: item.rate_limit_burst,
        rate_limit_window_sec: item.rate_limit_window_sec,
        monitor_period: item.monitor_period,
        label: item.label || '',
      });
      setTouched({});
    }
  }, [item, open]);

  const errors = useMemo<ValidationErrors>(() => {
    const result: ValidationErrors = {};
    for (const config of fieldConfigs) {
      const error = validateField(config.key, formData[config.key]);
      if (error) result[config.key] = error;
    }
    return result;
  }, [formData]);

  const formHasErrors = hasValidationErrors(errors);
  const estimatedDurationSeconds = useMemo(
    () => estimateDuration(formData),
    [formData]
  );

  const handleInputChange = (
    field: keyof SimulationFormData,
    value: string
  ) => {
    const numValue = value === '' ? 0 : parseInt(value, 10);
    setFormData((prev) => ({
      ...prev,
      [field]: isNaN(numValue) ? 0 : numValue,
    }));
  };

  const handleBlur = (field: keyof SimulationFormData) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formHasErrors || !item) return;

    updateQueueItem.mutate(
      {
        id: item.id,
        label: formData.label || undefined,
        node_count: formData.node_count,
        tx_count: formData.tx_count,
        tx_delay: formData.tx_delay,
        max_peers: formData.max_peers,
        wait: formData.wait,
        orphan_ttl: formData.orphan_ttl,
        orphan_pool_max: formData.orphan_pool_max,
        rate_limit_base: formData.rate_limit_base,
        rate_limit_burst: formData.rate_limit_burst,
        rate_limit_window_sec: formData.rate_limit_window_sec,
        monitor_period: formData.monitor_period,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  if (!item) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="size-4" />
            Edit Queue Item #{item.id}
          </DialogTitle>
          <DialogDescription>
            Modify the simulation parameters for this pending queue item.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <Field>
            <FieldLabel htmlFor="label">Label (optional)</FieldLabel>
            <Input
              id="label"
              type="text"
              placeholder="e.g., Stress test with 50 nodes"
              value={formData.label || ''}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  label: e.target.value,
                }))
              }
            />
            <FieldDescription>
              A friendly name to identify this queue item.
            </FieldDescription>
          </Field>

          <FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {fieldConfigs.map((config) => {
              const fieldError = touched[config.key]
                ? errors[config.key]
                : undefined;
              const Icon = getFieldIcon(config.iconName);

              return (
                <Field
                  key={config.key}
                  data-invalid={!!fieldError || undefined}
                >
                  <FieldLabel
                    htmlFor={config.key}
                    className="flex items-center gap-2"
                  >
                    <Icon className="size-3.5 text-muted-foreground" />
                    {config.label}
                    {config.unit && (
                      <span className="text-muted-foreground">
                        ({config.unit})
                      </span>
                    )}
                  </FieldLabel>
                  <Input
                    id={config.key}
                    type="number"
                    min={config.min}
                    max={config.max}
                    value={formData[config.key]}
                    onChange={(e) =>
                      handleInputChange(config.key, e.target.value)
                    }
                    onBlur={() => handleBlur(config.key)}
                    aria-invalid={!!fieldError || undefined}
                  />
                  <FieldDescription>{config.description}</FieldDescription>
                  {fieldError && <FieldError>{fieldError}</FieldError>}
                </Field>
              );
            })}
          </FieldGroup>

          <Alert>
            <Clock />
            <AlertTitle>Estimated Duration</AlertTitle>
            <AlertDescription>
              {estimatedDurationSeconds > 0
                ? `Approximately ${formatDurationSeconds(
                    estimatedDurationSeconds
                  )} based on the current parameters.`
                : 'Calculating…'}
            </AlertDescription>
          </Alert>

          {updateQueueItem.error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>Failed to update queue item</AlertTitle>
              <AlertDescription>
                {updateQueueItem.error instanceof Error
                  ? updateQueueItem.error.message
                  : 'Unknown error'}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={updateQueueItem.isPending || formHasErrors}
            >
              {updateQueueItem.isPending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Saving…
                </>
              ) : (
                <>
                  <Save data-icon="inline-start" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
