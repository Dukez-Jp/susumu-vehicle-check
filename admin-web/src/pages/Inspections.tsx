import { useEffect, useState } from "react";
import { useIsFetching, useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Camera,
  Download,
  ExternalLink,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { useSession, useUser } from "../auth";
import {
  Empty,
  ErrorPanel,
  InspectionState,
  InspectionTable,
  Loading,
  Notice,
  PageHeader,
  RefreshButton,
  StatusBadge,
} from "../components";
import { photoSummary } from "../domain";
import { copy, dateTime, number } from "../i18n";
import type {
  ChecklistTemplate,
  Inspection,
  InspectionItem,
  Photo,
  Vehicle,
} from "../types";
import { ExportButton } from "./Dashboard";
import { LoadMore, usePaged } from "../pagination";

export default function Inspections() {
  const { api } = useSession();
  const [params, setParams] = useSearchParams();
  const vehicleId = params.get("vehicleId") || "";
  const state = params.get("state") || "";
  const finding = params.get("finding") || "";
  const photos = params.get("photos") || "";
  const from = params.get("from") || "";
  const until = params.get("until") || "";
  const query = usePaged<Inspection>(
    "inspections",
    `/inspections?${new URLSearchParams({ ...(vehicleId ? { vehicleId } : {}), ...(state ? { state } : {}) })}`,
  );
  const vehicles = useQuery({
    queryKey: ["vehicles", ""],
    queryFn: ({ signal }) => api.get<Vehicle[]>("/vehicles", signal),
  });
  function filter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  }
  const records = query.rows?.filter(
    (i) =>
      (!finding || i.items.some((item) => item.status === "Critical")) &&
      (!photos || i.photoUploadState === "Pending") &&
      (!from || new Date(i.startedAt) >= new Date(`${from}T00:00:00`)) &&
      (!until || new Date(i.startedAt) <= new Date(`${until}T23:59:59.999`)),
  );
  return (
    <>
      <PageHeader
        title="Inspeções"
        description="Consulte os resultados, as evidências e o histórico da oficina."
        action={
          <>
            <RefreshButton
              refresh={() => void query.refetch()}
              busy={query.isFetching}
            />
            <ExportButton />
          </>
        }
      />
      <section className="panel">
        <div className="filter-grid">
          <label>
            Veículo
            <select
              value={vehicleId}
              onChange={(e) => filter("vehicleId", e.target.value)}
            >
              <option value="">Todos os veículos</option>
              {vehicles.data?.map((v) => (
                <option value={v.id} key={v.id}>
                  {v.internalNumber} • {v.plate || "Sem placa"}
                </option>
              ))}
            </select>
          </label>
          <label>
            Situação
            <select
              value={state}
              onChange={(e) => filter("state", e.target.value)}
            >
              <option value="">Todas as situações</option>
              <option value="Draft">Em andamento</option>
              <option value="Finalized">Finalizadas</option>
            </select>
          </label>
          <label>
            Ocorrências
            <select
              value={finding}
              onChange={(e) => filter("finding", e.target.value)}
            >
              <option value="">Todos os resultados</option>
              <option value="critical">Com itens críticos</option>
            </select>
          </label>
          <label>
            Evidências
            <select
              value={photos}
              onChange={(e) => filter("photos", e.target.value)}
            >
              <option value="">Todas as evidências</option>
              <option value="pending">Fotos pendentes</option>
            </select>
          </label>
          <label>
            De
            <input
              type="date"
              value={from}
              max={until || undefined}
              onChange={(e) => filter("from", e.target.value)}
            />
          </label>
          <label>
            Até
            <input
              type="date"
              value={until}
              min={from || undefined}
              onChange={(e) => filter("until", e.target.value)}
            />
          </label>
        </div>
        <div className="filter-summary">
          <span>
            {records
              ? `${number(records.length)} inspeções nesta consulta`
              : "Consultando registros…"}
          </span>
          {params.size > 0 && (
            <button className="text-button" onClick={() => setParams({})}>
              Limpar filtros
            </button>
          )}
        </div>
        {vehicles.isError && (
          <ErrorPanel
            error={vehicles.error}
            retry={() => void vehicles.refetch()}
          />
        )}
        {query.isPending ? (
          <Loading />
        ) : query.isError && !query.data ? (
          <ErrorPanel error={query.error} retry={() => void query.refetch()} />
        ) : !records?.length ? (
          <Empty
            title="Nenhuma inspeção nesta consulta"
            description="Altere os filtros ou aguarde a sincronização dos registros do tablet."
          />
        ) : (
          <InspectionTable
            inspections={records}
            vehicles={vehicles.data || []}
          />
        )}
        {query.data && <LoadMore query={query} />}
      </section>
      <p className="list-note">
        Carregue mais registros para consultar o histórico anterior. Os filtros
        de data, ocorrências e fotos se aplicam aos registros carregados. O CSV
        inclui todas as inspeções disponíveis para o seu acesso.
      </p>
    </>
  );
}

