import type { BotState } from '../bot/types.ts';

interface BotControlsProps {
  botState: BotState;
  onStop: () => void;
}

function trainingProgress(state: BotState): string {
  const ts = state.trainingState;
  if (!ts) return '';
  const levelStr = ts.targetLevel
    ? `Lv.${ts.currentLevel}→${ts.targetLevel}`
    : `Lv.${ts.currentLevel}`;
  return `${levelStr} | ${ts.battlesWon} battles won`;
}

function statusText(state: BotState): string {
  if (state.mode === 'train') {
    switch (state.status) {
      case 'WALKING':
        return `Training ${trainingProgress(state)} — searching...`;
      case 'BATTLE_ENTERING':
        return 'Battle starting...';
      case 'SWITCHING':
        return 'Switching to KO\'er...';
      case 'ATTACKING':
        return 'Attacking wild Pokemon...';
      case 'PAUSED':
        return `Paused: ${state.pauseReason ?? 'unknown reason'}`;
      case 'DONE':
        return `Training complete! ${trainingProgress(state)}`;
      case 'ERROR':
        return `Error: ${state.error}`;
      default:
        return '';
    }
  }

  switch (state.status) {
    case 'WALKING':
      return `Searching for ${state.targetName}... (${state.encounterCount} encounters)`;
    case 'BATTLE_ENTERING':
      return 'Battle starting...';
    case 'RUNNING':
      return `Running from wrong Pokemon... (${state.encounterCount} encounters)`;
    case 'WAITING_FOR_DECISION':
      return `Found ${state.targetName}! Waiting for action...`;
    case 'EXECUTING_ACTION':
      return 'Executing action...';
    case 'DONE':
      return `Caught ${state.targetName} after ${state.encounterCount} encounters!`;
    case 'ERROR':
      return `Error: ${state.error}`;
    default:
      return '';
  }
}

export function BotControls({ botState, onStop }: BotControlsProps) {
  if (botState.status === 'IDLE') return null;

  const isDone = botState.status === 'DONE' || botState.status === 'ERROR';

  return (
    <div className="bot-controls" data-bot-status={botState.status}>
      <span className="bot-status-text">{statusText(botState)}</span>
      {!isDone && (
        <button className="toolbar-btn bot-stop-btn" onClick={onStop} title="Stop bot">
          Stop
        </button>
      )}
    </div>
  );
}
