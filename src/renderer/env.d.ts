import type { PusherApi } from '../shared/contracts'
declare global { interface Window { pusher: PusherApi } }
