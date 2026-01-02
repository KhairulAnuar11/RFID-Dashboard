import React, { useState, useMemo } from 'react';
import { Filter, X, Activity, Sparkles } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { DataTable } from '../components/ui/DataTable';
import { ExportButton } from '../components/ui/ExportButton';
import { useRFID } from '../context/RFIDContext';
import { FilterOptions } from '../types';

type TagTab = 'live' | 'unique';

export const TagsPage: React.FC = () => {
  const { tags, devices } = useRFID();

  const [activeTab, setActiveTab] = useState<TagTab>('live');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({});

  
  /* ---------------------------------------------------
     1. FILTERED TAGS (BASE)
  --------------------------------------------------- */
  const filteredTags = useMemo(() => {
    return tags.filter(tag => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !tag.tagId.toLowerCase().includes(query) &&
          !tag.epc.toLowerCase().includes(query) &&
          !tag.readerName.toLowerCase().includes(query)
        ) {
          return false;
        }
      }

      if (filters.tagId && !tag.tagId.includes(filters.tagId)) return false;
      if (filters.epc && !tag.epc.includes(filters.epc)) return false;
      if (filters.readerId && tag.readerId !== filters.readerId) return false;

      if (filters.startDate) {
        const d = new Date(tag.readTime.replace(' ', 'T') + 'Z');
        if (d < new Date(filters.startDate)) return false;
      }

      if (filters.endDate) {
        const d = new Date(tag.readTime.replace(' ', 'T') + 'Z');
        if (d > new Date(filters.endDate)) return false;
      }

      return true;
    });
  }, [tags, searchQuery, filters]);

  /* ---------------------------------------------------
     2. UNIQUE TAG AGGREGATION
  --------------------------------------------------- */
  const uniqueTags = useMemo(() => {
    const map = new Map<string, any>();

    filteredTags.forEach(tag => {
      const key = tag.epc; // 👉 change to tag.tagId if needed

      if (!map.has(key)) {
        map.set(key, {
          ...tag,
          count: tag.count || 1,
          lastSeen: tag.readTime,
        });
      } else {
        const existing = map.get(key);
        existing.count += tag.count || 1;

        // update last seen info
        if (new Date(tag.readTime) > new Date(existing.lastSeen)) {
          existing.readerName = tag.readerName;
          existing.rssi = tag.rssi;
          existing.antenna = tag.antenna;
          existing.lastSeen = tag.readTime;
        }
      }
    });

    return Array.from(map.values());
  }, [filteredTags]);

  const displayedData = activeTab === 'live' ? filteredTags : uniqueTags;

  const clearFilters = () => {
    setFilters({});
    setSearchQuery('');
  };

  /* ---------------------------------------------------
     3. TABLE COLUMNS
  --------------------------------------------------- */
  const columns = [
    { key: 'tagId', label: 'Tag ID' },
    {
      key: 'epc',
      label: 'EPC',
      render: (v: string) => <span className="font-mono text-xs">{v}</span>,
    },
    { key: 'readerName', label: 'Reader' },
    {
      key: 'rssi',
      label: 'RSSI (dBm)',
      render: (v: number) => (
        <span
          className={
            v > -50 ? 'text-green-600' : v > -70 ? 'text-orange-600' : 'text-red-600'
          }
        >
          {v}
        </span>
      ),
    },
    { key: 'antenna', label: 'Antenna' },
    { key: 'count', label: 'Read Count' },
    {
      key: activeTab === 'unique' ? 'lastSeen' : 'readTime',
      label: 'Timestamp',
      render: (v: string) => {
        if (!v) return '-';
        const d = new Date(v.replace(' ', 'T') + 'Z');
        return <span className="text-xs">{d.toLocaleString([], { timeZone: 'UTC' })}</span>;
      },
    },
  ];

  /* ---------------------------------------------------
     4. RENDER
  --------------------------------------------------- */
  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      <Header title="Tag Data" showSearch onSearch={setSearchQuery} />

      <div className="flex-1 p-8 overflow-y-auto">

        {/* Tabs Container */}
        <div className="g-white rounded-lg border border-gray-200 p-2 mb-6 flex gap-2">
          <button
            onClick={() => setActiveTab('live')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all
              ${
                activeTab === 'live'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            <Activity className="size-4" />
            Live Tags
          </button>

          <button
            onClick={() => setActiveTab('unique')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-all
              ${
                activeTab === 'unique'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
          >
            <Sparkles className="size-4" />
            Unique Tags
          </button>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-white border rounded-lg"
            >
              <Filter className="size-4" />
              Filters
            </button>

            {(searchQuery || Object.keys(filters).length > 0) && (
              <button onClick={clearFilters} className="flex items-center gap-2">
                <X className="size-4" />
                Clear
              </button>
            )}

            <div className="text-sm text-gray-600">
              Showing {displayedData.length} {activeTab === 'live' ? 'reads' : 'unique tags'}
            </div>
          </div>

          <ExportButton
            data={displayedData}
            filename={`rfid-tags-${activeTab}`}
            columns={['tagId', 'epc', 'readerName', 'rssi', 'antenna', 'count', 'readTime']}
          />
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
            <h3 className="text-sm text-gray-700 mb-4">Filter Options</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-2">Tag ID</label>
                <input
                  type="text"
                  value={filters.tagId || ''}
                  onChange={(e) => setFilters({ ...filters, tagId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-2">EPC</label>
                <input
                  type="text"
                  value={filters.epc || ''}
                  onChange={(e) => setFilters({ ...filters, epc: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-2">Reader</label>
                <select
                  value={filters.readerId || ''}
                  onChange={(e) => setFilters({ ...filters, readerId: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Readers</option>
                  {devices.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-2">Start Date</label>
                <input
                  type="datetime-local"
                  value={filters.startDate || ''}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-2">End Date</label>
                <input
                  type="datetime-local"
                  value={filters.endDate || ''}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>
            </div>
          </div>
        )}

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={displayedData}
          pageSize={20}
          emptyMessage="No tags found"
        />
      </div>
    </div>
  );
};
