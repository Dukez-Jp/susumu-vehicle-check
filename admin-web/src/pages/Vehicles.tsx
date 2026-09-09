import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { ArrowLeft, Pencil, Plus, Printer, Truck } from "lucide-react";
import QRCode from "react-qr-code";
import { useSession, useUser } from "../auth";
import {
  Empty,
  ErrorPanel,
  InspectionTable,
  Loading,
  Notice,
  PageHeader,
  RefreshButton,
  SearchBox,
  ValidationErrors,
} from "../components";
import { validateVehicle, validateVehicleTypeAssignment } from "../domain";
import { useVehicleTypes, VehicleTypeField } from "../vehicleTypes";
import { copy, number } from "../i18n";
import { LoadMore, usePaged } from "../pagination";
import type { Inspection, Location, Vehicle, VehicleInput } from "../types";

export default function Vehicles() {
  const { api } = useSession();
  const user = useUser();
  const [params, setParams] = useSearchParams();
  const search = params.get("search") || "";
  const [input, setInput] = useState(search);
  const query = useQuery({
    queryKey: ["vehicles", search],
    queryFn: ({ signal }) =>
      api.get<Vehicle[]>(
        `/vehicles?search=${encodeURIComponent(search)}`,
        signal,
      ),
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    setParams(input.trim() ? { search: input.trim() } : {});
  }
  return (
    <>
      <PageHeader
        title="Veículos"
        description="Identificação, quilometragem e histórico da sua frota."
        action={
          <>
            <RefreshButton
              refresh={() => void query.refetch()}
              busy={query.isFetching}
            />
            {user.role === "Administrator" && (
              <Link className="button primary" to="/vehicles/new">
                <Plus size={17} />
                Cadastrar veículo
              </Link>
            )}
          </>
        }
      />
      <section className="panel">
        <div className="toolbar">
          <form className="search-form" onSubmit={submit}>
            <SearchBox
              value={input}
              onChange={setInput}
              placeholder="Número interno, placa ou tipo"
              label="Pesquisar veículos"
            />
            <button className="button secondary" type="submit">
              Pesquisar
            </button>
          </form>
          {query.data && (
            <span className="result-count">
              {number(query.data.length)} veículos encontrados
            </span>
          )}
        </div>
        {query.isPending ? (
          <Loading />
        ) : query.isError ? (
          <ErrorPanel error={query.error} retry={() => void query.refetch()} />
        ) : !query.data.length ? (
          <Empty
            title="Nenhum veículo encontrado"
            description={
              search
                ? "Revise o número interno ou a placa e pesquise novamente."
                : "Cadastre os veículos da unidade para começar a receber inspeções."
            }
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Número interno</th>
                  <th scope="col">Placa</th>
                  <th scope="col">Tipo de veículo</th>
                  <th scope="col">Quilometragem</th>
                  <th scope="col">Cadastro</th>
                  <th scope="col">
                    <span className="sr-only">Detalhes</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {query.data.map((vehicle) => (
                  <tr key={vehicle.id}>
                    <td>
                      <Link
                        className="vehicle-number"
                        to={`/vehicles/${vehicle.id}`}
                      >
                        <Truck size={20} />
                        {vehicle.internalNumber}
                      </Link>
                    </td>
                    <td>
                      <span className="plate">
                        {vehicle.plate || "Sem placa"}
                      </span>
                    </td>
                    <td>{vehicle.type}</td>
                    <td>{number(vehicle.currentOdometerKm)} km</td>
                    <td>
                      <span
                        className={`badge ${vehicle.active ? "status-OK" : "status-NotApplicable"}`}
                      >
                        {vehicle.active
                          ? copy.common.active
                          : copy.common.inactive}
                      </span>
                    </td>
                    <td>
                      <Link
                        className="table-action"
                        to={`/vehicles/${vehicle.id}`}
                      >
                        Ver histórico
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

export function VehicleDetail() {
  const { id = "" } = useParams();
  const { api } = useSession();
  const user = useUser();
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const vehicle = useQuery({
    queryKey: ["vehicle", id],
    queryFn: ({ signal }) => api.get<Vehicle>(`/vehicles/${id}`, signal),
  });
  const history = usePaged<Inspection>(
    "vehicle-history",
    `/inspections?vehicleId=${encodeURIComponent(id)}`,
  );
  if (vehicle.isPending) return <Loading />;
  if (vehicle.isError)
    return (
      <ErrorPanel error={vehicle.error} retry={() => void vehicle.refetch()} />
    );
  const v = vehicle.data;
  if (editing)
    return (
      <>
        <PageHeader
          title={`Editar veículo ${v.internalNumber}`}
          description="Alterações no cadastro não substituem o histórico das inspeções."
        />
        <VehicleEditor
          vehicle={v}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setSaved(true);
          }}
        />
      </>
    );
  return (
    <>
      <PageHeader
        back="/vehicles"
        title={`Veículo ${v.internalNumber}`}
        description={`${v.plate || "Sem placa"} • ${v.type}`}
        action={
          <>
            <button className="button secondary" onClick={() => window.print()}>
              <Printer size={16} />
              Imprimir identificação
            </button>
            {user.role === "Administrator" && (
              <button
                className="button primary"
                onClick={() => {
                  setEditing(true);
                  setSaved(false);
                }}
              >
                <Pencil size={16} />
                Editar cadastro
              </button>
            )}
          </>
        }
      />
      {saved && <Notice tone="success">Cadastro do veículo atualizado.</Notice>}
      <section className="vehicle-profile panel">
        <div className="vehicle-profile-main">
          <span className="vehicle-profile-icon">
            <Truck size={38} />
          </span>
          <div>
            <span className="muted">Número interno</span>
            <h2>{v.internalNumber}</h2>
            <span className="plate">{v.plate || "Sem placa"}</span>
          </div>
        </div>
        <dl className="vehicle-facts">
          <div>
            <dt>Quilometragem atual</dt>
            <dd>
              {number(v.currentOdometerKm)} <small>km</small>
            </dd>
          </div>
          <div>
            <dt>Tipo</dt>
            <dd>{v.type}</dd>
          </div>
          <div>
            <dt>Cadastro</dt>
            <dd>{v.active ? "Ativo" : "Inativo"}</dd>
          </div>
        </dl>
        <div className="vehicle-qr">
          <QRCode
            value={v.id}
            size={108}
            title={`Identificação do veículo ${v.internalNumber}`}
          />
          <span>Identificação no tablet</span>
        </div>
      </section>
      <section className="panel register-panel">
        <div className="panel-header">
          <div>
            <h2>Histórico de inspeções</h2>
            <p>Versões anteriores e correções permanecem disponíveis.</p>
          </div>
          <RefreshButton
            refresh={() => void history.refetch()}
            busy={history.isFetching}
          />
        </div>
        {history.isPending ? (
          <Loading />
        ) : history.isError && !history.data ? (
          <ErrorPanel
            error={history.error}
            retry={() => void history.refetch()}
          />
        ) : history.rows?.length ? (
          <InspectionTable inspections={history.rows} vehicles={[v]} />
        ) : (
          <Empty
            title="Este veículo ainda não possui inspeções"
            description="Os registros aparecerão aqui quando forem sincronizados pelo tablet."
          />
        )}
        {history.data && <LoadMore query={history} />}
      </section>
    </>
  );
}

export function NewVehicle() {
  const navigate = useNavigate();
  return (
    <>
      <PageHeader
        back="/vehicles"
        title="Cadastrar veículo"
        description="Use a identificação que a equipe reconhece na oficina."
      />
      <VehicleEditor
        onCancel={() => navigate("/vehicles")}
        onSaved={(vehicle) => navigate(`/vehicles/${vehicle.id}`)}
      />
    </>
  );
}

function VehicleEditor({
  vehicle,
  onCancel,
  onSaved,
}: {
  vehicle?: Vehicle;
  onCancel: () => void;
  onSaved: (vehicle: Vehicle) => void;
}) {
  const { api } = useSession();
  const user = useUser();
  const cache = useQueryClient();
  const [draft, setDraft] = useState<VehicleInput>({
    internalNumber: vehicle?.internalNumber || "",
    plate: vehicle?.plate || "",
    type: vehicle?.type || "",
    currentOdometerKm: vehicle?.currentOdometerKm ?? null,
    active: vehicle?.active ?? true,
    locationId: vehicle?.locationId || user.locationId,
  });
  const [errors, setErrors] = useState<string[]>([]);
  const vehicleTypes = useVehicleTypes();
  const locations = useQuery({
    queryKey: ["locations"],
    queryFn: ({ signal }) => api.get<Location[]>("/locations", signal),
  });
  const mutation = useMutation({
    mutationFn: (data: VehicleInput) =>
      api.send<Vehicle>(
        vehicle ? `/vehicles/${vehicle.id}` : "/vehicles",
        vehicle ? "PUT" : "POST",
        data,
      ),
    onSuccess: async (result) => {
      await Promise.all([
        cache.invalidateQueries({ queryKey: ["vehicles"] }),
        cache.invalidateQueries({ queryKey: ["vehicle", vehicle?.id] }),
        cache.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      onSaved(result || vehicle!);
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    const validation = validateVehicle(draft, vehicle?.currentOdometerKm);
    validation.push(
      ...validateVehicleTypeAssignment(
        draft.type,
        vehicleTypes.data || [],
        vehicle?.type,
      ),
    );
    if (!draft.locationId) validation.push("Selecione a unidade do veículo.");
    setErrors(validation);
    if (!validation.length)
      mutation.mutate({
        ...draft,
        internalNumber: draft.internalNumber.trim(),
        plate: draft.plate.trim(),
        type: draft.type.trim(),
      });
  }
  return (
    <form className="panel editor-panel" onSubmit={submit}>
      <ValidationErrors errors={errors} />
      {mutation.isError && <ErrorPanel error={mutation.error} />}
      {locations.isError && (
        <ErrorPanel
          error={locations.error}
          retry={() => void locations.refetch()}
        />
      )}
      <fieldset disabled={mutation.isPending}>
        <legend>Identificação do veículo</legend>
        <div className="form-grid">
          <label>
            Unidade
            <select
              value={draft.locationId}
              required
              disabled={!locations.data}
              onChange={(e) =>
                setDraft({ ...draft, locationId: e.target.value })
              }
            >
              <option value="">
                {locations.isPending
                  ? "Consultando unidades…"
                  : "Selecione a unidade"}
              </option>
              {!locations.data && draft.locationId && (
                <option value={draft.locationId}>Unidade atual</option>
              )}
              {locations.data
                ?.filter((l) => l.active || l.id === draft.locationId)
                .map((l) => (
                  <option value={l.id} key={l.id}>
                    {l.name}
                    {!l.active ? " (desativada)" : ""}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Número interno
            <input
              required
              maxLength={40}
              value={draft.internalNumber}
              onChange={(e) =>
                setDraft({ ...draft, internalNumber: e.target.value })
              }
              placeholder="Número usado na frota"
            />
          </label>
          <label>
            Placa (opcional)
            <input
              maxLength={40}
              value={draft.plate}
              onChange={(e) => setDraft({ ...draft, plate: e.target.value })}
              placeholder="Identificação da placa"
            />
          </label>
          <VehicleTypeField
            query={vehicleTypes}
            value={draft.type}
            existingCode={vehicle?.type}
            allowUnchangedRetired
            onChange={(type) => setDraft({ ...draft, type })}
          />
          <label>
            Quilometragem atual (km)
            <input
              type="number"
              required={vehicle?.currentOdometerKm != null}
              min={vehicle?.currentOdometerKm ?? 0}
              step="1"
              max={2147483647}
              value={
                draft.currentOdometerKm == null ||
                Number.isNaN(draft.currentOdometerKm)
                  ? ""
                  : draft.currentOdometerKm
              }
              onChange={(e) =>
                setDraft({
                  ...draft,
                  currentOdometerKm:
                    e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </label>
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
          />
          Veículo ativo para novas inspeções
        </label>
      </fieldset>
      <div className="form-actions">
        <button
          className="button secondary"
          type="button"
          onClick={onCancel}
          disabled={mutation.isPending}
        >
          <ArrowLeft size={16} />
          Cancelar
        </button>
        <button
          className="button primary"
          disabled={mutation.isPending || !locations.data || !vehicleTypes.data}
        >
          {mutation.isPending
            ? copy.common.saving
            : vehicle
              ? copy.common.save
              : "Cadastrar veículo"}
        </button>
      </div>
    </form>
  );
}
