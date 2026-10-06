import { describe, expect, it } from "vitest";
import { buildWorkforceDashboardModel } from "@/components/employees/dashboard-data";
import type {
  CrewProfile,
  EmployeeProfile,
  WorkforceJob,
  WorkforcePayment,
} from "@/components/employees/types";

const employees: EmployeeProfile[] = [
  {
    id: "emp-1",
    name: "Alice Johnson",
    contact_info: null,
    role: "Framing",
    job_title: "Lead Framer",
    employment_type: "full_time",
    is_active: true,
    email: "alice@example.com",
    login_handle: null,
    password_must_change: false,
    last_login_at: null,
    phone: null,
    address: null,
    hourly_rate: 32,
    pay_type: "hourly",
    hire_date: "2026-02-01",
    payment_method: "check",
    payment_details: null,
    notes: null,
    created_at: "2026-04-07T08:00:00.000Z",
  },
  {
    id: "emp-2",
    name: "Brandon Lee",
    contact_info: null,
    role: "Electrical",
    job_title: "Foreman",
    employment_type: "full_time",
    is_active: true,
    email: "brandon@example.com",
    login_handle: null,
    password_must_change: false,
    last_login_at: null,
    phone: null,
    address: null,
    hourly_rate: 68000,
    pay_type: "salary",
    hire_date: "2025-11-10",
    payment_method: "wire",
    payment_details: null,
    notes: null,
    created_at: "2026-03-29T08:00:00.000Z",
  },
  {
    id: "emp-3",
    name: "Chris Martin",
    contact_info: null,
    role: "Labor",
    job_title: null,
    employment_type: "part_time",
    is_active: false,
    email: null,
    login_handle: null,
    password_must_change: false,
    last_login_at: null,
    phone: null,
    address: null,
    hourly_rate: null,
    pay_type: null,
    hire_date: null,
    payment_method: null,
    payment_details: null,
    notes: null,
    created_at: "2025-12-01T08:00:00.000Z",
  },
];

const crews: CrewProfile[] = [
  {
    id: "crew-1",
    name: "North Crew",
    notes: null,
    description: "Handles framing installs",
    crew_lead_id: "emp-1",
    crew_lead_name: "Alice Johnson",
    specialization: "Framing",
    is_active: true,
    created_at: "2026-01-10T08:00:00.000Z",
    member_ids: ["emp-3"],
    member_names: ["Chris Martin"],
  },
];

const jobs: WorkforceJob[] = [
  {
    id: "job-1",
    title: "Frame living room",
    project_id: "proj-1",
    project_address: "101 Main St",
    created_at: "2026-04-01T08:00:00.000Z",
    is_completed: false,
    completed_at: null,
    completed_by_type: "employee",
    completed_by_id: "emp-1",
    completed_by_name: "Alice Johnson",
  },
  {
    id: "job-2",
    title: "Wire kitchen",
    project_id: "proj-1",
    project_address: "101 Main St",
    created_at: "2026-03-25T08:00:00.000Z",
    is_completed: true,
    completed_at: "2026-04-05T08:00:00.000Z",
    completed_by_type: "employee",
    completed_by_id: "emp-2",
    completed_by_name: "Brandon Lee",
  },
  {
    id: "job-3",
    title: "Frame garage",
    project_id: "proj-2",
    project_address: "55 Cedar Ave",
    created_at: "2026-04-02T08:00:00.000Z",
    is_completed: false,
    completed_at: null,
    completed_by_type: "crew",
    completed_by_id: "crew-1",
    completed_by_name: "North Crew",
  },
  {
    id: "job-4",
    title: "Frame patio cover",
    project_id: "proj-3",
    project_address: "22 Oak Dr",
    created_at: "2026-03-28T08:00:00.000Z",
    is_completed: true,
    completed_at: "2026-04-06T08:00:00.000Z",
    completed_by_type: "crew",
    completed_by_id: "crew-1",
    completed_by_name: "North Crew",
  },
];

const payments: WorkforcePayment[] = [
  {
    id: "pay-1",
    job_id: "job-1",
    paid_to_type: "employee",
    paid_to_id: "emp-1",
    amount_cents: 125000,
    paid_at: "2026-04-08T08:00:00.000Z",
    refunded_at: null,
  },
  {
    id: "pay-2",
    job_id: "job-4",
    paid_to_type: "crew",
    paid_to_id: "crew-1",
    amount_cents: 260000,
    paid_at: "2026-04-08T09:00:00.000Z",
    refunded_at: null,
  },
  {
    id: "pay-3",
    job_id: "job-3",
    paid_to_type: "crew",
    paid_to_id: "crew-1",
    amount_cents: 50000,
    paid_at: "2026-04-04T09:00:00.000Z",
    refunded_at: "2026-04-05T09:00:00.000Z",
  },
];

describe("buildWorkforceDashboardModel", () => {
  it("derives summary metrics, participation, payroll totals, and crew insights", () => {
    const model = buildWorkforceDashboardModel({
      employees,
      crews,
      jobs,
      payments,
      now: "2026-04-09T12:00:00.000Z",
    });

    expect(model.summary.totalEmployees).toBe(3);
    expect(model.summary.activeEmployees).toBe(2);
    expect(model.summary.inactiveEmployees).toBe(1);
    expect(model.summary.assignedEmployees).toBe(2);
    expect(model.summary.unassignedEmployees).toBe(1);
    expect(model.summary.employeesWithActiveJobs).toBe(2);
    expect(model.summary.employeesWithCompletedJobs).toBe(3);
    expect(model.summary.recentEmployees).toBe(2);
    expect(model.summary.payrollLoggedCents).toBe(385000);
    expect(model.summary.employeePayrollLoggedCents).toBe(125000);
    expect(model.summary.crewPayrollLoggedCents).toBe(260000);
    expect(model.summary.avgHourlyRate).toBe(32);
    expect(model.summary.avgSalary).toBe(68000);

    expect(model.assignmentLoad[0]).toMatchObject({
      label: "North Crew",
      kind: "crew",
      activeJobs: 1,
      completedJobs: 1,
    });

    expect(model.crewOverview[0]).toMatchObject({
      label: "North Crew",
      members: 2,
      activeJobs: 1,
      completedJobs: 1,
      payrollLoggedCents: 260000,
      crewLeadName: "Alice Johnson",
    });

    expect(model.recentEmployees.map((employee) => employee.name)).toEqual([
      "Alice Johnson",
      "Brandon Lee",
    ]);
    expect(model.activity[0]).toMatchObject({
      kind: "payroll_logged",
      title: "Payroll recorded for North Crew",
    });
  });

  it("returns empty-safe defaults", () => {
    const model = buildWorkforceDashboardModel({
      employees: [],
      crews: [],
      jobs: [],
      payments: [],
      now: "2026-04-09T12:00:00.000Z",
    });

    expect(model.summary.totalEmployees).toBe(0);
    expect(model.summary.payrollLoggedCents).toBe(0);
    expect(model.statusBreakdown).toEqual([]);
    expect(model.assignmentLoad).toEqual([]);
    expect(model.crewOverview).toEqual([]);
    expect(model.activity).toEqual([]);
  });
});
