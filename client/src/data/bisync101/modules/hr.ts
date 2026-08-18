import type { Bisync101Module } from '../types';

export const hrModule: Bisync101Module = {
  id: 'hr',
  title: 'Human Resources',
  blurb: 'Employees, attendance, leave, schedules, Team app (/TEAM) Locations today, staff orders, and HR configuration.',
  icon: 'users',
  tasks: [
    {
      id: 'hr-employee-directory',
      title: 'Add an employee',
      summary: 'Create an employee record in the directory with role and location.',
      durationLabel: '~30 sec',
      whereInApp: 'Human Resources → Employee Directory',
      clipFile: 'hr-employee-directory.webm',
      steps: [
        {
          title: 'Open Employee Directory',
          detail: 'Enter Human Resources and open Employee Directory.',
          hotspot: { x: 8, y: 20, w: 18, h: 8, label: 'Directory' },
        },
        {
          title: 'New employee',
          detail: 'Enter name, contact, employment details, and home location/company.',
          hotspot: { x: 55, y: 28, w: 40, h: 40, label: 'Employee' },
        },
        {
          title: 'Save',
          detail: 'Save so attendance, leave, and Team app can reference the employee.',
          hotspot: { x: 78, y: 88, w: 14, h: 8, label: 'Save' },
        },
      ],
    },
    {
      id: 'hr-attendance',
      title: 'Review attendance',
      summary: 'Check clock-ins and exceptions for a period.',
      durationLabel: '~25 sec',
      whereInApp: 'Human Resources → Attendance',
      clipFile: 'hr-attendance.webm',
      steps: [
        {
          title: 'Open Attendance',
          detail: 'Open the Attendance tab.',
          hotspot: { x: 8, y: 28, w: 18, h: 8, label: 'Attendance' },
        },
        {
          title: 'Filter the period',
          detail: 'Select location and date range to load punches.',
          hotspot: { x: 28, y: 16, w: 50, h: 10, label: 'Filters' },
        },
        {
          title: 'Resolve exceptions',
          detail: 'Open rows with missing or late punches and apply corrections per policy.',
          hotspot: { x: 28, y: 32, w: 60, h: 40, label: 'Grid' },
        },
      ],
    },
    {
      id: 'hr-leave',
      title: 'Manage leave requests',
      summary: 'Submit or approve leave for the team.',
      durationLabel: '~25 sec',
      whereInApp: 'Human Resources → Leave',
      clipFile: 'hr-leave.webm',
      steps: [
        {
          title: 'Open Leave',
          detail: 'Open the Leave tab.',
          hotspot: { x: 8, y: 36, w: 18, h: 8, label: 'Leave' },
        },
        {
          title: 'Create or approve',
          detail: 'Employees request leave; managers approve or reject with comments.',
          hotspot: { x: 28, y: 28, w: 60, h: 40, label: 'Leave queue' },
        },
      ],
    },
    {
      id: 'hr-schedule',
      title: 'Build a work schedule',
      summary: 'Assign shifts for locations and publish the roster.',
      durationLabel: '~30 sec',
      whereInApp: 'Human Resources → Schedule',
      clipFile: 'hr-schedule.webm',
      steps: [
        {
          title: 'Open Schedule',
          detail: 'Open the Schedule tab.',
          hotspot: { x: 8, y: 44, w: 18, h: 8, label: 'Schedule' },
        },
        {
          title: 'Assign shifts',
          detail: 'Place employees on shift slots for the week at each location.',
          hotspot: { x: 28, y: 28, w: 60, h: 45, label: 'Roster' },
        },
        {
          title: 'Publish',
          detail: 'Publish so the Team app and attendance expectations match the roster.',
          hotspot: { x: 78, y: 16, w: 14, h: 8, label: 'Publish' },
        },
      ],
    },
    {
      id: 'hr-team-order',
      title: 'Team RMS order (staff ordering)',
      summary: 'Use Team / employee portal flows for staff purchase requests where enabled.',
      durationLabel: '~30 sec',
      whereInApp: 'Human Resources → Team / Employee Portal, or /TEAM',
      clipFile: 'hr-team-order.webm',
      steps: [
        {
          title: 'Open Team',
          detail: 'From HR, open Team or the Employee Portal. Mobile users can use /TEAM.',
          voiceover: 'Open Team from Human Resources, or go to slash TEAM on mobile for the standalone Team app.',
          hotspot: { x: 8, y: 52, w: 18, h: 8, label: 'Team' },
        },
        {
          title: 'Place the request',
          detail: 'Select allowed items and submit for outlet approval as configured.',
          voiceover: 'Choose allowed items and submit the staff purchase request for outlet approval.',
          hotspot: { x: 28, y: 28, w: 60, h: 40, label: 'Team order' },
        },
      ],
    },
    {
      id: 'hr-team-app-home',
      title: 'Team app Home · Locations today',
      summary: 'On /TEAM Home, review live POS Sales, Covers, and Check per location before chats.',
      durationLabel: '~30 sec',
      whereInApp: '/TEAM → Home',
      steps: [
        {
          title: 'Open /TEAM and sign in',
          detail: 'Open the Team app URL (/TEAM) and sign in with your employee email/mobile and password or PIN.',
          voiceover: 'Open slash TEAM and sign in with your employee account. Home is the first bottom tab.',
          hotspot: { x: 30, y: 30, w: 40, h: 35, label: 'Team login' },
        },
        {
          title: 'Read Locations today',
          detail: 'Above chats, Locations today lists each selected outlet with Sales, Covers, Check, and the data time.',
          voiceover: 'On Home, Locations today sits above chats and shows live POS Sales, Covers, and Check with the timestamp.',
          hotspot: { x: 20, y: 14, w: 60, h: 32, label: 'Locations today' },
        },
        {
          title: 'Filter many locations',
          detail: 'When there are three or more outlets, use the Locations control to focus the list, then continue into chats or My Work.',
          voiceover: 'If you have many locations, tap Locations to filter the list, then use chats or My Work as needed.',
          hotspot: { x: 62, y: 12, w: 22, h: 8, label: 'Locations' },
        },
      ],
      tips: [
        'Team Home is the chats tab — Locations today appears above the conversation list.',
        'Figures refresh about every minute from POS closed checks.',
      ],
    },
    {
      id: 'hr-config',
      title: 'Configure HR settings',
      summary: 'Maintain departments, levels, and HR policies used by the module.',
      durationLabel: '~25 sec',
      whereInApp: 'Human Resources → HR Config',
      clipFile: 'hr-config.webm',
      steps: [
        {
          title: 'Open HR Config',
          detail: 'Open HR Config from the HR tabs.',
          hotspot: { x: 8, y: 68, w: 18, h: 8, label: 'HR Config' },
        },
        {
          title: 'Maintain structure',
          detail: 'Edit departments, divisions, employee levels, and related settings.',
          hotspot: { x: 28, y: 28, w: 60, h: 45, label: 'Config' },
        },
        {
          title: 'Save',
          detail: 'Save so directory and payroll pick up the structure.',
          hotspot: { x: 78, y: 88, w: 14, h: 8, label: 'Save' },
        },
      ],
    },
  ],
};
