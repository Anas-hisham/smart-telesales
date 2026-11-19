import { campaignsApi } from '@/features/campaigns/api/campaigns.api';
import { setWorkflows } from '@/features/campaigns/slice/campaigns.slice';
import type { WorkflowDraft } from '@/features/campaigns/types/campaigns.types';
import { cleanCampaignCode } from '@/features/campaigns/utils/workflowDraft';
import { attempt } from '@/shared/api/attempt';
import type { AppThunk } from '@/store/types';

export const saveWorkflow = (workflowDraft: WorkflowDraft & { isNew?: boolean }): AppThunk<boolean> => async dispatch => {
  const code = cleanCampaignCode(workflowDraft.campaignCode);
  const body = { campaignCode: code, name: workflowDraft.name.trim(), steps: workflowDraft.steps.map(step => ({ type: step.type, label: step.label.trim(), gapDays: step.gapDays })) };
  const workflow = await attempt(() => (workflowDraft.isNew ? campaignsApi.create(body) : campaignsApi.update(code, body)));
  if (!workflow) return false;
  const workflows = await attempt(() => campaignsApi.list());
  if (workflows) dispatch(setWorkflows(workflows));
  return true;
};

export const deleteWorkflow = (code: string): AppThunk<boolean> => async dispatch => {
  const ok = await attempt(async () => { await campaignsApi.remove(code); return true; });
  if (ok) { const workflows = await attempt(() => campaignsApi.list()); if (workflows) dispatch(setWorkflows(workflows)); }
  return !!ok;
};
