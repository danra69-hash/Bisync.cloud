/** Human Resources module — API from https://github.com/danra69-hash/HrBackend */

export const HR_BACKEND_REPO = 'https://github.com/danra69-hash/HrBackend';

export const HR_BACKEND_DEV_PORT = 5158;

/**
 * HR REST API base path.
 * Dev: Vite proxies `/hr-api` → http://localhost:5158/api
 * Prod: set `VITE_HR_API_URL` to your deployed HrBackend API root (e.g. https://hr.example.com/api)
 */
export const HR_API_BASE = ((import.meta.env.VITE_HR_API_URL as string | undefined) || '/hr-api').replace(/\/$/, '');
