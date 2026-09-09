import type { ItemStatus, Role } from "./types";

// Add a dictionary with this shape to localize the interface; wire values stay unchanged.
export const pt = {
  brand: "Susumu",
  product: "Controle da oficina",
  locale: "pt-BR",
  nav: {
    dashboard: "Visão da oficina",
    vehicles: "Veículos",
    vehicleTypes: "Tipos de veículo",
    templates: "Checklists",
    inspections: "Inspeções",
    users: "Pessoas e acesso",
    employees: "Funcionários",
    organization: "Empresa e unidades",
    audit: "Auditoria",
  },
  role: {
    Administrator: "Administrador",
    Supervisor: "Supervisor",
    Inspector: "Inspetor",
    Office: "Escritório",
  } satisfies Record<Role, string>,
  status: {
    OK: "OK",
    Attention: "Atenção",
    Repair: "Reparar",
    Critical: "Crítico",
    NotApplicable: "Não aplicável",
  } satisfies Record<ItemStatus, string>,
  state: { Draft: "Em andamento", Finalized: "Finalizada" },
  common: {
    loading: "Consultando a oficina…",
    retry: "Tentar novamente",
    refresh: "Atualizar",
    save: "Salvar alterações",
    cancel: "Cancelar",
    back: "Voltar",
    active: "Ativo",
    inactive: "Inativo",
    noPermission: "Seu perfil não permite acessar esta área.",
    required: "Obrigatório",
    optional: "Opcional",
    saving: "Salvando…",
    search: "Pesquisar",
    online: "Conexão disponível",
    offline: "Sem conexão. Reconecte para consultar ou salvar alterações.",
    empty: "Nenhum registro encontrado.",
    print: "Imprimir / salvar PDF",
    csv: "Exportar CSV",
  },
  auth: {
    title: "A oficina, em um só lugar.",
    subtitle:
      "Inspeções, evidências e histórico da frota para acompanhar cada veículo com confiança.",
    login: "Entrar na oficina",
    username: "Usuário",
    password: "Senha",
    submit: "Entrar",
    pending: "Verificando acesso…",
    expired: "Sua sessão expirou. Entre novamente para continuar.",
    logout: "Sair",
    memory:
      "Por segurança, o acesso é encerrado ao recarregar ou fechar esta página.",
    denied: "Não foi possível entrar. Verifique usuário e senha.",
    access: "Acesso da equipe",
  },
};
export const copy = pt;
export function dateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Data indisponível"
    : new Intl.DateTimeFormat(copy.locale, {
        dateStyle: "short",
        timeStyle: "short",
      }).format(date);
}
export const number = (value: number | null | undefined) =>
  value != null && Number.isFinite(value)
    ? new Intl.NumberFormat(copy.locale, { maximumFractionDigits: 2 }).format(
        value,
      )
    : "—";
