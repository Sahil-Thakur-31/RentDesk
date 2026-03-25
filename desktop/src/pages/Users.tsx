import { useState } from 'react';
import api from '../lib/api';

const Users = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);

  const search = async () => {
    const response = await api.get(`/users?email=${encodeURIComponent(query)}`);
    setResults(response.data);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <input
          className="border border-black/10 rounded-lg px-3 py-2 text-sm w-80"
          placeholder="Search by email"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="bg-[var(--accent)] text-white px-4 py-2 rounded-lg text-sm" onClick={search}>
          Search
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 shadow-sm">
        <table className="w-full text-sm">
          <thead className="text-left border-b border-black/5">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
            </tr>
          </thead>
          <tbody>
            {results.map((user) => (
              <tr key={user._id} className="border-b border-black/5">
                <td className="px-4 py-3">{user.fullName}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3">{user.role}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!results.length && <div className="px-4 py-6 text-[var(--muted)]">Search to view users.</div>}
      </div>
    </div>
  );
};

export default Users;
