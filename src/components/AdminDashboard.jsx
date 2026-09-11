import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
  UserPlus, 
  Users, 
  ShieldAlert, 
  Layers, 
  Sliders, 
  CheckCircle, 
  AlertCircle, 
  AlertTriangle, 
  Edit2, 
  Trash2, 
  RotateCcw, 
  Search, 
  X, 
  Play, 
  Pause, 
  Square,
  Key,
  Award,
  Plus,
  HelpCircle,
  Terminal,
  Check,
  Eye,
  EyeOff,
  Filter,
  Server,
  Smartphone,
  Laptop,
  Palette,
  Copy,
  BookOpen,
  Maximize,
  Minimize,
  AlertOctagon,
  RefreshCw,
  Clock,
  ShieldCheck
} from 'lucide-react';

export default function AdminDashboard() {
  const { token, user } = useAuth();
  const { theme, setTheme, themes } = useTheme();
  const [tab, setTab] = useState('alumni'); // 'alumni' | 'enroll' | 'proctor' | 'nodes' | 'config' | 'hosting'
  const [copiedSnippet, setCopiedSnippet] = useState(null);
  const [alumniList, setAlumniList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [proctorLogs, setProctorLogs] = useState([]);
  const [proctorFilterType, setProctorFilterType] = useState('ALL');
  const [proctorSearch, setProctorSearch] = useState('');
  const [isRefreshingProctor, setIsRefreshingProctor] = useState(false);
  const [isClearingLogs, setIsClearingLogs] = useState(false);
  const [nodes, setNodes] = useState([]);
  const [config, setConfig] = useState({});

  // Single enroll form
  const [name, setName] = useState('');
  const [batch, setBatch] = useState('19MX');
  const [username, setUsername] = useState('');
  const [passkey, setPasskey] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [organization, setOrganization] = useState('');
  const [enrollStatus, setEnrollStatus] = useState(null);

  // Bulk enroll form
  const [bulkText, setBulkText] = useState('');
  const [bulkStatus, setBulkStatus] = useState(null);

  // Edit modal
  const [editingAlumni, setEditingAlumni] = useState(null);
  const [editStatus, setEditStatus] = useState(null);

  // Delete confirm modal
  const [deletingId, setDeletingId] = useState(null);

  // === Node CRUD State ===
  const [nodeSearch, setNodeSearch] = useState('');
  const [nodeTierFilter, setNodeTierFilter] = useState('ALL');
  const [isCreatingNode, setIsCreatingNode] = useState(false);
  const [editingNode, setEditingNode] = useState(null);
  const [nodeFormStatus, setNodeFormStatus] = useState(null);
  const [activeHintsAccordion, setActiveHintsAccordion] = useState(null);

  // Node form state
  const [formCode, setFormCode] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formTier, setFormTier] = useState('foundation');
  const [formDomain, setFormDomain] = useState('cryptography');
  const [formStory, setFormStory] = useState('');
  const [formClueText, setFormClueText] = useState('');
  const [formPayload, setFormPayload] = useState('');
  const [formAnswer, setFormAnswer] = useState('');
  const [formAliases, setFormAliases] = useState('');
  const [formHints, setFormHints] = useState(['', '', '', '', '', '', '']);
  const [formPoints, setFormPoints] = useState(1000);

  // In-card test solve
  const [testNodeId, setTestNodeId] = useState(null);
  const [testAnswer, setTestAnswer] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testing, setTesting] = useState(false);

  // Change Admin Key state
  const [newAdminKeyInput, setNewAdminKeyInput] = useState('');
  const [adminKeyStatus, setAdminKeyStatus] = useState(null);
  const [adminKeyLoading, setAdminKeyLoading] = useState(false);

  const handleChangeAdminKey = async (e) => {
    e.preventDefault();
    if (!newAdminKeyInput || newAdminKeyInput.trim().length < 6) {
      setAdminKeyStatus({ type: 'error', message: 'Passkey must be at least 6 characters long.' });
      return;
    }
    setAdminKeyLoading(true);
    setAdminKeyStatus(null);
    try {
      const res = await fetch('/api/admin/change-admin-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ newAdminKey: newAdminKeyInput.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setAdminKeyStatus({ type: 'success', message: data.message });
        setNewAdminKeyInput('');
        fetchConfig();
      } else {
        setAdminKeyStatus({ type: 'error', message: data.error || 'Failed to update passkey' });
      }
    } catch (err) {
      setAdminKeyStatus({ type: 'error', message: 'Network error: ' + err.message });
    } finally {
      setAdminKeyLoading(false);
    }
  };

  const fetchAlumni = async () => {
    try {
      const q = searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : '';
      const res = await fetch(`/api/admin/alumni${q}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setAlumniList(data.alumni || []);
    } catch (e) {}
  };

  const fetchProctorLogs = async (manual = false) => {
    try {
      if (manual) setIsRefreshingProctor(true);
      const params = new URLSearchParams();
      if (proctorFilterType && proctorFilterType !== 'ALL') params.append('type', proctorFilterType);
      if (proctorSearch && proctorSearch.trim()) params.append('q', proctorSearch.trim());
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await fetch(`/api/admin/proctor-logs${qs}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setProctorLogs(data.logs || []);
    } catch (e) {
    } finally {
      if (manual) setIsRefreshingProctor(false);
    }
  };

  const handleResetViolations = async (userId, username) => {
    if (!window.confirm(`Reset proctor infractions to 0 for @${username}?`)) return;
    try {
      await fetch(`/api/admin/alumni/${userId}/reset-violations`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchAlumni();
      fetchProctorLogs();
    } catch (e) {
      alert(`Failed to reset infractions: ${e.message}`);
    }
  };

  const handlePurgeProctorLogs = async () => {
    if (!window.confirm('Are you sure you want to permanently clear all proctor audit logs?')) return;
    try {
      setIsClearingLogs(true);
      await fetch('/api/admin/proctor-logs', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setProctorLogs([]);
    } catch (e) {
      alert(`Failed to clear logs: ${e.message}`);
    } finally {
      setIsClearingLogs(false);
    }
  };

  const fetchNodes = async () => {
    try {
      const res = await fetch('/api/admin/nodes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setNodes(data.nodes || []);
    } catch (e) {}
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/config', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      setConfig(data.config || {});
    } catch (e) {}
  };

  useEffect(() => {
    if (token && user?.role === 'admin') {
      fetchAlumni();
      fetchProctorLogs();
      fetchNodes();
      fetchConfig();
    }
  }, [token, user, tab, searchQuery, proctorFilterType, proctorSearch]);

  // Real-time SSE listener for Proctor Violations
  useEffect(() => {
    if (!token || user?.role !== 'admin') return;

    const es = new EventSource('/api/events/stream');
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'PROCTOR_VIOLATION' && data.payload) {
          const v = data.payload;
          setProctorLogs(prev => {
            if (prev.some(l => l.id === v.id)) return prev;
            return [v, ...prev];
          });
          setAlumniList(prev => prev.map(a => {
            if (a.id === v.user_id) {
              return { ...a, tab_violations: v.totalViolations };
            }
            return a;
          }));
        }
      } catch (err) {}
    };

    return () => es.close();
  }, [token, user]);

  // CREATE: Single Alumni
  const handleEnrollSingle = async (e) => {
    e.preventDefault();
    setEnrollStatus(null);
    try {
      const res = await fetch('/api/admin/alumni', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name, batch, username, passkey, email, phone, organization })
      });
      const data = await res.json();
      if (res.ok) {
        setEnrollStatus({ type: 'success', message: data.message });
        setName('');
        setUsername('');
        setPasskey('');
        setEmail('');
        setPhone('');
        setOrganization('');
        fetchAlumni();
      } else {
        setEnrollStatus({ type: 'error', message: data.error });
      }
    } catch (err) {
      setEnrollStatus({ type: 'error', message: 'Enrollment request failed' });
    }
  };

  // CREATE: Bulk Alumni (TSV / CSV / JSON)
  const handleBulkEnroll = async (e) => {
    e.preventDefault();
    setBulkStatus(null);
    try {
      let bodyPayload = {};
      if (bulkText.trim().startsWith('[') && bulkText.trim().endsWith(']')) {
        try {
          bodyPayload = { alumniList: JSON.parse(bulkText) };
        } catch (e) {
          bodyPayload = { rawText: bulkText };
        }
      } else {
        bodyPayload = { rawText: bulkText };
      }

      const res = await fetch('/api/admin/bulk-enroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(bodyPayload)
      });
      const data = await res.json();
      if (res.ok) {
        setBulkStatus({ type: 'success', message: data.message });
        setBulkText('');
        fetchAlumni();
      } else {
        setBulkStatus({ type: 'error', message: data.error });
      }
    } catch (err) {
      setBulkStatus({ type: 'error', message: 'Bulk enrollment request failed: ' + err.message });
    }
  };

  // EXPORT Alumni Roster to CSV
  const handleExportCSV = async () => {
    try {
      const res = await fetch('/api/admin/alumni-export', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!data.alumni || data.alumni.length === 0) {
        alert('No alumni records to export.');
        return;
      }

      const headers = ['NAME', 'EMAIL', 'PHONE', 'BATCH', 'ORGANIZATION', 'USERNAME', 'PASSKEY', 'SCORE', 'STEP'];
      const rows = data.alumni.map(a => [
        `"${(a.name || '').replace(/"/g, '""')}"`,
        `"${(a.email || '').replace(/"/g, '""')}"`,
        `"${(a.phone || '').replace(/"/g, '""')}"`,
        `"${(a.batch || '').replace(/"/g, '""')}"`,
        `"${(a.organization || '').replace(/"/g, '""')}"`,
        `"${(a.username || '').replace(/"/g, '""')}"`,
        `"${(a.passkey || '').replace(/"/g, '""')}"`,
        a.score || 0,
        a.current_step || 0
      ].join(','));

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `LOGIN2026_Alumni_Roster_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert('Failed to export CSV: ' + e.message);
    }
  };

  // UPDATE: Save Alumni Edits
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingAlumni) return;

    setEditStatus(null);
    try {
      const res = await fetch(`/api/admin/alumni/${editingAlumni.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editingAlumni)
      });
      const data = await res.json();
      if (res.ok) {
        setEditingAlumni(null);
        fetchAlumni();
      } else {
        setEditStatus(data.error || 'Failed to update alumni');
      }
    } catch (e) {
      setEditStatus('Network error while saving');
    }
  };

  // RESET: Reset Alumni Progress
  const handleResetAlumni = async (id, name) => {
    if (!window.confirm(`Reset progress and score for ${name} to Step 0? A new randomized trajectory will be generated.`)) return;

    try {
      const res = await fetch(`/api/admin/alumni/${id}/reset`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchAlumni();
      }
    } catch (e) {}
  };

  // RESET: 1-Click Reset Passkey to Registered Phone
  const handleResetPasskeyToPhone = async (id, name, phone) => {
    if (!window.confirm(`Reset passkey for ${name} to registered mobile number (${phone || 'default'})?`)) return;

    try {
      const res = await fetch(`/api/admin/alumni/${id}/reset-passkey`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        alert(data.message);
        fetchAlumni();
      } else {
        alert(`Failed: ${data.error}`);
      }
    } catch (e) {
      alert(`Network error: ${e.message}`);
    }
  };

  // DELETE: Delete Alumni
  const handleDeleteAlumni = async (id) => {
    try {
      const res = await fetch(`/api/admin/alumni/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setDeletingId(null);
        fetchAlumni();
      }
    } catch (e) {}
  };

  // MANAGE: Grant Extra Time (+15m or +30m)
  const handleGrantExtraTime = async (userId, minutes, name) => {
    try {
      const res = await fetch(`/api/admin/alumni/${userId}/timer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'grant_extra_time', extraMinutes: minutes })
      });
      const data = await res.json();
      if (res.ok) {
        fetchAlumni();
      } else {
        alert(data.error || 'Failed to grant extra time');
      }
    } catch (e) {
      alert('Network error: ' + e.message);
    }
  };

  // MANAGE: Reset Session Timer
  const handleResetSessionTimer = async (userId, name) => {
    if (!window.confirm(`Reset test session timer for ${name}? Participant will be allowed to re-start the test briefing and fresh countdown.`)) return;
    try {
      const res = await fetch(`/api/admin/alumni/${userId}/timer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'reset_timer' })
      });
      const data = await res.json();
      if (res.ok) {
        fetchAlumni();
      } else {
        alert(data.error || 'Failed to reset timer');
      }
    } catch (e) {
      alert('Network error: ' + e.message);
    }
  };

  // === Node CRUD Handlers ===
  const resetNodeForm = () => {
    setFormCode('');
    setFormTitle('');
    setFormTier('foundation');
    setFormDomain('cryptography');
    setFormStory('');
    setFormClueText('');
    setFormPayload('');
    setFormAnswer('');
    setFormAliases('');
    setFormHints(['', '', '', '', '', '', '']);
    setFormPoints(1000);
    setNodeFormStatus(null);
  };

  const openCreateNodeModal = () => {
    resetNodeForm();
    setIsCreatingNode(true);
    setEditingNode(null);
  };

  const openEditNodeModal = (node) => {
    setEditingNode(node);
    setIsCreatingNode(false);
    setFormCode(node.node_code || '');
    setFormTitle(node.title || '');
    setFormTier(node.tier || 'foundation');
    setFormDomain(node.domain || 'cryptography');
    setFormStory(node.story || '');
    setFormClueText(node.clue_text || '');
    setFormPayload(node.clue_payload || '');
    setFormAnswer(node.answer || '');
    setFormAliases((node.aliases || []).join(', '));
    const h = [...(node.hints || [])];
    while (h.length < 7) h.push('');
    setFormHints(h);
    setFormPoints(node.base_points || 1000);
    setNodeFormStatus(null);
  };

  const handleSaveNode = async (e) => {
    e.preventDefault();
    setNodeFormStatus(null);

    const aliasesArr = formAliases
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    const filteredHints = formHints.filter(h => h.trim().length > 0);

    const payloadData = {
      node_code: formCode.trim().toUpperCase(),
      code: formCode.trim().toUpperCase(),
      title: formTitle.trim(),
      tier: formTier,
      domain: formDomain.trim(),
      story: formStory.trim(),
      clue_text: formClueText.trim(),
      clue_payload: formPayload.trim(),
      answer: formAnswer.trim().toLowerCase(),
      aliases: aliasesArr,
      hints: filteredHints,
      base_points: Number(formPoints) || 1000
    };

    try {
      const url = editingNode ? `/api/admin/nodes/${editingNode.id}` : '/api/admin/nodes';
      const method = editingNode ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payloadData)
      });

      const data = await res.json();
      if (res.ok) {
        setIsCreatingNode(false);
        setEditingNode(null);
        fetchNodes();
      } else {
        setNodeFormStatus({ type: 'error', message: data.error || 'Failed to save node' });
      }
    } catch (err) {
      setNodeFormStatus({ type: 'error', message: 'Network error while saving node' });
    }
  };

  const handleDeleteNode = async (id, code) => {
    if (!window.confirm(`Are you sure you want to permanently delete node [${code}]?`)) return;

    try {
      const res = await fetch(`/api/admin/nodes/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchNodes();
      }
    } catch (e) {}
  };

  const handleTestSolve = async (nodeId) => {
    if (!testAnswer.trim() || testing) return;

    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch(`/api/admin/nodes/${nodeId}/test-solve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ answer: testAnswer })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (e) {
      setTestResult({ correct: false, message: 'Network request failed' });
    } finally {
      setTesting(false);
    }
  };

  // Config controls
  const handleSetStatus = async (status) => {
    try {
      await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ event_status: status })
      });
      setConfig(prev => ({ ...prev, event_status: status }));
    } catch (e) {}
  };

  const handleToggleLeaderboard = async () => {
    const isCurrentlyVisible = config.leaderboard_visible !== 'false';
    const nextState = isCurrentlyVisible ? 'false' : 'true';
    try {
      await fetch('/api/admin/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ leaderboard_visible: nextState })
      });
      setConfig(prev => ({ ...prev, leaderboard_visible: nextState }));
    } catch (e) {
      alert(`Failed to toggle leaderboard: ${e.message}`);
    }
  };

  if (user?.role !== 'admin') {
    return (
      <div className="max-w-md mx-auto py-24 text-center">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold theme-text-primary">Admin Access Restricted</h2>
        <p className="text-xs theme-text-secondary mt-1">This area is reserved for event staff only.</p>
      </div>
    );
  }

  return (
    <div className="max-w-[1700px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Top Header */}
      <div className="theme-bg-card border theme-border p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-black theme-text-primary">
            Alumni Management & Platform Administration
          </h1>
          <p className="text-xs theme-text-muted font-mono mt-1">
            LOGIN 2026 Single-Player Event Operations • PSG Tech MCA
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Standings Visibility 1-Click Quick Toggle */}
          <button
            onClick={handleToggleLeaderboard}
            className={`px-3.5 py-2 rounded-xl text-xs font-mono font-bold flex items-center space-x-2 border transition-all cursor-pointer shadow-sm ${
              config.leaderboard_visible !== 'false'
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-300 hover:bg-emerald-500/25'
                : 'bg-amber-500/20 border-amber-500/50 text-amber-600 dark:text-amber-300 hover:bg-amber-500/30 ring-1 ring-amber-500/30'
            }`}
            title="Toggle public standings leaderboard visibility for participants"
          >
            {config.leaderboard_visible !== 'false' ? (
              <>
                <Eye className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>[ STANDINGS: PUBLIC ]</span>
              </>
            ) : (
              <>
                <EyeOff className="w-4 h-4 text-amber-500 animate-pulse flex-shrink-0" />
                <span>[ STANDINGS: FROZEN / HIDDEN ]</span>
              </>
            )}
          </button>

          {/* Event State Controls */}
          <div className="flex items-center space-x-2 theme-bg-surface p-1.5 rounded-xl border theme-border">
            <button
              onClick={() => handleSetStatus('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center space-x-1 transition-all cursor-pointer ${
                config.event_status === 'active' ? 'bg-emerald-500 text-slate-950 shadow-sm' : 'theme-text-muted'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>ACTIVE</span>
            </button>
            <button
              onClick={() => handleSetStatus('paused')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center space-x-1 transition-all cursor-pointer ${
                config.event_status === 'paused' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'theme-text-muted'
              }`}
            >
              <Pause className="w-3.5 h-3.5" />
              <span>PAUSED</span>
            </button>
            <button
              onClick={() => handleSetStatus('ended')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center space-x-1 transition-all cursor-pointer ${
                config.event_status === 'ended' ? 'bg-rose-500 text-slate-950 shadow-sm' : 'theme-text-muted'
              }`}
            >
              <Square className="w-3.5 h-3.5" />
              <span>ENDED</span>
            </button>
          </div>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex space-x-2 border-b theme-border pb-2 text-xs font-mono">
        {[
          { id: 'alumni', label: `Enrolled Alumni (${alumniList.length})`, icon: Users },
          { id: 'enroll', label: 'Enroll New Alumni', icon: UserPlus },
          { id: 'proctor', label: `Proctor Logs (${proctorLogs.length})`, icon: ShieldAlert },
          { id: 'nodes', label: `Master Node Pool (${nodes.length})`, icon: Layers },
          { id: 'config', label: 'Settings', icon: Sliders },
          { id: 'hosting', label: 'Hosting & Deployment Guide', icon: Server }
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 rounded-xl flex items-center space-x-2 font-bold transition-all ${
                tab === t.id
                  ? 'bg-amber-500 text-slate-950 shadow-sm'
                  : 'theme-text-secondary hover:theme-bg-surface'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: Enrolled Alumni Management (Full CRUD) */}
      {tab === 'alumni' && (
        <div className="space-y-4">
          
          {/* Search & Actions Bar */}
          <div className="theme-bg-card border theme-border p-4 rounded-xl flex flex-col sm:flex-row justify-between gap-3 shadow-sm">
            <div className="relative flex-1">
              <Search className="w-4 h-4 theme-text-muted absolute left-3 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search alumni by name, email, phone, organization, or batch (e.g. 19MX)..."
                className="w-full pl-9 pr-4 py-2 rounded-lg theme-bg-surface border theme-border theme-text-primary text-xs focus:outline-none focus:border-amber-500 font-mono"
              />
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleExportCSV}
                title="Download full alumni roster as CSV"
                className="px-3.5 py-2 rounded-lg border theme-border theme-text-secondary hover:theme-text-primary hover:theme-bg-surface font-bold text-xs flex items-center space-x-1.5 font-mono shadow-sm cursor-pointer whitespace-nowrap"
              >
                <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                <span>Export CSV</span>
              </button>
              <button
                onClick={() => setTab('enroll')}
                className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5 font-mono shadow-sm whitespace-nowrap cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Enroll New Alumni</span>
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="theme-bg-card border theme-border rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className="theme-bg-surface theme-text-muted border-b theme-border text-[11px] uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Alumni Operator</th>
                    <th className="py-3 px-4">Batch</th>
                    <th className="py-3 px-4">Organization</th>
                    <th className="py-3 px-4">Contact (Email / Mobile)</th>
                    <th className="py-3 px-4">Credentials</th>
                    <th className="py-3 px-4 text-center">Step</th>
                    <th className="py-3 px-4 text-center">Score</th>
                    <th className="py-3 px-4 text-center">Integrity</th>
                    <th className="py-3 px-4 text-center">Session Timer</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y theme-border font-sans">
                  {alumniList.map((al) => (
                    <tr key={al.id} className="hover:theme-bg-surface transition-colors">
                      <td className="py-3 px-4 font-bold theme-text-primary">
                        <div className="flex items-center space-x-2.5">
                          <div 
                            className="w-8 h-8 rounded-full bg-slate-800 border theme-border theme-text-muted flex items-center justify-center text-xs font-mono font-bold flex-shrink-0"
                          >
                            {al.name ? al.name[0] : 'A'}
                          </div>
                          <div>
                            <p className="leading-tight">{al.name}</p>
                            <span className={`text-[10px] font-mono font-bold ${al.password_changed ? 'text-emerald-500' : 'text-amber-500'}`}>
                              {al.password_changed ? 'Password Set' : 'Default Phone'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-cyan-300">
                        {al.batch}
                      </td>
                      <td className="py-3 px-4">
                        {al.organization ? (
                          <span className="px-2 py-0.5 rounded border theme-border theme-text-secondary bg-slate-800/40 text-[11px]">
                            {al.organization}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono">
                        {al.email && <p className="theme-text-primary">{al.email}</p>}
                        {al.phone ? (
                          <p className="text-emerald-400/90 font-bold mt-0.5">{al.phone}</p>
                        ) : (
                          !al.email && <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">
                        <p className="theme-text-secondary">@{al.username}</p>
                        <p className="text-amber-400 font-bold mt-0.5">Pass: {al.passkey}</p>
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-emerald-400">
                        Step {al.current_step} / {(() => {
                          try {
                            const p = JSON.parse(al.assigned_path_json);
                            if (Array.isArray(p) && p.length) return p.length;
                          } catch (e) {}
                          return config.path_length || 12;
                        })()}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-black text-sm text-cyan-300">
                        {al.score}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-xs">
                        {(al.tab_violations || 0) > 0 ? (
                          <button
                            onClick={() => {
                              setTab('proctor');
                              setProctorSearch(al.username);
                            }}
                            className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition-all ${
                              al.tab_violations >= 3
                                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40 hover:bg-rose-500/30 ring-1 ring-rose-500/30 animate-pulse'
                                : 'bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30'
                            }`}
                            title="Click to filter proctor telemetry for this alumnus"
                          >
                            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                            <span>{al.tab_violations} {al.tab_violations === 1 ? 'WARN' : 'WARNS'}</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-emerald-500 font-bold inline-flex items-center space-x-1">
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span>CLEAN</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-xs">
                        {al.timer_status === 'not_started' ? (
                          <div className="flex flex-col items-center space-y-1">
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800 text-slate-400 border theme-border">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>NOT STARTED</span>
                            </span>
                            <span className="text-[10px] theme-text-muted">{al.total_duration_minutes || 60}m limit</span>
                          </div>
                        ) : al.timer_status === 'active' ? (
                          <div className="flex flex-col items-center space-y-1">
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse">
                              <Clock className="w-3 h-3 text-emerald-400" />
                              <span>ACTIVE ({Math.floor(al.time_remaining_seconds / 60)}m)</span>
                            </span>
                            <div className="flex items-center space-x-1 text-[10px]">
                              <button
                                onClick={() => handleGrantExtraTime(al.id, 15, al.name)}
                                className="px-1.5 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-pointer"
                                title="Add 15 minutes to session"
                              >
                                +15m
                              </button>
                              <button
                                onClick={() => handleGrantExtraTime(al.id, 30, al.name)}
                                className="px-1.5 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 cursor-pointer"
                                title="Add 30 minutes to session"
                              >
                                +30m
                              </button>
                            </div>
                          </div>
                        ) : al.timer_status === 'expired' ? (
                          <div className="flex flex-col items-center space-y-1">
                            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/50">
                              <Clock className="w-3 h-3 text-rose-400" />
                              <span>EXPIRED</span>
                            </span>
                            <div className="flex items-center space-x-1 text-[10px]">
                              <button
                                onClick={() => handleGrantExtraTime(al.id, 15, al.name)}
                                className="px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 cursor-pointer"
                                title="Grant +15m to unlock participant"
                              >
                                +15m Unlock
                              </button>
                              <button
                                onClick={() => handleResetSessionTimer(al.id, al.name)}
                                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border theme-border cursor-pointer"
                                title="Reset timer to re-initialize test"
                              >
                                Reset
                              </button>
                            </div>
                          </div>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                            <Check className="w-3 h-3 text-cyan-300" />
                            <span>COMPLETED</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right space-x-2">
                        {(al.tab_violations || 0) > 0 && (
                          <button
                            onClick={() => handleResetViolations(al.id, al.username)}
                            className="p-1.5 rounded-lg border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 hover:border-amber-500 transition-colors cursor-pointer"
                            title="Reset proctor infractions to 0"
                          >
                            <ShieldAlert className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => setEditingAlumni(al)}
                          className="p-1.5 rounded-lg border theme-border theme-text-secondary hover:text-amber-500 hover:theme-bg-card transition-colors cursor-pointer"
                          title="Edit Alumni Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleResetPasskeyToPhone(al.id, al.name, al.phone)}
                          className="p-1.5 rounded-lg border theme-border theme-text-secondary hover:text-emerald-400 hover:theme-bg-card transition-colors cursor-pointer"
                          title="Reset Passkey to Registered Mobile Number"
                        >
                          <Key className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleResetAlumni(al.id, al.name)}
                          className="p-1.5 rounded-lg border theme-border theme-text-secondary hover:text-cyan-400 hover:theme-bg-card transition-colors cursor-pointer"
                          title="Reset Progress to Step 0"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingId(al.id)}
                          className="p-1.5 rounded-lg border theme-border theme-text-secondary hover:text-rose-500 hover:theme-bg-card transition-colors cursor-pointer"
                          title="Delete Alumni"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Edit Alumni Modal */}
      {editingAlumni && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="theme-bg-card border theme-border rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative space-y-4">
            <div className="flex justify-between items-center border-b theme-border pb-3">
              <h3 className="font-bold text-base theme-text-primary">
                Edit Alumni Profile (@{editingAlumni.username})
              </h3>
              <button onClick={() => setEditingAlumni(null)} className="theme-text-muted hover:theme-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            {editStatus && (
              <p className="text-xs text-rose-400">{editStatus}</p>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block theme-text-secondary mb-1">Full Name</label>
                <input
                  type="text"
                  value={editingAlumni.name}
                  onChange={(e) => setEditingAlumni({ ...editingAlumni, name: e.target.value })}
                  className="w-full theme-bg-surface border theme-border rounded-xl p-2.5 theme-text-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block theme-text-secondary mb-1">MCA Batch Code</label>
                  <input
                    type="text"
                    value={editingAlumni.batch || ''}
                    onChange={(e) => setEditingAlumni({ ...editingAlumni, batch: e.target.value })}
                    placeholder="e.g. 19MX"
                    className="w-full theme-bg-surface border theme-border rounded-xl p-2.5 theme-text-primary font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block theme-text-secondary mb-1">Organization / Employer</label>
                  <input
                    type="text"
                    value={editingAlumni.organization || ''}
                    onChange={(e) => setEditingAlumni({ ...editingAlumni, organization: e.target.value })}
                    placeholder="e.g. Microsoft / Google"
                    className="w-full theme-bg-surface border theme-border rounded-xl p-2.5 theme-text-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block theme-text-secondary mb-1">Email Address</label>
                  <input
                    type="email"
                    value={editingAlumni.email || ''}
                    onChange={(e) => setEditingAlumni({ ...editingAlumni, email: e.target.value })}
                    placeholder="alumni@psgtech.ac.in"
                    className="w-full theme-bg-surface border theme-border rounded-xl p-2.5 theme-text-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block theme-text-secondary mb-1">Phone / Mobile</label>
                  <input
                    type="text"
                    value={editingAlumni.phone || ''}
                    onChange={(e) => setEditingAlumni({ ...editingAlumni, phone: e.target.value })}
                    placeholder="e.g. 9876543210"
                    className="w-full theme-bg-surface border theme-border rounded-xl p-2.5 theme-text-primary font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block theme-text-secondary mb-1">Passkey</label>
                  <input
                    type="text"
                    value={editingAlumni.passkey || ''}
                    onChange={(e) => setEditingAlumni({ ...editingAlumni, passkey: e.target.value })}
                    className="w-full theme-bg-surface border theme-border rounded-xl p-2.5 theme-text-primary font-mono font-bold text-amber-400"
                    required
                  />
                </div>
                <div>
                  <label className="block theme-text-secondary mb-1">Score (PTS)</label>
                  <input
                    type="number"
                    value={editingAlumni.score ?? 0}
                    onChange={(e) => setEditingAlumni({ ...editingAlumni, score: e.target.value })}
                    className="w-full theme-bg-surface border theme-border rounded-xl p-2.5 theme-text-primary font-mono"
                  />
                </div>
                <div>
                  <label className="block theme-text-secondary mb-1">Current Step</label>
                  <input
                    type="number"
                    value={editingAlumni.current_step ?? 0}
                    onChange={(e) => setEditingAlumni({ ...editingAlumni, current_step: e.target.value })}
                    className="w-full theme-bg-surface border theme-border rounded-xl p-2.5 theme-text-primary font-mono"
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t theme-border">
                <button
                  type="button"
                  onClick={() => setEditingAlumni(null)}
                  className="px-4 py-2 rounded-xl border theme-border theme-text-secondary font-mono"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold font-mono"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="theme-bg-card border theme-border rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
            <Trash2 className="w-10 h-10 text-rose-500 mx-auto" />
            <div>
              <h3 className="font-bold text-base theme-text-primary">Delete Alumni Account</h3>
              <p className="text-xs theme-text-secondary mt-1">
                Are you sure you want to delete this alumni record? All solve submissions and progress will be permanently removed.
              </p>
            </div>
            <div className="flex space-x-2 pt-2">
              <button
                onClick={() => setDeletingId(null)}
                className="flex-1 py-2.5 rounded-xl border theme-border theme-text-secondary font-mono text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteAlumni(deletingId)}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-bold font-mono text-xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Enroll New Alumni */}
      {tab === 'enroll' && (() => {
        // Client-side parser for live preview
        const parsePreview = (text) => {
          if (!text || !text.trim()) return [];
          if (text.trim().startsWith('[') && text.trim().endsWith(']')) {
            try {
              const p = JSON.parse(text);
              if (Array.isArray(p)) {
                return p.map(x => ({
                  name: x.name || x.NAME || '',
                  email: x.email || x.EMAIL || '',
                  phone: x.phone || x.PHONE || '',
                  batch: x.batch || x.BATCH || '19MX',
                  organization: x.organization || x.ORGANIZATION || x.company || ''
                })).filter(x => x.name);
              }
            } catch (e) {}
          }
          const lines = text.trim().split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          if (lines.length === 0) return [];
          const firstLine = lines[0];
          const isTsv = firstLine.includes('\t');
          const delimiter = isTsv ? '\t' : (firstLine.includes(',') ? ',' : /\s{2,}/);
          const headerTokens = firstLine.split(delimiter).map(t => t.trim().toUpperCase());
          const hasHeader = headerTokens.some(h => ['NAME', 'EMAIL', 'PHONE', 'BATCH', 'ORGANIZATION'].includes(h));

          let nameIdx = -1, emailIdx = -1, phoneIdx = -1, batchIdx = -1, orgIdx = -1;
          if (hasHeader) {
            nameIdx = headerTokens.findIndex(h => h.includes('NAME'));
            emailIdx = headerTokens.findIndex(h => h.includes('EMAIL') || h.includes('MAIL'));
            phoneIdx = headerTokens.findIndex(h => h.includes('PHONE') || h.includes('MOBILE') || h.includes('CONTACT'));
            batchIdx = headerTokens.findIndex(h => h.includes('BATCH') || h.includes('YEAR'));
            orgIdx = headerTokens.findIndex(h => h.includes('ORGANIZATION') || h.includes('COMPANY') || h.includes('ORG'));
          }

          const startIdx = hasHeader ? 1 : 0;
          const records = [];
          for (let i = startIdx; i < lines.length; i++) {
            const parts = lines[i].split(delimiter).map(p => p.trim());
            if (parts.length === 0 || !parts.some(Boolean)) continue;
            let n = '', em = '', ph = '', bt = '', og = '';
            if (hasHeader) {
              if (nameIdx >= 0 && parts[nameIdx]) n = parts[nameIdx];
              if (emailIdx >= 0 && parts[emailIdx]) em = parts[emailIdx];
              if (phoneIdx >= 0 && parts[phoneIdx]) ph = parts[phoneIdx];
              if (batchIdx >= 0 && parts[batchIdx]) bt = parts[batchIdx];
              if (orgIdx >= 0 && parts[orgIdx]) og = parts[orgIdx];
            } else {
              n = parts[0] || '';
              em = parts[1] || '';
              ph = parts[2] || '';
              bt = parts[3] || '19MX';
              og = parts[4] || '';
            }
            if (n || em || ph) {
              records.push({ name: n, email: em, phone: ph, batch: bt || '19MX', organization: og });
            }
          }
          return records;
        };

        const previewRows = parsePreview(bulkText);

        return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Single Enrollment Form */}
            <div className="theme-bg-card border theme-border p-6 rounded-2xl shadow-sm space-y-4">
              <div>
                <div className="flex items-center space-x-2">
                  <UserPlus className="w-5 h-5 text-amber-500" />
                  <h3 className="font-bold text-base theme-text-primary">
                    Enroll Single Alumni
                  </h3>
                </div>
                <p className="text-xs theme-text-muted mt-1">
                  Provisions credentials and generates a unique anti-collusion 20-node trajectory.
                </p>
              </div>

              {enrollStatus && (
                <div className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
                  enrollStatus.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                }`}>
                  {enrollStatus.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                  <span>{enrollStatus.message}</span>
                </div>
              )}

              <form onSubmit={handleEnrollSingle} className="space-y-3.5 text-xs">
                <div>
                  <label className="block theme-text-secondary mb-1 font-medium font-mono">&gt; FULL NAME</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Kavin Kumar S"
                    required
                    className="w-full theme-bg-surface border theme-border rounded-xl p-2.5 theme-text-primary text-xs focus:outline-none focus:border-amber-500 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block theme-text-secondary mb-1 font-medium font-mono">&gt; MCA BATCH CODE</label>
                    <input
                      type="text"
                      value={batch}
                      onChange={(e) => setBatch(e.target.value)}
                      placeholder="e.g. 19MX or 20MX"
                      required
                      className="w-full theme-bg-surface border theme-border rounded-xl p-2.5 theme-text-primary text-xs focus:outline-none focus:border-amber-500 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block theme-text-secondary mb-1 font-medium font-mono">&gt; ORGANIZATION / COMPANY</label>
                    <input
                      type="text"
                      value={organization}
                      onChange={(e) => setOrganization(e.target.value)}
                      placeholder="e.g. Microsoft / Google"
                      className="w-full theme-bg-surface border theme-border rounded-xl p-2.5 theme-text-primary text-xs focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block theme-text-secondary mb-1 font-medium font-mono">&gt; EMAIL ADDRESS</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="alumni@psgtech.ac.in"
                      className="w-full theme-bg-surface border theme-border rounded-xl p-2.5 theme-text-primary text-xs focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block theme-text-secondary mb-1 font-medium font-mono">&gt; PHONE / MOBILE</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 9876543210"
                      className="w-full theme-bg-surface border theme-border rounded-xl p-2.5 theme-text-primary text-xs focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block theme-text-secondary mb-1 font-medium font-mono">
                      &gt; USERNAME (OPTIONAL)
                    </label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Auto from email/name"
                      className="w-full theme-bg-surface border theme-border rounded-xl p-2.5 theme-text-primary text-xs focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block theme-text-secondary mb-1 font-medium font-mono">
                      &gt; PASSKEY (DEFAULTS TO PHONE)
                    </label>
                    <input
                      type="text"
                      value={passkey}
                      onChange={(e) => setPasskey(e.target.value)}
                      placeholder={phone ? `Defaults to: ${phone}` : "Defaults to phone"}
                      className="w-full theme-bg-surface border theme-border rounded-xl p-2.5 theme-text-primary text-xs focus:outline-none focus:border-amber-500 font-mono"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 mt-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase font-mono tracking-wider shadow-sm transition-all cursor-pointer"
                >
                  ENROLL ALUMNI &bull; GENERATE 20-NODE TRAJECTORY
                </button>
              </form>
            </div>

            {/* Bulk Enrollment Form (Google Sheets TSV / Excel / CSV / JSON) */}
            <div className="theme-bg-card border theme-border p-6 rounded-2xl shadow-sm space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <Layers className="w-5 h-5 text-cyan-400" />
                      <h3 className="font-bold text-base theme-text-primary">
                        Bulk Enrollment (Sheets / TSV / CSV)
                      </h3>
                    </div>
                    <p className="text-xs theme-text-muted mt-1">
                      Directly copy-paste rows from Google Sheets or Excel (e.g. exported from{' '}
                      <a 
                        href="https://login.psgtech.ac.in/alumni" 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="text-cyan-400 hover:underline font-bold"
                      >
                        login.psgtech.ac.in/alumni ↗
                      </a>) with columns:
                    </p>
                    <code className="text-[11px] text-cyan-400 font-mono font-bold block mt-1">
                      NAME	EMAIL	PHONE	BATCH	ORGANIZATION
                    </code>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setBulkText("NAME\tEMAIL\tPHONE\tBATCH\tORGANIZATION\nKavin Kumar S\tkavin.s@alumni.psgtech.ac.in\t9876543210\t19MX\tMicrosoft\nPriya R\tpriya.r@alumni.psgtech.ac.in\t9876543211\t20MX\tGoogle");
                    }}
                    className="px-2.5 py-1.5 rounded-lg border theme-border theme-text-secondary hover:theme-text-primary hover:theme-bg-surface font-mono text-[10px] whitespace-nowrap cursor-pointer"
                    title="Load sample alumni registration rows"
                  >
                    LOAD SAMPLE DATA
                  </button>
                </div>

                {bulkStatus && (
                  <div className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
                    bulkStatus.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}>
                    {bulkStatus.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                    <span>{bulkStatus.message}</span>
                  </div>
                )}

                <form onSubmit={handleBulkEnroll} className="space-y-3 text-xs">
                  <textarea
                    rows={6}
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={`NAME\tEMAIL\tPHONE\tBATCH\tORGANIZATION\nKavin Kumar S\tkavin.s@alumni.psgtech.ac.in\t9876543210\t19MX\tMicrosoft\nPriya R\tpriya.r@alumni.psgtech.ac.in\t9876543211\t20MX\tGoogle`}
                    className="w-full theme-bg-surface border theme-border rounded-xl p-3 font-mono text-xs theme-text-primary focus:outline-none focus:border-amber-500 leading-relaxed select-all"
                  />

                  {/* Live Parsed Preview Table */}
                  {previewRows.length > 0 && (
                    <div className="border theme-border rounded-xl overflow-hidden text-[11px] font-mono">
                      <div className="p-2 theme-bg-surface border-b theme-border flex items-center justify-between text-xs font-bold text-cyan-300">
                        <span>PARSED PREVIEW: {previewRows.length} ALUMNI RECORD(S)</span>
                        <span className="text-[10px] text-slate-400 font-normal">Passkeys default to Mobile</span>
                      </div>
                      <div className="max-h-36 overflow-y-auto">
                        <table className="w-full text-left">
                          <thead className="theme-bg-card border-b theme-border text-[10px] theme-text-muted">
                            <tr>
                              <th className="py-1.5 px-2">#</th>
                              <th className="py-1.5 px-2">Name</th>
                              <th className="py-1.5 px-2">Batch</th>
                              <th className="py-1.5 px-2">Organization</th>
                              <th className="py-1.5 px-2">Mobile / Passkey</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y theme-border">
                            {previewRows.map((r, i) => (
                              <tr key={i} className="hover:theme-bg-surface">
                                <td className="py-1 px-2 text-slate-500">{i + 1}</td>
                                <td className="py-1 px-2 font-bold theme-text-primary">{r.name}</td>
                                <td className="py-1 px-2 text-cyan-400 font-bold">{r.batch}</td>
                                <td className="py-1 px-2 text-slate-300">{r.organization || '—'}</td>
                                <td className="py-1 px-2 text-amber-400 font-bold">{r.phone || 'psg2026'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={previewRows.length === 0 && !bulkText.trim()}
                    className="w-full py-3 rounded-xl border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 font-bold text-xs font-mono uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
                  >
                    {previewRows.length > 0
                      ? `IMPORT ${previewRows.length} ALUMNI & ASSIGN 20-NODE TRAJECTORIES`
                      : 'IMPORT BULK ALUMNI RECORDS'}
                  </button>
                </form>
              </div>
            </div>

          </div>
        );
      })()}

      {/* TAB 3: Proctor Logs */}
      {tab === 'proctor' && (() => {
        const totalLogs = proctorLogs.length;
        const fullscreenExits = proctorLogs.filter(l => l.event_type === 'FULLSCREEN_EXIT').length;
        const tabSwitches = proctorLogs.filter(l => l.event_type === 'TAB_SWITCH').length;
        const windowBlurs = proctorLogs.filter(l => l.event_type === 'WINDOW_BLUR').length;
        const devtoolsAndClips = proctorLogs.filter(l => ['DEVTOOLS_SHORTCUT', 'CLIPBOARD_PASTE_ATTEMPT', 'CLIPBOARD_COPY_ATTEMPT'].includes(l.event_type)).length;

        // Count unique users with >= 3 infractions
        const userViolationCounts = {};
        proctorLogs.forEach(l => {
          userViolationCounts[l.user_id] = (userViolationCounts[l.user_id] || 0) + 1;
        });
        const flaggedUserCount = Object.values(userViolationCounts).filter(c => c >= 3).length;

        const renderEventBadge = (eventType) => {
          switch (eventType) {
            case 'FULLSCREEN_EXIT':
              return (
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/40">
                  <Maximize className="w-3 h-3 flex-shrink-0" />
                  <span>FULLSCREEN_EXIT</span>
                </span>
              );
            case 'TAB_SWITCH':
              return (
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/40">
                  <EyeOff className="w-3 h-3 flex-shrink-0" />
                  <span>TAB_SWITCH</span>
                </span>
              );
            case 'WINDOW_BLUR':
              return (
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/40">
                  <Layers className="w-3 h-3 flex-shrink-0" />
                  <span>ALT-TAB / BLUR</span>
                </span>
              );
            case 'DEVTOOLS_SHORTCUT':
              return (
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/50">
                  <Terminal className="w-3 h-3 flex-shrink-0" />
                  <span>DEVTOOLS_ATTEMPT</span>
                </span>
              );
            case 'CLIPBOARD_PASTE_ATTEMPT':
              return (
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/40">
                  <Copy className="w-3 h-3 flex-shrink-0" />
                  <span>PASTE_BLOCKED</span>
                </span>
              );
            case 'CLIPBOARD_COPY_ATTEMPT':
              return (
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-cyan-500/15 text-cyan-400 border border-cyan-500/40">
                  <Copy className="w-3 h-3 flex-shrink-0" />
                  <span>COPY_BLOCKED</span>
                </span>
              );
            case 'MOBILE_DEVICE_BLOCKED':
              return (
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/50">
                  <Smartphone className="w-3 h-3 flex-shrink-0" />
                  <span>MOBILE_BLOCKED</span>
                </span>
              );
            case 'TEST_STARTED':
              return (
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  <Play className="w-3 h-3 flex-shrink-0" />
                  <span>TEST_STARTED</span>
                </span>
              );
            case 'TIME_EXPIRED':
              return (
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-500/25 text-rose-400 border border-rose-500/50 animate-pulse">
                  <Clock className="w-3 h-3 flex-shrink-0" />
                  <span>TIME_EXPIRED</span>
                </span>
              );
            default:
              return (
                <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-800 text-slate-300 border theme-border">
                  <AlertCircle className="w-3 h-3 flex-shrink-0" />
                  <span>{eventType}</span>
                </span>
              );
          }
        };

        const renderMetadata = (meta) => {
          if (!meta) return '—';
          let obj = meta;
          if (typeof meta === 'string') {
            try { obj = JSON.parse(meta); } catch (e) { return meta; }
          }
          if (obj.durationMinutes) return `Session started with ${obj.durationMinutes}m duration limit`;
          if (obj.message) return obj.message;
          if (obj.userAgent) return `Device Blocked: ${obj.userAgent.slice(0, 45)}...`;
          if (obj.reason) return obj.reason;
          if (obj.combo) return `Shortcut Pressed: ${obj.combo}`;
          if (obj.target) return `Field: ${obj.target}`;
          if (obj.detail) return obj.detail;
          return JSON.stringify(obj);
        };

        return (
          <div className="space-y-6">
            
            {/* Proctor Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono">
              <div className="p-4 rounded-2xl theme-bg-card border theme-border shadow-sm space-y-1">
                <span className="text-[10px] theme-text-muted uppercase tracking-wider block">Total Infractions</span>
                <span className="text-2xl font-black theme-text-primary">{totalLogs}</span>
              </div>
              <div className="p-4 rounded-2xl theme-bg-card border border-rose-500/30 shadow-sm space-y-1">
                <span className="text-[10px] text-rose-400 uppercase tracking-wider block">Fullscreen Exits</span>
                <span className="text-2xl font-black text-rose-400">{fullscreenExits}</span>
              </div>
              <div className="p-4 rounded-2xl theme-bg-card border border-amber-500/30 shadow-sm space-y-1">
                <span className="text-[10px] text-amber-400 uppercase tracking-wider block">Tab Switches</span>
                <span className="text-2xl font-black text-amber-400">{tabSwitches}</span>
              </div>
              <div className="p-4 rounded-2xl theme-bg-card border border-purple-500/30 shadow-sm space-y-1">
                <span className="text-[10px] text-purple-400 uppercase tracking-wider block">Alt-Tab / Blur</span>
                <span className="text-2xl font-black text-purple-400">{windowBlurs}</span>
              </div>
              <div className="p-4 rounded-2xl theme-bg-card border border-cyan-500/30 shadow-sm space-y-1">
                <span className="text-[10px] text-cyan-400 uppercase tracking-wider block">DevTools &amp; Pastes</span>
                <span className="text-2xl font-black text-cyan-400">{devtoolsAndClips}</span>
              </div>
              <div className="p-4 rounded-2xl theme-bg-card border border-rose-500/40 shadow-sm space-y-1 bg-rose-500/5">
                <span className="text-[10px] text-rose-400 uppercase tracking-wider block">Flagged Users (&ge;3)</span>
                <span className="text-2xl font-black text-rose-400">{flaggedUserCount}</span>
              </div>
            </div>

            {/* Toolbar: Search, Filters & Actions */}
            <div className="theme-bg-card border theme-border p-4 rounded-2xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-sm font-mono text-xs">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 theme-text-muted absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={proctorSearch}
                  onChange={(e) => setProctorSearch(e.target.value)}
                  placeholder="Filter logs by alumni name, handle, or batch..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl theme-bg-surface border theme-border theme-text-primary text-xs focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <div className="flex items-center space-x-2">
                  <Filter className="w-4 h-4 theme-text-muted" />
                  <select
                    value={proctorFilterType}
                    onChange={(e) => setProctorFilterType(e.target.value)}
                    className="px-3 py-2.5 rounded-xl theme-bg-surface border theme-border theme-text-primary text-xs font-mono font-bold focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="ALL">ALL EVENT TYPES ({totalLogs})</option>
                    <option value="FULLSCREEN_EXIT">FULLSCREEN_EXIT</option>
                    <option value="TAB_SWITCH">TAB_SWITCH</option>
                    <option value="WINDOW_BLUR">WINDOW_BLUR (ALT-TAB)</option>
                    <option value="DEVTOOLS_SHORTCUT">DEVTOOLS_SHORTCUT</option>
                    <option value="CLIPBOARD_PASTE_ATTEMPT">CLIPBOARD_PASTE_ATTEMPT</option>
                    <option value="CLIPBOARD_COPY_ATTEMPT">CLIPBOARD_COPY_ATTEMPT</option>
                    <option value="MOBILE_DEVICE_BLOCKED">MOBILE_DEVICE_BLOCKED</option>
                    <option value="TEST_STARTED">TEST_STARTED</option>
                    <option value="TIME_EXPIRED">TIME_EXPIRED</option>
                  </select>
                </div>

                <button
                  onClick={() => fetchProctorLogs(true)}
                  className="px-3.5 py-2.5 rounded-xl border theme-border theme-text-primary hover:theme-bg-surface transition-all flex items-center space-x-1.5 cursor-pointer font-bold"
                  title="Force refresh proctor telemetry"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingProctor ? 'animate-spin text-amber-500' : ''}`} />
                  <span>[ REFRESH ]</span>
                </button>

                <button
                  onClick={handlePurgeProctorLogs}
                  disabled={isClearingLogs || proctorLogs.length === 0}
                  className="px-3.5 py-2.5 rounded-xl border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 transition-all flex items-center space-x-1.5 cursor-pointer font-bold disabled:opacity-50"
                  title="Permanently clear all proctor audit logs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>[ CLEAR AUDIT TRAIL ]</span>
                </button>
              </div>
            </div>

            {/* Proctor Logs Table */}
            <div className="theme-bg-card border theme-border rounded-2xl overflow-hidden shadow-sm">
              <div className="p-4 theme-bg-surface border-b theme-border flex items-center justify-between text-xs font-mono">
                <div className="flex items-center space-x-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="font-bold theme-text-primary uppercase tracking-wider">
                    LIVE PROCTOR TELEMETRY AUDIT TRAIL
                  </span>
                  <span className="theme-text-muted hidden sm:inline">&bull; Real-time SSE streaming active</span>
                </div>
                <span className="theme-text-muted">
                  Showing {proctorLogs.length} events
                </span>
              </div>

              <div className="overflow-x-auto max-h-[600px]">
                {proctorLogs.length === 0 ? (
                  <div className="p-12 text-center text-xs font-mono theme-text-muted space-y-2">
                    <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto" />
                    <p>No proctor infractions recorded. Clean telemetry across all participants.</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs font-mono">
                    <thead className="theme-bg-surface theme-text-muted border-b theme-border sticky top-0 uppercase tracking-wider text-[11px] font-bold">
                      <tr>
                        <th className="py-3 px-4">Timestamp</th>
                        <th className="py-3 px-4">Alumni Operator</th>
                        <th className="py-3 px-4">Batch</th>
                        <th className="py-3 px-4 text-center">Step</th>
                        <th className="py-3 px-4">Infraction Type</th>
                        <th className="py-3 px-4">Telemetry Description</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y theme-border">
                      {proctorLogs.map((log) => (
                        <tr key={log.id} className="hover:theme-bg-surface transition-colors">
                          <td className="py-3 px-4 theme-text-muted whitespace-nowrap">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </td>
                          <td className="py-3 px-4 font-bold theme-text-primary">
                            <div>
                              <p className="leading-tight">{log.name}</p>
                              <span className="text-[11px] text-cyan-500 font-normal">@{log.username}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 theme-text-secondary font-mono font-bold">
                            {log.batch}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-amber-500">
                            #{log.step_index + 1}
                          </td>
                          <td className="py-3 px-4 whitespace-nowrap">
                            {renderEventBadge(log.event_type)}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] theme-text-secondary max-w-xs truncate">
                            {renderMetadata(log.metadata)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={() => handleResetViolations(log.user_id, log.username)}
                              className="px-2.5 py-1 rounded-lg border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap"
                              title="Pardon and reset proctor infractions for this alumnus"
                            >
                              [ RESET WARNS ]
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

          </div>
        );
      })()}

      {/* TAB 4: Master Node Pool CRUD Management */}
      {tab === 'nodes' && (
        <div className="space-y-6">
          {/* Top Node Management Bar */}
          <div className="theme-bg-card border theme-border p-5 rounded-2xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <Layers className="w-5 h-5 text-amber-500" />
                <h3 className="font-bold text-base theme-text-primary font-mono">
                  MASTER CHALLENGE NODE LIBRARY ({nodes.length} TOTAL)
                </h3>
              </div>
              <p className="text-xs theme-text-muted font-mono mt-0.5">
                Full CRUD control, progressive hint configuration, and live solution verification.
              </p>
            </div>

            <button
              onClick={openCreateNodeModal}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs font-mono uppercase tracking-wider shadow-sm transition-all flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>CREATE NEW NODE</span>
            </button>
          </div>

          {/* Filter & Search Bar */}
          <div className="theme-bg-card border theme-border p-4 rounded-xl flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-amber-500 absolute left-3.5 top-3.5" />
              <input
                type="text"
                value={nodeSearch}
                onChange={(e) => setNodeSearch(e.target.value)}
                placeholder="Search nodes by code, title, domain, or answer..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl theme-bg-surface border theme-border theme-text-primary text-xs font-mono focus:outline-none focus:border-amber-500 shadow-inner"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-amber-500" />
              <select
                value={nodeTierFilter}
                onChange={(e) => setNodeTierFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl theme-bg-surface border theme-border theme-text-primary text-xs focus:outline-none focus:border-amber-500 font-mono shadow-inner"
              >
                <option value="ALL">ALL TIERS</option>
                <option value="foundation">FOUNDATION</option>
                <option value="lateral">LATERAL</option>
                <option value="verbal">VERBAL</option>
                <option value="sleuth">SLEUTH / OSINT</option>
                <option value="intermediate">INTERMEDIATE</option>
                <option value="advanced">ADVANCED</option>
                <option value="grandmaster">GRANDMASTER</option>
              </select>
            </div>
          </div>

          {/* Node Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {nodes
              .filter((n) => {
                const q = nodeSearch.toLowerCase();
                const matchesQuery = 
                  (n.node_code || '').toLowerCase().includes(q) ||
                  (n.title || '').toLowerCase().includes(q) ||
                  (n.domain || '').toLowerCase().includes(q) ||
                  (n.answer || '').toLowerCase().includes(q);
                const matchesTier = nodeTierFilter === 'ALL' || n.tier === nodeTierFilter;
                return matchesQuery && matchesTier;
              })
              .map((n) => {
                const isTesting = testNodeId === n.id;
                const isHintsOpen = activeHintsAccordion === n.id;

                return (
                  <div key={n.id} className="theme-bg-card border border-cyan-500/25 p-5 rounded-2xl shadow-sm space-y-3 flex flex-col justify-between hover:border-cyan-500/50 transition-colors">
                    <div className="space-y-2.5">
                      {/* Top Badges */}
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                          {n.node_code}
                        </span>
                        <span className="text-[10px] font-mono uppercase theme-bg-surface px-2 py-0.5 rounded border theme-border theme-text-muted">
                          {n.tier} • {n.domain}
                        </span>
                      </div>

                      {/* Title & Lore */}
                      <div>
                        <h4 className="font-bold text-sm theme-text-primary font-mono">{n.title}</h4>
                        {n.story && (
                          <p className="text-[11px] theme-text-muted italic line-clamp-1 mt-0.5 font-sans">
                            "{n.story}"
                          </p>
                        )}
                      </div>

                      {/* Clue Text Preview */}
                      <p className="text-xs theme-text-secondary line-clamp-3 leading-relaxed font-sans">
                        {n.clue_text}
                      </p>

                      {/* Payload snippet if exists */}
                      {n.clue_payload && (
                        <div className="bg-slate-950 p-2.5 rounded-lg border border-cyan-500/20 font-mono text-[11px] text-cyan-300 max-h-20 overflow-y-auto leading-tight">
                          <code>{n.clue_payload}</code>
                        </div>
                      )}

                      {/* Answer & Aliases Info */}
                      <div className="theme-bg-surface p-3 rounded-xl font-mono text-xs space-y-1.5 border theme-border">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] theme-text-muted">CANONICAL:</span>
                          <span className="text-emerald-400 font-bold">"{n.answer}"</span>
                        </div>
                        {n.aliases?.length > 1 && (
                          <div className="text-[10px] theme-text-muted flex flex-wrap gap-1">
                            <span>ALIASES:</span>
                            {n.aliases.slice(0, 3).map((al, idx) => (
                              <span key={idx} className="bg-slate-900 px-1 rounded text-cyan-400">
                                {al}
                              </span>
                            ))}
                          </div>
                        )}
                        <div className="flex justify-between items-center text-[10px] theme-text-muted pt-1 border-t theme-border">
                          <span>{n.hints?.length || 7} Progressive Clues</span>
                          <button
                            type="button"
                            onClick={() => setActiveHintsAccordion(isHintsOpen ? null : n.id)}
                            className="text-cyan-400 hover:underline font-bold"
                          >
                            {isHintsOpen ? 'Hide Hints ▲' : 'View Hints ▼'}
                          </button>
                        </div>
                      </div>

                      {/* Expandable Hints */}
                      {isHintsOpen && (
                        <div className="p-2.5 theme-bg-surface rounded-xl border border-cyan-500/20 text-[11px] font-mono space-y-1 max-h-40 overflow-y-auto">
                          {(n.hints || []).map((h, hIdx) => (
                            <div key={hIdx} className="theme-text-secondary">
                              <span className="text-cyan-400 font-bold">H{hIdx + 1}: </span>
                              <span>{h}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Actions Toolbar */}
                    <div className="space-y-2 pt-3 border-t theme-border">
                      {/* Test Solve Box */}
                      {isTesting ? (
                        <div className="p-2.5 rounded-xl bg-slate-950 border border-cyan-500/40 space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-mono text-cyan-400 font-bold">
                            <span>&gt;_ TEST SOLVE</span>
                            <button
                              onClick={() => { setTestNodeId(null); setTestResult(null); }}
                              className="text-slate-400 hover:text-white"
                            >
                              ✕
                            </button>
                          </div>
                          <div className="flex space-x-1.5">
                            <input
                              type="text"
                              value={testAnswer}
                              onChange={(e) => setTestAnswer(e.target.value)}
                              placeholder="Test an answer..."
                              className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-cyan-500/30 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                              onKeyDown={(e) => e.key === 'Enter' && handleTestSolve(n.id)}
                            />
                            <button
                              onClick={() => handleTestSolve(n.id)}
                              disabled={testing || !testAnswer.trim()}
                              className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold font-mono text-xs uppercase"
                            >
                              {testing ? '...' : 'Verify'}
                            </button>
                          </div>
                          {testResult && (
                            <div className={`p-2 rounded text-[11px] font-mono ${
                              testResult.correct ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                            }`}>
                              {testResult.message}
                            </div>
                          )}
                        </div>
                      ) : null}

                      {/* Card Action Buttons */}
                      <div className="flex items-center space-x-1.5">
                        <button
                          onClick={() => openEditNodeModal(n)}
                          className="flex-1 py-1.5 rounded-lg border theme-border theme-bg-surface hover:theme-bg-card theme-text-primary text-xs font-mono font-bold flex items-center justify-center space-x-1 transition-colors"
                        >
                          <Edit2 className="w-3 h-3 text-cyan-400" />
                          <span>EDIT</span>
                        </button>
                        <button
                          onClick={() => {
                            setTestNodeId(isTesting ? null : n.id);
                            setTestAnswer('');
                            setTestResult(null);
                          }}
                          className="flex-1 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-mono font-bold flex items-center justify-center space-x-1 transition-colors"
                        >
                          <Terminal className="w-3 h-3" />
                          <span>TEST</span>
                        </button>
                        <button
                          onClick={() => handleDeleteNode(n.id, n.node_code)}
                          className="p-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors"
                          title="Delete node"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Create / Edit Node Modal Drawer */}
          {(isCreatingNode || editingNode) && (
            <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
              <div className="theme-bg-card border border-cyan-500/40 shadow-[0_0_30px_rgba(0,240,255,0.2)] rounded-2xl max-w-3xl w-full p-6 sm:p-8 relative my-8 max-h-[90vh] overflow-y-auto">
                <button
                  onClick={() => { setIsCreatingNode(false); setEditingNode(null); }}
                  className="absolute top-5 right-5 p-1.5 rounded-lg text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>

                <h3 className="text-lg font-bold font-mono theme-text-primary uppercase tracking-wider mb-1">
                  {editingNode ? `[ EDIT NODE: ${editingNode.node_code} ]` : '[ CREATE NEW CHALLENGE NODE ]'}
                </h3>
                <p className="text-xs theme-text-muted font-mono mb-5">
                  Configure puzzle parameters, answer aliases, and progressive 7-stage hints.
                </p>

                {nodeFormStatus && (
                  <div className="p-3 mb-4 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-400 text-xs font-mono">
                    {nodeFormStatus.message}
                  </div>
                )}

                <form onSubmit={handleSaveNode} className="space-y-4 text-xs font-mono">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block theme-text-secondary mb-1">&gt; NODE CODE</label>
                      <input
                        type="text"
                        value={formCode}
                        onChange={(e) => setFormCode(e.target.value)}
                        placeholder="e.g. NODE_NT_29"
                        required
                        className="w-full theme-bg-surface border theme-border rounded-xl p-3 theme-text-primary text-xs focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="block theme-text-secondary mb-1">&gt; TITLE</label>
                      <input
                        type="text"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        placeholder="e.g. The Cryptographic Enigma"
                        required
                        className="w-full theme-bg-surface border theme-border rounded-xl p-3 theme-text-primary text-xs focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block theme-text-secondary mb-1">&gt; TIER</label>
                      <select
                        value={formTier}
                        onChange={(e) => setFormTier(e.target.value)}
                        className="w-full theme-bg-surface border theme-border rounded-xl p-3 theme-text-primary text-xs focus:outline-none focus:border-cyan-400 font-mono"
                      >
                        <option value="foundation">Foundation</option>
                        <option value="lateral">Lateral Thinking</option>
                        <option value="verbal">Verbal / Anagram</option>
                        <option value="sleuth">Sleuth / OSINT</option>
                        <option value="intermediate">Intermediate</option>
                        <option value="advanced">Advanced</option>
                        <option value="grandmaster">Grandmaster</option>
                      </select>
                    </div>
                    <div>
                      <label className="block theme-text-secondary mb-1">&gt; DOMAIN</label>
                      <input
                        type="text"
                        value={formDomain}
                        onChange={(e) => setFormDomain(e.target.value)}
                        placeholder="e.g. cryptography"
                        required
                        className="w-full theme-bg-surface border theme-border rounded-xl p-3 theme-text-primary text-xs focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="block theme-text-secondary mb-1">&gt; BASE POINTS</label>
                      <input
                        type="number"
                        value={formPoints}
                        onChange={(e) => setFormPoints(e.target.value)}
                        required
                        className="w-full theme-bg-surface border theme-border rounded-xl p-3 theme-text-primary text-xs focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block theme-text-secondary mb-1">&gt; NARRATIVE STORY LORE</label>
                    <input
                      type="text"
                      value={formStory}
                      onChange={(e) => setFormStory(e.target.value)}
                      placeholder="Atmospheric campus lore context..."
                      className="w-full theme-bg-surface border theme-border rounded-xl p-3 theme-text-primary text-xs focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block theme-text-secondary mb-1">&gt; CLUE TEXT / QUESTION</label>
                    <textarea
                      rows={3}
                      value={formClueText}
                      onChange={(e) => setFormClueText(e.target.value)}
                      placeholder="The main puzzle statement and instructions..."
                      required
                      className="w-full theme-bg-surface border theme-border rounded-xl p-3 theme-text-primary text-xs focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div>
                    <label className="block theme-text-secondary mb-1">&gt; PAYLOAD (CODE / CIPHER / DATA)</label>
                    <textarea
                      rows={3}
                      value={formPayload}
                      onChange={(e) => setFormPayload(e.target.value)}
                      placeholder="Optional code snippet, ASCII grid, or raw hex payload..."
                      className="w-full theme-bg-surface border theme-border rounded-xl p-3 theme-text-primary text-xs focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block theme-text-secondary mb-1">&gt; CANONICAL ANSWER</label>
                      <input
                        type="text"
                        value={formAnswer}
                        onChange={(e) => setFormAnswer(e.target.value)}
                        placeholder="e.g. enigma"
                        required
                        className="w-full theme-bg-surface border theme-border rounded-xl p-3 theme-text-primary text-xs focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="block theme-text-secondary mb-1">&gt; ACCEPTED ALIASES (COMMA-SEPARATED)</label>
                      <input
                        type="text"
                        value={formAliases}
                        onChange={(e) => setFormAliases(e.target.value)}
                        placeholder="e.g. enigma, the enigma, engima"
                        className="w-full theme-bg-surface border theme-border rounded-xl p-3 theme-text-primary text-xs focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </div>

                  {/* Progressive Hints 1-7 */}
                  <div className="space-y-2 pt-2 border-t theme-border">
                    <label className="block theme-text-secondary font-bold">
                      &gt; PROGRESSIVE 7-STAGE HINTS (H1 to H7)
                    </label>
                    <div className="grid grid-cols-1 gap-2">
                      {formHints.map((hint, idx) => (
                        <div key={idx} className="flex items-center space-x-2">
                          <span className="w-8 text-[11px] theme-text-muted font-bold text-right">
                            H{idx + 1}:
                          </span>
                          <input
                            type="text"
                            value={hint}
                            onChange={(e) => {
                              const newHints = [...formHints];
                              newHints[idx] = e.target.value;
                              setFormHints(newHints);
                            }}
                            placeholder={`Progressive clue for Stage ${idx + 1}...`}
                            className="flex-1 theme-bg-surface border theme-border rounded-lg p-2 text-xs theme-text-primary focus:outline-none focus:border-cyan-400"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex space-x-3 pt-3">
                    <button
                      type="submit"
                      className="flex-1 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition-all"
                    >
                      {editingNode ? '[ SAVE NODE CHANGES ]' : '[ DEPLOY NEW NODE ]'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsCreatingNode(false); setEditingNode(null); }}
                      className="px-6 py-3 rounded-xl border theme-border theme-text-secondary hover:theme-text-primary text-xs"
                    >
                      CANCEL
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: Settings */}
      {tab === 'config' && (
        <div className="space-y-6 max-w-4xl">
          <div className="theme-bg-card border theme-border p-6 rounded-2xl shadow-sm space-y-5">
            <h3 className="font-bold text-base theme-text-primary font-mono uppercase tracking-wider">Event Parameters</h3>
            <div className="space-y-4 text-xs font-mono">
              <div>
                <label className="block theme-text-secondary mb-2">&gt; TRAJECTORY NODES COUNT PER ALUMNI</label>
                <div className="flex flex-wrap gap-3">
                  {[10, 12, 20].map(num => (
                    <button
                      key={num}
                      onClick={() => {
                        fetch('/api/admin/config', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                          body: JSON.stringify({ path_length: num })
                        });
                        setConfig(prev => ({ ...prev, path_length: String(num) }));
                      }}
                      className={`px-5 py-2.5 rounded-xl border font-mono font-bold transition-all cursor-pointer ${
                        (config.path_length || '12') === String(num)
                          ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm'
                          : 'theme-bg-surface theme-border theme-text-secondary hover:theme-text-primary'
                      }`}
                    >
                      {num} NODES {num === 12 && '★ (OFFICIAL 1-HR SPRINT)'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t theme-border pt-3">
                <label className="block theme-text-secondary mb-1">&gt; EVENT WINDOW: 11TH AUG 2026 – 17TH AUG 2026</label>
                <p className="theme-text-muted text-[11px] leading-relaxed">
                  Official 7-day competition schedule. Sliding-window rate limit (5 attempts / 60s) active with sub-millisecond tie breaking. Leaderboard cached in-memory.
                </p>
              </div>
            </div>
          </div>

          {/* Timed Session & Countdown Configuration */}
          <div className="theme-bg-card border theme-border p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-cyan-400" />
              <h3 className="font-bold text-base theme-text-primary font-mono uppercase tracking-wider">
                Test Session Time Limit &amp; Integrity Controls
              </h3>
            </div>
            <p className="text-xs theme-text-muted font-mono">
              Participants receive a single timed session during the 7-day competition window (11th Aug – 17th Aug 2026). Once initiated on their desktop/laptop, the server counts down continuously regardless of closing the tab or reloading.
            </p>

            <div className="space-y-3 pt-2 font-mono text-xs">
              <label className="block theme-text-secondary font-bold">
                &gt; DEFAULT TEST DURATION PER PARTICIPANT:
              </label>
              <div className="flex flex-wrap gap-3">
                {[60, 90, 120, 150, 180].map(mins => (
                  <button
                    key={mins}
                    onClick={async () => {
                      await fetch('/api/admin/config', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                        body: JSON.stringify({ test_duration_minutes: mins })
                      });
                      setConfig(prev => ({ ...prev, test_duration_minutes: String(mins) }));
                    }}
                    className={`px-5 py-2.5 rounded-xl border font-mono font-bold transition-all cursor-pointer ${
                      (config.test_duration_minutes || '60') === String(mins)
                        ? 'bg-cyan-500 text-slate-950 border-cyan-500 shadow-sm'
                        : 'theme-bg-surface theme-border theme-text-secondary hover:theme-text-primary'
                    }`}
                  >
                    {mins} MINS {mins === 60 && '★ (RECOMMENDED 1-HR SPRINT)'}
                  </button>
                ))}
              </div>
              <div className="p-3.5 rounded-xl theme-bg-surface border theme-border text-[11px] theme-text-muted space-y-1">
                <p>&bull; <strong className="text-cyan-400">Current Setting:</strong> {config.test_duration_minutes || 60} minutes ({((parseInt(config.test_duration_minutes || 60, 10)) / 60).toFixed(1)} hours) per participant.</p>
                <p>&bull; <strong className="text-amber-400">Individual Override:</strong> You can grant +15m or +30m extra time to any participant individually from the Alumni Roster tab.</p>
                <p>&bull; <strong className="text-emerald-400">Anti-Phone Rule:</strong> Submissions and hint unlocks are hard-locked on the server once the countdown expires.</p>
              </div>
            </div>
          </div>

          {/* Standings Leaderboard Visibility & Freeze Control */}
          <div className="theme-bg-card border theme-border p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  {config.leaderboard_visible !== 'false' ? (
                    <Eye className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <EyeOff className="w-5 h-5 text-amber-500 animate-pulse" />
                  )}
                  <h3 className="font-bold text-base theme-text-primary">
                    Public Standings &amp; Leaderboard Visibility
                  </h3>
                </div>
                <p className="text-xs theme-text-muted mt-1 font-mono">
                  Freeze or hide live alumni rankings and telemetry from public view (e.g., during final competition hours for suspense).
                </p>
              </div>

              <button
                onClick={handleToggleLeaderboard}
                className={`px-5 py-2.5 rounded-xl font-mono text-xs font-bold uppercase transition-all cursor-pointer shadow-sm flex items-center space-x-2 ${
                  config.leaderboard_visible !== 'false'
                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                }`}
              >
                {config.leaderboard_visible !== 'false' ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    <span>[ FREEZE / HIDE STANDINGS ]</span>
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    <span>[ UNFREEZE / PUBLISH STANDINGS ]</span>
                  </>
                )}
              </button>
            </div>

            <div className="p-3.5 rounded-xl theme-bg-surface border theme-border text-xs font-mono theme-text-secondary leading-relaxed space-y-1.5">
              <div className="flex items-center space-x-2 font-bold">
                <span className="theme-text-primary">CURRENT VISIBILITY STATE:</span>
                {config.leaderboard_visible !== 'false' ? (
                  <span className="text-emerald-500 flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>PUBLIC (Live to all participants &amp; auditorium displays)</span>
                  </span>
                ) : (
                  <span className="text-amber-500 flex items-center space-x-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                    <span>FROZEN / HIDDEN (Masked for participants; admins retain live preview)</span>
                  </span>
                )}
              </div>
              <p className="theme-text-muted text-[11px]">
                &gt; When hidden, participants receive an empty standings list and holding banner. All background telemetry, solves, and scores continue recording uninterrupted.
              </p>
            </div>
          </div>

          {/* Game Master Passkey Management */}
          <div className="theme-bg-card border theme-border p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <Key className="w-5 h-5 text-amber-500" />
                  <h3 className="font-bold text-base theme-text-primary">
                    Game Master Secret Passkey &amp; Access Control
                  </h3>
                </div>
                <p className="text-xs theme-text-muted mt-1 font-mono">
                  Rotate your Game Master login passkey. Setting a custom key immediately revokes login2026admin.
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {config.isEnvAdminKeySet ? (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    LOCKED BY ENV (ADMIN_KEY)
                  </span>
                ) : config.hasCustomAdminKey ? (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                    CUSTOM KEY ACTIVE &bull; login2026admin REVOKED
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    DEFAULT KEY IN USE &bull; ROTATE RECOMMENDED
                  </span>
                )}
              </div>
            </div>

            {adminKeyStatus && (
              <div className={`p-3.5 rounded-xl text-xs flex items-center space-x-2 font-mono ${
                adminKeyStatus.type === 'success' 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' 
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
              }`}>
                {adminKeyStatus.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                <span>{adminKeyStatus.message}</span>
              </div>
            )}

            {config.isEnvAdminKeySet ? (
              <p className="text-xs font-mono theme-text-secondary bg-slate-900/60 p-3.5 rounded-xl border theme-border leading-relaxed">
                &gt; Your Admin Key is currently controlled by the <code className="text-amber-400 font-bold">ADMIN_KEY</code> environment variable in your deployment platform (e.g. Render). To change it, update the variable in Render Dashboard &rarr; Environment. The default login2026admin is strictly blocked.
              </p>
            ) : (
              <form onSubmit={handleChangeAdminKey} className="flex flex-col sm:flex-row gap-3 pt-1">
                <div className="flex-1">
                  <input
                    type="text"
                    value={newAdminKeyInput}
                    onChange={(e) => setNewAdminKeyInput(e.target.value)}
                    placeholder="Enter new custom Game Master key (min 6 chars)"
                    required
                    className="w-full theme-bg-surface border theme-border rounded-xl p-3 theme-text-primary text-xs focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
                <button
                  type="submit"
                  disabled={adminKeyLoading}
                  className="px-6 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase font-mono tracking-wider shadow-sm transition-all cursor-pointer whitespace-nowrap disabled:opacity-50"
                >
                  {adminKeyLoading ? '[ UPDATING... ]' : '[ ROTATE_ADMIN_KEY ]'}
                </button>
              </form>
            )}
          </div>

          {/* Theme Matrix in Settings */}
          <div className="theme-bg-card border theme-border p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base theme-text-primary font-mono uppercase tracking-wider flex items-center space-x-2">
                  <Palette className="w-4 h-4 text-cyan-400" />
                  <span>Terminal Display Matrix &bull; Theme Grid</span>
                </h3>
                <p className="text-xs font-mono theme-text-secondary mt-1">
                  Active Display Theme: <span className="text-cyan-400 font-bold">{themes.find(t => t.id === theme)?.name}</span> &bull; Click to switch live
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
              {themes.map(t => {
                const isSelected = theme === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    className={`p-3 rounded-xl border-2 text-left font-mono transition-all cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'border-cyan-400 theme-bg-surface shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                        : 'theme-border hover:border-slate-500 theme-bg-card'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="w-3.5 h-3.5 rounded-full border border-slate-500" style={{ backgroundColor: t.color }} />
                        <div>
                          <p className="text-xs font-bold theme-text-primary">{t.name}</p>
                          <p className="text-[9px] text-slate-400">{t.tag}</p>
                        </div>
                      </div>
                      {isSelected && <span className="text-[10px] font-bold text-cyan-400">[ACTIVE]</span>}
                    </div>

                    <div className="flex items-center space-x-1.5 pt-2 border-t theme-border">
                      <span className="w-3 h-3 rounded-full border border-black/50" style={{ backgroundColor: t.color }} />
                      <span className="w-3 h-3 rounded-full border border-black/50" style={{ backgroundColor: t.bg }} />
                      <span className="w-3 h-3 rounded-full border border-black/50" style={{ backgroundColor: t.cardBg }} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: Hosting & Deployment Guide */}
      {tab === 'hosting' && (
        <div className="space-y-6 max-w-5xl font-mono">
          
          {/* Overview Header */}
          <div className="theme-bg-card border-2 theme-border p-6 rounded-2xl shadow-sm">
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 rounded-xl theme-bg-surface border theme-border">
                  <Server className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold theme-text-primary">
                    [ INFRASTRUCTURE // HOSTING & DEPLOYMENT RUNBOOK ]
                  </h2>
                  <p className="text-xs theme-text-secondary mt-1">
                    PSG College of Technology &bull; Unified Single-Port Architecture &bull; 500+ Concurrent Players
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                PORT 3001 &bull; WAL ACTIVE
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 pt-5 border-t theme-border text-xs">
              <div className="theme-bg-surface p-3.5 rounded-xl border theme-border">
                <p className="theme-text-muted text-[10px] uppercase font-bold">Unified Fullstack</p>
                <p className="theme-text-primary font-bold mt-0.5">Express + Vite in 1 Process</p>
                <p className="text-[10px] theme-text-secondary mt-1">Statically serves dist/ on same port</p>
              </div>
              <div className="theme-bg-surface p-3.5 rounded-xl border theme-border">
                <p className="theme-text-muted text-[10px] uppercase font-bold">Zero Native Setup</p>
                <p className="theme-text-primary font-bold mt-0.5">Native node:sqlite</p>
                <p className="text-[10px] theme-text-secondary mt-1">No postgres/redis daemon needed</p>
              </div>
              <div className="theme-bg-surface p-3.5 rounded-xl border theme-border">
                <p className="theme-text-muted text-[10px] uppercase font-bold">Live Hot Backups</p>
                <p className="theme-text-primary font-bold mt-0.5">SQLite .backup API</p>
                <p className="text-[10px] theme-text-secondary mt-1">Zero downtime during live hunt</p>
              </div>
            </div>
          </div>

          {/* Deployment Method 1: Docker Compose */}
          <div className="theme-bg-card border theme-border p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">METHOD 1</span>
                <h3 className="font-bold text-sm theme-text-primary">1-Command Docker Compose Deployment (Recommended)</h3>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText("git clone <repo-url> nethunt && cd nethunt\ncp .env.example .env\ndocker compose up -d --build");
                  setCopiedSnippet('docker');
                  setTimeout(() => setCopiedSnippet(null), 2000);
                }}
                className="px-2.5 py-1 rounded text-xs border theme-border theme-text-secondary hover:theme-text-primary flex items-center space-x-1 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedSnippet === 'docker' ? 'COPIED!' : 'COPY'}</span>
              </button>
            </div>

            <p className="text-xs theme-text-secondary leading-relaxed">
              Uses the included <code className="text-cyan-400">Dockerfile</code> and <code className="text-cyan-400">docker-compose.yml</code> with a persistent volume for <code className="text-cyan-400">server/data/nethunt.db</code>.
            </p>

            <pre className="p-4 rounded-xl terminal-payload-box text-xs overflow-x-auto select-all">
{`# 1. Clone repository to your server
git clone <repo-url> nethunt && cd nethunt

# 2. Copy environment template
cp .env.example .env

# 3. Build & start container in background
docker compose up -d --build

# 4. Check real-time logs & health
docker compose ps
docker logs -f login2026_nethunt`}
            </pre>
          </div>

          {/* Deployment Method 2: Linux VPS / On-Premise */}
          <div className="theme-bg-card border theme-border p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">METHOD 2</span>
                <h3 className="font-bold text-sm theme-text-primary">Linux VPS / PSG Tech Server (Node 22 + PM2 + Nginx)</h3>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText("curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -\nsudo apt install -y nodejs git\nsudo corepack enable\npnpm install\npnpm run build\nsudo npm install -g pm2\npm2 start server/index.js --name login2026-nethunt\npm2 save\npm2 startup");
                  setCopiedSnippet('pm2');
                  setTimeout(() => setCopiedSnippet(null), 2000);
                }}
                className="px-2.5 py-1 rounded text-xs border theme-border theme-text-secondary hover:theme-text-primary flex items-center space-x-1 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedSnippet === 'pm2' ? 'COPIED!' : 'COPY'}</span>
              </button>
            </div>

            <p className="text-xs theme-text-secondary leading-relaxed">
              For Ubuntu 22.04 / 24.04 on AWS EC2, DigitalOcean, Hetzner, or PSG Tech campus server hardware.
            </p>

            <pre className="p-4 rounded-xl terminal-payload-box text-xs overflow-x-auto select-all">
{`# 1. Install Node.js 22 LTS & pnpm
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git
sudo corepack enable && sudo corepack prepare pnpm@latest --activate

# 2. Clone repository, install & build
git clone <repo-url> nethunt && cd nethunt
pnpm install
pnpm run build

# 3. Start 24/7 background process with PM2
sudo npm install -g pm2
pm2 start server/index.js --name "login2026-nethunt"
pm2 save && pm2 startup`}
            </pre>

            {/* Nginx SSL guide snippet */}
            <div className="mt-3 pt-3 border-t theme-border">
              <p className="text-xs font-bold theme-text-primary mb-2">&gt; Nginx Reverse Proxy &amp; Free Let's Encrypt SSL</p>
              <pre className="p-4 rounded-xl terminal-payload-box text-xs overflow-x-auto select-all">
{`# /etc/nginx/sites-available/nethunt
server {
    listen 80;
    server_name nethunt.psglogin.in;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Enable & issue HTTPS certificate
sudo ln -s /etc/nginx/sites-available/nethunt /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d nethunt.psglogin.in`}
              </pre>
            </div>
          </div>

          {/* Deployment Method 3: Campus LAN & Hot Backups */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="theme-bg-card border theme-border p-5 rounded-2xl shadow-sm space-y-3">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">OFFLINE</span>
                <h4 className="font-bold text-xs theme-text-primary">PSG Tech Campus LAN / Lab Intranet</h4>
              </div>
              <p className="text-[11px] theme-text-secondary leading-relaxed">
                Connect the host PC to campus Wi-Fi or lab ethernet. Find the machine's local IP via <code className="text-cyan-400">ipconfig</code> / <code className="text-cyan-400">hostname -I</code> (e.g. <code className="text-cyan-400">10.1.20.45</code>) and start the server:
              </p>
              <pre className="p-3 rounded-lg terminal-payload-box text-[11px] overflow-x-auto">
{`pnpm run build
node server/index.js
# Alumni connect to: http://10.1.20.45:3001`}
              </pre>
            </div>

            <div className="theme-bg-card border theme-border p-5 rounded-2xl shadow-sm space-y-3">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">HOT BACKUPS</span>
                <h4 className="font-bold text-xs theme-text-primary">Live Database Backups During Event</h4>
              </div>
              <p className="text-[11px] theme-text-secondary leading-relaxed">
                Take snapshot backups while participants are submitting answers with zero locks or service interruption:
              </p>
              <pre className="p-3 rounded-lg terminal-payload-box text-[11px] overflow-x-auto">
{`sqlite3 server/data/nethunt.db \\
  ".backup 'server/data/backup_$(date +%s).db'"`}
              </pre>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
