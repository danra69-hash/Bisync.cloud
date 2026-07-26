export type ScheduledShift = {
  id: string
  /** Local calendar date YYYY-MM-DD */
  date: string
  outletId: number
  outletName?: string
  startTime: string
  endTime: string
  roleLabel?: string
}

export type ScheduleDay = {
  date: string
  weekday: string
  shifts: ScheduledShift[]
}

export type MonthSchedule = {
  year: number
  month: number
  /** First day of month YYYY-MM-DD */
  monthStart: string
  /** Last day of month YYYY-MM-DD */
  monthEnd: string
  days: ScheduleDay[]
}
