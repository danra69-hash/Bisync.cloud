import type { Bisync101Module } from '../types';

export const gettingStartedModule: Bisync101Module = {
  id: 'getting-started',
  title: 'Getting Started',
  blurb: 'Sign in, pick your company and location, and move around the Bisync.cloud shell.',
  icon: 'home',
  tasks: [
    {
      id: 'gs-sign-in',
      title: 'Sign in to the platform',
      summary: 'Open Bisync.cloud and authenticate with your company account.',
      durationLabel: '~20 sec',
      whereInApp: 'Landing → Login',
      clipFile: 'gs-sign-in.webm',
      steps: [
        {
          title: 'Open the site',
          detail: 'Go to the Bisync.cloud URL your company uses. You land on the branded sign-in page.',
          hotspot: { x: 35, y: 28, w: 30, h: 12, label: 'Sign in' },
        },
        {
          title: 'Enter credentials',
          detail: 'Use the email and password from your activation invite (or your existing account).',
          hotspot: { x: 32, y: 40, w: 36, h: 22, label: 'Email & password' },
        },
        {
          title: 'Enter the app',
          detail: 'After a successful login you arrive on Home with the module tiles for modules your company has enabled.',
          hotspot: { x: 20, y: 30, w: 60, h: 40, label: 'Home modules' },
        },
      ],
      tips: [
        'First-time users activate via the email link before signing in.',
        'Use the language control (flag) in the top bar any time after login.',
      ],
    },
    {
      id: 'gs-company-location',
      title: 'Select company and location',
      summary: 'Scope every screen to the right company and one or more outlets.',
      durationLabel: '~25 sec',
      whereInApp: 'Top header filters',
      clipFile: 'gs-company-location.webm',
      steps: [
        {
          title: 'Choose company',
          detail: 'In the top bar, open the Company dropdown and pick the legal entity you are working in.',
          hotspot: { x: 48, y: 4, w: 18, h: 8, label: 'Company' },
        },
        {
          title: 'Choose location(s)',
          detail: 'Open the Location control next to it. Select one outlet, several, or all as the page allows.',
          hotspot: { x: 66, y: 4, w: 16, h: 8, label: 'Location' },
        },
        {
          title: 'Confirm the clock',
          detail: 'The header clock follows the selected company/location timezone so dates and cut-offs match the outlet.',
          hotspot: { x: 28, y: 8, w: 20, h: 6, label: 'Org clock' },
        },
      ],
      tips: [
        'Most RMS and inventory actions require both a company and at least one location.',
        'Switching company clears location selection when the previous outlets do not belong to the new company.',
      ],
    },
    {
      id: 'gs-navigate-modules',
      title: 'Open a module from Home or the sidebar',
      summary: 'Move between Revenue Management, POS, HR, Accounting, and System Configuration.',
      durationLabel: '~20 sec',
      whereInApp: 'Home tiles / left sidebar',
      clipFile: 'gs-navigate-modules.webm',
      steps: [
        {
          title: 'Use Home tiles',
          detail: 'From Home, click a module tile (only enabled modules are available).',
          hotspot: { x: 18, y: 32, w: 28, h: 28, label: 'Module tile' },
        },
        {
          title: 'Or use the sidebar',
          detail: 'Open the menu (☰) and pick the same module from the left navigation.',
          hotspot: { x: 2, y: 4, w: 8, h: 8, label: 'Menu' },
        },
        {
          title: 'Return Home anytime',
          detail: 'Click the Home icon in the top bar to jump back to the module tiles.',
          hotspot: { x: 82, y: 4, w: 5, h: 8, label: 'Home' },
        },
      ],
    },
    {
      id: 'gs-language',
      title: 'Change display language',
      summary: 'Switch the UI language from the flag control in the header.',
      durationLabel: '~15 sec',
      whereInApp: 'Top bar → language flag',
      clipFile: 'gs-language.webm',
      steps: [
        {
          title: 'Open language menu',
          detail: 'Click the circular flag button on the far right of the top bar.',
          hotspot: { x: 92, y: 3, w: 5, h: 9, label: 'Language' },
        },
        {
          title: 'Pick a language',
          detail: 'Choose your preferred language. The shell updates immediately and remembers your choice.',
          hotspot: { x: 78, y: 14, w: 18, h: 40, label: 'Locales' },
        },
      ],
    },
    {
      id: 'gs-bisync101',
      title: 'Use Bisync101 (this guide)',
      summary: 'Open short task clips and written steps for every major workflow.',
      durationLabel: '~15 sec',
      whereInApp: 'Top bar → Bisync101',
      clipFile: 'gs-bisync101.webm',
      steps: [
        {
          title: 'Open Bisync101',
          detail: 'Click the Bisync101 button immediately after the language flag.',
          hotspot: { x: 86, y: 3, w: 8, h: 9, label: 'Bisync101' },
        },
        {
          title: 'Pick a module',
          detail: 'Choose a module on the left (Getting Started, RMS, POS, HR, and more).',
          hotspot: { x: 4, y: 18, w: 22, h: 50, label: 'Modules' },
        },
        {
          title: 'Play a task clip',
          detail: 'Select a task, watch the short capture, then follow the numbered steps on the right.',
          hotspot: { x: 30, y: 20, w: 40, h: 35, label: 'Clip + steps' },
        },
      ],
    },
  ],
};
