import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, MapPin, Pencil, Plus } from "lucide-react";
import { useSession } from "../auth";
import {
  Empty,
  ErrorPanel,
  Loading,
  Notice,
  PageHeader,
  RefreshButton,
  ValidationErrors,
} from "../components";
import type { Company, Location } from "../types";

export default function Organization() {
  const { api } = useSession();
  const [editing, setEditing] = useState<Location | "new" | null>(null);
  const [saved, setSaved] = useState(false);
  const company = useQuery({
    queryKey: ["company"],
    queryFn: ({ signal }) => api.get<Company>("/company", signal),
  });
  const locations = useQuery({
    queryKey: ["locations"],
    queryFn: ({ signal }) => api.get<Location[]>("/locations", signal),
  });
  return (
    <>
      <PageHeader
        title="Empresa e unidades"
        description="Identifique a empresa e organize os locais de operação da oficina."
        action={
          <RefreshButton
            refresh={() => {
              void company.refetch();
              void locations.refetch();
            }}
            busy={company.isFetching || locations.isFetching}
          />
        }
      />
      {company.isPending ? (
        <Loading label="Consultando a empresa…" />
      ) : company.isError ? (
        <ErrorPanel
          error={company.error}
          retry={() => void company.refetch()}
        />
      ) : (
        <CompanyEditor company={company.data} />
      )}
      {saved && <Notice tone="success">Unidade salva com sucesso.</Notice>}
      {editing && (
        <LocationEditor
          key={editing === "new" ? "new" : editing.id}
          location={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setSaved(true);
          }}
        />
      )}
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2>Unidades da empresa</h2>
            <p>Vincule veículos e funcionários a seus locais de operação.</p>
          </div>
          <button
            className="button primary"
            onClick={() => {
              setEditing("new");
              setSaved(false);
            }}
          >
            <Plus size={16} />
            Adicionar unidade
          </button>
        </div>
        {locations.isPending ? (
          <Loading />
        ) : locations.isError ? (
          <ErrorPanel
            error={locations.error}
            retry={() => void locations.refetch()}
          />
        ) : !locations.data.length ? (
          <Empty
            title="Nenhuma unidade cadastrada"
            description="Adicione uma unidade para organizar a operação."
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Unidade</th>
                  <th scope="col">Situação</th>
                  <th scope="col">
                    <span className="sr-only">Editar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {locations.data.map((location) => (
                  <tr key={location.id}>
                    <td>
                      <span className="person-cell">
                        <MapPin size={19} />
                        <strong>{location.name}</strong>
                      </span>
                    </td>
                    <td>
                      <span
                        className={`badge ${location.active ? "status-OK" : "status-NotApplicable"}`}
                      >
                        {location.active ? "Ativa" : "Desativada"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => {
                          setEditing(location);
                          setSaved(false);
                        }}
                        aria-label={`Editar unidade ${location.name}`}
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
      <p className="list-note">
        A desativação preserva o histórico. Uma unidade com usuários ou veículos
        ativos vinculados não pode ser desativada. Pelo menos uma unidade deve
        permanecer ativa.
      </p>
    </>
  );
}

function CompanyEditor({ company }: { company: Company }) {
  const { api } = useSession();
  const cache = useQueryClient();
  const [name, setName] = useState(company.name);
  const [errors, setErrors] = useState<string[]>([]);
  const mutation = useMutation({
    mutationFn: () =>
      api.send<Company>("/company", "PUT", { name: name.trim() }),
    onSuccess: () => cache.invalidateQueries({ queryKey: ["company"] }),
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    setErrors(name.trim() ? [] : ["Informe o nome da empresa."]);
    if (name.trim()) mutation.mutate();
  }
  return (
    <form className="panel editor-panel" onSubmit={submit}>
      <div className="panel-header">
        <div className="company-heading">
          <Building2 size={25} />
          <h2>Identificação da empresa</h2>
        </div>
        <span
          className={`badge ${company.active ? "status-OK" : "status-NotApplicable"}`}
        >
          {company.active ? "Ativa" : "Desativada"}
        </span>
      </div>
      <ValidationErrors errors={errors} />
      {mutation.isError && <ErrorPanel error={mutation.error} />}
      {mutation.isSuccess && (
        <Notice tone="success">Nome da empresa atualizado.</Notice>
      )}
      <div className="company-form">
        <label>
          Nome de exibição
          <input
            value={name}
            maxLength={160}
            required
            onChange={(e) => setName(e.target.value)}
            disabled={mutation.isPending}
          />
        </label>
        <button
          className="button primary"
          disabled={mutation.isPending || name.trim() === company.name}
        >
          {mutation.isPending ? "Salvando…" : "Salvar nome"}
        </button>
      </div>
    </form>
  );
}

function LocationEditor({
  location,
  onClose,
  onSaved,
}: {
  location?: Location;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { api } = useSession();
  const cache = useQueryClient();
  const [name, setName] = useState(location?.name || "");
  const [active, setActive] = useState(location?.active ?? true);
  const [errors, setErrors] = useState<string[]>([]);
  const mutation = useMutation({
    mutationFn: () =>
      api.send<Location>(
        location ? `/locations/${location.id}` : "/locations",
        location ? "PUT" : "POST",
        location ? { name: name.trim(), active } : { name: name.trim() },
      ),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["locations"] });
      onSaved();
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    setErrors(name.trim() ? [] : ["Informe o nome da unidade."]);
    if (name.trim()) mutation.mutate();
  }
  return (
    <form className="panel editor-panel" onSubmit={submit}>
      <fieldset disabled={mutation.isPending}>
        <legend>{location ? "Editar unidade" : "Adicionar unidade"}</legend>
        <ValidationErrors errors={errors} />
        {mutation.isError && <ErrorPanel error={mutation.error} />}
        <label>
          Nome da unidade
          <input
            required
            maxLength={160}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {location && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Unidade ativa
          </label>
        )}
      </fieldset>
      <div className="form-actions">
        <button
          type="button"
          className="button secondary"
          onClick={onClose}
          disabled={mutation.isPending}
        >
          Cancelar
        </button>
        <button className="button primary" disabled={mutation.isPending}>
          {mutation.isPending ? "Salvando…" : "Salvar unidade"}
        </button>
      </div>
    </form>
  );
}
