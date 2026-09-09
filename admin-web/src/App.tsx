import { Component, lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Link, Route, Routes } from "react-router-dom";
import { useSession, useUser } from "./auth";
import { Empty, Loading, Notice, PageHeader } from "./components";
import Layout from "./Layout";
import Login from "./pages/Login";
import type { Role } from "./types";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Vehicles = lazy(() => import("./pages/Vehicles"));
const VehicleDetail = lazy(() =>
  import("./pages/Vehicles").then((m) => ({ default: m.VehicleDetail })),
);
const NewVehicle = lazy(() =>
  import("./pages/Vehicles").then((m) => ({ default: m.NewVehicle })),
);
const Templates = lazy(() => import("./pages/Templates"));
const TemplateEditor = lazy(() =>
  import("./pages/Templates").then((m) => ({ default: m.TemplateEditorPage })),
);
const Inspections = lazy(() => import("./pages/Inspections"));
const InspectionDetail = lazy(() =>
  import("./pages/Inspections").then((m) => ({ default: m.InspectionDetail })),
);
const Users = lazy(() => import("./pages/Users"));
const Audit = lazy(() => import("./pages/Audit"));
const Organization = lazy(() => import("./pages/Organization"));
const Employees = lazy(() => import("./pages/Employees"));
const VehicleTypes = lazy(() => import("./pages/VehicleTypes"));

function RoleGate({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const user = useUser();
  return roles.includes(user.role) ? (
    children
  ) : (
    <>
      <PageHeader title="Acesso restrito" />
      <Notice tone="warning">Seu perfil não permite acessar esta área.</Notice>
      <Link className="button secondary" to="/">
        Voltar à visão da oficina
      </Link>
    </>
  );
}
export default function App() {
  const { session } = useSession();
  return (
    <ErrorBoundary>
      <BrowserRouter>
        {!session ? (
          <Login />
        ) : (
          <Suspense fallback={<Loading />}>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Dashboard />} />
                <Route path="vehicles" element={<Vehicles />} />
                <Route
                  path="vehicle-types"
                  element={
                    <RoleGate roles={["Administrator"]}>
                      <VehicleTypes />
                    </RoleGate>
                  }
                />
                <Route
                  path="vehicles/new"
                  element={
                    <RoleGate roles={["Administrator"]}>
                      <NewVehicle />
                    </RoleGate>
                  }
                />
                <Route path="vehicles/:id" element={<VehicleDetail />} />
                <Route path="templates" element={<Templates />} />
                <Route
                  path="templates/new"
                  element={
                    <RoleGate roles={["Administrator", "Supervisor"]}>
                      <TemplateEditor />
                    </RoleGate>
                  }
                />
                <Route path="inspections" element={<Inspections />} />
                <Route path="inspections/:id" element={<InspectionDetail />} />
                <Route
                  path="users"
                  element={
                    <RoleGate roles={["Administrator"]}>
                      <Users />
                    </RoleGate>
                  }
                />
                <Route
                  path="organization"
                  element={
                    <RoleGate roles={["Administrator"]}>
                      <Organization />
                    </RoleGate>
                  }
                />
                <Route
                  path="employees"
                  element={
                    <RoleGate roles={["Administrator"]}>
                      <Employees />
                    </RoleGate>
                  }
                />
                <Route
                  path="audit"
                  element={
                    <RoleGate roles={["Administrator", "Supervisor"]}>
                      <Audit />
                    </RoleGate>
                  }
                />
                <Route
                  path="*"
                  element={
                    <Empty
                      title="Página não encontrada"
                      description="Use o menu para abrir uma área da oficina."
                      action={
                        <Link className="button primary" to="/">
                          Voltar à oficina
                        </Link>
                      }
                    />
                  }
                />
              </Route>
            </Routes>
          </Suspense>
        )}
      </BrowserRouter>
    </ErrorBoundary>
  );
}
class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="fatal-error">
        <h1>Não foi possível abrir esta tela</h1>
        <p>
          Recarregue a página e entre novamente. Os registros já enviados
          permanecem no servidor.
        </p>
        <button
          className="button primary"
          onClick={() => window.location.reload()}
        >
          Recarregar
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
