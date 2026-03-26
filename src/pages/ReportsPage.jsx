import { useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Icon, InlineMessage } from "../components/ui";
import { reportsApi } from "../lib/api";
import { downloadCsv } from "../lib/utils";

const ReportsPage = () => {
  const [message, setMessage] = useState("");

  const exportAssets = async () => {
    try {
      const rows = await reportsApi.assetsCsv();
      downloadCsv("inventario.csv", [
        ["Patrimonio", "Modelo", "Serial", "Status", "Laboratorio", "Tipo"],
        ...rows.map((row) => [
          row.tag_code,
          row.model,
          row.serial_number,
          row.status,
          row.labs?.name || "",
          row.asset_types?.name || ""
        ])
      ]);
      setMessage("CSV gerado com sucesso.");
    } catch (err) {
      setMessage(err.message || "Não foi possível exportar os dados.");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Relatórios & QR Print</h1>
      {message ? <InlineMessage tone={message.includes("sucesso") ? "success" : "error"}>{message}</InlineMessage> : null}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Exportação de Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={exportAssets}>
              <Icon name="download" className="mr-2" />
              CSV de Inventário
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Impressão de QR Codes</CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" onClick={() => window.print()}>
              <Icon name="printer" className="mr-2" />
              Gerar PDF das Etiquetas Lote 01
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReportsPage;
