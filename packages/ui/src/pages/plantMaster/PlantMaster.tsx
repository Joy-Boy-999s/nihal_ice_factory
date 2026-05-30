import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlantService, UserHelpService } from '@nihal-ice-factory/shared-services';
import {
  PlantDto,
  CreatePlantDto,
  UpdatePlantDto,
  UserPlantAccessDto,
  AssignPlantAccessDto,
  UserSummaryDto,
  ResponsePayloadRecord,
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
import {
  EditIcon,
  FactoryIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
  UsersIcon,
  XIcon,
} from '../../layout/nav-icons';
import './PlantMaster.css';

// ── Types ──────────────────────────────────────────────────────────────────

interface PlantForm {
  plantName: string;
}

type FormErrors = Partial<Record<keyof PlantForm, string>>;

interface CatchError {
  message?: string;
  response?: { status?: number };
}

// ── Helpers ────────────────────────────────────────────────────────────────

const emptyForm = (): PlantForm => ({ plantName: '' });

function unwrapList<T>(raw: ResponsePayloadRecord | null | undefined): T[] {
  if (!raw) return [];
  const inner = (raw['data'] ?? raw) as unknown;
  return Array.isArray(inner) ? (inner as T[]) : [];
}

function unwrapItem<T>(raw: ResponsePayloadRecord | null | undefined): T | null {
  if (!raw) return null;
  const inner = (raw['data'] ?? raw) as unknown;
  if (Array.isArray(inner)) return null;
  return (inner as T) ?? null;
}

// ── Component ──────────────────────────────────────────────────────────────

const PlantMaster: React.FC = () => {
  const navigate     = useNavigate();
  const toast        = useToast();
  const plantService = useMemo(() => new PlantService(), []);
  const userService  = useMemo(() => new UserHelpService(), []);

  // ── Plant list state ───────────────────────────────────────────────────────

  const [plants, setPlants]   = useState<PlantDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery]     = useState('');

  // ── Add / Edit modal ────────────────────────────────────────────────────────

  const [modalOpen, setModalOpen]   = useState(false);
  const [editing, setEditing]       = useState<PlantDto | null>(null);
  const [form, setForm]             = useState<PlantForm>(emptyForm());
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [saving, setSaving]         = useState(false);

  // ── Delete confirm ──────────────────────────────────────────────────────────

  const [confirmDelete, setConfirmDelete] = useState<{ open: boolean; item: PlantDto | null }>({
    open: false, item: null,
  });
  const [deleting, setDeleting] = useState(false);

  // ── Access management modal ─────────────────────────────────────────────────

  const [accessPlant, setAccessPlant]     = useState<PlantDto | null>(null);
  const [accessOpen, setAccessOpen]       = useState(false);
  const [accessList, setAccessList]       = useState<UserPlantAccessDto[]>([]);
  const [allUsers, setAllUsers]           = useState<UserSummaryDto[]>([]);
  const [accessLoading, setAccessLoading] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [granting, setGranting]           = useState(false);
  const [revokingId, setRevokingId]       = useState<string | null>(null);

  // ── Auth guard ─────────────────────────────────────────────────────────────

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

  // ── Fetch plants ────────────────────────────────────────────────────────────

  const fetchPlants = useCallback(async () => {
    setLoading(true);
    try {
      const res = await plantService.getAllPlants(buildAuthConfig());
      if (res?.status) {
        setPlants(unwrapList<PlantDto>(res.data as ResponsePayloadRecord | null));
      } else {
        throw new Error(res?.internalMessage || 'Failed to load plants');
      }
    } catch (err) {
      const e = err as CatchError;
      if (!handleAuthError(e)) {
        toast.error((err instanceof Error ? err.message : null) || 'Failed to load plants');
      }
    } finally {
      setLoading(false);
    }
  }, [plantService, toast, handleAuthError]);

  useEffect(() => { fetchPlants(); }, [fetchPlants]);

  // ── Filter ──────────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    if (!query.trim()) return plants;
    const q = query.trim().toLowerCase();
    return plants.filter((p) => p.plantName?.toLowerCase().includes(q));
  }, [plants, query]);

  // ── Stats ───────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const active = plants.filter((p) => p.isActive).length;
    return { total: plants.length, active, inactive: plants.length - active };
  }, [plants]);

  // ── Form helpers ─────────────────────────────────────────────────────────────

  const setField = (key: keyof PlantForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFormErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  const validateForm = (): boolean => {
    const errs: FormErrors = {};
    const name = form.plantName.trim();
    if (!name)            errs.plantName = 'Plant name is required';
    else if (name.length > 100) errs.plantName = 'Must not exceed 100 characters';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ── Open modals ──────────────────────────────────────────────────────────────

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (item: PlantDto) => {
    setEditing(item);
    setForm({ plantName: item.plantName });
    setFormErrors({});
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setFormErrors({});
  };

  // ── Save ─────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!validateForm()) return;
    setSaving(true);
    try {
      const auth = buildAuthConfig();

      if (editing) {
        const dto: UpdatePlantDto = { plantName: form.plantName.trim() };
        const res = await plantService.updatePlant(editing.id, dto, auth);
        if (!res?.status) throw new Error(res?.internalMessage || 'Update failed');
        const updated = unwrapItem<PlantDto>(res.data as ResponsePayloadRecord) ?? {
          ...editing,
          plantName: form.plantName.trim(),
        };
        setPlants((prev) =>
          prev.map((p) => (p.id === editing.id ? { ...p, ...updated } : p)),
        );
        toast.success('Plant updated');
      } else {
        const dto: CreatePlantDto = { plantName: form.plantName.trim() };
        const res = await plantService.createPlant(dto, auth);
        if (!res?.status) throw new Error(res?.internalMessage || 'Create failed');
        const created = unwrapItem<PlantDto>(res.data as ResponsePayloadRecord) ?? ({} as PlantDto);
        setPlants((prev) => [created, ...prev]);
        toast.success('Plant created');
      }

      closeModal();
    } catch (err) {
      const e = err as CatchError;
      if (!handleAuthError(e)) {
        toast.error((err instanceof Error ? err.message : null) || 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  };

  // ── Toggle active ────────────────────────────────────────────────────────────

  const toggleActive = async (item: PlantDto) => {
    try {
      const dto: UpdatePlantDto = { isActive: !item.isActive };
      const res = await plantService.updatePlant(item.id, dto, buildAuthConfig());
      if (!res?.status) throw new Error(res?.internalMessage || 'Update failed');
      setPlants((prev) =>
        prev.map((p) => (p.id === item.id ? { ...p, isActive: !item.isActive } : p)),
      );
      toast.success(item.isActive ? 'Plant deactivated' : 'Plant activated');
    } catch (err) {
      const e = err as CatchError;
      if (!handleAuthError(e)) {
        toast.error((err instanceof Error ? err.message : null) || 'Update failed');
      }
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────────

  const openDelete = (item: PlantDto) => setConfirmDelete({ open: true, item });

  const handleDelete = async () => {
    if (!confirmDelete.item) return;
    setDeleting(true);
    try {
      const res = await plantService.deletePlant(confirmDelete.item.id, buildAuthConfig());
      if (!res?.status) throw new Error(res?.internalMessage || 'Delete failed');
      setPlants((prev) => prev.filter((p) => p.id !== confirmDelete.item!.id));
      toast.success('Plant deleted');
    } catch (err) {
      const e = err as CatchError;
      if (!handleAuthError(e)) {
        toast.error((err instanceof Error ? err.message : null) || 'Delete failed');
      }
    } finally {
      setDeleting(false);
      setConfirmDelete({ open: false, item: null });
    }
  };

  // ── Access modal ──────────────────────────────────────────────────────────────

  const openAccess = async (plant: PlantDto) => {
    setAccessPlant(plant);
    setAccessOpen(true);
    setSelectedUserId('');
    setAccessLoading(true);
    try {
      const [accessRes, usersRes] = await Promise.all([
        plantService.getUsersForPlant(plant.id, buildAuthConfig()),
        userService.getAllUsers(buildAuthConfig()),
      ]);

      if (accessRes?.status) {
        setAccessList(unwrapList<UserPlantAccessDto>(accessRes.data as ResponsePayloadRecord | null));
      }

      if (usersRes?.status) {
        // Exclude ADMIN users — they always have full access, no need to assign.
        const all = unwrapList<UserSummaryDto>(usersRes.data as ResponsePayloadRecord | null);
        setAllUsers(all.filter((u) => u.role?.toUpperCase() !== 'ADMIN'));
      }
    } catch (err) {
      const e = err as CatchError;
      if (!handleAuthError(e)) {
        toast.error('Failed to load access data');
      }
    } finally {
      setAccessLoading(false);
    }
  };

  const closeAccess = () => {
    setAccessOpen(false);
    setAccessPlant(null);
    setAccessList([]);
    setAllUsers([]);
    setSelectedUserId('');
  };

  const handleGrantAccess = async () => {
    if (!accessPlant || !selectedUserId) return;
    setGranting(true);
    try {
      const dto: AssignPlantAccessDto = { userId: selectedUserId, plantId: accessPlant.id };
      const res = await plantService.assignAccess(dto, buildAuthConfig());
      if (!res?.status) throw new Error(res?.internalMessage || 'Grant failed');
      const newAccess = unwrapItem<UserPlantAccessDto>(res.data as ResponsePayloadRecord) ?? ({
        id: Date.now(), userId: selectedUserId, plantId: accessPlant.id, createdAt: new Date().toISOString(),
      } as UserPlantAccessDto);
      setAccessList((prev) => {
        // Guard against duplicate if already in list.
        if (prev.some((a) => a.userId === selectedUserId)) return prev;
        return [...prev, newAccess];
      });
      setSelectedUserId('');
      toast.success('Access granted');
    } catch (err) {
      const e = err as CatchError;
      if (!handleAuthError(e)) {
        toast.error((err instanceof Error ? err.message : null) || 'Grant failed');
      }
    } finally {
      setGranting(false);
    }
  };

  const handleRevokeAccess = async (userId: string) => {
    if (!accessPlant) return;
    setRevokingId(userId);
    try {
      const res = await plantService.revokeAccess(userId, accessPlant.id, buildAuthConfig());
      if (!res?.status) throw new Error(res?.internalMessage || 'Revoke failed');
      setAccessList((prev) => prev.filter((a) => a.userId !== userId));
      toast.success('Access revoked');
    } catch (err) {
      const e = err as CatchError;
      if (!handleAuthError(e)) {
        toast.error((err instanceof Error ? err.message : null) || 'Revoke failed');
      }
    } finally {
      setRevokingId(null);
    }
  };

  // ── Users already assigned (quick lookup) ──────────────────────────────────

  const assignedUserIds = useMemo(
    () => new Set(accessList.map((a) => a.userId)),
    [accessList],
  );

  const getUserInfo = (userId: string): UserSummaryDto | undefined =>
    allUsers.find((u) => u.id === userId);

  // Dropdown options: users not yet assigned to this plant.
  const addableUsers = useMemo(
    () => allUsers.filter((u) => !assignedUserIds.has(u.id)),
    [allUsers, assignedUserIds],
  );

  // ── Table columns ─────────────────────────────────────────────────────────────

  const columns: Column<PlantDto>[] = [
    {
      key: 'id',
      title: '#',
      width: 48,
      align: 'center',
      render: (_row, idx) => (
        <span style={{ color: 'var(--color-text-muted)', fontWeight: 500 }}>
          {(idx ?? 0) + 1}
        </span>
      ),
    },
    {
      key: 'plantName',
      title: 'Plant Name',
      render: (row) => (
        <span className="pm-plant-name">
          <FactoryIcon
            width={14}
            height={14}
            style={{ marginRight: 6, verticalAlign: 'middle', opacity: 0.6 }}
          />
          {row.plantName}
        </span>
      ),
    },
    {
      key: 'isActive',
      title: 'Status',
      render: (row) => (
        <button
          type="button"
          className={`pm-badge ${row.isActive ? 'pm-badge--active' : 'pm-badge--inactive'}`}
          onClick={() => toggleActive(row)}
          title={row.isActive ? 'Click to deactivate' : 'Click to activate'}
          style={{ cursor: 'pointer', border: 'none', background: 'inherit' }}
        >
          <span className="pm-badge__dot" />
          {row.isActive ? 'Active' : 'Inactive'}
        </button>
      ),
    },
    {
      key: 'createdAt',
      title: 'Created',
      render: (row) => (
        <span style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>
          {new Date(row.createdAt).toLocaleDateString('en-IN')}
        </span>
      ),
    },
    {
      key: 'actions',
      title: 'Actions',
      align: 'center',
      width: 120,
      render: (row) => (
        <div className="pm-row-actions">
          {/* Manage user access */}
          <button
            type="button"
            className="pm-icon-btn"
            onClick={() => openAccess(row)}
            title="Manage user access"
            aria-label={`Manage access for ${row.plantName}`}
          >
            <UsersIcon width={15} height={15} />
          </button>
          {/* Edit */}
          <button
            type="button"
            className="pm-icon-btn"
            onClick={() => openEdit(row)}
            title="Edit plant name"
            aria-label={`Edit ${row.plantName}`}
          >
            <EditIcon width={15} height={15} />
          </button>
          {/* Delete */}
          <button
            type="button"
            className="pm-icon-btn pm-icon-btn--danger"
            onClick={() => openDelete(row)}
            title="Delete plant"
            aria-label={`Delete ${row.plantName}`}
          >
            <TrashIcon width={15} height={15} />
          </button>
        </div>
      ),
    },
  ];

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="pm-page">
      <PageHeader
        title="Plant Master"
        subtitle="Manage factory plants and control which operators can access each one."
        actions={
          <Button
            id="add-plant-btn"
            onClick={openAdd}
            leftIcon={<PlusIcon width={16} height={16} />}
          >
            Add Plant
          </Button>
        }
      />

      {/* Stats */}
      <div className="pm-stats">
        <div className="pm-stat">
          <span className="pm-stat__label">Total Plants</span>
          <span className="pm-stat__value">{stats.total}</span>
          <span className="pm-stat__sub">registered plants</span>
        </div>
        <div className="pm-stat">
          <span className="pm-stat__label">Active</span>
          <span className="pm-stat__value">{stats.active}</span>
          <span className="pm-stat__sub">available for sales</span>
        </div>
        <div className="pm-stat">
          <span className="pm-stat__label">Inactive</span>
          <span className="pm-stat__value">{stats.inactive}</span>
          <span className="pm-stat__sub">currently disabled</span>
        </div>
      </div>

      {/* Table card */}
      <Card title="Plant List">
        <div className="pm-toolbar">
          <div className="pm-toolbar__search">
            <span className="pm-toolbar__search-icon">
              <SearchIcon width={15} height={15} />
            </span>
            <input
              id="plant-search"
              type="search"
              className="pm-toolbar__search-input"
              placeholder="Search plants…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search plants"
            />
          </div>
          <Button id="refresh-plants-btn" variant="secondary" onClick={fetchPlants}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <div style={{ padding: '1rem 0' }}>
            {[1, 2, 3].map((n) => (
              <div key={n} className="pm-shimmer-row" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="pm-empty">
            <div className="pm-empty__icon">
              <FactoryIcon width={28} height={28} />
            </div>
            <p className="pm-empty__title">No plants found</p>
            <p className="pm-empty__desc">
              {query
                ? 'Try a different search term.'
                : 'Click "Add Plant" to create your first plant.'}
            </p>
            {!query && (
              <Button id="add-plant-empty-btn" onClick={openAdd}>
                Add First Plant
              </Button>
            )}
          </div>
        ) : (
          <DataTable<PlantDto> columns={columns} data={filtered} rowKey={(r) => r.id} />
        )}
      </Card>

      {/* ── Add / Edit Modal ─────────────────────────────────────────────────── */}
      <Modal
        open={modalOpen}
        title={editing ? `Edit — ${editing.plantName}` : 'Add Plant'}
        onClose={closeModal}
      >
        <div className="pm-form-field">
          <Field label="Plant Name" required error={formErrors.plantName}>
            <Input
              id="plant-name"
              value={form.plantName}
              onChange={(e) => setField('plantName', e.target.value)}
              placeholder="e.g. Unit 1  |  North Plant  |  Unit 2"
              invalid={!!formErrors.plantName}
              disabled={saving}
              autoFocus
            />
            <p className="pm-form-hint">
              This name will appear in ice type setup and sale entry forms.
            </p>
          </Field>
        </div>

        <div className="pm-modal-actions">
          <Button
            id="cancel-plant-modal"
            variant="secondary"
            onClick={closeModal}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button id="save-plant-modal" onClick={handleSave} loading={saving}>
            {editing ? 'Update' : 'Create'}
          </Button>
        </div>
      </Modal>

      {/* ── Access Management Modal ──────────────────────────────────────────── */}
      <Modal
        open={accessOpen}
        title={
          accessPlant
            ? `User Access — ${accessPlant.plantName}`
            : 'User Access'
        }
        onClose={closeAccess}
        size="md"
      >
        <div className="pm-access-body">
          {accessLoading ? (
            <div style={{ padding: '1rem 0' }}>
              {[1, 2, 3].map((n) => <div key={n} className="pm-shimmer-row" />)}
            </div>
          ) : (
            <>
              {/* Current access list */}
              <div>
                <p className="pm-access-section-title">
                  Users with access ({accessList.length})
                </p>
                <div className="pm-access-list">
                  {accessList.length === 0 ? (
                    <div className="pm-access-empty">
                      No users assigned yet. Assign users below.
                    </div>
                  ) : (
                    accessList.map((access) => {
                      const user = getUserInfo(access.userId);
                      return (
                        <div key={access.userId} className="pm-access-row">
                          <div className="pm-access-row__user">
                            <span className="pm-access-row__username">
                              {user?.username ?? access.userId}
                            </span>
                            {user?.email && (
                              <span className="pm-access-row__email">{user.email}</span>
                            )}
                          </div>
                          {user?.role && (
                            <span className="pm-access-row__role">{user.role}</span>
                          )}
                          <button
                            type="button"
                            className="pm-icon-btn pm-icon-btn--danger"
                            onClick={() => handleRevokeAccess(access.userId)}
                            disabled={revokingId === access.userId}
                            title={`Revoke ${user?.username ?? ''}'s access`}
                            aria-label={`Revoke access for ${user?.username ?? access.userId}`}
                          >
                            <XIcon width={13} height={13} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Add user */}
              <div>
                <p className="pm-access-section-title">Grant access to a user</p>
                <div className="pm-access-add">
                  <div className="pm-access-add__select">
                    <Select
                      id="access-user-select"
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                      options={addableUsers.map((u) => ({
                        label: `${u.username} (${u.email})`,
                        value: u.id,
                      }))}
                      placeholder={
                        addableUsers.length === 0
                          ? 'All users already have access'
                          : 'Select a user…'
                      }
                      disabled={addableUsers.length === 0 || granting}
                    />
                  </div>
                  <Button
                    id="grant-access-btn"
                    onClick={handleGrantAccess}
                    loading={granting}
                    disabled={!selectedUserId || granting}
                    leftIcon={<PlusIcon width={14} height={14} />}
                  >
                    Grant
                  </Button>
                </div>
                <p className="pm-form-hint" style={{ marginTop: 6 }}>
                  Administrators automatically have access to all plants and are not listed here.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="pm-modal-actions">
          <Button id="close-access-modal" variant="secondary" onClick={closeAccess}>
            Close
          </Button>
        </div>
      </Modal>

      {/* ── Delete Confirm ───────────────────────────────────────────────────── */}
      <Modal
        open={confirmDelete.open}
        title="Delete Plant"
        onClose={() => setConfirmDelete({ open: false, item: null })}
      >
        <div className="pm-confirm-body">
          <p className="pm-confirm-message">
            Are you sure you want to delete{' '}
            <strong>{confirmDelete.item?.plantName}</strong>?{' '}
            All user access records for this plant will also be removed.
            Existing ice types and sales will not be affected.
          </p>
          <div className="pm-confirm-actions">
            <Button
              id="cancel-delete-plant"
              variant="secondary"
              onClick={() => setConfirmDelete({ open: false, item: null })}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              id="confirm-delete-plant"
              variant="danger"
              onClick={handleDelete}
              loading={deleting}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PlantMaster;
