import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, ShieldCheck, X } from "lucide-react";
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
import { copy } from "../i18n";
import { validateUser } from "../domain";
import type { Location, Role, User, UserInput } from "../types";

export default function Users() {
  const { api } = useSession();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<User | "new" | null>(null);
  const [saved, setSaved] = useState(false);
  const query = useQuery({
    queryKey: ["users"],
    queryFn: ({ signal }) => api.get<User[]>("/users", signal),
  });
  const users = query.data?.filter((u) =>
    `${u.name} ${u.username} ${copy.role[u.role]}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  return (
    <>
      <PageHeader
        title="Pessoas e acesso"
        description="Administre quem pode inspecionar, revisar e consultar a oficina."
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
              Adicionar pessoa
            </button>
          </>
        }
      />
      {saved && (
        <Notice tone="success">
          Acesso atualizado. Alterações de perfil e ativação são verificadas
          pelo servidor.
        </Notice>
      )}
      {editing !== null && (
        <UserEditor
          key={editing === "new" ? "new" : editing.id}
          user={editing === "new" ? undefined : editing}
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
            label="Pesquisar pessoas"
            placeholder="Nome, usuário ou perfil"
          />
          <span className="result-count">{users?.length ?? "—"} pessoas</span>
        </div>
        {query.isPending ? (
          <Loading />
        ) : query.isError ? (
          <ErrorPanel error={query.error} retry={() => void query.refetch()} />
        ) : !users?.length ? (
          <Empty
            title="Nenhuma pessoa encontrada"
            description="Revise a pesquisa ou adicione um acesso à sua unidade."
          />
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">Pessoa</th>
                  <th scope="col">Usuário</th>
                  <th scope="col">Perfil</th>
                  <th scope="col">Acesso</th>
                  <th scope="col">
                    <span className="sr-only">Editar</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <span className="person-cell">
                        <span className="person-avatar">
                          {user.name.slice(0, 1)}
                        </span>
                        <strong>{user.name}</strong>
                      </span>
                    </td>
                    <td>{user.username}</td>
                    <td>{copy.role[user.role]}</td>
                    <td>
                      <span
                        className={`badge ${user.active ? "status-OK" : "status-NotApplicable"}`}
                      >
                        {user.active ? "Ativo" : "Desativado"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => {
                          setEditing(user);
                          setSaved(false);
                        }}
                        aria-label={`Editar acesso de ${user.name}`}
                      >
                        <Pencil size={15} />
                        Editar acesso
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <div className="permissions-guide">
        <ShieldCheck size={24} />
        <div>
          <h2>Permissões por perfil</h2>
          <dl>
            <div>
              <dt>Administrador</dt>
              <dd>Veículos, pessoas, checklists, relatórios e auditoria.</dd>
            </div>
            <div>
              <dt>Supervisor</dt>
              <dd>Checklists, revisão de inspeções, relatórios e auditoria.</dd>
            </div>
            <div>
              <dt>Inspetor</dt>
              <dd>
                Inspeções próprias no tablet e consulta aos registros
                permitidos.
              </dd>
            </div>
            <div>
              <dt>Escritório</dt>
              <dd>Consulta da frota, inspeções e relatórios.</dd>
            </div>
          </dl>
        </div>
      </div>
    </>
  );
}

function UserEditor({
  user,
  onClose,
  onSaved,
}: {
  user?: User;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { api, logout } = useSession();
  const current = useUser();
  const cache = useQueryClient();
  const [draft, setDraft] = useState<UserInput & { active: boolean }>({
    name: user?.name || "",
    username: user?.username || "",
    password: "",
    role: user?.role || "Inspector",
    locationId: user?.locationId || current.locationId,
    active: user?.active ?? true,
  });
  const [errors, setErrors] = useState<string[]>([]);
  const locations = useQuery({
    queryKey: ["locations"],
    queryFn: ({ signal }) => api.get<Location[]>("/locations", signal),
  });
  const mutation = useMutation({
    mutationFn: () =>
      api.send<User>(
        user ? `/users/${user.id}` : "/users",
        user ? "PUT" : "POST",
        user
          ? {
              name: draft.name.trim(),
              role: draft.role,
              active: draft.active,
              ...(draft.password ? { password: draft.password } : {}),
            }
          : {
              name: draft.name.trim(),
              username: draft.username.trim(),
              password: draft.password,
              role: draft.role,
              locationId: draft.locationId,
            },
      ),
    onSuccess: async () => {
      setDraft((previous) => ({ ...previous, password: "" }));
      if (
        user?.id === current.id &&
        (!draft.active || draft.role !== current.role || draft.password)
      ) {
        logout();
        return;
      }
      await cache.invalidateQueries({ queryKey: ["users"] });
      onSaved();
    },
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    const validation = validateUser(draft, !user);
    setErrors(validation);
    if (!validation.length) mutation.mutate();
  }
  return (
    <form className="panel editor-panel user-editor" onSubmit={submit}>
      <div className="panel-header">
        <h2>{user ? `Editar acesso: ${user.name}` : "Adicionar pessoa"}</h2>
        <button
          className="icon-button"
          aria-label="Fechar edição"
          type="button"
          disabled={mutation.isPending}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      <ValidationErrors errors={errors} />
      {mutation.isError && <ErrorPanel error={mutation.error} />}
      {locations.isError && (
        <ErrorPanel
          error={locations.error}
          retry={() => void locations.refetch()}
        />
      )}
      <fieldset disabled={mutation.isPending}>
        <legend className="sr-only">Dados de acesso</legend>
        <div className="form-grid">
          <label>
            Nome completo
            <input
              required
              value={draft.name}
              maxLength={160}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <label>
            Usuário
            <input
              required
              disabled={Boolean(user)}
              autoComplete="off"
              value={draft.username}
              maxLength={120}
              onChange={(e) => setDraft({ ...draft, username: e.target.value })}
            />
          </label>
          <label>
            Unidade{user ? " (vínculo atual)" : ""}
            <select
              value={draft.locationId}
              required
              disabled={Boolean(user) || !locations.data}
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
            Perfil
            <select
              value={draft.role}
              onChange={(e) =>
                setDraft({ ...draft, role: e.target.value as Role })
              }
            >
              {Object.entries(copy.role).map(([value, label]) => (
                <option value={value} key={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            {user ? "Redefinir senha (opcional)" : "Senha inicial"}
            <input
              required={!user}
              type="password"
              autoComplete="new-password"
              minLength={10}
              maxLength={256}
              value={draft.password}
              onChange={(e) => setDraft({ ...draft, password: e.target.value })}
              placeholder="Pelo menos 10 caracteres"
            />
          </label>
        </div>
        {user && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />
            Acesso ativo
          </label>
        )}
      </fieldset>
      {user?.id === current.id && (
        <Notice tone="warning">
          Alterar seu próprio perfil, senha ou ativação encerra esta sessão.
        </Notice>
      )}
      <div className="form-actions">
        <button
          type="button"
          className="button secondary"
          disabled={mutation.isPending}
          onClick={onClose}
        >
          Cancelar
        </button>
        <button
          className="button primary"
          disabled={mutation.isPending || (!user && !locations.data)}
        >
          {mutation.isPending
            ? copy.common.saving
            : user
              ? "Salvar acesso"
              : "Adicionar pessoa"}
        </button>
      </div>
    </form>
  );
}
