// @vitest-environment jsdom
import React from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { AppProvider } from '../app/AppProvider'
import { SettingsPage } from './SettingsPage'
import { emptyState } from '../../main/storage/types'
import type { PusherApi } from '../../shared/contracts'
import '@testing-library/jest-dom/vitest'
afterEach(cleanup)
function setup() {
  const state = emptyState()
  const save = vi.fn(async (input: any) => ({ ok: true, value: { ...input, revision: 1 } }))
  window.pusher = {
    bootstrap: async () => ({ ok: true, value: { ...state, credentialSummaries: [] } }),
    saveSettings: save,
    importCredential: async () => ({ ok: true, value: null }),
    onBeforeClose: () => () => {},
  } as unknown as PusherApi
  const router = createMemoryRouter(
    [
      { path: '/', element: <div>首页</div> },
      {
        path: '/settings',
        element: (
          <AppProvider>
            <SettingsPage />
          </AppProvider>
        ),
      },
    ],
    { initialEntries: ['/settings'] },
  )
  render(<RouterProvider router={router} />)
  return { save, router }
}
it('切换环境及 iOS 凭据只展示对应字段，取消导入不伪造成功', async () => {
  setup()
  await screen.findByLabelText('应用名称')
  await userEvent.click(screen.getByRole('tab', { name: 'iOS 推送' }))
  expect(screen.getByLabelText('Key ID')).toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText('鉴权方式'), 'p12')
  expect(screen.queryByLabelText('Key ID')).not.toBeInTheDocument()
  expect(screen.getByLabelText('证书密码')).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: '导入 .p12 证书' }))
  expect(screen.getByText('尚未配置凭据')).toBeInTheDocument()
  await userEvent.selectOptions(screen.getByLabelText('配置环境'), 'production')
  expect(screen.getByLabelText('Key ID')).toBeInTheDocument()
})
it('修改名称可以保存，离开未保存设置提供三种处理方式', async () => {
  const { save, router } = setup()
  const name = await screen.findByLabelText('应用名称')
  await userEvent.clear(name)
  await userEvent.type(name, '推送测试 App')
  await userEvent.click(screen.getByRole('button', { name: '保存设置' }))
  await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
  expect(save.mock.calls[0][0].displayName).toBe('推送测试 App')
  await userEvent.type(name, '!')
  void router.navigate('/')
  await screen.findByText('有未保存的设置')
  expect(screen.getByRole('button', { name: '保存并离开' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '放弃修改' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: '继续编辑' })).toBeInTheDocument()
})
