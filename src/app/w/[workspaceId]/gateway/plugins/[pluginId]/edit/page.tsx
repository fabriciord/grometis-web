'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from '@/app/_components/ConfirmDialog';
import { HelpHint } from '@/app/_components/HelpHint';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type ServiceListItem = { id: string; name: string };

type RouteListItem = { id: string; name: string | null; paths: string[] };

type PluginDetails = {
  id: string;
  name: string;
  protocols: string[];
  tags: string[] | null;
  enabled: boolean;
  config: Record<string, unknown>;
  isGlobal: boolean;
  serviceId: string | null;
  routeId: string | null;
  consumerId: string | null;
  createdAt: string;
  updatedAt: string;
};

type SchemaListItem = {
  id: string;
  name: string;
  createdAt: string;
};

type SchemaDetails = {
  id: string;
  name: string;
  schema: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type GatewaySchemaFieldType = 'string' | 'number' | 'integer' | 'boolean' | 'set' | 'record' | 'array';

type GatewaySchemaFieldConfig = {
  previous?: string[];
  type: GatewaySchemaFieldType;
  required?: boolean;
  default?: unknown;
  one_of?: string[];
  elements?: {
    default?: string[];
    one_of?: string[];
    len_min?: number;
    required?: boolean;
  };
  between?: [number, number];
  fields?: GatewaySchemaField[];
};

type GatewaySchemaField = {
  [key: string]: GatewaySchemaFieldConfig;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function getSchemaRootFields(schema: Record<string, unknown>): GatewaySchemaField[] {
  const s = schema as Record<string, unknown>;
  const fields = s.fields;
  if (!Array.isArray(fields)) return [];
  return fields.filter(isPlainObject) as unknown as GatewaySchemaField[];
}

function findSchemaField(fields: GatewaySchemaField[], name: string): GatewaySchemaFieldConfig | null {
  for (const field of fields) {
    const cfg = (field as Record<string, unknown>)[name];
    if (isPlainObject(cfg) && typeof (cfg as Record<string, unknown>).type === 'string') {
      return cfg as unknown as GatewaySchemaFieldConfig;
    }
  }
  return null;
}

function defaultForType(cfg: GatewaySchemaFieldConfig): unknown {
  if (cfg.default !== undefined) return cfg.default;
  if (cfg.type === 'set') return cfg.elements?.default ?? [];
  if (cfg.type === 'record') return {};
  if (cfg.type === 'array') return [];
  if (cfg.type === 'integer' || cfg.type === 'number') return 0;
  if (cfg.type === 'boolean') return false;
  return '';
}

function applyDefaults(fields: GatewaySchemaField[], current: Record<string, unknown> | undefined): Record<string, unknown> {
  const base = isPlainObject(current) ? { ...current } : {};
  for (const f of fields) {
    const [fieldName, fieldConfig] = Object.entries(f)[0] as [string, GatewaySchemaFieldConfig];
    if (!fieldName || !fieldConfig?.type) continue;

    const hasValue = Object.prototype.hasOwnProperty.call(base, fieldName);
    if (!hasValue) {
      base[fieldName] = defaultForType(fieldConfig);
    }

    if (fieldConfig.type === 'record' && Array.isArray(fieldConfig.fields)) {
      base[fieldName] = applyDefaults(fieldConfig.fields, base[fieldName] as Record<string, unknown>);
    }
  }
  return base;
}

function updateAtPath(root: Record<string, unknown>, path: string[], value: unknown): Record<string, unknown> {
  if (!path.length) return root;
  const out: Record<string, unknown> = { ...root };
  let cursor: Record<string, unknown> = out;
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i];
    const next = cursor[key];
    cursor[key] = isPlainObject(next) ? { ...next } : {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[path[path.length - 1]] = value;
  return out;
}

function SchemaFieldsForm({
  fields,
  value,
  onChange,
  pathPrefix,
}: {
  fields: GatewaySchemaField[];
  value: Record<string, unknown>;
  onChange: (path: string[], next: unknown) => void;
  pathPrefix?: string[];
}) {
  const prefix = pathPrefix ?? [];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map((field, index) => {
        const [fieldName, fieldConfig] = Object.entries(field)[0] as [string, GatewaySchemaFieldConfig];
        if (!fieldName || !fieldConfig?.type) return null;
        const path = [...prefix, fieldName];
        const currentValue = value?.[fieldName];
        const required = fieldConfig.required ?? false;

        const label = (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-zinc-700">{fieldName}</span>
            {required ? (
              <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">required</span>
            ) : null}
          </div>
        );

        if (fieldConfig.type === 'record') {
          const childFields = Array.isArray(fieldConfig.fields) ? fieldConfig.fields : [];
          return (
            <div key={`record-${fieldName}-${index}`} className="sm:col-span-2 rounded-lg border border-zinc-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-zinc-900">{fieldName}</div>
                {required ? (
                  <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">required</span>
                ) : null}
              </div>
              {childFields.length ? (
                <SchemaFieldsForm
                  fields={childFields}
                  value={isPlainObject(currentValue) ? (currentValue as Record<string, unknown>) : {}}
                  onChange={onChange}
                  pathPrefix={path}
                />
              ) : (
                <div className="text-sm text-zinc-600">Sem campos.</div>
              )}
            </div>
          );
        }

        if (fieldConfig.type === 'set') {
          const options = fieldConfig.elements?.one_of ?? [];
          const selected = Array.isArray(currentValue) ? currentValue.map(String) : [];
          return (
            <label key={`set-${fieldName}-${index}`} className="block sm:col-span-2">
              {label}
              <select
                className="mt-1 h-32 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                multiple
                value={selected}
                onChange={(e) => {
                  const values = Array.from(e.target.selectedOptions).map((o) => o.value);
                  onChange(path, values);
                }}
              >
                {options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        if (fieldConfig.type === 'boolean') {
          return (
            <label
              key={`boolean-${fieldName}-${index}`}
              className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2 sm:col-span-2"
            >
              <div className="text-sm text-zinc-900">{fieldName}</div>
              <input
                type="checkbox"
                checked={Boolean(currentValue)}
                onChange={(e) => onChange(path, Boolean(e.target.checked))}
              />
            </label>
          );
        }

        if (fieldConfig.type === 'integer' || fieldConfig.type === 'number') {
          const min = fieldConfig.between?.[0];
          const max = fieldConfig.between?.[1];
          return (
            <label key={`number-${fieldName}-${index}`} className="block">
              {label}
              <input
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                type="number"
                step={fieldConfig.type === 'integer' ? 1 : 'any'}
                min={min}
                max={max}
                value={currentValue === undefined || currentValue === null ? '' : String(currentValue)}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === '') return onChange(path, required ? 0 : undefined);
                  const n = fieldConfig.type === 'integer' ? parseInt(raw, 10) : Number(raw);
                  onChange(path, Number.isFinite(n) ? n : required ? 0 : undefined);
                }}
              />
            </label>
          );
        }

        if (fieldConfig.type === 'array') {
          const options = fieldConfig.elements?.one_of ?? [];
          if (options.length) {
            const selected = Array.isArray(currentValue) ? currentValue.map(String) : [];
            return (
              <label key={`array-${fieldName}-${index}`} className="block sm:col-span-2">
                {label}
                <select
                  className="mt-1 h-32 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                  multiple
                  value={selected}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions).map((o) => o.value);
                    onChange(path, values);
                  }}
                >
                  {options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>
            );
          }

          const asText = Array.isArray(currentValue)
            ? currentValue.join(',')
            : typeof currentValue === 'string'
              ? currentValue
              : '';
          return (
            <label key={`array-${fieldName}-${index}`} className="block sm:col-span-2">
              {label}
              <input
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                value={asText}
                onChange={(e) => {
                  const parts = e.target.value
                    .split(',')
                    .map((v) => v.trim())
                    .filter(Boolean);
                  onChange(path, parts);
                }}
                placeholder="a,b,c"
              />
            </label>
          );
        }

        // string (default) + one_of
        const oneOf = fieldConfig.one_of ?? [];
        if (oneOf.length) {
          return (
            <label key={`string-${fieldName}-${index}`} className="block">
              {label}
              <select
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                value={currentValue === undefined || currentValue === null ? '' : String(currentValue)}
                onChange={(e) => onChange(path, e.target.value)}
                required={required}
              >
                {!required ? <option value="">—</option> : null}
                {oneOf.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          );
        }

        return (
          <label key={`string-${fieldName}-${index}`} className="block">
            {label}
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
              type="text"
              value={currentValue === undefined || currentValue === null ? '' : String(currentValue)}
              onChange={(e) => onChange(path, e.target.value)}
              required={required}
            />
          </label>
        );
      })}
    </div>
  );
}

