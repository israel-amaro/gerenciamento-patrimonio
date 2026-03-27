import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button, Card, CardContent, CardHeader, CardTitle, Icon, InlineMessage, Input, Select } from "../components/ui";
import { openPrintLabelsDocument, openPrintTableDocument } from "../lib/reporting";
import { reportsApi } from "../lib/api";
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
          setMessage(err.message || "Nao foi possivel carregar as etiquetas.");
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
        title: "Relatorio de inventario",
        subtitle: `Periodo: ${periodLabel}`,
        columns: ["Patrimonio", "Modelo", "Serial", "Status", "Host", "Dominio", "Laboratorio", "Tipo", "QR"],
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
      setMessage("Relatorio de inventario aberto para PDF.");
    } catch (err) {
      setMessage(err.message || "Nao foi possivel gerar o relatorio de inventario.");
    }
  };

  const exportUsage = async () => {
    try {
      const rows = await reportsApi.usage(filters);
      await openPrintTableDocument({
        title: "Historico de uso",
        subtitle: `Periodo: ${periodLabel}`,
        columns: ["ID", "Carrinho", "Laboratorio", "Ativo", "Responsavel", "Turma", "Retirada", "Previsao", "Status"],
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
      setMessage("Historico de uso aberto para PDF.");
    } catch (err) {
      setMessage(err.message || "Nao foi possivel gerar o historico de uso.");
    }
  };

  const exportIncidents = async () => {
    try {
      const rows = await reportsApi.incidents(filters);
      await openPrintTableDocument({
        title: "Relatorio de defeitos",
        subtitle: `Periodo: ${periodLabel}`,
        columns: ["ID", "Ativo", "Carrinho", "Laboratorio", "Origem", "Problema", "Severidade", "Status", "Data"],
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
      setMessage("Relatorio de defeitos aberto para PDF.");
    } catch (err) {
      setMessage(err.message || "Nao foi possivel gerar o relatorio de defeitos.");
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
        title: "Relatorio consolidado",
        subtitle: `Periodo: ${periodLabel}`,
        columns: ["Tipo", "ID", "Alvo", "Campo1", "Campo2", "Campo3", "Data", "Observacoes"],
        rows
      });
      setMessage("Relatorio consolidado aberto para PDF.");
    } catch (err) {
      setMessage(err.message || "Nao foi possivel gerar o relatorio consolidado.");
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
          qrPreview: label.qr_code_value ? await QRCode.toDataURL(label.qr_code_value, { margin: 1, width: 220 }) : ""
        }))
      );

      const title = labelType === "assets" ? "Etiquetas de ativos" : labelType === "boxes" ? "Etiquetas de carrinhos" : "Etiquetas de laboratorios";
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
      setMessage("Etiquetas abertas para impressao.");
    } catch (err) {
      setMessage(err.message || "Nao foi possivel imprimir as etiquetas.");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Relatorios e Impressao de QR</h1>
        <p className="text-muted-foreground">Exporte historicos por periodo e imprima etiquetas de ativos, carrinhos e laboratorios.</p>
      </div>

      {message ? <InlineMessage tone={message.includes("sucesso") ? "success" : "error"}>{message}</InlineMessage> : null}

      <Card>
        <CardHeader>
          <CardTitle>Periodo</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          <Button variant="outline" onClick={() => { setDateFrom(""); setDateTo(""); }}>Limpar periodo</Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card>
          <CardHeader><CardTitle>Inventario</CardTitle></CardHeader>
          <CardContent>
            <Button variant="outline" onClick={exportAssets}>
              <Icon name="download" className="mr-2" />
              PDF de ativos
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
              PDF consolidado
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Impressao de QR Codes</CardTitle>
          <div className="flex gap-2">
            <Select value={labelType} onChange={(event) => setLabelType(event.target.value)}>
              <option value="assets">Ativos</option>
              <option value="boxes">Carrinhos</option>
              <option value="labs">Laboratorios</option>
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
              placeholder={`Buscar ${labelType === "assets" ? "ativo" : labelType === "boxes" ? "carrinho" : "laboratorio"}...`}
              className="md:max-w-sm"
              value={labelSearch}
              onChange={(event) => setLabelSearch(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={toggleAllFiltered}>
                {filteredLabels.length > 0 && filteredLabels.every((label) => selectedLabelIds.includes(label.id)) ? "Desmarcar filtrados" : "Selecionar filtrados"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setSelectedLabelIds([])}>
                Limpar selecao
              </Button>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            {selectedLabelIds.length} selecionado(s) para impressao
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
                        <div className="text-sm text-muted-foreground">{secondary || "Sem informacao complementar"}</div>
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
