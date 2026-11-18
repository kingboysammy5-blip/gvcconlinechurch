import React, { useMemo, useState } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  MapPin,
  Phone,
  Users,
} from 'lucide-react';
import {
  ChurchSettings,
  EventItem,
  Fellowship,
  ServiceTimeItem,
} from '../../types/church';

interface ChurchEventsCalendarProps {
  events: EventItem[];
  fellowships: Fellowship[];
  settings: ChurchSettings;
  onSelectEvent: (event: EventItem) => void;
  onSelectFellowship: (fellowship: Fellowship) => void;
}

type CalendarFilter = 'all' | 'events' | 'fellowships' | 'services';
type ViewMode = 'month' | 'list';

interface CalendarEntry {
  id: string;
  kind: 'event' | 'fellowship' | 'service';
  title: string;
  category: string;
  timeLabel: string;
  location: string;
  description?: string;
  event?: EventItem;
  fellowship?: Fellowship;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const WEEKDAY_NAMES_FULL = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseEventDateKey(startDatetime: string): string | null {
  if (!startDatetime) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(startDatetime)) {
    return startDatetime.slice(0, 10);
  }
  const parsed = new Date(startDatetime);
  if (Number.isNaN(parsed.getTime())) return null;
  return toDateKey(parsed);
}

