import { useState } from "react";
import { Badge, Button, Card, EmptyState, FormField, Icon, InlineMessage, Input, LoadingState, Select } from "../components/ui";
import { useAsyncData } from "../hooks/useAsyncData";
import { boxesApi, lookupApi } from "../lib/api";

const initialForm = {
  id: "",
  name: "",
  description: "",
  status: "available",
  assetIds: []
};

const statusMap = {
  available: ["Disponível", "success"],
  borrowed: ["Emprestada", "default"],
  maintenance: ["Manutenção", "warning"]
};

const BoxesPage = () => {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const boxes = useAsyncData(() => boxesApi.list(search), [search]);
  const assets = useAsyncData(() => lookupApi.assets(), []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleAssetSelection = (event) => {
    const selected = Array.from(event.target.selectedOptions, (option) => option.value);
    setForm((current) => ({ ...current, assetIds: selected }));
  };

  const handleEdit = (box) => {
    setForm({
      id: box.id,
      name: box.name,
      description: box.description || "",
      status: box.status,
      assetIds: box.box_assets?.map((item) => item.asset_id) || []
    });
    setShowForm(true);
  };

  const reset = () => {
    setForm(initialForm);
    setShowForm(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFeedback("");
    setSubmitting(true);

    try {
      if (!form.name.trim()) {
        throw new Error("Informe o nome da caixa.");
      }

      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        status: form.status,
        assetIds: form.assetIds
      };

      if (form.id) {
        await boxesApi.update(form.id, payload);
      } else {
        await boxesApi.create(payload);
      }

      setFeedback("Caixa salva com sucesso.");
      reset();
      await boxes.reload();
    } catch (err) {
      setFeedback(err.message || "Não foi possível salvar a caixa.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Caixas (Lotes)</h1>
        <Button onClick={() => setShowForm((current) => !current)}>
          <Icon name="plus" className="mr-2" />
          {showForm ? "Fechar" : "Nova Caixa"}
        </Button>
      </div>

      {showForm ? (
        <Card>
          <form className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4" onSubmit={handleSubmit}>
            <FormField label="Nome da Caixa">
              <Input name="name" value={form.name} onChange={handleChange} />
            </FormField>
            <FormField label="Status">
              <Select name="status" value={form.status} onChange={handleChange}>
                {Object.entries(statusMap).map(([value, [label]]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </FormField>
            <div className="md:col-span-2">
              <FormField label="Descrição">
                <Input name="description" value={form.description} onChange={handleChange} />
              </FormField>
            </div>
            <div className="md:col-span-2">
              <FormField label="Ativos da Caixa">
                <select
                  multiple
                  value={form.assetIds}
                  onChange={handleAssetSelection}
                  className="flex min-h-36 w-full rounded-md border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {assets.data?.map((asset) => (
                    <option key={asset.id} value={asset.id}>{asset.tag_code} - {asset.model}</option>
                  ))}
                </select>
              </FormField>
            </div>
            {feedback ? <div className="md:col-span-2"><InlineMessage tone={feedback.includes("sucesso") ? "success" : "error"}>{feedback}</InlineMessage></div> : null}
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={reset}>Cancelar</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : "Salvar caixa"}</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card>
        <div className="p-4 border-b bg-muted/20">
          <Input placeholder="Buscar caixa..." className="max-w-sm" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="overflow-x-auto">
          {boxes.loading ? <div className="p-4"><LoadingState /></div> : null}
          {boxes.error ? <div className="p-4"><InlineMessage tone="error">{boxes.error}</InlineMessage></div> : null}
          {!boxes.loading && !boxes.error && boxes.data?.length === 0 ? (
            <EmptyState title="Nenhuma caixa cadastrada" description="Crie uma caixa para organizar os ativos em lote." />
          ) : null}
          {boxes.data?.length ? (
            <table>
              <thead>
                <tr>
                  <th>Nome da Caixa</th>
                  <th>Qtd. Ativos</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {boxes.data.map((box) => (
                  <tr key={box.id} className="hover:bg-muted/50">
                    <td className="font-medium">{box.name}</td>
                    <td>{box.box_assets?.length || 0} ativos</td>
                    <td>
                      <Badge variant={statusMap[box.status]?.[1] || "outline"}>
                        {statusMap[box.status]?.[0] || box.status}
                      </Badge>
                    </td>
                    <td>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(box)}>Detalhes</Button>
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

export default BoxesPage;
