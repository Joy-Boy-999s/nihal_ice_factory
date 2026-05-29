import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserHelpService, PlantService } from '@nihal-ice-factory/shared-services';
import {
  CommonResponse,
  CreateUserModel,
  PlantDto,
  ResponsePayloadRecord,
  UserRole,
  UserSummaryDto,
} from '@nihal-ice-factory/shared-models';
import {
  Button,
  Card,
  Column,
  DataTable,
  Field,
  Input,
  Modal,
  PageHeader,
  Select,
  useToast,
} from '../../components';
import { buildAuthConfig, logout } from '../../lib/auth';
import { EditIcon, PlusIcon, SearchIcon, TrashIcon, UserIcon } from '../../layout/nav-icons';
import './UserManagement.css';

interface CatchError {
  response?: { status?: number; data?: { internalMessage?: string } };
  message?: string;
}

interface CreateForm {
  username: string;
  email: string;
  password: string;
  role: UserRole;
}

const PASSWORD_RE =
  /^(?=(.*[a-z]){2,})(?=(.*[A-Z]){1,})(?=(.*\d){1,})(?=(.*[@$!%*?&#_+\-/]){2,})[A-Za-z\d@$!%*?&#_+\-/]{8,}$/;

const emptyCreateForm = (): CreateForm => ({
  username: '',
  email: '',
  password: '',
  role: UserRole.USER,
});

function unwrap<T>(res: CommonResponse): T | null {
  if (!res?.status) return null;
  const data = res.data as ResponsePayloadRecord | null;
  if (!data) return null;
  const inner = data['data'] as T | undefined;
  return inner !== undefined ? inner : (data as unknown as T);
}

// ── Component ─────────────────────────────────────────────────────────────────

const UserManagement: React.FC = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const userService  = useMemo(() => new UserHelpService(), []);
  const plantService = useMemo(() => new PlantService(), []);

  // ── Data ──────────────────────────────────────────────────────────────────

  const [users, setUsers]   = useState<UserSummaryDto[]>([]);
  const [plants, setPlants] = useState<PlantDto[]>([]);
  const [loading, setLoading] = useState(false);

  // plantId → Set of userId (who has access)
  const [accessMap, setAccessMap] = useState<Record<number, Set<string>>>({});
  const [accessLoading, setAccessLoading] = useState(false);

  const [query, setQuery] = useState('');

  // ── Auth error helper ──────────────────────────────────────────────────────

  const handleAuthError = useCallback(
    (err: CatchError): boolean => {
      if (err?.response?.status === 401) {
        logout();
        toast.error('Session expired. Please sign in again.');
        navigate('/login', { replace: true });
        return true;
      }
      return false;
    },
    [navigate, toast],
  );

  // ── Fetch users + plants ───────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, plantsRes] = await Promise.all([
        userService.getAllUsers(buildAuthConfig()),
        plantService.getAllPlants(buildAuthConfig()),
      ]);

      if (usersRes?.status) {
        const raw = unwrap<UserSummaryDto[]>(usersRes);
        setUsers(Array.isArray(raw) ? raw : []);
      } else {
        throw new Error(usersRes?.internalMessage || 'Failed to load users');
      }

      if (plantsRes?.status) {
        const raw = unwrap<PlantDto[]>(plantsRes);
        setPlants(Array.isArray(raw) ? raw : []);
      }
    } catch (err) {
      const e = err as CatchError;
      if (!handleAuthError(e)) toast.error(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [userService, plantService, toast, handleAuthError]);

  // Fetch user access for every plant
  const fetchAccessMap = useCallback(async (plantList: PlantDto[]) => {
    if (!plantList.length) return;
    setAccessLoading(true);
    try {
      const results = await Promise.all(
        plantList.map((p) =>
          plantService.getUsersForPlant(p.id, buildAuthConfig()).then((res) => ({
            plantId: p.id,
            res,
          })),
        ),
      );
      const map: Record<number, Set<string>> = {};
      for (const { plantId, res } of results) {
        const raw = unwrap<{ userId: string }[]>(res);
        map[plantId] = new Set(
          Array.isArray(raw) ? raw.map((r) => r.userId) : [],
        );
      }
      setAccessMap(map);
    } catch {
      // Non-critical — silently ignore
    } finally {
      setAccessLoading(false);
    }
  }, [plantService]);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useEffect(() => {
    if (plants.length) fetchAccessMap(plants);
  }, [plants, fetchAccessMap]);

  // ── Derived data ───────────────────────────────────────────────────────────

  // Map userId → array of plant names the user can access
  const userPlantNames = useMemo<Record<string, string[]>>(() => {
    const result: Record<string, string[]> = {};
    for (const plant of plants) {
      const set = accessMap[plant.id];
      if (!set) continue;
      for (const userId of set) {
        if (!result[userId]) result[userId] = [];
        result[userId].push(plant.plantName);
      }
    }
    return result;
  }, [plants, accessMap]);

  const filtered = useMemo(() => {
    if (!query.trim()) return users;
    const q = query.trim().toLowerCase();
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q),
    );
  }, [users, query]);

  const stats = useMemo(() => ({
    total: users.length,
    admins: users.filter((u) => u.role.toUpperCase() === 'ADMIN').length,
    regular: users.filter((u) => u.role.toUpperCase() !== 'ADMIN').length,
  }), [users]);

  // ── Create user ────────────────────────────────────────────────────────────

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>(emptyCreateForm());
  const [createErrors, setCreateErrors] = useState<Partial<Record<keyof CreateForm, string>>>({});
  const [creating, setCreating] = useState(false);

  const setCreateField = <K extends keyof CreateForm>(key: K, value: CreateForm[K]) => {
    setCreateForm((p) => ({ ...p, [key]: value }));
    setCreateErrors((p) => ({ ...p, [key]: undefined }));
  };

  const validateCreate = (): boolean => {
    const errs: Partial<Record<keyof CreateForm, string>> = {};
    if (!createForm.username.trim()) errs.username = 'Username is required';
    if (!createForm.email.trim()) errs.email = 'Email is required';
    else if (!/^\S+@\S+\.\S+$/.test(createForm.email)) errs.email = 'Enter a valid email';
    if (!createForm.password) errs.password = 'Password is required';
    else if (!PASSWORD_RE.test(createForm.password))
      errs.password = 'Min 8 chars: 2 lowercase, 1 uppercase, 1 digit, 2 symbols';
    setCreateErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreate = async () => {
    if (!validateCreate()) return;
    setCreating(true);
    try {
      const req: CreateUserModel = {
        username: createForm.username.trim(),
        email: createForm.email.trim(),
        password: createForm.password,
        role: createForm.role,
      };
      const res = await userService.createUser(req, buildAuthConfig());
      if (res?.status && res.errorCode === 201) {
        toast.success('User created successfully');
        setCreateOpen(false);
        setCreateForm(emptyCreateForm());
        await fetchAll();
      } else {
        throw new Error(res?.internalMessage || 'Failed to create user');
      }
    } catch (err) {
      const e = err as CatchError;
      if (!handleAuthError(e))
        toast.error(e.response?.data?.internalMessage || e.message || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  // ── Delete user ────────────────────────────────────────────────────────────

  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; user: UserSummaryDto | null }>({
    open: false, user: null,
  });
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirmDelete.user) return;
    setDeleting(true);
    try {
      const res = await userService.deleteUser({ userId: confirmDelete.user.id }, buildAuthConfig());
      if (res?.status) {
        toast.success('User deleted');
        setConfirmDelete({ open: false, user: null });
        await fetchAll();
      } else {
        throw new Error(res?.internalMessage || 'Failed to delete user');
      }
    } catch (err) {
      const e = err as CatchError;
      if (!handleAuthError(e)) toast.error(e.message || 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  // ── Assign plants modal ────────────────────────────────────────────────────

  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUser, setAssignUser] = useState<UserSummaryDto | null>(null);
  const [checkedPlantIds, setCheckedPlantIds] = useState<Set<number>>(new Set());
  const [originalPlantIds, setOriginalPlantIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const openAssign = (user: UserSummaryDto) => {
    const assigned = new Set<number>();
    for (const plant of plants) {
      if (accessMap[plant.id]?.has(user.id)) assigned.add(plant.id);
    }
    setAssignUser(user);
    setCheckedPlantIds(new Set(assigned));
    setOriginalPlantIds(new Set(assigned));
    setAssignOpen(true);
  };

  const togglePlant = (plantId: number) => {
    setCheckedPlantIds((prev) => {
      const next = new Set(prev);
      if (next.has(plantId)) next.delete(plantId);
      else next.add(plantId);
      return next;
    });
  };

  const handleSaveAssignment = async () => {
    if (!assignUser) return;
    setSaving(true);
    try {
      const toAdd    = [...checkedPlantIds].filter((id) => !originalPlantIds.has(id));
      const toRemove = [...originalPlantIds].filter((id) => !checkedPlantIds.has(id));

      await Promise.all([
        ...toAdd.map((plantId) =>
          plantService.assignAccess({ userId: assignUser.id, plantId }, buildAuthConfig()),
        ),
        ...toRemove.map((plantId) =>
          plantService.revokeAccess(assignUser.id, plantId, buildAuthConfig()),
        ),
      ]);

      toast.success('Plant access updated');
      setAssignOpen(false);
      await fetchAccessMap(plants);
    } catch (err) {
      const e = err as CatchError;
      if (!handleAuthError(e)) toast.error(e.message || 'Failed to update plant access');
    } finally {
      setSaving(false);
    }
  };

  // ── Table columns ──────────────────────────────────────────────────────────

  const columns: Column<UserSummaryDto>[] = [
    {
      key: 'user',
      title: 'User',
      width: '220px',
      render: (row) => (
        <div className="um-user-cell">
          <div className="um-avatar">
            {row.username.slice(0, 2)}
          </div>
          <div className="um-user-cell__info">
            <span className="um-user-cell__name">{row.username}</span>
            <span className="um-user-cell__email">{row.email}</span>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      title: 'Role',
      width: '100px',
      render: (row) => {
        const isAdmin = row.role.toUpperCase() === 'ADMIN';
        return (
          <span className={`um-badge ${isAdmin ? 'um-badge--admin' : 'um-badge--user'}`}>
            {isAdmin ? (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            ) : (
              <UserIcon width={10} height={10} />
            )}
            {row.role}
          </span>
        );
      },
    },
    {
      key: 'plants',
      title: 'Plant Access',
      render: (row) => {
        const names = userPlantNames[row.id] ?? [];
        if (accessLoading) return <span style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>Loading…</span>;
        return names.length ? (
          <div className="um-chips">
            {names.map((n) => (
              <span key={n} className="um-chip">{n}</span>
            ))}
          </div>
        ) : (
          <span className="um-chip um-chip--none">No plants assigned</span>
        );
      },
    },
    {
      key: 'actions',
      title: 'Actions',
      width: '200px',
      render: (row) => (
        <div className="um-actions">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => openAssign(row)}
          >
            <EditIcon width={13} height={13} />
            Assign Plants
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => setConfirmDelete({ open: true, user: row })}
          >
            <TrashIcon width={13} height={13} />
          </Button>
        </div>
      ),
    },
  ];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="um-page">
      <PageHeader
        title="User Management"
        subtitle="Manage operator accounts and assign factory plant access"
        actions={
          <Button onClick={() => { setCreateForm(emptyCreateForm()); setCreateErrors({}); setCreateOpen(true); }}>
            <PlusIcon width={15} height={15} />
            Add User
          </Button>
        }
      />

      {/* Stats */}
      <div className="um-stats">
        <div className="um-stat">
          <span className="um-stat__label">Total Users</span>
          <span className="um-stat__value">{stats.total}</span>
        </div>
        <div className="um-stat">
          <span className="um-stat__label">Admins</span>
          <span className="um-stat__value">{stats.admins}</span>
        </div>
        <div className="um-stat">
          <span className="um-stat__label">Operators</span>
          <span className="um-stat__value">{stats.regular}</span>
        </div>
        <div className="um-stat">
          <span className="um-stat__label">Plants</span>
          <span className="um-stat__value">{plants.length}</span>
        </div>
      </div>

      {/* Table */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
            <SearchIcon
              width={15}
              height={15}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', pointerEvents: 'none' }}
            />
            <input
              className="um-search"
              style={{
                width: '100%',
                padding: '0.45rem 0.75rem 0.45rem 2rem',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-bg)',
                color: 'var(--color-text)',
                fontSize: '0.85rem',
                outline: 'none',
              }}
              placeholder="Search users…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <DataTable<UserSummaryDto>
          data={filtered}
          columns={columns}
          rowKey={(r) => r.id}
          loading={loading}
          emptyMessage="No users found"
          pageSize={12}
        />
      </Card>

      {/* ── Create User Modal ── */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add New User"
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} loading={creating}>Create User</Button>
          </>
        }
      >
        <div className="um-form-grid">
          <Field label="Username" required error={createErrors.username}>
            <Input
              value={createForm.username}
              onChange={(e) => setCreateField('username', e.target.value)}
              placeholder="operator_name"
              invalid={!!createErrors.username}
              autoComplete="off"
            />
          </Field>

          <Field label="Email" required error={createErrors.email}>
            <Input
              type="email"
              value={createForm.email}
              onChange={(e) => setCreateField('email', e.target.value)}
              placeholder="user@example.com"
              invalid={!!createErrors.email}
              autoComplete="off"
            />
          </Field>

          <Field label="Password" required error={createErrors.password} className="um-form-grid--full">
            <Input
              type="password"
              value={createForm.password}
              onChange={(e) => setCreateField('password', e.target.value)}
              placeholder="Min 8 chars with uppercase, digits & symbols"
              invalid={!!createErrors.password}
              autoComplete="new-password"
            />
          </Field>

          <Field label="Role" required className="um-form-grid--full">
            <Select
              value={createForm.role}
              onChange={(v) => setCreateField('role', v as UserRole)}
              options={[
                { label: 'Operator (User)', value: UserRole.USER },
                { label: 'Administrator', value: UserRole.ADMIN },
              ]}
            />
          </Field>
        </div>
      </Modal>

      {/* ── Assign Plants Modal ── */}
      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title={`Assign Plants — ${assignUser?.username ?? ''}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveAssignment} loading={saving}>Save Access</Button>
          </>
        }
      >
        {plants.length === 0 ? (
          <p className="um-empty-plants">
            No plants configured yet.{' '}
            <a href="/plant-master" style={{ color: 'var(--color-primary)' }}>Set up Plant Master first</a>.
          </p>
        ) : (
          <div className="um-plant-list">
            {plants.map((p) => {
              const checked = checkedPlantIds.has(p.id);
              return (
                <div
                  key={p.id}
                  className={`um-plant-item${checked ? ' um-plant-item--checked' : ''}`}
                  onClick={() => togglePlant(p.id)}
                >
                  <span className="um-plant-item__check">
                    {checked && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                  <span className="um-plant-item__name">{p.plantName}</span>
                  <span className="um-plant-item__status">{p.isActive ? 'Active' : 'Inactive'}</span>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {/* ── Delete Confirm Modal ── */}
      <Modal
        open={confirmDelete.open}
        onClose={() => setConfirmDelete({ open: false, user: null })}
        title="Delete User"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete({ open: false, user: null })}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} loading={deleting}>Delete</Button>
          </>
        }
      >
        <p style={{ color: 'var(--color-text)', lineHeight: 1.6 }}>
          Are you sure you want to delete{' '}
          <strong>{confirmDelete.user?.username}</strong>?{' '}
          This will remove all their plant access and cannot be undone.
        </p>
      </Modal>
    </div>
  );
};

export default UserManagement;
