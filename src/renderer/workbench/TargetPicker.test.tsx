// @vitest-environment jsdom
import React, { useState } from 'react'
import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'
import type { TokenRecord } from '../../shared/contracts'
import { TargetPicker } from './TargetPicker'

afterEach(cleanup)
const device: TokenRecord = {
  id: 'device-a',
  token: 'device-token-a',
  note: '原来的手机',
  scope: { platform: 'android', environment: 'test', packageName: 'com.example', projectId: 'project' },
  createdAt: 'now',
  lastUsedAt: 'now',
}
it('设备列表刷新不会覆盖正在编辑的名称，切换设备加载对应名称', async () => {
  const props = {
    token: device.token,
    tokens: [device],
    onChange: vi.fn(),
    onSave: vi.fn(),
    onDelete: vi.fn(),
  }
  const view = render(<TargetPicker {...props} />)
  const input = screen.getByDisplayValue('原来的手机')
  await userEvent.clear(input)
  await userEvent.type(input, '尚未保存的新名称')
  view.rerender(<TargetPicker {...props} tokens={[{ ...device, lastUsedAt: 'later' }]} />)
  expect(input).toHaveValue('尚未保存的新名称')
  view.rerender(
    <TargetPicker
      {...props}
      token="device-token-b"
      tokens={[{ ...device, token: 'device-token-b', note: '另一台手机' }]}
    />,
  )
  await waitFor(() => expect(input).toHaveValue('另一台手机'))
})
it('通过设备列表的改名入口聚焦名称输入框，保存名称并反映新结果', async () => {
  const save = vi.fn(async (_note: string) => true)
  function Harness() {
    const [token, setToken] = useState('')
    const [records, setRecords] = useState([device])
    return (
      <TargetPicker
        token={token}
        tokens={records}
        onChange={setToken}
        onDelete={() => {}}
        onSave={async (note) => {
          await save(note)
          setRecords([{ ...device, note }])
          return true
        }}
      />
    )
  }
  render(<Harness />)
  await userEvent.click(screen.getByRole('button', { name: '选择已保存设备' }))
  await userEvent.click(screen.getByRole('button', { name: '修改 原来的手机 的名称' }))
  const name = screen.getByLabelText('设备名称（可选）')
  expect(name).toHaveFocus()
  await userEvent.clear(name)
  await userEvent.type(name, '新手机名称')
  await userEvent.click(screen.getByRole('button', { name: '保存名称', exact: true }))
  expect(save).toHaveBeenCalledWith('新手机名称')
  await waitFor(() => expect(screen.getByRole('button', { name: '保存名称', exact: true })).toBeDisabled())
  await userEvent.click(screen.getByRole('button', { name: '选择已保存设备' }))
  expect(screen.getByRole('button', { name: /^新手机名称/ })).toBeInTheDocument()
})
