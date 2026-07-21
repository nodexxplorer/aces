import { useState, useEffect, useRef, useCallback } from 'react';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useNotification } from '../../hooks/useNotification';
import { useAuth } from '../../hooks/useAuth';
import { getConnectionSuggestions, searchPeople } from '../../api/campus-connect-v2';
import { sendConnectionRequest } from '../../api/campus-connect';
import { Search, UserPlus, Loader2, Users, MapPin, Star } from 'lucide-react';
import type { ConnectionSuggestion, SearchResult } from '../../api/campus-connect-v2';

const gradients = [
  'from-primary-500 to-primary-700',
  'from-violet-500 to-violet-700',
  'from-emerald-500 to-emerald-700',
  'from-amber-500 to-amber-700',
  'from-rose-500 to-rose-700',
  'from-cyan-500 to-cyan-700',
  'from-fuchsia-500 to-fuchsia-700',
  'from-teal-500 to-teal-700',
];

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

const truncateBio = (bio: string, max = 100) =>
  bio && bio.length > max ? bio.slice(0, max).trimEnd() + '...' : bio;

type Person = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  bio: string;
  skills: string[];
  mutual_connections?: number;
};

const PeopleDiscoveryPage = () => {
  const { user } = useAuth();
  const { success, error } = useNotification();
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Person[]>([]);
  const [searchResults, setSearchResults] = useState<Person[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSearchingApi, setIsSearchingApi] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const data = await getConnectionSuggestions();
        setSuggestions(
          data.map((s) => ({
            id: s.id,
            full_name: s.full_name,
            avatar_url: s.avatar_url,
            role: s.role,
            bio: s.bio,
            skills: s.skills,
            mutual_connections: s.mutual_connections,
          }))
        );
      } catch {
        error('Failed to load', 'Could not fetch connection suggestions.');
      } finally {
        setLoadingSuggestions(false);
      }
    };
    fetchSuggestions();
  }, [error]);

  const doSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setIsSearching(false);
        setSearchResults([]);
        return;
      }
      setIsSearchingApi(true);
      try {
        const data = await searchPeople(query.trim());
        setSearchResults(
          data.map((r) => ({
            id: r.id,
            full_name: r.full_name,
            avatar_url: r.avatar_url,
            role: r.role,
            bio: r.bio,
            skills: r.skills,
          }))
        );
        setIsSearching(true);
      } catch {
        error('Search Failed', 'Could not search for people.');
      } finally {
        setIsSearchingApi(false);
      }
    },
    [error]
  );

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 400);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    doSearch(searchQuery);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setIsSearching(false);
    setSearchResults([]);
  };

  const handleConnect = async (person: Person) => {
    setSendingId(person.id);
    try {
      await sendConnectionRequest(person.id);
      success('Connection Request Sent', `Request sent to ${person.full_name}.`);
      setSuggestions((prev) => prev.filter((s) => s.id !== person.id));
      setSearchResults((prev) => prev.filter((r) => r.id !== person.id));
    } catch {
      error('Request Failed', 'Could not send connection request.');
    } finally {
      setSendingId(null);
    }
  };

  const people = isSearching ? searchResults : suggestions;

  const renderPersonCard = (person: Person, idx: number) => {
    const gradient = gradients[idx % gradients.length];
    const initials = getInitials(person.full_name);

    return (
      <Card key={person.id} className="p-5 flex flex-col h-full">
        <div className="flex items-center gap-4 mb-3">
          <div
            className={`w-14 h-14 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-bold text-lg shrink-0`}
          >
            {person.avatar_url ? (
              <img
                src={person.avatar_url}
                alt={person.full_name}
                className="w-14 h-14 rounded-full object-cover"
              />
            ) : (
              initials
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-surface-900 dark:text-white truncate">
              {person.full_name}
            </h3>
            <p className="text-xs text-surface-500 dark:text-surface-400 truncate">{person.role}</p>
            {person.mutual_connections !== undefined && (
              <p className="flex items-center gap-1 text-xs text-surface-400 mt-0.5">
                <Users className="w-3 h-3" />
                {person.mutual_connections} mutual connection{person.mutual_connections !== 1 ? 's' : ''}
              </p>
            )}
          </div>
        </div>

        {person.bio && (
          <p className="text-xs text-surface-500 dark:text-surface-400 mb-3 line-clamp-2">
            {truncateBio(person.bio, 120)}
          </p>
        )}

        {person.skills && person.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {person.skills.slice(0, 4).map((skill) => (
              <span
                key={skill}
                className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-800"
              >
                {skill}
              </span>
            ))}
            {person.skills.length > 4 && (
              <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-surface-100 dark:bg-surface-800 text-surface-500">
                +{person.skills.length - 4}
              </span>
            )}
          </div>
        )}

        <div className="mt-auto pt-2">
          <Button
            variant="primary"
            size="sm"
            className="w-full justify-center"
            leftIcon={
              sendingId === person.id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )
            }
            onClick={() => handleConnect(person)}
            disabled={sendingId === person.id || person.id === user?.id}
          >
            Connect
          </Button>
        </div>
      </Card>
    );
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Discover People</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Find classmates, collaborators, and study partners.
        </p>
      </div>

      <form onSubmit={handleSearchSubmit} className="max-w-2xl">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            placeholder="Search by name, skill, or role..."
            className="w-full pl-11 pr-10 py-2.5 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 dark:focus:border-primary-500 transition-colors"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 text-xs"
            >
              Clear
            </button>
          )}
        </div>
      </form>

      {isSearching && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-surface-500 dark:text-surface-400">
            {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} for "{searchQuery}"
          </p>
          <Button variant="ghost" size="xs" onClick={handleClearSearch}>
            Back to suggestions
          </Button>
        </div>
      )}

      {isSearchingApi || loadingSuggestions ? (
        <div className="flex items-center justify-center p-16 text-surface-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          {isSearchingApi ? 'Searching...' : 'Loading suggestions...'}
        </div>
      ) : people.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 text-center">
          <div className="w-16 h-16 rounded-full bg-surface-100 dark:bg-surface-800 flex items-center justify-center mb-4">
            <Star className="w-7 h-7 text-surface-300 dark:text-surface-600" />
          </div>
          <h3 className="font-medium text-surface-700 dark:text-surface-300 mb-1">
            {isSearching ? 'No results found' : 'No suggestions yet'}
          </h3>
          <p className="text-sm text-surface-400 max-w-sm">
            {isSearching
              ? 'Try a different search term or check the spelling.'
              : 'Check back later for new connection suggestions.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {people.map((person, idx) => renderPersonCard(person, idx))}
        </div>
      )}
    </div>
  );
};

export default PeopleDiscoveryPage;
