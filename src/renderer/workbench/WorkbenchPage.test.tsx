// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it } from 'vitest'
import { render, screen, cleanup, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { AppProvider } from '../app/AppProvider'
import { WorkbenchPage } from './WorkbenchPage'
import { emptyState } from '../../main/storage/types'
import type { PusherApi, Scope, TokenRecord, SendInput, SendReceipt } from '../../shared/contracts'
import { scopeKey } from '../../shared/scope'
import '@testing-library/jest-dom/vitest'
afterEach(cleanup)
function setup(
  listTokens: (scope: Scope) => Promise<any> = async () => ({ ok: true, value: [] }),
  customize: (state: ReturnType<typeof emptyState>) => void = () => {},
) {
  const s = emptyState()
  s.config.android.test = { packageName: 'com.example', credentialId: 'fcm' }
  s.config.android.production = { ...s.config.android.test }
  customize(s)
  window.pusher = {
    bootstrap: async () => ({
      ok: true,
      value: {
        ...s,
        credentialSummaries: [
          { id: 'fcm', kind: 'fcm', fileName: 'fcm.json', projectId: 'test-project', importedAt: 'now' },
        ],
      },
    }),
    listTokens,
    saveDraft: async () => ({ ok: true, value: undefined }),
    selectToken: async () => ({ ok: true, value: undefined }),
    onBeforeClose: () => () => {},
    onSendUpdate: () => () => {},
  } as unknown as PusherApi
  render(
    <AppProvider>
      <RouterProvider router={createMemoryRouter([{ path: '/', element: <WorkbenchPage /> }])} />
    </AppProvider>,
  )
}
it('默认测试环境、发送依赖 token，高级参数默认折叠', async () => {
  setup()
  await screen.findByLabelText('设备 token')
  expect(screen.getByLabelText('推送环境')).toHaveValue('test')
  expect(screen.getByRole('button', { name: '发送推送' })).toBeDisabled()
  expect(screen.getByText('高级参数').closest('details')).not.toHaveAttribute('open')
  await userEvent.type(screen.getByLabelText('设备 token'), 'device-token')
  await waitFor(() => expect(screen.getByRole('button', { name: '发送推送' })).toBeEnabled())
})
const testScope: Scope = {
  platform: 'android',
  environment: 'test',
  packageName: 'com.example',
  projectId: 'test-project',
}
const productionScope: Scope = { ...testScope, environment: 'production' }
function device(id: string, scope: Scope): TokenRecord {
  return { id, scope, token: `token-${id}`, note: `设备 ${id}`, createdAt: 'now', lastUsedAt: 'now' }
}
function accepted(input: SendInput): SendReceipt {
  return {
    snapshot: {
      id: 'request',
      scope: input.scope,
      token: input.token,
      configRevision: input.configRevision,
      startedAt: '2026-10-22T00:00:00Z',
      request: { method: 'POST', url: 'https://example.test', headers: {}, body: {}, estimatedBytes: 0 },
    },
    status: 'accepted',
    elapsedMs: 1,
    persisted: true,
  }
}
it('测试请求结束后不能把旧 token 列表放到生产环境', async () => {
  let finish!: () => void
  let oldList: ((value: any) => void) | undefined
  let testLoads = 0
  setup(async (scope) => {
    if (scope.environment === 'production') return { ok: true, value: [device('生产', productionScope)] }
    if (++testLoads === 1) return { ok: true, value: [device('测试', testScope)] }
    return new Promise((resolve) => {
      oldList = resolve
    })
  })
  window.pusher.send = (input) =>
    new Promise((resolve) => {
      finish = () => resolve({ ok: true, value: accepted(input) })
    })
  await userEvent.type(await screen.findByLabelText('设备 token'), 'sending-token')
  await userEvent.click(screen.getByRole('button', { name: '发送推送' }))
  await userEvent.selectOptions(screen.getByLabelText('推送环境'), 'production')
  await userEvent.click(screen.getByRole('button', { name: '选择已保存设备' }))
  await screen.findByRole('button', { name: /^设备 生产/ })
  await act(async () => {
    finish()
  })
  if (oldList)
    await act(async () => {
      oldList!({ ok: true, value: [device('测试', testScope)] })
    })
  expect(screen.queryByRole('button', { name: /^设备 测试/ })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^设备 生产/ })).toBeInTheDocument()
})
it('当前会话改选设备后切换环境再返回，恢复最新选择', async () => {
  setup(
    async (scope) => ({
      ok: true,
      value: scope.environment === 'test' ? [device('A', testScope), device('B', testScope)] : [],
    }),
    (s) => {
      s.selections[scopeKey(testScope)] = 'A'
    },
  )
  await waitFor(() => expect(screen.getByLabelText('设备 token')).toHaveValue('token-A'))
  await userEvent.click(screen.getByRole('button', { name: '选择已保存设备' }))
  await userEvent.click(screen.getByRole('button', { name: /^设备 B/ }))
  await userEvent.selectOptions(screen.getByLabelText('推送环境'), 'production')
  await userEvent.selectOptions(screen.getByLabelText('推送环境'), 'test')
  await waitFor(() => expect(screen.getByLabelText('设备 token')).toHaveValue('token-B'))
})
it('标题正文编辑同步到请求预览，切换平台保留各自内容', async () => {
  setup()
  const title = await screen.findByLabelText('消息标题')
  await userEvent.clear(title)
  await userEvent.type(title, 'Android 标题')
  expect(screen.getByLabelText('请求预览')).toHaveTextContent('Android 标题')
  await userEvent.click(screen.getByRole('button', { name: 'iOS' }))
  expect(screen.getByLabelText('消息标题')).not.toHaveValue('Android 标题')
  await userEvent.click(screen.getByRole('button', { name: 'Android' }))
  expect(screen.getByLabelText('消息标题')).toHaveValue('Android 标题')
})
it('较慢的设备历史响应不能清除用户刚输入的 token', async () => {
  let release!: (result: any) => void
  setup(() => new Promise((resolve) => (release = resolve)))
  const token = await screen.findByLabelText('设备 token')
  await userEvent.type(token, 'just-pasted-token')
  await act(async () => {
    release({ ok: true, value: [] })
  })
  expect(token).toHaveValue('just-pasted-token')
})
