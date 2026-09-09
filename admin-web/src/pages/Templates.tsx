import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ChevronDown,
  Copy,
  FileCheck2,
  Plus,
  Send,
  Trash2,
  Power,
  PenLine,
} from "lucide-react";
import { useSession, useUser } from "../auth";
import {
  Empty,
  ErrorPanel,
  Loading,
  Notice,
  PageHeader,
  RefreshButton,
  SearchBox,
  ValidationErrors,
} from "../components";
import {
  MEASUREMENT_LIMIT,
  ITEM_STATUSES,
  createTemplateDraft,
  newItem,
  newSection,
  templatePayload,
  validateTemplate,
  validateVehicleTypeAssignment,
  type ItemDraft,
  type SectionDraft,
  type TemplateDraft,
} from "../domain";
import { copy, number } from "../i18n";
import type { ChecklistTemplate } from "../types";
import { useVehicleTypes, VehicleTypeField } from "../vehicleTypes";

export default function Templates() {
  const { api } = useSession();
  const user = useUser();
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: ["templates"],
    queryFn: ({ signal }) => api.get<ChecklistTemplate[]>("/templates", signal),
  });
  const canManage = ["Administrator", "Supervisor"].includes(user.role);
  const templates = query.data?.filter((t) =>
    `${t.name} ${t.vehicleType}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  return (
    <>
      <PageHeader
        title="Checklists"
        description="Organize os critérios da inspeção e publique versões para os tablets."
        action={
          <>
            <RefreshButton
              refresh={() => void query.refetch()}
              busy={query.isFetching}
            />
            {canManage && (
              <Link className="button primary" to="/templates/new">
                <Plus size={17} />
                Criar checklist
              </Link>
            )}
          </>
        }
      />
      <Notice>
        Uma versão publicada é preservada no histórico. Para alterar um
        checklist, crie e publique uma nova versão.
      </Notice>
      <div className="toolbar standalone">
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="Nome do checklist ou tipo de veículo"
          label="Pesquisar checklists"
        />
        {templates && (
          <span className="result-count">
            {number(templates.length)} versões
          </span>
        )}
      </div>
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorPanel error={query.error} retry={() => void query.refetch()} />
      ) : !templates?.length ? (
        <Empty
          title="Nenhum checklist encontrado"
          description={
            search
              ? "Tente outro nome ou tipo de veículo."
              : "Crie seções e itens para o tipo de veículo que será inspecionado."
          }
        />
      ) : (
        <div className="template-list">
          {templates.map((template) => (
            <TemplateCard
              template={template}
              canManage={canManage}
              key={template.id}
            />
          ))}
        </div>
      )}
    </>
  );
}

function TemplateCard({
  template,
  canManage,
}: {
  template: ChecklistTemplate;
  canManage: boolean;
}) {
  const { api } = useSession();
  const cache = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const availability = useMutation({
    mutationFn: () =>
      api.send<ChecklistTemplate>(
        `/templates/${template.id}/${template.active === false ? "activate" : "retire"}`,
        "POST",
      ),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["templates"] }),
  });
  const mutation = useMutation({
    mutationFn: () =>
      api.send<ChecklistTemplate>(`/templates/${template.id}/publish`, "POST"),
    onSuccess: async () => {
      setConfirm(false);
      await cache.invalidateQueries({ queryKey: ["templates"] });
    },
  });
  const items = template.sections.flatMap((s) => s.items);
  const validation = validateTemplate(createTemplateDraft(template));
  return (
    <article className="panel template-card">
      <div className="template-heading">
        <div className="template-title">
          <span className="template-icon">
            <FileCheck2 size={25} />
          </span>
          <div>
            <h2>{template.name}</h2>
            <p>
              {template.vehicleType}{" "}
              <span className="version-chip">Versão {template.version}</span>
            </p>
          </div>
        </div>
        <span
          className={`badge ${template.published ? "status-OK" : "state-Draft"}`}
        >
          {template.published ? (
            <>
              <CheckCircle2 size={13} />
              Publicada
            </>
          ) : (
            "Não publicada"
          )}
        </span>
      </div>
      <div className="template-stats">
        <span
          className={`badge ${template.active === false ? "status-NotApplicable" : "status-OK"}`}
        >
          {template.active === false
            ? "Desativada para novas inspeções"
            : "Ativa"}
        </span>
        {template.requiresSignature && (
          <span>
            <PenLine size={14} /> Assinatura obrigatória
          </span>
        )}
        <span>{template.sections.length} seções</span>
        <span>{items.length} itens</span>
        <span>{items.filter((i) => i.required).length} obrigatórios</span>
        <span>
          {items.filter((i) => i.responseType === "measurement").length}{" "}
          medições
        </span>
      </div>
      <details className="template-preview">
        <summary>
          Conferir seções e itens
          <ChevronDown size={16} />
        </summary>
        {template.sections.map((section) => (
          <div className="preview-section" key={section.id}>
            <h3>{section.title}</h3>
            <ul>
              {section.items.map((item) => (
                <li key={item.id}>
                  <span>
                    {item.label}
                    {item.required && <small>Obrigatório</small>}
                  </span>
                  <span>
                    {item.responseType === "measurement"
                      ? `Medição (${item.unit || "sem unidade"})`
                      : "Avaliação por status"}
                    {item.responseType === "measurement" &&
                      (item.minValue !== null || item.maxValue !== null) && (
                        <small>
                          Entrada: {item.minValue ?? "sem mínimo"} a{" "}
                          {item.maxValue ?? "sem máximo"}
                        </small>
                      )}
                    <small>
                      Opções:{" "}
                      {(item.allowedStatuses ?? ITEM_STATUSES)
                        .map((status) => copy.status[status])
                        .join(" · ")}
                    </small>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </details>
      {canManage && (
        <div className="template-actions">
          <Link
            className="button secondary"
            to={`/templates/new?from=${template.id}`}
          >
            <Copy size={16} />
            Criar nova versão
          </Link>
          {!template.published && (
            <button
              className="button primary"
              onClick={() => setConfirm(!confirm)}
              disabled={
                mutation.isPending ||
                availability.isPending ||
                template.active === false ||
                validation.length > 0
              }
            >
              <Send size={16} />
              Publicar versão {template.version}
            </button>
          )}
          <button
            type="button"
            className="button secondary"
            disabled={availability.isPending || mutation.isPending}
            onClick={() => {
              if (
                template.active === false ||
                window.confirm(
                  "Desativar esta versão para novas inspeções? O histórico e as inspeções já iniciadas serão preservados.",
                )
              )
                availability.mutate();
            }}
          >
            <Power size={16} />
            {availability.isPending
              ? "Atualizando…"
              : template.active === false
                ? "Reativar versão"
                : "Desativar versão"}
          </button>
        </div>
      )}
      {availability.isError && <ErrorPanel error={availability.error} />}
      {availability.isSuccess && (
        <Notice tone="success">
          Disponibilidade da versão atualizada. As inspeções já iniciadas foram
          preservadas.
        </Notice>
      )}
      {!template.published && validation.length > 0 && canManage && (
        <Notice tone="warning">
          Esta versão contém campos incompletos. Crie uma nova versão para
          corrigir antes de publicar.
        </Notice>
      )}
      {confirm && (
        <div className="publish-confirm">
          <strong>
            Disponibilizar a versão {template.version} para os tablets?
          </strong>
          <p>
            Os itens desta versão serão preservados. Novas alterações exigirão
            outra versão.
          </p>
          <div className="inline-actions">
            <button
              className="button secondary"
              onClick={() => setConfirm(false)}
              disabled={mutation.isPending}
            >
              Cancelar
            </button>
            <button
              className="button primary"
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Publicando…" : "Publicar agora"}
            </button>
          </div>
        </div>
      )}
      {mutation.isError && <ErrorPanel error={mutation.error} />}
      {mutation.isSuccess && (
        <Notice tone="success">
          Versão publicada com histórico preservado.
        </Notice>
      )}
    </article>
  );
}

export function TemplateEditorPage() {
  const [params] = useSearchParams();
  const from = params.get("from");
  const { api } = useSession();
  const query = useQuery({
    queryKey: ["templates"],
    queryFn: ({ signal }) => api.get<ChecklistTemplate[]>("/templates", signal),
    enabled: Boolean(from),
  });
  if (from && query.isPending) return <Loading />;
  if (from && query.isError)
    return (
      <ErrorPanel error={query.error} retry={() => void query.refetch()} />
    );
  const source = query.data?.find((template) => template.id === from);
  if (from && !source)
    return (
      <>
        <PageHeader title="Versão indisponível" back="/templates" />
        <Notice tone="warning">
          O checklist de origem não está disponível no seu acesso. Atualize a
          lista de checklists.
        </Notice>
      </>
    );
  return (
    <>
      <PageHeader
        back="/templates"
        title={source ? `Nova versão de ${source.name}` : "Criar checklist"}
        description={
          source
            ? `Baseado na versão ${source.version}. O histórico anterior será preservado.`
            : "Defina o que a equipe precisa verificar em cada veículo."
        }
      />
      <TemplateEditor key={from || "new"} source={source} />
    </>
  );
}

function TemplateEditor({ source }: { source?: ChecklistTemplate }) {
  const { api } = useSession();
  const cache = useQueryClient();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<TemplateDraft>(() =>
    createTemplateDraft(source),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [dirty, setDirty] = useState(false);
  const vehicleTypes = useVehicleTypes();
  const mutation = useMutation({
    mutationFn: () =>
      api.send<ChecklistTemplate>("/templates", "POST", templatePayload(draft)),
    onSuccess: async () => {
      setDirty(false);
      await cache.invalidateQueries({ queryKey: ["templates"] });
      navigate("/templates");
    },
  });
  function update(next: TemplateDraft) {
    setDraft(next);
    setDirty(true);
  }
  function section(index: number, patch: Partial<SectionDraft>) {
    update({
      ...draft,
      sections: draft.sections.map((s, i) =>
        i === index ? { ...s, ...patch } : s,
      ),
    });
  }
  function item(si: number, ii: number, patch: Partial<ItemDraft>) {
    section(si, {
      items: draft.sections[si].items.map((i, n) =>
        n === ii ? { ...i, ...patch } : i,
      ),
    });
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    const validation = validateTemplate(draft);
    validation.push(
      ...validateVehicleTypeAssignment(
        draft.vehicleType,
        vehicleTypes.data || [],
      ),
    );
    setErrors(validation);
    if (!validation.length) mutation.mutate();
  }
  function cancel() {
    if (
      !dirty ||
      window.confirm(
        "Descartar as alterações ainda não salvas deste checklist?",
      )
    )
      navigate("/templates");
  }
  return (
    <form className="template-editor" onSubmit={submit}>
      <div className="panel editor-panel">
        <ValidationErrors errors={errors} />
        {mutation.isError && <ErrorPanel error={mutation.error} />}
        <fieldset disabled={mutation.isPending}>
          <legend>Identificação do checklist</legend>
          <div className="form-grid">
            <label>
              Nome do checklist
              <input
                required
                maxLength={160}
                value={draft.name}
                onChange={(e) => update({ ...draft, name: e.target.value })}
                placeholder="Ex.: Inspeção de entrada"
              />
            </label>
            <VehicleTypeField
              query={vehicleTypes}
              value={draft.vehicleType}
              existingCode={source?.vehicleType}
              onChange={(vehicleType) => update({ ...draft, vehicleType })}
            />
          </div>
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={draft.requiresSignature}
              onChange={(e) =>
                update({ ...draft, requiresSignature: e.target.checked })
              }
            />
            Exigir assinatura ao finalizar a inspeção
          </label>
          <p className="field-help">
            A assinatura é registrada no tablet. Seu envio é acompanhado com as
            demais evidências.
          </p>
        </fieldset>
      </div>
      <Notice>
        Os limites de medição validam a entrada numérica. A condição do
        componente é indicada pelo status escolhido pelo inspetor, incluindo
        Crítico. Use até 4 casas decimais, entre -99.999.999.999.999 e
        99.999.999.999.999. Os valores não são arredondados automaticamente.
      </Notice>
      {draft.sections.map((s, si) => (
        <section className="panel section-editor" key={s.key}>
          <div className="section-editor-heading">
            <span className="section-number">{si + 1}</span>
            <label>
              <span className="sr-only">Título da seção {si + 1}</span>
              <input
                required
                maxLength={160}
                value={s.title}
                onChange={(e) => section(si, { title: e.target.value })}
                placeholder="Título da seção, como Pneus e rodas"
                disabled={mutation.isPending}
              />
            </label>
            <div className="order-actions">
              <button
                type="button"
                className="icon-button"
                aria-label={`Mover seção ${si + 1} para cima`}
                disabled={si === 0 || mutation.isPending}
                onClick={() =>
                  update({ ...draft, sections: move(draft.sections, si, -1) })
                }
              >
                <ArrowUp size={17} />
              </button>
              <button
                type="button"
                className="icon-button"
                aria-label={`Mover seção ${si + 1} para baixo`}
                disabled={
                  si === draft.sections.length - 1 || mutation.isPending
                }
                onClick={() =>
                  update({ ...draft, sections: move(draft.sections, si, 1) })
                }
              >
                <ArrowDown size={17} />
              </button>
              <button
                type="button"
                className="icon-button danger-text"
                aria-label={`Remover seção ${si + 1}`}
                disabled={mutation.isPending}
                onClick={() => {
                  if (
                    window.confirm(
                      `Remover a seção ${s.title || si + 1} e seus itens desta nova versão?`,
                    )
                  )
                    update({
                      ...draft,
                      sections: draft.sections.filter((_, n) => n !== si),
                    });
                }}
              >
                <Trash2 size={17} />
              </button>
            </div>
          </div>
          <div className="section-items">
            {s.items.map((i, ii) => (
              <fieldset
                className="item-editor"
                key={i.key}
                disabled={mutation.isPending}
              >
                <legend>Item {ii + 1}</legend>
                <div className="item-fields">
                  <label className="item-label">
                    Descrição do item
                    <input
                      required
                      value={i.label}
                      maxLength={240}
                      onChange={(e) => item(si, ii, { label: e.target.value })}
                      placeholder="O que deve ser verificado?"
                    />
                  </label>
                  <label>
                    Resposta
                    <select
                      value={i.responseType}
                      onChange={(e) =>
                        item(si, ii, {
                          responseType: e.target
                            .value as ItemDraft["responseType"],
                        })
                      }
                    >
                      <option value="status">Avaliação por status</option>
                      <option value="measurement">Medição e status</option>
                    </select>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={i.required}
                      onChange={(e) =>
                        item(si, ii, { required: e.target.checked })
                      }
                    />
                    Obrigatório
                  </label>
                  <div className="order-actions">
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Mover item ${ii + 1} da seção ${si + 1} para cima`}
                      disabled={ii === 0}
                      onClick={() =>
                        section(si, { items: move(s.items, ii, -1) })
                      }
                    >
                      <ArrowUp size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Mover item ${ii + 1} da seção ${si + 1} para baixo`}
                      disabled={ii === s.items.length - 1}
                      onClick={() =>
                        section(si, { items: move(s.items, ii, 1) })
                      }
                    >
                      <ArrowDown size={16} />
                    </button>
                    <button
                      type="button"
                      className="icon-button danger-text"
                      aria-label={`Remover item ${ii + 1} da seção ${si + 1}`}
                      onClick={() =>
                        section(si, {
                          items: s.items.filter((_, n) => n !== ii),
                        })
                      }
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <fieldset className="status-options">
                  <legend>Opções de resposta</legend>
                  <div className="status-option-list">
                    {ITEM_STATUSES.map((status) => (
                      <label className="checkbox-label" key={status}>
                        <input
                          type="checkbox"
                          checked={(
                            i.allowedStatuses ?? ITEM_STATUSES
                          ).includes(status)}
                          onChange={(event) => {
                            const selected = i.allowedStatuses ?? ITEM_STATUSES;
                            item(si, ii, {
                              allowedStatuses: event.target.checked
                                ? [...selected, status]
                                : selected.filter(
                                    (option) => option !== status,
                                  ),
                            });
                          }}
                        />
                        {copy.status[status]}
                      </label>
                    ))}
                  </div>
                  <p className="field-help">
                    Selecione pelo menos uma opção. Itens obrigatórios precisam
                    de uma opção além de Não aplicável.
                  </p>
                </fieldset>
                {i.responseType === "measurement" && (
                  <div className="measurement-fields">
                    <label>
                      Unidade
                      <input
                        required
                        maxLength={30}
                        placeholder="mm, bar, °C…"
                        value={i.unit}
                        onChange={(e) => item(si, ii, { unit: e.target.value })}
                      />
                    </label>
                    <label>
                      Limite de entrada mínimo
                      <input
                        type="number"
                        step="0.0001"
                        min={-MEASUREMENT_LIMIT}
                        max={MEASUREMENT_LIMIT}
                        placeholder="Sem limite"
                        value={i.minValue}
                        onChange={(e) =>
                          item(si, ii, { minValue: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Limite de entrada máximo
                      <input
                        type="number"
                        step="0.0001"
                        min={-MEASUREMENT_LIMIT}
                        max={MEASUREMENT_LIMIT}
                        placeholder="Sem limite"
                        value={i.maxValue}
                        onChange={(e) =>
                          item(si, ii, { maxValue: e.target.value })
                        }
                      />
                    </label>
                  </div>
                )}
              </fieldset>
            ))}
          </div>
          <button
            type="button"
            className="text-button add-item"
            disabled={mutation.isPending}
            onClick={() => section(si, { items: [...s.items, newItem()] })}
          >
            <Plus size={17} />
            Adicionar item
          </button>
        </section>
      ))}
      <button
        type="button"
        className="button secondary add-section"
        disabled={mutation.isPending}
        onClick={() =>
          update({ ...draft, sections: [...draft.sections, newSection()] })
        }
      >
        <Plus size={17} />
        Adicionar seção
      </button>
      <div className="editor-save-bar">
        <div>
          <strong>
            {draft.sections.length} seções •{" "}
            {draft.sections.reduce((sum, s) => sum + s.items.length, 0)} itens
          </strong>
          <span>Salve para revisar a versão antes de publicar.</span>
        </div>
        <div className="inline-actions">
          <button
            type="button"
            className="button secondary"
            onClick={cancel}
            disabled={mutation.isPending}
          >
            Cancelar
          </button>
          <button
            className="button primary"
            disabled={mutation.isPending || !vehicleTypes.data}
          >
            {mutation.isPending ? copy.common.saving : "Salvar nova versão"}
          </button>
        </div>
      </div>
    </form>
  );
}
function move<T>(items: T[], index: number, direction: number): T[] {
  const result = [...items];
  const target = index + direction;
  if (target >= 0 && target < items.length)
    [result[index], result[target]] = [result[target], result[index]];
  return result;
}
