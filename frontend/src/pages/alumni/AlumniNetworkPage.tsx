import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Badge from '../../components/ui/Badge';
import { Search, MapPin, Briefcase, GraduationCap, ExternalLink, Filter } from 'lucide-react';
import { searchAlumniDirectory } from '../../api/alumni';
import type { AlumniDirectoryItem } from '../../types';

const AlumniNetworkPage = () => {
  const [alumni, setAlumni] = useState<AlumniDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [yearFrom, setYearFrom] = useState('');
  const [yearTo, setYearTo] = useState('');
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [mentorOnly, setMentorOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchAlumni();
  }, []);

  const fetchAlumni = async () => {
    setLoading(true);
    try {
      const data = await searchAlumniDirectory({
        search: search || undefined,
        year_from: yearFrom ? parseInt(yearFrom) : undefined,
        year_to: yearTo ? parseInt(yearTo) : undefined,
        industry: industry || undefined,
        location: location || undefined,
        mentor_only: mentorOnly || undefined,
      });
      setAlumni(Array.isArray(data) ? data : []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => fetchAlumni();

  const clearFilters = () => {
    setSearch('');
    setYearFrom('');
    setYearTo('');
    setIndustry('');
    setLocation('');
    setMentorOnly(false);
    setTimeout(fetchAlumni, 0);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Alumni Directory</h1>
        <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
          Connect with department graduates across the globe.
        </p>
      </div>

      <div className="flex gap-3 max-w-2xl">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
          <input
            type="text"
            placeholder="Search by name, company, or industry..."
            className="w-full pl-10 pr-4 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <Button onClick={handleSearch}>Search</Button>
        <Button variant="outline" leftIcon={<Filter className="w-4 h-4" />} onClick={() => setShowFilters(!showFilters)}>
          Filters
        </Button>
      </div>

      {showFilters && (
        <Card className="max-w-2xl">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
            <div>
              <label className="text-xs font-medium text-surface-500">Year From</label>
              <input type="number" placeholder="2020" className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg" value={yearFrom} onChange={(e) => setYearFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-surface-500">Year To</label>
              <input type="number" placeholder="2026" className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg" value={yearTo} onChange={(e) => setYearTo(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-surface-500">Industry</label>
              <input type="text" placeholder="e.g. Tech" className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg" value={industry} onChange={(e) => setIndustry(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-surface-500">Location</label>
              <input type="text" placeholder="e.g. Lagos" className="w-full mt-1 px-3 py-1.5 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg" value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between px-4 pb-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={mentorOnly} onChange={(e) => setMentorOnly(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
              Mentors only
            </label>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={clearFilters}>Clear</Button>
              <Button size="sm" onClick={fetchAlumni}>Apply</Button>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <Card><div className="p-12 text-center text-sm text-surface-500">Loading alumni directory...</div></Card>
      ) : alumni.length === 0 ? (
        <Card><div className="p-12 text-center text-sm text-surface-400">No alumni found matching your criteria</div></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {alumni.map((a) => (
            <Card key={a.id} hover className="p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center text-primary-500 shrink-0 text-lg font-bold">
                  {(a.full_name || 'A')[0]}
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-surface-900 dark:text-white truncate">{a.full_name}</h4>
                  <p className="text-xs text-surface-500">Class of {a.graduation_year}</p>
                </div>
              </div>
              {a.current_position && a.current_company && (
                <p className="text-sm text-surface-600 dark:text-surface-400 flex items-center gap-1 mb-1">
                  <Briefcase className="w-3.5 h-3.5 shrink-0" />
                  {a.current_position} @ {a.current_company}
                </p>
              )}
              {a.location && (
                <p className="text-xs text-surface-500 flex items-center gap-1 mb-2">
                  <MapPin className="w-3.5 h-3.5 shrink-0" /> {a.location}
                </p>
              )}
              {a.bio && (
                <p className="text-xs text-surface-500 line-clamp-2 mb-3">{a.bio}</p>
              )}
              <div className="flex items-center gap-2">
                {a.is_mentor_available && (
                  <Badge variant="success" dot>Mentor</Badge>
                )}
                {a.industry && (
                  <Badge variant="outline">{a.industry}</Badge>
                )}
              </div>
              <div className="flex gap-2 mt-3">
                {a.linkedin_url && (
                  <a href={a.linkedin_url} target="_blank" rel="noopener noreferrer">
                    <Button size="xs" variant="outline" leftIcon={<ExternalLink className="w-3 h-3" />}>LinkedIn</Button>
                  </a>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AlumniNetworkPage;
