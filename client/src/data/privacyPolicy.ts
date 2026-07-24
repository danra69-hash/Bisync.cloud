import { LEGAL_EFFECTIVE_DATE, LEGAL_PRODUCT, LEGAL_PROVIDER, type LegalSection } from './legalShared';

export const CURRENT_PRIVACY_POLICY_VERSION = '2026-07-24';

export const PRIVACY_POLICY_TITLE = `${LEGAL_PRODUCT} Privacy Policy`;

export const PRIVACY_POLICY_INTRO = [
  `This Privacy Policy explains how ${LEGAL_PROVIDER} (“Provider”, “we”, “us”, or “our”) collects, uses, discloses, and protects personal data in connection with the ${LEGAL_PRODUCT} software-as-a-service platform and related websites, applications, and support channels (the “Service”).`,
  'This Policy applies worldwide to visitors, account registrants, Authorized Users, and other individuals whose personal data we process as an independent controller (for example account administration and billing contacts). Where we process Customer Data on behalf of a customer organization, that organization is the controller and our Data Processing Addendum (“DPA”) applies to that processing.',
  `By using the Service or creating an account, you acknowledge this Privacy Policy. If you do not agree, do not use the Service. Effective date: ${LEGAL_EFFECTIVE_DATE}. Version ${CURRENT_PRIVACY_POLICY_VERSION}.`,
];

export const PRIVACY_POLICY_SECTIONS: LegalSection[] = [
  {
    id: 'who',
    heading: '1. Who we are',
    paragraphs: [
      `${LEGAL_PROVIDER} operates ${LEGAL_PRODUCT}. For privacy inquiries, contact us through the support channels published on the ${LEGAL_PRODUCT} website or in-product help.`,
      'Depending on your location and the nature of processing, we may act as a “controller”, “processor”, “business”, or equivalent role under applicable privacy laws (including GDPR, UK GDPR, PDPA, CCPA/CPRA, and similar frameworks).',
    ],
  },
  {
    id: 'collect',
    heading: '2. Personal data we collect',
    paragraphs: [
      'Account and identity data: name, email, phone number, preferred language, company affiliation, role, and authentication credentials (stored as secure hashes).',
      'Business and billing data: company details, location details, subscription/trial status, invoices, and payment-related metadata processed by payment providers.',
      'Usage and device data: log data, IP address, approximate location derived from IP, browser/device type, timestamps, and feature usage needed to operate, secure, and improve the Service.',
      'Customer Content: operational data you or your organization upload into the Service (inventory, sales, vendors, employees, recipes, documents, and similar). We process this primarily as a processor under the DPA when acting on your organization’s instructions.',
      'Support communications: messages, attachments, and diagnostic information you send to support.',
    ],
  },
  {
    id: 'use',
    heading: '3. How we use personal data',
    paragraphs: [
      'We use personal data to: create and administer accounts; provide, secure, and maintain the Service; process subscriptions and trials; communicate service notices; provide customer support; prevent fraud and abuse; comply with law; and improve product performance through aggregated or anonymized analytics where feasible.',
      'We do not sell personal data. We do not use Customer Content to train public generative AI models.',
    ],
  },
  {
    id: 'legal-bases',
    heading: '4. Legal bases (where required)',
    paragraphs: [
      'Where GDPR/UK GDPR or similar laws apply, we rely on one or more of: performance of a contract; legitimate interests (securing and improving the Service, in a manner that does not override your rights); consent (where we ask for it); and legal obligation.',
      'Where consent is the basis, you may withdraw it without affecting prior lawful processing.',
    ],
  },
  {
    id: 'sharing',
    heading: '5. Sharing and subprocessors',
    paragraphs: [
      'We share personal data with: infrastructure and hosting providers; email/SMS and communications providers; analytics and security tooling; payment processors; professional advisors; and affiliates, only as needed to operate the Service.',
      'We may disclose data if required by law, legal process, or to protect rights, safety, and security. In a merger, acquisition, or asset transfer, personal data may transfer subject to this Policy or successor notice.',
      'A current list of material subprocessors is available on request and may be updated as described in the DPA.',
    ],
  },
  {
    id: 'transfers',
    heading: '6. International transfers',
    paragraphs: [
      `${LEGAL_PRODUCT} is designed for global use. Personal data may be processed in Malaysia and other countries where we or our subprocessors operate.`,
      'Where required, we use appropriate safeguards for cross-border transfers (such as standard contractual clauses, adequacy decisions, or comparable mechanisms) and require subprocessors to provide equivalent protection.',
    ],
  },
  {
    id: 'retention',
    heading: '7. Retention',
    paragraphs: [
      'We retain personal data for as long as needed to provide the Service, comply with legal/accounting obligations, resolve disputes, and enforce agreements. Account data is typically retained while the account is active and for a commercially reasonable period afterward unless earlier deletion is required or requested where applicable.',
      'Customer Content retention follows the customer’s Subscription and the DPA (including post-termination deletion or return windows).',
    ],
  },
  {
    id: 'security',
    heading: '8. Security',
    paragraphs: [
      'We implement commercially reasonable technical and organizational measures designed to protect personal data against unauthorized access, loss, or alteration. No method of transmission or storage is completely secure; residual risk remains.',
    ],
  },
  {
    id: 'rights',
    heading: '9. Your rights',
    paragraphs: [
      'Depending on your location, you may have rights to access, correct, delete, restrict, or port personal data; object to certain processing; withdraw consent; and lodge a complaint with a supervisory authority.',
      'To exercise rights regarding account/admin data we control, contact us via support channels. For Customer Content processed for your organization, contact your organization (the controller); we will assist them under the DPA.',
      'California residents may have additional rights under CCPA/CPRA, including the right to know, delete, and correct personal information, and to opt out of “sale”/“sharing” as those terms are defined by law. We do not sell personal information for monetary consideration.',
    ],
  },
  {
    id: 'cookies',
    heading: '10. Cookies and similar technologies',
    paragraphs: [
      'We use essential cookies and similar technologies for authentication, security, and service operation. We may use limited analytics cookies or local storage to understand usage. Where required, we will request consent for non-essential cookies.',
    ],
  },
  {
    id: 'children',
    heading: '11. Children',
    paragraphs: [
      'The Service is intended for business users and is not directed to children. We do not knowingly collect personal data from children under 16 (or higher age required locally).',
    ],
  },
  {
    id: 'changes',
    heading: '12. Changes',
    paragraphs: [
      'We may update this Privacy Policy by posting a new version and updating the version date. Material changes will be notified through the Service, email, or registration flow where practicable. Continued use after the effective date constitutes acceptance where permitted by law.',
    ],
  },
  {
    id: 'contact',
    heading: '13. Contact',
    paragraphs: [
      `Privacy contact: ${LEGAL_PROVIDER}, operating ${LEGAL_PRODUCT}. Use in-product support or published website contact channels.`,
    ],
  },
];