function formatEventTime(startDatetime: string): string {
  const parsed = new Date(startDatetime);
  if (Number.isNaN(parsed.getTime())) return 'Time TBA';
  return parsed.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function matchesWeekday(label: string | null | undefined, weekdayIndex: number): boolean {
  if (!label) return false;
  const lower = label.toLowerCase();
  const full = WEEKDAY_NAMES_FULL[weekdayIndex].toLowerCase();
  const short = WEEKDAYS[weekdayIndex].toLowerCase();
  return lower.includes(full) || new RegExp(`\\b${short}\\b`).test(lower);
}

export const ChurchEventsCalendar: React.FC<ChurchEventsCalendarProps> = ({
  events,
  fellowships,
  settings,
  onSelectEvent,
  onSelectFellowship,
}) => {
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);

  const [viewMonth, setViewMonth] = useState<{ year: number; month: number }>(() => ({
    year: today.getFullYear(),
    month: today.getMonth(),
  }));
  const [selectedDateKey, setSelectedDateKey] = useState<string>(todayKey);
  const [filter, setFilter] = useState<CalendarFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('month');

  const confirmedServices: ServiceTimeItem[] = useMemo(() => {
    if (!settings.serviceScheduleVerified || !Array.isArray(settings.serviceTimes)) {
      return [];
    }
    return settings.serviceTimes.filter((s) => s.title && s.day && s.time);
  }, [settings.serviceScheduleVerified, settings.serviceTimes]);

  const scheduledFellowships = useMemo(
    () => fellowships.filter((f) => f.isVerified && Boolean(f.meetingDay)),
    [fellowships]
  );

  // Build 42-cell calendar grid for active month
  const calendarCells = useMemo(() => {
    const firstOfMonth = new Date(viewMonth.year, viewMonth.month, 1);
    const startOffset = firstOfMonth.getDay();
    const gridStart = new Date(viewMonth.year, viewMonth.month, 1 - startOffset);

    const cells: Array<{
      date: Date;
      dateKey: string;
      inMonth: boolean;
      entries: CalendarEntry[];
    }> = [];

    for (let i = 0; i < 42; i++) {
      const cellDate = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
      const key = toDateKey(cellDate);
      const weekdayIdx = cellDate.getDay();
      const entries: CalendarEntry[] = [];

      if (filter === 'all' || filter === 'events') {
        for (const ev of events) {
          if (parseEventDateKey(ev.startDatetime) === key) {
            entries.push({
              id: `ev-${ev.id}`,
              kind: 'event',
              title: ev.title,
              category: ev.eventCategory,
              timeLabel: formatEventTime(ev.startDatetime),
              location: ev.location,
              description: ev.description,
              event: ev,
            });
          }
        }
      }

      if (filter === 'all' || filter === 'fellowships') {
        for (const fel of scheduledFellowships) {
          if (matchesWeekday(fel.meetingDay, weekdayIdx)) {
            entries.push({
              id: `fel-${fel.id}-${key}`,
              kind: 'fellowship',
              title: fel.name,
              category: 'Fellowship Meeting',
              timeLabel: fel.meetingTime || 'Time via leader',
              location: fel.meetingLocation || settings.location,
              description: fel.description,
              fellowship: fel,
            });
          }
        }
      }

      if (filter === 'all' || filter === 'services') {
        confirmedServices.forEach((srv, idx) => {
          if (matchesWeekday(srv.day, weekdayIdx)) {
            entries.push({
              id: `srv-${idx}-${key}`,
              kind: 'service',
              title: srv.title,
              category: 'Weekly Service Time',
              timeLabel: srv.time,
              location: settings.location,
            });
          }
        });
      }

      cells.push({
        date: cellDate,
        dateKey: key,
        inMonth: cellDate.getMonth() === viewMonth.month,
        entries,
      });
    }

    return cells;
  }, [confirmedServices, events, filter, scheduledFellowships, settings.location, viewMonth.month, viewMonth.year]);

  const selectedCell = useMemo(() => {
    const match = calendarCells.find((c) => c.dateKey === selectedDateKey);
    if (match) return match;

    const [y, m, d] = selectedDateKey.split('-').map(Number);
    const fallbackDate = new Date(y, (m || 1) - 1, d || 1);
    const weekdayIdx = fallbackDate.getDay();
    const entries: CalendarEntry[] = [];

    if (filter === 'all' || filter === 'events') {
      for (const ev of events) {
        if (parseEventDateKey(ev.startDatetime) === selectedDateKey) {
          entries.push({
            id: `ev-${ev.id}`,
            kind: 'event',
            title: ev.title,
            category: ev.eventCategory,
            timeLabel: formatEventTime(ev.startDatetime),
            location: ev.location,
            description: ev.description,
            event: ev,
          });
        }
      }
    }
    if (filter === 'all' || filter === 'fellowships') {
      for (const fel of scheduledFellowships) {
        if (matchesWeekday(fel.meetingDay, weekdayIdx)) {
          entries.push({
            id: `fel-${fel.id}-${selectedDateKey}`,
            kind: 'fellowship',
            title: fel.name,
            category: 'Fellowship Meeting',
            timeLabel: fel.meetingTime || 'Time via leader',
            location: fel.meetingLocation || settings.location,
            description: fel.description,
            fellowship: fel,
          });
        }
      }
    }
    if (filter === 'all' || filter === 'services') {
      confirmedServices.forEach((srv, idx) => {
        if (matchesWeekday(srv.day, weekdayIdx)) {
          entries.push({
            id: `srv-${idx}-${selectedDateKey}`,
            kind: 'service',
            title: srv.title,
            category: 'Weekly Service Time',
            timeLabel: srv.time,
            location: settings.location,
          });
        }
      });
    }
    return {
      date: fallbackDate,
      dateKey: selectedDateKey,
      inMonth: true,
      entries,
    };
  }, [calendarCells, confirmedServices, events, filter, scheduledFellowships, selectedDateKey, settings.location]);

  const activeMonthLabel = useMemo(
    () =>
      new Date(viewMonth.year, viewMonth.month, 1).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      }),
    [viewMonth.month, viewMonth.year]
  );

  const monthEventsCount = useMemo(() => {
    const prefix = `${viewMonth.year}-${String(viewMonth.month + 1).padStart(2, '0')}`;
    return events.filter((ev) => parseEventDateKey(ev.startDatetime)?.startsWith(prefix)).length;
  }, [events, viewMonth.month, viewMonth.year]);

  const shiftMonth = (delta: number) => {
    const next = new Date(viewMonth.year, viewMonth.month + delta, 1);
    setViewMonth({ year: next.getFullYear(), month: next.getMonth() });
  };

  const jumpToToday = () => {
    setViewMonth({ year: today.getFullYear(), month: today.getMonth() });
    setSelectedDateKey(todayKey);
  };

  const downloadEventIcs = (ev: EventItem) => {
    const start = ev.startDatetime.replace(/[-:]/g, '').slice(0, 15) + 'Z';
    const end = (ev.endDatetime || ev.startDatetime).replace(/[-:]/g, '').slice(0, 15) + 'Z';
    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      `SUMMARY:${ev.title}`,
      `LOCATION:${ev.location}`,
      `DESCRIPTION:${ev.description.replace(/\n/g, ' ')}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ev.slug || 'gvcc-event'}.ics`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedDateFormatted = selectedCell.date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="space-y-8">
      {/* Toolbar: Month Controls, Category Filter, View Switcher */}
      <div className="bg-[#FBF9F5] border border-stone-200 p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Month Navigation */}
        <div className="flex items-center justify-between sm:justify-start gap-3">
          <div className="flex items-center border border-stone-300 bg-white">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Previous month"
              className="h-10 w-10 flex items-center justify-center text-stone-700 hover:bg-stone-100 border-r border-stone-200 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-4 font-serif text-lg sm:text-xl font-medium text-[#1C1917] min-w-[165px] text-center whitespace-nowrap">
              {activeMonthLabel}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Next month"
              className="h-10 w-10 flex items-center justify-center text-stone-700 hover:bg-stone-100 border-l border-stone-200 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <button
            type="button"
            onClick={jumpToToday}
            className="h-10 px-3.5 border border-stone-300 bg-white text-xs font-medium text-[#1C1917] hover:bg-stone-100 whitespace-nowrap shrink-0 cursor-pointer"
          >
            Today
          </button>
        </div>

        {/* Category Filter + View Mode */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 bg-[#F3EFE7] p-1 border border-stone-200">
            {(
              [
                ['all', 'All'],
                ['events', 'Church Events'],
                ['fellowships', 'Fellowships'],
                ['services', 'Service Times'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setFilter(id)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  filter === id
                    ? 'bg-[#1C1917] text-white'
                    : 'text-stone-700 hover:text-[#1C1917]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-[#F3EFE7] p-1 border border-stone-200">
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'month'
                  ? 'bg-white text-[#1C1917] border border-stone-200'
                  : 'text-stone-600 hover:text-[#1C1917]'
              }`}
            >
              Month Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-[#1C1917] border border-stone-200'
                  : 'text-stone-600 hover:text-[#1C1917]'
              }`}
            >
              Agenda List
            </button>
          </div>
        </div>
      </div>

      {/* Main Content: Month Grid + Selected Day & Weekly Schedule */}
      {viewMode === 'month' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Interactive Monthly Grid */}
          <div className="lg:col-span-7 bg-white border border-stone-200">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 border-b border-stone-200 bg-[#F3EFE7]">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="py-2.5 text-center text-[11px] font-mono uppercase tracking-wider text-stone-600 font-semibold"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* 6x7 Day Cells */}
            <div className="grid grid-cols-7 divide-x divide-y divide-stone-200">
              {calendarCells.map((cell) => {
                const isSelected = cell.dateKey === selectedDateKey;
                const isToday = cell.dateKey === todayKey;
                const hasEvents = cell.entries.some((e) => e.kind === 'event');
                const hasFellowships = cell.entries.some((e) => e.kind === 'fellowship');
                const hasServices = cell.entries.some((e) => e.kind === 'service');

                return (
                  <button
                    key={cell.dateKey}
                    type="button"
                    onClick={() => {
                      setSelectedDateKey(cell.dateKey);
                      if (!cell.inMonth) {
                        setViewMonth({
                          year: cell.date.getFullYear(),
                          month: cell.date.getMonth(),
                        });
                      }
                    }}
                    className={`min-h-[68px] sm:min-h-[84px] p-1.5 sm:p-2 text-left flex flex-col justify-between transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#1C1917] text-white'
                        : cell.inMonth
                        ? 'bg-white text-[#1C1917] hover:bg-[#FBF9F5]'
                        : 'bg-[#F8F6F2] text-stone-400 hover:bg-[#F3EFE7]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`font-mono tabular-nums text-xs sm:text-sm font-medium ${
                          isToday && !isSelected
                            ? 'text-[#9A6B2F] font-semibold underline underline-offset-4'
                            : ''
                        }`}
                      >
                        {cell.date.getDate()}
                      </span>
                      {cell.entries.length > 0 && (
                        <span
                          className={`font-mono tabular-nums text-[10px] ${
                            isSelected ? 'text-[#E2C28B]' : 'text-stone-500'
                          }`}
                        >
                          {cell.entries.length}
                        </span>
                      )}
                    </div>

                    {/* Concise Day Entry Indicators */}
                    <div className="space-y-0.5 mt-1 w-full overflow-hidden">
                      {cell.entries.slice(0, 2).map((entry) => (
                        <div
                          key={entry.id}
                          className={`hidden sm:block text-[10px] leading-tight truncate px-1 py-0.5 ${
                            isSelected
                              ? 'bg-white/15 text-stone-100'
                              : entry.kind === 'event'
                              ? 'bg-[#1C1917] text-white'
                              : entry.kind === 'fellowship'
                              ? 'bg-[#F3EFE7] text-[#1C1917]'
                              : 'bg-[#EFE6D5] text-[#7A521E]'
                          }`}
                        >
                          {entry.title}
                        </div>
                      ))}
                      {/* Mobile compact bars */}
                      {(hasEvents || hasFellowships || hasServices) && (
                        <div className="flex sm:hidden gap-1 pt-1">
                          {hasEvents && <span className="h-1 flex-1 bg-[#B4823E]" />}
                          {hasFellowships && <span className="h-1 flex-1 bg-stone-500" />}
                          {hasServices && <span className="h-1 flex-1 bg-stone-300" />}
                        </div>
                      )}
                      {cell.entries.length > 2 && (
                        <span
                          className={`hidden sm:block text-[10px] font-mono ${
                            isSelected ? 'text-[#E2C28B]' : 'text-stone-500'
                          }`}
                        >
                          +{cell.entries.length - 2} more
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Quiet Calendar Legend */}
            <div className="px-4 py-3 bg-[#FBF9F5] border-t border-stone-200 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-600">
              <div className="flex flex-wrap items-center gap-4">
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-[#1C1917] inline-block" aria-hidden="true" />
                  Church Event
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-[#F3EFE7] border border-stone-300 inline-block" aria-hidden="true" />
                  Fellowship Meeting
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 bg-[#EFE6D5] border border-[#D6C3A1] inline-block" aria-hidden="true" />
                  Service Time
                </span>
              </div>
              <span className="font-mono tabular-nums text-[11px] text-stone-500">
                {monthEventsCount} published {monthEventsCount === 1 ? 'event' : 'events'} this month
              </span>
            </div>
          </div>

          {/* Right Column: Selected Day Agenda + Weekly Service Times */}
          <div className="lg:col-span-5 space-y-6">
            {/* Selected Date Details */}
            <div className="bg-[#FBF9F5] border border-stone-200 p-6 space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-stone-200 pb-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[#9A6B2F] font-semibold">
                    Selected Day Schedule
                  </p>
                  <h3 className="font-serif text-xl font-medium text-[#1C1917] mt-0.5">
                    {selectedDateFormatted}
                  </h3>
                </div>
                <span className="font-mono tabular-nums text-xs text-stone-500 shrink-0 pt-1">
                  {selectedCell.entries.length} {selectedCell.entries.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              {selectedCell.entries.length === 0 ? (
                <div className="py-4 space-y-3">
                  <p className="text-sm text-stone-600 leading-relaxed">
                    No special events or confirmed meetings are listed on this date. Check the Weekly Service Times & Fellowship directory below or select another date.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {events.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const first = events[0];
                          const key = parseEventDateKey(first.startDatetime);
                          if (key) {
                            const d = new Date(first.startDatetime);
                            if (!Number.isNaN(d.getTime())) {
                              setViewMonth({ year: d.getFullYear(), month: d.getMonth() });
                            }
                            setSelectedDateKey(key);
                          }
                        }}
                        className="px-3.5 py-2 bg-[#1C1917] text-white text-xs font-semibold cursor-pointer"
                      >
                        Jump to Next Event
                      </button>
                    )}
                    <a
                      href="#connect"
                      className="px-3.5 py-2 border border-stone-300 bg-white text-xs font-medium text-[#1C1917] hover:bg-stone-100"
                    >
                      Inquire with Church Office
                    </a>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedCell.entries.map((entry) => (
                    <div key={entry.id} className="bg-white border border-stone-200 p-4 space-y-2">
                      <p className="text-xs font-mono text-stone-500">
                        {entry.category}
                        <span className="mx-1.5" aria-hidden="true">·</span>
                        {entry.timeLabel}
                      </p>
                      <h4 className="font-serif text-lg font-medium text-[#1C1917]">
                        {entry.title}
                      </h4>
                      <p className="text-xs text-stone-600 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-[#9A6B2F] shrink-0" />
                        <span>{entry.location}</span>
                      </p>
                      {entry.description && (
                        <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                          {entry.description}
                        </p>
                      )}
                      {entry.event && (
                        <div className="flex flex-wrap gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => onSelectEvent(entry.event!)}
                            className="px-3.5 py-2 bg-[#1C1917] text-white text-xs font-semibold hover:bg-stone-800 cursor-pointer"
                          >
                            View Details & Register
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadEventIcs(entry.event!)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 border border-stone-300 text-xs font-medium text-[#1C1917] hover:bg-stone-100 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            .ics
                          </button>
                        </div>
                      )}
                      {entry.fellowship && (
                        <div className="pt-2">
                          <button
                            type="button"
                            onClick={() => onSelectFellowship(entry.fellowship!)}
                            className="px-3.5 py-2 border border-[#1C1917] text-xs font-semibold text-[#1C1917] hover:bg-[#1C1917] hover:text-white transition-colors cursor-pointer"
                          >
                            Join Fellowship
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Weekly Service Times & Fellowship Meetings Directory */}
            <div className="bg-white border border-stone-200 p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-stone-200 pb-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-[#9A6B2F] font-semibold">
                    Weekly Rhythm
                  </p>
                  <h3 className="font-serif text-xl font-medium text-[#1C1917]">
                    Service Times & Fellowships
                  </h3>
                </div>
                <Clock className="w-4 h-4 text-[#9A6B2F]" />
              </div>

              {confirmedServices.length > 0 ? (
                <ul className="divide-y divide-stone-100 text-sm">
                  {confirmedServices.map((s, idx) => (
                    <li key={idx} className="py-2.5 flex items-center justify-between gap-4">
                      <span className="font-medium text-[#1C1917]">{s.title}</span>
                      <span className="font-mono tabular-nums text-xs text-stone-600 shrink-0">
                        {s.day} · {s.time}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="bg-[#FBF9F5] border border-stone-200 p-4 space-y-2">
                  <p className="text-xs font-semibold text-stone-700 uppercase tracking-wider">
                    Service Times · Pending Official Confirmation
                  </p>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    {settings.serviceScheduleNotice}
                  </p>
                  <a
                    href={`tel:${settings.phone.replace(/\s+/g, '')}`}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#9A6B2F] hover:underline"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    Call {settings.phone} for this week’s worship hours
                  </a>
                </div>
              )}

              <div className="border-t border-stone-200 pt-4 space-y-2.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#9A6B2F]" />
                  Fellowship Gatherings ({fellowships.length})
                </p>
                <div className="divide-y divide-stone-100">
                  {fellowships.map((f) => (
                    <div key={f.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <p className="font-medium text-[#1C1917] truncate">{f.name}</p>
                        <p className="text-stone-500 truncate">
                          {f.isVerified && f.meetingDay
                            ? [f.meetingDay, f.meetingTime, f.meetingLocation].filter(Boolean).join(' · ')
                            : 'Meeting day awaiting leadership confirmation'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSelectFellowship(f)}
                        className="text-xs font-semibold text-[#9A6B2F] hover:underline shrink-0 cursor-pointer"
                      >
                        Connect →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Agenda List View */
        <div className="space-y-6">
          {(filter === 'all' || filter === 'events') && (
            <div className="space-y-4">
              <h3 className="font-serif text-2xl font-medium text-[#1C1917]">
                Published Church Events ({events.length})
              </h3>
              {events.length === 0 ? (
                <div className="bg-[#FBF9F5] border border-stone-200 p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 max-w-xl">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
                      <Calendar className="w-4 h-4 text-[#9A6B2F]" />
                      <span>Calendar Ready for Updates</span>
                    </div>
                    <p className="text-sm text-stone-600 leading-relaxed">
                      Special conferences, revival meetings, and upcoming church gatherings published by GVCC administrators appear here automatically. Call {settings.phone} for upcoming service announcements.
                    </p>
                  </div>
                  <a
                    href="#connect"
                    className="px-4 py-2.5 bg-[#1C1917] text-white text-xs font-semibold whitespace-nowrap shrink-0"
                  >
                    Stay Notified
                  </a>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {events.map((ev) => (
                    <article key={ev.id} className="bg-[#FBF9F5] border border-stone-200 flex flex-col">
                      {ev.posterUrl && (
                        <img
                          src={ev.posterUrl}
                          alt={ev.title}
                          referrerPolicy="no-referrer"
                          className="h-44 w-full object-cover"
                        />
                      )}
                      <div className="p-6 flex-1 flex flex-col">
                        <p className="text-xs font-mono text-stone-500 mb-1">
                          {ev.eventCategory} · {new Date(ev.startDatetime).toLocaleDateString()} · {formatEventTime(ev.startDatetime)}
                        </p>
                        <h4 className="font-serif text-xl font-medium text-[#1C1917] mb-2">{ev.title}</h4>
                        <p className="text-sm text-stone-600 line-clamp-3 flex-1 mb-4">{ev.description}</p>
                        <p className="text-xs text-stone-500 mb-4 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-[#9A6B2F]" />
                          {ev.location}
                        </p>
                        <button
                          type="button"
                          onClick={() => onSelectEvent(ev)}
                          className="w-full py-2.5 bg-[#1C1917] text-white text-xs font-semibold hover:bg-stone-800 cursor-pointer"
                        >
                          View Details & Register
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {(filter === 'all' || filter === 'services') && (
            <div className="bg-[#FBF9F5] border border-stone-200 p-6 space-y-3">
              <h3 className="font-serif text-xl font-medium text-[#1C1917]">Weekly Service Times</h3>
              {confirmedServices.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {confirmedServices.map((srv, idx) => (
                    <div key={idx} className="bg-white border border-stone-200 p-4">
                      <p className="text-xs font-mono text-[#9A6B2F]">{srv.day} · {srv.time}</p>
                      <p className="font-serif text-lg font-medium text-[#1C1917] mt-1">{srv.title}</p>
                      <p className="text-xs text-stone-500 mt-1">{settings.location}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-stone-600">{settings.serviceScheduleNotice}</p>
              )}
            </div>
          )}

          {(filter === 'all' || filter === 'fellowships') && (
            <div className="bg-[#FBF9F5] border border-stone-200 p-6 space-y-3">
              <h3 className="font-serif text-xl font-medium text-[#1C1917]">Fellowship Meetings</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {fellowships.map((f) => (
                  <div key={f.id} className="bg-white border border-stone-200 p-4 flex flex-col justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-mono text-stone-500">
                        {f.isVerified && f.meetingDay
                          ? `${f.meetingDay}${f.meetingTime ? ` · ${f.meetingTime}` : ''}`
                          : 'Schedule Pending Confirmation'}
                      </p>
                      <h4 className="font-serif text-lg font-medium text-[#1C1917] mt-1">{f.name}</h4>
                      <p className="text-xs text-stone-600 mt-1 line-clamp-2">{f.description}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onSelectFellowship(f)}
                      className="w-full py-2 border border-[#1C1917] text-xs font-semibold text-[#1C1917] hover:bg-[#1C1917] hover:text-white transition-colors cursor-pointer"
                    >
                      Join Fellowship
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
