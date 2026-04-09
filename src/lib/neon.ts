import { createClient } from '@neondatabase/neon-js';
import { BetterAuthReactAdapter } from '@neondatabase/neon-js/auth/react/adapters';

const NEON_AUTH_URL = import.meta.env.VITE_NEON_AUTH_URL as string;
const NEON_DATA_API_URL = import.meta.env.VITE_NEON_DATA_API_URL as string;

export const neon = createClient({
  auth: {
    url: NEON_AUTH_URL,
    adapter: BetterAuthReactAdapter(),
  },
  dataApi: {
    url: NEON_DATA_API_URL,
  },
});

export const authClient = neon.auth;
