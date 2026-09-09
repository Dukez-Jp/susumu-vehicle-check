import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
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
import { validateEmployee } from "../domain";
import type { Employee, EmployeeInput, Location, User } from "../types";

export default function Employees() {
  const { api } = useSession();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Employee | "new" | null>(null);
  const [saved, setSaved] = useState(false);
  const query = useQuery({
    queryKey: ["employees"],
    queryFn: ({ signal }) => api.get<Employee[]>("/employees", signal),
  });
  const locations = useQuery({
    queryKey: ["locations"],
    queryFn: ({ signal }) => api.get<Location[]>("/locations", signal),
  });
  const users = useQuery({
    queryKey: ["users"],
    queryFn: ({ signal }) => api.get<User[]>("/users", signal),
  });
  const employees = query.data?.filter((e) =>
    `${e.employeeNumber} ${e.name}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  return (
    <>
      <PageHeader
        title="Funcionários"
        description="Cadastre a equipe e vincule cada pessoa à sua unidade de trabalho."
        action={
          <>
            <RefreshButton
              refresh={() => void query.refetch()}
              busy={query.isFetching}
            />
            <button
              className="button primary"
              onClick={() => {
                setEditing("new");
                setSaved(false);
              }}
            >
              <Plus size={17} />
              Adicionar funcionário
            </button>
          </>
        }
      />
      <Notice>
        O cadastro de funcionário é separado do acesso ao sistema. Vincule um
        usuário existente quando necessário. Desativar o funcionário não
        desativa seu login.
      </Notice>
      {saved && <Notice tone="success">Cadastro do funcionário salvo.</Notice>}
      {locations.isError && (
        <ErrorPanel
          error={locations.error}
          retry={() => void locations.refetch()}
        />
      )}
      {users.isError && (
        <ErrorPanel error={users.error} retry={() => void users.refetch()} />
      )}
      {editing &&
        (locations.isPending || users.isPending ? (
          <Loading label="Consultando unidades e acessos…" />
        ) : locations.data && users.data ? (
          <EmployeeEditor
            key={editing === "new" ? "new" : editing.id}
            employee={editing === "new" ? undefined : editing}
            employees={query.data || []}
            locations={locations.data}
            users={users.data}
            onClose={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              setSaved(true);
            }}
          />
        ) : null)}
      <section className="panel">
        <div className="toolbar">
          <SearchBox
            value={search}
            onChange={setSearch}
            label="Pesquisar funcionários"
            placeholder="Nome ou matrícula"
          />
          <span className="result-count">
            {employees?.length ?? "—"} funcionários
          </span>
        </div>
        {query.isPending ? (
          <Loading />
        ) : query.isError ? (
          <ErrorPanel error={query.error} retry={() => void query.refetch()} />
        ) : !employees?.length ? (
          <Empty
            title="Nenhum funcionário encontrado"
            description="Revise a pesquisa ou adicione uma pessoa à equipe."
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Matrícula</th>
                  <th scope="col">Funcionário</th>
                  <th scope="col">Unidade</th>
                  <th scope="col">Acesso vinculado</th>
                  <th scope="col">Cadastro</th>
                  <th scope="col">
                    <span className="sr-only">Editar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee.id}>
                    <td>
                      <strong>{employee.employeeNumber}</strong>
                    </td>
                    <td>{employee.name}</td>
                    <td>
                      {locations.data?.find((l) => l.id === employee.locationId)
                        ?.name || "Unidade indisponível"}
                    </td>
                    <td>
                      {employee.userId ? (
                        users.data?.find((u) => u.id === employee.userId)
                          ?.username || "Usuário indisponível"
                      ) : (
                        <span className="muted">Sem vínculo</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge ${employee.active ? "status-OK" : "status-NotApplicable"}`}
                      >
                        {employee.active ? "Ativo" : "Desativado"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => {
                          setEditing(employee);
                          setSaved(false);
                        }}
                        aria-label={`Editar funcionário ${employee.name}`}
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

function EmployeeEditor({
  employee,
  employees,
  locations,
  users,
  onClose,
  onSaved,
}: {
  employee?: Employee;
  employees: Employee[];
  locations: Location[];
  users: User[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { api } = useSession();
  const current = useUser();
  const cache = useQueryClient();
  const [draft, setDraft] = useState<EmployeeInput>({
    employeeNumber: employee?.employeeNumber || "",
    name: employee?.name || "",
    locationId: employee?.locationId || current.locationId,
    userId: employee?.userId || null,
    active: employee?.active ?? true,
  });
  const [errors, setErrors] = useState<string[]>([]);
  const occupiedUsers = new Set(
    employees
      .filter((e) => e.id !== employee?.id && e.userId)
      .map((e) => e.userId),
  );
  const mutation = useMutation({
    mutationFn: () =>
      api.send<Employee>(
        employee ? `/employees/${employee.id}` : "/employees",
        employee ? "PUT" : "POST",
        {
          ...draft,
          name: draft.name.trim(),
          employeeNumber: draft.employeeNumber.trim(),
        },
      ),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["employees"] });
      onSaved();
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    const validation = validateEmployee(draft);
    setErrors(validation);
    if (!validation.length) mutation.mutate();
  }
  return (
    <form className="panel editor-panel" onSubmit={submit}>
      <fieldset disabled={mutation.isPending}>
        <legend>
          {employee
            ? `Editar funcionário: ${employee.name}`
            : "Adicionar funcionário"}
        </legend>
        <ValidationErrors errors={errors} />
        {mutation.isError && <ErrorPanel error={mutation.error} />}
        <div className="form-grid">
          <label>
            Matrícula
            <input
              required
              maxLength={40}
              value={draft.employeeNumber}
              onChange={(e) =>
                setDraft({ ...draft, employeeNumber: e.target.value })
              }
            />
          </label>
          <label>
            Nome completo
            <input
              required
              maxLength={160}
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label>
            Unidade
            <select
              required
              value={draft.locationId}
              onChange={(e) =>
                setDraft({ ...draft, locationId: e.target.value })
              }
            >
              <option value="">Selecione a unidade</option>
              {locations
                .filter((l) => l.active || l.id === draft.locationId)
                .map((l) => (
                  <option value={l.id} key={l.id}>
                    {l.name}
                    {!l.active ? " (desativada)" : ""}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Usuário vinculado (opcional)
            <select
              value={draft.userId || ""}
              onChange={(e) =>
                setDraft({ ...draft, userId: e.target.value || null })
              }
            >
              <option value="">Sem vínculo de acesso</option>
              {users
                .filter((u) => !occupiedUsers.has(u.id))
                .map((u) => (
                  <option value={u.id} key={u.id}>
                    {u.name} ({u.username}){!u.active ? " • Desativado" : ""}
                  </option>
                ))}
            </select>
          </label>
        </div>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={draft.active}
            onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
          />
          Funcionário ativo
        </label>
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
          {mutation.isPending ? "Salvando…" : "Salvar funcionário"}
        </button>
      </div>
    </form>
  );
}
