'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
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

function SchemaFieldsReadOnly({
  fields,
  value,
  pathPrefix,
}: {
  fields: GatewaySchemaField[];
  value: Record<string, unknown>;
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
                <SchemaFieldsReadOnly
                  fields={childFields}
                  value={isPlainObject(currentValue) ? (currentValue as Record<string, unknown>) : {}}
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
                className="mt-1 h-32 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900"
                multiple
                value={selected}
                onChange={() => {}}
                disabled
              >
                {options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <div className="mt-1 text-xs text-zinc-500">Read-only</div>
            </label>
          );
        }

        if (fieldConfig.type === 'boolean') {
          return (
            <label
              key={`boolean-${fieldName}-${index}`}
              className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 sm:col-span-2"
            >
              <div className="text-sm text-zinc-900">{fieldName}</div>
              <input type="checkbox" checked={Boolean(currentValue)} disabled />
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
                className="mt-1 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900"
                type="number"
                step={fieldConfig.type === 'integer' ? 1 : 'any'}
                min={min}
                max={max}
                value={currentValue === undefined || currentValue === null ? '' : String(currentValue)}
                onChange={() => {}}
                disabled
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
                  className="mt-1 h-32 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900"
                  multiple
                  value={selected}
                  onChange={() => {}}
                  disabled
                >
                  {options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                <div className="mt-1 text-xs text-zinc-500">Read-only</div>
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
                className="mt-1 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900"
                value={asText}
                onChange={() => {}}
                placeholder="a,b,c"
                disabled
              />
            </label>
          );
        }

        const oneOf = fieldConfig.one_of ?? [];
        if (oneOf.length) {
          return (
            <label key={`string-${fieldName}-${index}`} className="block">
              {label}
              <select
                className="mt-1 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900"
                value={currentValue === undefined || currentValue === null ? '' : String(currentValue)}
                onChange={() => {}}
                required={required}
                disabled
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
              className="mt-1 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900"
              type="text"
              value={currentValue === undefined || currentValue === null ? '' : String(currentValue)}
              onChange={() => {}}
              required={required}
              disabled
            />
          </label>
        );
      })}
    </div>
  );
}

function PluginConfigReadOnly({ schema, plugin }: { schema: SchemaDetails; plugin: PluginDetails }) {
  const configRecord = useMemo(() => {
    const rootFields = getSchemaRootFields(schema.schema);
    return findSchemaField(rootFields, 'config');
  }, [schema.schema]);

  const configFields = useMemo(() => {
    if (!configRecord || configRecord.type !== 'record') return [];
    return Array.isArray(configRecord.fields) ? configRecord.fields : [];
  }, [configRecord]);

  const configValue = useMemo(() => applyDefaults(configFields, plugin.config ?? {}), [configFields, plugin.config]);

  if (!configFields.length) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-600">
        Schema is available, but we could not extract the `config` fields.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SchemaFieldsReadOnly fields={configFields} value={configValue} />
    </div>
  );
}

export default function PluginViewPage() {
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

  const schemaIdForPlugin = (schemasQuery.data ?? []).find((s) => s.name === pluginQuery.data?.name)?.id;

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

  const plugin = pluginQuery.data;
  const services = servicesQuery.data ?? [];
  const routes = routesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-zinc-900">
            Plugin: {plugin?.name ?? '…'}
          </h1>
          <p className="mt-1 text-sm text-zinc-600">Detalhes do plugin.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/w/${params.workspaceId}/gateway/plugins`}
            className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
          >
            Back
          </Link>
          <Link
            href={`/w/${params.workspaceId}/gateway/plugins/${params.pluginId}/edit`}
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Edit
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white">
        {pluginQuery.isLoading ? <div className="p-4 text-sm text-zinc-600">Loading…</div> : null}
        {pluginQuery.isError ? (
          <div className="p-4 text-sm text-red-700">Failed to load plugin.</div>
        ) : null}

        {plugin ? (
          <div className="p-4">
            <div className="grid gap-2 sm:grid-cols-2">
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
                    <input type="radio" name="scope" checked={plugin.isGlobal} disabled />
                    <div>
                      <div className="text-sm text-zinc-900">Global</div>
                      <div className="text-xs text-zinc-500">All services, routes, and consumers</div>
                    </div>
                  </label>
                  <label className="flex items-start gap-2">
                    <input type="radio" name="scope" checked={!plugin.isGlobal} disabled />
                    <div>
                      <div className="text-sm text-zinc-900">Scoped</div>
                      <div className="text-xs text-zinc-500">Current target (read-only)</div>
                    </div>
                  </label>
                </div>
              </div>

              {!plugin.isGlobal ? (
                <label className="block">
                  <span className="text-sm text-zinc-700">Service</span>
                  <select
                    className="mt-1 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900"
                    value={plugin.serviceId ?? ''}
                    onChange={() => {}}
                    disabled
                  >
                    <option value="">—</option>
                    {plugin.serviceId && !services.some((s) => s.id === plugin.serviceId) ? (
                      <option value={plugin.serviceId}>{plugin.serviceId}</option>
                    ) : null}
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {!plugin.isGlobal ? (
                <label className="block">
                  <span className="text-sm text-zinc-700">Route</span>
                  <select
                    className="mt-1 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900"
                    value={plugin.routeId ?? ''}
                    onChange={() => {}}
                    disabled
                  >
                    <option value="">—</option>
                    {plugin.routeId && !routes.some((r) => r.id === plugin.routeId) ? (
                      <option value={plugin.routeId}>{plugin.routeId}</option>
                    ) : null}
                    {routes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name ?? r.paths.join(', ')}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              {!plugin.isGlobal ? (
                <label className="block sm:col-span-2">
                  <span className="text-sm text-zinc-700">Consumer ID (uuid)</span>
                  <input
                    value={plugin.consumerId ?? ''}
                    onChange={() => {}}
                    className="mt-1 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900"
                    disabled
                  />
                </label>
              ) : null}

              <div className="sm:col-span-2">
                <div className="text-sm text-zinc-700">Tags</div>
                <div className="mt-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900">
                  {plugin.tags?.length ? plugin.tags.join(', ') : '—'}
                </div>
              </div>

              <div className="sm:col-span-2">
                <div className="text-sm text-zinc-700">Protocols</div>
                <div className="mt-1 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900">
                  {plugin.protocols.join(', ')}
                </div>
              </div>

              <div className="sm:col-span-2 grid gap-4 pt-2 sm:grid-cols-2">
                <div>
                  <div className="text-sm text-zinc-600">Created</div>
                  <div className="mt-1 text-sm font-medium text-zinc-900">{new Date(plugin.createdAt).toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-sm text-zinc-600">Updated</div>
                  <div className="mt-1 text-sm font-medium text-zinc-900">{new Date(plugin.updatedAt).toLocaleString()}</div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <div className="text-sm font-semibold text-zinc-900">Config</div>
              <div className="mt-1 text-xs text-zinc-600">View: fields generated from the schema.</div>

              <div className="mt-3">
                {pluginSchemaQuery.data ? (
                  <PluginConfigReadOnly schema={pluginSchemaQuery.data} plugin={plugin} />
                ) : pluginSchemaQuery.isLoading ? (
                  <div className="text-sm text-zinc-600">Loading schema…</div>
                ) : (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    Schema not found for this plugin. Unable to render config using the schema format.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
