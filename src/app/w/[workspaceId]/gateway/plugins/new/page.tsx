'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

type ServiceListItem = { id: string; name: string };

type RouteListItem = { id: string; name: string | null; paths: string[] };

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

type GatewaySchemaFieldType = 'string' | 'number' | 'integer' | 'boolean' | 'set' | 'record' | 'array' | 'foreign';

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
  reference?: string;
  eq?: unknown;
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
    if (fieldConfig.type === 'foreign') continue;

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

function SchemaFieldsFlatForm({
  fields,
  value,
  onChange,
  pathPrefix,
}: {
  fields: GatewaySchemaField[];
  value: Record<string, unknown>;
  onChange: (path: string[], next: unknown) => void;
  pathPrefix: string[];
}) {
  const prefix = pathPrefix;

  return (
    <div className="space-y-3">
      {fields.map((field, index) => {
        const [fieldName, fieldConfig] = Object.entries(field)[0] as [string, GatewaySchemaFieldConfig];
        if (!fieldName || !fieldConfig?.type) return null;
        if (fieldConfig.type === 'foreign') return null;

        const path = [...prefix, fieldName];
        const currentValue = value?.[fieldName];
        const required = fieldConfig.required ?? false;
        const labelText = `${prefix[0].charAt(0).toUpperCase() + prefix[0].slice(1)}.${path.slice(1).join('.')}`;

        if (fieldConfig.type === 'record') {
          const childFields = Array.isArray(fieldConfig.fields) ? fieldConfig.fields : [];
          if (!childFields.length) return null;
          return (
            <SchemaFieldsFlatForm
              key={`record-${labelText}-${index}`}
              fields={childFields}
              value={isPlainObject(currentValue) ? (currentValue as Record<string, unknown>) : {}}
              onChange={onChange}
              pathPrefix={path}
            />
          );
        }

        const label = (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-zinc-700">{labelText}</span>
            {required ? (
              <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700">required</span>
            ) : null}
          </div>
        );

        if (fieldConfig.type === 'boolean') {
          return (
            <label
              key={`boolean-${labelText}-${index}`}
              className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2"
            >
              <div className="text-sm text-zinc-900">{labelText}</div>
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
            <label key={`number-${labelText}-${index}`} className="block">
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

        if (fieldConfig.type === 'set') {
          const options = fieldConfig.elements?.one_of ?? [];
          const selected = Array.isArray(currentValue) ? currentValue.map(String) : [];
          return (
            <label key={`set-${labelText}-${index}`} className="block">
              {label}
              <select
                className="mt-1 h-28 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
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

        if (fieldConfig.type === 'array') {
          const options = fieldConfig.elements?.one_of ?? [];
          if (options.length) {
            const selected = Array.isArray(currentValue) ? currentValue.map(String) : [];
            return (
              <label key={`array-${labelText}-${index}`} className="block">
                {label}
                <select
                  className="mt-1 h-28 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
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
            <label key={`array-${labelText}-${index}`} className="block">
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

        const oneOf = fieldConfig.one_of ?? [];
        if (oneOf.length) {
          return (
            <label key={`string-${labelText}-${index}`} className="block">
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
          <label key={`string-${labelText}-${index}`} className="block">
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

function PluginSchemaConfigPanel({
  schema,
  onConfigChange,
  onProtocolsChange,
}: {
  schema: SchemaDetails;
  onConfigChange: (cfg: Record<string, unknown>) => void;
  onProtocolsChange: (protocols: string[]) => void;
}) {
  const rootFields = useMemo(() => getSchemaRootFields(schema.schema), [schema.schema]);
  const protocolsField = useMemo(() => findSchemaField(rootFields, 'protocols'), [rootFields]);
  const configRecord = useMemo(() => findSchemaField(rootFields, 'config'), [rootFields]);

  const configFields = useMemo(() => {
    if (!configRecord || configRecord.type !== 'record') return [];
    return Array.isArray(configRecord.fields) ? configRecord.fields : [];
  }, [configRecord]);

  const defaultProtocols = useMemo(() => {
    if (protocolsField && protocolsField.type === 'set' && Array.isArray(protocolsField.default)) {
      return protocolsField.default.map(String);
    }
    return ['grpc', 'grpcs', 'http', 'https'];
  }, [protocolsField]);

  const [protocolsValue, setProtocolsValue] = useState<string[]>(defaultProtocols);
  const [configValue, setConfigValue] = useState<Record<string, unknown>>(() => applyDefaults(configFields, {}));

  useEffect(() => {
    setProtocolsValue(defaultProtocols);
  }, [defaultProtocols]);

  useEffect(() => {
    setConfigValue(applyDefaults(configFields, {}));
  }, [configFields, schema.id]);

  useEffect(() => {
    onProtocolsChange(protocolsValue);
  }, [onProtocolsChange, protocolsValue]);

  useEffect(() => {
    onConfigChange(configValue);
  }, [configValue, onConfigChange]);

  if (!configFields.length) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-3 text-sm text-zinc-600">
        Schema disponível, mas não foi possível extrair os campos de `config`.
      </div>
    );
  }

  return (
    <SchemaFieldsFlatForm
      fields={configFields}
      value={configValue}
      onChange={(path, next) => {
        // path começa com ['config', ...]
        const key = path[1];
        if (!key) return;
        setConfigValue((prev) => updateAtPath(prev, path.slice(1), next));
      }}
      pathPrefix={['config']}
    />
  );
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

export default function PluginNewPage() {
  const params = useParams<{ workspaceId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => getAccessToken(), []);
  const prefRouteId = searchParams.get('routeId') ?? '';
  const prefServiceId = searchParams.get('serviceId') ?? '';

  const [name, setName] = useState('');
  const [tags, setTags] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [isGlobal, setIsGlobal] = useState(false);

  const [serviceId, setServiceId] = useState(prefRouteId ? '' : prefServiceId);
  const [routeId, setRouteId] = useState(prefRouteId);
  const [consumerId, setConsumerId] = useState('');

  const configDraftRef = useRef<Record<string, unknown>>({});
  const protocolsDraftRef = useRef<string[]>([]);

  const handleConfigChange = useCallback((cfg: Record<string, unknown>) => {
    configDraftRef.current = cfg;
  }, []);

  const handleProtocolsChange = useCallback((protocols: string[]) => {
    protocolsDraftRef.current = protocols;
  }, []);

  useEffect(() => {
    if (!token) router.replace('/login');
  }, [router, token]);

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

  const schemaIdForPlugin = (schemasQuery.data ?? []).find((s) => s.name === name)?.id;

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

  const isScoped = !isGlobal;
  const hasScopeSelection = Boolean(serviceId || routeId || consumerId.trim());
  const disableServiceSelect = Boolean(routeId || consumerId.trim());
  const disableRouteSelect = Boolean(serviceId || consumerId.trim());

  const createPluginMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        name,
        enabled,
        isGlobal,
        protocols: protocolsDraftRef.current.length ? protocolsDraftRef.current : ['grpc', 'grpcs', 'http', 'https'],
        config: configDraftRef.current,
      };

      const parsedTags = splitCsv(tags);
      if (parsedTags.length) payload.tags = parsedTags;

      if (!isGlobal) {
        if (serviceId) payload.serviceId = serviceId;
        else if (routeId) payload.routeId = routeId;
        else if (consumerId.trim()) payload.consumerId = consumerId.trim();
      }

      return apiFetch<{ plugin: { id: string } }>(
        `/workspaces/${params.workspaceId}/plugins`,
        {
          method: 'POST',
          token,
          body: JSON.stringify(payload),
        },
      );
    },
    onSuccess: (res) => {
      router.push(`/w/${params.workspaceId}/gateway/plugins/${res.plugin.id}`);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900">New plugin</h1>
          <p className="mt-1 text-sm text-zinc-600">Crie um plugin para Service/Route/Consumer.</p>
        </div>
        <Link
          href={`/w/${params.workspaceId}/gateway/plugins`}
          className="rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-50"
        >
          Back
        </Link>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4">
        <form
          className="grid gap-2 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            createPluginMutation.mutate();
          }}
        >
          <label className="block">
              <span className="text-sm text-zinc-700">Plugin (schema)</span>
              <select
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              >
                <option value="" disabled>
                  Selecione…
                </option>
                {(schemasQuery.data ?? [])
                  .slice()
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name}
                    </option>
                  ))}
              </select>
          </label>

          <label className="flex items-center gap-2 sm:col-span-2">
            <input checked={enabled} onChange={(e) => setEnabled(e.target.checked)} type="checkbox" />
            <span className="text-sm text-zinc-700">Enabled</span>
          </label>

          <div className="sm:col-span-2">
            <div className="text-sm text-zinc-700">Scope</div>
            <div className="mt-1 space-y-2">
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name="scope"
                  checked={isGlobal}
                  onChange={() => setIsGlobal(true)}
                />
                <div>
                  <div className="text-sm text-zinc-900">Global</div>
                  <div className="text-xs text-zinc-500">Todos services, routes e consumers</div>
                </div>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name="scope"
                  checked={!isGlobal}
                  onChange={() => setIsGlobal(false)}
                />
                <div>
                  <div className="text-sm text-zinc-900">Scoped</div>
                  <div className="text-xs text-zinc-500">Selecione um service, route ou consumer</div>
                </div>
              </label>
            </div>
          </div>

          {!isGlobal ? (
            <label className="block">
              <span className="text-sm text-zinc-700">Service</span>
              <select
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-500"
                value={serviceId}
                onChange={(e) => {
                  setServiceId(e.target.value);
                  setRouteId('');
                  setConsumerId('');
                }}
                disabled={disableServiceSelect}
              >
                <option value="">Select a Service</option>
                {(servicesQuery.data ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {!isGlobal ? (
            <label className="block">
              <span className="text-sm text-zinc-700">Route</span>
              <select
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 disabled:bg-zinc-50 disabled:text-zinc-500"
                value={routeId}
                onChange={(e) => {
                  setRouteId(e.target.value);
                  setServiceId('');
                  setConsumerId('');
                }}
                disabled={disableRouteSelect}
              >
                <option value="">Select a Route</option>
                {(routesQuery.data ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name ?? r.paths.join(', ')}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {!isGlobal ? (
            <label className="block">
              <span className="text-sm text-zinc-700">Consumer ID (uuid)</span>
              <input
                className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
                value={consumerId}
                onChange={(e) => {
                  setConsumerId(e.target.value);
                  if (e.target.value.trim()) {
                    setServiceId('');
                    setRouteId('');
                  }
                }}
                placeholder="uuid-do-consumer"
              />
            </label>
          ) : null}

          <label className="block">
            <span className="text-sm text-zinc-700">Tags (opcional, vírgula)</span>
            <input
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="prod,edge"
            />
          </label>

          <div className="sm:col-span-2">
            {pluginSchemaQuery.data ? (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                <div className="text-sm font-semibold text-zinc-900">Config</div>
                <div className="mt-1 text-xs text-zinc-600">Preencha os campos com base no schema do plugin.</div>

                <div className="mt-3">
                  <PluginSchemaConfigPanel
                    schema={pluginSchemaQuery.data}
                    onConfigChange={handleConfigChange}
                    onProtocolsChange={handleProtocolsChange}
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Selecione um plugin para carregar o schema.
              </div>
            )}
          </div>

          <button
            className="rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-50 sm:col-span-2"
            disabled={
              createPluginMutation.isPending ||
              servicesQuery.isLoading ||
              routesQuery.isLoading ||
              !pluginSchemaQuery.data ||
              (isScoped && !hasScopeSelection)
            }
            type="submit"
          >
            {createPluginMutation.isPending ? 'Criando…' : 'Criar'}
          </button>
        </form>

        {isScoped && !hasScopeSelection ? (
          <div className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            Se Scope=Scoped, selecione um Service, Route ou Consumer.
          </div>
        ) : null}

        {createPluginMutation.isError ? (
          <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700">
            Falha ao criar plugin (precisa ser admin/owner).
          </div>
        ) : null}

        {servicesQuery.isError ? (
          <div className="mt-3 text-sm text-red-700">Falha ao carregar services.</div>
        ) : null}
        {routesQuery.isError ? (
          <div className="mt-1 text-sm text-red-700">Falha ao carregar routes.</div>
        ) : null}
      </div>
    </div>
  );
}
