import { loadEnvConfig } from "@next/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
loadEnvConfig(process.cwd());
const departments = [
  ["PRES", "President's Office"],
  ["CORP", "Corporate Affairs"],
  ["PPM", "Projects & Property Management"],
  ["HR", "Human Resources"],
  ["CP", "Contracts & Procurement"],
  ["FIN", "Finance & Accounts"],
  ["WIND", "Wind Power Business"],
  ["ADMIN", "Administration"],
  ["LEGAL", "CS & Legal"],
  ["IT", "Information Technology"],
] as const;
type SeedPerson = {employee_id:string;full_name:string;designation:string;department:string;manager?:string};
const people: readonly SeedPerson[] = [
  {
    employee_id: "EMP001",
    full_name: "Siddhartha Agarwal",
    designation: "President",
    department: "PRES",
  },
  {
    employee_id: "EMP002",
    full_name: "Maqsood Ur Rahman Fazal",
    designation: "General Manager - Corporate Affairs",
    department: "CORP",
    manager: "EMP001",
  },
  {
    employee_id: "EMP003",
    full_name: "Badharinath B",
    designation: "General Manager - Projects & Property Management",
    department: "PPM",
    manager: "EMP001",
  },
  {
    employee_id: "EMP004",
    full_name: "Brinda A",
    designation: "Executive Assistant",
    department: "PRES",
    manager: "EMP001",
  },
  {
    employee_id: "EMP005",
    full_name: "Somnath Bose",
    designation: "Head - HR & Administration",
    department: "HR",
    manager: "EMP001",
  },
  {
    employee_id: "EMP006",
    full_name: "Arunkumar K",
    designation: "General Manager - Contracts & Procurement",
    department: "CP",
    manager: "EMP001",
  },
  {
    employee_id: "EMP007",
    full_name: "Ashish Gupta",
    designation: "Senior Manager - Finance & IT",
    department: "FIN",
    manager: "EMP005",
  },
  {
    employee_id: "EMP008",
    full_name: "Sham Sunder B V",
    designation: "Senior Manager",
    department: "WIND",
    manager: "EMP005",
  },
  {
    employee_id: "EMP009",
    full_name: "Sheela Dinesh Gowda",
    designation: "Senior Executive - Admin",
    department: "ADMIN",
    manager: "EMP005",
  },
  {
    employee_id: "EMP010",
    full_name: "Deepshikha Gharami",
    designation: "Executive - HR",
    department: "HR",
    manager: "EMP005",
  },
  {
    employee_id: "EMP011",
    full_name: "Vinod Kuddannavar",
    designation: "Company Secretary",
    department: "LEGAL",
    manager: "EMP005",
  },
  {
    employee_id: "EMP012",
    full_name: "Basavanagoud Akkund",
    designation: "Senior HR Compliance Officer",
    department: "HR",
    manager: "EMP005",
  },
  {
    employee_id: "EMP013",
    full_name: "Kailash Chandra Behera",
    designation: "Senior Executive - Finance",
    department: "FIN",
    manager: "EMP007",
  },
  {
    employee_id: "EMP014",
    full_name: "Laxman Bekanal",
    designation: "Assistant Manager - Finance",
    department: "FIN",
    manager: "EMP007",
  },
  {
    employee_id: "EMP015",
    full_name: "Mohammed Zulkar Nain",
    designation: "Assistant Manager - IT",
    department: "IT",
    manager: "EMP007",
  },
  {
    employee_id: "EMP016",
    full_name: "Sharath Kumar N",
    designation: "Finance Executive",
    department: "FIN",
    manager: "EMP007",
  },
];
const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.|\.$/g, "");
async function transition(
  client: SupabaseClient,
  taskId: string,
  status: string,
) {
  const { error } = await client.rpc("transition_task", {
    p_task_id: taskId,
    p_new_status: status,
    p_remarks: `Workflow verification: ${status.replaceAll("_", " ")}`,
  });
  if (error) throw error;
}
async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
    service = process.env.SUPABASE_SERVICE_ROLE_KEY!,
    publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .select("id")
    .eq("active", true)
    .order("created_at")
    .limit(1)
    .single();
  if (orgError) throw orgError;
  const departmentIds = new Map<string, string>();
  for (const [code, name] of departments) {
    const { data, error } = await admin
      .from("departments")
      .upsert(
        { organization_id: org.id, code, name, active: true },
        { onConflict: "organization_id,code" },
      )
      .select("id")
      .single();
    if (error) throw error;
    departmentIds.set(code, data.id);
  }
  const designationIds = new Map<string, string>();
  for (const name of [...new Set(people.map((p) => p.designation))]) {
    const { data, error } = await admin
      .from("designations")
      .upsert(
        { organization_id: org.id, name, active: true },
        { onConflict: "organization_id,name" },
      )
      .select("id")
      .single();
    if (error) throw error;
    designationIds.set(name, data.id);
  }
  let { data: employeeRole } = await admin
    .from("roles")
    .select("id")
    .eq("organization_id", org.id)
    .eq("system_key", "employee")
    .maybeSingle();
  if (!employeeRole) {
    const made = await admin
      .from("roles")
      .insert({
        organization_id: org.id,
        name: "Company User",
        system_key: "employee",
        description: "Standard operational company user",
      })
      .select("id")
      .single();
    if (made.error) throw made.error;
    employeeRole = made.data;
  }
  const { data: perms } = await admin
    .from("permissions")
    .select("id,key")
    .in("key", [
      "tasks.create",
      "tasks.update",
      "tasks.start",
      "tasks.comment",
      "evidence.upload",
      "tasks.request_extension",
      "tasks.view_own",
    ]);
  if (perms?.length)
    await admin.from("role_permissions").upsert(
      perms.map((p) => ({ role_id: employeeRole!.id, permission_id: p.id })),
      { onConflict: "role_id,permission_id" },
    );
  const userIds = new Map<string, string>(),
    passwords = new Map<string, string>(),
    emails = new Map<string, string>();
  const existing = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (existing.error) throw existing.error;
  for (const person of people) {
    const email = `${slug(person.full_name)}@opsora.example`;
    const password = `Ops!${randomBytes(18).toString("base64url")}9a`;
    let user = existing.data.users.find((u) => u.email === email);
    if (!user) {
      const made = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: person.full_name },
      });
      if (made.error) throw made.error;
      user = made.data.user;
    } else {
      const changed = await admin.auth.admin.updateUserById(user.id, {
        password,
        email_confirm: true,
        user_metadata: { full_name: person.full_name },
      });
      if (changed.error) throw changed.error;
      user = changed.data.user;
    }
    userIds.set(person.employee_id, user.id);
    passwords.set(person.employee_id, password);
    emails.set(person.employee_id, email);
    const { error } = await admin
      .from("profiles")
      .upsert(
        {
          id: user.id,
          organization_id: org.id,
          employee_id: person.employee_id,
          full_name: person.full_name,
          email,
          department_id: departmentIds.get(person.department),
          designation_id: designationIds.get(person.designation),
          account_status: "active",
          force_password_change: false,
        },
        { onConflict: "id" },
      );
    if (error) throw error;
    await admin
      .from("organization_memberships")
      .upsert(
        { organization_id: org.id, user_id: user.id, active: true },
        { onConflict: "organization_id,user_id" },
      );
    await admin
      .from("user_roles")
      .upsert(
        { organization_id: org.id, user_id: user.id, role_id: employeeRole.id },
        { onConflict: "user_id,role_id" },
      );
  }
  for (const person of people) {
    if (person.manager)
      await admin
        .from("profiles")
        .update({ reporting_manager_id: userIds.get(person.manager) })
        .eq("id", userIds.get(person.employee_id)!);
  }
  const heads: Record<string, string> = {
    PRES: "EMP001",
    CORP: "EMP002",
    PPM: "EMP003",
    HR: "EMP005",
    CP: "EMP006",
    FIN: "EMP007",
    WIND: "EMP008",
    ADMIN: "EMP009",
    LEGAL: "EMP011",
    IT: "EMP015",
  };
  for (const [code, employee] of Object.entries(heads))
    await admin
      .from("departments")
      .update({ head_id: userIds.get(employee) })
      .eq("id", departmentIds.get(code)!);
  const workflows = [
    ["President briefing preparation", "EMP001", "EMP004"],
    ["Company user compliance register review", "EMP005", "EMP010"],
    ["Monthly finance reconciliation", "EMP007", "EMP013"],
    ["Project information dashboard update", "EMP003", "EMP015"],
    ["Procurement documentation verification", "EMP006", "EMP009"],
  ] as const;
  let completed = 0;
  for (const [title, creatorCode, assigneeCode] of workflows) {
    const existingTask = await admin
      .from("tasks")
      .select("id,status")
      .eq("organization_id", org.id)
      .eq("title", title)
      .maybeSingle();
    if (existingTask.data?.status === "closed") {
      completed++;
      continue;
    }
    const creatorId = userIds.get(creatorCode)!,
      assigneeId = userIds.get(assigneeCode)!;
    const due = new Date(Date.now() + 86400000).toISOString();
    const { data: task, error } = await admin
      .from("tasks")
      .insert({
        organization_id: org.id,
        title,
        description: `Operational workflow verification for ${title}.`,
        created_by: creatorId,
        assigned_by: creatorId,
        primary_owner_id: assigneeId,
        approver_id: creatorId,
        priority: "normal",
        original_deadline: due,
        current_deadline: due,
        evidence_required: false,
        approval_required: true,
        status: "assigned",
      })
      .select("id")
      .single();
    if (error) throw error;
    const assignee = createClient(url, publishable, {
      auth: { persistSession: false },
    });
    const assigneeLogin = await assignee.auth.signInWithPassword({
      email: emails.get(assigneeCode)!,
      password: passwords.get(assigneeCode)!,
    });
    if (assigneeLogin.error) throw assigneeLogin.error;
    for (const status of [
      "acknowledged",
      "accepted",
      "in_progress",
      "pending_verification",
    ])
      await transition(assignee, task.id, status);
    await assignee.auth.signOut();
    const creator = createClient(url, publishable, {
      auth: { persistSession: false },
    });
    const creatorLogin = await creator.auth.signInWithPassword({
      email: emails.get(creatorCode)!,
      password: passwords.get(creatorCode)!,
    });
    if (creatorLogin.error) throw creatorLogin.error;
    await transition(creator, task.id, "closed");
    await creator.auth.signOut();
    const check = await admin
      .from("tasks")
      .select("status,closed_at")
      .eq("id", task.id)
      .single();
    if (check.error || check.data.status !== "closed" || !check.data.closed_at)
      throw check.error ?? new Error(`Task did not close: ${title}`);
    completed++;
  }
  console.log(`PASS ${departments.length} departments`);
  console.log(`PASS ${designationIds.size} designations`);
  console.log(
    `PASS ${people.length} company user accounts and reporting relationships`,
  );
  console.log(
    `PASS ${completed} authenticated task lifecycles through closure`,
  );
  console.log(
    "Seed completed; company user passwords are intentionally not printed and can be reset by a Company Admin.",
  );
}
main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Organization seed failed",
  );
  process.exit(1);
});
