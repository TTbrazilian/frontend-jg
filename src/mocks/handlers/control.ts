import { http } from 'msw'
import { api } from '../config'
import { guard, json, param, readBody } from '../lib/respond'
import * as control from '../services/control'

/** Endpoints de controle da simulação: sempre ativos (inclusive offline) e sem latência. */
export const controlHandlers = [
  http.get(api('/__mock/state'), () => guard(() => json(control.getState()))),

  http.post(api('/__mock/scenario'), ({ request }) =>
    guard(async () => json(control.setScenario((await readBody(request)).scenario))),
  ),

  http.post(api('/__mock/reset'), () => guard(async () => json(await control.reset()))),

  http.post(api('/__mock/latency'), ({ request }) => guard(async () => json(control.setLatency((await readBody(request)).latencyMs)))),

  http.post(api('/__mock/order-resolution'), ({ request }) =>
    guard(async () => json(control.setOrderResolution((await readBody(request)).ms))),
  ),

  http.post(api('/__mock/nft-update'), ({ request }) => guard(async () => json(control.nftUpdate(await readBody(request))))),

  http.post(api('/__mock/emit-duplicate'), ({ request }) =>
    guard(async () => json({ event: control.emitDuplicate((await readBody(request)).eventId) })),
  ),

  http.post(api('/__mock/emit-stale'), ({ request }) =>
    guard(async () => json({ event: control.emitStale((await readBody(request)).nftId) })),
  ),

  http.post(api('/__mock/socket/disconnect'), () => guard(() => json(control.disconnectSockets()))),

  http.post(api('/__mock/sessions/expire'), () => guard(() => json(control.expireSessions()))),

  http.post(api('/__mock/orders/:id/resolve'), ({ request, params }) =>
    guard(async () => json(control.resolveOrderManually(param(params, 'id'), (await readBody(request)).status))),
  ),
]
