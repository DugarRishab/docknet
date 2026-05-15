import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
// import {
//   ToggleGroup,
//   ToggleGroupItem,
// } from '@/components/ui/toggle-group';
import { Spinner } from '@/components/ui/spinner';
import { useMutation } from '@tanstack/react-query';
import { startSimulation } from '@/hooks/useTangleData';
import { useAddQueueItem } from '@/hooks/useSimulationQueue';
import {
  fieldConfigs,
  presets,
  validateField,
  hasErrors as hasValidationErrors,
  estimateDuration,
  formatDurationSeconds,
  type SimulationFormData,
  type ValidationErrors,
} from '@/lib/simulationParams';
import { getFieldIcon } from '@/components/common/fieldIcons';
import { Play, Calculator, Plus, AlertCircle } from 'lucide-react';

interface StartSimulationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// const presetKeys = Object.keys(presets) as (keyof typeof presets)[];

export function StartSimulationDialog({
  open,
  onOpenChange,
}: StartSimulationDialogProps) {
  const navigate = useNavigate();
  // const [activePreset, setActivePreset] = useState<keyof typeof presets>(
  //   'medium'
  // );
  const [formData, setFormData] = useState<SimulationFormData & { label?: string }>(
    {
      ...presets.medium,
      label: '',
    }
  );
  const [touched, setTouched] = useState<
    Partial<Record<keyof SimulationFormData, boolean>>
  >({});

  const startMutation = useMutation({
    mutationFn: startSimulation,
    onSuccess: (data) => {
      if (data?.data?.runId) {
        onOpenChange(false);
        navigate(`/run/${data.data.runId}`);
      }
    },
  });

  const addQueueItem = useAddQueueItem();

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

  // const handlePreset = (name: string) => {
  //   if (!name) return;
  //   const key = name as keyof typeof presets;
  //   if (!presets[key]) return;
  //   setActivePreset(key);
  //   setFormData({ ...presets[key], label: formData.label });
  //   setTouched({});
  // };

  const handleStartSimulation = () => {
    if (formHasErrors) return;
    startMutation.mutate({
      label: formData.label || undefined,
      ...formData,
    });
  };

  const handleAddToQueue = () => {
    if (formHasErrors) return;

    addQueueItem.mutate({
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
    });

    setFormData({
      ...presets.medium,
      label: '',
    });
    setTouched({});
    // setActivePreset('medium');
    onOpenChange(false);
  };

  const error = startMutation.error || addQueueItem.error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Play className="size-4" />
            Start New Simulation
          </DialogTitle>
          <DialogDescription>
            Configure parameters for your Tangle-SG simulation run.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={(e) => { e.preventDefault(); handleStartSimulation(); }}
          className="flex flex-col gap-6"
        >
          {/* <Field>
            <FieldLabel>Preset</FieldLabel>
            <ToggleGroup
              type="single"
              value={activePreset}
              onValueChange={handlePreset}
              variant="outline"
              size="sm"
            >
              {presetKeys.map((key) => (
                <ToggleGroupItem
                  key={key}
                  value={key}
                  className="capitalize"
                >
                  {key}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <FieldDescription>
              Apply a quick configuration template, then fine-tune below.
            </FieldDescription>
          </Field> */}

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
            <Calculator />
            <AlertTitle>Estimated Duration</AlertTitle>
            <AlertDescription>
              {estimatedDurationSeconds > 0
                ? `Approximately ${formatDurationSeconds(
                    estimatedDurationSeconds
                  )} based on the current parameters.`
                : 'Calculating…'}
            </AlertDescription>
          </Alert>

          {error && (
            <Alert variant="destructive">
              <AlertCircle />
              <AlertTitle>
                {startMutation.error
                  ? 'Failed to start simulation'
                  : 'Failed to add to queue'}
              </AlertTitle>
              <AlertDescription>
                {error instanceof Error ? error.message : 'Unknown error'}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={addQueueItem.isPending || formHasErrors}
              onClick={handleAddToQueue}
            >
              {addQueueItem.isPending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Adding…
                </>
              ) : (
                <>
                  <Plus data-icon="inline-start" />
                  Add to Queue
                </>
              )}
            </Button>
            <Button
              type="submit"
              disabled={startMutation.isPending || formHasErrors}
            >
              {startMutation.isPending ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Starting…
                </>
              ) : (
                <>
                  <Play data-icon="inline-start" />
                  Start Now
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
