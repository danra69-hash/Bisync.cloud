/** Current Bisync.cloud SaaS End User License Agreement (EULA). */

export const CURRENT_EULA_VERSION = '2026-07-24';

export const EULA_EFFECTIVE_DATE = '24 July 2026';

export const EULA_TITLE = 'Bisync.cloud End User License Agreement (EULA)';

export const EULA_PROVIDER = 'Cube Value Sdn Bhd (Company No. 1164413X)';

export type EulaSection = {
  id: string;
  heading: string;
  paragraphs: string[];
};

export const EULA_INTRO = [
  `This End User License Agreement (“Agreement”) is a legally binding contract between you (“Customer”, “you”, or “your”) and ${EULA_PROVIDER} (“Provider”, “we”, “us”, or “our”) governing access to and use of the Bisync.cloud software-as-a-service platform and related websites, applications, APIs, documentation, and support (collectively, the “Service”).`,
  'By creating an account, clicking “I agree”, checking an acceptance box, or accessing or using the Service, you accept this Agreement. If you are accepting on behalf of a company or other legal entity, you represent that you have authority to bind that entity. If you do not agree, do not register for or use the Service.',
  'The Service is offered on a subscription basis for commercial use worldwide, subject to this Agreement, applicable law, and any order form, trial terms, or subscription plan presented at signup or renewal.',
];

