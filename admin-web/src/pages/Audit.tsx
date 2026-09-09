import { useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { LoadMore, usePaged } from "../pagination";
import {
  Empty,
  ErrorPanel,
  Loading,
  PageHeader,
  RefreshButton,
  SearchBox,
} from "../components";
import { dateTime } from "../i18n";
import type { AuditRow } from "../types";

export default function Audit() {
  const [params, setParams] = useSearchParams();
  const inspectionId = params.get("inspectionId") || "";
  const [input, setInput] = useState(inspectionId);
  const query = usePaged<AuditRow>(
    "audit",
    `/audit${inspectionId ? `?inspectionId=${encodeURIComponent(inspectionId)}` : ""}`,
  );
  function submit(event: FormEvent) {
    event.preventDefault();
    setParams(input.trim() ? { inspectionId: input.trim() } : {});
  }
  return (
    <>
      <PageHeader
        title="Auditoria"
        description="Acompanhe quem realizou cada operação e quando ela foi registrada."
        action={
          <RefreshButton
            refresh={() => void query.refetch()}
            busy={query.isFetching}
          />
        }
      />
      <section className="panel">
        <div className="toolbar">
          <form className="search-form" onSubmit={submit}>
            <SearchBox
              value={input}
              onChange={setInput}
              label="Filtrar auditoria por inspeção"
              placeholder="ID completo da inspeção"
            />
            <button className="button secondary">Filtrar</button>
            {inspectionId && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setInput("");
                  setParams({});
                }}
              >
                Limpar filtro
              </button>
            )}
          </form>
          <ShieldCheck className="muted" size={23} />
        </div>
        {query.isPending ? (
          <Loading />
        ) : query.isError && !query.data ? (
          <ErrorPanel error={query.error} retry={() => void query.refetch()} />
        ) : !query.rows?.length ? (
          <Empty
            title="Nenhum evento nesta consulta"
            description={
              inspectionId
                ? "Verifique o ID da inspeção ou limpe o filtro."
                : "As operações auditadas aparecerão aqui após serem registradas no servidor."
            }
          />
        ) : (
          <div className="table-scroll">
            <table className="audit-table">
              <thead>
                <tr>
                  <th scope="col">Data e hora</th>
                  <th scope="col">Operação</th>
                  <th scope="col">Autor</th>
                  <th scope="col">Registro</th>
                  <th scope="col">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {query.rows.map((row) => (
                  <tr key={row.id}>
                    <td>{dateTime(row.at)}</td>
                    <td>
                      <strong>{actionLabel(row.action)}</strong>
                    </td>
                    <td className="id-value">{row.actorId}</td>
                    <td className="id-value">{row.entityId}</td>
                    <td>
                      <details>
                        <summary>Ver evento</summary>
                        <pre>
                          {typeof row.details === "string"
                            ? row.details
                            : JSON.stringify(row.details, null, 2)}
                        </pre>
                        <small>ID: {row.id}</small>
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {query.data && <LoadMore query={query} />}
      </section>
      <p className="list-note">
        Carregue mais para consultar eventos anteriores. A auditoria preserva os
        identificadores do autor e do registro, inclusive após mudanças de
        cadastro.
      </p>
    </>
  );
}
function actionLabel(action: string) {
  const labels: Record<string, string> = {
    Login: "Login",
    LoginSucceeded: "Login realizado",
    VehicleCreated: "Veículo cadastrado",
    VehicleUpdated: "Veículo atualizado",
    TemplateCreated: "Versão criada",
    TemplatePublished: "Versão publicada",
    InspectionCreated: "Inspeção criada",
    InspectionUpdated: "Inspeção atualizada",
    InspectionFinalized: "Inspeção finalizada",
    InspectionCorrected: "Correção registrada",
    PhotoUploaded: "Foto recebida",
    UserCreated: "Pessoa adicionada",
    UserUpdated: "Acesso atualizado",
  };
  return labels[action] || action;
}
