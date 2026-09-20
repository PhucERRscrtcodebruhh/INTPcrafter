import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  User, 
  Zap, 
  MapPin, 
  Clock, 
  Layers, 
  ShieldAlert, 
  Plus, 
  Trash2, 
  Sparkles, 
  Info,
  Tag,
  Activity,
  Code
} from 'lucide-react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

const CATEGORIES = [
  { id: 'Character', label: 'Character / Entity', icon: User, color: 'text-cyan-400 border-cyan-500/40 bg-cyan-950/30' },
  { id: 'MagicSystem', label: 'Magic / Science System', icon: Zap, color: 'text-purple-400 border-purple-500/40 bg-purple-950/30' },
  { id: 'Location', label: 'Location / Zone', icon: MapPin, color: 'text-emerald-400 border-emerald-500/40 bg-emerald-950/30' },
  { id: 'Event', label: 'Event / Timeline Anchor', icon: Clock, color: 'text-amber-400 border-amber-500/40 bg-amber-950/30' },
  { id: 'General', label: 'General Lore / Law', icon: Layers, color: 'text-blue-400 border-blue-500/40 bg-blue-950/30' }
];

export default function LoreEntityModal({
  isOpen,
  onClose,
  entry,
  defaultCategory = 'Character',
  bookId,
  onSave
}) {
  const [category, setCategory] = useState(defaultCategory);
  const [title, setTitle] = useState('');
  const [aliases, setAliases] = useState('');
  const [rules, setRules] = useState('');
  const [content, setContent] = useState('');
  const [metadata, setMetadata] = useState({});
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when opening or entry changes
  useEffect(() => {
    if (isOpen) {
      if (entry) {
        setTitle(entry.title || '');
        setCategory(entry.category || 'Character');
        setAliases(Array.isArray(entry.aliases) ? entry.aliases.join(', ') : (entry.aliases || ''));
        setRules(entry.rules || '');
        setContent(entry.content || entry.canonicalLore || '');
        setMetadata(typeof entry.metadata === 'object' ? entry.metadata : {});
      } else {
        setTitle('');
        setCategory(defaultCategory === 'All' ? 'Character' : (defaultCategory || 'Character'));
        setAliases('');
        setRules('');
        setContent('');
        setMetadata({});
      }
      setFormError('');
    }
  }, [isOpen, entry, defaultCategory]);

  if (!isOpen) return null;

  // Metadata update helper
  const handleMetaChange = (field, value) => {
    setMetadata(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Lore Entity title is required');
      return;
    }

    setIsSaving(true);
    setFormError('');

    try {
      const payload = {
        id: entry?.id,
        book_id: bookId,
        worldId: String(bookId || ''),
        title: title.trim(),
        category,
        aliases: aliases.trim(),
        rules: rules.trim(),
        content: content.trim(),
        canonicalLore: content.trim(),
        metadata
      };

      await onSave(payload);
      onClose();
    } catch (err) {
      setFormError(err.message || 'Failed to save lore entry');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center p-0 md:p-4 bg-cyber-950/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-3xl glass-panel border-t md:border border-cyan-500/30 rounded-t-2xl md:rounded-xl shadow-glow-cyan overflow-hidden flex flex-col max-h-[88vh] md:max-h-[92vh] pb-safe font-mono"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile Drag Handle Pill */}
        <div className="w-12 h-1.5 bg-slate-700/80 rounded-full mx-auto my-2 md:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 md:py-4 border-b border-cyan-500/20 bg-cyber-900/80">
          <div className="flex items-center space-x-2 truncate">
            <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-pulse flex-shrink-0" />
            <h3 className="text-xs sm:text-sm font-bold tracking-wider text-slate-100 uppercase truncate">
              {entry ? `Edit Entity: ${entry.title}` : `+ Create Polymorphic Lore Entity`}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-cyan-400 rounded-lg hover:bg-cyber-800 transition-colors"
            title="Close"
            aria-label="Close"
          >
            <span className="text-xs font-mono font-bold mr-1 hidden sm:inline">Close</span>
            <X size={18} />
          </button>
        </div>

        {/* Content & Dynamic Sub-forms */}
        <form onSubmit={handleSave} className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {formError && (
            <div className="p-3 rounded bg-rose-950/70 border border-rose-500/50 text-rose-300">
              {formError}
            </div>
          )}

          {/* Category Selector Tabs */}
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
              Polymorphic Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
              {CATEGORIES.map(cat => {
                const Icon = cat.icon;
                const isSelected = category === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategory(cat.id)}
                    className={`min-h-[44px] px-2.5 py-1.5 rounded-lg border text-xs flex items-center justify-center space-x-1.5 transition-all ${
                      isSelected 
                        ? `${cat.color} font-bold shadow-glow-cyan-sm ring-1 ring-cyan-400/50` 
                        : 'border-slate-800 bg-cyber-900 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon size={14} />
                    <span className="truncate">{cat.id}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Common Field 1: Title & Aliases */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold block text-[11px] uppercase tracking-wider">
                Entity Name / Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Kaelen Vance, Flux Burn, Sector 07..."
                className="w-full min-h-[44px] px-3 py-2 bg-cyber-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-cyan-400"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-semibold block text-[11px] uppercase tracking-wider">
                Aliases & Keywords (Comma Separated)
              </label>
              <input
                type="text"
                value={aliases}
                onChange={(e) => setAliases(e.target.value)}
                placeholder="e.g. Kael, The Spire Weaver, Unit 404"
                className="w-full min-h-[44px] px-3 py-2 bg-cyber-950 border border-slate-800 rounded-lg text-slate-100 text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* DYNAMIC POLYMORPHIC SUB-FORM */}
          <div className="p-3.5 rounded-xl bg-cyber-900/50 border border-cyan-500/20 space-y-3">
            <div className="flex items-center space-x-2 text-cyan-400 font-bold uppercase tracking-wider text-[11px] border-b border-cyan-500/20 pb-2">
              <Sparkles size={13} />
              <span>Category Metadata: {category}</span>
            </div>

            {/* Sub-form 1: CHARACTER */}
            {category === 'Character' && (
              <CharacterSubForm 
                metadata={metadata} 
                onChange={handleMetaChange} 
              />
            )}

            {/* Sub-form 2: MAGIC / SCIENCE SYSTEM */}
            {category === 'MagicSystem' && (
              <MagicSystemSubForm 
                metadata={metadata} 
                onChange={handleMetaChange} 
              />
            )}

            {/* Sub-form 3: LOCATION */}
            {category === 'Location' && (
              <LocationSubForm 
                metadata={metadata} 
                onChange={handleMetaChange} 
              />
            )}

            {/* Sub-form 4: EVENT */}
            {category === 'Event' && (
              <EventSubForm 
                metadata={metadata} 
                onChange={handleMetaChange} 
              />
            )}

            {/* Sub-form 5: GENERAL */}
            {category === 'General' && (
              <p className="text-[11px] text-slate-400 italic">
                General entities represent global laws, factions, or cosmological concepts that govern world behavior.
              </p>
            )}
          </div>

          {/* Common Field 2: Rules & Invariant Constraints */}
          <div className="space-y-1">
            <label className="text-amber-400 font-semibold flex items-center space-x-1 text-[11px] uppercase tracking-wider">
              <ShieldAlert size={13} />
              <span>Deterministic World Rules & Invariant Constraints</span>
            </label>
            <textarea
              rows={3}
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              placeholder="RULE 1: Aether cannot be generated without conductor. RULE 2: Cold iron dampens resonance frequencies..."
              className="w-full p-2.5 bg-cyber-950 border border-amber-500/30 rounded-lg text-amber-100 text-xs focus:outline-none focus:border-amber-400 font-mono leading-relaxed"
            />
          </div>

          {/* Common Field 3: Canonical Lore Narrative */}
          <div className="space-y-1">
            <label className="text-slate-300 font-semibold block text-[11px] uppercase tracking-wider">
              Canonical Lore & Narrative Details
            </label>
            <textarea
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Detailed lore description, historical context, sensory cues, and psychological motives..."
              className="w-full p-2.5 bg-cyber-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:outline-none focus:border-cyan-400 leading-relaxed"
            />
          </div>

          {/* Footer Action Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 text-xs text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="min-h-[44px] flex items-center space-x-2 px-5 py-2 rounded-lg bg-cyan-400 text-black font-bold text-xs uppercase tracking-wider hover:bg-cyan-300 shadow-glow-cyan transition-all"
            >
              {isSaving ? (
                <>
                  <div className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check size={15} />
                  <span>{entry ? 'Save Changes' : 'Create Lore Entry'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// SUB-FORM 1: CharacterFormModal
// ----------------------------------------------------------------------
function CharacterSubForm({ metadata, onChange }) {
  const statusProgression = Array.isArray(metadata.statusProgression) ? metadata.statusProgression : [];

  const handleAddProg = () => {
    const nextVer = statusProgression.length + 1;
    onChange('statusProgression', [
      ...statusProgression,
      {
        id: `prog_${Date.now()}`,
        version: String(nextVer),
        realmOrLevel: metadata.realmOrLevel || 'Mortal Stage 1',
        description: 'New state breakthrough / power upgrade event.',
        timestampOrChapter: `Chapter ${nextVer * 5}`
      }
    ]);
  };

  const handleUpdateProg = (idx, field, val) => {
    const updated = [...statusProgression];
    updated[idx] = { ...updated[idx], [field]: val };
    onChange('statusProgression', updated);
  };

  const handleRemoveProg = (idx) => {
    const updated = [...statusProgression];
    updated.splice(idx, 1);
    onChange('statusProgression', updated);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="block text-[10px] text-slate-400 mb-1">Current Realm / Cultivation / Level</label>
          <input
            type="text"
            value={metadata.realmOrLevel || ''}
            onChange={(e) => onChange('realmOrLevel', e.target.value)}
            placeholder="e.g. Stage-1 Flux Weaver, Level 75 Cyber-Mage"
            className="w-full min-h-[40px] px-2.5 py-1.5 bg-cyber-950 border border-slate-700 rounded text-slate-100 text-xs focus:border-cyan-400"
          />
        </div>

        <div>
          <label className="block text-[10px] text-slate-400 mb-1">Controlling Faction / Allegiance</label>
          <input
            type="text"
            value={metadata.faction || ''}
            onChange={(e) => onChange('faction', e.target.value)}
            placeholder="e.g. Iron Synod, Sector 07 Scrapper Clan"
            className="w-full min-h-[40px] px-2.5 py-1.5 bg-cyber-950 border border-slate-700 rounded text-slate-100 text-xs focus:border-cyan-400"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="block text-[10px] text-slate-400 mb-1">Personality Traits & Flaws</label>
          <input
            type="text"
            value={metadata.personalityTraits || ''}
            onChange={(e) => onChange('personalityTraits', e.target.value)}
            placeholder="e.g. Pragmatic, calculating, emotionally reserved"
            className="w-full min-h-[40px] px-2.5 py-1.5 bg-cyber-950 border border-slate-700 rounded text-slate-100 text-xs focus:border-cyan-400"
          />
        </div>

        <div>
          <label className="block text-[10px] text-slate-400 mb-1">Equipment / Bound Artifacts</label>
          <input
            type="text"
            value={metadata.equipmentOrItems || ''}
            onChange={(e) => onChange('equipmentOrItems', e.target.value)}
            placeholder="e.g. Obsidian Rapier, Biometric Stabilizing Gloves"
            className="w-full min-h-[40px] px-2.5 py-1.5 bg-cyber-950 border border-slate-700 rounded text-slate-100 text-xs focus:border-cyan-400"
          />
        </div>
      </div>

      {/* Versioned Status Progression */}
      <div className="space-y-2 pt-1 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-cyan-300 flex items-center space-x-1">
            <Activity size={12} />
            <span>Versioned Status Progression ({statusProgression.length})</span>
          </span>
          <button
            type="button"
            onClick={handleAddProg}
            className="min-h-[36px] px-2 py-1 rounded bg-cyan-950 border border-cyan-500/40 text-cyan-300 text-[11px] hover:bg-cyan-900 transition-all flex items-center space-x-1"
          >
            <Plus size={12} />
            <span>+ Add Stage</span>
          </button>
        </div>

        {statusProgression.map((prog, idx) => (
          <div key={prog.id || idx} className="p-2.5 rounded bg-cyber-950 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-cyan-400">Stage #{idx + 1} (v{prog.version || idx + 1})</span>
              <button
                type="button"
                onClick={() => handleRemoveProg(idx)}
                className="text-slate-500 hover:text-rose-400 p-1"
              >
                <Trash2 size={12} />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={prog.realmOrLevel || ''}
                onChange={(e) => handleUpdateProg(idx, 'realmOrLevel', e.target.value)}
                placeholder="Realm/Level"
                className="bg-cyber-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-100"
              />
              <input
                type="text"
                value={prog.timestampOrChapter || ''}
                onChange={(e) => handleUpdateProg(idx, 'timestampOrChapter', e.target.value)}
                placeholder="Chapter/Epoch"
                className="bg-cyber-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-100"
              />
            </div>
            <input
              type="text"
              value={prog.description || ''}
              onChange={(e) => handleUpdateProg(idx, 'description', e.target.value)}
              placeholder="Breakthrough trigger description..."
              className="w-full bg-cyber-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-300"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// SUB-FORM 2: MagicSystemFormModal
// ----------------------------------------------------------------------
function MagicSystemSubForm({ metadata, onChange }) {
  const formula = metadata.formulaOrEquation || '';
  let renderedLatex = '';
  try {
    if (formula.trim()) {
      renderedLatex = katex.renderToString(formula, { displayMode: true, throwOnError: false });
    }
  } catch (e) {}

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="block text-[10px] text-slate-400 mb-1">System Type</label>
          <select
            value={metadata.type || 'Magic'}
            onChange={(e) => onChange('type', e.target.value)}
            className="w-full min-h-[40px] px-2.5 py-1.5 bg-cyber-950 border border-slate-700 rounded text-slate-100 text-xs focus:border-cyan-400"
          >
            <option value="Magic">Magic (Occult / Aetheric)</option>
            <option value="Chemistry">Chemistry / Alchemy</option>
            <option value="Tech">Cybernetic / Tech</option>
            <option value="Hybrid">Hybrid (Aether-Tech)</option>
            <option value="Martial">Martial / Qi Cultivation</option>
            <option value="Divine">Divine / Cosmic Rule</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] text-slate-400 mb-1">Resource Cost / Biological Toll</label>
          <input
            type="text"
            value={metadata.resourceCost || ''}
            onChange={(e) => onChange('resourceCost', e.target.value)}
            placeholder="e.g. Flux Burn cellular necrosis, Sanity drain, Mana depletion"
            className="w-full min-h-[40px] px-2.5 py-1.5 bg-cyber-950 border border-slate-700 rounded text-slate-100 text-xs focus:border-cyan-400"
          />
        </div>
      </div>

      <div>
        <label className="block text-[10px] text-slate-400 mb-1">Unlock / Breakthrough Conditions</label>
        <input
          type="text"
          value={metadata.unlockConditions || ''}
          onChange={(e) => onChange('unlockConditions', e.target.value)}
          placeholder="e.g. Attunement with conduit crystal; Surviving void exposure"
          className="w-full min-h-[40px] px-2.5 py-1.5 bg-cyber-950 border border-slate-700 rounded text-slate-100 text-xs focus:border-cyan-400"
        />
      </div>

      {/* LaTeX Formula with KaTeX Preview */}
      <div className="space-y-1.5 pt-1 border-t border-slate-800">
        <label className="block text-[10px] text-purple-300 font-semibold flex items-center space-x-1">
          <Code size={12} />
          <span>Physics / Magic Equation (LaTeX Syntax)</span>
        </label>
        <input
          type="text"
          value={formula}
          onChange={(e) => onChange('formulaOrEquation', e.target.value)}
          placeholder="e.g. \\Delta \\Phi = \\int_{0}^{t} \\omega(\\tau) d\\tau"
          className="w-full min-h-[40px] px-2.5 py-1.5 bg-cyber-950 border border-purple-500/30 rounded text-purple-200 text-xs font-mono focus:border-purple-400"
        />
        {renderedLatex ? (
          <div 
            className="p-3 bg-cyber-950/80 border border-purple-500/20 rounded text-center overflow-x-auto text-purple-200"
            dangerouslySetInnerHTML={{ __html: renderedLatex }}
          />
        ) : (
          <span className="text-[10px] text-slate-500 block">
            Enter LaTeX formula to render dynamic mathematical preview.
          </span>
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// SUB-FORM 3: LocationFormModal
// ----------------------------------------------------------------------
function LocationSubForm({ metadata, onChange }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="block text-[10px] text-slate-400 mb-1">Environment / Terrain Type</label>
          <input
            type="text"
            value={metadata.environmentType || ''}
            onChange={(e) => onChange('environmentType', e.target.value)}
            placeholder="e.g. Flooded subterranean labyrinth, Void Spire"
            className="w-full min-h-[40px] px-2.5 py-1.5 bg-cyber-950 border border-slate-700 rounded text-slate-100 text-xs focus:border-cyan-400"
          />
        </div>

        <div>
          <label className="block text-[10px] text-slate-400 mb-1">Controlling Faction / Hegemony</label>
          <input
            type="text"
            value={metadata.controllingFaction || ''}
            onChange={(e) => onChange('controllingFaction', e.target.value)}
            placeholder="e.g. The Iron Synod, Free Scrappers League"
            className="w-full min-h-[40px] px-2.5 py-1.5 bg-cyber-950 border border-slate-700 rounded text-slate-100 text-xs focus:border-cyan-400"
          />
        </div>
      </div>

      <div>
        <label className="block text-[10px] text-slate-400 mb-1">Hazards & Strategic Resources</label>
        <input
          type="text"
          value={metadata.hazardsOrResources || ''}
          onChange={(e) => onChange('hazardsOrResources', e.target.value)}
          placeholder="e.g. High ambient aether radiation, Submerged high-voltage arcs, Rare cipher drops"
          className="w-full min-h-[40px] px-2.5 py-1.5 bg-cyber-950 border border-slate-700 rounded text-slate-100 text-xs focus:border-cyan-400"
        />
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// SUB-FORM 4: EventFormModal
// ----------------------------------------------------------------------
function EventSubForm({ metadata, onChange }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div>
          <label className="block text-[10px] text-slate-400 mb-1">Time Anchor / Epoch / Chapter</label>
          <input
            type="text"
            value={metadata.timeAnchor || ''}
            onChange={(e) => onChange('timeAnchor', e.target.value)}
            placeholder="e.g. Epoch 2099 - Cycle 4, Chapter 12"
            className="w-full min-h-[40px] px-2.5 py-1.5 bg-cyber-950 border border-slate-700 rounded text-slate-100 text-xs focus:border-cyan-400"
          />
        </div>

        <div>
          <label className="block text-[10px] text-slate-400 mb-1">Key Participants</label>
          <input
            type="text"
            value={metadata.participants || ''}
            onChange={(e) => onChange('participants', e.target.value)}
            placeholder="e.g. Kaelen Vance, Synod Enforcers, Scrapper Clans"
            className="w-full min-h-[40px] px-2.5 py-1.5 bg-cyber-950 border border-slate-700 rounded text-slate-100 text-xs focus:border-cyan-400"
          />
        </div>
      </div>

      <div>
        <label className="block text-[10px] text-slate-400 mb-1">Event Outcome</label>
        <input
          type="text"
          value={metadata.outcome || ''}
          onChange={(e) => onChange('outcome', e.target.value)}
          placeholder="e.g. Synod sealed the lower conduit tier, isolating rogue weavers."
          className="w-full min-h-[40px] px-2.5 py-1.5 bg-cyber-950 border border-slate-700 rounded text-slate-100 text-xs focus:border-cyan-400"
        />
      </div>

      <div>
        <label className="block text-[10px] text-slate-400 mb-1">Causal Consequences & World Impact</label>
        <input
          type="text"
          value={metadata.consequences || ''}
          onChange={(e) => onChange('consequences', e.target.value)}
          placeholder="e.g. Black market cipher prices surged 300%; Kaelen entered indentured service."
          className="w-full min-h-[40px] px-2.5 py-1.5 bg-cyber-950 border border-slate-700 rounded text-slate-100 text-xs focus:border-cyan-400"
        />
      </div>
    </div>
  );
}