export const EULA_SECTIONS: EulaSection[] = [
  {
    id: 'definitions',
    heading: '1. Definitions',
    paragraphs: [
      '“Account” means a registered user profile used to access the Service.',
      '“Customer Data” means data, content, and materials that you or your authorized users submit to or process through the Service, including operational, inventory, sales, employee, and vendor information.',
      '“Subscription” means a paid or trial plan granting timed access to the Service under the commercial terms displayed at purchase or renewal.',
      '“Authorized Users” means individuals you permit to access the Service under your Account, including employees and contractors.',
    ],
  },
  {
    id: 'license',
    heading: '2. Subscription license and global use',
    paragraphs: [
      'Subject to this Agreement and a valid Subscription, Provider grants you a limited, non-exclusive, non-transferable, non-sublicensable, revocable right to access and use the Service for your internal business operations anywhere in the world, except where prohibited by law or sanctions.',
      'You do not acquire ownership of the Service, software, or related intellectual property. All rights not expressly granted are reserved by Provider and its licensors.',
      'You may not: (a) copy, modify, or create derivative works of the Service; (b) reverse engineer or attempt to extract source code except to the extent permitted by mandatory law; (c) rent, lease, sell, or provide the Service to third parties as a competing service; (d) circumvent security or usage limits; or (e) use the Service to build a competing product using non-public aspects of the Service.',
    ],
  },
  {
    id: 'account',
    heading: '3. Account registration and eligibility',
    paragraphs: [
      'You must provide accurate registration information and keep it current. You are responsible for safeguarding credentials and for all activity under your Account and Authorized Users.',
      'You must be legally capable of entering a binding contract. The Service is intended for business use and not for personal consumer use by minors.',
      'Notify us promptly of unauthorized access or security incidents involving your Account.',
    ],
  },
  {
    id: 'subscription',
    heading: '4. Free trial, subscriptions, and fees',
    paragraphs: [
      'Provider may offer a free trial or promotional access. Trial features, duration, and conversion to paid Subscriptions are described at signup or in-product notices. When a trial ends, continued access may require a paid Subscription.',
      'Paid Subscriptions renew according to the plan you select unless cancelled in accordance with the cancellation path available in the Service or by written notice to Provider before the renewal date where required by law.',
      'Fees are due as stated on the applicable order or invoice. Prices exclude applicable taxes, duties, and banking fees, which you are responsible for unless Provider is legally required to collect them. Late amounts may accrue interest or lead to suspension as permitted by law.',
      'Except where mandatory consumer or local law requires otherwise, fees are non-refundable once a billing period has started.',
    ],
  },
  {
    id: 'acceptable-use',
    heading: '5. Acceptable use',
    paragraphs: [
      'You will use the Service only for lawful purposes and in accordance with this Agreement. You will not upload malware; interfere with other customers; scrape the Service beyond permitted APIs; send spam or unlawful content; infringe third-party rights; or process data you are not authorized to process.',
      'You are responsible for configuring access controls for Authorized Users and for compliance with employment, hospitality, food-safety, tax, privacy, and industry rules applicable to your operations.',
    ],
  },
  {
    id: 'customer-data',
    heading: '6. Customer Data and privacy',
    paragraphs: [
      'You retain ownership of Customer Data. You grant Provider a worldwide license to host, process, transmit, and display Customer Data solely to provide, secure, maintain, and improve the Service, and as otherwise instructed by you or required by law.',
      'Provider will implement commercially reasonable administrative, technical, and organizational measures designed to protect Customer Data. No method of transmission or storage is completely secure; you use the Service at your own risk regarding residual security risks.',
      'Where Provider processes personal data on your behalf, you are the data controller (or equivalent) and Provider acts as processor (or equivalent), except for account administration data Provider processes as an independent controller. You represent that you have a lawful basis to provide personal data to the Service and to instruct Provider to process it.',
      'Provider may create anonymized or aggregated statistics that do not identify you or individuals, and may use those statistics to operate and improve products and services.',
    ],
  },
  {
    id: 'ip',
    heading: '7. Intellectual property and feedback',
    paragraphs: [
      'The Service, including software, interfaces, trademarks (including Bisync.cloud and related marks), and documentation, is owned by Provider or its licensors and protected by intellectual property laws.',
      'If you provide feedback or suggestions, you grant Provider a perpetual, irrevocable, worldwide, royalty-free license to use them without restriction or attribution.',
    ],
  },
  {
    id: 'third-parties',
    heading: '8. Third-party services',
    paragraphs: [
      'The Service may interoperate with third-party products (for example payment, email, calendar, mapping, or identity providers). Those services are governed by their own terms. Provider is not responsible for third-party services you choose to enable.',
    ],
  },
  {
    id: 'warranty',
    heading: '9. Warranties and disclaimers',
    paragraphs: [
      'Provider will provide the Service with reasonable skill and care. Except as expressly stated in this Agreement, the Service is provided “as is” and “as available”.',
      'To the maximum extent permitted by applicable law, Provider disclaims all implied warranties, including merchantability, fitness for a particular purpose, title, and non-infringement. Provider does not warrant that the Service will be uninterrupted, error-free, or meet your specific operational or regulatory requirements.',
      'Nothing in this Agreement excludes liability that cannot be excluded under mandatory law.',
    ],
  },
  {
    id: 'liability',
    heading: '10. Limitation of liability',
    paragraphs: [
      'To the maximum extent permitted by law, neither party is liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, revenue, goodwill, or data, even if advised of the possibility of such damages.',
      'Except for (a) your payment obligations, (b) your breach of license or acceptable-use restrictions, (c) your indemnification obligations, or (d) liability that cannot be limited by law, each party’s aggregate liability arising out of this Agreement is limited to the fees paid or payable by you to Provider for the Service in the twelve (12) months before the event giving rise to the claim (or, for trials with no fees paid, USD 100 or local equivalent).',
    ],
  },
  {
    id: 'indemnity',
    heading: '11. Indemnification',
    paragraphs: [
      'You will defend and indemnify Provider and its officers, directors, and employees against claims, damages, and costs (including reasonable legal fees) arising from Customer Data, your use of the Service in violation of this Agreement or law, or disputes among your Authorized Users or business partners, except to the extent caused by Provider’s willful misconduct.',
    ],
  },
  {
    id: 'suspension',
    heading: '12. Suspension and termination',
    paragraphs: [
      'Either party may terminate this Agreement for material breach if the breach remains uncured thirty (30) days after written notice (or immediately for non-payment, security risk, or illegal use).',
      'Provider may suspend access immediately if necessary to protect the Service, other customers, or to comply with law, or if your Subscription expires or payment fails.',
      'Upon termination or expiry, your license ends. Provider may delete or disable Customer Data after a commercially reasonable retention window, except where law requires longer retention. You should export Customer Data before termination where export tools are available.',
    ],
  },
  {
    id: 'changes',
    heading: '13. Changes to the Service and this Agreement',
    paragraphs: [
      'Provider may improve, modify, or discontinue features of the Service. Material reductions of core paid functionality will be communicated with reasonable notice where practicable.',
      'Provider may update this Agreement by posting a new version and updating the version date. For material changes, we will provide notice through the Service, email, or registration flow. Continued use after the effective date, or acceptance at registration or renewal, constitutes acceptance of the updated Agreement. If you do not agree, you must stop using the Service and cancel your Subscription.',
    ],
  },
  {
    id: 'compliance',
    heading: '14. Export, sanctions, and compliance',
    paragraphs: [
      'You must comply with applicable export control, sanctions, anti-corruption, and data-protection laws. You may not use the Service in countries or for parties prohibited under Malaysian, US, EU, UN, or other applicable sanctions regimes.',
    ],
  },
  {
    id: 'governing-law',
    heading: '15. Governing law and disputes',
    paragraphs: [
      `This Agreement is governed by the laws of Malaysia, without regard to conflict-of-law rules. The United Nations Convention on Contracts for the International Sale of Goods does not apply.`,
      'Courts of Malaysia have exclusive jurisdiction over disputes arising from this Agreement, except that Provider may seek injunctive or equitable relief in any jurisdiction to protect intellectual property or confidential information.',
      'If mandatory local law gives you non-waivable rights in your country of residence or establishment, those rights remain available to you.',
    ],
  },
  {
    id: 'general',
    heading: '16. General',
    paragraphs: [
      'This Agreement, together with any order form, subscription plan, and policies expressly incorporated by reference, is the entire agreement regarding the Service and supersedes prior proposals on the same subject.',
      'If any provision is unenforceable, the remainder remains in effect. Failure to enforce a provision is not a waiver. You may not assign this Agreement without Provider’s prior written consent; Provider may assign to an affiliate or successor. Notices may be sent to the email associated with your Account or to Provider’s registered contact channels.',
      'Headings are for convenience only. The English version of this Agreement controls if translations conflict, except where mandatory local law requires otherwise.',
    ],
  },
  {
    id: 'contact',
    heading: '17. Contact',
    paragraphs: [
      `Questions about this Agreement: ${EULA_PROVIDER}, operating Bisync.cloud. Contact support through the channels published on the Bisync.cloud website or in-product help.`,
    ],
  },
];

export function formatEulaPlainText(): string {
  const parts = [
    EULA_TITLE,
    `Version ${CURRENT_EULA_VERSION} · Effective ${EULA_EFFECTIVE_DATE}`,
    '',
    ...EULA_INTRO,
    '',
  ];
  for (const section of EULA_SECTIONS) {
    parts.push(section.heading, '');
    for (const p of section.paragraphs) parts.push(p, '');
  }
  return parts.join('\n').trim();
}
