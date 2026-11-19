import type { EmailTemplate } from '@/features/work-queue/types/workQueue.types';

/** The two e-mail templates the agent copies from when an e-mail step is due (the server only records the step as done). */
export const EMAIL_TEMPLATES: EmailTemplate[] = [
  { id: 'et-1', name: 'Discovery Follow-up', type: 'discovery', subject: 'Following up on our conversation', body: 'Dear [Name],\n\nThank you for your interest in our services. Following up on our recent conversation, I have attached additional details about our activation plan.\n\nBest regards,\n[Agent Name]' },
  { id: 'et-2', name: 'No Response Follow-up', type: 'no_response', subject: 'Reaching out - [Company Name]', body: 'Dear [Name],\n\nI hope this email finds you well. I tried reaching you recently regarding our services. I would love to connect at your convenience.\n\nBest regards,\n[Agent Name]' },
];
