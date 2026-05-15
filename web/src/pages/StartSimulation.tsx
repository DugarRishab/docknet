import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
} from '@/components/ui/field';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group';
import { Spinner } from '@/components/ui/spinner';
import { useMutation } from '@tanstack/react-query';
import { startSimulation } from '@/hooks/useTangleData';
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
import { Play, Calculator, AlertCircle } from 'lucide-react';

const presetKeys = Object.keys(presets) as (keyof typeof presets)[];

export function StartSimulation() {
  const navigate = useNavigate();
  const [activePreset, setActivePreset] = useState<keyof typeof presets>(
    'medium'
  );
  const [formData, setFormData] = useState<SimulationFormData>(presets.medium);
  const [touched, setTouched] = useState<
    Partial<Record<keyof SimulationFormData, boolean>>
  >({});

  const startMutation = useMutation({
    mutationFn: startSimulation,
    onSuccess: (data) => {
      if (data?.data?.runId) {
        navigate(`/run/${data.data.runId}`);
      }
    },
  });

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

  const handlePreset = (name: string) => {
    if (!name) return;
    const key = name as keyof typeof presets;
    if (!presets[key]) return;
    setActivePreset(key);
    setFormData(presets[key]);
    setTouched({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formHasErrors) return;
    startMutation.mutate(formData);
  };

  return (
    <div className="flex h-full flex-col items-center justify-center overflow-auto">
      <Card className="w-full max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="size-4" />
            Start New Simulation
          </CardTitle>
          <CardDescription>
            Configure parameters for your Tangle-SG simulation run.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="flex flex-col gap-6">
            <Field>
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

            {startMutation.error && (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>Failed to start simulation</AlertTitle>
                <AlertDescription>
                  {startMutation.error instanceof Error
                    ? startMutation.error.message
                    : 'Unknown error'}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>

          <CardFooter className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => navigate('/')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
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
                  Start Simulation
                </>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}

export default StartSimulation;
