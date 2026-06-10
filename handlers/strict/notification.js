'use strict';


module.exports = {
  on: 'Notification',
  match: (event) => {
    const ntype = event.notification_type || '';
    return ntype === 'idle_prompt' || ntype === 'permission_prompt';
  },
  priority: 10,
  profile: ['minimal', 'standard', 'strict'],

  async run(event, ctx) {
    const ntype = event.notification_type || '';
    if (ntype === 'idle_prompt') {
      ctx.sink.fire('/api/hook/idle');
    } else if (ntype === 'permission_prompt') {
      ctx.sink.fire('/api/hook/permission');
    }
    return { exitCode: 0 };
  },
};
