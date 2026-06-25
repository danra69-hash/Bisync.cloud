/** Human Resources module — served by the unified Bisync API */

export const HR_API_BASE = ((import.meta.env.VITE_HR_API_URL as string | undefined) || '/api').replace(/\/$/, '');
