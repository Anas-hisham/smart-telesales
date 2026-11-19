import type { ApiLead, ApiLeadDetail, Lead } from '@/features/leads/types/leads.types';

/**
 * Server lead -> the Lead the UI uses.
 * The lists do not carry call logs / history: they stay as they were (empty until GET /leads/:id is loaded).
 */
export function leadFromApi(apiLead: ApiLead | ApiLeadDetail, prev?: Lead): Lead {
  const full = 'callLogs' in apiLead;
  const { upcomingMeeting: _upcomingMeeting, ...rest } = apiLead as ApiLeadDetail;
  return {
    ...rest,
    agentId: apiLead.agentId ?? '',
    callLogs: full ? (apiLead as ApiLeadDetail).callLogs : prev?.callLogs ?? [],
    history: full ? (apiLead as ApiLeadDetail).history : prev?.history ?? [],
    previousAssignments: full ? (apiLead as ApiLeadDetail).previousAssignments : prev?.previousAssignments,
    detailLoaded: full ? true : prev?.detailLoaded,
  } as Lead;
}
