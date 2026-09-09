import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ListTree, Pencil, Plus } from "lucide-react";
import { useSession } from "../auth";
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
import { validateVehicleType } from "../domain";
import { useVehicleTypes } from "../vehicleTypes";
import type { VehicleType } from "../types";

export default function VehicleTypes() {
  const query = useVehicleTypes();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<VehicleType | "new" | null>(null);
  const [saved, setSaved] = useState(false);
  const types = query.data?.filter((type) =>
    `${type.code} ${type.name}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  return (
    <>
      <PageHeader
        title="Tipos de veículo"
        description="Organize as categorias utilizadas na frota e nos checklists da empresa."
        action={
          <>
            <RefreshButton
              refresh={() => void query.refetch()}
              busy={query.isFetching}
            />
            <button
              className="button primary"
              disabled={!query.data}
              onClick={() => {
                setEditing("new");
                setSaved(false);
              }}
            >
              <Plus size={17} />
              Adicionar tipo
            </button>
          </>
        }
      />
      <Notice>
        O código identifica o tipo no histórico e não pode ser alterado.
        Desativar um tipo impede novos vínculos e preserva os veículos e
        checklists existentes.
      </Notice>
      {saved && <Notice tone="success">Tipo de veículo salvo.</Notice>}
      {editing && query.data && (
        <VehicleTypeEditor
          key={editing === "new" ? "new" : editing.id}
          type={editing === "new" ? undefined : editing}
          catalog={query.data}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setSaved(true);
          }}
        />
      )}
      <section className="panel">
        <div className="toolbar">
          <SearchBox
            value={search}
            onChange={setSearch}
            label="Pesquisar tipos de veículo"
            placeholder="Código ou nome do tipo"
          />
          <span className="result-count">{types?.length ?? "—"} tipos</span>
        </div>
        {query.isPending ? (
          <Loading label="Consultando tipos de veículo…" />
        ) : query.isError ? (
          <ErrorPanel error={query.error} retry={() => void query.refetch()} />
        ) : !types?.length ? (
          <Empty
            title="Nenhum tipo encontrado"
            description="Revise a pesquisa ou adicione um tipo para organizar os veículos."
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Código</th>
                  <th scope="col">Tipo de veículo</th>
                  <th scope="col">Disponibilidade</th>
                  <th scope="col">
                    <span className="sr-only">Editar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {types.map((type) => (
                  <tr key={type.id}>
                    <td>
                      <strong>{type.code}</strong>
                    </td>
                    <td>
                      <span className="person-cell">
                        <ListTree size={18} />
                        {type.name}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${type.active ? "status-OK" : "status-NotApplicable"}`}
                      >
                        {type.active ? "Ativo" : "Desativado"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="text-button"
                        aria-label={`Editar tipo ${type.code}`}
                        onClick={() => {
                          setEditing(type);
                          setSaved(false);
                        }}
                      >
                        <Pencil size={15} />
                        Editar
                      </button>
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

function VehicleTypeEditor({
  type,
  catalog,
  onClose,
  onSaved,
}: {
  type?: VehicleType;
  catalog: VehicleType[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { api } = useSession();
  const cache = useQueryClient();
  const [code, setCode] = useState(type?.code || "");
  const [name, setName] = useState(type?.name || "");
  const [active, setActive] = useState(type?.active ?? true);
  const [errors, setErrors] = useState<string[]>([]);
  const mutation = useMutation({
    mutationFn: () =>
      api.send<VehicleType>(
        type ? `/vehicle-types/${type.id}` : "/vehicle-types",
        type ? "PUT" : "POST",
        type
          ? { name: name.trim(), active }
          : { code: code.trim(), name: name.trim() },
      ),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["vehicle-types"] });
      onSaved();
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    const validation = validateVehicleType({ code, name }, catalog, type?.id);
    setErrors(validation);
    if (!validation.length) mutation.mutate();
  }
  return (
    <form className="panel editor-panel" onSubmit={submit}>
      <fieldset disabled={mutation.isPending}>
        <legend>
          {type ? `Editar tipo: ${type.code}` : "Adicionar tipo de veículo"}
        </legend>
        <ValidationErrors errors={errors} />
        {mutation.isError && <ErrorPanel error={mutation.error} />}
        <div className="form-grid">
          <label>
            Código
            <input
              required
              maxLength={80}
              readOnly={Boolean(type)}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Ex.: Truck"
            />
            <small>Identificação permanente, até 80 caracteres.</small>
          </label>
          <label>
            Nome de exibição
            <input
              required
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Caminhão"
            />
          </label>
        </div>
        {type && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            Tipo ativo para novos vínculos
          </label>
        )}
      </fieldset>
      <div className="form-actions">
        <button
          type="button"
          className="button secondary"
          disabled={mutation.isPending}
          onClick={onClose}
        >
          Cancelar
        </button>
        <button className="button primary" disabled={mutation.isPending}>
          {mutation.isPending ? "Salvando…" : "Salvar tipo"}
        </button>
      </div>
    </form>
  );
}
