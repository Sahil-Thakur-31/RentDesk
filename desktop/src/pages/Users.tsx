import { useState } from 'react';
import api from '../lib/api';
import Badge, { type BadgeTone } from '../components/Badge';
import SortableTable, { type TableColumn } from '../components/SortableTable';
import { UserIcon } from '../components/icons';

const roleTone = (role: string): BadgeTone => {
  if (role === 'owner') return 'accent';
  if (role === 'manager') return 'info';
  if (role === 'accountant') return 'warning';
  return 'neutral';
};

const Users = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);

  const search = async () => {
    const response = await api.get(`/users?email=${encodeURIComponent(query)}`);
    setResults(response.data);
  };

  const columns: TableColumn<any>[] = [
    { key: 'fullName', label: 'Name', accessor: (user) => user.fullName },
    { key: 'email', label: 'Email', accessor: (user) => user.email },
    {
      key: 'role',
      label: 'Role',
      accessor: (user) => user.role,
      filterOptions: [
        { value: 'owner', label: 'Owner' },
        { value: 'warden', label: 'Warden' },
        { value: 'manager', label: 'Manager' },
        { value: 'accountant', label: 'Accountant' }
      ],
      render: (user) => <Badge tone={roleTone(user.role)}>{user.role}</Badge>
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <input
          className="border border-black/10 rounded-lg px-3 py-2 text-sm w-80"
          placeholder="Search by email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="btn btn-primary" onClick={search}>
          Search
        </button>
      </div>

      <SortableTable
        columns={columns}
        data={results}
        rowKey={(user) => user._id}
        searchPlaceholder="Filter results by name, email, or role..."
        emptyIcon={<UserIcon width={22} height={22} />}
        emptyTitle="Search to view users"
        emptyDescription="Look up a registered user by their email address."
      />
    </div>
  );
};

export default Users;
