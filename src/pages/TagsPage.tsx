import React, { useState, useMemo } from 'react';
import { Filter, X } from 'lucide-react';
import { Header } from '../components/layout/Header';
import { DataTable } from '../components/ui/DataTable';
import { ExportButton } from '../components/ui/ExportButton';
import { useRFID } from '../context/RFIDContext';
import { FilterOptions } from '../types';

export const TagsPage: React.FC = () => {
  const { tags, devices } = useRFID();
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({});

  // Filter and search tags
  const filteredTags = useMemo(() => {
    return tags.filter(tag => {
      // Search query
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

      // Filters
      if (filters.tagId && !tag.tagId.includes(filters.tagId)) {
        return false;
      }
      if (filters.epc && !tag.epc.includes(filters.epc)) {
        return false;
      }
      if (filters.readerId && tag.readerId !== filters.readerId) {
        return false;
      }
        if (filters.startDate) {
          const tagDate = tag.readTime ? new Date((tag.readTime as string).replace(' ', 'T') + 'Z') : null;
          if (!tagDate || tagDate < new Date(filters.startDate)) return false;
        }
        if (filters.endDate) {
          const tagDate = tag.readTime ? new Date((tag.readTime as string).replace(' ', 'T') + 'Z') : null;
          if (!tagDate || tagDate > new Date(filters.endDate)) return false;
        }

      return true;
    });
  }, [tags, searchQuery, filters]);

  const clearFilters = () => {
    setFilters({});
    setSearchQuery('');
  };

  const columns = [
    { key: 'tagId', label: 'Tag ID' },
    { 
      key: 'epc', 
      label: 'EPC',
      render: (value: string) => (
        <span className="font-mono text-xs">{value}</span>
      )
    },
    { key: 'readerName', label: 'Reader' },
    { 
      key: 'rssi', 
      label: 'RSSI (dBm)',
      render: (value: number) => (
        <span className={value > -50 ? 'text-green-600' : value > -70 ? 'text-orange-600' : 'text-red-600'}>
          {value}
        </span>
      )
    },
    { key: 'antenna', label: 'Antenna' },
    { key: 'count', label: 'Read Count' },
    { 
      key: 'readTime', 
      label: 'Timestamp',
      render: (value: string) => {
        if (!value) return <span className="text-xs">''</span>;
        // Parse the time portion from the tag's readTime (assumed UTC)
        const parsed = new Date(value.replace(' ', 'T') + 'Z');
        if (isNaN(parsed.getTime())) return <span className="text-xs">{value}</span>;

        // Use current UTC date but keep the tag's time (hours/minutes/seconds)
        const now = new Date();
        const year = now.getUTCFullYear();
        const month = now.getUTCMonth();
        const day = now.getUTCDate();

        const combined = new Date(Date.UTC(year, month, day, parsed.getUTCHours(), parsed.getUTCMinutes(), parsed.getUTCSeconds()));

        return (
          <span className="text-xs">
            {combined.toLocaleString([], { timeZone: 'UTC' })}
          </span>
        );
      }
    }
  ];

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      <Header 
        title="Tag Data" 
        showSearch 
        onSearch={setSearchQuery}
      />
      
      <div className="flex-1 p-8 overflow-y-auto">
        {/* Actions Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Filter className="size-4" />
              Filters
              {Object.keys(filters).filter(k => filters[k as keyof FilterOptions]).length > 0 && (
                <span className="px-2 py-0.5 bg-indigo-600 text-white text-xs rounded-full">
                  {Object.keys(filters).filter(k => filters[k as keyof FilterOptions]).length}
                </span>
              )}
            </button>

            {(searchQuery || Object.keys(filters).some(k => filters[k as keyof FilterOptions])) && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                <X className="size-4" />
                Clear all
              </button>
            )}

            <div className="text-sm text-gray-600">
              Showing {filteredTags.length} of {tags.length} tags
            </div>
          </div>

          <ExportButton 
            data={filteredTags}
            filename="rfid-tags"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Search by Tag ID"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-2">EPC</label>
                <input
                  type="text"
                  value={filters.epc || ''}
                  onChange={(e) => setFilters({ ...filters, epc: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Search by EPC"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-2">Reader</label>
                <select
                  value={filters.readerId || ''}
                  onChange={(e) => setFilters({ ...filters, readerId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Readers</option>
                  {devices.map(device => (
                    <option key={device.id} value={device.id}>
                      {device.name}
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-2">End Date</label>
                <input
                  type="datetime-local"
                  value={filters.endDate || ''}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Data Table */}
        <DataTable
          columns={columns}
          data={filteredTags}
          pageSize={20}
          emptyMessage="No tags found"
        />
      </div>
    </div>
  );
};
