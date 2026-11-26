"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FormSubmitButton } from "./form-submit-button";
import {
  activateEmployee,
  bulkEmployeeAction,
  deactivateEmployee,
  deleteEmployee,
} from "@/app/(app)/admin/users/actions";

type CompanyUser = {
  id: string;
  employee_id: string;
  full_name: string;
  email: string;
  account_status: string;
  department: unknown;
  designation: unknown;
};

export function BulkUsersTable({
  users,
  actorId,
}: {
  users: CompanyUser[];
  actorId: string;
}) {
  const selectableIds = users
    .filter((user) => user.id !== actorId)
    .map((user) => user.id);
  const [selected, setSelected] = useState<string[]>([]);
  const selectAllRef = useRef<HTMLInputElement>(null);
  const allSelected =
    selectableIds.length > 0 && selected.length === selectableIds.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selected.length > 0 && !allSelected;
    }
  }, [selected.length, allSelected]);

  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  return (
    <>
      <form
        id="bulk-user-form"
        action={bulkEmployeeAction}
        className="bulk-user-toolbar panel"
      >
        <div className="bulk-selection-summary" aria-live="polite">
          <span className="bulk-selection-count">{selected.length}</span>
          <span>
            <strong>
              {selected.length === 1 ? "user selected" : "users selected"}
            </strong>
            <small>Select rows below to manage several accounts together.</small>
          </span>
        </div>
        <div className="bulk-user-actions">
          <FormSubmitButton
            className="btn btn-sm btn-outline-success"
            pendingLabel="Activating…"
            name="bulk_action"
            value="activate"
            disabled={!selected.length}
          >
            <i className="ri-user-follow-line me-1" /> Activate
          </FormSubmitButton>
          <FormSubmitButton
            className="btn btn-sm btn-outline-warning"
            pendingLabel="Deactivating…"
            name="bulk_action"
            value="deactivate"
            disabled={!selected.length}
          >
            <i className="ri-user-unfollow-line me-1" /> Deactivate
          </FormSubmitButton>
          <FormSubmitButton
            className="btn btn-sm btn-outline-danger"
            pendingLabel="Deleting…"
            name="bulk_action"
            value="delete"
            disabled={!selected.length}
            confirmMessage={`Permanently delete ${selected.length} selected company user${selected.length === 1 ? "" : "s"}? Login access will be revoked while historical task records are preserved.`}
          >
            <i className="ri-delete-bin-line me-1" /> Delete
          </FormSubmitButton>
        </div>
      </form>

      <div className="panel table-responsive users-table-panel">
        <table className="table align-middle mb-0 users-table">
          <thead>
            <tr>
              <th className="user-select-cell">
                <label className="select-all-users">
                  <input
                    ref={selectAllRef}
                    className="form-check-input"
                    type="checkbox"
                    checked={allSelected}
                    disabled={!selectableIds.length}
                    aria-label="Select all company users"
                    onChange={() =>
                      setSelected(allSelected ? [] : selectableIds)
                    }
                  />
                  <span>Select all</span>
                </label>
              </th>
              <th>Company user</th>
              <th>Department</th>
              <th>Designation</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const isActor = user.id === actorId;
              const isSelected = selected.includes(user.id);
              return (
                <tr
                  key={user.id}
                  className={isSelected ? "user-row-selected" : undefined}
                >
                  <td className="user-select-cell" data-label="Select">
                    <input
                      form="bulk-user-form"
                      className="form-check-input"
                      type="checkbox"
                      name="user_ids"
                      value={user.id}
                      checked={isSelected}
                      disabled={isActor}
                      aria-label={`Select ${user.full_name}`}
                      title={
                        isActor
                          ? "You cannot bulk-manage your own account"
                          : undefined
                      }
                      onChange={() => toggle(user.id)}
                    />
                  </td>
                  <td data-label="Company user">
                    <strong>{user.full_name}</strong>
                    <small className="d-block text-secondary">
                      {user.employee_id} · {user.email}
                    </small>
                  </td>
                  <td data-label="Department">
                    {(user.department as { name?: string } | null)?.name ?? "—"}
                  </td>
                  <td data-label="Designation">
                    {(user.designation as { name?: string } | null)?.name ?? "—"}
                  </td>
                  <td data-label="Status">
                    <span
                      className={`status user-status-${user.account_status}`}
                    >
                      {user.account_status}
                    </span>
                  </td>
                  <td data-label="Actions">
                    <div className="user-row-actions">
                      <Link
                        className="btn btn-sm btn-outline-primary"
                        href={`/admin/users/${user.id}/edit`}
                      >
                        Edit
                      </Link>
                      {!isActor && (
                        <>
                          {user.account_status === "active" ? (
                            <form action={deactivateEmployee}>
                              <input type="hidden" name="id" value={user.id} />
                              <FormSubmitButton
                                className="btn btn-sm btn-outline-warning"
                                pendingLabel="Updating…"
                              >
                                Deactivate
                              </FormSubmitButton>
                            </form>
                          ) : (
                            <form action={activateEmployee}>
                              <input type="hidden" name="id" value={user.id} />
                              <FormSubmitButton
                                className="btn btn-sm btn-outline-success"
                                pendingLabel="Updating…"
                              >
                                Activate
                              </FormSubmitButton>
                            </form>
                          )}
                          <form action={deleteEmployee}>
                            <input type="hidden" name="id" value={user.id} />
                            <FormSubmitButton
                              className="btn btn-sm btn-outline-danger"
                              pendingLabel="Deleting…"
                              confirmMessage={`Delete ${user.full_name}? Their login will be revoked, while historical task records will be preserved.`}
                            >
                              Delete
                            </FormSubmitButton>
                          </form>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {!users.length && (
              <tr>
                <td colSpan={6} className="users-empty-state">
                  <i className="ri-team-line" aria-hidden="true" />
                  <strong>No company users found</strong>
                  <span>Create a company user to begin managing accounts.</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
