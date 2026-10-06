// Onboarding: pure data-shaping layer for the workforce dashboard. Keep complex
// employee/crew math here so `employees-page.tsx` can stay focused on UI.
// Tests for these calculations live in `dashboard-data.test.ts`.
import {
  EMPLOYMENT_TYPE_LABELS,
  PAY_TYPE_LABELS,
  type CrewProfile,
  type EmployeeProfile,
  type EmploymentType,
  type PayType,
  type WorkforceJob,
  type WorkforcePayment,
} from "./types";

type BreakdownItem = {
  key: string;
  label: string;
  count: number;
  pct: number;
};

export type WorkforceSummary = {
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  assignedEmployees: number;
  unassignedEmployees: number;
  totalCrews: number;
  activeCrews: number;
  recentEmployees: number;
  employeesWithActiveJobs: number;
  employeesWithCompletedJobs: number;
  payrollLoggedCents: number;
  employeePayrollLoggedCents: number;
  crewPayrollLoggedCents: number;
  avgHourlyRate: number | null;
  avgSalary: number | null;
};

export type WorkforceAssignmentLoadRow = {
  id: string;
  label: string;
  kind: "employee" | "crew";
  activeJobs: number;
  completedJobs: number;
};

export type WorkforceCrewOverviewRow = {
  id: string;
  label: string;
  members: number;
  activeJobs: number;
  completedJobs: number;
  payrollLoggedCents: number;
  crewLeadName: string | null;
  specialization: string | null;
  isActive: boolean;
};

export type WorkforceEmployeeRosterRow = {
  employee: EmployeeProfile;
  crewNames: string[];
  activeJobs: number;
  completedJobs: number;
  directPayrollLoggedCents: number;
  isRecentlyAdded: boolean;
};

export type WorkforceActivityItem = {
  id: string;
  kind: "employee_added" | "job_completed" | "payroll_logged";
  title: string;
  detail: string;
  at: string;
};

export type WorkforceAlertItem = {
  id: string;
  tone: "info" | "warning";
  kind: "employee" | "crew";
  subject: string;
  title: string;
  detail: string;
};

export type WorkforceDashboardModel = {
  summary: WorkforceSummary;
  statusBreakdown: BreakdownItem[];
  employmentTypeBreakdown: BreakdownItem[];
  payTypeBreakdown: Array<BreakdownItem & { avgRate: number | null }>;
  assignmentLoad: WorkforceAssignmentLoadRow[];
  crewOverview: WorkforceCrewOverviewRow[];
  employeeRoster: WorkforceEmployeeRosterRow[];
  recentEmployees: EmployeeProfile[];
  activity: WorkforceActivityItem[];
  alerts: WorkforceAlertItem[];
};

type BuildWorkforceDashboardModelInput = {
  employees: EmployeeProfile[];
  crews: CrewProfile[];
  jobs: WorkforceJob[];
  payments: WorkforcePayment[];
  now?: Date | string;
};

