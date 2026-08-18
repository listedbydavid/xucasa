import { useState, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { AgentContact, ContactTag } from "@shared/schema";
import {
  Plus, Search, Upload, Phone, Tag, X, Edit3, Trash2, Mail, User,
  MapPin, FileText, ChevronDown, Users, Filter, ArrowUpDown
} from "lucide-react";
import { ImportContactsModal } from "./ImportContactsModal";

type ContactWithTags = AgentContact & { tags: ContactTag[] };

const TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  blue:   { bg: "bg-blue-100",   text: "text-blue-800",   border: "border-blue-200" },
  green:  { bg: "bg-green-100",  text: "text-green-800",  border: "border-green-200" },
  red:    { bg: "bg-red-100",    text: "text-red-800",    border: "border-red-200" },
  yellow: { bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-200" },
  purple: { bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-200" },
  orange: { bg: "bg-orange-100", text: "text-orange-800", border: "border-orange-200" },
  pink:   { bg: "bg-pink-100",   text: "text-pink-800",   border: "border-pink-200" },
  gray:   { bg: "bg-gray-100",   text: "text-gray-800",   border: "border-gray-200" },
};

function tagStyle(color: string) {
  return TAG_COLORS[color] || TAG_COLORS.blue;
}

export function AgentContactsSection() {
  const { data: contacts = [], isLoading } = useQuery<ContactWithTags[]>({ queryKey: ["/api/agent/contacts"] });
  const { data: tags = [] } = useQuery<ContactTag[]>({ queryKey: ["/api/agent/tags"] });
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTagId, setFilterTagId] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactWithTags | null>(null);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);

  const filtered = useMemo(() => {
    let result = contacts;
    if (filterTagId) {
      result = result.filter(c => c.tags.some(t => t.id === filterTagId));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        `${c.firstName} ${c.lastName || ""}`.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q))
      );
    }
    return result;
  }, [contacts, filterTagId, searchQuery]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-foreground">Contacts CRM</h2>
          <p className="text-sm text-muted-foreground">Manage your contacts, import from CSV or phone, and organize with tags.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowTagManager(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors"
            data-testid="button-manage-tags"
          >
            <Tag className="w-4 h-4" /> Tags
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors"
            data-testid="button-import-contacts"
          >
            <Upload className="w-4 h-4" /> Import Contacts
          </button>
          <button
            onClick={() => { setEditingContact(null); setShowAddModal(true); }}
            className="flex items-center gap-1.5 bg-foreground text-background px-5 py-2 rounded-xl text-sm font-bold hover:bg-primary hover:text-white transition-all shadow-sm active:scale-95"
            data-testid="button-add-contact"
          >
            <Plus className="w-4 h-4" /> Add Contact
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
            data-testid="input-search-contacts"
          />
        </div>
        <div className="relative">
          <select
            value={filterTagId || ""}
            onChange={e => setFilterTagId(e.target.value ? Number(e.target.value) : null)}
            className="appearance-none pl-9 pr-8 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none cursor-pointer"
            data-testid="select-filter-tag"
          >
            <option value="">All Tags</option>
            {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        {filtered.length} contact{filtered.length !== 1 ? "s" : ""}
        {filterTagId && ` filtered by tag`}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted animate-pulse rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-3xl">
          <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
            <Users className="w-7 h-7 text-muted-foreground opacity-40" />
          </div>
          <h3 className="font-display font-bold text-xl mb-2">
            {contacts.length === 0 ? "No contacts yet" : "No matching contacts"}
          </h3>
          <p className="text-muted-foreground text-sm max-w-sm mx-auto mb-4">
            {contacts.length === 0
              ? "Add contacts manually, import from CSV, or sync your phone contacts."
              : "Try adjusting your search or tag filter."}
          </p>
          {contacts.length === 0 && (
            <button
              onClick={() => setShowAddModal(true)}
              className="text-primary font-bold hover:underline"
              data-testid="button-add-first-contact"
            >
              Add your first contact
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="p-4 font-bold text-muted-foreground text-xs uppercase tracking-wider">Name</th>
                  <th className="p-4 font-bold text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Email</th>
                  <th className="p-4 font-bold text-muted-foreground text-xs uppercase tracking-wider hidden md:table-cell">Phone</th>
                  <th className="p-4 font-bold text-muted-foreground text-xs uppercase tracking-wider">Tags</th>
                  <th className="p-4 font-bold text-muted-foreground text-xs uppercase tracking-wider hidden lg:table-cell">Source</th>
                  <th className="p-4 font-bold text-muted-foreground text-xs uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(contact => (
                  <tr key={contact.id} className="hover:bg-muted/20 transition-colors" data-testid={`row-contact-${contact.id}`}>
                    <td className="p-4">
                      <div className="font-bold text-foreground">{contact.firstName} {contact.lastName || ""}</div>
                      <div className="md:hidden text-xs text-muted-foreground mt-0.5">{contact.email || contact.phone || ""}</div>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground hidden md:table-cell">{contact.email || "—"}</td>
                    <td className="p-4 text-sm text-muted-foreground hidden md:table-cell">{contact.phone || "—"}</td>
                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {contact.tags.map(tag => {
                          const s = tagStyle(tag.color);
                          return (
                            <span key={tag.id} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
                              {tag.name}
                            </span>
                          );
                        })}
                      </div>
                    </td>
                    <td className="p-4 text-xs text-muted-foreground hidden lg:table-cell capitalize">{contact.source.replace("_", " ")}</td>
                    <td className="p-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => { setEditingContact(contact); setShowAddModal(true); }}
                        className="p-2 text-muted-foreground hover:text-primary transition-colors"
                        data-testid={`button-edit-contact-${contact.id}`}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <DeleteContactButton contactId={contact.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAddModal && (
        <ContactModal
          contact={editingContact}
          tags={tags}
          onClose={() => { setShowAddModal(false); setEditingContact(null); }}
        />
      )}

      {showCsvImport && (
        <CsvImportWizard
          tags={tags}
          onClose={() => setShowCsvImport(false)}
        />
      )}

      <ImportContactsModal
        isOpen={showImport}
        onClose={() => setShowImport(false)}
      />

      {showTagManager && (
        <TagManager
          tags={tags}
          onClose={() => setShowTagManager(false)}
        />
      )}
    </div>
  );
}

function DeleteContactButton({ contactId }: { contactId: number }) {
  const { toast } = useToast();
  const deleteMutation = useMutation({
    mutationFn: async () => { await apiRequest("DELETE", `/api/agent/contacts/${contactId}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/contacts"] });
      toast({ title: "Contact deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <button
      onClick={() => { if (confirm("Delete this contact?")) deleteMutation.mutate(); }}
      className="p-2 text-muted-foreground hover:text-destructive transition-colors"
      data-testid={`button-delete-contact-${contactId}`}
    >
      <Trash2 className="w-4 h-4" />
    </button>
  );
}

function ContactModal({
  contact,
  tags,
  onClose,
}: {
  contact: ContactWithTags | null;
  tags: ContactTag[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const isEdit = !!contact;
  const [form, setForm] = useState({
    firstName: contact?.firstName || "",
    lastName: contact?.lastName || "",
    email: contact?.email || "",
    phone: contact?.phone || "",
    mailingAddress: contact?.mailingAddress || "",
    notes: contact?.notes || "",
  });
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>(contact?.tags.map(t => t.id) || []);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/agent/contacts", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/contacts"] });
      toast({ title: "Contact added" });
      onClose();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PUT", `/api/agent/contacts/${contact!.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/contacts"] });
      toast({ title: "Contact updated" });
      onClose();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const tagAssignMutation = useMutation({
    mutationFn: async ({ contactId, tagId }: { contactId: number; tagId: number }) => {
      await apiRequest("POST", `/api/agent/contacts/${contactId}/tags`, { tagId });
    },
  });

  const tagRemoveMutation = useMutation({
    mutationFn: async ({ contactId, tagId }: { contactId: number; tagId: number }) => {
      await apiRequest("DELETE", `/api/agent/contacts/${contactId}/tags/${tagId}`);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.firstName.trim()) {
      toast({ title: "First name is required", variant: "destructive" });
      return;
    }

    if (isEdit) {
      await updateMutation.mutateAsync(form);
      const existingTagIds = contact!.tags.map(t => t.id);
      const toAdd = selectedTagIds.filter(id => !existingTagIds.includes(id));
      const toRemove = existingTagIds.filter(id => !selectedTagIds.includes(id));
      for (const tagId of toAdd) {
        await tagAssignMutation.mutateAsync({ contactId: contact!.id, tagId });
      }
      for (const tagId of toRemove) {
        await tagRemoveMutation.mutateAsync({ contactId: contact!.id, tagId });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/agent/contacts"] });
    } else {
      createMutation.mutate({ ...form, tagIds: selectedTagIds });
    }
  };

  const toggleTag = (tagId: number) => {
    setSelectedTagIds(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h3 className="text-lg font-display font-bold">{isEdit ? "Edit Contact" : "Add Contact"}</h3>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground" data-testid="button-close-modal">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1.5">First Name *</label>
              <input
                type="text"
                value={form.firstName}
                onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                data-testid="input-contact-first-name"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">Last Name</label>
              <input
                type="text"
                value={form.lastName}
                onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                data-testid="input-contact-last-name"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              data-testid="input-contact-email"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              data-testid="input-contact-phone"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">Mailing Address</label>
            <input
              type="text"
              value={form.mailingAddress}
              onChange={e => setForm(f => ({ ...f, mailingAddress: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              data-testid="input-contact-address"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none resize-none"
              data-testid="input-contact-notes"
            />
          </div>
          {tags.length > 0 && (
            <div>
              <label className="block text-sm font-semibold mb-2">Tags</label>
              <div className="flex flex-wrap gap-2">
                {tags.map(tag => {
                  const selected = selectedTagIds.includes(tag.id);
                  const s = tagStyle(tag.color);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                        selected
                          ? `${s.bg} ${s.text} ${s.border} ring-2 ring-offset-1 ring-primary/30`
                          : `bg-muted text-muted-foreground border-border hover:${s.bg}`
                      }`}
                      data-testid={`button-toggle-tag-${tag.id}`}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors"
              data-testid="button-cancel-contact"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2.5 rounded-xl bg-foreground text-background text-sm font-bold hover:bg-primary hover:text-white transition-all disabled:opacity-50"
              data-testid="button-save-contact"
            >
              {isPending ? "Saving..." : isEdit ? "Update Contact" : "Add Contact"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TagManager({ tags, onClose }: { tags: ContactTag[]; onClose: () => void }) {
  const { toast } = useToast();
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("blue");
  const [editingTag, setEditingTag] = useState<{ id: number; name: string; color: string } | null>(null);

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; color: string }) => {
      const res = await apiRequest("POST", "/api/agent/tags", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/tags"] });
      setNewName("");
      toast({ title: "Tag created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; name: string; color: string }) => {
      const res = await apiRequest("PUT", `/api/agent/tags/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/tags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/contacts"] });
      setEditingTag(null);
      toast({ title: "Tag updated" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/agent/tags/${id}`); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/tags"] });
      queryClient.invalidateQueries({ queryKey: ["/api/agent/contacts"] });
      toast({ title: "Tag deleted" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const colorOptions = Object.keys(TAG_COLORS);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h3 className="text-lg font-display font-bold">Manage Tags</h3>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground" data-testid="button-close-tags">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="New tag name..."
              className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              data-testid="input-new-tag-name"
            />
            <select
              value={newColor}
              onChange={e => setNewColor(e.target.value)}
              className="px-3 py-2 rounded-xl border border-border bg-background text-sm cursor-pointer"
              data-testid="select-new-tag-color"
            >
              {colorOptions.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button
              onClick={() => newName.trim() && createMutation.mutate({ name: newName.trim(), color: newColor })}
              disabled={!newName.trim() || createMutation.isPending}
              className="px-4 py-2 rounded-xl bg-foreground text-background text-sm font-bold hover:bg-primary hover:text-white transition-all disabled:opacity-50"
              data-testid="button-create-tag"
            >
              Add
            </button>
          </div>

          {tags.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">No tags yet. Create one above.</p>
          ) : (
            <div className="space-y-2">
              {tags.map(tag => {
                const s = tagStyle(tag.color);
                const isEditing = editingTag?.id === tag.id;
                return (
                  <div key={tag.id} className="flex items-center justify-between p-3 rounded-xl border border-border hover:bg-muted/30 transition-colors">
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editingTag.name}
                          onChange={e => setEditingTag({ ...editingTag, name: e.target.value })}
                          className="flex-1 px-2 py-1 rounded-lg border border-border text-sm"
                          data-testid={`input-edit-tag-${tag.id}`}
                        />
                        <select
                          value={editingTag.color}
                          onChange={e => setEditingTag({ ...editingTag, color: e.target.value })}
                          className="px-2 py-1 rounded-lg border border-border text-sm"
                        >
                          {colorOptions.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button
                          onClick={() => updateMutation.mutate(editingTag)}
                          className="text-primary text-sm font-bold"
                          data-testid={`button-save-tag-${tag.id}`}
                        >
                          Save
                        </button>
                        <button onClick={() => setEditingTag(null)} className="text-muted-foreground text-sm">Cancel</button>
                      </div>
                    ) : (
                      <>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
                          {tag.name}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingTag({ id: tag.id, name: tag.name, color: tag.color })}
                            className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                            data-testid={`button-edit-tag-${tag.id}`}
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => { if (confirm(`Delete tag "${tag.name}"?`)) deleteMutation.mutate(tag.id); }}
                            className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                            data-testid={`button-delete-tag-${tag.id}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const CSV_FIELD_OPTIONS = [
  { value: "", label: "Skip this column" },
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "mailingAddress", label: "Mailing Address" },
  { value: "notes", label: "Notes" },
];

function guessFieldMapping(header: string): string {
  const h = header.toLowerCase().replace(/[^a-z]/g, "");
  if (h.includes("firstname") || h === "first") return "firstName";
  if (h.includes("lastname") || h === "last") return "lastName";
  if (h.includes("email") || h.includes("mail")) return "email";
  if (h.includes("phone") || h.includes("mobile") || h.includes("cell") || h.includes("tel")) return "phone";
  if (h.includes("address") || h.includes("street") || h.includes("mailing")) return "mailingAddress";
  if (h.includes("note") || h.includes("comment")) return "notes";
  if (h === "name" || h === "fullname") return "firstName";
  return "";
}

function CsvImportWizard({ tags, onClose }: { tags: ContactTag[]; onClose: () => void }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "map" | "tags" | "confirm">("upload");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [fieldMapping, setFieldMapping] = useState<Record<number, string>>({});
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const importMutation = useMutation({
    mutationFn: async (data: { contacts: any[]; tagIds: number[] }) => {
      const res = await apiRequest("POST", "/api/agent/contacts/import-csv", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/contacts"] });
      toast({ title: `${data.imported} contacts imported` });
      onClose();
    },
    onError: (err: any) => toast({ title: "Import failed", description: err.message, variant: "destructive" }),
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter(line => line.trim());
      if (lines.length < 2) {
        toast({ title: "CSV must have a header row and at least one data row", variant: "destructive" });
        return;
      }
      const headers = parseCsvLine(lines[0]);
      const rows = lines.slice(1).map(parseCsvLine);
      setCsvHeaders(headers);
      setCsvRows(rows);

      const mapping: Record<number, string> = {};
      headers.forEach((h, i) => { mapping[i] = guessFieldMapping(h); });
      setFieldMapping(mapping);
      setStep("map");
    };
    reader.readAsText(file);
  };

  const mappedContacts = useMemo(() => {
    return csvRows.map(row => {
      const contact: Record<string, string> = {};
      Object.entries(fieldMapping).forEach(([colIdx, field]) => {
        if (field && row[Number(colIdx)]) {
          if (field === "firstName" && contact.firstName) {
            const parts = row[Number(colIdx)].trim().split(/\s+/);
            contact.firstName = parts[0];
            if (parts.length > 1 && !contact.lastName) {
              contact.lastName = parts.slice(1).join(" ");
            }
          } else {
            contact[field] = row[Number(colIdx)].trim();
          }
        }
      });
      return contact;
    }).filter(c => c.firstName);
  }, [csvRows, fieldMapping]);

  const handleImport = () => {
    if (mappedContacts.length === 0) {
      toast({ title: "No valid contacts to import", variant: "destructive" });
      return;
    }
    importMutation.mutate({ contacts: mappedContacts, tagIds: selectedTagIds });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h3 className="text-lg font-display font-bold">Import Contacts from CSV</h3>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground" data-testid="button-close-csv-import">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="flex items-center gap-2 mb-6">
            {(["upload", "map", "tags", "confirm"] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <div className={`h-0.5 w-6 ${step === s || (["map", "tags", "confirm"].indexOf(step) >= i) ? "bg-primary" : "bg-border"}`} />}
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === s ? "bg-primary text-white" :
                  (["upload", "map", "tags", "confirm"].indexOf(step) > i) ? "bg-primary/20 text-primary" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {i + 1}
                </div>
                <span className={`text-xs font-semibold hidden sm:inline ${step === s ? "text-foreground" : "text-muted-foreground"}`}>
                  {s === "upload" ? "Upload" : s === "map" ? "Map Fields" : s === "tags" ? "Tags" : "Confirm"}
                </span>
              </div>
            ))}
          </div>

          {step === "upload" && (
            <div className="text-center py-12">
              <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-30" />
              <p className="text-muted-foreground text-sm mb-6">Upload a CSV file with your contacts. The first row should contain column headers.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                data-testid="input-csv-file"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-6 py-3 rounded-xl bg-foreground text-background font-bold hover:bg-primary hover:text-white transition-all"
                data-testid="button-choose-csv"
              >
                Choose CSV File
              </button>
            </div>
          )}

          {step === "map" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Map your CSV columns to contact fields. We've made our best guess — adjust as needed.</p>
              <div className="space-y-3">
                {csvHeaders.map((header, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="w-1/3 text-sm font-semibold truncate" title={header}>{header}</div>
                    <span className="text-muted-foreground">→</span>
                    <select
                      value={fieldMapping[idx] || ""}
                      onChange={e => setFieldMapping(prev => ({ ...prev, [idx]: e.target.value }))}
                      className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm cursor-pointer"
                      data-testid={`select-map-field-${idx}`}
                    >
                      {CSV_FIELD_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {csvRows.length > 0 && (
                <div className="bg-muted/30 rounded-xl p-3 mt-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Preview (first row):</p>
                  <div className="text-sm space-y-1">
                    {csvHeaders.map((h, i) => fieldMapping[i] && (
                      <div key={i} className="flex gap-2">
                        <span className="text-muted-foreground">{CSV_FIELD_OPTIONS.find(o => o.value === fieldMapping[i])?.label}:</span>
                        <span className="font-medium">{csvRows[0]?.[i] || "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setStep("upload")} className="px-5 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted">Back</button>
                <button
                  onClick={() => setStep("tags")}
                  className="px-5 py-2.5 rounded-xl bg-foreground text-background text-sm font-bold hover:bg-primary hover:text-white transition-all"
                  data-testid="button-next-to-tags"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {step === "tags" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Optionally assign tags to all imported contacts.</p>
              {tags.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4">No tags created yet. You can skip this step and tag contacts later.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => {
                    const selected = selectedTagIds.includes(tag.id);
                    const s = tagStyle(tag.color);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => setSelectedTagIds(prev => selected ? prev.filter(id => id !== tag.id) : [...prev, tag.id])}
                        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                          selected ? `${s.bg} ${s.text} ${s.border} ring-2 ring-offset-1 ring-primary/30` : `bg-muted text-muted-foreground border-border`
                        }`}
                        data-testid={`button-import-tag-${tag.id}`}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setStep("map")} className="px-5 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted">Back</button>
                <button
                  onClick={() => setStep("confirm")}
                  className="px-5 py-2.5 rounded-xl bg-foreground text-background text-sm font-bold hover:bg-primary hover:text-white transition-all"
                  data-testid="button-next-to-confirm"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {step === "confirm" && (
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total rows in CSV:</span>
                  <span className="font-bold">{csvRows.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Valid contacts to import:</span>
                  <span className="font-bold text-green-600">{mappedContacts.length}</span>
                </div>
                {csvRows.length - mappedContacts.length > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Skipped (missing first name):</span>
                    <span className="font-bold text-orange-600">{csvRows.length - mappedContacts.length}</span>
                  </div>
                )}
                {selectedTagIds.length > 0 && (
                  <div className="flex justify-between text-sm items-center">
                    <span className="text-muted-foreground">Tags to apply:</span>
                    <div className="flex gap-1">
                      {selectedTagIds.map(id => {
                        const tag = tags.find(t => t.id === id);
                        if (!tag) return null;
                        const s = tagStyle(tag.color);
                        return <span key={id} className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>{tag.name}</span>;
                      })}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setStep("tags")} className="px-5 py-2.5 rounded-xl border border-border text-sm font-semibold hover:bg-muted">Back</button>
                <button
                  onClick={handleImport}
                  disabled={importMutation.isPending || mappedContacts.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-foreground text-background text-sm font-bold hover:bg-primary hover:text-white transition-all disabled:opacity-50"
                  data-testid="button-confirm-import"
                >
                  {importMutation.isPending ? "Importing..." : `Import ${mappedContacts.length} Contacts`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PhoneImportButton({ tags }: { tags: ContactTag[] }) {
  const { toast } = useToast();
  const [showTagSelect, setShowTagSelect] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const importMutation = useMutation({
    mutationFn: async (data: { contacts: any[]; tagIds: number[] }) => {
      const res = await apiRequest("POST", "/api/agent/contacts/import-phone", data);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agent/contacts"] });
      toast({ title: `${data.imported} phone contacts imported` });
      setShowTagSelect(false);
    },
    onError: (err: any) => toast({ title: "Import failed", description: err.message, variant: "destructive" }),
  });

  const handlePhoneImport = async () => {
    if (!("contacts" in navigator && "ContactsManager" in window)) {
      toast({
        title: "Not supported",
        description: "Phone contacts import requires a mobile browser that supports the Contact Picker API.",
        variant: "destructive",
      });
      return;
    }

    try {
      const props = ["name", "email", "tel"];
      const contacts = await (navigator as any).contacts.select(props, { multiple: true });
      if (!contacts || contacts.length === 0) return;

      const mapped = contacts.map((c: any) => ({
        name: c.name?.[0] || "Unknown",
        email: c.email?.[0] || null,
        phone: c.tel?.[0] || null,
      }));

      if (tags.length > 0) {
        setShowTagSelect(true);
        (window as any).__pendingPhoneContacts = mapped;
      } else {
        importMutation.mutate({ contacts: mapped, tagIds: [] });
      }
    } catch {
      toast({ title: "Could not access phone contacts", variant: "destructive" });
    }
  };

  const confirmPhoneImport = () => {
    const mapped = (window as any).__pendingPhoneContacts || [];
    importMutation.mutate({ contacts: mapped, tagIds: selectedTagIds });
    delete (window as any).__pendingPhoneContacts;
  };

  return (
    <>
      <button
        onClick={handlePhoneImport}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-border text-sm font-semibold hover:bg-muted transition-colors"
        data-testid="button-import-phone"
      >
        <Phone className="w-4 h-4" /> Phone
      </button>

      {showTagSelect && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowTagSelect(false)}>
          <div className="bg-background rounded-2xl border border-border shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <h3 className="text-lg font-display font-bold mb-3">Tag imported contacts</h3>
              <div className="flex flex-wrap gap-2 mb-6">
                {tags.map(tag => {
                  const selected = selectedTagIds.includes(tag.id);
                  const s = tagStyle(tag.color);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => setSelectedTagIds(prev => selected ? prev.filter(id => id !== tag.id) : [...prev, tag.id])}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        selected ? `${s.bg} ${s.text} ${s.border} ring-2 ring-offset-1 ring-primary/30` : `bg-muted text-muted-foreground border-border`
                      }`}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowTagSelect(false)} className="px-4 py-2 rounded-xl border border-border text-sm font-semibold">Cancel</button>
                <button
                  onClick={confirmPhoneImport}
                  disabled={importMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-foreground text-background text-sm font-bold hover:bg-primary hover:text-white transition-all disabled:opacity-50"
                >
                  {importMutation.isPending ? "Importing..." : "Import"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}
