import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { StatusBadge } from '../components/features/status-badge';
import { useCreateAttack, useCreateCampaign } from '../hooks/use-campaigns';
import { ApiError } from '../lib/api';
import { useCampaignWizard } from '../stores/campaign-wizard';
import { useUiStore } from '../stores/ui';

const STEPS = ['Basic Info', 'Attacks', 'Review'];

const basicInfoSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().max(2000).optional(),
  priority: z.coerce.number().int().min(1).max(10),
  hashListId: z.coerce.number().int().positive('Hash list is required'),
});

type BasicInfoForm = z.infer<typeof basicInfoSchema>;

const attackSchema = z.object({
  mode: z.coerce.number().int().nonnegative('Mode is required'),
  wordlistId: z.coerce.number().int().positive().optional(),
  rulelistId: z.coerce.number().int().positive().optional(),
  masklistId: z.coerce.number().int().positive().optional(),
});

type AttackForm = z.infer<typeof attackSchema>;

export function CampaignCreatePage() {
  const { selectedProjectId } = useUiStore();
  const wizard = useCampaignWizard();
  const navigate = useNavigate();
  const createCampaign = useCreateCampaign();
  const [createdCampaignId, setCreatedCampaignId] = useState<number | null>(null);
  const createAttack = useCreateAttack(createdCampaignId ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset wizard state on unmount only
  useEffect(() => {
    return () => wizard.reset();
  }, []);

  const basicInfoForm = useForm<BasicInfoForm>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      name: wizard.name,
      priority: wizard.priority,
      ...(wizard.description ? { description: wizard.description } : {}),
      ...(wizard.hashListId ? { hashListId: wizard.hashListId } : {}),
    },
  });

  const attackForm = useForm<AttackForm>({
    resolver: zodResolver(attackSchema),
  });

  if (!selectedProjectId) {
    return <p className="text-muted-foreground">Select a project first.</p>;
  }

  const onBasicInfoSubmit = basicInfoForm.handleSubmit((data) => {
    wizard.setBasicInfo({
      name: data.name,
      description: data.description ?? '',
      priority: data.priority,
    });
    wizard.setHashListId(data.hashListId);
    wizard.setStep(1);
  });

  const handleAddAttack = (data: AttackForm) => {
    wizard.addAttack({
      mode: data.mode,
      ...(data.wordlistId ? { wordlistId: data.wordlistId } : {}),
      ...(data.rulelistId ? { rulelistId: data.rulelistId } : {}),
      ...(data.masklistId ? { masklistId: data.masklistId } : {}),
      dependencies: [],
    });
    attackForm.reset();
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await createCampaign.mutateAsync({
        projectId: selectedProjectId,
        name: wizard.name,
        hashListId: wizard.hashListId ?? 0,
        priority: wizard.priority,
        ...(wizard.description ? { description: wizard.description } : {}),
      });

      const campaignId = result.campaign.id;
      setCreatedCampaignId(campaignId);

      // Create attacks sequentially to maintain order
      for (const attack of wizard.attacks) {
        await createAttack.mutateAsync({
          ...attack,
          ...(attack.dependencies.length > 0 ? { dependencies: attack.dependencies } : {}),
        });
      }

      wizard.reset();
      navigate(`/campaigns/${campaignId}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('Failed to create campaign');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Create Campaign</h2>

      {/* Step indicator */}
      <div className="flex gap-2">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              if (i < wizard.step) wizard.setStep(i);
            }}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              i === wizard.step
                ? 'bg-primary text-primary-foreground'
                : i < wizard.step
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-muted text-muted-foreground'
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {/* Step 0: Basic Info */}
      {wizard.step === 0 && (
        <form onSubmit={onBasicInfoSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="text-sm font-medium">
              Campaign Name
            </label>
            <input
              id="name"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              {...basicInfoForm.register('name')}
            />
            {basicInfoForm.formState.errors.name && (
              <p className="mt-1 text-xs text-destructive">
                {basicInfoForm.formState.errors.name.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="description" className="text-sm font-medium">
              Description
            </label>
            <textarea
              id="description"
              rows={3}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              {...basicInfoForm.register('description')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="priority" className="text-sm font-medium">
                Priority (1-10)
              </label>
              <input
                id="priority"
                type="number"
                min={1}
                max={10}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                {...basicInfoForm.register('priority')}
              />
            </div>
            <div>
              <label htmlFor="hashListId" className="text-sm font-medium">
                Hash List ID
              </label>
              <input
                id="hashListId"
                type="number"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                {...basicInfoForm.register('hashListId')}
              />
              {basicInfoForm.formState.errors.hashListId && (
                <p className="mt-1 text-xs text-destructive">
                  {basicInfoForm.formState.errors.hashListId.message}
                </p>
              )}
            </div>
          </div>

          <button
            type="submit"
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Next: Configure Attacks
          </button>
        </form>
      )}

      {/* Step 1: Attacks */}
      {wizard.step === 1 && (
        <div className="space-y-4">
          <form onSubmit={attackForm.handleSubmit(handleAddAttack)} className="space-y-3">
            <h3 className="font-medium">Add Attack</h3>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <div>
                <label htmlFor="mode" className="text-xs font-medium">
                  Hashcat Mode
                </label>
                <input
                  id="mode"
                  type="number"
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  {...attackForm.register('mode')}
                />
              </div>
              <div>
                <label htmlFor="wordlistId" className="text-xs font-medium">
                  Wordlist ID
                </label>
                <input
                  id="wordlistId"
                  type="number"
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  {...attackForm.register('wordlistId')}
                />
              </div>
              <div>
                <label htmlFor="rulelistId" className="text-xs font-medium">
                  Rulelist ID
                </label>
                <input
                  id="rulelistId"
                  type="number"
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  {...attackForm.register('rulelistId')}
                />
              </div>
              <div>
                <label htmlFor="masklistId" className="text-xs font-medium">
                  Masklist ID
                </label>
                <input
                  id="masklistId"
                  type="number"
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                  {...attackForm.register('masklistId')}
                />
              </div>
            </div>
            <button type="submit" className="rounded-md border px-3 py-1.5 text-sm hover:bg-accent">
              Add Attack
            </button>
          </form>

          {wizard.attacks.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-medium">Configured Attacks</h3>
              {wizard.attacks.map((attack, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: attacks have no stable ID before creation
                <div key={i} className="flex items-center justify-between rounded-md border p-3">
                  <div className="text-sm">
                    <span className="font-medium">Mode {attack.mode}</span>
                    {attack.wordlistId && (
                      <span className="ml-2 text-muted-foreground">
                        Wordlist #{attack.wordlistId}
                      </span>
                    )}
                    {attack.rulelistId && (
                      <span className="ml-2 text-muted-foreground">
                        Rulelist #{attack.rulelistId}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => wizard.removeAttack(i)}
                    className="text-xs text-destructive hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => wizard.setStep(0)}
              className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => wizard.setStep(2)}
              disabled={wizard.attacks.length === 0}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Next: Review
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Review & Submit */}
      {wizard.step === 2 && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <h3 className="mb-3 font-medium">Campaign Summary</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Name</dt>
                <dd>{wizard.name}</dd>
              </div>
              {wizard.description && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Description</dt>
                  <dd className="max-w-xs truncate">{wizard.description}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Priority</dt>
                <dd>{wizard.priority}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Hash List</dt>
                <dd>#{wizard.hashListId}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Attacks</dt>
                <dd>
                  <StatusBadge status={`${wizard.attacks.length} configured`} />
                </dd>
              </div>
            </dl>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => wizard.setStep(1)}
              className="rounded-md border px-4 py-2 text-sm hover:bg-accent"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
