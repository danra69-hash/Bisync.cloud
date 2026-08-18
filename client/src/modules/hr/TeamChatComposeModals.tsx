import { useMemo, useState } from 'react';
import { FolderKanban, MessageSquare, Search, Users, X } from 'lucide-react';
import type { TeamChatDirectoryPerson, TeamChatProjectTaskInput } from './teamChatTypes';

export type ChatComposeMode = 'menu' | 'direct' | 'group' | 'project';

type Props = {
  mode: ChatComposeMode;
  employeeId: number;
  directory: TeamChatDirectoryPerson[];
  dirLoading: boolean;
  onClose: () => void;
  onModeChange: (mode: ChatComposeMode) => void;
  onStartDirect: (peer: TeamChatDirectoryPerson) => void;
  onStartGroup: (title: string, memberIds: number[]) => Promise<void>;
  onStartProject: (input: {
    name: string;
    startDate: string;
    targetCompletionDate: string;
    memberEmployeeIds: number[];
    tasks: TeamChatProjectTaskInput[];
  }) => Promise<void>;
};

function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function emptyTask(): { key: string; title: string; assigneeEmployeeIds: number[] } {
  return { key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, title: '', assigneeEmployeeIds: [] };
}

export function TeamChatComposeModals({
  mode,
  employeeId,
  directory,
  dirLoading,
  onClose,
  onModeChange,
  onStartDirect,
  onStartGroup,
  onStartProject,
}: Props) {
  const [dirSearch, setDirSearch] = useState('');
  const [groupTitle, setGroupTitle] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [projectName, setProjectName] = useState('');
  const [startDate, setStartDate] = useState(todayIso);
  const [targetDate, setTargetDate] = useState(todayIso);
  const [tasks, setTasks] = useState(() => [emptyTask()]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const others = useMemo(
    () => directory.filter(p => p.id !== employeeId),
    [directory, employeeId],
  );

  const filteredDirectory = useMemo(() => {
    const q = dirSearch.trim().toLowerCase();
    if (!q) return others;
    return others.filter(p =>
      p.name.toLowerCase().includes(q)
      || p.department?.toLowerCase().includes(q)
      || p.position?.toLowerCase().includes(q)
      || p.email?.toLowerCase().includes(q),
    );
  }, [others, dirSearch]);

  const selectedPeople = useMemo(
    () => others.filter(p => selectedIds.includes(p.id)),
    [others, selectedIds],
  );

  function toggleMember(id: number) {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  }

  function toggleTaskAssignee(taskKey: string, employeeIdToToggle: number) {
    setTasks(prev => prev.map(task => {
      if (task.key !== taskKey) return task;
      const has = task.assigneeEmployeeIds.includes(employeeIdToToggle);
      return {
        ...task,
        assigneeEmployeeIds: has
          ? task.assigneeEmployeeIds.filter(id => id !== employeeIdToToggle)
          : [...task.assigneeEmployeeIds, employeeIdToToggle],
      };
    }));
  }

  async function submitGroup() {
    setFormError(null);
    const title = groupTitle.trim();
    if (!title) {
      setFormError('Enter a group name.');
      return;
    }
    if (selectedIds.length === 0) {
      setFormError('Select at least one person.');
      return;
    }
    setSubmitting(true);
    try {
      await onStartGroup(title, selectedIds);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to create group.');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitProject() {
    setFormError(null);
    const name = projectName.trim();
    if (!name) {
      setFormError('Enter a project name.');
      return;
    }
    if (!startDate || !targetDate) {
      setFormError('Start date and target completion date are required.');
      return;
    }
    if (targetDate < startDate) {
      setFormError('Target completion must be on or after the start date.');
      return;
    }
    const cleanedTasks = tasks
      .map(t => ({
        title: t.title.trim(),
        assigneeEmployeeIds: t.assigneeEmployeeIds,
      }))
      .filter(t => t.title.length > 0);
    if (cleanedTasks.length === 0) {
      setFormError('Add at least one task.');
      return;
    }
    const tagged = new Set<number>();
    for (const task of cleanedTasks) {
      for (const id of task.assigneeEmployeeIds) tagged.add(id);
    }
    for (const id of selectedIds) tagged.add(id);

    setSubmitting(true);
    try {
      await onStartProject({
        name,
        startDate,
        targetCompletionDate: targetDate,
        memberEmployeeIds: [...tagged],
        tasks: cleanedTasks,
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to create project.');
    } finally {
      setSubmitting(false);
    }
  }

  const completedPreview = tasks.filter(t => t.title.trim()).length;
  const progressPreview = completedPreview === 0 ? 0 : 0;

  return (
    <div className="team-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className={`team-modal team-chat-directory${mode === 'project' ? ' is-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0 }}>
            {mode === 'menu' && 'New'}
            {mode === 'direct' && 'New message'}
            {mode === 'group' && 'Group chat'}
            {mode === 'project' && 'New project'}
          </h3>
          <button type="button" className="team-btn-ghost" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {mode === 'menu' ? (
          <div className="team-chat-compose-menu">
            <button type="button" className="team-chat-compose-option" onClick={() => onModeChange('direct')}>
              <MessageSquare size={16} />
              <span>
                <strong>Direct message</strong>
                <em>Chat with one person</em>
              </span>
            </button>
            <button type="button" className="team-chat-compose-option" onClick={() => onModeChange('group')}>
              <Users size={16} />
              <span>
                <strong>Group chat</strong>
                <em>Add multiple users</em>
              </span>
            </button>
            <button type="button" className="team-chat-compose-option" onClick={() => onModeChange('project')}>
              <FolderKanban size={16} />
              <span>
                <strong>Project</strong>
                <em>Name, dates, tasks, and tagged users</em>
              </span>
            </button>
          </div>
        ) : null}

        {mode === 'direct' ? (
          <>
            <button type="button" className="team-btn-ghost team-chat-back-link" onClick={() => onModeChange('menu')}>
              ← Back
            </button>
            <p className="team-muted" style={{ margin: '0 0 8px' }}>Company address book</p>
            <div className="team-chat-search">
              <Search size={14} />
              <input
                value={dirSearch}
                onChange={e => setDirSearch(e.target.value)}
                placeholder="Search people"
                autoFocus
              />
            </div>
            {dirLoading ? <p className="team-muted">Loading…</p> : null}
            <ul className="team-chat-directory-list">
              {filteredDirectory.map(person => (
                <li key={person.id}>
                  <button type="button" className="team-chat-row" onClick={() => onStartDirect(person)}>
                    <span className="team-chat-avatar">{person.name.slice(0, 1).toUpperCase()}</span>
                    <span className="team-chat-row-copy">
                      <strong>{person.name}</strong>
                      <em>{[person.position, person.department].filter(Boolean).join(' · ') || person.email}</em>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {!dirLoading && filteredDirectory.length === 0 ? (
              <p className="team-muted" style={{ textAlign: 'center' }}>No colleagues found.</p>
            ) : null}
          </>
        ) : null}

        {mode === 'group' ? (
          <>
            <button type="button" className="team-btn-ghost team-chat-back-link" onClick={() => onModeChange('menu')}>
              ← Back
            </button>
            <label className="team-chat-field">
              <span>Group name</span>
              <input
                value={groupTitle}
                onChange={e => setGroupTitle(e.target.value)}
                placeholder="e.g. Kitchen ops"
                autoFocus
              />
            </label>
            <p className="team-muted" style={{ margin: '8px 0 4px' }}>
              Members ({selectedIds.length} selected)
            </p>
            <div className="team-chat-search">
              <Search size={14} />
              <input
                value={dirSearch}
                onChange={e => setDirSearch(e.target.value)}
                placeholder="Search people"
              />
            </div>
            {dirLoading ? <p className="team-muted">Loading…</p> : null}
            <ul className="team-chat-directory-list">
              {filteredDirectory.map(person => {
                const selected = selectedIds.includes(person.id);
                return (
                  <li key={person.id}>
                    <button
                      type="button"
                      className={`team-chat-row${selected ? ' is-selected' : ''}`}
                      onClick={() => toggleMember(person.id)}
                      aria-pressed={selected}
                    >
                      <span className="team-chat-check" aria-hidden>{selected ? '✓' : ''}</span>
                      <span className="team-chat-avatar">{person.name.slice(0, 1).toUpperCase()}</span>
                      <span className="team-chat-row-copy">
                        <strong>{person.name}</strong>
                        <em>{[person.position, person.department].filter(Boolean).join(' · ') || person.email}</em>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            {formError ? <p className="team-inline-error">{formError}</p> : null}
            <div className="team-chat-compose-actions">
              <button type="button" className="team-btn team-btn-primary" disabled={submitting} onClick={() => void submitGroup()}>
                {submitting ? 'Creating…' : 'Create group'}
              </button>
            </div>
          </>
        ) : null}

        {mode === 'project' ? (
          <>
            <button type="button" className="team-btn-ghost team-chat-back-link" onClick={() => onModeChange('menu')}>
              ← Back
            </button>
            <div className="team-chat-project-form">
              <label className="team-chat-field">
                <span>Name of the Project</span>
                <input
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  placeholder="Project name"
                  autoFocus
                />
              </label>
              <div className="team-chat-project-dates">
                <label className="team-chat-field">
                  <span>Start date</span>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </label>
                <label className="team-chat-field">
                  <span>Target Completion Date</span>
                  <input type="date" value={targetDate} onChange={e => setTargetDate(e.target.value)} />
                </label>
              </div>

              <div className="team-chat-progress-block">
                <div className="team-chat-progress-label">
                  <span>Progress Task Bar</span>
                  <strong>0 / {completedPreview || 0}</strong>
                </div>
                <div className="team-chat-progress-track" aria-hidden>
                  <div className="team-chat-progress-fill" style={{ width: `${progressPreview}%` }} />
                </div>
                <p className="team-muted" style={{ margin: '4px 0 0', fontSize: 11 }}>
                  Updates as tasks are marked complete after creation.
                </p>
              </div>

              <div className="team-chat-project-tasks">
                <div className="team-chat-project-tasks-head">
                  <strong>List of Task</strong>
                  <button
                    type="button"
                    className="team-btn-ghost"
                    onClick={() => setTasks(prev => [...prev, emptyTask()])}
                  >
                    + Add task
                  </button>
                </div>
                {tasks.map((task, index) => (
                  <div key={task.key} className="team-chat-project-task-card">
                    <div className="team-chat-project-task-title-row">
                      <label className="team-chat-field" style={{ flex: 1 }}>
                        <span>Task {index + 1}</span>
                        <input
                          value={task.title}
                          onChange={e => {
                            const value = e.target.value;
                            setTasks(prev => prev.map(t => (t.key === task.key ? { ...t, title: value } : t)));
                          }}
                          placeholder="Task description"
                        />
                      </label>
                      {tasks.length > 1 ? (
                        <button
                          type="button"
                          className="team-btn-ghost"
                          aria-label="Remove task"
                          onClick={() => setTasks(prev => prev.filter(t => t.key !== task.key))}
                        >
                          <X size={14} />
                        </button>
                      ) : null}
                    </div>
                    <p className="team-muted" style={{ margin: '6px 0 4px', fontSize: 11 }}>Tag users involved</p>
                    <div className="team-chat-tag-list">
                      {others.map(person => {
                        const tagged = task.assigneeEmployeeIds.includes(person.id);
                        return (
                          <button
                            key={person.id}
                            type="button"
                            className={`team-chat-tag${tagged ? ' is-on' : ''}`}
                            onClick={() => toggleTaskAssignee(task.key, person.id)}
                            aria-pressed={tagged}
                          >
                            {person.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <p className="team-muted" style={{ margin: '8px 0 4px' }}>
                  Also assign to project ({selectedPeople.length} selected)
                </p>
                <div className="team-chat-search">
                  <Search size={14} />
                  <input
                    value={dirSearch}
                    onChange={e => setDirSearch(e.target.value)}
                    placeholder="Search people to assign"
                  />
                </div>
                <ul className="team-chat-directory-list team-chat-directory-list-compact">
                  {filteredDirectory.map(person => {
                    const selected = selectedIds.includes(person.id);
                    return (
                      <li key={person.id}>
                        <button
                          type="button"
                          className={`team-chat-row${selected ? ' is-selected' : ''}`}
                          onClick={() => toggleMember(person.id)}
                          aria-pressed={selected}
                        >
                          <span className="team-chat-check" aria-hidden>{selected ? '✓' : ''}</span>
                          <span className="team-chat-avatar">{person.name.slice(0, 1).toUpperCase()}</span>
                          <span className="team-chat-row-copy">
                            <strong>{person.name}</strong>
                            <em>{[person.position, person.department].filter(Boolean).join(' · ') || person.email}</em>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
            {formError ? <p className="team-inline-error">{formError}</p> : null}
            <div className="team-chat-compose-actions">
              <button type="button" className="team-btn team-btn-primary" disabled={submitting || dirLoading} onClick={() => void submitProject()}>
                {submitting ? 'Creating…' : 'Create project'}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
