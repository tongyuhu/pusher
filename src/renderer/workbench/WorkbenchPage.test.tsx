// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it } from 'vitest'
import { render, screen, cleanup, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { AppProvider } from '../app/AppProvider'
import { WorkbenchPage } from './WorkbenchPage'
import { emptyState } from '../../main/storage/types'
import type { PusherApi } from '../../shared/contracts'
import '@testing-library/jest-dom/vitest'
afterEach(cleanup)
function setup(listTokens: () => Promise<any> = async () => ({ ok: true, value: [] })) {
  const s = emptyState()
  s.config.android.test = { packageName: 'com.example', credentialId: 'fcm' }
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
