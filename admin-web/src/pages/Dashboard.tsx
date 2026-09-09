import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Download,
  Truck,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { useSession } from "../auth";
import { downloadBlob } from "../api";
import {
  Empty,
  ErrorPanel,
  InspectionTable,
  Loading,
  PageHeader,
  RefreshButton,
} from "../components";
import { copy, number } from "../i18n";
import type { DashboardData, Vehicle } from "../types";

export function ExportButton() {
  const { api } = useSession();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function download() {
    setPending(true);
    setError(null);
    try {
      const blob = await api.blob("/exports/inspections.csv");
      downloadBlob(
        blob,
        `inspecoes-${new Date().toISOString().slice(0, 10)}.csv`,
      );
    } catch (failure) {
      setError(failure);
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="export-action">
      <button className="button primary" disabled={pending} onClick={download}>
        <Download size={16} />
        {pending ? "Preparando arquivo…" : copy.common.csv}
      </button>
      {error != null && <ErrorPanel error={error} />}
    </div>
  );
}
export default function Dashboard() {
  const { api } = useSession();
  const dashboard = useQuery({
    queryKey: ["dashboard"],
    queryFn: ({ signal }) => api.get<DashboardData>("/dashboard", signal),
  });
  const vehicles = useQuery({
    queryKey: ["vehicles", ""],
    queryFn: ({ signal }) => api.get<Vehicle[]>("/vehicles", signal),
  });
  const data = dashboard.data;
  return (
    <>
      <PageHeader
        title="Visão da oficina"
        description="Acompanhe a frota e o que precisa de verificação."
        action={
          <>
            <RefreshButton
              refresh={() => {
                void dashboard.refetch();
                void vehicles.refetch();
              }}
              busy={dashboard.isFetching}
            />
            <ExportButton />
          </>
        }
      />
      {dashboard.isPending ? (
        <Loading />
      ) : dashboard.isError ? (
        <ErrorPanel
          error={dashboard.error}
          retry={() => void dashboard.refetch()}
        />
      ) : (
        data && (
          <>
            <section className="fleet-overview" aria-label="Resumo da operação">
              <div className="fleet-total">
                <Truck size={32} />
                <strong>{number(data.vehicles)}</strong>
                <span>veículos cadastrados</span>
              </div>
              <div className="overview-stat">
                <ClipboardCheck size={20} />
                <strong>{number(data.inspections)}</strong>
                <span>inspeções registradas</span>
              </div>
              <div className="overview-stat">
                <CheckCircle2 size={20} />
                <strong>{number(data.finalized)}</strong>
                <span>finalizadas</span>
              </div>
              <div className="overview-stat">
                <Clock3 size={20} />
                <strong>{number(data.drafts)}</strong>
                <span>em andamento</span>
              </div>
            </section>
            <section className="operations-strip">
              <div
                className={`operation-alert ${data.criticalItems ? "critical" : "clear"}`}
              >
                <AlertTriangle size={24} />
                <div>
                  <strong>
                    {data.criticalItems
                      ? `${number(data.criticalItems)} itens críticos registrados`
                      : "Nenhum item crítico registrado"}
                  </strong>
                  <p>Resultados registrados nas inspeções da sua unidade.</p>
                </div>
                <Link to="/inspections?finding=critical">Ver inspeções</Link>
              </div>
              <div className="photo-alert">
                <span className="sync-symbol">
                  <Clock3 size={22} />
                </span>
                <div>
                  <strong>
                    {number(data.pendingPhotos)} com fotos pendentes
                  </strong>
                  <p>Inspeções aguardando o envio de evidências.</p>
                </div>
                <Link to="/inspections?photos=pending">Acompanhar</Link>
              </div>
            </section>
            <section className="panel register-panel">
              <div className="panel-header">
                <div>
                  <h2>Últimas inspeções</h2>
                  <p>Registros mais recentes recebidos pela oficina.</p>
                </div>
                <Link className="text-link" to="/inspections">
                  Ver histórico completo
                </Link>
              </div>
              {vehicles.isError && (
                <ErrorPanel
                  error={vehicles.error}
                  retry={() => void vehicles.refetch()}
                />
              )}
              {data.recentInspections.length ? (
                <InspectionTable
                  inspections={data.recentInspections}
                  vehicles={vehicles.data || []}
                />
              ) : (
                <Empty
                  title="A primeira inspeção começa no tablet"
                  description="Quando a equipe sincronizar uma inspeção, o registro e suas evidências aparecerão aqui."
                  action={
                    <Link className="button secondary" to="/vehicles">
                      Consultar veículos
                    </Link>
                  }
                />
              )}
            </section>
            <div className="dashboard-footnote">
              <ShieldNote />
              Os números refletem os registros disponíveis no servidor.
              Inspeções ainda offline no tablet aparecem após a sincronização.
            </div>
          </>
        )
      )}
    </>
  );
}
function ShieldNote() {
  return <Clock3 size={17} />;
}
