import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Download,
  Edit3,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { ChurchAssetRecord } from '../../types/church';

export const ASSET_CATEGORIES = [
  'Audio & Sound System',
  'Musical Instruments',
  'Sanctuary Furniture',
  'Electronics & Media',
  'Land & Buildings',
  'Vehicles & Transport',
  'Office & Admin Equipment',
  'Kitchen & Hospitality',
  'Other Property',
] as const;

export const ASSET_CONDITIONS = [
  'Excellent',
  'Good',
  'Fair',
  'Needs Repair',
  'Decommissioned',
] as const;

const CONDITION_BADGE_STYLES: Record<string, string> = {
  Excellent: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  Good: 'bg-slate-50 text-slate-800 border-slate-300',
  Fair: 'bg-amber-50 text-amber-800 border-amber-200',
  'Needs Repair': 'bg-red-50 text-red-800 border-red-300',
  Decommissioned: 'bg-stone-100 text-stone-600 border-stone-300',
};

interface AssetManagementPanelProps {
  assets: ChurchAssetRecord[];
  canManage: boolean;
  canExport: boolean;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  onRefresh: () => void | Promise<void>;
  onExportCsv: () => void;
  onNotify: (msg: string) => void;
}

const createEmptyAssetDraft = () => ({
  assetName: '',
  category: 'Audio & Sound System',
  quantity: 1,
  serialNumber: '',
  acquisitionDate: new Date().toISOString().slice(0, 10),
  estimatedValueKes: '',
  location: 'GVCC Sanctuary, Ogembo',
  custodianName: '',
  condition: 'Good',
  notes: '',
});

