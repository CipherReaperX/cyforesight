import { useState, useCallback } from 'react'
import {
  Plug, Check, X, AlertCircle, WifiOff, Loader2, RefreshCw,
  ChevronDown, ChevronUp, Eye, EyeOff, Zap,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { useIntegrations, type Integration, type IntegrationConfig } from '@/hooks/useIntegrations'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { formatRelativeTime } from '@/lib/utils'
import api from '@/lib/api'

// ─── Integration metadata ──────────────────────────────────────────────────────

const META: Record<string, { icon: string; description: string; configFields: ConfigField[]; color: string }> = {
  slack: {
    icon: '💬', color: 'from-green-600/20 to-green-500/5',
    description: 'Post alerts to a Slack channel via an incoming webhook.',
    configFields: [
      { key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://hooks.slack.com/services/…', type: 'url', required: true },
    ],
  },
  teams: {
    icon: '🟣', color: 'from-purple-600/20 to-purple-500/5',
    description: 'Send adaptive cards to a Microsoft Teams channel.',
    configFields: [
      { key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://…webhook.office.com/webhookb2/…', type: 'url', required: true },
    ],
  },
  discord: {
    icon: '🎮', color: 'from-indigo-600/20 to-indigo-500/5',
    description: 'Send rich embeds to a Discord channel webhook.',
    configFields: [
      { key: 'webhookUrl', label: 'Webhook URL', placeholder: 'https://discord.com/api/webhooks/…', type: 'url', required: true },
    ],
  },
  webhook: {
    icon: '🔗', color: 'from-cyan-600/20 to-cyan-500/5',
    description: 'POST event JSON to any HTTP endpoint.',
    configFields: [
      { key: 'url', label: 'Target URL', placeholder: 'https://your-server.com/webhook', type: 'url', required: true },
      { key: 'method', label: 'HTTP Method', placeholder: 'POST', type: 'text' },
    ],
  },
  email: {
    icon: '📧', color: 'from-amber-600/20 to-amber-500/5',
    description: 'Send email alerts via SMTP on critical events.',
    configFields: [
      { key: 'smtpHost', label: 'SMTP Host', placeholder: 'smtp.example.com', type: 'text', required: true },
      { key: 'smtpPort', label: 'SMTP Port', placeholder: '587', type: 'number' },
      { key: 'smtpUser', label: 'Username', placeholder: 'alerts@example.com', type: 'text' },
      { key: 'smtpPass', label: 'Password', placeholder: '••••••••', type: 'password' },
      { key: 'smtpFrom', label: 'From Address', placeholder: 'alerts@cyforesight.local', type: 'text' },
      { key: 'smtpTo', label: 'To Address(es)', placeholder: 'soc@company.com', type: 'text', required: true },
    ],
  },
  virustotal: {
    icon: '🛡️', color: 'from-red-600/20 to-red-500/5',
    description: 'Enrich IOCs (hash / IP / domain) with VirusTotal scan results.',
    configFields: [
      { key: 'apiKey', label: 'API Key', placeholder: 'VirusTotal API key', type: 'password', required: true },
    ],
  },
}

const TRIGGER_LABELS: Record<string, string> = {
  feed_sync:    'Feed sync',
  feed_error:   'Feed error',
  critical_ioc: 'Critical IOC',
  high_ioc:     'High IOC',
}
const ALL_TRIGGERS = Object.keys(TRIGGER_LABELS)

interface ConfigField {
  key: keyof IntegrationConfig
  label: string
  placeholder: string
  type: 'text' | 'url' | 'password' | 'number'
  required?: boolean
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Integration['status'] }) {
  if (status === 'connected')
    return <Badge variant="success"><Check className="mr-1 h-3 w-3" />Connected</Badge>
  if (status === 'error')
    return <Badge variant="danger"><AlertCircle className="mr-1 h-3 w-3" />Error</Badge>
  if (status === 'configured')
    return <Badge variant="warning"><Plug className="mr-1 h-3 w-3" />Configured</Badge>
  return <Badge variant="default"><WifiOff className="mr-1 h-3 w-3" />Not configured</Badge>
}

// ─── Individual integration card ──────────────────────────────────────────────

function IntegrationCard({ integration }: { integration: Integration }) {
  const [expanded, setExpanded] = useState(false)
  const [formValues, setFormValues] = useState<Record<string, string>>({})
  const [showPwd, setShowPwd] = useState<Record<string, boolean>>({})
  const [testing, setTesting] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [saving, setSaving] = useState(false)
  const queryClient = useQueryClient()
  const meta = META[integration.type] ?? { icon: '🔌', description: '', configFields: [], color: '' }

  const mergeForm = useCallback(() => {
    const c = integration.config as Record<string, unknown>
    const merged: Record<string, string> = {}
    meta.configFields.forEach(f => {
      merged[f.key] = String(c[f.key] ?? '')
    })
    // triggers
    merged['triggers'] = ((c.triggers as string[]) ?? []).join(',')
    setFormValues(merged)
  }, [integration.config, meta.configFields])

  const handleExpand = () => {
    if (!expanded) mergeForm()
    setExpanded(v => !v)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {}
      meta.configFields.forEach(f => {
        const v = formValues[f.key] ?? ''
        if (v) payload[f.key] = f.type === 'number' ? Number(v) : v
      })
      payload.triggers = (formValues.triggers || '').split(',').filter(Boolean)
      await api.patch(`/integrations/${integration.id}/config`, payload)
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      toast.success('Config saved')
      setExpanded(false)
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Save failed')
    } finally { setSaving(false) }
  }

  const handleTest = async () => {
    setTesting(true)
    try {
      const { data } = await api.post(`/integrations/${integration.id}/test`)
      const res = data?.data
      if (res?.success) toast.success(`Test passed (${res.durationMs}ms): ${res.message}`)
      else toast.error(`Test failed: ${res?.message ?? 'Unknown error'}`)
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Test error')
    } finally { setTesting(false) }
  }

  const handleToggle = async () => {
    setToggling(true)
    try {
      const endpoint = integration.enabled ? 'disable' : 'enable'
      await api.post(`/integrations/${integration.id}/${endpoint}`)
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      toast.success(integration.enabled ? 'Integration disabled' : 'Integration enabled')
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Toggle failed')
    } finally { setToggling(false) }
  }

  const triggers = (integration.config.triggers ?? []) as string[]
  const lastResult = integration.lastResult

  return (
    <Card className={`overflow-hidden transition-all duration-200 ${integration.enabled ? 'border-slate-600' : 'opacity-75 border-slate-700'}`}>
      <div className={`h-1 w-full bg-gradient-to-r ${meta.color.split(' ')[0].replace('from-', 'bg-')}`} />
      <CardContent className="pt-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl flex-shrink-0">{meta.icon}</span>
            <div className="min-w-0">
              <h3 className="font-semibold text-slate-100 truncate">{integration.name}</h3>
              <p className="text-xs text-slate-500 mt-0.5 truncate">{meta.description}</p>
            </div>
          </div>
          <StatusBadge status={integration.status} />
        </div>

        {/* Meta row */}
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
          <div>Last used: {integration.lastUsed ? formatRelativeTime(integration.lastUsed) : 'Never'}</div>
          <div>Triggers: {triggers.length > 0 ? triggers.map(t => TRIGGER_LABELS[t] ?? t).join(', ') : 'None'}</div>
          {lastResult && (
            <div className={`col-span-2 rounded px-2 py-1 ${lastResult.success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              {lastResult.success ? '✓' : '✗'} {lastResult.message ?? (lastResult.error ?? '')}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2">
          {/* Enable/disable toggle */}
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors focus-visible:outline-none ${
              integration.enabled ? 'bg-cyan-500' : 'bg-slate-600'
            }`}
            title={integration.enabled ? 'Disable' : 'Enable'}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${integration.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
          </button>

          <Button size="sm" variant="outline" onClick={handleTest} disabled={testing || integration.status === 'not_configured'}>
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
            <span className="ml-1">{testing ? 'Testing…' : 'Test'}</span>
          </Button>

          <Button size="sm" variant="ghost" onClick={handleExpand} className="ml-auto">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span className="ml-1">Configure</span>
          </Button>
        </div>

        {/* Config form (expand/collapse) */}
        {expanded && (
          <div className="mt-4 space-y-3 border-t border-slate-700 pt-4">
            {meta.configFields.map(field => (
              <div key={field.key}>
                <label className="mb-1 block text-xs font-medium text-slate-400">
                  {field.label}{field.required && <span className="ml-1 text-red-400">*</span>}
                </label>
                <div className="relative">
                  <Input
                    type={field.type === 'password' && !showPwd[field.key] ? 'password' : field.type === 'number' ? 'number' : 'text'}
                    placeholder={field.placeholder}
                    value={formValues[field.key] ?? ''}
                    onChange={e => setFormValues(v => ({ ...v, [field.key]: e.target.value }))}
                    className={field.type === 'password' ? 'pr-9' : ''}
                  />
                  {field.type === 'password' && (
                    <button
                      type="button"
                      className="absolute right-2 top-2.5 text-slate-500 hover:text-slate-300"
                      onClick={() => setShowPwd(v => ({ ...v, [field.key]: !v[field.key] }))}
                    >
                      {showPwd[field.key] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* Triggers */}
            <div>
              <label className="mb-2 block text-xs font-medium text-slate-400">Event triggers</label>
              <div className="flex flex-wrap gap-2">
                {ALL_TRIGGERS.map(t => {
                  const active = (formValues.triggers || '').split(',').filter(Boolean).includes(t)
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        const current = (formValues.triggers || '').split(',').filter(Boolean)
                        const next = active ? current.filter(x => x !== t) : [...current, t]
                        setFormValues(v => ({ ...v, triggers: next.join(',') }))
                      }}
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        active ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      {TRIGGER_LABELS[t]}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="primary" onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                {saving ? 'Saving…' : 'Save config'}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setExpanded(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Integrations() {
  const { data: integrations = [], isLoading, refetch } = useIntegrations()

  const connected = integrations.filter(i => i.status === 'connected').length
  const enabled   = integrations.filter(i => i.enabled).length
  const errors    = integrations.filter(i => i.status === 'error').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Integrations</h1>
          <p className="text-slate-400">Connect CyForesight to external notification and enrichment services</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Connected</p>
                <p className="mt-1 text-2xl font-bold text-green-400">{connected}</p>
              </div>
              <Check className="h-7 w-7 text-green-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Enabled</p>
                <p className="mt-1 text-2xl font-bold text-cyan-400">{enabled}</p>
              </div>
              <Plug className="h-7 w-7 text-cyan-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Errors</p>
                <p className="mt-1 text-2xl font-bold text-red-400">{errors}</p>
              </div>
              <AlertCircle className="h-7 w-7 text-red-500 opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cards grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[0,1,2,3,4,5].map(i => (
            <Card key={i}>
              <CardContent>
                <div className="animate-pulse space-y-3">
                  <div className="h-5 w-32 rounded bg-slate-700" />
                  <div className="h-3 w-full rounded bg-slate-700" />
                  <div className="h-8 w-full rounded bg-slate-700" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {integrations.map(i => <IntegrationCard key={i.id} integration={i} />)}
        </div>
      )}

      {/* Usage guide */}
      <Card>
        <CardContent>
          <h3 className="mb-3 font-semibold text-slate-200">How integrations work</h3>
          <div className="grid gap-2 text-sm text-slate-400 md:grid-cols-2">
            <p>1. <strong className="text-slate-300">Configure</strong> — expand a card and enter credentials or webhook URL, then save.</p>
            <p>2. <strong className="text-slate-300">Test</strong> — click Test to verify the connection with a real outbound call.</p>
            <p>3. <strong className="text-slate-300">Choose triggers</strong> — select which events fire this integration (feed sync, errors, critical IOCs).</p>
            <p>4. <strong className="text-slate-300">Enable</strong> — toggle on to activate. The card updates live via WebSocket.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
