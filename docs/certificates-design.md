# Certificates (TLS) — desenho pro futuro (fora do MVP)

Data: 2026-01-01

Este documento descreve um desenho enxuto para a feature **Certificates** no control-plane (Web + API), pensado para quando o produto precisar gerenciar HTTPS de forma dinâmica (ex.: **custom domains por workspace**).

> Status: **NÃO entra no MVP atual**.
>
> Motivação: hoje TLS já é configurado na infra via Ingress + Secret (ex.: `api-gateway-tls`). A UI de Certificates existe, mas o backend ainda não implementa.

---

## 1) Conceito: certificado não é “por rota”

TLS/HTTPS acontece **antes** de existir HTTP routing. O certificado é escolhido por **Host/SNI** (ex.: `api-dev.grometis.com`), não por path/método.

Portanto, “Certificates” deve ser modelado como:
- **certificado por domínio/host** (ou wildcard)
- opcionalmente associado a um workspace (multi-tenant)

---

## 2) Decisão de arquitetura recomendada

### Opção recomendada: TLS termina no Ingress (Kubernetes)

O `api-gateway` (data-plane) recebe tráfego HTTP do Ingress (dentro do cluster). O Ingress termina TLS usando:
- `Ingress.spec.tls[].hosts[]`
- `Ingress.spec.tls[].secretName`

Benefícios:
- Aproveita **cert-manager** (Let’s Encrypt) e renovação automática
- Evita implementar SNI/hot-reload de certificados dentro do `api-gateway`
- Centraliza políticas TLS (redirect, HSTS, cipher suites)

**O que o control-plane passa a fazer:**
- Gerenciar “Domínios” e “Certificados” como recursos
- Aplicar mudanças criando/atualizando recursos Kubernetes (Ingress/Certificate/Secret) ou configurando um ingress “genérico” que referencia Secrets

### Opção alternativa: TLS termina no `api-gateway`

Só vale a pena se o produto precisar rodar sem Ingress (fora de K8s) ou se existir requisito específico de TLS no próprio gateway.

Custo:
- Implementar SNI, store de certs, rotação, reload
- Aumenta superfície de segurança no data-plane

---

## 3) Escopo funcional (o que “Certificates” faz)

### 3.1 Objetivo
Permitir que um workspace (ou o produto como um todo) use HTTPS em domínios definidos, com certificados gerenciáveis e rotacionáveis.

### 3.2 Entidades (modelo mínimo)

**GatewayDomain** (domínio/host)
- `id: uuid`
- `workspaceId: uuid`
- `hostname: string` (ex.: `api.cliente.com`)
- `tlsMode: 'managed' | 'provided'`
- `status: 'pending' | 'active' | 'error'`
- `createdAt/updatedAt`

**GatewayCertificate**
- `id: uuid`
- `workspaceId: uuid`
- `domainId: uuid` (ou `hostname`)
- `type: 'acme' | 'manual'`
- `secretName: string` (nome do Secret no namespace)
- `issuerRef?: { name: string; kind: 'Issuer'|'ClusterIssuer' }` (se ACME/cert-manager)
- `notBefore?: Date`
- `notAfter?: Date`
- `lastError?: string`
- `createdAt/updatedAt`

Observação: para `manual`, o material do certificado (PEM) **não precisa** ser persistido no banco se o target final é Kubernetes. O ideal é gravar direto em Secret e persistir apenas metadados.

---

## 4) Fluxos (TLS no Ingress)

### 4.1 Fluxo “ACME gerenciado” (cert-manager)
1) Usuário cria um domínio: `api.cliente.com`
2) Control-plane cria/atualiza:
   - um `Certificate` (cert-manager) apontando para um `Secret`
   - um `Ingress` (ou regra do Ingress existente) contendo `host: api.cliente.com` e `tls.secretName: <secret>`
3) cert-manager emite e renova automaticamente
4) UI mostra status: pending → active ou error

### 4.2 Fluxo “certificado fornecido” (manual)
1) Usuário cola/enviá `tls.crt` e `tls.key` (PEM)
2) Control-plane cria/atualiza o `Secret` do tipo `kubernetes.io/tls`
3) Control-plane cria/atualiza o `Ingress` com `tls.secretName`

### 4.3 Observação sobre “dinamismo”
Mesmo sendo Ingress, isso é dinâmico: atualizar Ingress/Secret/Certificate muda o comportamento em runtime.

---

## 5) API do control-plane (proposta)

> Prefixo: `/workspaces/:workspaceId`

### Domínios
- `GET /domains` → lista domínios
- `POST /domains` → cria domínio
- `GET /domains/:domainId`
- `DELETE /domains/:domainId`

### Certificados
- `GET /certificates` → lista certificados
- `POST /certificates` → cria certificado (ACME ou manual)
- `GET /certificates/:certificateId`
- `PATCH /certificates/:certificateId` → troca modo, renova/reaplica
- `DELETE /certificates/:certificateId`

Sugestão de payloads:
- ACME: `{ domainId, issuerRef }`
- Manual: `{ domainId, tlsCrtPem, tlsKeyPem }`

---

## 6) Web (UI) — proposta mínima

Reaproveitar as rotas já stubadas:
- `/w/[workspaceId]/gateway/certificates`
- `/w/[workspaceId]/gateway/certificates/new`
- `/w/[workspaceId]/gateway/certificates/[certificateId]`
- `/w/[workspaceId]/gateway/certificates/[certificateId]/edit`

Campos mínimos na UI:
- Hostname
- Modo: “Gerenciado (ACME)” ou “Manual”
- Status + validade (`notAfter`)
- Ações: criar, editar, deletar

---

## 7) Integração com Kubernetes (como aplicar mudanças)

### 7.1 Estratégia recomendada
O control-plane deve ter um “applier” que, dado o estado desejado (domínio + certificado), aplica:
- `Secret` (manual) OU `Certificate` (ACME)
- `Ingress` (host → service/port)

**Sugestão de isolamento:**
- Um módulo/serviço no backend: `KubernetesGatewayProvisioner`

### 7.2 Permissões
Em cluster, usar um ServiceAccount do control-plane com RBAC mínimo para:
- `get/list/watch/create/patch/update/delete` em `secrets`, `ingresses`, `certificates`

---

## 8) Segurança e boas práticas

- Para modo manual, evitar persistir PEM em banco (reduz impacto de vazamento)
- Validar:
  - `tls.key` corresponde a `tls.crt`
  - cadeia/cert expiração
  - hostname não conflita com domínios já usados
- Auditoria: registrar atividade (quem criou/trocou o cert)
- Rate-limit e proteção contra abuso (criação massiva de domínios)

---

## 9) Fora do MVP (explicitamente)

- Certificates (UI/CRUD + integração Kubernetes)
- Custom domain por workspace
- ACME/cert-manager integrado via API
- Observabilidade detalhada (eventos do cert-manager, timeline de emissão)

---

## 10) Checklist para implementar depois

1) Definir modelo (domínios e certificados) e migrations no `grometis-control-plane-api`
2) Implementar endpoints + guards (admin/owner)
3) Implementar provisioner Kubernetes (Secrets/Ingress/Certificate)
4) Completar UI nas páginas existentes (listar/criar/editar)
5) Testar em ambiente de dev/staging com cert-manager
