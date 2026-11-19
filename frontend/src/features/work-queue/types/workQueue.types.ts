/** The e-mail templates an agent starts an e-mail step from. */
/** Email templates and the log of every email sent. */
export interface EmailTemplate {
  id: string;
  name: string;
  type: 'discovery' | 'no_response';
  subject: string;
  body: string;
}
