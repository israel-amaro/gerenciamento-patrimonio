import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Badge, Button, Card, EmptyState, FormField, Icon, InlineMessage, Input, LoadingState } from "../components/ui";
import { useAsyncData } from "../hooks/useAsyncData";
import { labsApi, lookupApi } from "../lib/api";
import { buildLabQrUrl, ensureLabQrUrl } from "../lib/qr";

const createInitialForm = () => {
  const id = crypto.randomUUID();

  return {
    id,
    name: "",
    location: "",
    qr_code_value: buildLabQrUrl(id),
    assetIds: []
  };
};

const LabsPage = () => {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(createInitialForm);
  const [isEditing, setIsEditing] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [qrPreview, setQrPreview] = useState("");

  const labs = useAsyncData(() => labsApi.list(search), [search]);
  const assets = useAsyncData(() => lookupApi.assets(), []);

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

  const handleEdit = (lab) => {
    setForm({
      id: lab.id,
      name: lab.name,
      location: lab.location || "",
      qr_code_value: ensureLabQrUrl(lab.qr_code_value, lab.id),
      assetIds: lab.assets?.map((asset) => asset.id) || []
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
        throw new Error("Informe o nome do laboratorio.");
      }

      const payload = {
        id: form.id,
        name: form.name.trim(),
        location: form.location.trim() || null,
        qr_code_value: form.qr_code_value.trim(),
        assetIds: form.assetIds
      };

      if (isEditing) {
        await labsApi.update(form.id, payload);
      } else {
        await labsApi.create(payload);
      }

      reset();
      await Promise.all([labs.reload(), assets.reload()]);
    } catch (err) {
      setFeedback(err.message || "Não foi possível salvar o laboratório.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">Laboratórios</h1>
        <Button onClick={() => (showForm ? setShowForm(false) : handleCreate())}>
          <Icon name="plus" className="mr-2" />
          {showForm ? "Fechar" : "Novo laboratório"}
        </Button>
      </div>

      {showForm ? (
        <Card>
          <form className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4" onSubmit={handleSubmit}>
            <FormField label="Nome">
              <Input name="name" value={form.name} onChange={handleChange} />
            </FormField>
            <FormField label="Localizacao">
              <Input name="location" value={form.location} onChange={handleChange} />
            </FormField>
            <div className="md:col-span-2">
              <FormField label="Link salvo no QR">
                <Input name="qr_code_value" value={form.qr_code_value} onChange={handleChange} />
              </FormField>
            </div>
            <div className="md:col-span-1">
              <FormField label="Preview do QR">
                <div className="min-h-40 rounded-md border border-dashed border-border bg-muted/20 flex items-center justify-center p-4">
                  {qrPreview ? <img src={qrPreview} alt={`QR do laboratorio ${form.name || form.id}`} className="h-36 w-36" /> : <span className="text-sm text-muted-foreground">QR indisponivel</span>}
                </div>
              </FormField>
            </div>
            <div className="md:col-span-3">
              <FormField label="Ativos do laboratorio">
                <div className="rounded-md border border-border bg-white p-3 space-y-2 max-h-72 overflow-y-auto">
                  {assets.data?.map((asset) => {
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
              <Button type="submit" disabled={submitting}>{submitting ? "Salvando..." : "Salvar laboratorio"}</Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card>
        <div className="p-4 border-b bg-muted/20">
          <Input placeholder="Buscar laboratorio..." className="max-w-sm" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="overflow-x-auto">
          {labs.loading ? <div className="p-4"><LoadingState /></div> : null}
          {labs.error ? <div className="p-4"><InlineMessage tone="error">{labs.error}</InlineMessage></div> : null}
          {!labs.loading && !labs.error && labs.data?.length === 0 ? (
            <EmptyState title="Nenhum laboratorio cadastrado" description="Cadastre os laboratorios para gerar os QRs gerais de uso." />
          ) : null}
          {labs.data?.length ? (
            <table>
              <thead>
                <tr>
                  <th>Laboratório</th>
                  <th>Localizacao</th>
                  <th>Qtd. ativos</th>
                  <th>QR</th>
                  <th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {labs.data.map((lab) => (
                  <tr key={lab.id} className="hover:bg-muted/50">
                    <td className="font-medium">{lab.name}</td>
                    <td>{lab.location || "-"}</td>
                    <td><Badge variant="outline">{lab.assets?.length || 0} ativos</Badge></td>
                    <td>{lab.qr_code_value ? "Gerado" : "Pendente"}</td>
                    <td>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(lab)}>Editar</Button>
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

export default LabsPage;