export function InspectionDetail() {
  const { id = "" } = useParams();
  const { api } = useSession();
  const user = useUser();
  const photosLoading = useIsFetching({ queryKey: ["photo", id] });
  const [printing, setPrinting] = useState(false);
  async function printReport() {
    setPrinting(true);
    // Decode before opening the browser print dialog. Failed images have explicit placeholders.
    await Promise.all(
      Array.from(
        document.querySelectorAll<HTMLImageElement>(".inspection-report img"),
      ).map((image) => image.decode().catch(() => undefined)),
    );
    window.print();
    setPrinting(false);
  }
  const query = useQuery({
    queryKey: ["inspection", id],
    queryFn: ({ signal }) => api.get<Inspection>(`/inspections/${id}`, signal),
  });
  const templates = useQuery({
    queryKey: ["templates"],
    queryFn: ({ signal }) => api.get<ChecklistTemplate[]>("/templates", signal),
  });
  const vehicle = useQuery({
    queryKey: ["vehicle", query.data?.vehicleId],
    enabled: Boolean(query.data?.vehicleId),
    queryFn: ({ signal }) =>
      api.get<Vehicle>(`/vehicles/${query.data!.vehicleId}`, signal),
  });
  const correctionsQuery = usePaged<Inspection>(
    "inspection-corrections",
    `/inspections?supersedesInspectionId=${encodeURIComponent(id)}`,
    Boolean(query.data),
  );
  if (query.isPending) return <Loading />;
  if (query.isError)
    return (
      <ErrorPanel error={query.error} retry={() => void query.refetch()} />
    );
  const inspection = query.data;
  const template = templates.data?.find(
    (t) =>
      t.id === inspection.templateId &&
      t.version === inspection.templateVersion,
  );
  const corrections = correctionsQuery.rows || [];
  return (
    <>
      <PageHeader
        back="/inspections"
        title={`Inspeção ${vehicle.data?.internalNumber || inspection.id.slice(0, 8)}`}
        description={`${dateTime(inspection.startedAt)} • ${inspection.createdByName || "Responsável não informado"}`}
        action={
          <>
            <RefreshButton
              refresh={() => {
                void query.refetch();
                void correctionsQuery.refetch();
              }}
              busy={query.isFetching || correctionsQuery.isFetching}
            />
            <button
              className="button primary"
              onClick={() => void printReport()}
              disabled={
                templates.isPending ||
                vehicle.isPending ||
                correctionsQuery.isPending ||
                correctionsQuery.isFetching ||
                photosLoading > 0 ||
                printing
              }
            >
              <Printer size={17} />
              {photosLoading
                ? "Carregando evidências…"
                : printing
                  ? "Preparando impressão…"
                  : copy.common.print}
            </button>
          </>
        }
      />
      <div className="no-print">
        {templates.isError && (
          <ErrorPanel
            error={templates.error}
            retry={() => void templates.refetch()}
          />
        )}
        {vehicle.isError && (
          <ErrorPanel
            error={vehicle.error}
            retry={() => void vehicle.refetch()}
          />
        )}
      </div>
      {inspection.state === "Draft" && (
        <Notice tone="warning">
          Inspeção em andamento. O relatório é parcial e pode mudar até a
          finalização no tablet.
        </Notice>
      )}
      {correctionsQuery.isPending && (
        <Notice>Verificando se existem correções desta inspeção…</Notice>
      )}
      {correctionsQuery.isError && (
        <Notice tone="warning">
          Não foi possível verificar correções desta inspeção. A consulta pode
          estar incompleta; atualize antes de usar este relatório para uma
          decisão.
        </Notice>
      )}
      {corrections.length > 0 && (
        <Notice tone="warning">
          <strong>Esta inspeção possui correções registradas.</strong>
          <p>Consulte as revisões antes de tomar uma decisão.</p>
          <ul>
            {corrections.map((i) => (
              <li key={i.id}>
                <Link to={`/inspections/${i.id}`}>
                  {dateTime(i.startedAt)} ({copy.state[i.state]}) •{" "}
                  {i.id.slice(0, 8)}
                </Link>
              </li>
            ))}
          </ul>
          {correctionsQuery.hasNextPage && (
            <p>
              Pode haver outras revisões. Use Carregar mais registros para
              continuar a consulta.
            </p>
          )}
        </Notice>
      )}
      {correctionsQuery.data && correctionsQuery.hasNextPage && (
        <LoadMore query={correctionsQuery} />
      )}
      <InspectionReport
        inspection={inspection}
        template={template}
        vehicle={vehicle.data}
      />
      <section className="panel history-panel no-print">
        <div className="panel-header">
          <div>
            <h2>Rastreabilidade</h2>
            <p>Registro original, dispositivo e histórico do veículo.</p>
          </div>
          {["Administrator", "Supervisor"].includes(user.role) && (
            <Link className="button secondary" to={`/audit?inspectionId=${id}`}>
              <ShieldCheck size={16} />
              Ver auditoria
            </Link>
          )}
        </div>
        <dl className="trace-grid">
          <div>
            <dt>ID da inspeção</dt>
            <dd className="id-value">{inspection.id}</dd>
          </div>
          <div>
            <dt>Dispositivo</dt>
            <dd className="id-value">{inspection.deviceId}</dd>
          </div>
          <div>
            <dt>Recebida no servidor</dt>
            <dd>{dateTime(inspection.receivedAt)}</dd>
          </div>
          <div>
            <dt>Revisão do registro</dt>
            <dd>{inspection.version}</dd>
          </div>
        </dl>
        <Link className="text-link" to={`/vehicles/${inspection.vehicleId}`}>
          Ver todas as inspeções deste veículo
          <ExternalLink size={15} />
        </Link>
        {correctionsQuery.isError && (
          <ErrorPanel
            error={correctionsQuery.error}
            retry={() => void correctionsQuery.refetch()}
          />
        )}
      </section>
    </>
  );
}

