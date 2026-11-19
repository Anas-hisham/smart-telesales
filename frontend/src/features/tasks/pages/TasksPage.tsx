import { CheckCircle2, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CreateTaskModal } from '@/features/tasks/components/CreateTaskModal';
import { TaskCard } from '@/features/tasks/components/TaskCard';
import { createTask, markTasksSeen, toggleTaskCompletion } from '@/features/tasks/thunks/tasks.thunks';
import type { Task } from '@/features/tasks/types/tasks.types';
import { DoneSection } from '@/shared/components/DoneSection';
import { Pagination } from '@/shared/components/Pagination';
import { usePagination } from '@/shared/hooks/usePagination';
import { useStore } from '@/store/hooks';

const TASKS_PER_PAGE = 5;

export function TasksPage() {
  const { state, dispatch } = useStore();
  const currentUser = state.users.find(user => user.id === state.currentUserId)!;
  const [showCreate, setShowCreate] = useState(false);

  // Opening this page is what clears the number in the menu
  const hasUnseen = state.tasks.some(task => !task.seenBy.includes(currentUser.id));
  useEffect(() => { if (hasUnseen) dispatch(markTasksSeen(currentUser.id)); }, [hasUnseen, currentUser.id, dispatch]);

  const canCreate = currentUser.role === 'team_leader' || currentUser.role === 'operation_manager';
  const myTeam = state.teams.find(team => team.id === currentUser.teamId);

  const relevantTasks = state.tasks.filter(task => {
    if (currentUser.role === 'operation_manager') return task.authorId === currentUser.id || task.assignedTo.includes(currentUser.id);
    if (currentUser.role === 'team_leader') return task.assignedTo.includes(currentUser.id) || (task.authorId === currentUser.id);
    if (currentUser.role === 'agent' || currentUser.role === 'quality') return task.assignedTo.includes(currentUser.id);
    return false;
  });

  // "done" = I finished it (assignee) or everyone I assigned it to finished it (author)
  const isDone = (task: Task) => task.assignedTo.includes(currentUser.id)
    ? task.completedBy.includes(currentUser.id)
    : task.assignedTo.length > 0 && task.assignedTo.every(id => task.completedBy.includes(id));
  const pendingTasks = relevantTasks.filter(relevantTask => !isDone(relevantTask)).sort((relevantTaskA, relevantTaskB) => relevantTaskA.deadline.localeCompare(relevantTaskB.deadline));   // closest deadline first
  const doneTasks = relevantTasks.filter(isDone).sort((relevantTaskA, relevantTaskB) => relevantTaskB.deadline.localeCompare(relevantTaskA.deadline));               // latest first
  const pending = usePagination(pendingTasks, TASKS_PER_PAGE);
  const done = usePagination(doneTasks, TASKS_PER_PAGE);
  const renderTask = (task: Task) => (
    <TaskCard key={task.id} task={task} currentUser={currentUser} users={state.users}
      onToggle={() => dispatch(toggleTaskCompletion({ taskId: task.id, userId: currentUser.id }))} />
  );

  const assignees = currentUser.role === 'operation_manager'
    ? state.users.filter(user => (user.role === 'quality' && user.lob === currentUser.lob) || (user.role === 'team_leader' && state.teams.some(team => team.leaderId === user.id && team.managerId === currentUser.id)))   // my team leaders + Quality
    : state.users.filter(user => myTeam?.agentIds.includes(user.id));

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Tasks</h2>
          <p className="text-sm text-slate-600">
            {currentUser.role === 'agent' || currentUser.role === 'quality' ? 'Your assigned tasks' :
             currentUser.role === 'operation_manager' ? 'Assign tasks to team leaders and Quality' :
             'Assign tasks to your team agents'}
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            New Task
          </button>
        )}
      </div>

      {relevantTasks.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No tasks yet</p>
        </div>
      )}

      {/* Not done yet: always on top */}
      {relevantTasks.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-800 mb-3">
            To do <span className="ml-1 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">{pending.total}</span>
          </h3>
          {pending.total === 0 ? (
            <p className="text-sm text-slate-500 bg-white rounded-xl border border-dashed border-slate-200 px-5 py-6 text-center">Nothing left to do. 🎉</p>
          ) : (
            <div className="space-y-4">
              {pending.pageItems.map(task => renderTask(task))}
            </div>
          )}
          <Pagination {...pending} onPage={pending.setPage} />
        </section>
      )}

      {/* Already done: closed until the user opens it */}
      <DoneSection title="Completed" count={done.total}>
        <div className="space-y-4">
          {done.pageItems.map(task => renderTask(task))}
        </div>
        <Pagination {...done} onPage={done.setPage} />
      </DoneSection>

      {showCreate && (
        <CreateTaskModal
          currentUser={currentUser}
          assignees={assignees}
          onClose={() => setShowCreate(false)}
          onCreate={(task) => {
            dispatch(createTask(task));
            setShowCreate(false);
          }}
        />
      )}
    </div>
  );
}
