import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button, Card, CardContent, CardHeader, CardTitle, Icon, InlineMessage, Input, Select } from "../components/ui";
import { openPrintLabelsDocument, openPrintTableDocument } from "../lib/reporting";
import { reportsApi } from "../lib/api";
import { ensureAssetQrUrl, ensureBoxQrUrl, ensureLabQrUrl } from "../lib/qr";
import { formatDateTime } from "../lib/utils";

const ReportsPage = () => {
  const [message, setMessage] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [labelType, setLabelType] = useState("assets");
  const [labels, setLabels] = useState([]);
  const [labelSearch, setLabelSearch] = useState("");
  const [selectedLabelIds, setSelectedLabelIds] = useState([]);
  const [loadingLabels, setLoadingLabels] = useState(false);

  const filters = { dateFrom, dateTo };

  const periodLabel = [dateFrom || null, dateTo || null].filter(Boolean).join(" ate ") || "Todos os registros";

  useEffect(() => {
    let active = true;

    const loadLabels = async () => {
      setLoadingLabels(true);

      try {
        const rows =
          labelType === "assets"
            ? await reportsApi.assetsCsv()
            : labelType === "boxes"
              ? await reportsApi.boxesCsv()
              : await reportsApi.labsCsv();

        if (active) {
          setLabels(rows);
          setSelectedLabelIds([]);
        }
      } catch (err) {
        if (active) {
          setMessage(err.message || "Não foi possível carregar as etiquetas.");
        }
      } finally {
        if (active) {
          setLoadingLabels(false);
        }
      }
    };

    loadLabels();

    return () => {
      active = false;
    };
  }, [labelType]);

  const exportAssets = async () => {
    try {
      const rows = await reportsApi.assetsCsv();
      await openPrintTableDocument({
        title: "Relatório de inventário",
        subtitle: `Periodo: ${periodLabel}`,
        columns: ["Patrimônio", "Modelo", "Serial", "Status", "Host", "Domínio", "Laboratório", "Tipo", "QR"],
        rows: rows.map((row) => [
          row.tag_code,
          row.model,
          row.serial_number,
          row.status,
          row.host_name,
          row.domain_name,
          row.labs?.name || "",
          row.asset_types?.name || "",
          row.qr_code_value || ""
        ])
      });
      setMessage("Relatório de inventário aberto para PDF.");
    } catch (err) {
      setMessage(err.message || "Não foi possível gerar o relatório de inventário.");
    }
  };

  const exportUsage = async () => {
    try {
      const rows = await reportsApi.usage(filters);
      await openPrintTableDocument({
        title: "Histórico de uso",
        subtitle: `Periodo: ${periodLabel}`,
        columns: ["ID", "Carrinho", "Laboratório", "Ativo", "Responsável", "Turma", "Retirada", "Previsão", "Status"],
        rows: rows.map((row) => [
          row.id,
          row.box_id || "",
          row.lab_id || "",
          row.asset_id || "",
          row.responsible_name,
          row.session_class,
          formatDateTime(row.borrowed_at),
          formatDateTime(row.expected_return_at),
          row.status
        ])
      });
      setMessage("Histórico de uso aberto para PDF.");
    } catch (err) {
      setMessage(err.message || "Não foi possível gerar o histórico de uso.");
    }
  };

  const exportIncidents = async () => {
    try {
      const rows = await reportsApi.incidents(filters);
      await openPrintTableDocument({
        title: "Relatório de defeitos",
        subtitle: `Periodo: ${periodLabel}`,
        columns: ["ID", "Ativo", "Carrinho", "Laboratório", "Origem", "Problema", "Severidade", "Status", "Data"],
        rows: rows.map((row) => [
          row.id,
          row.assets?.tag_code || "",
          row.boxes?.name || "",
          row.labs?.name || "",
          row.source || "",
          row.title,
          row.severity,
          row.status,
          formatDateTime(row.created_at)
        ])
      });
      setMessage("Relatório de defeitos aberto para PDF.");
    } catch (err) {
      setMessage(err.message || "Não foi possível gerar o relatório de defeitos.");
    }
  };

  const exportTimeline = async () => {
    try {
      const data = await reportsApi.timeline(filters);
      const rows = [
        ...data.usages.map((row) => ["uso", row.id, row.box_id || row.lab_id || row.asset_id || "", row.responsible_name, row.session_class, row.status, formatDateTime(row.borrowed_at), ""]),
        ...data.incidents.map((row) => ["defeito", row.id, row.assets?.tag_code || row.boxes?.name || row.labs?.name || "", row.title, row.source, row.status, formatDateTime(row.created_at), row.severity]),
        ...data.audits.map((row) => ["auditoria", row.id, row.assets?.tag_code || "", row.status, "", "", formatDateTime(row.audited_at), row.notes || ""]),
        ...data.labChecklists.map((row) => ["checklist_lab", row.id, row.labs?.name || "", row.responsible_name, row.session_class, row.status, formatDateTime(row.reported_at), row.notes || ""]),
        ...data.boxChecklists.map((row) => ["checklist_carrinho", row.id, row.boxes?.name || "", row.responsible_name, row.session_class, `${row.stage}:${row.status}`, formatDateTime(row.reported_at), row.notes || ""])
      ];

      await openPrintTableDocument({
        title: "Relatório consolidado",
        subtitle: `Periodo: ${periodLabel}`,
        columns: ["Tipo", "ID", "Alvo", "Campo 1", "Campo 2", "Campo 3", "Data", "Observações"],
        rows
      });
      setMessage("Relatório consolidado aberto para PDF.");
    } catch (err) {
      setMessage(err.message || "Não foi possível gerar o relatório consolidado.");
    }
  };

  const filteredLabels = labels.filter((label) => {
    const primary = labelType === "assets" ? label.tag_code : label.name;
    const secondary =
      labelType === "assets"
        ? [label.model, label.serial_number, label.host_name, label.domain_name, label.labs?.name].filter(Boolean).join(" ")
        : [label.location, label.description].filter(Boolean).join(" ");

    const haystack = `${primary || ""} ${secondary}`.toLowerCase();
    return haystack.includes(labelSearch.toLowerCase());
  });

  const toggleLabel = (labelId) => {
    setSelectedLabelIds((current) =>
      current.includes(labelId) ? current.filter((id) => id !== labelId) : [...current, labelId]
    );
  };

  const toggleAllFiltered = () => {
    const filteredIds = filteredLabels.map((label) => label.id);
    const allFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedLabelIds.includes(id));

    setSelectedLabelIds((current) => {
      if (allFilteredSelected) {
        return current.filter((id) => !filteredIds.includes(id));
      }

      return Array.from(new Set([...current, ...filteredIds]));
    });
  };

  const printSelectedLabels = async () => {
    try {
      const selectedLabels = labels.filter((label) => selectedLabelIds.includes(label.id));

      if (selectedLabels.length === 0) {
        throw new Error("Selecione ao menos um item para imprimir.");
      }

      const labelsWithQr = await Promise.all(
        selectedLabels.map(async (label) => ({
          ...label,
          qrValue:
            labelType === "assets"
              ? ensureAssetQrUrl(label.qr_code_value, label.id)
              : labelType === "boxes"
                ? ensureBoxQrUrl(label.qr_code_value, label.id)
                : ensureLabQrUrl(label.qr_code_value, label.id)
        })).map(async (label) => ({
          ...label,
          qrPreview: label.qrValue ? await QRCode.toDataURL(label.qrValue, { margin: 1, width: 220 }) : ""
        }))
      );

      const title = labelType === "assets" ? "Etiquetas de ativos" : labelType === "boxes" ? "Etiquetas de carrinhos" : "Etiquetas de laboratórios";
      const cards = labelsWithQr.map((label) => {
        const primary = labelType === "assets" ? label.tag_code : label.name;
        const secondary =
          labelType === "assets"
            ? [label.model, label.host_name || label.serial_number].filter(Boolean).join(" | ")
            : label.location || label.description || "";

        return {
          title: primary || "-",
          subtitle: secondary || "",
          qrPreview: label.qrPreview,
          alt: `QR ${label.id}`
        };
      });

      await openPrintLabelsDocument({ title, cards });
      setMessage("Etiquetas abertas para impressão.");
    } catch (err) {
      setMessage(err.message || "Não foi possível imprimir as etiquetas.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatórios e impressão de QR</h1>
        <p className="text-muted-foreground">Gere relatórios em PDF por período e imprima etiquetas de ativos, carrinhos e laboratórios.</p>
      </div>

      {message ? <InlineMessage tone={message.includes("sucesso") ? "success" : "error"}>{message}</InlineMessage> : null}

      <Card>
        <CardHeader>
          <CardTitle>Período</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          <Button variant="outline" onClick={() => { setDateFrom(""); setDateTo(""); }}>Limpar período</Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader><CardTitle>Inventário</CardTitle></CardHeader>
          <CardContent>
            <Button variant="outline" onClick={exportAssets}>
              <Icon name="download" className="mr-2" />
              Inventário em PDF
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Usos</CardTitle></CardHeader>
          <CardContent>
            <Button variant="outline" onClick={exportUsage}>
              <Icon name="download" className="mr-2" />
              PDF de usos
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Defeitos</CardTitle></CardHeader>
          <CardContent>
            <Button variant="outline" onClick={exportIncidents}>
              <Icon name="download" className="mr-2" />
              PDF de defeitos
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Consolidado</CardTitle></CardHeader>
          <CardContent>
            <Button variant="outline" onClick={exportTimeline}>
              <Icon name="download" className="mr-2" />
              Consolidado em PDF
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Impressão de QR Codes</CardTitle>
          <div className="flex gap-2">
            <Select value={labelType} onChange={(event) => setLabelType(event.target.value)}>
              <option value="assets">Ativos</option>
              <option value="boxes">Carrinhos</option>
              <option value="labs">Laboratórios</option>
            </Select>
            <Button variant="outline" onClick={printSelectedLabels}>
              <Icon name="printer" className="mr-2" />
              Imprimir etiquetas
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadingLabels ? <div className="text-sm text-muted-foreground">Gerando etiquetas...</div> : null}
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Input
              placeholder={`Buscar ${labelType === "assets" ? "ativo" : labelType === "boxes" ? "carrinho" : "laboratório"}...`}
              className="md:max-w-sm"
              value={labelSearch}
              onChange={(event) => setLabelSearch(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={toggleAllFiltered}>
                {filteredLabels.length > 0 && filteredLabels.every((label) => selectedLabelIds.includes(label.id)) ? "Desmarcar filtrados" : "Selecionar filtrados"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setSelectedLabelIds([])}>
                Limpar seleção
              </Button>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {selectedLabelIds.length} selecionado(s) para impressão
          </div>
          <div className="max-h-[420px] overflow-y-auto rounded-lg border">
            {filteredLabels.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">Nenhum item encontrado para este filtro.</div>
            ) : (
              <div className="divide-y">
                {filteredLabels.map((label) => {
                  const selected = selectedLabelIds.includes(label.id);
                  const primary = labelType === "assets" ? label.tag_code : label.name;
                  const secondary =
                    labelType === "assets"
                      ? [label.model, label.host_name || label.serial_number, label.labs?.name].filter(Boolean).join(" | ")
                      : [label.location, label.description].filter(Boolean).join(" | ");

                  return (
                    <button
                      key={label.id}
                      type="button"
                      onClick={() => toggleLabel(label.id)}
                      className={`flex w-full items-start justify-between gap-4 p-4 text-left transition-colors ${selected ? "bg-primary/5" : "bg-white hover:bg-muted/40"}`}
                    >
                      <div>
                        <div className="font-medium">{primary || "-"}</div>
                        <div className="text-sm text-muted-foreground">{secondary || "Sem informação complementar"}</div>
                      </div>
                      <div className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${selected ? "border-primary/20 bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}>
                        {selected ? "Selecionado" : "Selecionar"}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReportsPage;
