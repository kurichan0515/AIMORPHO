import api from './client';

export const getDailyAdvice = () =>
  api.get('/ai/daily-advice').then(r => r.data);

export const sendPenaltyAnswer = (answer: 'YES' | 'NO') =>
  api.post('/ai/penalty-event', { answer }).then(r => r.data);

export const getGoalMessage = () =>
  api.get('/ai/goal-message').then(r => r.data);
