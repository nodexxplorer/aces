import { useState, useEffect } from 'react';
import Card, { CardHeader, CardTitle, CardDescription } from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { useNotification } from '../../hooks/useNotification';
import {
  Layers, Plus, Loader2, Trash2, GripVertical, Edit2, Eye, EyeOff,
} from 'lucide-react';
import {
  listSubcategories,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
  reorderSubcategories,
  SUBCATEGORY_MODULES,
  type SubcategoryItem,
} from '../../api/subcategories';

const MODULE_COLORS: Record<string, string> = {
  courses: 'bg-blue-500',
  dues: 'bg-emerald-500',
  skills: 'bg-amber-500',
  events: 'bg-purple-500',
  announcements: 'bg-rose-500',
  jobs: 'bg-cyan-500',
  groups: 'bg-indigo-500',
};

const SubcategoryManagementPage = () => {
  const { success } = useNotification();
  const [activeModule, setActiveModule] = useState('courses');
  const [items, setItems] = useState<SubcategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editItem, setEditItem] = useState<SubcategoryItem | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editColor, setEditColor] = useState('#6366f1');

  useEffect(() => {
    fetchItems();
  }, [activeModule]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const data = await listSubcategories(activeModule);
      setItems(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setSubmitting(true);
      await createSubcategory({
        module: activeModule,
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        sort_order: items.length,
      });
      setCreateOpen(false);
      setName('');
      setDescription('');
      setColor('#6366f1');
      success('Created', `"${name}" has been added`);
      fetchItems();
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem || !editName.trim()) return;
    try {
      setSubmitting(true);
      await updateSubcategory(editItem.id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        color: editColor,
      });
      setEditOpen(false);
      setEditItem(null);
      success('Updated', 'Subcategory updated');
      fetchItems();
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, itemName: string) => {
    if (!confirm(`Delete "${itemName}"? This cannot be undone.`)) return;
    try {
      await deleteSubcategory(id);
      setItems((prev) => prev.filter((s) => s.id !== id));
      success('Deleted', `"${itemName}" removed`);
    } catch {
      // silent
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await updateSubcategory(id, { is_active: !currentActive });
      setItems((prev) =>
        prev.map((s) => (s.id === id ? { ...s, is_active: !currentActive } : s))
      );
    } catch {
      // silent
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const newItems = [...items];
    [newItems[index - 1], newItems[index]] = [newItems[index], newItems[index - 1]];
    setItems(newItems);
    try {
      await reorderSubcategories(activeModule, newItems.map((i) => i.id));
    } catch {
      fetchItems();
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === items.length - 1) return;
    const newItems = [...items];
    [newItems[index], newItems[index + 1]] = [newItems[index + 1], newItems[index]];
    setItems(newItems);
    try {
      await reorderSubcategories(activeModule, newItems.map((i) => i.id));
    } catch {
      fetchItems();
    }
  };

  const openEdit = (item: SubcategoryItem) => {
    setEditItem(item);
    setEditName(item.name);
    setEditDescription(item.description || '');
    setEditColor(item.color || '#6366f1');
    setEditOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">Subcategory Management</h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Organize and classify items across all modules.
          </p>
        </div>
        <Button leftIcon={<Plus className="w-4 h-4" />} onClick={() => setCreateOpen(true)}>
          Add Subcategory
        </Button>
      </div>

      {/* Module Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {SUBCATEGORY_MODULES.map((m) => (
          <button
            key={m.value}
            onClick={() => setActiveModule(m.value)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${
              activeModule === m.value
                ? 'bg-primary-500 text-white shadow-sm'
                : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary-500" />
            {SUBCATEGORY_MODULES.find((m) => m.value === activeModule)?.label} Subcategories
          </CardTitle>
          <CardDescription>
            {items.length} subcategor{items.length !== 1 ? 'ies' : 'y'} &middot; Drag to reorder
          </CardDescription>
        </CardHeader>
        <div className="p-4 pt-0">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
              <span className="ml-2 text-sm text-surface-500">Loading...</span>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <Layers className="w-12 h-12 mx-auto text-surface-300 dark:text-surface-600 mb-3" />
              <p className="text-sm text-surface-500">No subcategories yet</p>
              <p className="text-xs text-surface-400 mt-1">Create one to get started</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                    item.is_active
                      ? 'border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900'
                      : 'border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800/50 opacity-60'
                  }`}
                >
                  {/* Drag Handle & Arrows */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="text-surface-400 hover:text-surface-600 disabled:opacity-30"
                    >
                      <GripVertical className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === items.length - 1}
                      className="text-surface-400 hover:text-surface-600 disabled:opacity-30"
                    >
                      <GripVertical className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Color Indicator */}
                  <div
                    className="w-3 h-10 rounded-full shrink-0"
                    style={{ backgroundColor: item.color || '#6366f1' }}
                  />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">{item.name}</p>
                    {item.description && (
                      <p className="text-[10px] text-surface-500 truncate">{item.description}</p>
                    )}
                  </div>

                  {/* Status */}
                  <span className={`text-[10px] px-2 py-1 rounded-full ${
                    item.is_active
                      ? 'bg-success-100 text-success-700'
                      : 'bg-surface-100 text-surface-500'
                  }`}>
                    {item.is_active ? 'Active' : 'Inactive'}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleToggleActive(item.id, item.is_active)}
                      className="p-1.5 rounded hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-500"
                      title={item.is_active ? 'Deactivate' : 'Activate'}
                    >
                      {item.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => openEdit(item)}
                      className="p-1.5 rounded hover:bg-surface-100 dark:hover:bg-surface-800 text-surface-500"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, item.name)}
                      className="p-1.5 rounded hover:bg-danger-50 text-danger-500"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Create Modal */}
      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title={`Add ${SUBCATEGORY_MODULES.find((m) => m.value === activeModule)?.label} Subcategory`}>
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Name" placeholder="e.g. Core Engineering" value={name} onChange={(e) => setName(e.target.value)} required />
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Description</label>
            <textarea
              className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 h-20"
              placeholder="Brief description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Color</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-10 h-10 rounded border border-surface-300 cursor-pointer"
              />
              <Input value={color} onChange={(e) => setColor(e.target.value)} className="flex-1" />
            </div>
          </div>
          <Button type="submit" className="w-full" isLoading={submitting}>
            Create
          </Button>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={editOpen} onClose={() => { setEditOpen(false); setEditItem(null); }} title="Edit Subcategory">
        <form onSubmit={handleEdit} className="space-y-4">
          <Input label="Name" value={editName} onChange={(e) => setEditName(e.target.value)} required />
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Description</label>
            <textarea
              className="w-full mt-1 px-3 py-2 text-sm bg-white dark:bg-surface-900 border border-surface-300 dark:border-surface-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/20 h-20"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-surface-700 dark:text-surface-300">Color</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="color"
                value={editColor}
                onChange={(e) => setEditColor(e.target.value)}
                className="w-10 h-10 rounded border border-surface-300 cursor-pointer"
              />
              <Input value={editColor} onChange={(e) => setEditColor(e.target.value)} className="flex-1" />
            </div>
          </div>
          <Button type="submit" className="w-full" isLoading={submitting}>
            Save Changes
          </Button>
        </form>
      </Modal>
    </div>
  );
};

export default SubcategoryManagementPage;
