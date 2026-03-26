import { Badge, Card, CardContent, CardHeader, CardTitle, Icon, LoadingState } from "../components/ui";
import { useAsyncData } from "../hooks/useAsyncData";
import { dashboardApi } from "../lib/api";

const DashboardPage = () => {
  const { data, loading, error } = useAsyncData(() => dashboardApi.getStats(), []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard Institucional</h1>

      {loading ? <LoadingState /> : null}
      {error ? <Badge variant="destructive">{error}</Badge> : null}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Total de Ativos</CardTitle>
            <Icon name="laptop" className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.totalAssets ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Caixas Emprestadas</CardTitle>
            <Icon name="package" className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.borrowedBoxes ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Defeitos Abertos</CardTitle>
            <Icon name="alert-triangle" className="text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{data?.openIncidents ?? 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Auditorias OK</CardTitle>
            <Icon name="check-circle" className="text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{data?.okRate ?? 0}%</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
