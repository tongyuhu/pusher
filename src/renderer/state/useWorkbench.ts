import { useEffect, useMemo, useState, useRef } from 'react'
import type { Draft, SendReceipt, TokenRecord, JsonObject } from '../../shared/contracts'
import { useApp } from '../app/AppProvider'
import { client } from '../app/client'
import { makeScope, scopeKey } from '../../shared/scope'
import { createDraft } from '../../shared/message/draft'
import { parsePayload } from '../../shared/message/json'
import { buildPreview } from '../../shared/message/preview'
export function useWorkbench() {
  const app = useApp(),
    { state, dispatch, snapshot, drafts, setDrafts } = app,
    [tokens, setTokens] = useState<TokenRecord[]>([]),
    [feedback, setFeedback] = useState('')
  const stateRef = useRef(state)
  stateRef.current = state
  const draft = drafts[state.platform] || createDraft(state.platform),
    scopeResult = makeScope(snapshot.config, state.platform, state.environment, snapshot.credentialSummaries),
    scope = scopeResult.ok ? scopeResult.value : undefined,
    key = scope ? scopeKey(scope) : ''
  const reloadTokens = async () => {
    if (!scope) {
      setTokens([])
      return
    }
    const r = await client().listTokens(scope)
    if (r.ok) setTokens(r.value)
    else setFeedback(r.error.message)
  }
  useEffect(() => {
    let active = true
    setTokens([])
    setFeedback('')
    if (!scope) {
      if (state.tokenScopeKey) dispatch({ type: 'selectToken', token: '' })
      return
    }
    void client()
      .listTokens(scope)
      .then((r) => {
        if (!active) return
        if (r.ok) {
          setTokens(r.value)
          if (stateRef.current.tokenScopeKey !== key) {
            const selected = r.value.find((t) => t.id === snapshot.selections[key])
            dispatch({ type: 'selectToken', token: selected?.token || '', scopeKey: key })
          }
        } else setFeedback(r.error.message)
      })
    return () => {
      active = false
    }
  }, [key])
  useEffect(
    () => () => {
      void app.flushDrafts().catch(() => {})
    },
    [app.flushDrafts],
  )
  const editDraft = (next: Draft) =>
    setDrafts((prev) => ({
      ...prev,
      [next.platform]: {
        ...next,
        revision: Math.max(next.revision, (prev[next.platform]?.revision ?? -1) + 1),
      },
    }))
  const preview = useMemo(
    () =>
      scope
        ? buildPreview(snapshot.config, {
            scope,
            configRevision: snapshot.config.revision,
            token: state.token || '00',
            draft,
          })
        : undefined,
    [draft, scope ? key : '', state.token, snapshot.config.revision],
  )
  const parsed = parsePayload(draft.rawText)
  const currentCredential =
    state.platform === 'android'
      ? snapshot.config.android[state.environment].credentialId
      : snapshot.config.ios[state.environment].credentialId
  const configured =
    !!currentCredential && snapshot.credentialSummaries.some((c) => c.id === currentCredential)
  const send = async () => {
    if (!scope || state.sending || !state.token.trim()) return
    dispatch({ type: 'beginSend' })
    setFeedback('')
    try {
      const r = await client().send({
        scope,
        configRevision: snapshot.config.revision,
        token: state.token.trim(),
        draft,
      })
      if (r.ok) {
        dispatch({ type: 'sendUpdate', receipt: r.value })
        await reloadTokens()
      } else {
        dispatch({ type: 'cancelSend' })
        setFeedback(r.error.message)
      }
    } catch {
      dispatch({ type: 'cancelSend' })
      setFeedback('本地服务未返回，请核对发送记录后再试。')
    }
  }
  const setToken = (token: string) => {
    dispatch({ type: 'selectToken', token, scopeKey: key })
    if (scope) {
      const record = tokens.find((t) => t.token === token)
      void client().selectToken({ scope, id: record?.id })
    }
  }
  const saveToken = async (note: string) => {
    if (!scope) {
      setFeedback('请先配置当前平台和环境')
      return
    }
    const r = await client().saveToken({ scope, token: state.token, note })
    if (r.ok) {
      setFeedback('设备 token 已保存')
      await reloadTokens()
      void client().selectToken({ scope, id: r.value.id })
    } else setFeedback(r.error.message)
  }
  const deleteToken = async (id: string) => {
    if (!scope) return
    const token = tokens.find((t) => t.id === id)
    const r = await client().deleteToken({ scope, id })
    if (r.ok) {
      if (token?.token === state.token) setToken('')
      await reloadTokens()
    } else setFeedback(r.error.message)
  }
  const loadHistory = (receipt: SendReceipt) => {
    const platform = receipt.snapshot.scope.platform,
      newScope = makeScope(snapshot.config, platform, state.environment, snapshot.credentialSummaries),
      matches = newScope.ok && scopeKey(newScope.value) === scopeKey(receipt.snapshot.scope)
    let payload: JsonObject = structuredClone(receipt.snapshot.request.body)
    if (platform === 'android') {
      payload = (payload.message || {}) as JsonObject
      delete payload.token
    }
    const advanced: JsonObject = {}
    if (platform === 'ios') {
      const h = receipt.snapshot.request.headers
      if (h['apns-priority']) advanced.priority = Number(h['apns-priority'])
      if (h['apns-expiration']) advanced.expiration = Number(h['apns-expiration'])
      if (h['apns-collapse-id']) advanced.collapseId = h['apns-collapse-id']
    }
    editDraft({
      ...createDraft(platform),
      mode: 'json',
      revision: (drafts[platform]?.revision || 0) + 1,
      rawText: JSON.stringify(payload, null, 2),
      lastValidPayload: payload,
      advanced,
    })
    dispatch({
      type: 'loadHistory',
      receipt,
      scopeMatches: matches,
      scopeKey: newScope.ok ? scopeKey(newScope.value) : undefined,
    })
    setFeedback(matches ? '消息已载入，请核对后手动发送' : '消息已载入，目标与当前环境不同，请重新选择 token')
  }
  const history = state.history.length ? state.history : snapshot.history
  return {
    ...app,
    state,
    dispatch,
    draft,
    scope,
    tokens,
    preview,
    parsed,
    configured,
    feedback,
    setFeedback,
    editDraft,
    setToken,
    saveToken,
    deleteToken,
    send,
    loadHistory,
    history,
  }
}
