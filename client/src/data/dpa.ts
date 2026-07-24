import { LEGAL_EFFECTIVE_DATE, LEGAL_PRODUCT, LEGAL_PROVIDER, type LegalSection } from './legalShared';

export const CURRENT_DPA_VERSION = '2026-07-24';

export const DPA_TITLE = `${LEGAL_PRODUCT} Data Processing Addendum`;

export const DPA_INTRO = [
  `This Data Processing Addendum (“DPA”) forms part of the ${LEGAL_PRODUCT} End User License Agreement / SaaS subscription terms (the “Agreement”) between the customer entity accepting this DPA (“Customer”) and ${LEGAL_PROVIDER} (“Processor”).`,
  'This DPA applies when Processor processes Personal Data on behalf of Customer in connection with the Service. It is intended for global use and is designed to help Customer meet obligations under GDPR, UK GDPR, PDPA, and similar laws. Capitalized terms not defined here have the meaning in the Agreement or applicable data-protection law.',
  `By accepting this DPA at registration or otherwise incorporating it into the Agreement, the parties agree to these terms. Effective date: ${LEGAL_EFFECTIVE_DATE}. Version ${CURRENT_DPA_VERSION}.`,
];

export const DPA_SECTIONS: LegalSection[] = [
  {
    id: 'roles',
    heading: '1. Roles of the parties',
    paragraphs: [
      'Customer is the Controller (or equivalent) of Customer Personal Data. Processor processes Customer Personal Data only as a Processor (or equivalent) on documented instructions from Customer, except where required by law.',
      'Processor may process limited account, billing, and security data as an independent Controller as described in the Privacy Policy; that processing is outside the scope of this DPA.',
    ],
  },
  {
    id: 'scope',
    heading: '2. Subject matter, duration, nature, and purpose',
    paragraphs: [
      'Subject matter: processing of Personal Data uploaded to or generated in the Service for Customer’s hospitality / operations workflows (including inventory, purchasing, sales, production, HR modules where enabled, and related configuration).',
      'Duration: for the term of the Agreement and any post-termination retention/deletion period in this DPA.',
      'Nature and purpose: hosting, storage, transmission, display, backup, security monitoring, support, and other processing needed to provide the Service instructed by Customer.',
      'Types of Personal Data may include: names, contact details, employee identifiers, role/attendance data (if HR features are used), vendor contact details, user account logs, and other Personal Data Customer chooses to submit.',
      'Data subjects may include: Customer’s employees, contractors, vendors, customers, and other end users whose data Customer enters into the Service.',
    ],
  },
  {
    id: 'instructions',
    heading: '3. Customer instructions',
    paragraphs: [
      'Customer instructs Processor to process Customer Personal Data to provide the Service, fulfill support requests, and as otherwise configured by Authorized Users in the Service.',
      'Customer warrants it has a lawful basis and all notices/consents required to instruct Processor to process Personal Data. Customer will not instruct Processor to process data in violation of law.',
      'If Processor believes an instruction infringes applicable data-protection law, it will notify Customer without undue delay unless legally prohibited.',
    ],
  },
  {
    id: 'confidentiality',
    heading: '4. Confidentiality',
    paragraphs: [
      'Processor ensures persons authorized to process Customer Personal Data are bound by confidentiality obligations and receive appropriate training.',
    ],
  },
  {
    id: 'security',
    heading: '5. Security measures',
    paragraphs: [
      'Processor implements and maintains appropriate technical and organizational measures designed to protect Customer Personal Data against unauthorized or unlawful processing and against accidental loss, destruction, or damage, taking into account the state of the art, costs, and the nature/scope/context of processing.',
      'Measures include access controls, encryption in transit where supported, network and application safeguards, logging/monitoring appropriate to the Service, vulnerability management, and personnel access limitations on a need-to-know basis.',
    ],
  },
  {
    id: 'subprocessors',
    heading: '6. Subprocessors',
    paragraphs: [
      'Customer authorizes Processor to engage subprocessors to deliver the Service (including cloud hosting, email delivery, monitoring, and support tooling). Processor remains responsible for subprocessor performance under this DPA.',
      'Processor will impose data-protection terms on subprocessors no less protective than this DPA. Processor will provide notice of material subprocessor changes and allow Customer a reasonable objection window where required by law; if Customer reasonably objects and the parties cannot resolve, Customer may terminate the affected Subscription as its sole remedy.',
    ],
  },
  {
    id: 'transfers',
    heading: '7. International transfers',
    paragraphs: [
      'Customer acknowledges that Customer Personal Data may be processed in Malaysia and other jurisdictions where Processor or subprocessors operate.',
      'Where a restricted transfer requires a transfer mechanism, the parties will rely on valid Standard Contractual Clauses (or successor modules), adequacy decisions, or other lawful mechanisms. On request, Processor will provide information reasonably needed for Customer’s transfer assessments.',
    ],
  },
  {
    id: 'assistance',
    heading: '8. Assistance with data subject rights and compliance',
    paragraphs: [
      'Taking into account the nature of processing, Processor will assist Customer by appropriate technical and organizational measures, insofar as possible, for Customer to respond to data subject requests under applicable law.',
      'Processor will assist Customer with data protection impact assessments and consultations with supervisory authorities, to the extent related to Processor’s processing of Customer Personal Data and as reasonably requested.',
    ],
  },
  {
    id: 'breach',
    heading: '9. Personal data breach',
    paragraphs: [
      'Processor will notify Customer without undue delay after becoming aware of a Personal Data Breach affecting Customer Personal Data, and will provide information reasonably available to help Customer meet breach notification obligations.',
      'Notification is not an admission of fault or liability.',
    ],
  },
  {
    id: 'audit',
    heading: '10. Audit and information',
    paragraphs: [
      'Upon reasonable written request, Processor will make available information necessary to demonstrate compliance with this DPA, which may include security summaries or third-party audit reports/certificates where available.',
      'If such information is insufficient and mandatory law requires an audit, Customer may conduct a remote or on-site audit with reasonable advance notice, during business hours, no more than once annually (unless a breach or regulatory request requires sooner), at Customer’s expense, and subject to confidentiality and non-disruption conditions.',
    ],
  },
  {
    id: 'return-deletion',
    heading: '11. Return and deletion',
    paragraphs: [
      'During the Subscription, Customer may export Customer Data using available Service features.',
      'Upon termination or expiry of the Agreement, Processor will delete or return Customer Personal Data (at Customer’s election where technically feasible) within a commercially reasonable period, unless retention is required by law or needed for secure backups pending overwrite in the ordinary cycle.',
    ],
  },
  {
    id: 'liability',
    heading: '12. Liability and order of precedence',
    paragraphs: [
      'Each party’s liability under this DPA is subject to the limitations and exclusions in the Agreement, except where prohibited by mandatory law.',
      'If there is a conflict between this DPA and the Agreement regarding processing of Customer Personal Data, this DPA controls. If Standard Contractual Clauses are executed, they control over this DPA for restricted transfers to the extent of conflict.',
    ],
  },
  {
    id: 'governing-law',
    heading: '13. Governing law',
    paragraphs: [
      'This DPA is governed by the same governing law and dispute provisions as the Agreement, except where mandatory data-protection law requires otherwise.',
    ],
  },
];
