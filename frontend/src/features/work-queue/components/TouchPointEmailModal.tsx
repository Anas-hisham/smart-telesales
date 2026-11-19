import { Check, Copy, Mail, XCircle } from "lucide-react";
import { useState } from "react";
import type { Lead } from "@/features/leads/types/leads.types";
import type { QueueCategory } from "@/features/leads/utils/callClassification";
import type { EmailTemplate } from "@/features/work-queue/types/workQueue.types";

/**
 * An e-mail step. The system does not send e-mails: the agent writes / copies the message here, sends it from his own mailbox,
 * then marks the step as done (the server records the completed step in the lead's history).
 */
export function TouchPointEmailModal({
  lead,
  category,
  templates,
  onClose,
  onDone,
}: {
  lead: Lead;
  category: QueueCategory;
  templates: EmailTemplate[];
  onClose: () => void;
  onDone: () => void;
}) {
  // Writing the email by hand is the main way; a template is only an optional starting point.
  const suggestedType =
    lead.templateType ?? (lead.discoveryReached ? "discovery" : "no_response");
  const [templateType, setTemplateType] = useState<
    "discovery" | "no_response" | "custom"
  >("custom");
  const [to, setTo] = useState(lead.email || "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [copied, setCopied] = useState(false);

  const fillPlaceholders = (text: string) =>
    text
      .replaceAll("[Name]", lead.contactName)
      .replaceAll("[Company Name]", lead.companyName);

  const applyTemplate = (type: "discovery" | "no_response" | "custom") => {
    setTemplateType(type);
    const emailTemplate = templates.find((template) => template.type === type);
    if (type !== "custom" && emailTemplate) {
      setSubject(fillPlaceholders(emailTemplate.subject));
      setBody(fillPlaceholders(emailTemplate.body));
    }
  };

  const copyEmailToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(
        `To: ${to}\nSubject: ${subject}\n\n${body}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked: the text can still be selected by hand */
    }
  };
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 animate-slide-up max-h-[92vh] max-h-[92dvh] overflow-y-auto scrollbar-thin">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <h2 className="text-lg font-bold text-slate-900">E-mail step</h2>
            <p className="text-sm text-slate-600">
              {lead.companyName} — {lead.contactName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center"
            aria-label="Close"
          >
            <XCircle className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        <div className="px-4 sm:px-6 py-5 space-y-4">
          <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2">
            Prepare the message, send it from your own mailbox, then mark the
            step as done.
          </p>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500">Start from:</span>
          {(
  [
    ["custom", "Blank"],
    ["no_response", "No Response Email"],
    ["discovery", "Discovery Email"],
  ] as const
).map(([value, label]) => (
  <button
    key={value}
    type="button"
    onClick={() => applyTemplate(value)}
    className={`px-2.5 py-1 rounded-full font-medium transition-all ${
      templateType === value
        ? "bg-violet-600 text-white"
        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
    }`}
  >
    {label}
    {value === suggestedType && " ★ Suggested"}
  </button>
))}
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              To
            </label>
            <input
              type="email"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder="recipient@example.com"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Message
            </label>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={8}
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 focus:border-transparent resize-none font-mono"
            />
          </div>
        </div>

        <div className="px-4 sm:px-6 py-4 border-t border-slate-100 flex flex-wrap justify-end gap-2 sticky bottom-0 bg-white">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={copyEmailToClipboard}
            className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 flex items-center gap-1.5"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}{" "}
            {copied ? "Copied" : "Copy"}
          </button>
          <a
            href={mailto}
            className="px-3 py-2 rounded-lg text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 flex items-center gap-1.5"
          >
            <Mail className="w-3.5 h-3.5" /> Open mail app
          </a>
          <button
            onClick={onDone}
            className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-violet-600 hover:bg-violet-700 transition-all flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" /> Mark step done
          </button>
        </div>
      </div>
    </div>
  );
}
