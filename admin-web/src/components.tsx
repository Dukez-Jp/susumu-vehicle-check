import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CircleHelp,
  LoaderCircle,
  RefreshCw,
  Search,
  Wrench,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { ApiError, errorMessage } from "./api";
import { copy, dateTime, number } from "./i18n";
import type { Inspection, ItemStatus, Vehicle } from "./types";

export function PageHeader({
  title,
  description,
  action,
  back,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  back?: string;
}) {
  return (
    <header className="page-header">
      <div>
        {back && (
          <Link className="back-link" to={back}>
            <ArrowLeft size={16} />
            {copy.common.back}
          </Link>
        )}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="page-actions no-print">{action}</div>}
    </header>
  );
}
export function ErrorPanel({
  error,
  retry,
}: {
  error: unknown;
  retry?: () => void;
}) {
  return (
    <div className="notice error" role="alert">
      <AlertTriangle size={20} />
      <div>
        <strong>{errorMessage(error)}</strong>
        {error instanceof ApiError &&
          Object.entries(error.fields).length > 0 && (
            <ul>
              {Object.entries(error.fields).flatMap(([field, messages]) =>
                (Array.isArray(messages) ? messages : [String(messages)]).map(
                  (message, index) => (
                    <li key={`${field}-${index}`}>{message}</li>
                  ),
                ),
              )}
            </ul>
          )}
        {retry && (
          <button className="text-button" onClick={retry}>
            {copy.common.retry}
          </button>
        )}
      </div>
    </div>
  );
}
export function ValidationErrors({ errors }: { errors: string[] }) {
  return errors.length ? (
    <div className="notice error" role="alert">
      <AlertTriangle size={20} />
      <ul>
        {errors.map((error, index) => (
          <li key={index}>{error}</li>
        ))}
      </ul>
    </div>
  ) : null;
}
export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: "info" | "warning" | "success";
}) {
  return (
    <div className={`notice ${tone}`} role="status">
      {tone === "success" ? (
        <CheckCircle2 size={20} />
      ) : tone === "warning" ? (
        <AlertTriangle size={20} />
      ) : (
        <CircleHelp size={20} />
      )}
      <div>{children}</div>
    </div>
  );
}
export function Loading({ label = copy.common.loading }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <LoaderCircle className="spin" size={24} />
      <span>{label}</span>
    </div>
  );
}
export function Empty({
  title = copy.common.empty,
  description,
  action,
}: {
  title?: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Wrench size={30} />
      <h2>{title}</h2>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function RefreshButton({
  refresh,
  busy = false,
}: {
  refresh: () => void;
  busy?: boolean;
}) {
  return (
    <button className="button secondary" onClick={refresh} disabled={busy}>
      <RefreshCw size={16} className={busy ? "spin" : ""} />
      {copy.common.refresh}
    </button>
  );
}
export function SearchBox({
  value,
  onChange,
  placeholder,
  label = copy.common.search,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label?: string;
}) {
  return (
    <label className="search-box">
      <Search size={18} />
      <span className="sr-only">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type="search"
      />
    </label>
  );
}
export function StatusBadge({ status }: { status: ItemStatus }) {
  return (
    <span className={`badge status-${status}`}>
      {copy.status[status] ?? status}
    </span>
  );
}
export function InspectionState({ state }: { state: Inspection["state"] }) {
  return <span className={`badge state-${state}`}>{copy.state[state]}</span>;
}
export function PhotoState({
  state,
}: {
  state: Inspection["photoUploadState"];
}) {
  return (
    <span className={`photo-state ${state === "Pending" ? "pending" : ""}`}>
      {state === "Pending" ? (
        <AlertTriangle size={14} />
      ) : (
        <CheckCircle2 size={14} />
      )}
      {state === "Pending" ? "Fotos pendentes" : "Fotos sincronizadas"}
    </span>
  );
}
export function VehicleName({
  vehicle,
  id,
}: {
  vehicle?: Vehicle;
  id: string;
}) {
  return vehicle ? (
    <span className="vehicle-identity">
      <strong>{vehicle.internalNumber}</strong>
      <span>{vehicle.plate || "Sem placa"}</span>
    </span>
  ) : (
    <span className="id-value" title={id}>
      {id.slice(0, 8)}
    </span>
  );
}
export function InspectionTable({
  inspections,
  vehicles,
}: {
  inspections: Inspection[];
  vehicles: Vehicle[];
}) {
  const map = new Map(vehicles.map((v) => [v.id, v]));
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th scope="col">Veículo</th>
            <th scope="col">Inspeção</th>
            <th scope="col">Responsável</th>
            <th scope="col">Situação</th>
            <th scope="col">Ocorrências</th>
            <th scope="col">Evidências</th>
            <th scope="col">
              <span className="sr-only">Abrir</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {inspections.map((i) => {
            const critical = i.items.filter(
              (item) => item.status === "Critical",
            ).length;
            const issues = i.items.filter((item) =>
              ["Attention", "Repair"].includes(item.status),
            ).length;
            return (
              <tr key={i.id}>
                <td>
                  <Link className="quiet-link" to={`/vehicles/${i.vehicleId}`}>
                    <VehicleName
                      vehicle={map.get(i.vehicleId)}
                      id={i.vehicleId}
                    />
                  </Link>
                </td>
                <td>
                  <strong className="cell-primary">
                    {dateTime(i.startedAt)}
                  </strong>
                  <span className="cell-secondary">
                    {number(i.odometerKm)} km
                  </span>
                </td>
                <td>{i.createdByName || "Não informado"}</td>
                <td>
                  <InspectionState state={i.state} />
                </td>
                <td>
                  {critical ? (
                    <span className="critical-count">
                      {critical} crítico{critical > 1 ? "s" : ""}
                    </span>
                  ) : issues ? (
                    <span className="issue-count">{issues} para verificar</span>
                  ) : (
                    <span className="muted">Sem apontamentos</span>
                  )}
                </td>
                <td>
                  <PhotoState state={i.photoUploadState} />
                </td>
                <td>
                  <Link
                    className="table-action"
                    to={`/inspections/${i.id}`}
                    aria-label={`Abrir inspeção de ${map.get(i.vehicleId)?.internalNumber ?? i.vehicleId} em ${dateTime(i.startedAt)}`}
                  >
                    Abrir
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