function PluginConfigForm({
  schema,
  initialConfig,
  onConfigChange,
}: {
  schema: SchemaDetails;
  initialConfig: Record<string, unknown>;
  onConfigChange: (cfg: Record<string, unknown>) => void;
}) {
  const configRecord = useMemo(() => {
    const rootFields = getSchemaRootFields(schema.schema);
    return findSchemaField(rootFields, 'config');
  }, [schema.schema]);

  const configFields = useMemo(() => {
    if (!configRecord || configRecord.type !== 'record') return [];
    return Array.isArray(configRecord.fields) ? configRecord.fields : [];
  }, [configRecord]);

  const [configValue, setConfigValue] = useState<Record<string, unknown>>(() => applyDefaults(configFields, initialConfig));

  useEffect(() => {
    setConfigValue(applyDefaults(configFields, initialConfig));
  }, [configFields, initialConfig]);

  useEffect(() => {
    onConfigChange(configValue);
  }, [configValue, onConfigChange]);

  if (!configFields.length) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
        Schema is available, but we could not extract the `config` fields.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SchemaFieldsForm
        fields={configFields}
        value={configValue}
        onChange={(path, next) => {
          setConfigValue((prev) => updateAtPath(prev, path, next));
        }}
      />
    </div>
  );
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export default function PluginEditPage() {
  const params = useParams<{ workspaceId: string; pluginId: string }>();
  const router = useRouter();
  const token = useMemo(() => getAccessToken(), []);

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

  const pluginQuery = useQuery({
    queryKey: ['plugin', params.workspaceId, params.pluginId],
    queryFn: async () => {
      const res = await apiFetch<{ plugin: PluginDetails }>(
        `/workspaces/${params.workspaceId}/plugins/${params.pluginId}`,
        { token },
      );
      return res.plugin;
    },
    enabled: !!token,
  });

  const servicesQuery = useQuery({
    queryKey: ['services', params.workspaceId],
    queryFn: async () => {
      const res = await apiFetch<{ services: ServiceListItem[] }>(
        `/workspaces/${params.workspaceId}/services`,
        { token },
      );
      return res.services;
    },
    enabled: !!token,
  });

  const schemasQuery = useQuery({
    queryKey: ['schemas', params.workspaceId],
    queryFn: async () => {
      const res = await apiFetch<{ schemas: SchemaListItem[] }>(
        `/workspaces/${params.workspaceId}/schemas`,
        { token },
      );
      return res.schemas;
    },
    enabled: !!token,
  });

  const routesQuery = useQuery({
    queryKey: ['routes', params.workspaceId],
    queryFn: async () => {
      const res = await apiFetch<{ routes: RouteListItem[] }>(
        `/workspaces/${params.workspaceId}/routes`,
        { token },
      );
      return res.routes;
    },
    enabled: !!token,
  });

  const plugin = pluginQuery.data;

  const schemaIdForPlugin = (schemasQuery.data ?? []).find((s) => s.name === plugin?.name)?.id;

  const pluginSchemaQuery = useQuery({
    queryKey: ['schema-by-plugin', params.workspaceId, schemaIdForPlugin ?? null],
    queryFn: async () => {
      if (!schemaIdForPlugin) throw new Error('Schema not selected');
      const res = await apiFetch<{ schema: SchemaDetails }>(
        `/workspaces/${params.workspaceId}/schemas/${schemaIdForPlugin}`,
        { token },
      );
      return res.schema;
    },
    enabled: !!token && !!schemaIdForPlugin,
  });

  const services = servicesQuery.data ?? [];
  const routes = routesQuery.data ?? [];

  if (pluginQuery.isLoading || servicesQuery.isLoading || routesQuery.isLoading) {
    return <div className="text-sm text-zinc-600">Loading…</div>;
  }

  if (pluginQuery.isError || !plugin) {
    return <div className="text-sm text-red-700">Failed to load plugin.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-zinc-900">Edit plugin: {plugin.name}</h1>
          <p className="mt-1 text-sm text-zinc-600">Update plugin configuration.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/w/${params.workspaceId}/gateway/plugins/${params.pluginId}`}
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            Back
          </Link>
        </div>
      </div>

      <PluginEditForm
        key={plugin.id}
        plugin={plugin}
        services={services}
        routes={routes}
        schema={pluginSchemaQuery.data}
        schemaIsLoading={pluginSchemaQuery.isLoading}
        workspaceId={params.workspaceId}
        pluginId={params.pluginId}
        token={token}
      />
    </div>
  );
}

function PluginEditForm({
  plugin,
  services,
  routes,
  schema,
  schemaIsLoading,
  workspaceId,
  pluginId,
  token,
}: {
  plugin: PluginDetails;
  services: ServiceListItem[];
  routes: RouteListItem[];
  schema?: SchemaDetails;
  schemaIsLoading: boolean;
  workspaceId: string;
  pluginId: string;
  token: string | null;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const tagsRef = useRef<HTMLInputElement | null>(null);

  const [isGlobal, setIsGlobal] = useState(plugin.isGlobal);
  const [serviceId, setServiceId] = useState(plugin.serviceId ?? '');
  const [routeId, setRouteId] = useState(plugin.routeId ?? '');
  const [consumerId, setConsumerId] = useState(plugin.consumerId ?? '');
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const lastScopedTargetsRef = useRef<{ serviceId: string; routeId: string; consumerId: string }>({
    serviceId: plugin.serviceId ?? '',
    routeId: plugin.routeId ?? '',
    consumerId: plugin.consumerId ?? '',
  });

  const configDraftRef = useRef<Record<string, unknown>>(plugin.config ?? {});

  const handleConfigChange = useCallback((cfg: Record<string, unknown>) => {
    configDraftRef.current = cfg;
  }, []);

  const updatePluginMutation = useMutation({
    mutationFn: async () => {
      const nextIsGlobal = isGlobal;
      const nextServiceId = !nextIsGlobal && serviceId ? serviceId : null;
      const nextRouteId = !nextIsGlobal && !nextServiceId && routeId ? routeId : null;
      const nextConsumerId =
        !nextIsGlobal && !nextServiceId && !nextRouteId && consumerId.trim() ? consumerId.trim() : null;

      const payload: Record<string, unknown> = {
        name: plugin.name,
        enabled: plugin.enabled,
        isGlobal: nextIsGlobal,
        protocols: plugin.protocols,
        tags: splitCsv(tagsRef.current?.value ?? '').length ? splitCsv(tagsRef.current?.value ?? '') : null,
        config: schema ? configDraftRef.current : plugin.config,
        serviceId: nextServiceId,
        routeId: nextRouteId,
        consumerId: nextConsumerId,
      };

      return apiFetch<{ plugin: { id: string } }>(
        `/workspaces/${workspaceId}/plugins/${pluginId}`,
        {
          method: 'PATCH',
          token,
          body: JSON.stringify(payload),
        },
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['plugin', workspaceId, pluginId] });
      await queryClient.invalidateQueries({ queryKey: ['plugins', workspaceId] });
      router.push(`/w/${workspaceId}/gateway/plugins/${pluginId}`);
    },
  });

  const deletePluginMutation = useMutation({
    mutationFn: async () => {
      return apiFetch<{ ok: true }>(`/workspaces/${workspaceId}/plugins/${pluginId}`, { method: 'DELETE', token });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['plugins', workspaceId] });
      router.push(`/w/${workspaceId}/gateway/plugins`);
    },
  });

  const isScoped = !isGlobal;
  const canSwitchToScoped = Boolean((plugin.serviceId || plugin.routeId || plugin.consumerId || '').trim());

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4">
      <ConfirmDialog
        open={isDeleteOpen}
        title="Delete plugin?"
        description="Delete this plugin? This action cannot be undone."
        tone="danger"
        confirmLabel={deletePluginMutation.isPending ? 'Deleting…' : 'Delete'}
        cancelLabel="Cancel"
        busy={deletePluginMutation.isPending}
        onCancel={() => setIsDeleteOpen(false)}
        onConfirm={() => {
          deletePluginMutation.mutate();
          setIsDeleteOpen(false);
        }}
      />

      <form
        className="grid gap-2 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          updatePluginMutation.mutate();
        }}
      >
        <div className="sm:col-span-2">
          <div className="text-sm text-zinc-700">Name</div>
          <div className="mt-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900">{plugin.name}</div>
          <div className="mt-1 text-xs text-zinc-500">Read-only</div>
        </div>

        <label className="flex items-center gap-2 sm:col-span-2">
          <input checked={plugin.enabled} type="checkbox" disabled />
          <span className="text-sm text-zinc-700">Enabled</span>
          <span className="text-xs text-zinc-500">(read-only)</span>
        </label>

        <div className="sm:col-span-2">
          <div className="text-sm text-zinc-700">Scope</div>
          <div className="mt-1 space-y-2">
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name="scope"
                checked={isGlobal}
                onChange={() => {
                  setIsGlobal(true);
                  lastScopedTargetsRef.current = { serviceId, routeId, consumerId };
                  setServiceId('');
                  setRouteId('');
                  setConsumerId('');
                }}
              />
              <div>
                <div className="text-sm text-zinc-900">Global</div>
                <div className="text-xs text-zinc-500">All services, routes, and consumers</div>
              </div>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name="scope"
                checked={!isGlobal}
                disabled={!canSwitchToScoped && isGlobal}
                onChange={() => {
                  setIsGlobal(false);
                  const prev = lastScopedTargetsRef.current;
                  setServiceId(prev.serviceId);
                  setRouteId(prev.routeId);
                  setConsumerId(prev.consumerId);
                }}
              />
              <div>
                <div className="text-sm text-zinc-900">Scoped</div>
                <div className="text-xs text-zinc-500">Current target (read-only)</div>
              </div>
            </label>
            {!canSwitchToScoped && isGlobal ? (
              <div className="text-xs text-zinc-500">
                You can&apos;t switch from Global to Scoped without an existing target.
              </div>
            ) : null}
          </div>
        </div>

        {!isGlobal ? (
          <label className="block">
            <span className="text-sm text-zinc-700">Service</span>
            <select
              className="mt-1 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900"
              value={serviceId}
              onChange={() => {}}
              disabled
            >
              <option value="">—</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="mt-1 text-xs text-zinc-500">Read-only</div>
          </label>
        ) : null}

        {!isGlobal ? (
          <label className="block">
            <span className="text-sm text-zinc-700">Route</span>
            <select
              className="mt-1 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900"
              value={routeId}
              onChange={() => {}}
              disabled
            >
              <option value="">—</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name ?? r.paths.join(', ')}
                </option>
              ))}
            </select>
            <div className="mt-1 text-xs text-zinc-500">Read-only</div>
          </label>
        ) : null}

        {!isGlobal ? (
          <label className="block sm:col-span-2">
            <span className="text-sm text-zinc-700">Consumer ID (uuid)</span>
            <input
              value={consumerId}
              onChange={() => {}}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900"
              placeholder="consumer-uuid"
              disabled
            />
            <div className="mt-1 text-xs text-zinc-500">Read-only</div>
          </label>
        ) : null}

        <label className="block sm:col-span-2">
          <div className="flex items-center gap-1">
            <span className="text-sm text-zinc-700">Tags</span>
            <HelpHint text="Optional. Comma-separated values." />
          </div>
          <input
            ref={tagsRef}
            defaultValue={plugin.tags?.join(',') ?? ''}
            className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
            placeholder="prod,edge"
          />
        </label>

        <div className="sm:col-span-2">
          <div className="text-sm text-zinc-700">Protocols</div>
          <div className="mt-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900">
            {plugin.protocols.join(', ')}
          </div>
          <div className="mt-1 text-xs text-zinc-500">Read-only</div>
        </div>

        <div className="sm:col-span-2">
          {schema ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <div className="text-sm font-semibold text-zinc-900">Config</div>
              <div className="mt-1 text-xs text-zinc-600">Edit: fields generated from the schema.</div>

              <div className="mt-3">
                <PluginConfigForm
                  key={plugin.id}
                  schema={schema}
                  initialConfig={plugin.config ?? {}}
                  onConfigChange={handleConfigChange}
                />
              </div>
            </div>
          ) : schemaIsLoading ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">Loading schema…</div>
          ) : (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Schema not found for this plugin. Config will be kept as-is (no editing via JSON).
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 sm:col-span-2">
          <button
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            disabled={updatePluginMutation.isPending}
            type="submit"
          >
            {updatePluginMutation.isPending ? 'Saving…' : 'Save'}
          </button>

          <button
            className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            disabled={deletePluginMutation.isPending}
            onClick={() => {
              setIsDeleteOpen(true);
            }}
            type="button"
          >
            {deletePluginMutation.isPending ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </form>

      {isScoped ? (
        <div className="mt-3 rounded-md bg-zinc-50 p-3 text-sm text-zinc-700">
          Service/Route/Consumer are read-only while editing.
        </div>
      ) : null}

      {updatePluginMutation.isError ? (
        <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">Failed to save (must be admin/owner).</div>
      ) : null}

      {deletePluginMutation.isError ? (
        <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">Failed to delete (must be admin/owner).</div>
      ) : null}
    </div>
  );
}
