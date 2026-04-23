// In-memory session store for multi-step login conversations.
// Each user gets one session object that tracks the current step.

const sessions = new Map();

export function getSession(userId) {
  return sessions.get(userId.toString()) || null;
}

export function setSession(userId, data) {
  sessions.set(userId.toString(), data);
}

export function clearSession(userId) {
  sessions.delete(userId.toString());
}
