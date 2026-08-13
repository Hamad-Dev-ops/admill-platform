// Manual Jest mock — matches .env.example so env.ts's zod parse succeeds
// under test without a native module being present.
module.exports = {
  API_BASE_URL: 'http://10.0.2.2:5000/api/v1',
  SOCKET_URL: 'http://10.0.2.2:5000',
};
