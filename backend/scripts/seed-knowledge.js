// node scripts/seed-knowledge.js        -> (re)loads the Amazon Business knowledge below (safe to run many times)
// node scripts/seed-knowledge.js clean  -> removes it again
const { pool } = require('../src/config/db');

const PREFIX = 'AB - ';
const ITEMS = [
{ title: 'Overview, terms and selling rules', content: `
WHO WE ARE: a telesales team that helps businesses adopt Amazon Business features. Customers are business owners, office managers, procurement and finance people.

TERMS USED BY THE TEAM
- MUA = Multi-User Account: several people buy under ONE Amazon Business account.
- BP = Business Prime (Prime Business): a paid membership with shipping and buying-tool benefits for the whole account.
- ATEP = Amazon Tax Exemption Program: lets a tax-exempt organization buy without sales tax.
- Business Credit Account (BCA): invoice / pay-later option, previously called "Pay by Invoice" (renamed in 2026).

SELLING RULES (always follow)
- Never promise approval for Business Credit Account, extended terms, tax exemption, or a trial. These are "subject to Amazon's approval".
- Never quote a price, discount or credit limit from memory. Prices differ by country and change. Tell the customer the current price is shown on the official Amazon Business page during sign-up.
- Never pressure. Offer value, ask permission, agree on a clear next step.
- Do not claim benefits that are not listed in this knowledge. If unsure, say you will confirm and follow up.
- A good natural order for a new customer: free Amazon Business account -> MUA (team + approvals) -> Business Prime -> Business Credit Account -> ATEP if the organization is tax-exempt.
` },
{ title: 'MUA - Multi-User Account', content: `
WHAT IT IS: one Amazon Business account that many people in the company use, each with their own login, instead of sharing one password or using personal cards.

KEY BENEFITS
- No shared login credentials: every buyer has their own user.
- Groups: organize users by department, location, cost center or project, with different settings per group.
- Roles and permissions: admins control who can do what (for example only place orders, or also approve).
- Approval workflows: orders are sent to the right approver automatically. Up to six approval levels; rules can be based on spend amount, department, product category, or fields such as cost center or project code. Approval workflows have no extra cost.
- Shared payment methods and shipping addresses, per group or for the whole company.
- Spend visibility: one place to see what each team buys. Purchase order numbers, cost centers or project codes can be added to orders to make tracking and reconciliation easier.
- Buying policies: admins can set preferred products and restrict categories.
- Easy to set up: invite users by email (many at once), by invite link, or by uploading a spreadsheet.

TYPICAL PAIN POINTS IT SOLVES: employees buying with personal cards and claiming expenses, no visibility of who bought what, slow paper approvals, a single person (the admin) being a bottleneck.

GOOD DISCOVERY QUESTIONS: How many people place orders today? How do they pay? Who approves purchases and how (email, paper, verbally)? Do you track spend by department or project?
` },
{ title: 'BP - Business Prime (plans and benefits)', content: `
WHAT IT IS: a paid membership for an Amazon Business account. One membership covers every user on the account (no individual memberships needed). It is different from personal Amazon Prime. Plans and availability vary by country.

PLANS (each plan builds on the previous one, mainly by number of users)
- Duo: for sole proprietors / single user. Free for people who already have a personal Amazon Prime membership. Fast free shipping on eligible items, convenient business shipping options, free survey and analytics tools.
- Essentials: for very small teams (a few users). Everything in Duo plus Guided Buying and Spend Visibility.
- Small: up to 20 users. More access to Guided Buying and Spend Visibility.
- Medium: up to 200 users.
- Enterprise: unlimited users, the top benefits.

MAIN BENEFITS
- Fast, free shipping on eligible orders for everyone on the account, plus consolidated delivery options.
- Guided Buying: steer buyers toward preferred and policy-compliant choices (stronger on larger plans).
- Spend Visibility: dashboards and analytics of company spending.
- Business Credit Account extended payment terms: eligible Small and Medium plans may qualify for 45-day terms and Enterprise for 60-day terms, upon approval.
- In the US, Duo / Essentials / Small members can also earn Prime Business Rewards on eligible orders.
- Member-only offers from partners.

HOW TO PRESENT IT: connect it to the customer's order volume. If they already pay for shipping or have several buyers, the shipping savings and visibility are the value. Many plans come with a free trial, but eligibility varies: say "you may qualify for a free trial" and never guarantee it. Never state a price; it is shown at sign-up.
` },
{ title: 'ATEP - Amazon Tax Exemption Program', content: `
WHAT IT IS: lets an eligible tax-exempt organization apply its exemption to eligible Amazon Business purchases so sales tax is not charged at checkout, without asking customer support for a tax refund after each order. Available for organizations in the US and Canada.

WHO IT IS FOR: organizations with a tax-exempt status such as non-profits / 501(c)(3), charities, libraries, schools, government bodies, some agricultural, manufacturing or resale cases. The supported exemption types can change, so the customer should confirm the type in their Business Settings.

HOW IT WORKS
- It is NOT set up automatically when an Amazon Business account is created: the organization must enroll.
- Enroll in Business Settings, section "Tax Exemptions & Licenses" (the ATEP page): choose the state(s), the type of exemption, and upload the exemption certificate or documents if requested. A general business license or ID is not accepted as proof.
- When first enrolled, every group is included by default. The admin can change which groups may buy tax-exempt, and buyers can remove tax exemption on a line item at checkout.
- It applies to items sold by Amazon and its affiliates and by participating third-party sellers. Items sold directly by Amazon are eligible. Some marketplace sellers do not participate, so search results can be filtered to show ATEP-eligible items only.
- A tax-exempt buying policy can block buyers from purchasing from sellers that do not participate.
- Partial exemptions are not supported by the program. Review exemption status regularly to keep it valid.

BENEFIT TO STATE: saves the tax on every eligible order and removes the manual refund process. Do not promise a specific amount saved.
` },
{ title: 'Business Credit Account (BCA, formerly Pay by Invoice)', content: `
WHAT IT IS: an invoice and "buy now, pay later" option for approved Amazon Business customers. It was called Pay by Invoice and was renamed Business Credit Account in 2026; existing settings and terms did not change.

KEY FACTS
- Invite-only: when a business account is created, Amazon automatically assesses it. If eligible, the account administrator receives an email invitation to activate it. Sales agents cannot guarantee or speed up approval.
- Standard payment terms are 30 days, with no upfront fees and no minimum spend requirement, and no interest or fees when paid on time. Credit limits and eligibility vary by account.
- Eligible Prime Business members on Small and Medium plans may apply for 45-day terms, and Enterprise for 60-day terms, upon approval.
- Consolidated invoices on a schedule the customer chooses; customizable invoice templates; invoices can go to several email addresses; helps match purchase orders with invoices (two- and three-way matching) and simplifies reconciliation for accounts payable.
- Once active, the admin can set it as the default payment method for groups, and buyers choose it at checkout.
- Works across items from Amazon and third-party sellers on Amazon Business.

WHO BENEFITS: companies that want better cash flow, one invoice instead of many card receipts, and a clean process for accounting.
HOW TO PRESENT IT: "If your account is eligible, you can get invoice terms so you pay 30 days after ordering." Always add that approval and limits are decided by Amazon.
` },
{ title: 'Objection handling', content: `
GENERAL METHOD: acknowledge, ask one clarifying question, answer using the facts in this knowledge, propose a small next step. Do not repeat an objection more than once; if the customer says no twice, thank them and offer to follow up later.

"It's too expensive" (Business Prime): Ask what they compare it to. Tie value to shipping they already pay, number of buyers, and visibility. Mention plans scale with users, Duo is free for existing Prime members, and a free trial may be available (not guaranteed). Never name a price from memory.

"We already have a purchasing system / procurement process": Do not attack it. Ask what works and what doesn't. Position Multi-User Account and approvals as something that can sit next to it: individual logins, approvals, and spend visibility.

"My employees buy with their own cards": that is exactly the case for MUA: company-controlled payment methods, approvals, no expense claims, and one view of spending.

"I don't want to deal with tax exemption paperwork": enrollment is done once, the documents are the exemption certificate, and afterwards eligible orders are tax-exempt automatically, so nobody has to request refunds per order.

"We don't need credit / we pay by card": Business Credit Account is optional. The value is cash flow (30 days), one consolidated invoice and easier accounting. Ask how long reconciling card receipts takes today.

"Will I definitely be approved?": Be honest: approval is by Amazon and not guaranteed; the account is assessed automatically and an invitation is emailed if eligible.

"I need to ask my manager / finance": Offer a short summary email, ask who decides, and suggest a call including that person. Agree on a date and time for the follow-up before ending the call.

"Send me an email": agree, confirm the right email, ask what they most want to see in it, and set a specific follow-up time.

"We buy from other suppliers": Amazon Business is an addition not a replacement: spot and recurring purchases with approvals and visibility. Ask which categories they buy most.

"Not now / bad timing": ask when is better, respect it, and reference what was discussed before so the customer does not have to repeat it.

"Is it secure / will everyone see everything?": roles and permissions control access, and each user has their own login instead of a shared password.
` },
{ title: 'Discovery and qualification questions', content: `
Ask only what the customer has not already answered in previous calls.

ACCOUNT BASICS: Do you already have an Amazon Business account? How many people order for the company? Who is the account admin?
MUA: How do your team members pay today? Who approves purchases and how? Do you track spend by department or project?
BP: How much do you order on Amazon each month, roughly? Do you pay for shipping often? Is there an existing Prime membership on a personal account?
ATEP: Is the organization tax-exempt? Which type (non-profit, school, government, other) and in which state? Do you have the exemption certificate ready?
BCA: How do you pay vendors today (card, invoice)? What payment terms do you usually need? Who handles accounts payable?
NEXT STEP: Who makes the final decision? What would you need to see to move forward? When is a good time to follow up?

QUALIFICATION SIGNALS: several buyers, frequent orders, purchases on personal cards, tax-exempt status, accounts-payable pain, interest in visibility or approvals.
` },
];

async function main() {
  await pool.query(`DELETE FROM ai_knowledge WHERE title LIKE '[تجريبي]%' OR title LIKE $1`, [`${PREFIX}%`]);
  if (process.argv[2] === 'clean') return console.log('Removed the knowledge items');
  const { rows: [admin] } = await pool.query(`SELECT id FROM users WHERE role='admin' AND active LIMIT 1`);
  for (const item of ITEMS) {
    await pool.query('INSERT INTO ai_knowledge (campaign_code, title, content, created_by) VALUES (NULL,$1,$2,$3)', [PREFIX + item.title, item.content.trim(), admin?.id || null]);
  }
  console.log(`Loaded ${ITEMS.length} Amazon Business knowledge items (general, all campaigns)`);
}
main().catch((error) => { console.error('FAILED:', error.message); process.exitCode = 1; }).finally(() => pool.end());
