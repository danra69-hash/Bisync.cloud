import { hrApi } from '../../modules/hr/api';

export async function verifyPayrollAccessPin(pin: string): Promise<boolean> {
  const employees = await hrApi.employees.list();
  for (const employee of employees) {
    try {
      const result = await hrApi.employees.verifyPayrollPin(employee.id, pin);
      if (result.valid) return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes('404')) {
        throw new Error('Payroll PIN service unavailable. Restart the API: dotnet run --project src/Bisync.Api');
      }
      throw e;
    }
  }
  return false;
}