export const AssetManagementPanel: React.FC<AssetManagementPanelProps> = ({
  assets,
  canManage,
  canExport,
  authFetch,
  onRefresh,
  onExportCsv,
  onNotify,
}) => {
  const [showCreateForm, setShowCreateForm] = useState(true);
  const [newAsset, setNewAsset] = useState(createEmptyAssetDraft);
  const [submitting, setSubmitting] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [conditionFilter, setConditionFilter] = useState('All');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState({
    assetName: '',
    category: 'Audio & Sound System',
    quantity: 1,
    serialNumber: '',
    acquisitionDate: '',
    estimatedValueKes: '',
    location: '',
    custodianName: '',
    condition: 'Good',
    notes: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const filteredAssets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return assets.filter((a) => {
      const matchesSearch =
        !q ||
        a.assetName.toLowerCase().includes(q) ||
        a.assetTag.toLowerCase().includes(q) ||
        (a.serialNumber || '').toLowerCase().includes(q) ||
        (a.location || '').toLowerCase().includes(q) ||
        (a.custodianName || '').toLowerCase().includes(q);
      const matchesCategory = categoryFilter === 'All' || a.category === categoryFilter;
      const matchesCondition = conditionFilter === 'All' || a.condition === conditionFilter;
      return matchesSearch && matchesCategory && matchesCondition;
    });
  }, [assets, searchQuery, categoryFilter, conditionFilter]);

  const metrics = useMemo(() => {
    const totalUnits = assets.reduce((sum, a) => sum + (Number(a.quantity) || 0), 0);
    const totalValuationKes = assets.reduce((sum, a) => sum + (Number(a.estimatedValueKes) || 0), 0);
    const needsRepairCount = assets.filter((a) => a.condition === 'Needs Repair').length;
    return {
      totalEntries: assets.length,
      totalUnits,
      totalValuationKes,
      needsRepairCount,
    };
  }, [assets]);

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage || submitting) return;
    setSubmitting(true);
    try {
      const res = await authFetch('/api/admin/assets', {
        method: 'POST',
        body: JSON.stringify(newAsset),
      });
      if (res.ok) {
        setNewAsset(createEmptyAssetDraft());
        onNotify('Equipment/property asset logged in register.');
        await onRefresh();
      } else {
        const err = await res.json().catch(() => ({}));
        onNotify(err.error || 'Could not log church asset.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickConditionChange = async (asset: ChurchAssetRecord, nextCondition: string) => {
    const res = await authFetch(`/api/admin/assets/${asset.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ condition: nextCondition }),
    });
    if (res.ok) {
      onNotify(`${asset.assetTag} status updated to ${nextCondition}.`);
      await onRefresh();
    } else {
      const err = await res.json().catch(() => ({}));
      onNotify(err.error || 'Failed to update asset status.');
    }
  };

  const beginEdit = (asset: ChurchAssetRecord) => {
    setConfirmDeleteId(null);
    setEditingId(asset.id);
    setEditDraft({
      assetName: asset.assetName,
      category: asset.category,
      quantity: asset.quantity,
      serialNumber: asset.serialNumber || '',
      acquisitionDate: asset.acquisitionDate || '',
      estimatedValueKes: asset.estimatedValueKes != null ? String(asset.estimatedValueKes) : '',
      location: asset.location || 'GVCC Sanctuary, Ogembo',
      custodianName: asset.custodianName || '',
      condition: asset.condition,
      notes: asset.notes || '',
    });
  };

  const handleSaveEdit = async (e: React.FormEvent, id: number) => {
    e.preventDefault();
    if (!canManage || savingEdit) return;
    setSavingEdit(true);
    try {
      const res = await authFetch(`/api/admin/assets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(editDraft),
      });
      if (res.ok) {
        setEditingId(null);
        onNotify('Asset details and status updated.');
        await onRefresh();
      } else {
        const err = await res.json().catch(() => ({}));
        onNotify(err.error || 'Failed to save asset changes.');
      }
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteAsset = async (id: number) => {
    const res = await authFetch(`/api/admin/assets/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setConfirmDeleteId(null);
      if (editingId === id) setEditingId(null);
      onNotify('Asset removed from register.');
      await onRefresh();
    } else {
      const err = await res.json().catch(() => ({}));
      onNotify(err.error || 'Could not delete asset.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-[#9A6B2F]" />
            <span>Asset Management</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Log, track, and update the status of church sound systems, instruments, land &amp; buildings, sanctuary furniture, and media equipment.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <button
              type="button"
              onClick={() => setShowCreateForm((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-medium cursor-pointer"
            >
              {showCreateForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{showCreateForm ? 'Hide Log Form' : 'Log New Asset'}</span>
            </button>
          )}
          {canExport && (
            <button
              type="button"
              onClick={onExportCsv}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-medium cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export Assets CSV
            </button>
          )}
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Asset Entries</p>
          <p className="font-mono tabular-nums text-2xl font-semibold text-slate-900 mt-1">
            {metrics.totalEntries}
          </p>
        </div>
        <div className="bg-white border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Total Physical Units</p>
          <p className="font-mono tabular-nums text-2xl font-semibold text-slate-900 mt-1">
            {metrics.totalUnits.toLocaleString()}
          </p>
        </div>
        <div className="bg-white border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            {metrics.needsRepairCount > 0 && <AlertTriangle className="w-3.5 h-3.5 text-red-600" />}
            <span>Needs Repair</span>
          </p>
          <p
            className={`font-mono tabular-nums text-2xl font-semibold mt-1 ${
              metrics.needsRepairCount > 0 ? 'text-red-700' : 'text-emerald-700'
            }`}
          >
            {metrics.needsRepairCount}
          </p>
        </div>
        <div className="bg-white border border-slate-200 p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wider">Estimated Valuation (KES)</p>
          <p className="font-mono tabular-nums text-2xl font-semibold text-slate-900 mt-1">
            KES {metrics.totalValuationKes.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Log Equipment / Property Form */}
      {canManage && showCreateForm && (
        <form onSubmit={handleCreateAsset} className="bg-white border border-slate-200 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">Log Church Equipment or Property Item</h2>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              required
              placeholder="Asset Name * (e.g. Digital Mixer / Sanctuary Chairs)"
              value={newAsset.assetName}
              onChange={(e) => setNewAsset({ ...newAsset, assetName: e.target.value })}
              className="px-3 py-2 border border-slate-300 text-xs sm:col-span-2"
            />
            <select
              value={newAsset.category}
              onChange={(e) => setNewAsset({ ...newAsset, category: e.target.value })}
              className="px-3 py-2 border border-slate-300 text-xs"
            >
              {ASSET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              required
              type="number"
              min={1}
              placeholder="Quantity *"
              value={newAsset.quantity}
              onChange={(e) =>
                setNewAsset({ ...newAsset, quantity: Math.max(1, Number(e.target.value) || 1) })
              }
              className="px-3 py-2 border border-slate-300 text-xs"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              placeholder="Serial / Model / Title Deed No."
              value={newAsset.serialNumber}
              onChange={(e) => setNewAsset({ ...newAsset, serialNumber: e.target.value })}
              className="px-3 py-2 border border-slate-300 text-xs"
            />
            <input
              type="number"
              min={0}
              placeholder="Estimated Value (KES)"
              value={newAsset.estimatedValueKes}
              onChange={(e) => setNewAsset({ ...newAsset, estimatedValueKes: e.target.value })}
              className="px-3 py-2 border border-slate-300 text-xs"
            />
            <input
              placeholder="Location (e.g. Main Sanctuary)"
              value={newAsset.location}
              onChange={(e) => setNewAsset({ ...newAsset, location: e.target.value })}
              className="px-3 py-2 border border-slate-300 text-xs"
            />
            <input
              placeholder="Custodian / Responsible Person"
              value={newAsset.custodianName}
              onChange={(e) => setNewAsset({ ...newAsset, custodianName: e.target.value })}
              className="px-3 py-2 border border-slate-300 text-xs"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-center">
            <input
              type="date"
              value={newAsset.acquisitionDate}
              onChange={(e) => setNewAsset({ ...newAsset, acquisitionDate: e.target.value })}
              className="px-3 py-2 border border-slate-300 text-xs"
            />
            <select
              value={newAsset.condition}
              onChange={(e) => setNewAsset({ ...newAsset, condition: e.target.value })}
              className="px-3 py-2 border border-slate-300 text-xs"
            >
              {ASSET_CONDITIONS.map((cond) => (
                <option key={cond} value={cond}>
                  {cond}
                </option>
              ))}
            </select>
            <input
              placeholder="Condition / maintenance notes (optional)"
              value={newAsset.notes}
              onChange={(e) => setNewAsset({ ...newAsset, notes: e.target.value })}
              className="px-3 py-2 border border-slate-300 text-xs sm:col-span-2"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-[#0F172A] hover:bg-slate-800 disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 inline mr-1" />
              {submitting ? 'Saving Asset...' : 'Log Asset Item'}
            </button>
          </div>
        </form>
      )}

      {/* Filter & Asset Register Table */}
      <div className="bg-white border border-slate-200 p-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                placeholder="Search asset name, tag, serial, location, custodian..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-2 border border-slate-300 text-xs w-72"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 text-xs"
            >
              <option value="All">All Categories</option>
              {ASSET_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={conditionFilter}
              onChange={(e) => setConditionFilter(e.target.value)}
              className="px-3 py-2 border border-slate-300 text-xs"
            >
              <option value="All">All Statuses</option>
              {ASSET_CONDITIONS.map((cond) => (
                <option key={cond} value={cond}>
                  {cond}
                </option>
              ))}
            </select>
          </div>
          <span className="text-xs text-slate-500">
            Showing {filteredAssets.length} of {assets.length} assets
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-2">Asset Tag</th>
                <th className="py-2">Equipment / Property</th>
                <th className="py-2">Category</th>
                <th className="py-2">Qty</th>
                <th className="py-2">Location &amp; Custodian</th>
                <th className="py-2">Value (KES)</th>
                <th className="py-2">Status / Condition</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    {assets.length === 0
                      ? 'No church equipment or property items logged yet. Use the form above to add an asset.'
                      : 'No assets match the current search or filter criteria.'}
                  </td>
                </tr>
              ) : (
                filteredAssets.map((a) => (
                  <React.Fragment key={a.id}>
                    <tr className="hover:bg-slate-50">
                      <td className="py-2.5 font-mono text-slate-700 whitespace-nowrap">{a.assetTag}</td>
                      <td className="py-2.5">
                        <span className="font-medium text-slate-900 block">{a.assetName}</span>
                        {a.serialNumber && (
                          <span className="text-[11px] font-mono text-slate-500 block">
                            S/N: {a.serialNumber}
                          </span>
                        )}
                        {a.acquisitionDate && (
                          <span className="text-[11px] text-slate-400 block">
                            Acquired: {a.acquisitionDate}
                          </span>
                        )}
                        {a.notes && (
                          <span className="text-[11px] text-slate-600 block mt-0.5">{a.notes}</span>
                        )}
                      </td>
                      <td className="py-2.5 text-slate-700">{a.category}</td>
                      <td className="py-2.5 font-mono tabular-nums">{a.quantity}</td>
                      <td className="py-2.5">
                        <span className="block text-slate-800">{a.location}</span>
                        {a.custodianName && (
                          <span className="text-[11px] text-slate-500">Custodian: {a.custodianName}</span>
                        )}
                      </td>
                      <td className="py-2.5 font-mono tabular-nums whitespace-nowrap">
                        {a.estimatedValueKes != null ? a.estimatedValueKes.toLocaleString() : '—'}
                      </td>
                      <td className="py-2.5">
                        <select
                          disabled={!canManage}
                          value={a.condition}
                          onChange={(e) => handleQuickConditionChange(a, e.target.value)}
                          className={`px-2 py-1 border text-xs font-medium ${
                            CONDITION_BADGE_STYLES[a.condition] || 'bg-white border-slate-200 text-slate-800'
                          }`}
                        >
                          {ASSET_CONDITIONS.map((cond) => (
                            <option key={cond} value={cond}>
                              {cond}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2.5 text-right whitespace-nowrap">
                        {canManage && (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => (editingId === a.id ? setEditingId(null) : beginEdit(a))}
                              className="inline-flex items-center gap-1 px-2.5 py-1 border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs cursor-pointer"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>{editingId === a.id ? 'Close' : 'Edit'}</span>
                            </button>
                            {confirmDeleteId === a.id ? (
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAsset(a.id)}
                                  className="inline-flex items-center gap-1 px-2 py-1 bg-red-700 text-white text-xs cursor-pointer"
                                >
                                  <Check className="w-3 h-3" />
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-1 border border-slate-300 text-slate-600 text-xs cursor-pointer"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(a.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 border border-red-200 hover:bg-red-50 text-red-700 text-xs cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Delete</span>
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>

                    {editingId === a.id && (
                      <tr className="bg-slate-50">
                        <td colSpan={8} className="p-4 border-t border-b border-slate-200">
                          <form onSubmit={(e) => handleSaveEdit(e, a.id)} className="space-y-3">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold text-slate-900">
                                Update Asset Record — <span className="font-mono">{a.assetTag}</span>
                              </p>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                              <input
                                required
                                placeholder="Asset Name *"
                                value={editDraft.assetName}
                                onChange={(e) => setEditDraft({ ...editDraft, assetName: e.target.value })}
                                className="px-2.5 py-1.5 border border-slate-300 bg-white text-xs sm:col-span-2"
                              />
                              <select
                                value={editDraft.category}
                                onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })}
                                className="px-2.5 py-1.5 border border-slate-300 bg-white text-xs"
                              >
                                {ASSET_CATEGORIES.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                              <input
                                required
                                type="number"
                                min={1}
                                placeholder="Qty *"
                                value={editDraft.quantity}
                                onChange={(e) =>
                                  setEditDraft({
                                    ...editDraft,
                                    quantity: Math.max(1, Number(e.target.value) || 1),
                                  })
                                }
                                className="px-2.5 py-1.5 border border-slate-300 bg-white text-xs"
                              />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                              <input
                                placeholder="Serial / Model No."
                                value={editDraft.serialNumber}
                                onChange={(e) => setEditDraft({ ...editDraft, serialNumber: e.target.value })}
                                className="px-2.5 py-1.5 border border-slate-300 bg-white text-xs"
                              />
                              <input
                                type="number"
                                min={0}
                                placeholder="Estimated Value (KES)"
                                value={editDraft.estimatedValueKes}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, estimatedValueKes: e.target.value })
                                }
                                className="px-2.5 py-1.5 border border-slate-300 bg-white text-xs"
                              />
                              <input
                                placeholder="Location"
                                value={editDraft.location}
                                onChange={(e) => setEditDraft({ ...editDraft, location: e.target.value })}
                                className="px-2.5 py-1.5 border border-slate-300 bg-white text-xs"
                              />
                              <input
                                placeholder="Custodian Name"
                                value={editDraft.custodianName}
                                onChange={(e) => setEditDraft({ ...editDraft, custodianName: e.target.value })}
                                className="px-2.5 py-1.5 border border-slate-300 bg-white text-xs"
                              />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-center">
                              <input
                                type="date"
                                value={editDraft.acquisitionDate}
                                onChange={(e) =>
                                  setEditDraft({ ...editDraft, acquisitionDate: e.target.value })
                                }
                                className="px-2.5 py-1.5 border border-slate-300 bg-white text-xs"
                              />
                              <select
                                value={editDraft.condition}
                                onChange={(e) => setEditDraft({ ...editDraft, condition: e.target.value })}
                                className="px-2.5 py-1.5 border border-slate-300 bg-white text-xs"
                              >
                                {ASSET_CONDITIONS.map((cond) => (
                                  <option key={cond} value={cond}>
                                    {cond}
                                  </option>
                                ))}
                              </select>
                              <input
                                placeholder="Notes / repair status details"
                                value={editDraft.notes}
                                onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })}
                                className="px-2.5 py-1.5 border border-slate-300 bg-white text-xs sm:col-span-2"
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="px-3 py-1.5 border border-slate-300 bg-white text-slate-700 text-xs cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={savingEdit}
                                className="px-4 py-1.5 bg-[#B4823E] hover:bg-[#9A6B2F] disabled:opacity-60 text-white text-xs font-semibold cursor-pointer"
                              >
                                {savingEdit ? 'Saving...' : 'Save Asset Changes'}
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
