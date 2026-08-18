import type { Bisync101Module } from '../types';

export const gettingStartedModule: Bisync101Module = {
  id: 'getting-started',
  title: 'Getting Started',
  blurb: 'Sign in, pick your company and location, use Home Locations today and Team chat, and move around the Bisync.cloud shell.',
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
          voiceover: 'Open Bisync 101 from the top bar, right after the language flag.',
          hotspot: { x: 86, y: 3, w: 8, h: 9, label: 'Bisync101' },
        },
        {
          title: 'Pick a module',
          detail: 'Choose a module on the left (Getting Started, RMS, POS, HR, and more).',
          voiceover: 'Pick a module on the left — Getting Started, Revenue Management, POS, HR, or Accounting.',
          hotspot: { x: 4, y: 18, w: 22, h: 50, label: 'Modules' },
        },
        {
          title: 'Play a task clip',
          detail: 'Select a task, watch the short capture with voice-over, then follow the numbered steps on the right.',
          voiceover: 'Select a task, watch the screenshot lesson with voice-over, and follow the numbered steps on the right. Mute voice anytime with the speaker button.',
          hotspot: { x: 30, y: 20, w: 40, h: 35, label: 'Clip + steps' },
        },
      ],
    },
    {
      id: 'gs-home-chat',
      title: 'Hide and reopen Team chat on Home',
      summary: 'Collapse the Home chat rail to enlarge content, then reopen from the Chat chip or unread bell.',
      durationLabel: '~25 sec',
      whereInApp: 'Home → Team chat',
      steps: [
        {
          title: 'Find Team chat',
          detail: 'On Home, Team chat sits in the left rail beside module tiles and location stats.',
          voiceover: 'On Home, Team chat lives in the left rail next to your modules and location stats.',
          hotspot: { x: 2, y: 14, w: 28, h: 55, label: 'Chat rail' },
        },
        {
          title: 'Hide the rail',
          detail: 'Click Hide on the chat toolbar. The rail disappears so the rest of Home expands to full width.',
          voiceover: 'Click Hide on the chat toolbar. The rail collapses like the sidebar so Home content expands.',
          hotspot: { x: 18, y: 14, w: 10, h: 6, label: 'Hide' },
        },
        {
          title: 'Reopen from Chat or bell',
          detail: 'Use the compact Chat chip to reopen. When there are unread messages, a notification bell appears instead.',
          voiceover: 'Reopen with the Chat chip, or the notification bell when you have unread messages. Chat also stays available from the header bell.',
          hotspot: { x: 2, y: 12, w: 16, h: 8, label: 'Chat / bell' },
        },
      ],
      tips: [
        'Revenue Management no longer hosts a chat rail — use Home or the header notification bell.',
        'Hide preference is remembered in this browser.',
      ],
    },
    {
      id: 'gs-home-locations-today',
      title: 'Read Locations today on Home',
      summary: 'See live POS Sales, Covers, and Check average per outlet, with the data timestamp.',
      durationLabel: '~30 sec',
      whereInApp: 'Home → Locations today',
      steps: [
        {
          title: 'Open Home',
          detail: 'Go to Home. Below the title you will see Locations today with live POS figures.',
          voiceover: 'On Home, Locations today shows live POS Sales, Covers, and Check average for each selected outlet.',
          hotspot: { x: 32, y: 18, w: 64, h: 28, label: 'Locations today' },
        },
        {
          title: 'Use Locations when you have many outlets',
          detail: 'If the company has three or more locations, a Locations button appears at the top so you can filter the list.',
          voiceover: 'When you manage many locations, use the Locations button at the top of Home to filter which outlets appear.',
          hotspot: { x: 78, y: 12, w: 16, h: 8, label: 'Locations' },
        },
        {
          title: 'Check the timestamp',
          detail: 'Each row shows Sales, Covers, Check (average), and when the data was last updated from POS closed checks.',
          voiceover: 'Read Sales, Covers, and Check, then confirm the Updated time so you know how fresh the POS data is. Refresh to pull the latest totals.',
          hotspot: { x: 32, y: 28, w: 64, h: 24, label: 'POS KPIs' },
        },
      ],
      tips: [
        'Figures come from live POS closed checks for the business day — zeros mean no closed checks yet.',
        'Header company and location filters also drive this list.',
      ],
    },
  ],
};
