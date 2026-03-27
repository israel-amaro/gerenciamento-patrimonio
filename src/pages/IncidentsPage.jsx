import { useState } from "react";
import { Badge, Button, Card, EmptyState, FormField, Icon, InlineMessage, Input, LoadingState, Select, Textarea } from "../components/ui";
import { useAuth } from "../contexts/AuthContext";
import { useAsyncData } from "../hooks/useAsyncData";
import { incidentsApi, lookupApi } from "../lib/api";

const initialForm = {
  asset_id: "",
  title: "",
  description: "",
  severity: "medium",
  status: "open"
};

const severityMap = {
  low: ["Baixa", "outline"],
  medium: ["Moderada", "warning"],
  high: ["Alta", "destructive"],
  critical: ["Crítica", "destructive"]
};

const statusOptions = {
  open: "Aberto",
  in_review: "Em análise",
  in_maintenance: "Em manutenção",
  resolved: "Resolvido",
  discarded: "Descartado"
};

const sourceOptions = {
  manual: "Manual",
  audit: "Auditoria Tech",
  professor_checklist: "Checklist rápido",
  return_flow: "Fluxo de devolução"
};

const IncidentsPage = () => {
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const incidents = useAsyncData(() => incidentsApi.list({ search, dateFrom, dateTo }), [search, dateFrom, dateTo]);
  const assets = useAsyncData(() => lookupApi.assets(), []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleEdit = (incident) => {
    setSelectedIncident(incident);
    setEditingId(incident.id);
    setForm({
      asset_id: incident.asset_id || "",
      title: incident.title,
      description: incident.description || "",
      severity: incident.severity,
      status: incident.status
    });
    setShowForm(true);
  };

  const reset = () => {
    setEditingId("");
    setSelectedIncident(null);
    setForm(initialForm);
    setShowForm(false);
  };

  const handleView = (incident) => {
    setSelectedIncident(incident);
    setEditingId("");
    setShowForm(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFeedback("");
    setSubmitting(true);

    try {
      if (!form.asset_id || !form.title.trim()) {
        throw new Error("Selecione o ativo e informe o problema.");
      }

      const payload = {
        asset_id: form.asset_id,
        reported_by: profile.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        severity: form.severity,
        status: form.status,
        source: "manual"
      };

      if (editingId) {
        await incidentsApi.update(editingId, payload);
      } else {
        await incidentsApi.create(payload);
      }

      reset();
      await incidents.reload();
    } catch (err) {
      setFeedback(err.message || "Não foi possível salvar o chamado.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Defeitos / Incidentes</h1>
        <Button variant="destructive" onClick={() => setShowForm((current) => !current)}>
          <Icon name="alert-triangle" className="mr-2 h-4 w-4" />
          {showForm ? "Fechar" : "Abrir chamado"}
        </Button>
      </div>

      {showForm ? (
        <Card>
          <form className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSubmit}>
            <FormField label="Ativo">
              <Select name="asset_id" value={form.asset_id} onChange={handleChange}>
                <option value="">Selecione</option>
                {assets.data?.map((asset) => (
                  <option key={asset.id} value={asset.id}>{asset.tag_code} - {asset.model}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Severidade">
              <Select name="severity" value={form.severity} onChange={handleChange}>
                {Object.entries(severityMap).map(([value, [label]]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </FormField>
            <div className="md:col-span-2">
              <FormField label="Problema">
                <Input name="title" value={form.title} onChange={handleChange} />
              </FormField>
            </div>
            <div className="md:col-span-2">
              <FormField label="Descrição">
                <Textarea name="description" value={form.description} onChange={handleChange} />
              </FormField>
            </div>
            <FormField label="Status">
              <Select name="status" value={form.status} onChange={handleChange}>
                {Object.entries(statusOptions).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </FormField>
            {feedback ? <div className="md:col-span-2"><InlineMessage tone="error">{feedback}</InlineMessage></div> : null}
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={reset}>Cancelar</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : "Salvar chamado"}</Button>
            </div>
          </form>
        </Card>
      ) : null}

      {selectedIncident ? (
        <Card>
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs uppercase text-muted-foreground">Alvo</div>
              <div className="font-medium">{selectedIncident.assets?.tag_code || selectedIncident.boxes?.name || selectedIncident.labs?.name || "-"}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Origem</div>
              <div>{sourceOptions[selectedIncident.source] || selectedIncident.source || "-"}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Problema</div>
              <div className="font-medium">{selectedIncident.title}</div>
            </div>
            <div>
              <div className="text-xs uppercase text-muted-foreground">Status</div>
              <div>{statusOptions[selectedIncident.status] || selectedIncident.status}</div>
            </div>
            <div className="md:col-span-2">
              <div className="text-xs uppercase text-muted-foreground">Descrição completa</div>
              <div className="mt-1 rounded-md border bg-muted/20 p-3 whitespace-pre-wrap min-h-20">
                {selectedIncident.description || "Sem descrição informada."}
              </div>
            </div>
            <div className="md:col-span-2 flex justify-end gap-2">
              {selectedIncident.asset_id ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowForm(true);
                    setEditingId(selectedIncident.id);
                    setForm({
                      asset_id: selectedIncident.asset_id || "",
                      title: selectedIncident.title,
                      description: selectedIncident.description || "",
                      severity: selectedIncident.severity,
                      status: selectedIncident.status
                    });
                  }}
                >
                  Editar
                </Button>
              ) : null}
              <Button variant="ghost" onClick={() => setSelectedIncident(null)}>Fechar detalhe</Button>
            </div>
          </div>
        </Card>
      ) : null}

      <Card>
        <div className="p-4 border-b bg-muted/20 flex flex-wrap gap-2">
          <Input placeholder="Buscar incidente..." className="max-w-sm" value={search} onChange={(event) => setSearch(event.target.value)} />
          <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </div>
        <div className="overflow-x-auto">
          {incidents.loading ? <div className="p-4"><LoadingState /></div> : null}
          {incidents.error ? <div className="p-4"><InlineMessage tone="error">{incidents.error}</InlineMessage></div> : null}
          {!incidents.loading && !incidents.error && incidents.data?.length === 0 ? (
            <EmptyState title="Nenhum incidente encontrado" description="Abra um chamado para acompanhar defeitos e ocorrências." />
          ) : null}
          {incidents.data?.length ? (
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Alvo</th>
                  <th>Problema</th>
                  <th>Origem</th>
                  <th>Severidade</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {incidents.data.map((incident) => (
                  <tr key={incident.id} className="hover:bg-muted/50">
                    <td className="font-medium">{incident.id.slice(0, 8)}</td>
                    <td>{incident.assets?.tag_code || incident.boxes?.name || incident.labs?.name || "-"}</td>
                    <td className="truncate max-w-[220px]">{incident.title}</td>
                    <td>{sourceOptions[incident.source] || incident.source || "-"}</td>
                    <td>
                      <Badge variant={severityMap[incident.severity]?.[1] || "outline"}>
                        {severityMap[incident.severity]?.[0] || incident.severity}
                      </Badge>
                    </td>
                    <td>
                      <Badge variant="outline">{statusOptions[incident.status] || incident.status}</Badge>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleView(incident)}>Ver</Button>
                        {incident.asset_id ? <Button variant="ghost" size="sm" onClick={() => handleEdit(incident)}>Tratar</Button> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </Card>
    </div>
  );
};

export default IncidentsPage;
