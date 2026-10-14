export function syncMode(state, module, periodicEnabled, ready, changing = false) {
  if (!ready || changing) return 'checking';
  if (state?.enabled && state[module]) return 'push';
  return periodicEnabled ? 'periodic' : 'off';
}