function toTimestamp(value: Date | string | null | undefined) {
  if (!value) return Number.NEGATIVE_INFINITY;
  const date = value instanceof Date ? value : new Date(value);
  const timestamp = date.getTime();
  return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function buildBreakdown(
  items: Array<{ key: string; label: string; count: number }>,
  total: number,
) {
  if (total === 0) return [] as BreakdownItem[];

  return items
    .filter((item) => item.count > 0)
    .map((item) => ({
      ...item,
      pct: Math.round((item.count / total) * 100),
    }));
}

export function buildWorkforceDashboardModel({
  employees,
  crews,
  jobs,
  payments,
  now = new Date(),
}: BuildWorkforceDashboardModelInput): WorkforceDashboardModel {
  const nowTimestamp = toTimestamp(now);
  const recentThreshold = nowTimestamp - 30 * 24 * 60 * 60 * 1000;

  const employeeCrewNames = new Map<string, string[]>();
  const assignedEmployeeIds = new Set<string>();

  for (const crew of crews) {
    const participantIds = new Set(
      [crew.crew_lead_id, ...crew.member_ids].filter(
        (value): value is string => Boolean(value),
      ),
    );

    for (const employeeId of participantIds) {
      assignedEmployeeIds.add(employeeId);
      const names = employeeCrewNames.get(employeeId) ?? [];
      names.push(crew.name);
      employeeCrewNames.set(employeeId, names);
    }
  }

  const directActiveJobsByEmployeeId = new Map<string, number>();
  const directCompletedJobsByEmployeeId = new Map<string, number>();
  const activeParticipationJobsByEmployeeId = new Map<string, number>();
  const completedParticipationJobsByEmployeeId = new Map<string, number>();
  const activeJobsByCrewId = new Map<string, number>();
  const completedJobsByCrewId = new Map<string, number>();
  const activeEmployeesWithJobs = new Set<string>();
  const employeesWithCompletedJobs = new Set<string>();

  for (const job of jobs) {
    if (!job.completed_by_id || !job.completed_by_type) continue;

    if (job.completed_by_type === "employee") {
      const targetMap = job.is_completed
        ? directCompletedJobsByEmployeeId
        : directActiveJobsByEmployeeId;
      targetMap.set(
        job.completed_by_id,
        (targetMap.get(job.completed_by_id) ?? 0) + 1,
      );

      const participationMap = job.is_completed
        ? completedParticipationJobsByEmployeeId
        : activeParticipationJobsByEmployeeId;
      participationMap.set(
        job.completed_by_id,
        (participationMap.get(job.completed_by_id) ?? 0) + 1,
      );

      if (job.is_completed) {
        employeesWithCompletedJobs.add(job.completed_by_id);
      } else {
        activeEmployeesWithJobs.add(job.completed_by_id);
      }
      continue;
    }

    const targetMap = job.is_completed ? completedJobsByCrewId : activeJobsByCrewId;
    targetMap.set(job.completed_by_id, (targetMap.get(job.completed_by_id) ?? 0) + 1);

    const crew = crews.find((entry) => entry.id === job.completed_by_id);
    const participantIds = new Set(
      [crew?.crew_lead_id, ...(crew?.member_ids ?? [])].filter(
        (value): value is string => Boolean(value),
      ),
    );

    for (const employeeId of participantIds) {
      const participationMap = job.is_completed
        ? completedParticipationJobsByEmployeeId
        : activeParticipationJobsByEmployeeId;
      participationMap.set(
        employeeId,
        (participationMap.get(employeeId) ?? 0) + 1,
      );

      if (job.is_completed) {
        employeesWithCompletedJobs.add(employeeId);
      } else {
        activeEmployeesWithJobs.add(employeeId);
      }
    }
  }

  const directPayrollByEmployeeId = new Map<string, number>();
  const payrollByCrewId = new Map<string, number>();
  let employeePayrollLoggedCents = 0;
  let crewPayrollLoggedCents = 0;

  for (const payment of payments) {
    if (payment.refunded_at) continue;

    if (payment.paid_to_type === "employee") {
      directPayrollByEmployeeId.set(
        payment.paid_to_id,
        (directPayrollByEmployeeId.get(payment.paid_to_id) ?? 0) +
          payment.amount_cents,
      );
      employeePayrollLoggedCents += payment.amount_cents;
      continue;
    }

    payrollByCrewId.set(
      payment.paid_to_id,
      (payrollByCrewId.get(payment.paid_to_id) ?? 0) + payment.amount_cents,
    );
    crewPayrollLoggedCents += payment.amount_cents;
  }

  const totalEmployees = employees.length;
  const activeEmployees = employees.filter((employee) => employee.is_active).length;
  const inactiveEmployees = totalEmployees - activeEmployees;
  const recentEmployees = [...employees]
    .sort((left, right) => toTimestamp(right.created_at) - toTimestamp(left.created_at))
    .filter((employee) => toTimestamp(employee.created_at) >= recentThreshold);

  const hourlyRates = employees
    .filter((employee) => employee.pay_type === "hourly")
    .map((employee) => employee.hourly_rate)
    .filter((value): value is number => value != null);
  const salaryRates = employees
    .filter((employee) => employee.pay_type === "salary")
    .map((employee) => employee.hourly_rate)
    .filter((value): value is number => value != null);

  const avgHourlyRate =
    hourlyRates.length > 0
      ? hourlyRates.reduce((sum, value) => sum + value, 0) / hourlyRates.length
      : null;
  const avgSalary =
    salaryRates.length > 0
      ? salaryRates.reduce((sum, value) => sum + value, 0) / salaryRates.length
      : null;

  const statusBreakdown = buildBreakdown(
    [
      { key: "active", label: "Active", count: activeEmployees },
      { key: "inactive", label: "Inactive", count: inactiveEmployees },
    ],
    totalEmployees,
  );

  const employmentTypeCounts = new Map<string, number>();
  const payTypeCounts = new Map<string, number>();
  const payTypeRates = new Map<string, number[]>();

  for (const employee of employees) {
    const employmentTypeKey = employee.employment_type ?? "unspecified";
    employmentTypeCounts.set(
      employmentTypeKey,
      (employmentTypeCounts.get(employmentTypeKey) ?? 0) + 1,
    );

    const payTypeKey = employee.pay_type ?? "unspecified";
    payTypeCounts.set(payTypeKey, (payTypeCounts.get(payTypeKey) ?? 0) + 1);

    if (employee.hourly_rate != null && employee.pay_type) {
      const rateList = payTypeRates.get(payTypeKey) ?? [];
      rateList.push(employee.hourly_rate);
      payTypeRates.set(payTypeKey, rateList);
    }
  }

  const employmentTypeBreakdown = buildBreakdown(
    (
      [
        "full_time",
        "part_time",
        "contractor",
        "unspecified",
      ] as Array<EmploymentType | "unspecified">
    ).map((key) => ({
      key,
      label:
        key === "unspecified"
          ? "Unspecified"
          : EMPLOYMENT_TYPE_LABELS[key as EmploymentType],
      count: employmentTypeCounts.get(key) ?? 0,
    })),
    totalEmployees,
  );

  const payTypeBreakdown =
    totalEmployees === 0
      ? []
      : (
          ["hourly", "salary", "per_job", "unspecified"] as Array<
            PayType | "unspecified"
          >
        )
          .map((key) => {
            const count = payTypeCounts.get(key) ?? 0;
            const rateList = payTypeRates.get(key) ?? [];
            return {
              key,
              label:
                key === "unspecified"
                  ? "Unspecified"
                  : PAY_TYPE_LABELS[key as PayType],
              count,
              pct: count > 0 ? Math.round((count / totalEmployees) * 100) : 0,
              avgRate:
                rateList.length > 0
                  ? rateList.reduce((sum, value) => sum + value, 0) /
                    rateList.length
                  : null,
            };
          })
          .filter((item) => item.count > 0);

  const assignmentLoad = [
    ...employees.map<WorkforceAssignmentLoadRow>((employee) => ({
      id: employee.id,
      label: employee.name,
      kind: "employee",
      activeJobs: directActiveJobsByEmployeeId.get(employee.id) ?? 0,
      completedJobs: directCompletedJobsByEmployeeId.get(employee.id) ?? 0,
    })),
    ...crews.map<WorkforceAssignmentLoadRow>((crew) => ({
      id: crew.id,
      label: crew.name,
      kind: "crew",
      activeJobs: activeJobsByCrewId.get(crew.id) ?? 0,
      completedJobs: completedJobsByCrewId.get(crew.id) ?? 0,
    })),
  ]
    .filter((row) => row.activeJobs > 0 || row.completedJobs > 0)
    .sort((left, right) => {
      const rightTotal = right.activeJobs + right.completedJobs;
      const leftTotal = left.activeJobs + left.completedJobs;
      if (rightTotal !== leftTotal) return rightTotal - leftTotal;
      if (right.activeJobs !== left.activeJobs) return right.activeJobs - left.activeJobs;
      return left.label.localeCompare(right.label);
    })
    .slice(0, 8);

  const crewOverview = [...crews]
    .map<WorkforceCrewOverviewRow>((crew) => ({
      id: crew.id,
      label: crew.name,
      members: new Set(
        [crew.crew_lead_id, ...crew.member_ids].filter(
          (value): value is string => Boolean(value),
        ),
      ).size,
      activeJobs: activeJobsByCrewId.get(crew.id) ?? 0,
      completedJobs: completedJobsByCrewId.get(crew.id) ?? 0,
      payrollLoggedCents: payrollByCrewId.get(crew.id) ?? 0,
      crewLeadName: crew.crew_lead_name,
      specialization: crew.specialization,
      isActive: crew.is_active,
    }))
    .sort((left, right) => {
      const rightPriority =
        right.activeJobs * 1000 + right.members * 100 + right.completedJobs * 10;
      const leftPriority =
        left.activeJobs * 1000 + left.members * 100 + left.completedJobs * 10;
      if (rightPriority !== leftPriority) return rightPriority - leftPriority;
      return left.label.localeCompare(right.label);
    });

  const employeeRoster = [...employees]
    .map<WorkforceEmployeeRosterRow>((employee) => ({
      employee,
      crewNames: (employeeCrewNames.get(employee.id) ?? []).sort((left, right) =>
        left.localeCompare(right),
      ),
      activeJobs: activeParticipationJobsByEmployeeId.get(employee.id) ?? 0,
      completedJobs: completedParticipationJobsByEmployeeId.get(employee.id) ?? 0,
      directPayrollLoggedCents: directPayrollByEmployeeId.get(employee.id) ?? 0,
      isRecentlyAdded: toTimestamp(employee.created_at) >= recentThreshold,
    }))
    .sort((left, right) => {
      if (left.employee.is_active !== right.employee.is_active) {
        return left.employee.is_active ? -1 : 1;
      }
      const rightWorkload = right.activeJobs + right.completedJobs;
      const leftWorkload = left.activeJobs + left.completedJobs;
      if (rightWorkload !== leftWorkload) return rightWorkload - leftWorkload;
      return left.employee.name.localeCompare(right.employee.name);
    });

  const activity = [
    ...recentEmployees.map<WorkforceActivityItem>((employee) => ({
      id: `employee-${employee.id}`,
      kind: "employee_added",
      title: `Added employee ${employee.name}`,
      detail: employee.job_title ?? employee.role ?? "Workforce profile created",
      at: employee.created_at,
    })),
    ...jobs
      .filter((job) => job.is_completed && job.completed_at)
      .map<WorkforceActivityItem>((job) => ({
        id: `job-${job.id}`,
        kind: "job_completed",
        title: `Job completed by ${job.completed_by_name ?? "Unassigned"}`,
        detail: `${job.title} · ${job.project_address}`,
        at: job.completed_at ?? job.created_at,
      })),
    ...payments
      .filter((payment) => !payment.refunded_at)
      .map<WorkforceActivityItem>((payment) => {
        const crew = crews.find((entry) => entry.id === payment.paid_to_id);
        const employee = employees.find((entry) => entry.id === payment.paid_to_id);
        const payeeName =
          payment.paid_to_type === "crew"
            ? crew?.name ?? "Crew"
            : employee?.name ?? "Employee";

        return {
          id: `payment-${payment.id}`,
          kind: "payroll_logged",
          title: `Payroll recorded for ${payeeName}`,
          detail: `${(payment.amount_cents / 100).toLocaleString("en-US", {
            style: "currency",
            currency: "USD",
            maximumFractionDigits: 0,
          })} · ${payment.paid_to_type}`,
          at: payment.paid_at,
        };
      }),
  ]
    .sort((left, right) => toTimestamp(right.at) - toTimestamp(left.at))
    .slice(0, 8);

  const alerts: WorkforceAlertItem[] = [
    // Warnings first: unassigned active employees
    ...employees
      .filter((employee) => employee.is_active && !assignedEmployeeIds.has(employee.id))
      .map((employee) => ({
        id: `unassigned-${employee.id}`,
        tone: "warning" as const,
        kind: "employee" as const,
        subject: employee.name,
        title: "Not assigned to a crew",
        detail: "Move into a crew to improve scheduling visibility.",
      })),
    // Warnings: active crews with no lead
    ...crews
      .filter((crew) => crew.is_active && !crew.crew_lead_id)
      .map((crew) => ({
        id: `no-lead-${crew.id}`,
        tone: "warning" as const,
        kind: "crew" as const,
        subject: crew.name,
        title: "No crew lead assigned",
        detail: "Assign a lead to strengthen accountability and reporting.",
      })),
    // Info: active employees missing pay type
    ...employees
      .filter((employee) => employee.is_active && !employee.pay_type)
      .map((employee) => ({
        id: `missing-pay-${employee.id}`,
        tone: "info" as const,
        kind: "employee" as const,
        subject: employee.name,
        title: "Missing pay settings",
        detail: "Add a pay type so payroll and analytics stay accurate.",
      })),
    // Info: inactive employees still in a crew
    ...employees
      .filter((employee) => !employee.is_active && assignedEmployeeIds.has(employee.id))
      .map((employee) => ({
        id: `inactive-assigned-${employee.id}`,
        tone: "info" as const,
        kind: "employee" as const,
        subject: employee.name,
        title: "Inactive but still assigned to a crew",
        detail: "Review crew membership to keep capacity totals accurate.",
      })),
  ];

  return {
    summary: {
      totalEmployees,
      activeEmployees,
      inactiveEmployees,
      assignedEmployees: assignedEmployeeIds.size,
      unassignedEmployees: Math.max(totalEmployees - assignedEmployeeIds.size, 0),
      totalCrews: crews.length,
      activeCrews: crews.filter((crew) => crew.is_active).length,
      recentEmployees: recentEmployees.length,
      employeesWithActiveJobs: activeEmployeesWithJobs.size,
      employeesWithCompletedJobs: employeesWithCompletedJobs.size,
      payrollLoggedCents: employeePayrollLoggedCents + crewPayrollLoggedCents,
      employeePayrollLoggedCents,
      crewPayrollLoggedCents,
      avgHourlyRate,
      avgSalary,
    },
    statusBreakdown,
    employmentTypeBreakdown,
    payTypeBreakdown,
    assignmentLoad,
    crewOverview,
    employeeRoster,
    recentEmployees: recentEmployees.slice(0, 5),
    activity,
    alerts,
  };
}
