import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Badge, Button, Card, EmptyState, FormField, Icon, InlineMessage, Input, LoadingState, Select } from "../components/ui";
import { useAsyncData } from "../hooks/useAsyncData";
import { boxesApi, lookupApi } from "../lib/api";
import { buildBoxQrUrl } from "../lib/qr";

const createInitialForm = () => {
  const id = crypto.randomUUID();

  return {
    id,
    name: "",
    description: "",
    qr_code_value: buildBoxQrUrl(id),
    expected_asset_count: "",
    status: "available",
    assetIds: []
  };
};

const statusMap = {
  available: ["Disponível", "success"],
  borrowed: ["Emprestado", "default"],
  maintenance: ["Manutencao", "warning"]
};

const BoxesPage = () => {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(createInitialForm);
  const [isEditing, setIsEditing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [qrPreview, setQrPreview] = useState("");

  const boxes = useAsyncData(() => boxesApi.list(search), [search]);
  const lookups = useAsyncData(async () => {
    const assets = await lookupApi.assets();
    return { assets };
  }, []);

  useEffect(() => {
    let active = true;

    const generateQrPreview = async () => {
      if (!form.qr_code_value) {
        setQrPreview("");
        return;
      }

      try {
        const image = await QRCode.toDataURL(form.qr_code_value, { margin: 1, width: 220 });
        if (active) {
          setQrPreview(image);
        }
      } catch (_error) {
        if (active) {
          setQrPreview("");
        }
      }
    };

    generateQrPreview();

    return () => {
      active = false;
    };
  }, [form.qr_code_value]);

  const reset = () => {
    setForm(createInitialForm());
    setIsEditing(false);
    setShowForm(false);
  };

  const handleCreate = () => {
    setForm(createInitialForm());
    setIsEditing(false);
    setShowForm(true);
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const toggleAsset = (assetId) => {
    setForm((current) => ({
      ...current,
      assetIds: current.assetIds.includes(assetId)
        ? current.assetIds.filter((id) => id !== assetId)
        : [...current.assetIds, assetId]
    }));
  };

  const handleEdit = (box) => {
    setForm({
      id: box.id,
      name: box.name,
      description: box.description || "",
      qr_code_value: box.qr_code_value || buildBoxQrUrl(box.id),
      expected_asset_count: box.expected_asset_count || "",
      status: box.status,
      assetIds: box.box_assets?.map((item) => item.asset_id) || []
    });
    setIsEditing(true);
    setShowForm(true);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFeedback("");
    setSubmitting(true);

    try {
      if (!form.name.trim()) {
        throw new Error("Informe o nome do carrinho.");
      }

      const payload = {
        id: form.id,
        name: form.name.trim(),
        description: form.description.trim() || null,
        qr_code_value: form.qr_code_value.trim(),
        expected_asset_count: form.expected_asset_count ? Number(form.expected_asset_count) : null,
        status: form.status,
        assetIds: form.assetIds
      };

      if (isEditing) {
        await boxesApi.update(form.id, payload);
      } else {
        await boxesApi.create(payload);
      }

      reset();
      await boxes.reload();
    } catch (err) {
      setFeedback(err.message || "Não foi possível salvar o carrinho.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Carrinhos</h1>
        <Button onClick={() => (showForm ? setShowForm(false) : handleCreate())}>
          <Icon name="plus" className="mr-2" />
          {showForm ? "Fechar" : "Novo Carrinho"}
        </Button>
      </div>

      {showForm ? (
        <Card>
          <form className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4" onSubmit={handleSubmit}>
            <FormField label="Nome do carrinho">
              <Input name="name" value={form.name} onChange={handleChange} />
            </FormField>
            <FormField label="Status">
              <Select name="status" value={form.status} onChange={handleChange}>
                {Object.entries(statusMap).map(([value, [label]]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </FormField>
            <div className="hidden md:block" />
            <div className="md:col-span-2">
              <FormField label="Descrição">
                <Input name="description" value={form.description} onChange={handleChange} />
              </FormField>
            </div>
            <FormField label="Quantidade esperada">
              <Input name="expected_asset_count" type="number" min="0" value={form.expected_asset_count} onChange={handleChange} />
            </FormField>
            <div className="md:col-span-2">
              <FormField label="Link salvo no QR">
                <Input name="qr_code_value" value={form.qr_code_value} onChange={handleChange} />
              </FormField>
            </div>
            <div className="md:col-span-1">
              <FormField label="Preview do QR">
                <div className="min-h-40 rounded-md border border-dashed border-border bg-muted/20 flex items-center justify-center p-4">
                  {qrPreview ? <img src={qrPreview} alt={`QR do carrinho ${form.name || form.id}`} className="h-36 w-36" /> : <span className="text-sm text-muted-foreground">QR indisponivel</span>}
                </div>
              </FormField>
            </div>
            <div className="md:col-span-3">
              <FormField label="Ativos do carrinho">
                <div className="rounded-md border border-border bg-white p-3 space-y-2 max-h-72 overflow-y-auto">
                  {lookups.data?.assets.map((asset) => {
                    const selected = form.assetIds.includes(asset.id);
                    return (
                      <button
                        key={asset.id}
                        type="button"
                        onClick={() => toggleAsset(asset.id)}
                        className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${selected ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"}`}
                      >
                        <span className="font-medium">{asset.tag_code || "Sem tag"}</span>
                        <span className="text-muted-foreground"> - {asset.model}</span>
                      </button>
                    );
                  })}
                </div>
              </FormField>
            </div>
            {feedback ? <div className="md:col-span-3"><InlineMessage tone="error">{feedback}</InlineMessage></div> : null}
            <div className="md:col-span-3 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={reset}>Cancelar</Button>
              <Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : "Salvar carrinho"}</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card>
        <div className="p-4 border-b bg-muted/20">
          <Input placeholder="Buscar carrinho..." className="max-w-sm" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="overflow-x-auto">
          {boxes.loading ? <div className="p-4"><LoadingState /></div> : null}
          {boxes.error ? <div className="p-4"><InlineMessage tone="error">{boxes.error}</InlineMessage></div> : null}
          {!boxes.loading && !boxes.error && boxes.data?.length === 0 ? (
            <EmptyState title="Nenhum carrinho cadastrado" description="Cadastre um carrinho e vincule os ativos que ele transporta." />
          ) : null}
          {boxes.data?.length ? (
            <table>
              <thead>
                <tr>
                  <th>Carrinho</th>
                  <th>Qtd. ativos</th>
                  <th>Status</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {boxes.data.map((box) => (
                  <tr key={box.id} className="hover:bg-muted/50">
                    <td className="font-medium">{box.name}</td>
                    <td>{box.box_assets?.length || 0}{box.expected_asset_count ? ` / ${box.expected_asset_count}` : ""}</td>
                    <td>
                      <Badge variant={statusMap[box.status]?.[1] || "outline"}>
                        {statusMap[box.status]?.[0] || box.status}
                      </Badge>
                    </td>
                    <td>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(box)}>Editar</Button>
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
