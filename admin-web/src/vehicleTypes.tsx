import { useQuery } from "@tanstack/react-query";
import { useSession } from "./auth";
import { ErrorPanel } from "./components";
import type { VehicleType } from "./types";

export function useVehicleTypes() {
  const { api } = useSession();
  return useQuery({
    queryKey: ["vehicle-types"],
    queryFn: ({ signal }) => api.get<VehicleType[]>("/vehicle-types", signal),
  });
}

export function VehicleTypeField({
  query,
  value,
  existingCode,
  allowUnchangedRetired = false,
  onChange,
}: {
  query: ReturnType<typeof useVehicleTypes>;
  value: string;
  existingCode?: string;
  allowUnchangedRetired?: boolean;
  onChange: (value: string) => void;
}) {
  const existing = query.data?.find((type) => type.code === existingCode);
  const retired = Boolean(existingCode && query.data && !existing?.active);
  return (
    <div className="vehicle-type-field">
      <label>
        Tipo de veículo
        <select
          required
          value={value}
          disabled={!query.data}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">
            {query.isPending ? "Consultando tipos…" : "Selecione o tipo"}
          </option>
          {existingCode && !existing && (
            <option value={existingCode} disabled={!allowUnchangedRetired}>
              {existingCode} (referência existente)
            </option>
          )}
          {query.data
            ?.filter((type) => type.active || type.code === existingCode)
            .map((type) => (
              <option
                key={type.id}
                value={type.code}
                disabled={!type.active && !allowUnchangedRetired}
              >
                {type.name} · {type.code}
                {type.active ? "" : " (desativado)"}
              </option>
            ))}
        </select>
      </label>
      {query.isError && (
        <ErrorPanel error={query.error} retry={() => void query.refetch()} />
      )}
      {query.data && !query.data.some((type) => type.active) && (
        <p className="field-help">
          Não há tipos ativos. Um administrador pode ativar ou cadastrar um tipo
          em Tipos de veículo.
        </p>
      )}
      {retired && value === existingCode && (
        <p className="field-help">
          {allowUnchangedRetired
            ? "Este tipo foi retirado. Você pode manter o vínculo atual ao editar este veículo."
            : "O tipo da versão de origem foi retirado. Selecione um tipo ativo para salvar uma nova versão."}
        </p>
      )}
    </div>
  );
}
