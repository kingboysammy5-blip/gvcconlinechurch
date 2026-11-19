import React from 'react';
import { BarChart3, TrendingUp, UserCheck, UserPlus, Users } from 'lucide-react';
import { MemberRecord } from '../../types/church';

export interface MembershipAnalyticsData {
  total: number;
  statusCounts: Record<string, number>;
  genderCounts: Record<string, number>;
  ageCategoryCounts: Record<string, number>;
  ministryCounts: Record<string, number>;
  categoryCounts: Record<string, number>;
  monthlyGrowth: Array<{ month: string; count: number }>;
}

interface MemberAnalyticsPanelProps {
  analytics: MembershipAnalyticsData;
  recentMembers: MemberRecord[];
  onViewMemberTab?: () => void;
}

export const MemberAnalyticsPanel: React.FC<MemberAnalyticsPanelProps> = ({
  analytics,
  recentMembers,
  onViewMemberTab,
}) => {
  const status = analytics.statusCounts || {};
  const total = analytics.total || 0;
  const newCount = status['New Member'] || 0;
  const activeCount = status['Active Member'] || 0;
  const transferredCount = status['Transferred'] || 0;
  const followupCount = status['Pending Follow-up'] || 0;
  const inactiveCount = status['Inactive'] || 0;

  const genderEntries = Object.entries(analytics.genderCounts || {});
  const genderMax = Math.max(1, ...genderEntries.map(([, v]) => v));

  const ageEntries = Object.entries(analytics.ageCategoryCounts || {});
  const ageMax = Math.max(1, ...ageEntries.map(([, v]) => v));

  const ministryEntries = Object.entries(analytics.ministryCounts || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const ministryMax = Math.max(1, ...ministryEntries.map(([, v]) => v));

  const growthPoints = analytics.monthlyGrowth || [];
  const growthMax = Math.max(1, ...growthPoints.map((g) => g.count));

  const maleVal = analytics.genderCounts?.Male || 0;
  const femaleVal = analytics.genderCounts?.Female || 0;
  const unspecVal = analytics.genderCounts?.Unspecified || 0;
  const genderTotal = Math.max(1, maleVal + femaleVal + unspecVal);

  // SVG Donut arcs
  const r = 42;
  const circ = 2 * Math.PI * r;
  const maleArc = (maleVal / genderTotal) * circ;
  const femaleArc = (femaleVal / genderTotal) * circ;
  const unspecArc = (unspecVal / genderTotal) * circ;

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-[#B4823E]" />
            Membership Demographics &amp; Growth Analytics
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Live statistical breakdown across membership status, gender, age groups, ministries, and monthly registration growth.
          </p>
        </div>
        {onViewMemberTab && (
          <button
            type="button"
            onClick={onViewMemberTab}
            className="px-3.5 py-2 bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
          >
            Open Full Member Register →
          </button>
        )}
      </div>

      {/* 5 Primary Membership KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Total Registered</span>
            <Users className="w-4 h-4 text-[#0F172A]" />
          </div>
          <p className="font-mono tabular-nums text-2xl font-semibold text-[#0F172A] mt-2">{total}</p>
          <p className="text-[11px] text-slate-500 mt-1">All recorded members</p>
        </div>

        <div className="bg-white border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] uppercase tracking-wider font-semibold">New Members</span>
            <UserPlus className="w-4 h-4 text-[#B4823E]" />
          </div>
          <p className="font-mono tabular-nums text-2xl font-semibold text-[#9A6B2F] mt-2">{newCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">Recent joiners</p>
        </div>

        <div className="bg-white border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Active Members</span>
            <UserCheck className="w-4 h-4 text-emerald-700" />
          </div>
          <p className="font-mono tabular-nums text-2xl font-semibold text-emerald-700 mt-2">{activeCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">Confirmed active</p>
        </div>

        <div className="bg-white border border-slate-200 p-4">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Pending Follow-up</span>
            <TrendingUp className="w-4 h-4 text-amber-600" />
          </div>
          <p className="font-mono tabular-nums text-2xl font-semibold text-amber-700 mt-2">{followupCount}</p>
          <p className="text-[11px] text-slate-500 mt-1">Awaiting pastoral care</p>
        </div>

        <div className="bg-white border border-slate-200 p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] uppercase tracking-wider font-semibold">Transferred / Inactive</span>
          </div>
          <p className="font-mono tabular-nums text-2xl font-semibold text-slate-700 mt-2">
            {transferredCount} <span className="text-xs font-normal text-slate-400">/ {inactiveCount} inactive</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Transfers &amp; archived</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Gender Breakdown Donut + Bars */}
        <div className="lg:col-span-4 bg-white border border-slate-200 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Members by Gender</h3>
          <div className="flex items-center gap-5">
            <svg width="110" height="110" viewBox="0 0 110 110" className="shrink-0">
              <circle cx="55" cy="55" r={r} fill="none" stroke="#E2E8F0" strokeWidth="14" />
              {total > 0 && (
                <>
                  <circle
                    cx="55"
                    cy="55"
                    r={r}
                    fill="none"
                    stroke="#0F172A"
                    strokeWidth="14"
                    strokeDasharray={`${maleArc} ${circ}`}
                    strokeDashoffset="0"
                    transform="rotate(-90 55 55)"
                  />
                  <circle
                    cx="55"
                    cy="55"
                    r={r}
                    fill="none"
                    stroke="#B4823E"
                    strokeWidth="14"
                    strokeDasharray={`${femaleArc} ${circ}`}
                    strokeDashoffset={-maleArc}
                    transform="rotate(-90 55 55)"
                  />
                  <circle
                    cx="55"
                    cy="55"
                    r={r}
                    fill="none"
                    stroke="#94A3B8"
                    strokeWidth="14"
                    strokeDasharray={`${unspecArc} ${circ}`}
                    strokeDashoffset={-(maleArc + femaleArc)}
                    transform="rotate(-90 55 55)"
                  />
                </>
              )}
              <text x="55" y="53" textAnchor="middle" className="fill-slate-900 text-sm font-bold font-mono">
                {total}
              </text>
              <text x="55" y="67" textAnchor="middle" className="fill-slate-500 text-[9px] uppercase">
                Total
              </text>
            </svg>

            <div className="flex-1 space-y-2.5 text-xs">
              {genderEntries.map(([label, val]) => {
                const color =
                  label === 'Male' ? 'bg-[#0F172A]' : label === 'Female' ? 'bg-[#B4823E]' : 'bg-slate-400';
                const pct = total ? Math.round((val / total) * 100) : 0;
                return (
                  <div key={label}>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-700 font-medium">{label}</span>
                      <span className="font-mono tabular-nums text-slate-900 font-semibold">
                        {val} ({pct}%)
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-100">
                      <div className={`h-full ${color}`} style={{ width: `${(val / genderMax) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Age Category Distribution */}
        <div className="lg:col-span-4 bg-white border border-slate-200 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Members by Age Category</h3>
          <div className="space-y-2.5 text-xs">
            {ageEntries.map(([ageGroup, val]) => (
              <div key={ageGroup}>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-700">{ageGroup}</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">{val}</span>
                </div>
                <div className="h-2 bg-slate-100">
                  <div
                    className="h-full bg-[#0F172A]"
                    style={{ width: `${total ? Math.max(val > 0 ? 4 : 0, (val / ageMax) * 100) : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Monthly Membership Growth */}
        <div className="lg:col-span-4 bg-white border border-slate-200 p-5 flex flex-col justify-between space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Membership Growth Trend</h3>
            <p className="text-[11px] text-slate-500">Registrations grouped by month</p>
          </div>
          {growthPoints.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">
              Monthly growth bars will populate as members register.
            </p>
          ) : (
            <div className="flex items-end gap-2 h-36 pt-4 border-b border-slate-200 pb-1">
              {growthPoints.map((pt) => {
                const heightPct = Math.max(10, Math.round((pt.count / growthMax) * 100));
                return (
                  <div key={pt.month} className="flex-1 flex flex-col items-center justify-end h-full min-w-0">
                    <span className="font-mono tabular-nums text-[10px] font-semibold text-slate-700 mb-1">
                      {pt.count}
                    </span>
                    <div
                      className="w-full max-w-[32px] bg-[#B4823E] hover:bg-[#9A6B2F] transition-all"
                      style={{ height: `${heightPct}%` }}
                      title={`${pt.month}: ${pt.count} registrations`}
                    />
                    <span className="font-mono text-[9px] text-slate-500 mt-1.5 truncate w-full text-center">
                      {pt.month.slice(2)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Ministries Breakdown + Recent Registrations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-6 bg-white border border-slate-200 p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900">Members Grouped by Ministry Interest</h3>
          {ministryEntries.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">
              Ministry interest statistics will appear once members select ministries during registration.
            </p>
          ) : (
            <div className="space-y-2.5 text-xs">
              {ministryEntries.map(([name, val]) => (
                <div key={name}>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-700 font-medium">{name}</span>
                    <span className="font-mono tabular-nums font-semibold text-slate-900">{val}</span>
                  </div>
                  <div className="h-2 bg-slate-100">
                    <div
                      className="h-full bg-[#B4823E]"
                      style={{ width: `${(val / ministryMax) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-6 bg-white border border-slate-200 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">Recent Member Registrations</h3>
            <span className="text-[11px] font-mono text-slate-500">Latest {recentMembers.length}</span>
          </div>
          {recentMembers.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">No members registered yet.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentMembers.map((m) => (
                <div key={m.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{m.fullName}</p>
                    <p className="text-[11px] text-slate-500 font-mono truncate">
                      {m.phone} · {m.membershipType}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono text-[11px] font-semibold text-[#0F172A] block">
                      {m.memberNumber}
                    </span>
                    <span className="text-[10px] text-[#9A6B2F] font-medium">
                      {m.membershipStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
