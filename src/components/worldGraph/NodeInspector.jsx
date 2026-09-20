import React, { useState, useEffect } from 'react';
import { 
  X, 
  Trash2, 
  Plus, 
  User, 
  Zap, 
  MapPin, 
  Clock, 
  Layers, 
  Link, 
  Shield, 
  Activity, 
  Sparkles, 
  AlertCircle, 
  Save, 
  Copy,
  ChevronRight,
  Info
} from 'lucide-react';

const RELATIONSHIP_TYPES = [
  'OWNS',
  'UPGRADES_TO',
  'LOCATED_AT',
  'MUTUAL_ENEMY',
  'REQUIRES_ELEMENT',
  'ALLIED_WITH',
  'MEMBER_OF',
  'CREATES',
  'CAUSES',
  'PARTICIPATES_IN',
  'CONTRADICTS',
  'SUB_SYSTEM_OF',
  'CUSTOM'
];

const SYSTEM_TYPES = ['Magic', 'Science', 'Hybrid', 'Martial', 'Divine', 'Psionic'];

export default function NodeInspector({
  selectedNode,
  selectedEdge,
  onUpdateNodeData,
  onUpdateEdgeData,
  onDeleteNode,
  onDeleteEdge,
  onClose,
  allNodes = []
}) {
  if (!selectedNode && !selectedEdge) return null;

  // Node Inspector Form
  if (selectedNode) {
    const nodeType = selectedNode.type || 'character';
    const data = selectedNode.data || {};

    const handleFieldChange = (field, value) => {
      onUpdateNodeData(selectedNode.id, {
        ...data,
        [field]: value
      });
    };

    // Helper for array fields (abilities, rules, unlocks, resources, participants)
    const handleAddArrayItem = (field, defaultValue = '') => {
      const currentList = Array.isArray(data[field]) ? [...data[field]] : [];
      currentList.push(defaultValue);
      handleFieldChange(field, currentList);
    };

    const handleUpdateArrayItem = (field, index, value) => {
      const currentList = Array.isArray(data[field]) ? [...data[field]] : [];
      currentList[index] = value;
      handleFieldChange(field, currentList);
    };

    const handleRemoveArrayItem = (field, index) => {
      const currentList = Array.isArray(data[field]) ? [...data[field]] : [];
      currentList.splice(index, 1);
      handleFieldChange(field, currentList);
    };

    // Status progression helper for Character
    const handleAddProgression = () => {
      const currentProg = Array.isArray(data.statusProgression) ? [...data.statusProgression] : [];
      const nextVersion = currentProg.length + 1;
      currentProg.push({
        id: `stage_${Date.now()}`,
        version: String(nextVersion),
        realmOrLevel: data.currentRealm || 'Next Realm',
        description: 'New upgrade breakthrough or state change event.',
        timestampOrChapter: `Chapter ${nextVersion * 10}`
      });
      handleFieldChange('statusProgression', currentProg);
    };

    const handleUpdateProgression = (index, field, value) => {
      const currentProg = Array.isArray(data.statusProgression) ? [...data.statusProgression] : [];
      currentProg[index] = { ...currentProg[index], [field]: value };
      handleFieldChange('statusProgression', currentProg);
    };

    const handleRemoveProgression = (index) => {
      const currentProg = Array.isArray(data.statusProgression) ? [...data.statusProgression] : [];
      currentProg.splice(index, 1);
      handleFieldChange('statusProgression', currentProg);
    };

    return (
      <div className="w-80 sm:w-96 h-full bg-cyber-950 border-l border-cyan-500/20 flex flex-col z-20 shadow-2xl overflow-hidden animate-fadeIn select-text">
        {/* Header */}
        <div className="p-3.5 bg-cyber-900 border-b border-cyan-500/20 flex items-center justify-between">
          <div className="flex items-center space-x-2 truncate">
            <div className={`w-7 h-7 rounded flex items-center justify-center border ${
              nodeType === 'character' ? 'bg-cyan-950 border-cyan-500/50 text-cyan-300' :
              nodeType === 'system' ? 'bg-purple-950 border-purple-500/50 text-purple-300' :
              nodeType === 'location' ? 'bg-emerald-950 border-emerald-500/50 text-emerald-300' :
              'bg-amber-950 border-amber-500/50 text-amber-300'
            }`}>
              {nodeType === 'character' && <User size={14} />}
              {nodeType === 'system' && <Zap size={14} />}
              {nodeType === 'location' && <MapPin size={14} />}
              {nodeType === 'event' && <Clock size={14} />}
            </div>
            <div className="truncate">
              <h3 className="text-xs font-bold text-slate-100 font-mono uppercase tracking-wider truncate">
                {nodeType} Inspector
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">ID: {selectedNode.id}</span>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => onDeleteNode(selectedNode.id)}
              className="p-1.5 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition-colors"
              title="Delete Node"
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-cyber-800 text-slate-400 hover:text-slate-200"
              title="Close"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {/* ================= CHARACTER FORM ================= */}
          {nodeType === 'character' && (
            <>
              <div>
                <label className="block text-[11px] font-mono text-cyan-400 mb-1">Character Name *</label>
                <input
                  type="text"
                  value={data.name || ''}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  placeholder="e.g., Kaelen Vance, Lạc Vân"
                  className="w-full bg-cyber-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Aliases</label>
                  <input
                    type="text"
                    value={data.aliases || ''}
                    onChange={(e) => handleFieldChange('aliases', e.target.value)}
                    placeholder="e.g., The Spire Weaver"
                    className="w-full bg-cyber-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Role</label>
                  <input
                    type="text"
                    value={data.role || ''}
                    onChange={(e) => handleFieldChange('role', e.target.value)}
                    placeholder="e.g., Protagonist, Archivist"
                    className="w-full bg-cyber-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-cyan-400 mb-1">Current Realm / Level</label>
                <input
                  type="text"
                  value={data.currentRealm || ''}
                  onChange={(e) => handleFieldChange('currentRealm', e.target.value)}
                  placeholder="e.g., Stage-1 Flux Weaver, Trúc Cơ Viên Mãn"
                  className="w-full bg-cyber-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-400 font-semibold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">Psychology & Motivations</label>
                <textarea
                  rows={3}
                  value={data.personality || ''}
                  onChange={(e) => handleFieldChange('personality', e.target.value)}
                  placeholder="e.g., Pragmatic, calculating, burdened by debt. Never surrenders sister data-core."
                  className="w-full bg-cyber-900 border border-slate-700 rounded p-2 text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-400 leading-relaxed"
                />
              </div>

              {/* Abilities List */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono text-cyan-400">Canon Abilities</label>
                  <button
                    type="button"
                    onClick={() => handleAddArrayItem('abilities', 'New Ability')}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono flex items-center space-x-0.5"
                  >
                    <Plus size={12} />
                    <span>Add</span>
                  </button>
                </div>
                {(Array.isArray(data.abilities) ? data.abilities : []).map((ability, aIdx) => (
                  <div key={aIdx} className="flex items-center space-x-1.5">
                    <input
                      type="text"
                      value={ability}
                      onChange={(e) => handleUpdateArrayItem('abilities', aIdx, e.target.value)}
                      className="flex-1 bg-cyber-900 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveArrayItem('abilities', aIdx)}
                      className="p-1 text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Status Progression Stages */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono text-cyan-400 flex items-center space-x-1">
                    <Activity size={12} />
                    <span>Progression History</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddProgression}
                    className="text-[10px] text-cyan-400 hover:text-cyan-300 font-mono flex items-center space-x-0.5"
                  >
                    <Plus size={12} />
                    <span>+ New Stage</span>
                  </button>
                </div>

                {(Array.isArray(data.statusProgression) ? data.statusProgression : []).map((prog, pIdx) => (
                  <div key={prog.id || pIdx} className="p-2.5 rounded bg-cyber-900 border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        type="text"
                        value={prog.realmOrLevel || ''}
                        onChange={(e) => handleUpdateProgression(pIdx, 'realmOrLevel', e.target.value)}
                        placeholder="Stage Realm / Title"
                        className="flex-1 bg-cyber-950 border border-slate-700 rounded px-2 py-0.5 text-cyan-300 font-bold font-mono text-xs"
                      />
                      <input
                        type="text"
                        value={prog.timestampOrChapter || ''}
                        onChange={(e) => handleUpdateProgression(pIdx, 'timestampOrChapter', e.target.value)}
                        placeholder="Ch. / Epoch"
                        className="w-20 bg-cyber-950 border border-slate-700 rounded px-1.5 py-0.5 text-slate-400 font-mono text-[10px]"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveProgression(pIdx)}
                        className="p-1 text-slate-500 hover:text-rose-400"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={prog.description || ''}
                      onChange={(e) => handleUpdateProgression(pIdx, 'description', e.target.value)}
                      placeholder="Stage state changes, breakthroughs, injuries..."
                      className="w-full bg-cyber-950 border border-slate-700 rounded p-1.5 text-slate-300 font-mono text-[11px] leading-relaxed"
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ================= SYSTEM FORM ================= */}
          {nodeType === 'system' && (
            <>
              <div>
                <label className="block text-[11px] font-mono text-purple-400 mb-1">System Name *</label>
                <input
                  type="text"
                  value={data.systemName || ''}
                  onChange={(e) => handleFieldChange('systemName', e.target.value)}
                  placeholder="e.g., Resonant Aether Weaving, Cổ Trùng Đạo"
                  className="w-full bg-cyber-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Classification</label>
                  <select
                    value={data.type || 'Magic'}
                    onChange={(e) => handleFieldChange('type', e.target.value)}
                    className="w-full bg-cyber-900 border border-slate-700 rounded px-2 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-purple-400"
                  >
                    {SYSTEM_TYPES.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-purple-400 mb-1">Resource Cost / Toll</label>
                  <input
                    type="text"
                    value={data.resourceCost || ''}
                    onChange={(e) => handleFieldChange('resourceCost', e.target.value)}
                    placeholder="e.g., Flux Burn necrosis, Thọ nguyên"
                    className="w-full bg-cyber-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-purple-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-purple-400 mb-1">
                  Invariant Mathematical / Physical Equation (LaTeX)
                </label>
                <input
                  type="text"
                  value={data.formulaOrEquation || ''}
                  onChange={(e) => handleFieldChange('formulaOrEquation', e.target.value)}
                  placeholder="\Delta \Phi = \int \omega(t) dt"
                  className="w-full bg-cyber-900 border border-slate-700 rounded px-2.5 py-1.5 text-purple-200 font-mono text-xs focus:outline-none focus:border-purple-400"
                />
              </div>

              {/* Rules & Invariants */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono text-purple-400 flex items-center space-x-1">
                    <AlertCircle size={12} />
                    <span>Deterministic Rules & Limits</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleAddArrayItem('rulesAndConstraints', 'RULE: ')}
                    className="text-[10px] text-purple-400 hover:text-purple-300 font-mono flex items-center space-x-0.5"
                  >
                    <Plus size={12} />
                    <span>Add Rule</span>
                  </button>
                </div>
                {(Array.isArray(data.rulesAndConstraints) ? data.rulesAndConstraints : []).map((rule, rIdx) => (
                  <div key={rIdx} className="flex items-center space-x-1.5">
                    <input
                      type="text"
                      value={rule}
                      onChange={(e) => handleUpdateArrayItem('rulesAndConstraints', rIdx, e.target.value)}
                      placeholder="RULE 1: Aether cannot be generated from nothing..."
                      className="flex-1 bg-cyber-900 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-purple-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveArrayItem('rulesAndConstraints', rIdx)}
                      className="p-1 text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Unlocks */}
              <div className="space-y-1.5 pt-1 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono text-purple-400">Granted Unlocks</label>
                  <button
                    type="button"
                    onClick={() => handleAddArrayItem('unlocks', 'New Unlock')}
                    className="text-[10px] text-purple-400 hover:text-purple-300 font-mono flex items-center space-x-0.5"
                  >
                    <Plus size={12} />
                    <span>Add</span>
                  </button>
                </div>
                {(Array.isArray(data.unlocks) ? data.unlocks : []).map((unlock, uIdx) => (
                  <div key={uIdx} className="flex items-center space-x-1.5">
                    <input
                      type="text"
                      value={unlock}
                      onChange={(e) => handleUpdateArrayItem('unlocks', uIdx, e.target.value)}
                      className="flex-1 bg-cyber-900 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-purple-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveArrayItem('unlocks', uIdx)}
                      className="p-1 text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ================= LOCATION FORM ================= */}
          {nodeType === 'location' && (
            <>
              <div>
                <label className="block text-[11px] font-mono text-emerald-400 mb-1">Location Name *</label>
                <input
                  type="text"
                  value={data.name || ''}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  placeholder="e.g., Sector 07: The Drowned Conduits"
                  className="w-full bg-cyber-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-emerald-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-mono text-slate-400 mb-1">Environment / Biome</label>
                  <input
                    type="text"
                    value={data.environment || ''}
                    onChange={(e) => handleFieldChange('environment', e.target.value)}
                    placeholder="e.g., Flooded subterranean"
                    className="w-full bg-cyber-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-emerald-400 mb-1">Controlling Faction</label>
                  <input
                    type="text"
                    value={data.controllingFaction || ''}
                    onChange={(e) => handleFieldChange('controllingFaction', e.target.value)}
                    placeholder="e.g., The Iron Synod, Scrapper Clans"
                    className="w-full bg-cyber-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-emerald-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-amber-400 mb-1">Environmental Hazards</label>
                <textarea
                  rows={2}
                  value={data.hazards || ''}
                  onChange={(e) => handleFieldChange('hazards', e.target.value)}
                  placeholder="e.g., Open electronics submerge triggers aetheric arc detonations."
                  className="w-full bg-cyber-900 border border-slate-700 rounded p-2 text-slate-100 font-mono text-xs focus:outline-none focus:border-emerald-400 leading-relaxed"
                />
              </div>

              {/* Resources */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono text-emerald-400 flex items-center space-x-1">
                    <Layers size={12} />
                    <span>Key Resources</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleAddArrayItem('resources', 'Resource item')}
                    className="text-[10px] text-emerald-400 hover:text-emerald-300 font-mono flex items-center space-x-0.5"
                  >
                    <Plus size={12} />
                    <span>Add</span>
                  </button>
                </div>
                {(Array.isArray(data.resources) ? data.resources : []).map((resource, rIdx) => (
                  <div key={rIdx} className="flex items-center space-x-1.5">
                    <input
                      type="text"
                      value={resource}
                      onChange={(e) => handleUpdateArrayItem('resources', rIdx, e.target.value)}
                      className="flex-1 bg-cyber-900 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-emerald-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveArrayItem('resources', rIdx)}
                      className="p-1 text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ================= EVENT FORM ================= */}
          {nodeType === 'event' && (
            <>
              <div>
                <label className="block text-[11px] font-mono text-amber-400 mb-1">Event Title *</label>
                <input
                  type="text"
                  value={data.eventTitle || ''}
                  onChange={(e) => handleFieldChange('eventTitle', e.target.value)}
                  placeholder="e.g., The Conduit Collapse, Cuộc Thanh Trừng Sector 07"
                  className="w-full bg-cyber-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-amber-400 mb-1">Timestamp / Epoch</label>
                <input
                  type="text"
                  value={data.timestampOrEpoch || ''}
                  onChange={(e) => handleFieldChange('timestampOrEpoch', e.target.value)}
                  placeholder="e.g., Year 2099 - Solar Flare 4, Kỷ Nguyên Thứ 3"
                  className="w-full bg-cyber-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-amber-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">Outcome</label>
                <textarea
                  rows={2}
                  value={data.outcome || ''}
                  onChange={(e) => handleFieldChange('outcome', e.target.value)}
                  placeholder="e.g., The Iron Synod Enforcers sealed Sector 07 with resonant dampers."
                  className="w-full bg-cyber-900 border border-slate-700 rounded p-2 text-slate-100 font-mono text-xs focus:outline-none focus:border-amber-400 leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 mb-1">Causal Consequences</label>
                <textarea
                  rows={2}
                  value={data.consequences || ''}
                  onChange={(e) => handleFieldChange('consequences', e.target.value)}
                  placeholder="e.g., Black-market cipher prices doubled; Kaelen forced into debt."
                  className="w-full bg-cyber-900 border border-slate-700 rounded p-2 text-slate-100 font-mono text-xs focus:outline-none focus:border-amber-400 leading-relaxed"
                />
              </div>

              {/* Participants */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-mono text-amber-400">Participants</label>
                  <button
                    type="button"
                    onClick={() => handleAddArrayItem('participants', 'Participant Name')}
                    className="text-[10px] text-amber-400 hover:text-amber-300 font-mono flex items-center space-x-0.5"
                  >
                    <Plus size={12} />
                    <span>Add</span>
                  </button>
                </div>
                {(Array.isArray(data.participants) ? data.participants : []).map((part, pIdx) => (
                  <div key={pIdx} className="flex items-center space-x-1.5">
                    <input
                      type="text"
                      value={part}
                      onChange={(e) => handleUpdateArrayItem('participants', pIdx, e.target.value)}
                      className="flex-1 bg-cyber-900 border border-slate-800 rounded px-2 py-1 text-slate-200 font-mono text-xs focus:outline-none focus:border-amber-400"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveArrayItem('participants', pIdx)}
                      className="p-1 text-slate-500 hover:text-rose-400"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Common Extra Notes */}
          <div className="pt-2 border-t border-slate-800">
            <label className="block text-[10px] font-mono text-slate-500 mb-1 uppercase">Extra Notes & Context</label>
            <input
              type="text"
              value={data.notes || ''}
              onChange={(e) => handleFieldChange('notes', e.target.value)}
              placeholder="Private worldbuilding notes..."
              className="w-full bg-cyber-900 border border-slate-800 rounded px-2 py-1 text-slate-400 font-mono text-xs focus:outline-none focus:border-slate-600"
            />
          </div>
        </div>
      </div>
    );
  }

  // ================= EDGE INSPECTOR FORM =================
  if (selectedEdge) {
    const edgeData = selectedEdge.data || {};
    const sourceNode = allNodes.find(n => n.id === selectedEdge.source);
    const targetNode = allNodes.find(n => n.id === selectedEdge.target);

    const handleEdgeFieldChange = (field, value) => {
      onUpdateEdgeData(selectedEdge.id, {
        ...edgeData,
        [field]: value
      });
    };

    return (
      <div className="w-80 sm:w-96 h-full bg-cyber-950 border-l border-cyan-500/20 flex flex-col z-20 shadow-2xl overflow-hidden animate-fadeIn select-text">
        <div className="p-3.5 bg-cyber-900 border-b border-cyan-500/20 flex items-center justify-between">
          <div className="flex items-center space-x-2 truncate">
            <div className="w-7 h-7 rounded bg-blue-950 border border-blue-500/50 flex items-center justify-center text-blue-300">
              <Link size={14} />
            </div>
            <div className="truncate">
              <h3 className="text-xs font-bold text-slate-100 font-mono uppercase tracking-wider truncate">
                Edge Connection
              </h3>
              <span className="text-[10px] text-slate-500 font-mono truncate block">
                {sourceNode?.data?.name || sourceNode?.id} → {targetNode?.data?.name || targetNode?.id}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            <button
              onClick={() => onDeleteEdge(selectedEdge.id)}
              className="p-1.5 rounded hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition-colors"
              title="Delete Connection"
            >
              <Trash2 size={14} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-cyber-800 text-slate-400 hover:text-slate-200"
              title="Close"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          <div>
            <label className="block text-[11px] font-mono text-cyan-400 mb-1">Relationship Type</label>
            <select
              value={edgeData.relationshipType || 'OWNS'}
              onChange={(e) => {
                const val = e.target.value;
                handleEdgeFieldChange('relationshipType', val);
                handleEdgeFieldChange('label', val);
              }}
              className="w-full bg-cyber-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-400"
            >
              {RELATIONSHIP_TYPES.map(rel => (
                <option key={rel} value={rel}>{rel}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">Custom Display Label</label>
            <input
              type="text"
              value={edgeData.label || edgeData.relationshipType || ''}
              onChange={(e) => handleEdgeFieldChange('label', e.target.value)}
              placeholder="e.g., OWNS, UPGRADES_TO"
              className="w-full bg-cyber-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-400 font-bold"
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 mb-1">Relationship Context / Description</label>
            <textarea
              rows={3}
              value={edgeData.description || ''}
              onChange={(e) => handleEdgeFieldChange('description', e.target.value)}
              placeholder="e.g., Kaelen carries an aether-synthesized obsidian rapier bound to his neural flux."
              className="w-full bg-cyber-900 border border-slate-700 rounded p-2 text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-400 leading-relaxed"
            />
          </div>

          <div className="p-2.5 rounded bg-cyber-900/60 border border-slate-800 text-[11px] text-slate-400 space-y-1">
            <span className="text-cyan-400 font-bold block flex items-center space-x-1">
              <Info size={11} />
              <span>Graph RAG Tip</span>
            </span>
            <p className="leading-relaxed">
              When querying this character, the Graph RAG engine walks this edge to automatically bundle the connected entity and its rules into the LLM context.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