export function InspectionReport({
  inspection,
  template,
  vehicle,
}: {
  inspection: Inspection;
  template?: ChecklistTemplate;
  vehicle?: Vehicle;
}) {
  const summary = photoSummary(inspection);
  const responses = new Map(inspection.items.map((i) => [i.itemId, i]));
  const knownIds = new Set(
    template?.sections.flatMap((s) => s.items.map((i) => i.id)) || [],
  );
  const unrecognized = inspection.items.filter((i) => !knownIds.has(i.itemId));
  const metadata = inspection.photos || [];
  const knownPhotoIds = new Set(metadata.map((p) => p.id));
  const missingIds = [
    ...new Set([
      ...inspection.items.flatMap((i) => i.photoIds),
      ...(inspection.signaturePhotoId ? [inspection.signaturePhotoId] : []),
    ]),
  ].filter((photoId) => !knownPhotoIds.has(photoId));
  return (
    <article className="inspection-report panel">
      <header className="report-header">
        <div>
          <span className="report-brand">Susumu Vehicle Check</span>
          <h2>Relatório de inspeção</h2>
          <p>
            {vehicle
              ? `${vehicle.internalNumber} • ${vehicle.plate || "Sem placa"} • ${vehicle.type}`
              : `Veículo ${inspection.vehicleId}`}
          </p>
        </div>
        <InspectionState state={inspection.state} />
      </header>
      <dl className="report-facts">
        <div>
          <dt>Iniciada em</dt>
          <dd>{dateTime(inspection.startedAt)}</dd>
        </div>
        <div>
          <dt>Finalizada em</dt>
          <dd>
            {inspection.finalizedAt
              ? dateTime(inspection.finalizedAt)
              : "Ainda não finalizada"}
          </dd>
        </div>
        <div>
          <dt>Responsável</dt>
          <dd>{inspection.createdByName || inspection.createdBy}</dd>
        </div>
        <div>
          <dt>Quilometragem</dt>
          <dd>{number(inspection.odometerKm)} km</dd>
        </div>
        <div className="wide">
          <dt>Checklist utilizado</dt>
          <dd>
            {template?.name || "Nome do checklist indisponível"}{" "}
            <strong>• Versão {inspection.templateVersion}</strong>
            <span className="report-id">{inspection.templateId}</span>
          </dd>
        </div>
        <div>
          <dt>Evidências recebidas</dt>
          <dd>
            {summary.uploaded} de {summary.declared} fotos
          </dd>
        </div>
        <div>
          <dt>Revisão do registro</dt>
          <dd>{inspection.version}</dd>
        </div>
        <div>
          <dt>Assinatura</dt>
          <dd>
            {inspection.signaturePhotoId
              ? "Declarada pelo tablet"
              : template?.requiresSignature
                ? "Obrigatória, não declarada"
                : "Não exigida"}
          </dd>
        </div>
      </dl>
      {!summary.complete && (
        <div className="report-warning" role="status">
          <Camera size={20} />
          <div>
            <strong>Fotos pendentes de sincronização</strong>
            <p>
              Este relatório ainda não contém todas as evidências declaradas no
              tablet. A finalização da inspeção não confirma o recebimento de
              todas as fotos.
            </p>
          </div>
        </div>
      )}
      {summary.complete && (
        <div className="report-confirmation">
          <ShieldCheck size={17} />
          {summary.declared
            ? "Todas as fotos declaradas foram recebidas."
            : "Nenhuma foto foi declarada nesta inspeção."}
        </div>
      )}
      {!template && (
        <Notice tone="warning">
          A versão exata do checklist não está disponível nesta consulta. Os
          resultados abaixo são identificados pelo código do item.
        </Notice>
      )}
      {inspection.supersedesInspectionId && (
        <div className="correction-box">
          <strong>Correção de uma inspeção anterior</strong>
          <p>Motivo: {inspection.correctionReason || "Não informado"}</p>
          <Link to={`/inspections/${inspection.supersedesInspectionId}`}>
            Registro original: {inspection.supersedesInspectionId}
          </Link>
        </div>
      )}
      {template?.sections.map((section) => (
        <section className="report-section" key={section.id}>
          <h3>{section.title}</h3>
          <div className="table-scroll">
            <table className="report-table">
              <thead>
                <tr>
                  <th scope="col">Item verificado</th>
                  <th scope="col">Resultado</th>
                  <th scope="col">Medição</th>
                  <th scope="col">Observações</th>
                </tr>
              </thead>
              <tbody>
                {section.items.map((item) => (
                  <ReportRow
                    key={item.id}
                    label={item.label}
                    response={responses.get(item.id)}
                    unit={item.unit}
                    required={item.required}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
      {unrecognized.length > 0 && (
        <section className="report-section">
          <h3>
            {template
              ? "Resultados adicionais não mapeados"
              : "Resultados registrados"}
          </h3>
          <div className="table-scroll">
            <table className="report-table">
              <thead>
                <tr>
                  <th scope="col">Código do item</th>
                  <th scope="col">Resultado</th>
                  <th scope="col">Medição</th>
                  <th scope="col">Observações</th>
                </tr>
              </thead>
              <tbody>
                {unrecognized.map((item) => (
                  <ReportRow
                    key={item.itemId}
                    label={item.itemId}
                    response={item}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      <section className="report-section report-notes">
        <h3>Observações da inspeção</h3>
        <p>{inspection.notes || "Nenhuma observação registrada."}</p>
      </section>
      <section className="report-section">
        <h3>
          Evidências fotográficas{" "}
          <span>
            {summary.uploaded}/{summary.declared}
          </span>
        </h3>
        {!summary.declared ? (
          <p className="muted">Nenhuma foto declarada.</p>
        ) : (
          <div className="photo-grid">
            {metadata.map((photo) => (
              <PhotoEvidence
                key={photo.id}
                photo={photo}
                label={
                  template?.sections
                    .flatMap((s) => s.items)
                    .find((i) => i.id === photo.itemId)?.label
                }
              />
            ))}
            {missingIds.map((photoId) => (
              <div className="photo-placeholder" key={photoId}>
                <Camera size={28} />
                <strong>
                  {photoId === inspection.signaturePhotoId
                    ? "Assinatura aguardando envio do tablet"
                    : "Aguardando envio do tablet"}
                </strong>
                <span className="id-value">{photoId}</span>
              </div>
            ))}
          </div>
        )}
      </section>
      <footer className="report-footer">
        <span>Registro: {inspection.id}</span>
        <span>Recebido: {dateTime(inspection.receivedAt)}</span>
        <span>Consulta emitida: {dateTime(new Date().toISOString())}</span>
      </footer>
    </article>
  );
}

function ReportRow({
  label,
  response,
  unit,
  required,
}: {
  label: string;
  response?: InspectionItem;
  unit?: string | null;
  required?: boolean;
}) {
  return (
    <tr>
      <th scope="row">
        {label}
        {required && <small className="required-note">Obrigatório</small>}
      </th>
      <td>
        {response ? (
          <StatusBadge status={response.status} />
        ) : (
          <span className="badge state-Draft">Não respondido</span>
        )}
      </td>
      <td>
        {response?.value != null
          ? `${number(response.value)} ${unit || ""}`
          : "—"}
      </td>
      <td className="report-item-notes">
        {response?.notes || "—"}
        {Boolean(response?.photoIds.length) && (
          <small>
            <Camera size={13} />
            {response!.photoIds.length} foto(s) declarada(s)
          </small>
        )}
      </td>
    </tr>
  );
}

function PhotoEvidence({ photo, label }: { photo: Photo; label?: string }) {
  const { api } = useSession();
  const [url, setUrl] = useState<string>();
  const [imageFailed, setImageFailed] = useState(false);
  const query = useQuery({
    queryKey: ["photo", photo.inspectionId, photo.id],
    enabled: photo.uploaded,
    queryFn: ({ signal }) =>
      api.blob(`/inspections/${photo.inspectionId}/photos/${photo.id}`, signal),
    staleTime: Infinity,
  });
  useEffect(() => {
    if (!query.data) return;
    const objectUrl = URL.createObjectURL(query.data);
    setImageFailed(false);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [query.data]);
  const kind =
    photo.kind === "Original"
      ? "Original preservada"
      : photo.kind === "Annotation"
        ? "Cópia anotada"
        : "Assinatura";
  return (
    <figure className="photo-evidence">
      {!photo.uploaded ? (
        <div className="photo-placeholder">
          <Camera size={28} />
          <strong>Aguardando envio do tablet</strong>
        </div>
      ) : query.isError ? (
        <ErrorPanel error={query.error} retry={() => void query.refetch()} />
      ) : imageFailed ? (
        <div className="photo-placeholder" role="alert">
          <Camera size={28} />
          <strong>Não foi possível exibir esta foto.</strong>
          <span>
            A evidência foi recebida pelo servidor, mas não foi incluída
            visualmente nesta consulta.
          </span>
          <button
            className="text-button no-print"
            onClick={() => void query.refetch()}
          >
            Carregar novamente
          </button>
        </div>
      ) : !url ? (
        <Loading label="Carregando foto…" />
      ) : (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Ampliar ${label || kind}`}
        >
          <img
            src={url}
            alt={`${kind}${label ? `: ${label}` : ""}`}
            onError={() => setImageFailed(true)}
          />
        </a>
      )}
      <figcaption>
        <strong>
          {label ||
            (photo.kind === "Signature"
              ? "Assinatura"
              : "Evidência da inspeção")}
        </strong>
        <span>
          {kind} •{" "}
          {photo.sizeBytes == null
            ? "Tamanho ainda não confirmado"
            : `${number(photo.sizeBytes / 1024)} KB`}
        </span>
        {photo.originalPhotoId && (
          <small>Original: {photo.originalPhotoId}</small>
        )}
        <small>{dateTime(photo.createdAt)}</small>
        {url && (
          <a
            className="text-link no-print"
            href={url}
            download={`${photo.id}.${photo.contentType === "image/png" ? "png" : "jpg"}`}
          >
            <Download size={14} />
            Baixar foto
          </a>
        )}
      </figcaption>
    </figure>
  );
}
